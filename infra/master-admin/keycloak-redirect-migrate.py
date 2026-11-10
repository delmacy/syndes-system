#!/usr/bin/env python3
"""Audited 9446 visual-preview -> 9447 real-manager OIDC redirect migration.

Does not grant authorization or access to secrets outside the dedicated
Keycloak bootstrap admin mount supplied by an authorized host operator.
The old visual preview remains available on its existing Tailscale route.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

REALM = "syndes"
CLIENT = "syndes-master-admin"


def origins(dns):
    dns = dns.rstrip(".")
    if not dns.endswith(".ts.net") or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-." for c in dns):
        raise ValueError("A valid private Tailnet DNS name is required")
    return ("https://" + dns + ":9446", "https://" + dns + ":9447")


def destination_unallocated(serve):
    tcp, web = serve.get("TCP", {}), serve.get("Web", {})
    return (isinstance(tcp, dict) and isinstance(web, dict)
            and "9447" not in tcp
            and not any(isinstance(k, str) and k.endswith(":9447") for k in web))


def verify_client(client, origin):
    attrs = client.get("attributes") or {}
    return (client.get("clientId") == CLIENT and client.get("enabled") is True
            and client.get("publicClient") is True
            and client.get("standardFlowEnabled") is True
            and client.get("implicitFlowEnabled") is False
            and client.get("directAccessGrantsEnabled") is False
            and client.get("serviceAccountsEnabled") is False
            and attrs.get("pkce.code.challenge.method") == "S256"
            and client.get("redirectUris") == [origin + "/"]
            and client.get("webOrigins") == [origin])


def audit_write(path, record, *, create=False):
    if create:
        with path.open("x", encoding="utf-8") as file:
            os.fchmod(file.fileno(), 0o600)
            json.dump(record, file)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
    else:
        temporary = path.with_name("." + path.name + ".tmp")
        with temporary.open("x", encoding="utf-8") as file:
            os.fchmod(file.fileno(), 0o600)
            json.dump(record, file)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)


def main():
    parser = argparse.ArgumentParser()
    options = parser.add_mutually_exclusive_group(required=True)
    options.add_argument("--check", action="store_true")
    options.add_argument("--apply", action="store_true")
    options.add_argument("--rollback", action="store_true")
    parser.add_argument("--record", required=True)
    args = parser.parse_args()
    record_path = Path(args.record)
    if not record_path.parent.is_dir() or record_path.parent.is_symlink() or record_path.parent.stat().st_mode & 0o077:
        raise RuntimeError("A pre-existing private audit directory is required")
    if args.apply and record_path.exists():
        raise RuntimeError("Existing migration record; inspect rather than reapply")
    tail = subprocess.run(["tailscale", "status", "--json"], capture_output=True,
                          text=True, check=True, timeout=10)
    dns = json.loads(tail.stdout)["Self"]["DNSName"]
    old, new = origins(dns)
    serve = subprocess.run(["tailscale", "serve", "status", "--json"],
                           capture_output=True, text=True, check=True, timeout=10)
    serve_status = json.loads(serve.stdout)
    if not isinstance(serve_status, dict):
        raise RuntimeError("Tailnet Serve configuration is unreadable")
    if args.apply and not destination_unallocated(serve_status):
        raise RuntimeError("Manager port 9447 is already owned by another route")
    if args.rollback and not destination_unallocated(serve_status):
        raise RuntimeError("Stop Manager HTTPS 9447 before reverting its OIDC redirect")

    cfg = {}
    for line in sys.stdin:
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.strip().split("=", 1)
            cfg[key.strip()] = value.strip().strip('"')
    username, password = cfg.get("bootstrap-admin-username"), cfg.get("bootstrap-admin-password")
    if not username or not password:
        raise RuntimeError("Keycloak bootstrap admin mount unavailable")
    base = "http://127.0.0.1:18080"

    def call(path, *, method="GET", payload=None, token=None, form=False):
        headers = {"Accept": "application/json"}
        data = None
        if payload is not None:
            if form:
                headers["Content-Type"] = "application/x-www-form-urlencoded"
                data = urlencode(payload).encode()
            else:
                headers["Content-Type"] = "application/json"
                data = json.dumps(payload).encode()
        if token:
            headers["Authorization"] = "Bearer " + token
        with urlopen(Request(base + path, method=method, data=data, headers=headers), timeout=10) as res:
            raw = res.read()
            return json.loads(raw) if raw else None

    token = call("/realms/master/protocol/openid-connect/token", method="POST", form=True,
                 payload={"grant_type": "password", "client_id": "admin-cli",
                          "username": username, "password": password})["access_token"]
    del cfg, username, password
    client_path = "/admin/realms/" + REALM + "/clients"
    matches = call(client_path + "?" + urlencode({"clientId": CLIENT}), token=token)
    if len(matches) != 1 or matches[0].get("clientId") != CLIENT:
        raise RuntimeError("Dedicated OIDC client missing or ambiguous")
    client_id = matches[0]["id"]
    client = call(client_path + "/" + client_id, token=token)

    if args.check:
        if not verify_client(client, new):
            raise RuntimeError("Manager OIDC redirect not yet configured for the new private port")
        print("PASS: dedicated Manager OIDC redirect is 9447 with PKCE S256")
        return

    if args.rollback:
        if not record_path.is_file():
            raise RuntimeError("No approved migration record for rollback")
        record = json.loads(record_path.read_text(encoding="utf-8"))
        if (record.get("state") != "committed" or record.get("client_uuid") != client_id
                or record.get("old_origin") != old or record.get("new_origin") != new):
            raise RuntimeError("Invalid migration record; manual reconciliation required")
        before, after = new, old
    else:
        before, after = old, new

    if not verify_client(client, before):
        raise RuntimeError("Unexpected OIDC client state; refusing to change unrelated settings")
    if args.apply:
        record = {"operation": "manager-redirect-9447", "state": "pending",
                  "client_uuid": client_id, "old_origin": old, "new_origin": new,
                  "started_at": datetime.now(timezone.utc).isoformat()}
        audit_write(record_path, record, create=True)

    updated = dict(client, redirectUris=[after + "/"], webOrigins=[after])
    call(client_path + "/" + client_id, method="PUT", payload=updated, token=token)
    refreshed = call(client_path + "/" + client_id, token=token)
    if not verify_client(refreshed, after):
        raise RuntimeError("OIDC redirect changed but failed verification; inspect private audit")
    record["state"] = "rolled_back" if args.rollback else "committed"
    record["finished_at"] = datetime.now(timezone.utc).isoformat()
    audit_write(record_path, record)
    print("PASS: Manager OIDC redirect migration audited and verified; preview route preserved")


if __name__ == "__main__":
    try:
        main()
    except (HTTPError, URLError) as exc:
        print("BLOCKED: Keycloak administrator operation unavailable", file=sys.stderr)
        raise SystemExit(2) from None
    except Exception as exc:
        print("BLOCKED: " + str(exc), file=sys.stderr)
        raise SystemExit(2) from None
