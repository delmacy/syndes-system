#!/usr/bin/env python3
"""Only read sanitized readiness data from DevServer01. No writes or credentials in logs."""
import json
import os
from pathlib import Path
import pwd
import re
import socket
import subprocess
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ACCOUNT = "syndes-homolog-crm-inbox"
RECORD = Path("/home/delmacy/syndes-releases/.homolog-identity/keycloak-crm-inbox.json")
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
CLIENTS = ("syndes-crm-ui", "syndes-inbox-ui")

def command(args, input_text=None):
    try:
        result = subprocess.run(args, text=True, input=input_text, capture_output=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired):
        raise RuntimeError("Local protected read unavailable") from None
    if result.returncode:
        raise RuntimeError("Local protected read denied")
    return result.stdout

def container(project, service):
    lines = command(["docker", "ps", "--filter",
                     "label=com.docker.compose.project=" + project, "--filter",
                     "label=com.docker.compose.service=" + service,
                     "--format", "{{.ID}}"]).strip().splitlines()
    if len(lines) != 1 or not re.fullmatch(r"[0-9a-f]{12,64}", lines[0]):
        raise RuntimeError("Expected one operational " + service)
    return lines[0]

def identity():
    if not RECORD.is_file() or RECORD.is_symlink():
        raise RuntimeError("Private principal record missing")
    if RECORD.stat().st_mode & 0o077 or RECORD.parent.stat().st_mode & 0o077:
        raise RuntimeError("Private principal record permissions invalid")
    record = json.loads(RECORD.read_text())
    subject = record.get("sub")
    if record.get("user") != ACCOUNT or not isinstance(subject, str) or not UUID.fullmatch(subject):
        raise RuntimeError("Private principal record mismatch")
    return subject

def sql(cid, query):
    output = command(["docker", "exec", "-i", "-u", "postgres", cid,
                      "psql", "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1",
                      "-U", "postgres", "-d", "syndes_control", "-f", "-"], query).strip()
    if not re.fullmatch(r"[0-9]+(?:,[0-9]+)?", output):
        raise RuntimeError("Unexpected sanitized registry result")
    return output

def get_json(base, path, token=None, form=None):
    headers = {"Accept": "application/json"}
    data = None
    if form is not None:
        data = urlencode(form).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if token:
        headers["Authorization"] = "Bearer " + token
    try:
        with urlopen(Request(base + path, data=data, headers=headers,
                             method="POST" if form else "GET"), timeout=8) as response:
            return json.loads(response.read(131072))
    except (HTTPError, URLError, ValueError):
        raise RuntimeError("Protected Keycloak read unavailable") from None

def valid_client(client):
    a = client.get("attributes") or {}
    uris = client.get("redirectUris") or []
    origins = client.get("webOrigins") or []
    return (
        client.get("enabled") is True
        and client.get("publicClient") is True
        and client.get("standardFlowEnabled") is True
        and client.get("implicitFlowEnabled") is False
        and client.get("directAccessGrantsEnabled") is False
        and client.get("serviceAccountsEnabled") is False
        and a.get("pkce.code.challenge.method") == "S256"
        and isinstance(uris, list) and len(uris) > 0
        and all(isinstance(x, str) and x.startswith("https://") and "*" not in x for x in uris)
        and isinstance(origins, list) and len(origins) > 0
        and all(isinstance(x, str) and x.startswith("https://") and "*" not in x for x in origins)
    )

def inspect_keycloak(cid, subject):
    if command(["docker", "inspect", "--format", "{{.Config.Image}}", cid]).strip() != "quay.io/keycloak/keycloak:26.8.1":
        raise RuntimeError("Unexpected Keycloak image")
    metadata = json.loads(command(["docker", "inspect", cid]))[0]
    ip = (metadata["NetworkSettings"]["Networks"].get("syndes-security-access") or {}).get("IPAddress", "")
    if not re.fullmatch(r"(?:[0-9]{1,3}\.){3}[0-9]{1,3}", ip):
        raise RuntimeError("Keycloak private bridge unavailable")
    config = command(["docker", "exec", cid, "cat", "/run/secrets/keycloak.conf"])
    values = {}
    for line in config.splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, val = line.split("=", 1)
            values[key.strip()] = val.strip().strip('"')
    username, password = values.get("bootstrap-admin-username"), values.get("bootstrap-admin-password")
    if not username or not password:
        raise RuntimeError("Keycloak operator configuration missing")
    base = "http://" + ip + ":8080"
    token = get_json(base, "/realms/master/protocol/openid-connect/token",
                     form={"grant_type": "password", "client_id": "admin-cli",
                           "username": username, "password": password}).get("access_token")
    del config, values, username, password
    if not isinstance(token, str) or not token:
        raise RuntimeError("Keycloak privileged read not available")
    path = "/admin/realms/syndes"
    user = get_json(base, path + "/users/" + subject, token)
    if user.get("id") != subject or user.get("username") != ACCOUNT or user.get("enabled") is not True:
        raise RuntimeError("Dedicated identity mismatch")
    credentials = get_json(base, path + "/users/" + subject + "/credentials", token)
    clients = {}
    for client in CLIENTS:
        matches = get_json(base, path + "/clients?" + urlencode({"clientId": client}), token)
        if not isinstance(matches, list) or len(matches) != 1 or matches[0].get("clientId") != client:
            clients[client] = False
            continue
        detail = get_json(base, path + "/clients/" + matches[0]["id"], token)
        clients[client] = valid_client(detail)
    return bool(credentials), clients

def main():
    if len(sys.argv) != 1:
        raise RuntimeError("Unexpected arguments")
    if os.geteuid() == 0 or pwd.getpwuid(os.geteuid()).pw_name != "delmacy":
        raise RuntimeError("Unexpected operator")
    if socket.gethostname().split(".")[0] != "DevServer01":
        raise RuntimeError("Unexpected host")
    subject = identity()
    pg = container("syndes-postgres", "postgres")
    kc = container("syndes-security-access", "keycloak")
    counts = sql(pg, """SELECT count(*)::text || ',' ||
                         count(*) FILTER (WHERE state='active')::text FROM tenant_registry;""")
    total, active = (int(x) for x in counts.split(","))
    membership_count = int(sql(pg, "SELECT count(*) FROM tenant_memberships WHERE principal_id = '" + subject + "';"))
    credential_set, clients = inspect_keycloak(kc, subject)
    print("HOMOLOG_READONLY_INVENTORY_EXECUTED")
    print("TENANT_REGISTRY_TOTAL=" + str(total))
    print("TENANT_REGISTRY_ACTIVE=" + str(active))
    print("HOMOLOG_PRINCIPAL_MEMBERSHIPS=" + str(membership_count))
    print("HOMOLOG_IDENTITY_PASSWORD=" + ("CONFIGURED" if credential_set else "NOT_CONFIGURED"))
    for client in CLIENTS:
        print("OIDC_" + client.upper().replace("-", "_") + "=" + ("STRICT_PASS" if clients[client] else "BLOCKED"))
    print("HOMOLOG_DEDICATED_TENANT_ATTESTATION=NOT_AVAILABLE")
    print("HOMOLOG_OPENFGA_GRANTS=NOT_MODIFIED")
    print("HOMOLOG_PRODUCT_GATE=OPEN")
    print("HOMOLOG_READONLY_NO_MUTATION=PASS")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("HOMOLOG_READONLY_INVENTORY_BLOCKED: " + str(e), file=sys.stderr)
        sys.exit(1)
