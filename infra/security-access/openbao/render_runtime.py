#!/usr/bin/env python3
"""One-shot, offline-approved OpenBao -> Docker Secret file renderer.

Runs in an isolated provisioning container on the syndes-secrets network.
OpenBao must already be initialized/unsealed. The output directory MUST be an
OS tmpfs mounted from /run/syndes/runtime, never a Git workspace.
"""
import json
import os
from pathlib import Path
import re
import ssl
import sys
import tempfile
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import quote

def fail(message):
    raise RuntimeError(message)

def require(value, key):
    if not isinstance(value, str) or len(value) < 20 or "\n" in value or "\r" in value:
        fail("Missing/unsafe field: " + key)
    return value

def password(value, key):
    value = require(value, key)
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,256}", value):
        fail("Use a generated base64url secret for: " + key)
    return value

def read(path):
    return Path(path).read_text(encoding="utf-8").strip()

def main():
    address = os.environ.get("BAO_ADDR", "https://openbao:8200")
    if address != "https://openbao:8200":
        fail("Unexpected OpenBao endpoint")
    out = Path("/mnt/runtime")
    if not out.is_dir() or out.is_symlink():
        fail("Missing protected runtime directory")
    context = ssl.create_default_context(cafile="/etc/openbao/ca.crt")
    def api(route, body=None, token=None):
        headers = {"Content-Type": "application/json"}
        if token: headers["X-Vault-Token"] = token
        data = json.dumps(body).encode() if body is not None else None
        req = Request(address + route, data=data, headers=headers,
                      method="POST" if body is not None else "GET")
        with urlopen(req, timeout=8, context=context) as resp:
            return json.loads(resp.read() or b"{}")
    role_id, secret_id = read("/run/approle/role-id"), read("/run/approle/secret-id")
    token = api("/v1/auth/approle/login", {"role_id": role_id, "secret_id": secret_id})["auth"]["client_token"]
    try:
        def kv(component):
            return api("/v1/kv/data/production/" + component, token=token)["data"]["data"]
        pg, keycloak, fga = kv("postgres"), kv("keycloak"), kv("openfga")
        admin = password(pg["admin_password"], "admin_password")
        pkey = password(pg["keycloak_password"], "keycloak_password")
        pfga = password(pg["openfga_password"], "openfga_password")
        pcore = password(pg["core_password"], "core_password")
        kadmin = password(keycloak["bootstrap_admin_password"], "bootstrap_admin_password")
        fkey = password(fga["preshared_key"], "preshared_key")
        username = keycloak.get("bootstrap_admin_username", "syndes-bootstrap")
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", username):
            fail("Invalid Keycloak bootstrap username")
        # Keycloak config supports sensitive values in file-backed options.
        keycloak_conf = ("db-password=" + pkey + "\n"
                         "bootstrap-admin-username=" + username + "\n"
                         "bootstrap-admin-password=" + kadmin + "\n")
        # OpenFGA supports YAML; serialized JSON is a valid YAML 1.2 document.
        db_uri = ("postgres://syndes_openfga:" + quote(pfga, safe="") +
                  "@syndes-postgres:5432/syndes_openfga?sslmode=disable")
        openfga_conf = json.dumps({"datastore":{"engine":"postgres","uri":db_uri},
            "authn":{"method":"preshared","preshared":{"keys":[fkey]}},
            "playground":{"enabled":False},"log":{"format":"json"}}) + "\n"
        values = {
            "pg_admin_password":admin + "\n",
            "pg_keycloak_password":pkey + "\n",
            "pg_openfga_password":pfga + "\n",
            "pg_core_password":pcore + "\n",
            "keycloak.conf":keycloak_conf,
            "openfga.yaml":openfga_conf
        }
        for name, content in values.items():
            # Mount point is root-owned tmpfs; no other services receive directory access.
            fd, tmp = tempfile.mkstemp(prefix="." + name + ".", dir=out)
            try:
                os.fchmod(fd, 0o600)
                with os.fdopen(fd, "w", encoding="utf-8") as stream:
                    stream.write(content)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.chmod(tmp, 0o644)  # Directory is 0700; Docker binds individual files read-only.
                os.replace(tmp, out / name)
            finally:
                if os.path.exists(tmp):
                    os.unlink(tmp)
        print("Secrets rendered: postgres (4), Keycloak, OpenFGA; no values logged")
    finally:
        try:
            req = Request(address + "/v1/auth/token/revoke-self",
                          data=b"{}", method="POST", headers={"X-Vault-Token":token})
            with urlopen(req, timeout=8, context=context) as resp:
                if resp.status not in (200, 204): fail("Token revocation failed")
        except (HTTPError, URLError) as exc:
            fail("OpenBao bootstrap token was not revoked: " + type(exc).__name__)

if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print("Secret rendering failed: " + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
