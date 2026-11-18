#!/usr/bin/env python3
"""One-shot Keycloak user for CRM/Inbox acceptance, without passwords or grants."""
import argparse
import json
import os
import pwd
from pathlib import Path
import re
import socket
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPErrorProcessor

USER = "syndes-homolog-crm-inbox"
REALM = "syndes"
PURPOSE = "crm-inbox-operational-acceptance"
RECORD_DIR = Path("/home/delmacy/syndes-releases/.homolog-identity")
RECORD_FILE = RECORD_DIR / "keycloak-crm-inbox.json"

class NoRedirect(HTTPErrorProcessor):
    def http_response(self, request, response):
        if 300 <= response.status < 400:
            raise RuntimeError("Unexpected redirect")
        return response
    https_response = http_response

opener = build_opener(NoRedirect())

def command(*argv):
    return subprocess.run(argv, check=True, capture_output=True, text=True, timeout=12).stdout

def require_server():
    if os.getuid() == 0 or pwd.getpwuid(os.getuid()).pw_name != "delmacy":
        raise RuntimeError("Unexpected deployment operator")
    if socket.gethostname().split(".")[0] != "DevServer01":
        raise RuntimeError("Unexpected host identity")
    ids = command("docker", "ps", "--filter",
                  "label=com.docker.compose.project=syndes-security-access",
                  "--filter", "label=com.docker.compose.service=keycloak",
                  "--format", "{{.ID}}").strip().splitlines()
    if len(ids) != 1 or not re.fullmatch(r"[0-9a-f]{12,64}", ids[0]):
        raise RuntimeError("Expected exactly one Keycloak container")
    cid = ids[0]
    state = json.loads(command("docker", "inspect", cid))[0]
    if state["Config"]["Image"] != "quay.io/keycloak/keycloak:26.8.1" or not state["State"]["Running"]:
        raise RuntimeError("Unexpected Keycloak image or state")
    network = state["NetworkSettings"]["Networks"].get("syndes-security-access")
    ip = (network or {}).get("IPAddress", "")
    if not re.fullmatch(r"(?:\d{1,3}\.){3}\d{1,3}", ip):
        raise RuntimeError("Private Keycloak IP missing")
    config = command("docker", "exec", cid, "cat", "/run/secrets/keycloak.conf")
    settings = {}
    for raw in config.splitlines():
        if raw.strip() and not raw.lstrip().startswith("#") and "=" in raw:
            key, value = raw.split("=", 1)
            settings[key.strip()] = value.strip().strip('"')
    username = settings.get("bootstrap-admin-username")
    password = settings.get("bootstrap-admin-password")
    if not username or not password:
        raise RuntimeError("Protected admin config unavailable")
    return "http://" + ip + ":8080", username, password

def request(base, path, token=None, payload=None, form=False, method="GET", allow_empty=False):
    if not path.startswith("/") or ".." in path:
        raise ValueError("Invalid path")
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = None
    if payload is not None:
        if form:
            data = urlencode(payload).encode("utf8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(payload).encode("utf8")
            headers["Content-Type"] = "application/json"
    try:
        with opener.open(Request(base + path, method=method, headers=headers, data=data), timeout=8) as resp:
            raw = resp.read(131072)
            if not raw:
                if allow_empty:
                    return None
                raise RuntimeError("Empty admin response")
            return json.loads(raw)
    except HTTPError as exc:
        raise RuntimeError("Keycloak HTTP %d" % exc.code) from None
    except URLError:
        raise RuntimeError("Private Keycloak unavailable") from None

def assert_identity(user, credentials):
    attrs = user.get("attributes") or {}
    checks = {
        "username": user.get("username") == USER,
        "enabled": user.get("enabled") is True,
        "purpose": attrs.get("syndes-homolog-purpose") == [PURPOSE],
        "required_action": "UPDATE_PASSWORD" in (user.get("requiredActions") or []),
        "expected_email": user.get("email") == "syndes-homolog-crm-inbox@example.invalid",
        "expected_display": user.get("firstName") == "Syndes" and user.get("lastName") == "Homologacao",
    }
    if not all(checks[k] for k in ("username", "enabled", "purpose", "required_action")):
        flags = ",".join(k + "=" + ("PASS" if v else "MISS") for k, v in checks.items())
        raise RuntimeError("Dedicated identity mismatch (sanitized flags: " + flags + ")")
    if credentials:
        raise RuntimeError("Credentials already present; operator review required")

def private_record(sub, mode):
    if mode == "apply":
        RECORD_DIR.mkdir(mode=0o700, parents=False, exist_ok=True)
    if not RECORD_DIR.is_dir():
        return
    if RECORD_DIR.is_symlink() or RECORD_DIR.stat().st_mode & 0o077:
        raise RuntimeError("Private record directory unsafe")
    if RECORD_FILE.exists():
        if RECORD_FILE.is_symlink() or RECORD_FILE.stat().st_mode & 0o077:
            raise RuntimeError("Private identity audit permissions unsafe")
        record = json.loads(RECORD_FILE.read_text())
        if record.get("sub") != sub or record.get("user") != USER:
            raise RuntimeError("Identity audit mismatch")
        return
    if mode != "apply":
        return
    fd = os.open(RECORD_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf8") as f:
        json.dump({"sub": sub, "user": USER, "purpose": PURPOSE,
                   "credential_state": "operator-action-required",
                   "grant_state": "none-by-this-script"}, f)
        f.write("\n")
        f.flush()
        os.fsync(f.fileno())

def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()
    base, username, password = require_server()
    token = request(base, "/realms/master/protocol/openid-connect/token",
                    form=True, method="POST",
                    payload={"client_id": "admin-cli", "grant_type": "password",
                             "username": username, "password": password})["access_token"]
    del username, password
    users_path = "/admin/realms/" + REALM + "/users"
    lookup = users_path + "?" + urlencode({"username": USER, "exact": "true"})
    found = request(base, lookup, token)
    exact = [u for u in found if u.get("username") == USER]
    if len(exact) > 1:
        raise RuntimeError("Duplicate homolog username")
    if not exact:
        if not args.apply:
            raise RuntimeError("Homolog user not found")
        request(base, users_path, token, method="POST", allow_empty=True,
                payload={"username": USER, "enabled": True,
                         "firstName": "Syndes", "lastName": "Homologacao",
                         "email": "syndes-homolog-crm-inbox@example.invalid",
                         "emailVerified": False,
                         "requiredActions": ["UPDATE_PASSWORD"],
                         "attributes": {"syndes-homolog-purpose": [PURPOSE]}})
        exact = [u for u in request(base, lookup, token) if u.get("username") == USER]
        if len(exact) != 1:
            raise RuntimeError("Created homolog user cannot be uniquely resolved")
    sub = exact[0].get("id", "")
    if not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", sub):
        raise RuntimeError("Noncanonical immutable Keycloak subject")
    user = request(base, users_path + "/" + sub, token)
    credentials = request(base, users_path + "/" + sub + "/credentials", token)
    assert_identity(user, credentials)
    private_record(sub, "apply" if args.apply else "check")
    print("HOMOLOG_KEYCLOAK_PRINCIPAL_PASS: active user; no credentials or grant changes")
    print("HOMOLOG_USER_OPERATOR_PASSWORD_SETUP_REQUIRED")
    print("HOMOLOG_TENANT_MEMBERSHIP_FGA_NOT_PROVISIONED")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("HOMOLOG_KEYCLOAK_PRINCIPAL_BLOCKED: " + str(exc), file=sys.stderr)
        sys.exit(1)
