#!/usr/bin/env python3
"""Recreate a disposable stack on DevServer01 with the operational file contracts."""
import argparse
import json
import os
from pathlib import Path
import pwd
import re
import secrets
import signal
import stat
import subprocess
import sys
import tempfile
import time
from urllib.parse import unquote, urlsplit

ARCHIVE = Path("/home/delmacy/.local/share/syndes-operational-secrets")
PILOT = "1f5a8ce9-3f01-48cc-a013-2198d99e7510"
SECOND = "f986808f-2cab-4c9a-ba9f-9744b6d3584d"
PG_NAMES = ("pg_admin_password", "pg_core_password", "pg_keycloak_password", "pg_openfga_password")
LIVE = {
    "PG": "syndes-postgres-postgres-1",
    "KC": "syndes-security-access-keycloak-1",
    "FGA": "syndes-security-access-openfga-1",
}
FIXTURE_IMAGES = {
    "PG": "postgres:17-bookworm",
    "KC": "quay.io/keycloak/keycloak:26.8.1",
    "FGA": "openfga/openfga:v1.22.1",
}
SAFE = re.compile(r"[A-Za-z0-9_-]{20,256}")
IMAGE_ID = re.compile(r"sha256:[a-f0-9]{64}")
PROBE_FAILURE = re.compile(
    r"OPERATIONAL_REHEARSAL_PROBE_FAILED=(credential-files|openfga-seed|core-readiness|"
    r"keycloak-jwks|openfga-store|core-anonymous|tenant-sql)"
)


def run(args, *, env=None, stdin=None, timeout=45):
    result = subprocess.run(args, text=True, capture_output=True, env=env,
                            input=stdin, timeout=timeout, check=False)
    if result.returncode:
        for line in result.stderr.splitlines():
            if PROBE_FAILURE.fullmatch(line):
                print(line, file=sys.stderr)
        raise RuntimeError("Rehearsal command failed")
    return result.stdout.strip()


def require(condition):
    if not condition:
        raise RuntimeError("Rehearsal contract failed")


def inspect_image(image):
    value = run(["docker", "image", "inspect", "-f", "{{.Id}}", image])
    require(IMAGE_ID.fullmatch(value))
    return value


def images(core, fixture):
    result = {"CORE": inspect_image(core)}
    for service, expected in FIXTURE_IMAGES.items():
        if fixture:
            result[service] = inspect_image(expected)
        else:
            running, value = run(["docker", "inspect", "-f", "{{.State.Running}} {{.Image}}",
                                  LIVE[service]]).split()
            require(running == "true" and IMAGE_ID.fullmatch(value))
            result[service] = value
    user = run(["docker", "image", "inspect", "-f", "{{.Config.User}}", result["CORE"]])
    require(user in ("app", "10001", "10001:10001"))
    return {f"REHEARSAL_{key}_IMAGE": value for key, value in result.items()}


def owner_mode(path, predicate, mode):
    info = path.lstat()
    require(predicate(info.st_mode) and info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == mode)
    return info


def archive_file(name):
    path = ARCHIVE / name
    require(0 < owner_mode(path, stat.S_ISREG, 0o600).st_size <= 65536)
    return path.read_text(encoding="utf-8")


def verify_archive():
    require(ARCHIVE.resolve() == ARCHIVE)
    owner_mode(ARCHIVE, stat.S_ISDIR, 0o700)
    owner_mode(ARCHIVE / "operational-tenants", stat.S_ISDIR, 0o700)
    passwords = [archive_file(name).strip() for name in PG_NAMES]
    require(all(SAFE.fullmatch(value) for value in passwords))
    require(len(set(passwords)) == len(passwords))
    keycloak = archive_file("keycloak.conf").splitlines()
    require("db-password=" + passwords[2] in keycloak)
    fga = json.loads(archive_file("openfga.yaml"))
    uri = urlsplit(fga["datastore"]["uri"])
    require((uri.hostname, uri.username, uri.path) == ("syndes-postgres", "syndes_openfga", "/syndes_openfga"))
    require(unquote(uri.password or "") == passwords[3])
    keys = fga["authn"]["preshared"]["keys"]
    require(fga["authn"]["method"] == "preshared" and len(keys) == 1 and SAFE.fullmatch(keys[0]))
    core = json.loads(archive_file("operational-core.json"))
    require(core["namespace"] == "production" and core["openfga_token"] == keys[0])
    require(core["control_db_url"] == "postgresql://syndes_core:" + passwords[1] +
            "@syndes-postgres:5432/syndes_control?sslmode=disable")
    tenant = json.loads(archive_file(f"operational-tenants/{PILOT}.json"))
    require(tenant["namespace"] == "production" and tenant["username"] == role(PILOT))
    require(SAFE.fullmatch(tenant["password"]))
    print("OPERATIONAL_REHEARSAL_PROTECTED_SOURCES_PASS", flush=True)


def role(tenant):
    return "syndes_t_" + tenant.replace("-", "")


def database(tenant):
    return "syndes_tenant_" + tenant.replace("-", "")


def fixture_files(pilot_password):
    passwords = {name: secrets.token_hex(24) for name in PG_NAMES}
    token = secrets.token_hex(24)
    pg_base = "@syndes-postgres:5432/"
    files = {name: value + "\n" for name, value in passwords.items()}
    files.update({
        "keycloak.conf": "db-password=" + passwords["pg_keycloak_password"] + "\n",
        "openfga.yaml": json.dumps({
            "datastore": {"engine": "postgres", "uri": "postgres://syndes_openfga:" +
                          passwords["pg_openfga_password"] + pg_base + "syndes_openfga?sslmode=disable"},
            "authn": {"method": "preshared", "preshared": {"keys": [token]}},
            "playground": {"enabled": False},
        }),
        "operational-core.json": json.dumps({
            "namespace": "production", "openfga_token": token,
            "control_db_url": "postgresql://syndes_core:" + passwords["pg_core_password"] +
                              pg_base + "syndes_control?sslmode=disable",
        }),
        f"operational-tenants/{PILOT}.json": json.dumps({
            "namespace": "production", "username": role(PILOT), "password": pilot_password,
        }),
    })
    return files


def render(root, files):
    root.mkdir(mode=0o700)
    tenant_dir = root / "operational-tenants"
    tenant_dir.mkdir(mode=0o700)
    for name, value in files.items():
        path = root / name
        path.write_text(value, encoding="utf-8")
        # The parent is private on the host. Each service receives only its own
        # read-only bind, with read permissions for the image's unprivileged UID.
        path.chmod(0o444)
    tenant_dir.chmod(0o555)


def bootstrap(compose, pilot_password):
    for tenant, password in ((PILOT, pilot_password), (SECOND, secrets.token_hex(24))):
        db, user = database(tenant), role(tenant)
        compose("exec", "-T", "postgres", "psql", "-Xq", "-U", "postgres", "-v", "ON_ERROR_STOP=1",
                stdin=f"CREATE ROLE {user} LOGIN PASSWORD '{password}';\n"
                      f"CREATE DATABASE {db} OWNER {user};\n"
                      f"REVOKE CONNECT ON DATABASE {db} FROM PUBLIC;\n")
        compose("exec", "-T", "postgres", "psql", "-Xq", "-U", "postgres", "-v", "ON_ERROR_STOP=1",
                "-d", "syndes_control",
                stdin=f"INSERT INTO tenant_registry(tenant_id,database_name,role_name,state) "
                      f"VALUES ('{tenant}','{db}','{user}','active');\n")


def serve(compose):
    compose("up", "-d", "--force-recreate", "--wait", "--wait-timeout", "70", "postgres", timeout=90)
    print("OPERATIONAL_REHEARSAL_POSTGRES_READY", flush=True)
    compose("run", "--no-deps", "--rm", "-T", "openfga-migrate", timeout=70)
    compose("up", "-d", "--force-recreate", "keycloak", "openfga", timeout=80)


def verify(compose):
    compose("up", "-d", "--force-recreate", "core", timeout=70)
    result = compose("exec", "-T", "core", "node", "/opt/rehearsal/verify.mjs", "verify", timeout=130)
    require(result == "OPERATIONAL_REHEARSAL_HTTP_JWKS_FGA_AND_TENANT_SQL_PASS")
    print(result, flush=True)


def container_ids(compose):
    ids = {service: compose("ps", "-q", service) for service in ("postgres", "keycloak", "openfga", "core")}
    require(all(re.fullmatch(r"[a-f0-9]{64}", value) for value in ids.values()))
    return ids


def reject_invalid_core_file(compose):
    compose("up", "-d", "--force-recreate", "core", timeout=70)
    identity = compose("ps", "-aq", "core")
    require(re.fullmatch(r"[a-f0-9]{64}", identity))
    for _ in range(20):
        status = run(["docker", "inspect", "-f", "{{.State.Status}} {{.State.ExitCode}}", identity])
        if status == "exited 1":
            print("OPERATIONAL_REHEARSAL_INVALID_CORE_FILE_FAILS_CLOSED", flush=True)
            return
        time.sleep(0.5)
    raise RuntimeError("Core did not fail closed")


def rehearsal(args, fixture):
    environment = os.environ | images(args.image, fixture)
    assets = Path(args.assets).resolve()
    owner_mode(assets, stat.S_ISDIR, 0o700)
    owner_mode(assets / "00-init.sh", stat.S_ISREG, 0o755)
    for filename in ("control.schema", "compose.yaml", "verify.mjs"):
        owner_mode(assets / filename, stat.S_ISREG, 0o644)
    print("OPERATIONAL_REHEARSAL_ASSET_MODES_PASS", flush=True)
    project = "syndes-credential-rehearsal-" + secrets.token_hex(6)
    command = ["docker", "compose", "--env-file", "/dev/null", "--project-name", project,
               "--file", str(assets / "compose.yaml")]
    environment["REHEARSAL_ASSETS"] = str(assets)
    with tempfile.TemporaryDirectory(prefix="syndes-credential-rehearsal-") as temporary:
        primary, replacement, invalid = (Path(temporary) / name for name in ("primary", "replacement", "invalid"))
        pilot_password = secrets.token_hex(24)
        files = fixture_files(pilot_password)
        render(primary, files)
        render(replacement, files)
        render(invalid, files | {"operational-core.json": '{"namespace":"multi-org-staging"}'})

        def compose(*options, **kwargs):
            try:
                return run([*command, *options], env=environment, **kwargs)
            except (RuntimeError, subprocess.TimeoutExpired):
                print("OPERATIONAL_REHEARSAL_COMPOSE_FAILED=" + options[0], file=sys.stderr)
                raise

        environment["REHEARSAL_FILES"] = str(primary)
        try:
            print("OPERATIONAL_REHEARSAL_FIRST_START", flush=True)
            serve(compose)
            require(run(["docker", "network", "inspect", "-f", "{{.Internal}}", project + "_private"]) == "true")
            bootstrap(compose, pilot_password)
            print("OPERATIONAL_REHEARSAL_DATABASE_FIXTURES_READY", flush=True)
            # Run the verifier under the Core image's normal UID and service mounts.
            store = compose("run", "--no-deps", "--rm", "-T", "core", "node",
                            "/opt/rehearsal/verify.mjs", "seed", timeout=125)
            require(re.fullmatch(r"[0-9A-HJKMNP-TV-Z]{26}", store))
            environment["REHEARSAL_FGA_STORE"] = store
            verify(compose)
            original = container_ids(compose)

            print("OPERATIONAL_REHEARSAL_RECREATE_WITH_SECOND_SOURCE", flush=True)
            environment["REHEARSAL_FILES"] = str(replacement)
            serve(compose)
            verify(compose)
            replaced = container_ids(compose)
            require(all(original[service] != replaced[service] for service in original))

            environment["REHEARSAL_FILES"] = str(invalid)
            reject_invalid_core_file(compose)
            print("OPERATIONAL_REHEARSAL_RESTORE_FIRST_CORE_MOUNT", flush=True)
            environment["REHEARSAL_FILES"] = str(primary)
            verify(compose)
            rolled_back = container_ids(compose)
            require(rolled_back["core"] != replaced["core"])
            require(all(rolled_back[service] == replaced[service] for service in ("postgres", "keycloak", "openfga")))
        finally:
            compose("down", "--volumes", "--remove-orphans", timeout=90)
    print("OPERATIONAL_REHEARSAL_RECREATE_AND_CORE_MOUNT_REVERSAL_PASS", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", action="store_true")
    parser.add_argument("assets")
    parser.add_argument("image")
    args = parser.parse_args()
    os.umask(0o077)
    if args.fixture:
        require(os.uname().nodename.split(".")[0] != "DevServer01")
    else:
        require(os.getenv("SYNDES_REHEARSE_OPERATIONAL_FILES") == "ACTIONS_APPROVED_OPERATIONAL_REHEARSAL")
        require(pwd.getpwuid(os.getuid()).pw_name == "delmacy" and os.uname().nodename.split(".")[0] == "DevServer01")
        sha = os.environ["SOURCE_SHA"]
        require(re.fullmatch(r"[a-f0-9]{40}", sha))
        require(args.image == "syndes/core-host:rehearsal-" + sha)
        require(run(["docker", "image", "inspect", "-f",
                     '{{index .Config.Labels "org.opencontainers.image.revision"}}', args.image]) == sha)
        verify_archive()
    rehearsal(args, args.fixture)


def interrupted(*_):
    raise InterruptedError


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, interrupted)
    try:
        main()
    except Exception as error:
        # Do not include subprocess stderr, SQL, credentials, or response bodies.
        print("OPERATIONAL_REHEARSAL_BLOCKED=" + type(error).__name__, file=sys.stderr)
        raise SystemExit(2) from None
