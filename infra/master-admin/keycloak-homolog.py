#!/usr/bin/env python3
"""Provision only the dedicated OIDC public client in a controlled homologation.

Pass the already-mounted Keycloak bootstrap configuration on STDIN. The script
never prints credentials, tokens, user records or full API responses.
Use --check for read-only validation; --apply makes one additive client;
--rollback removes only the UUID recorded by this script.
"""
import argparse
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

CLIENT = "syndes-master-admin"
AUDIENCE = "syndes-master-api"
REALM = "syndes"

parser = argparse.ArgumentParser()
mode = parser.add_mutually_exclusive_group(required=True)
mode.add_argument("--apply", action="store_true")
mode.add_argument("--check", action="store_true")
mode.add_argument("--rollback", action="store_true")
parser.add_argument("--origin", required=True, help="Exact Tailnet HTTPS origin, no path")
parser.add_argument("--port", type=int, default=18080, help="Loopback-bound Keycloak port")
parser.add_argument("--record", required=True, help="Private operator record path outside Git")
args = parser.parse_args()

origin = urlsplit(args.origin)
if origin.scheme != "https" or not origin.hostname or origin.path not in ("", "/") or origin.query or origin.fragment:
    raise SystemExit("Refusing non-HTTPS or non-origin redirect")
if not 1 <= args.port <= 65535:
    raise SystemExit("Invalid Keycloak loopback port")
if args.apply and Path(args.record).exists():
    raise SystemExit("Provision record exists: inspect before any new change")
record = Path(args.record)
if not record.parent.is_dir() or record.parent.stat().st_mode & 0o077:
    raise SystemExit("Provision record parent must be private")
expected_origin = args.origin.rstrip("/")
cfg = {}
for raw in sys.stdin:
    line = raw.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        cfg[k.strip()] = v.strip().strip('"')
user = cfg.get("bootstrap-admin-username")
password = cfg.get("bootstrap-admin-password")
if not user or not password:
    raise SystemExit("Missing mounted Keycloak bootstrap admin config")

root = f"http://127.0.0.1:{args.port}"
def req(path, *, method="GET", payload=None, token=None, form=False):
    headers = {"Accept": "application/json"}
    body = None
    if payload is not None:
        if form:
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            body = urlencode(payload).encode()
        else:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload).encode()
    if token:
        headers["Authorization"] = "Bearer " + token
    try:
        with urlopen(Request(root + path, data=body, headers=headers, method=method), timeout=10) as res:
            data = res.read()
            return json.loads(data) if data else None
    except HTTPError as exc:
        raise SystemExit(f"Keycloak admin request refused: HTTP {exc.code}") from None
    except URLError:
        raise SystemExit("Keycloak loopback unavailable") from None

admin = req("/realms/master/protocol/openid-connect/token", method="POST", form=True,
            payload={"client_id": "admin-cli", "grant_type": "password",
                     "username": user, "password": password})["access_token"]
del cfg, user, password
path = f"/admin/realms/{REALM}/clients"
matches = req(path + "?" + urlencode({"clientId": CLIENT}), token=admin)
if not isinstance(matches, list) or len(matches) > 1:
    raise SystemExit("Unexpected client lookup result")

def assert_configuration(client):
    attrs = client.get("attributes") or {}
    mappers = client.get("protocolMappers") or []
    required_mapper = any(
        m.get("protocolMapper") == "oidc-audience-mapper"
        and (m.get("config") or {}).get("included.custom.audience") == AUDIENCE
        and (m.get("config") or {}).get("access.token.claim") == "true"
        for m in mappers
    )
    assert client.get("clientId") == CLIENT
    assert client.get("enabled") is True
    assert client.get("publicClient") is True
    assert client.get("standardFlowEnabled") is True
    assert client.get("implicitFlowEnabled") is False
    assert client.get("directAccessGrantsEnabled") is False
    assert client.get("serviceAccountsEnabled") is False
    assert client.get("redirectUris") == [expected_origin + "/"]
    assert client.get("webOrigins") == [expected_origin]
    assert attrs.get("pkce.code.challenge.method") == "S256"
    assert required_mapper

def load_client(uuid):
    return req(path + "/" + uuid, token=admin)

if args.rollback:
    if not record.is_file():
        raise SystemExit("No operator-recorded client; refusing rollback")
    uuid = json.loads(record.read_text())["keycloak_client_uuid"]
    if not matches or matches[0].get("id") != uuid:
        raise SystemExit("Recorded client UUID mismatch; refusing rollback")
    assert_configuration(load_client(uuid))
    req(path + "/" + uuid, method="DELETE", token=admin)
    record.unlink()
    print("Keycloak dedicated homolog client rolled back")
elif matches:
    assert_configuration(load_client(matches[0]["id"]))
    print("Keycloak dedicated public OIDC client configuration: PASS")
else:
    if not args.apply:
        raise SystemExit("Keycloak dedicated OIDC client does not exist")
    new = {
        "clientId": CLIENT, "name": "Syndes Platform Manager", "enabled": True,
        "protocol": "openid-connect", "publicClient": True, "standardFlowEnabled": True,
        "implicitFlowEnabled": False, "directAccessGrantsEnabled": False,
        "serviceAccountsEnabled": False, "redirectUris": [expected_origin + "/"],
        "webOrigins": [expected_origin],
        "attributes": {"pkce.code.challenge.method": "S256"},
        "protocolMappers": [{
            "name": "syndes-master-api-audience", "protocol": "openid-connect",
            "protocolMapper": "oidc-audience-mapper",
            "config": {"included.custom.audience": AUDIENCE,
                       "access.token.claim": "true", "id.token.claim": "false"}
        }]
    }
    req(path, method="POST", payload=new, token=admin)
    results = req(path + "?" + urlencode({"clientId": CLIENT}), token=admin)
    if len(results) != 1:
        raise SystemExit("Client created but cannot be resolved: inspect manually")
    uuid = results[0]["id"]
    assert_configuration(load_client(uuid))
    with record.open("x") as f:
        os.fchmod(f.fileno(), 0o600)
        json.dump({"keycloak_client_uuid": uuid, "origin": expected_origin}, f)
    print("Dedicated public OIDC client created and verified (PKCE S256; no password grant)")
