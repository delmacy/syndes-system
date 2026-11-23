#!/usr/bin/env python3
"""Prepare protected copies from existing mounts and verify read-only logins."""
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys
import tempfile
from urllib.parse import quote, unquote, urlsplit

PG = "syndes-postgres-postgres-1"
CORE = "syndes-core-host-whatsapp-v2"
KEYCLOAK = "syndes-security-access-keycloak-1"
FGA = "syndes-security-access-openfga-1"
OUTPUT = Path("/home/delmacy/.local/share/syndes-operational-secrets")
PILOT_SECRET = Path("/home/delmacy/.local/share/syndes-greenfield-production/secrets/greenfield-pilot-production-tenant-db")
PILOT = "1f5a8ce9-3f01-48cc-a013-2198d99e7510"
PILOT_SUFFIX = PILOT.replace("-", "")

MOUNTS = {
    **{name: (PG, "/run/secrets/" + name) for name in (
        "pg_admin_password", "pg_keycloak_password", "pg_openfga_password", "pg_core_password",
    )},
    "keycloak.conf": (KEYCLOAK, "/run/secrets/keycloak.conf"),
    "openfga.yaml": (FGA, "/etc/openfga/config.yaml"),
}


def docker(*args, input_data=None):
    result = subprocess.run(
        ["docker", *args], input=input_data, capture_output=True, text=True, timeout=35,
    )
    if result.returncode:
        raise RuntimeError("Unable to verify or read an approved runtime dependency")
    return result.stdout


def mounted_file(name, container, destination):
    inspected = docker("inspect", "-f", "{{.Id}}\n{{json .Mounts}}", container)
    identity, mounts = inspected.splitlines()
    if not re.fullmatch(r"[0-9a-f]{64}", identity):
        raise RuntimeError("Expected an exact runtime container")
    matching = [mount for mount in json.loads(mounts) if mount["Destination"] == destination]
    if len(matching) != 1 or not (
        matching[0]["Type"] == "bind" and matching[0]["RW"] is False
        and matching[0]["Source"] == "/run/syndes/runtime/" + name
    ):
        raise RuntimeError("Unexpected source mount for " + name)
    value = docker("exec", "-u", "0", identity, "cat", destination)
    if not value or len(value) > 65536:
        raise RuntimeError("Missing or oversized approved runtime file")
    return value


def private_path(path, mode, is_directory=False):
    info = path.lstat()
    predicate = stat.S_ISDIR if is_directory else stat.S_ISREG
    if not predicate(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != mode:
        raise RuntimeError("Unexpected owner or permissions for a credential path")


def password(value):
    value = value.strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,256}", value):
        raise RuntimeError("Unexpected credential format")
    return value


def connection(role, db, secret):
    return f"postgresql://{role}:{quote(secret, safe='')}@syndes-postgres:5432/{db}?sslmode=disable"


def credentials():
    files = {name: mounted_file(name, *source) for name, source in MOUNTS.items()}
    if PILOT_SECRET.resolve() != PILOT_SECRET:
        raise RuntimeError("Unexpected pilot credential path")
    private_path(PILOT_SECRET, 0o600)
    roles = {
        "postgres": ("postgres", password(files["pg_admin_password"])),
        "syndes_core": ("syndes_control", password(files["pg_core_password"])),
        "syndes_keycloak": ("syndes_keycloak", password(files["pg_keycloak_password"])),
        "syndes_openfga": ("syndes_openfga", password(files["pg_openfga_password"])),
        "syndes_t_" + PILOT_SUFFIX: ("syndes_tenant_" + PILOT_SUFFIX, password(PILOT_SECRET.read_text())),
    }
    fga = json.loads(files["openfga.yaml"])
    keys = fga["authn"]["preshared"]["keys"]
    if len(keys) != 1 or fga["authn"]["method"] != "preshared":
        raise RuntimeError("Expected a single OpenFGA runtime key")
    fga_token = password(keys[0])
    uri = urlsplit(fga["datastore"]["uri"])
    if (uri.hostname != "syndes-postgres" or uri.path != "/syndes_openfga"
            or uri.username != "syndes_openfga"
            or unquote(uri.password or "") != roles["syndes_openfga"][1]):
        raise RuntimeError("OpenFGA configuration does not match its SQL login")
    keycloak = dict(line.split("=", 1) for line in files["keycloak.conf"].splitlines()
                    if "=" in line and not line.lstrip().startswith("#"))
    if keycloak.get("db-password", "").strip().strip('"') != roles["syndes_keycloak"][1]:
        raise RuntimeError("Keycloak configuration does not match its SQL login")
    core_url = connection("syndes_core", *roles["syndes_core"])
    files["operational-core.json"] = json.dumps({
        "namespace": "production", "control_db_url": core_url, "openfga_token": fga_token,
    }) + "\n"
    files[f"operational-tenants/{PILOT}.json"] = json.dumps({
        "namespace": "production", "username": "syndes_t_" + PILOT_SUFFIX,
        "password": roles["syndes_t_" + PILOT_SUFFIX][1],
    }) + "\n"
    return files, roles, fga_token


VERIFY_SQL = r"""
set -eu
umask 077
cat > /tmp/.pgpass
export PGPASSFILE=/tmp/.pgpass PGCONNECT_TIMEOUT=3 PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=4000'
query(){
    psql -XqAtw -v ON_ERROR_STOP=1 -h syndes-postgres -U "$1" -d "$2" -c "$3"
}
pilot="$1"
suffix="$2"
for entry in postgres:postgres syndes_core:syndes_control syndes_keycloak:syndes_keycloak syndes_openfga:syndes_openfga "syndes_t_${suffix}:syndes_tenant_${suffix}"; do
    role="${entry%%:*}"
    database="${entry#*:}"
    [ "$(query "$role" "$database" 'SELECT current_user, current_database()')" = "$role|$database" ]
done
[ "$(query syndes_core syndes_control "SELECT tenant_id::text,state FROM public.tenant_registry WHERE state IN ('active','provisioned') ORDER BY tenant_id LIMIT 2")" = "$pilot|provisioned" ]
echo OPERATIONAL_FILE_SQL_READONLY_PASS
"""

VERIFY_FGA = r"""
const {readFileSync}=require('node:fs');
const token=readFileSync(0,'utf8');
async function verify(){
  const store=process.env.CORE_OPENFGA_STORE_ID??'';
  if(!/^[A-Za-z0-9_-]{8,128}$/.test(store))throw Error();
  const endpoint='http://openfga:8080/stores/'+store;
  const anonymous=await fetch(endpoint,{redirect:'error',signal:AbortSignal.timeout(5000)});
  if(anonymous.status!==401&&anonymous.status!==403)throw Error();
  const response=await fetch(endpoint,{
    redirect:'error',signal:AbortSignal.timeout(5000),headers:{Authorization:'Bearer '+token},
  });
  if(!response.ok||(await response.json()).id!==store)throw Error();
  console.log('OPERATIONAL_FILE_FGA_READONLY_PASS');
}
verify().catch(()=>process.exit(2));
"""


def verify_sql(roles, pg=PG, network="syndes-data"):
    if docker("network", "inspect", "--format", "{{.Internal}}", network).strip() != "true":
        raise RuntimeError("Expected an internal PostgreSQL network")
    image = docker("inspect", "-f", "{{.Image}}", pg).strip()
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", image):
        raise RuntimeError("Expected the running PostgreSQL image")
    pgpass = "".join(f"syndes-postgres:5432:{database}:{role}:{secret}\n"
                     for role, (database, secret) in roles.items())
    result = docker(
        "run", "--rm", "-i", "--network", network, "--user", "65534:65534",
        "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
        "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=1m,mode=1777",
        "--entrypoint", "/bin/sh", image, "-c", VERIFY_SQL, "verify-sql", PILOT, PILOT_SUFFIX,
        input_data=pgpass,
    )
    if result.strip() != "OPERATIONAL_FILE_SQL_READONLY_PASS":
        raise RuntimeError("Operational PostgreSQL read-only verification failed")
    print(result.strip(), flush=True)


def sync_directory(path):
    descriptor = os.open(path, os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def publish(files):
    if OUTPUT.resolve() != OUTPUT:
        raise RuntimeError("Unexpected operational credential directory")
    if os.path.lexists(OUTPUT):
        private_path(OUTPUT, 0o700, True)
        private_path(OUTPUT / "operational-tenants", 0o700, True)
        for name, content in files.items():
            path = OUTPUT / name
            private_path(path, 0o600)
            if path.read_text() != content:
                raise RuntimeError("Existing credential set requires reconciliation")
        return
    with tempfile.TemporaryDirectory(prefix=".syndes-operational-secrets-", dir=OUTPUT.parent) as candidate:
        root = Path(candidate)
        (root / "operational-tenants").mkdir(mode=0o700)
        for name, content in files.items():
            with (root / name).open("x", encoding="utf-8") as out:
                os.fchmod(out.fileno(), 0o600)
                out.write(content)
                out.flush()
                os.fsync(out.fileno())
        for directory in (root / "operational-tenants", root):
            sync_directory(directory)
        root.rename(OUTPUT)
        sync_directory(OUTPUT.parent)


def main():
    if (
        os.getenv("SYNDES_PREPARE_OPERATIONAL_FILES") != "ACTIONS_APPROVED_OPERATIONAL_FILES"
        or pwd.getpwuid(os.getuid()).pw_name != "delmacy"
        or os.uname().nodename.split(".")[0] != "DevServer01"
    ):
        raise RuntimeError("Expected the approved DevServer01 Actions job")
    os.umask(0o077)
    files, roles, token = credentials()
    print("OPERATIONAL_FILE_APPROVED_SOURCES_PRESENT", flush=True)
    verify_sql(roles)
    verdict = docker("exec", "-i", CORE, "node", "-e", VERIFY_FGA, input_data=token)
    if verdict.strip() != "OPERATIONAL_FILE_FGA_READONLY_PASS":
        raise RuntimeError("Operational OpenFGA read-only verification failed")
    print(verdict.strip(), flush=True)
    publish(files)
    print("OPERATIONAL_FILE_CREDENTIAL_SET_PREPARED")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("OPERATIONAL_FILE_PREPARATION_BLOCKED=" +
              (str(error) if type(error) is RuntimeError else type(error).__name__),
              file=sys.stderr)
        raise SystemExit(2) from None
