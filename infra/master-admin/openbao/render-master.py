#!/usr/bin/env python3
"""One-shot scoped OpenBao -> tmpfs Control DB secret delivery for Platform Manager."""
import json
import os
from pathlib import Path
import re
import ssl
import sys
import tempfile
from urllib.parse import quote
from urllib.request import Request, urlopen

VAULT = "https://openbao:8200"
DEST = Path("/mnt/runtime/master_db_url")

def read_approle(path):
    value = Path(path).read_text(encoding="utf-8").strip()
    if not value or len(value) > 512:
        raise RuntimeError("Missing dedicated AppRole credential")
    return value

def build_dsn(password):
    if not isinstance(password, str) or not re.fullmatch(r"[A-Za-z0-9_-]{32,256}", password):
        raise RuntimeError("Master DB password must be random base64url")
    return ("postgresql://syndes_master_api:" + quote(password, safe="") +
            "@syndes-control-postgres:5432/syndes_control?sslmode=disable\n")

def main():
    if not DEST.parent.is_dir() or DEST.parent.is_symlink():
        raise RuntimeError("Protected tmpfs mount missing")
    tls = ssl.create_default_context(cafile="/etc/openbao/ca.crt")
    def api(route, payload=None, token=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["X-Vault-Token"] = token
        data = json.dumps(payload).encode() if payload is not None else None
        req = Request(VAULT + route, data=data, headers=headers,
                      method="POST" if data is not None else "GET")
        with urlopen(req, timeout=8, context=tls) as response:
            return json.loads(response.read() or b"{}")
    role_id = read_approle("/run/approle/role-id")
    secret_id = read_approle("/run/approle/secret-id")
    token = api("/v1/auth/approle/login",
                {"role_id": role_id, "secret_id": secret_id})["auth"]["client_token"]
    try:
        secret = api("/v1/kv/data/production/platform-manager", token=token)["data"]["data"]
        dsn = build_dsn(secret.get("master_db_password"))
    finally:
        # No credential is published unless token revocation also succeeds.
        api("/v1/auth/token/revoke-self", {}, token=token)
    fd, tmp = tempfile.mkstemp(prefix=".master_db_url.", dir=DEST.parent)
    try:
        os.fchmod(fd, 0o600)
        os.fchown(fd, 1000, 1000)  # API Docker image: USER node (UID 1000).
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            output.write(dsn)
            output.flush()
            os.fsync(output.fileno())
        os.replace(tmp, DEST)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    print("Platform Manager runtime credential rendered (no values logged)")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("Platform Manager OpenBao rendering failed: " + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
