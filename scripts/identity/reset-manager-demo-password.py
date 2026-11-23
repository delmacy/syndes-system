#!/usr/bin/env python3
"""Reset only the existing authorized DevServer01 demo account."""
import os
from pathlib import Path
import re
import runpy
import secrets
import stat
import sys
from urllib.parse import urlencode

REALM = "syndes"
USERNAME = "syndes-manager"
RUNTIME = Path("/home/delmacy/.local/share/syndes-platform-manager/runtime")
DELIVERY = "syndes-manager-password-once"


def find_owner(identity, base, token):
    users = identity["request"](
        base, "/admin/realms/" + REALM + "/users?" + urlencode({
            "username": USERNAME, "exact": "true",
        }), token,
    )
    if len(users) != 1:
        raise RuntimeError("Expected exactly one demo account")
    [user] = users
    subject = user.get("id", "")
    if (
        user.get("username") != USERNAME or user.get("enabled") is not True
        or user.get("federationLink")
        or not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", subject)
    ):
        raise RuntimeError("Demo account identity or ownership cannot be established")
    sql = (
        "SELECT count(*) FROM public.platform_operator_access "
        "WHERE principal_id='" + subject + "' AND role='owner' AND state='active'"
    )
    result = identity["command"](
        "docker", "exec", "-u", "postgres", "syndes-postgres-postgres-1",
        "psql", "-w", "-XAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres",
        "-d", "syndes_control", "-c", sql,
    )
    if result.strip() != "1":
        raise RuntimeError("Demo account must hold its existing active owner grant")
    return subject


def reset_password(identity, base, token, runtime):
    if runtime.resolve() != runtime:
        raise RuntimeError("Unexpected Manager runtime path")
    info = runtime.lstat()
    if (not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid()
            or stat.S_IMODE(info.st_mode) != 0o700):
        raise RuntimeError("Expected a private Manager runtime directory")
    path = runtime / DELIVERY
    if os.path.lexists(path):
        raise RuntimeError("A temporary password file already exists")

    subject = find_owner(identity, base, token)
    password = secrets.token_urlsafe(32) + "-Aa9!"
    # Retain the delivery file if the remote result is uncertain so that an
    # interrupted attempt cannot silently rotate the account a second time.
    with path.open("x", encoding="ascii") as out:
        os.fchmod(out.fileno(), 0o600)
        out.write(password + "\n")
        out.flush()
        os.fsync(out.fileno())

    resource = "/admin/realms/" + REALM + "/users/" + subject
    identity["request"](
        base, resource + "/reset-password", token,
        payload={"type": "password", "value": password, "temporary": True},
        method="PUT", allow_empty=True,
    )
    result = identity["request"](base, resource, token)
    if result.get("id") != subject or "UPDATE_PASSWORD" not in result.get("requiredActions", []):
        raise RuntimeError("Temporary password state could not be verified")
    print("MANAGER_DEMO_PASSWORD_RESET=PASS")


def main():
    if os.environ.get("SYNDES_MANAGER_DEMO_RESET") != "ACTIONS_APPROVED_DEMO_PASSWORD_RESET":
        raise RuntimeError("Explicit Actions approval required")
    os.umask(0o077)
    identity = runpy.run_path(str(Path(__file__).with_name("provision-homolog-keycloak.py")))
    base, username, password = identity["require_server"]()
    token = identity["request"](
        base, "/realms/master/protocol/openid-connect/token", method="POST", form=True,
        payload={"grant_type": "password", "client_id": "admin-cli",
                 "username": username, "password": password},
    )["access_token"]
    reset_password(identity, base, token, RUNTIME)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("MANAGER_DEMO_PASSWORD_RESET_BLOCKED=" +
              (str(error) if type(error) is RuntimeError else type(error).__name__),
              file=sys.stderr)
        raise SystemExit(2) from None
