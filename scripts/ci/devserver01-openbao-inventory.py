#!/usr/bin/env python3
"""Inventory credential delivery from Docker metadata and OpenBao seal status."""
import json
import os
import pwd
import re
import subprocess
import sys

VAULT = "syndes-security-access-openbao-1"
STAGING_VAULT = "syndes-multiorg-staging-openbao-stage-1"
SERVICES = {
    "CORE_ROUTED": "syndes-core-host-whatsapp-v2",
    "CORE_BASE": "core-host-core-host-1",
    "POSTGRES": "syndes-postgres-postgres-1",
    "KEYCLOAK": "syndes-security-access-keycloak-1",
    "OPENFGA": "syndes-security-access-openfga-1",
    "OPENFGA_MIGRATE": "syndes-security-access-openfga-migrate-1",
    "MANAGER": "syndes-master-admin-master-api-1",
    "STAGING_CORE": "syndes-multiorg-staging-core-host-1",
}
VAULT_MOUNTS = {
    "/run/secrets/core_host_role_id", "/run/secrets/core_host_secret_id",
    "/run/secrets/core_tenant_role_id", "/run/secrets/core_tenant_secret_id",
}
# The Go format emits only selected Docker metadata and never environment values.
INSPECT = (
    '{{json .Name}}\t{{json .State.Status}}\t{{json .Mounts}}\t'
    '{{json .HostConfig.VolumesFrom}}\t{{range $name, $endpoint := .NetworkSettings.Networks}}{{$name}} {{end}}\t'
    '{{range .Config.Env}}{{index (split . "=") 0}} {{end}}\t'
    '{{json (index .Config.Labels "com.docker.compose.project")}}\t'
    '{{json (index .Config.Labels "com.docker.compose.service")}}'
)


def docker(*args):
    return subprocess.run(["docker", *args], capture_output=True, text=True, timeout=25)


def inventory():
    ids = docker("ps", "-aq", "--no-trunc")
    if ids.returncode or not ids.stdout.split():
        raise RuntimeError("Docker inventory unavailable")
    result = docker("inspect", "--format", INSPECT, *ids.stdout.split())
    if result.returncode:
        raise RuntimeError("Docker inspect inventory unavailable")
    containers = {}
    for line in result.stdout.splitlines():
        name, status, mounts, inherited, networks, env_keys, project, service = line.split("\t")
        mounts = json.loads(mounts) or []
        containers[json.loads(name).lstrip("/")] = {
            "status": json.loads(status),
            "compose_service": "/".join(json.loads(x) for x in (project, service)),
            "volumes_from": bool(json.loads(inherited)),
            "vault_runtime": any(m.get("Destination") in VAULT_MOUNTS
                                 or m.get("Source", "").startswith("/run/syndes/approle/")
                                 for m in mounts),
            "vault_tls": any(m.get("Destination", "").startswith("/run/openbao-ca")
                             or "/openbao/tls/" in m.get("Source", "") for m in mounts),
            "volatile_files": sum(m.get("Source", "").startswith("/run/syndes/runtime/") for m in mounts),
            "manager_file": any(m.get("Destination") == "/run/secrets/master_db_url"
                                and not m.get("RW", True) for m in mounts),
            "staging_files": any(m.get("Destination") == "/run/secrets/stage-core.json"
                                 and not m.get("RW", True) for m in mounts),
            "vault_network": "syndes-secrets" in networks.split(),
            "vault_url_key": "CORE_OPENBAO_URL" in env_keys.split(),
        }
    return containers


def seal_status(containers, name):
    state = containers.get(name, {}).get("status", "absent")
    if state != "running":
        return state if state in ("absent", "created", "exited", "paused", "restarting", "dead") else "unknown"
    result = docker("exec", name, "bao", "status", "-format=json")
    if result.returncode not in (0, 2):
        return "unverified"
    response = json.loads(result.stdout)
    if response.get("initialized") is not True:
        return "uninitialized"
    return "sealed" if response.get("sealed") is True else "unsealed"


def main():
    if os.uname().nodename.split(".")[0] != "DevServer01" or pwd.getpwuid(os.getuid()).pw_name != "delmacy":
        raise RuntimeError("Unexpected DevServer01 inventory identity")
    containers = inventory()
    for label, name in SERVICES.items():
        if name not in containers:
            print(f"OPENBAO_INVENTORY_{label}=absent")
            continue
        details = containers[name]
        state = details["status"]
        if state not in ("created", "running", "paused", "restarting", "exited", "dead"):
            state = "unknown"
        flags = " ".join(f"{key}={int(value)}" for key, value in details.items() if key not in ("status", "compose_service"))
        print(f"OPENBAO_INVENTORY_{label}={state} {flags}")
    unknown = [data for name, data in containers.items()
               if name not in {*SERVICES.values(), VAULT, STAGING_VAULT}]
    print("OPENBAO_INVENTORY_OTHER_VAULT_NETWORK_PEERS=" + str(sum(x["vault_network"] for x in unknown)))
    print("OPENBAO_INVENTORY_OTHER_CREDENTIAL_CONSUMERS=" +
          str(sum(bool(x["vault_runtime"] or x["vault_url_key"] or x["volatile_files"]) for x in unknown)))
    for entry in unknown:
        if entry["vault_runtime"] or entry["vault_url_key"] or entry["volatile_files"] or entry["vault_network"]:
            identity = entry["compose_service"]
            if not re.fullmatch(r"[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+", identity):
                identity = "unlabeled"
            print(f"OPENBAO_INVENTORY_OTHER={identity} status={entry['status']}")
    print("OPENBAO_INVENTORY_OPERATIONAL_SEAL=" + seal_status(containers, VAULT))
    print("OPENBAO_INVENTORY_STAGING_SEAL=" + seal_status(containers, STAGING_VAULT))
    print("DEVSERVER01_OPENBAO_METADATA_INVENTORY_PASS")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("DEVSERVER01_OPENBAO_INVENTORY_BLOCKED=" +
              (str(error) if type(error) is RuntimeError else type(error).__name__), file=sys.stderr)
        raise SystemExit(2) from None
