#!/usr/bin/env python3
"""Read-only DevServer01 teardown inventory. Never print environment values."""
import json
import os
import pwd
import re
import subprocess
import sys
from urllib.parse import urlsplit

GATEWAY = "syndes-whatsapp-whatsapp-gateway-1"
SAFE_NAME = re.compile(r"[a-zA-Z0-9_.-]+")


def docker(*args):
    result = subprocess.run(["docker", *args], text=True, capture_output=True, timeout=30)
    if result.returncode:
        raise RuntimeError("Docker read-only command failed")
    return result.stdout.strip()


def project(item):
    return (item["Config"].get("Labels") or {}).get("com.docker.compose.project", "")


def related(item):
    name = item["Name"].lstrip("/")
    group = project(item)
    image = item["Config"].get("Image", "")
    return (name.startswith(("syndes-", "core-host-")) or group.startswith("syndes-")
            or group == "core-host" or image.startswith(("syndes/", "syndes-core-host:")))


def gateway_postgres(gateway, containers):
    entries = [entry.split("=", 1)[1] for entry in gateway["Config"]["Env"]
               if entry.startswith("WHATSAPP_STORE_DSN=")]
    if len(entries) != 1:
        return None
    url = urlsplit(entries[0])
    if url.scheme not in ("postgres", "postgresql") or not url.hostname:
        return None
    host = url.hostname
    networks = gateway["NetworkSettings"]["Networks"]
    matches = set()
    for item in containers:
        for network, config in item["NetworkSettings"]["Networks"].items():
            if network not in networks:
                continue
            names = {item["Name"].lstrip("/"), config.get("IPAddress"), config.get("GlobalIPv6Address"),
                     *(config.get("Aliases") or []), *(config.get("DNSNames") or [])}
            if host in names:
                matches.add(item["Name"].lstrip("/"))
    return next(iter(matches)) if len(matches) == 1 else None


def snapshot():
    ids = docker("ps", "-aq", "--no-trunc").split()
    if not ids:
        raise RuntimeError("DevServer01 Docker inventory unavailable")
    containers = json.loads(docker("container", "inspect", *ids))
    names = docker("volume", "ls", "-q").split()
    return containers, json.loads(docker("volume", "inspect", *names)) if names else []


def inventory(containers, volumes):
    gateway = next((item for item in containers if item["Name"] == "/" + GATEWAY), None)
    if not gateway or not gateway["State"]["Running"]:
        raise RuntimeError("Expected the preserved gateway to be running")
    pg = gateway_postgres(gateway, containers)
    database_target = pg if pg and SAFE_NAME.fullmatch(pg) else "unresolved"
    print("SYNDES_CLEANUP_GATEWAY_DB_CONTAINER=" + database_target)
    refs = {}
    for item in containers:
        name = item["Name"].lstrip("/")
        for mount in item["Mounts"]:
            if mount["Type"] == "volume":
                refs.setdefault(mount["Name"], set()).add(name)
        if not related(item):
            continue
        group = project(item) or "none"
        if SAFE_NAME.fullmatch(name) and SAFE_NAME.fullmatch(group):
            bind_count = sum(m["Type"] == "bind" and m["RW"] for m in item["Mounts"])
            print(f"SYNDES_CLEANUP_CONTAINER={name} project={group} running={int(item['State']['Running'])} rw_binds={bind_count}")
    for volume in volumes:
        name = volume["Name"]
        group = (volume.get("Labels") or {}).get("com.docker.compose.project", "") or "none"
        owners = refs.get(name, set())
        if not (name.startswith(("syndes-", "syndes_")) or group.startswith("syndes-")
                or group == "core-host" or any(owner.startswith(("syndes-", "core-host-")) for owner in owners)):
            continue
        if SAFE_NAME.fullmatch(name) and SAFE_NAME.fullmatch(group) and all(SAFE_NAME.fullmatch(x) for x in owners):
            print(f"SYNDES_CLEANUP_VOLUME={name} project={group} containers={','.join(sorted(owners)) or 'none'}")
    print("SYNDES_CLEANUP_READONLY_INVENTORY_PASS")


if __name__ == "__main__":
    try:
        if os.uname().nodename.split(".")[0] != "DevServer01" or pwd.getpwuid(os.getuid()).pw_name != "delmacy":
            raise RuntimeError("Unexpected inventory host or account")
        inventory(*snapshot())
    except Exception as error:
        print("SYNDES_CLEANUP_INVENTORY_BLOCKED=" + type(error).__name__, file=sys.stderr)
        raise SystemExit(2) from None
