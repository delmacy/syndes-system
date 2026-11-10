#!/usr/bin/env python3
"""Explicit, interactive, one-time Platform Manager credential bootstrap.

Run as an authorized sudo operator on DevServer01 with --apply. The OpenBao
admin token is read only from the operator's terminal, never via argv, env,
Git, Docker metadata, a saved file or command history. No tenant credentials
or application auth mechanisms are reused.

The process intentionally fails closed if partially provisioned. The audit
record enables manual reconciliation; rerunning never rotates existing
platform credentials or silently overwrites AppRoles.
"""
import argparse
from datetime import datetime, timezone
import getpass
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import socket
import ssl
import subprocess
import sys

CA_DEFAULT = Path("/srv/syndes-lab/system/infra/security-access/openbao/tls/server.crt")
APPROLE_NAME = "syndes-platform-manager"
POLICY_NAME = "syndes-platform-manager-runtime"
KV_PATH = "/v1/kv/data/production/platform-manager"
AUTH_DIR = Path("/run/syndes/approle/platform-manager")
RUNTIME_DIR = Path("/run/syndes/platform-manager")
AUDIT_DIR = Path("/var/lib/syndes-platform-manager")
AUDIT_PATH = AUDIT_DIR / "bootstrap-audit.json"
REPO = Path(__file__).resolve().parents[3]


def checked_password(password):
    if not isinstance(password, str) or not re.fullmatch(r"[A-Za-z0-9_-]{32,256}", password):
        raise ValueError("Invalid random SQL credential")
    return password


def sql_password_change(password):
    checked_password(password)
    # Only ASCII base64url values are accepted; SQL statement goes to stdin.
    return "ALTER ROLE syndes_master_api PASSWORD '" + password + "';\n"


def ensure_private(path):
    if path.is_symlink() or path.stat().st_mode & 0o077 or path.stat().st_uid != 0:
        raise RuntimeError("Private directory permission or ownership mismatch")


def docker_output(*args):
    p = subprocess.run(["docker", *args], capture_output=True, check=True,
                       text=True, timeout=15)
    return p.stdout


def pg_scalar(query):
    return docker_output("exec", "-u", "postgres", "syndes-postgres-postgres-1",
                         "psql", "-w", "-X", "-U", "postgres", "-d",
                         "syndes_control", "-tAc", query).strip()


def postgres_preflight():
    role = pg_scalar("SELECT rolcanlogin::text || ':' || rolsuper::text || ':' || "
                     "(rolpassword IS NULL)::text FROM pg_authid "
                     "WHERE rolname='syndes_master_api'")
    if role != "true:false:true":
        raise RuntimeError("Dedicated PostgreSQL role missing, privileged or already provisioned")
    # First owner already proved by immutable Keycloak sub, not by tenant membership.
    if pg_scalar("SELECT count(*) FROM platform_operator_access "
                 "WHERE role='owner' AND state='active'") != "1":
        raise RuntimeError("Expected exactly one active platform owner")


def postgres_set_password(password):
    sql = sql_password_change(password)
    p = subprocess.run(["docker", "exec", "-i", "-u", "postgres",
                        "syndes-postgres-postgres-1", "psql", "-w", "-X",
                        "-q", "-v", "ON_ERROR_STOP=1", "-U", "postgres",
                        "-d", "syndes_control"],
                       input=sql, capture_output=True, text=True, timeout=15)
    if p.returncode != 0:
        # Deliberately discard diagnostic output that could contain SQL text.
        raise RuntimeError("Dedicated PostgreSQL password write failed")
    if pg_scalar("SELECT (rolpassword IS NOT NULL)::text FROM pg_authid "
                 "WHERE rolname='syndes_master_api'") != "true":
        raise RuntimeError("PostgreSQL credential verification failed")


def trusted_openbao_ip():
    config = json.loads(docker_output("network", "inspect", "syndes-secrets"))
    if len(config) != 1 or config[0].get("Internal") is not True:
        raise RuntimeError("OpenBao bridge is not the approved internal network")
    containers = config[0].get("Containers") or {}
    candidates = [c.get("IPv4Address", "").split("/")[0]
                  for c in containers.values()
                  if c.get("Name") == "syndes-security-access-openbao-1"]
    if len(candidates) != 1 or not ipaddress.ip_address(candidates[0]).is_private:
        raise RuntimeError("OpenBao not present on the approved internal network")
    return candidates[0]


class Bao:
    """HTTPS pinned by the trusted CA and DNS SAN 'openbao', even via bridge IP."""
    def __init__(self, ip, cafile, token):
        self.ip = ip
        self.context = ssl.create_default_context(cafile=str(cafile))
        self.token = token

    def request(self, method, path, payload=None, *, missing_ok=False):
        tls = None
        connection = None
        try:
            raw = socket.create_connection((self.ip, 8200), timeout=8)
            tls = self.context.wrap_socket(raw, server_hostname="openbao")
            connection = http.client.HTTPSConnection("openbao", 8200,
                                                      context=self.context, timeout=8)
            connection.sock = tls
            headers = {"Accept": "application/json", "X-Vault-Token": self.token}
            data = None
            if payload is not None:
                headers["Content-Type"] = "application/json"
                data = json.dumps(payload).encode()
            connection.request(method, path, body=data, headers=headers)
            res = connection.getresponse()
            body = res.read()
            if missing_ok and res.status == 404:
                return None
            if res.status < 200 or res.status >= 300:
                # Never echo OpenBao responses, which may contain secrets.
                raise RuntimeError("OpenBao operator API denied the operation: HTTP " + str(res.status))
            return json.loads(body) if body else {}
        finally:
            if connection:
                connection.close()
            elif tls:
                tls.close()


def write_audit(record, *, initial=False):
    AUDIT_DIR.mkdir(mode=0o700, parents=False, exist_ok=True)
    ensure_private(AUDIT_DIR)
    if initial:
        with AUDIT_PATH.open("x", encoding="utf-8") as out:
            os.fchmod(out.fileno(), 0o600)
            json.dump(record, out)
            out.write("\n")
            out.flush()
            os.fsync(out.fileno())
    else:
        tmp = AUDIT_DIR / ".bootstrap-audit.pending"
        with tmp.open("x", encoding="utf-8") as out:
            os.fchmod(out.fileno(), 0o600)
            json.dump(record, out)
            out.write("\n")
            out.flush()
            os.fsync(out.fileno())
        os.replace(tmp, AUDIT_PATH)


def private_file(path, value):
    if not isinstance(value, str) or not value or len(value) > 512 or "\n" in value:
        raise RuntimeError("Invalid AppRole credential response")
    with path.open("x", encoding="utf-8") as out:
        os.fchmod(out.fileno(), 0o600)
        out.write(value + "\n")
        out.flush()
        os.fsync(out.fileno())


def operator_preflight(cafile):
    if os.geteuid() != 0:
        raise RuntimeError("Operator must use sudo without bypassing host ACLs")
    if not cafile.is_file() or not cafile.is_absolute():
        raise RuntimeError("Approved OpenBao TLS public certificate is unavailable")
    if subprocess.run(["findmnt", "-T", "/run", "-no", "FSTYPE"],
                      capture_output=True, text=True, timeout=5).stdout.strip() != "tmpfs":
        raise RuntimeError("Runtime must use /run tmpfs")
    if not (REPO / "infra/master-admin/openbao/master-runtime.hcl").is_file():
        raise RuntimeError("Dedicated OpenBao policy template missing")
    ensure_private(Path("/run/syndes"))
    postgres_preflight()
    if AUDIT_PATH.exists() or AUTH_DIR.exists() or (RUNTIME_DIR / "master_db_url").exists():
        raise RuntimeError("Manager bootstrap appears already attempted; reconcile before any retry")
    return trusted_openbao_ip()


def apply(cafile, ip):
    token = getpass.getpass("Token administrativo OpenBao (entrada oculta): ").strip()
    if not token or len(token) > 2048:
        raise RuntimeError("Operator must supply an approved OpenBao token privately")
    bao = Bao(ip, cafile, token)
    mounts = bao.request("GET", "/v1/sys/mounts")
    mounts = mounts.get("data", mounts) if isinstance(mounts, dict) else {}
    mount = mounts.get("kv/") if isinstance(mounts, dict) else None
    if not isinstance(mount, dict) or (mount.get("options") or {}).get("version") != "2":
        raise RuntimeError("Expected pre-existing KV v2 at kv/; refusing global mount changes")
    auths = bao.request("GET", "/v1/sys/auth")
    auths = auths.get("data", auths) if isinstance(auths, dict) else {}
    if not isinstance(auths, dict) or not isinstance(auths.get("approle/"), dict) or auths["approle/"].get("type") != "approle":
        raise RuntimeError("Existing approved AppRole auth method is required")
    role_path = "/v1/auth/approle/role/" + APPROLE_NAME
    if bao.request("GET", role_path, missing_ok=True) is not None:
        raise RuntimeError("Manager AppRole already exists; refusing replacement")
    if bao.request("GET", KV_PATH, missing_ok=True) is not None:
        raise RuntimeError("Manager KV credential already exists; refusing overwrite")
    template = (REPO / "infra/master-admin/openbao/master-runtime.hcl").read_text()
    if "kv/data/production/platform-manager" not in template or "kv/data/production/core-host" in template:
        raise RuntimeError("Refusing unapproved broad secret policy")
    policy_path = "/v1/sys/policies/acl/" + POLICY_NAME
    existing = bao.request("GET", policy_path, missing_ok=True)
    if existing is not None and (existing.get("data") or {}).get("policy") != template:
        raise RuntimeError("Existing policy differs; refusing overwrite")

    audit = {"operation": "first-manager-openbao-bootstrap",
             "operator": os.getenv("SUDO_USER") or "root",
             "started_utc": datetime.now(timezone.utc).isoformat(),
             "state": "started", "stages": []}
    write_audit(audit, initial=True)

    def advance(stage):
        audit["stages"].append(stage)
        write_audit(audit)

    try:
        if existing is None:
            bao.request("PUT", policy_path, {"policy": template})
        advance("dedicated_policy_present")
        bao.request("POST", role_path, {
            "token_policies": [POLICY_NAME],
            "token_ttl": "5m", "token_max_ttl": "10m",
            "token_no_default_policy": True,
            "secret_id_ttl": "720h", "secret_id_num_uses": 10,
            "bind_secret_id": True
        })
        advance("dedicated_approle_created")
        role_id = (bao.request("GET", role_path + "/role-id").get("data") or {}).get("role_id")
        secret_id = (bao.request("POST", role_path + "/secret-id", {}).get("data") or {}).get("secret_id")
        # Random base64url, never entered into shell, argv, env or a persistent file.
        password = checked_password(secrets.token_urlsafe(48))
        bao.request("POST", KV_PATH, {"options": {"cas": 0}, "data": {"master_db_password": password}})
        advance("dedicated_kv_password_created")
        postgres_set_password(password)
        advance("dedicated_sql_role_password_set")
        AUTH_DIR.mkdir(mode=0o700, parents=True, exist_ok=False)
        ensure_private(AUTH_DIR)
        private_file(AUTH_DIR / "role-id", role_id)
        private_file(AUTH_DIR / "secret-id", secret_id)
        advance("private_approle_files_published")
        env = dict(os.environ, MASTER_BAO_CA_FILE=str(cafile))
        p = subprocess.run(["bash", str(REPO / "infra/master-admin/openbao/run-renderer.sh")],
                           cwd=str(REPO), env=env, capture_output=True, timeout=90)
        if p.returncode != 0:
            raise RuntimeError("Scoped OpenBao rendering failed; inspect without printing credentials")
        dsn = RUNTIME_DIR / "master_db_url"
        if not dsn.is_file() or dsn.stat().st_mode & 0o777 != 0o600 or dsn.stat().st_uid != 1000:
            raise RuntimeError("Rendered credential permissions invalid")
        advance("runtime_secret_rendered")
        audit["state"] = "complete"
        audit["completed_utc"] = datetime.now(timezone.utc).isoformat()
        write_audit(audit)
        print("MANAGER_OPENBAO_BOOTSTRAP=COMPLETE; scope exclusive; runtime file verified")
    except Exception:
        audit["state"] = "manual_reconciliation_required"
        audit["failed_utc"] = datetime.now(timezone.utc).isoformat()
        write_audit(audit)
        raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--preflight", action="store_true")
    modes.add_argument("--apply", action="store_true")
    parser.add_argument("--ca-cert", type=Path, default=CA_DEFAULT)
    args = parser.parse_args()
    ip = operator_preflight(args.ca_cert)
    if args.preflight:
        print("MANAGER_OPENBAO_OPERATOR_PREFLIGHT=PASS; no changes made")
        return
    apply(args.ca_cert, ip)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Errors mention only stage or failure type, never credentials or responses.
        print("BLOCKED: " + type(exc).__name__ + ": " + str(exc), file=sys.stderr)
        raise SystemExit(2) from None
