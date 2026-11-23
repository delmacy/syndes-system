#!/usr/bin/env python3
"""Remove only the reviewed Syndes containers and data on DevServer01."""
import json
import os
from pathlib import Path
import pwd
import re
import runpy
import subprocess
import sys
from urllib.parse import parse_qs, unquote, urlsplit

GATEWAY = "syndes-whatsapp-whatsapp-gateway-1"
SYSTEM_DATABASES = {"syndes_control", "syndes_keycloak", "syndes_openfga"}
TENANT_DATABASE = re.compile(r"syndes_tenant_[a-f0-9]{32}")
RESOURCE_NAME = re.compile(r"[a-zA-Z0-9_.-]+")


def require(condition, label):
    if not condition:
        raise RuntimeError(label)


def docker(*args, timeout=50):
    result = subprocess.run(["docker", *args], text=True, capture_output=True, timeout=timeout)
    require(result.returncode == 0, "docker_" + args[0])
    return result.stdout.strip()


def key(item):
    return item["Name"].lstrip("/")


def db_name(gateway):
    entries = [line.split("=", 1)[1] for line in gateway["Config"]["Env"]
               if line.startswith("WHATSAPP_STORE_DSN=")]
    require(len(entries) == 1, "gateway_store_configuration")
    url = urlsplit(entries[0])
    require(set(parse_qs(url.query, keep_blank_values=True)).issubset({
        "sslmode", "application_name", "connect_timeout", "pool_max_conns",
    }), "gateway_connection_overrides")
    value = unquote(url.path.lstrip("/"))
    require(re.fullmatch(r"[a-zA-Z0-9_-]+", value), "gateway_database_name")
    return value


def data_volumes(containers):
    return {mount["Name"] for item in containers for mount in item["Mounts"] if mount["Type"] == "volume"}


def match_plan(plan, containers, volumes, inventory):
    by_name = {key(item): item for item in containers}
    gateway = by_name[GATEWAY]
    require(gateway["State"]["Running"], "gateway_not_running")
    store = inventory["gateway_postgres"](gateway, containers)
    require(store and store == plan["gateway_store_container"], "gateway_store_identity_changed")
    pg = by_name[store]
    require(pg["State"]["Running"], "gateway_store_not_running")
    protected = {GATEWAY, store}
    wanted = plan["containers"]
    remove = []
    for name, label in wanted.items():
        require(RESOURCE_NAME.fullmatch(name) and name not in protected, "protected_container")
        if name not in by_name:
            continue  # Allows retry after a partial or already completed cleanup.
        item = by_name[name]
        require(inventory["project"](item) == label and inventory["related"](item), "container_label_changed")
        require(re.fullmatch(r"[a-f0-9]{64}", item["Id"]), "invalid_container_identity")
        remove.append(item)
    retained = [item for item in containers if key(item) not in wanted]
    used_by_retained = data_volumes(retained)
    available = {item["Name"]: item for item in volumes}
    delete_volumes = []
    for name, label in plan["volumes"].items():
        require(RESOURCE_NAME.fullmatch(name) and name not in used_by_retained, "retained_volume_reference")
        if name not in available:
            continue
        item = available[name]
        require((item.get("Labels") or {}).get("com.docker.compose.project", "") == label,
                "volume_label_changed")
        require(item["Driver"] == "local", "nonlocal_volume")
        delete_volumes.append(name)
    return gateway, pg, remove, delete_volumes


def sql(pg, database, command):
    return docker("exec", pg["Id"], "psql", "-XAtq", "-w", "-v", "ON_ERROR_STOP=1",
                  "-U", "postgres", "-d", database, "-c", command, timeout=40)


def database_plan(pg, gateway, plan):
    # Only the confirmed shared cluster is eligible for database-level cleanup.
    if not plan["clean_shared_cluster_databases"]:
        return None, []
    require(key(pg) == "syndes-postgres-postgres-1", "unexpected_shared_cluster")
    keep = db_name(gateway)
    all_databases = set(sql(pg, "postgres", "SELECT datname FROM pg_database WHERE datallowconn").splitlines())
    require(keep in all_databases, "gateway_database_missing")
    eligible = {name for name in all_databases if name in SYSTEM_DATABASES or TENANT_DATABASE.fullmatch(name)}
    require(keep not in eligible, "gateway_database_name_conflict")
    return keep, sorted(eligible)


def saved_devices(pg, database):
    exists = sql(pg, database, "SELECT to_regclass('public.whatsmeow_device') IS NOT NULL")
    if exists == "t":
        count = sql(pg, database, "SELECT count(*) FROM public.whatsmeow_device")
        require(count.isdecimal(), "gateway_device_count_invalid")
        return int(count)
    require(exists == "f", "gateway_device_table_unverified")
    return None


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in ("--plan", "--apply"), "invalid_mode")
    require(os.uname().nodename.split(".")[0] == "DevServer01"
            and pwd.getpwuid(os.getuid()).pw_name == "delmacy", "unexpected_host")
    require(os.getenv("SYNDES_CLEANUP_APPROVAL") == "ACTIONS_APPROVED_SYNDES_CLEANUP",
            "actions_approval_missing")
    os.umask(0o077)
    root = Path(__file__).resolve().parent
    plan = json.loads((root / "approved.json").read_text())
    inventory = runpy.run_path(str(root / "inventory.py"))
    gateway, pg, targets, volumes = match_plan(plan, *inventory["snapshot"](), inventory)
    keep_db, databases = database_plan(pg, gateway, plan)
    print("SYNDES_CLEANUP_GATEWAY_DATABASE=" + db_name(gateway), flush=True)
    print(f"SYNDES_CLEANUP_MATCHED containers={len(targets)} volumes={len(volumes)} databases={len(databases)}",
          flush=True)
    if sys.argv[1] == "--plan":
        return
    device_count = saved_devices(pg, keep_db) if keep_db else None
    if keep_db:
        def verify_gateway_datastore(candidate):
            require(sql(candidate, keep_db, "SELECT 1") == "1", "retained_gateway_database_unavailable")
            require(saved_devices(candidate, keep_db) == device_count, "gateway_device_count_changed")

        retention = runpy.run_path(str(root / "postgres-files.py"))
        pg = retention["ensure_persistent"](pg, docker, verify_gateway_datastore)
        keep_db, databases = database_plan(pg, gateway, plan)

    # Removing only captured IDs preserves unrelated running services. No prune.
    running = [item["Id"] for item in targets if item["State"]["Running"]]
    if running:
        docker("stop", "--time", "20", *running, timeout=120)
    if targets:
        docker("rm", *(item["Id"] for item in targets), timeout=90)
    for name in databases:
        # No FORCE. An unexpected live client leaves this database intact.
        sql(pg, "postgres", 'DROP DATABASE IF EXISTS "' + name + '"')
    if volumes:
        docker("volume", "rm", *volumes, timeout=90)

    after, available = inventory["snapshot"]()
    surviving = {key(item): item for item in after}
    require(all(name not in surviving for name in plan["containers"]), "target_container_still_present")
    require(not set(plan["volumes"]).intersection(item["Name"] for item in available), "target_volume_still_present")
    for original in (gateway, pg):
        current = surviving[key(original)]
        require(current["State"]["Running"] and current["Id"] == original["Id"]
                and current["State"]["StartedAt"] == original["State"]["StartedAt"],
                "retained_runtime_changed")
    require(inventory["gateway_postgres"](surviving[GATEWAY], after) == key(pg), "gateway_store_changed")
    if keep_db is not None:
        require(sql(pg, keep_db, "SELECT 1") == "1", "retained_gateway_database_unavailable")
        require(not database_plan(pg, gateway, plan)[1], "target_database_still_present")
        require(saved_devices(pg, keep_db) == device_count, "gateway_device_count_changed")
        if device_count is not None:
            print("SYNDES_CLEANUP_GATEWAY_STORED_DEVICES=" + str(device_count), flush=True)
    print("SYNDES_CLEANUP_COMPLETE_GATEWAY_AND_STORE_PRESERVED", flush=True)


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print("SYNDES_CLEANUP_BLOCKED=" + str(error), file=sys.stderr)
        raise SystemExit(2) from None
    except Exception as error:
        print("SYNDES_CLEANUP_BLOCKED=" + type(error).__name__, file=sys.stderr)
        raise SystemExit(2) from None
