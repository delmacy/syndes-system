#!/usr/bin/env python3
"""Initialize the dedicated Manager login from the DevServer01 Actions account."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess
import sys
import tempfile

DB = "syndes-postgres-postgres-1"
DATA_NETWORK = "syndes-master-data"
RUNTIME = Path("/home/delmacy/.local/share/syndes-platform-manager/runtime")
ROLE = "syndes_master_api"
CONTROL = "syndes_control"
URL_PREFIX = f"postgresql://{ROLE}:"
URL_SUFFIX = f"@syndes-control-postgres:5432/{CONTROL}?sslmode=disable"

ROLE_CHECK = """
SELECT json_build_object(
  'password_set', rolpassword IS NOT NULL,
  'restricted_role', rolcanlogin
    AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls),
  'no_role_memberships', NOT EXISTS (SELECT FROM pg_auth_members WHERE member=pg_authid.oid),
  'active_owner', EXISTS (SELECT FROM platform_operator_access WHERE role='owner' AND state='active'),
  'control_connect', has_database_privilege(oid, 'syndes_control', 'CONNECT'),
  'tenant_connect_denied', NOT EXISTS (
    SELECT FROM pg_database AS db
    WHERE db.datname LIKE 'syndes_tenant_%' AND has_database_privilege(pg_authid.oid, db.oid, 'CONNECT')
  ),
  'identity_connect_denied', NOT EXISTS (
    SELECT FROM pg_database AS db
    WHERE db.datname IN ('syndes_openfga','syndes_keycloak')
      AND has_database_privilege(pg_authid.oid, db.oid, 'CONNECT')
  ),
  'schema_create_denied', NOT has_schema_privilege(oid, 'public', 'CREATE'),
  'metadata_read_only', NOT EXISTS (
    SELECT FROM unnest(ARRAY['tenant_registry','tenant_memberships',
      'platform_operator_access','platform_tenant_profiles']) AS tab(name)
    WHERE NOT has_table_privilege(pg_authid.oid, tab.name, 'SELECT')
      OR has_table_privilege(pg_authid.oid, tab.name, 'INSERT,UPDATE,DELETE,TRUNCATE')
  )
)
FROM pg_authid WHERE rolname='syndes_master_api'
"""

REQUIRED_CHECKS = (
    "restricted_role", "no_role_memberships", "active_owner", "control_connect",
    "tenant_connect_denied", "identity_connect_denied", "schema_create_denied", "metadata_read_only",
)

PSQL = ["psql", "-XqAt", "-v", "ON_ERROR_STOP=1"]


def run(args, *, input_data=None):
    return subprocess.run(
        ["docker", *args], input=input_data, capture_output=True, text=True, timeout=45,
    )


def role_has_password(db):
    result = run(["exec", "-u", "postgres", db, *PSQL, "-w", "-U", "postgres",
                  "-d", CONTROL, "-c", ROLE_CHECK])
    if result.returncode:
        raise RuntimeError("PostgreSQL could not read the Manager role and grants")
    if not result.stdout.strip():
        raise RuntimeError("Dedicated Manager role is absent")
    checks = json.loads(result.stdout)
    failed = [name for name in REQUIRED_CHECKS if checks.get(name) is not True]
    if failed:
        raise RuntimeError("Manager preflight failed: " + ", ".join(failed))
    return checks["password_set"] is True


def check_private(path, expected_mode):
    info = path.lstat()
    file_type = stat.S_ISDIR if expected_mode == 0o700 else stat.S_ISREG
    if not file_type(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != expected_mode:
        raise RuntimeError("Unexpected owner or permissions for the Manager runtime")


def load_password(path):
    check_private(path, 0o600)
    content = path.read_text(encoding="ascii").strip()
    match = re.fullmatch(re.escape(URL_PREFIX) + r"([A-Za-z0-9_-]{64})" + re.escape(URL_SUFFIX), content)
    if match is None:
        raise RuntimeError("Manager credential file is invalid")
    return match.group(1)


def save_password(path, password):
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent) as temporary:
        temporary.write(URL_PREFIX + password + URL_SUFFIX + "\n")
        temporary.flush()
        os.fsync(temporary.fileno())
        # Publish without overwriting an existing credential.
        os.link(temporary.name, path)
    directory = os.open(path.parent, os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def verify_login(db, network, path):
    image = run(["inspect", "--format", "{{.Image}}", db])
    if image.returncode or not re.fullmatch(r"sha256:[a-f0-9]{64}", image.stdout.strip()):
        raise RuntimeError("PostgreSQL client image could not be identified")
    check = """
set -eu
pg() {
  psql -XqAt -w -v ON_ERROR_STOP=1 -h syndes-control-postgres -d syndes_control -U syndes_master_api "$@"
}
if pg -c 'SELECT 1' >/dev/null 2>&1; then exit 1; fi
IFS= read -r url
pw=${url#postgresql://syndes_master_api:}
umask 077
printf 'syndes-control-postgres:5432:syndes_control:syndes_master_api:%s\n' "${pw%%@*}" > /tmp/.pgpass
unset url pw
PGPASSFILE=/tmp/.pgpass pg -c 'SELECT current_database(), current_user'
"""
    result = run([
        "run", "--rm", "-i", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
        "--network", network, "--user", str(os.getuid()) + ":" + str(os.getgid()),
        "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=1m,mode=1777",
        "--entrypoint", "/bin/sh", image.stdout.strip(), "-c", check,
    ], input_data=path.read_text(encoding="ascii"))
    if result.returncode or result.stdout.strip() != f"{CONTROL}|{ROLE}":
        raise RuntimeError("Dedicated database login failed verification on the Manager network")


def provision(runtime, db=DB, network=DATA_NETWORK):
    os.umask(0o077)
    if runtime.resolve() != runtime:
        raise RuntimeError("Manager runtime directory must not traverse symlinks")
    runtime.mkdir(parents=True, exist_ok=True)
    check_private(runtime, 0o700)

    lock_fd = os.open(runtime / ".provision-lock", os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if run(["network", "inspect", "--format", "{{.Internal}}", network]).stdout.strip() != "true":
            raise RuntimeError("Dedicated internal Manager data network is missing")

        path = runtime / "master_db_url"
        password_set = role_has_password(db)
        if os.path.lexists(path):
            password = load_password(path)
        elif password_set:
            raise RuntimeError("Manager role already has a password from a different bootstrap")
        else:
            password = secrets.token_urlsafe(48)
            # Store first so an interrupted operation can reconcile without rotating a role.
            save_password(path, password)

        if not password_set:
            # psql's password command uses libpq to submit a SCRAM verifier without
            # sending the password itself as SQL text, argv, or environment.
            result = run(["exec", "-i", "-u", "postgres", db, *PSQL, "-U", "postgres",
                          "-d", CONTROL, "-c", "SET password_encryption='scram-sha-256'",
                          "-c", r"\password syndes_master_api"],
                         input_data=f"{password}\n{password}\n")
            if result.returncode or not role_has_password(db):
                raise RuntimeError("Failed to initialize Manager SQL login")

        verify_login(db, network, path)
        print("MANAGER_FILE_DB_LOGIN=PASS")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", required=True)
    parser.parse_args()
    if (
        os.getuid() != 1000
        or os.uname().nodename.split(".")[0] != "DevServer01"
        or os.getenv("SYNDES_MANAGER_DEPLOY_APPROVAL") != "ACTIONS_APPROVED_MANAGER_FILE_DEPLOY"
    ):
        raise RuntimeError("Run through the approved DevServer01 Actions job")
    provision(RUNTIME)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # No subprocess output, DSN, or password in Actions logs.
        print("BLOCKED: " + (str(exc) if type(exc) is RuntimeError else type(exc).__name__),
              file=sys.stderr)
        raise SystemExit(2) from None
