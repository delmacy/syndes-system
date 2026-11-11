#!/usr/bin/env python3
"""Read-only Syndes UI + event rollout inventory. Never applies migrations.

Local, operator-run tool. It only reads the trusted Control registry and
PostgreSQL catalogs using the pre-existing local Docker superuser socket.
It cannot authorize deployment or prove backup/restore, FGA or module ENABLED.
"""
import argparse
import json
import re
import subprocess
import sys
from urllib.request import urlopen
from urllib.error import URLError

CONTAINER = "syndes-postgres-postgres-1"
CONTROL_DB = "syndes_control"
MAX_TENANTS = 50
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
DB = re.compile(r"^syndes_tenant_[0-9a-f]{32}$")
MIGRATIONS = (
    "001_catalog", "002_lifecycle", "003_attestation",
    "004_activation", "005_manager_readonly", "006_control_events",
)
FRONTENDS = (
    ("workspace", "http://127.0.0.1:18084/"),
    ("workspace_runtime", "http://127.0.0.1:18084/workspace-runtime.json"),
    ("manager_visual_only", "http://127.0.0.1:18086/"),
    ("core_host_health", "http://127.0.0.1:18083/readyz"),
)

CONTROL_SQL = """
SELECT json_build_object(
 'database',current_database(),
 'version',current_setting('server_version_num')::int,
 'migration_ledger',to_regclass('public.control_module_schema_migrations') IS NOT NULL,
 'module_catalog',to_regclass('public.module_catalog') IS NOT NULL,
 'module_entitlements',to_regclass('public.tenant_module_entitlements') IS NOT NULL,
 'module_installs',to_regclass('public.tenant_module_installs') IS NOT NULL,
 'outbox',to_regclass('control_events.outbox_events') IS NOT NULL,
 'deliveries',to_regclass('control_events.event_deliveries') IS NOT NULL,
 'consumer_inbox',to_regclass('control_events.consumer_inbox') IS NOT NULL,
 'tenants',(
  SELECT coalesce(json_agg(json_build_object(
   'tenant_id',tenant_id::text,'database_name',database_name,'state',state
  ) ORDER BY database_name),'[]'::json)
  FROM public.tenant_registry
 )
)::text;
"""
CONTROL_LEDGER_SQL = """
SELECT coalesce(json_agg(migration_key ORDER BY migration_key),'[]'::json)::text
FROM public.control_module_schema_migrations;
"""
TENANT_SQL = """
SELECT json_build_object(
 'database',current_database(),
 'version',current_setting('server_version_num')::int,
 'organizations',to_regclass('public.platform_organizations') IS NOT NULL,
 'workspace',to_regclass('public.platform_workspaces') IS NOT NULL,
 'whatsapp',to_regclass('public.whatsapp_inbound_events') IS NOT NULL,
 'crm',to_regclass('public.crm_people') IS NOT NULL,
 'inbox',to_regclass('public.inbox_conversations') IS NOT NULL,
 'outbox',to_regclass('platform_events.outbox_events') IS NOT NULL,
 'deliveries',to_regclass('platform_events.event_deliveries') IS NOT NULL,
 'consumer_inbox',to_regclass('platform_events.consumer_inbox') IS NOT NULL,
 'version_constraint', EXISTS(
  SELECT 1 FROM pg_constraint WHERE conname='platform_outbox_type_version_matches'
   AND conrelid=to_regclass('platform_events.outbox_events') AND convalidated
 )
)::text;
"""

def expected_database(tenant: dict) -> str:
    """Never accept a caller-supplied DSN or an unverified registry database."""
    ident = tenant.get("tenant_id")
    database = tenant.get("database_name")
    if (not isinstance(ident, str) or not UUID.fullmatch(ident) or
        not isinstance(database, str) or not DB.fullmatch(database) or
        database != "syndes_tenant_" + ident.replace("-", "")):
        raise ValueError("Invalid Control tenant mapping")
    return database

def read_catalog(container: str, database: str, select_sql: str):
    if container != CONTAINER or (
        database != CONTROL_DB and not DB.fullmatch(database)
    ):
        raise ValueError("Target is not an approved Syndes PostgreSQL database")
    if select_sql not in (CONTROL_SQL, CONTROL_LEDGER_SQL, TENANT_SQL):
        raise ValueError("Only fixed read-only catalog queries are permitted")
    query = "BEGIN TRANSACTION READ ONLY;\n" + select_sql + "\nROLLBACK;\n"
    command = [
        "docker", "exec", "-i", "-u", "postgres", container,
        "psql", "-w", "-X", "-A", "-t", "-q",
        "-v", "ON_ERROR_STOP=1", "-U", "postgres",
        "-d", database, "-f", "-"
    ]
    result = subprocess.run(command, input=query, text=True, capture_output=True,
                            check=False, timeout=12)
    if result.returncode:
        # Do not echo raw postgres stderr, which may contain connection data.
        raise RuntimeError("Read-only PostgreSQL inventory unavailable")
    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if len(lines) != 1:
        raise RuntimeError("Unexpected number of catalog inventory records")
    return json.loads(lines[0])

def local_http(url: str) -> int:
    if url not in dict(FRONTENDS).values():
        raise ValueError("Only preapproved local HTTP endpoints can be probed")
    try:
        with urlopen(url, timeout=3) as response:
            return int(response.status)
    except (URLError, OSError, TimeoutError):
        return 0

def inventory(*, catalog=read_catalog, probe=local_http) -> dict:
    surfaces = {name: {"local_http": probe(url), "visual_only":name=="manager_visual_only"}
                for name,url in FRONTENDS}
    report = {
        "kind": "syndes_event_staging_readiness_v1",
        "read_only": True,
        "frontend": surfaces,
        "frontend_preview_available": all(surfaces[name]["local_http"] == 200
                                          for name in ("workspace","manager_visual_only")),
        "control": {"state":"unknown"},
        "tenant_databases": {"checked":0,"ready":0,"blocked":0},
        "deployment_gates": {
            "backup_and_restore": "requires_operator_evidence",
            "trusted_service_identity_and_FGA": "not_proven",
            "module_ENABLED_enforcement": "not_proven",
            "legacy_projector_cutover": "not_proven",
            "production_deploy": "not_authorized",
        },
        "operational_activation_ready": False,
    }
    try:
        control = catalog(CONTAINER, CONTROL_DB, CONTROL_SQL)
        if control.get("database") != CONTROL_DB or not 170000 <= control.get("version", 0) < 180000:
            raise RuntimeError("Control database or PG17 verification failed")
        rows = control.get("tenants")
        if not isinstance(rows, list) or len(rows) > MAX_TENANTS:
            raise RuntimeError("Invalid tenant registry size; manual review required")
        report["control"] = {
            "state": "pending",
            "tenant_count": len(rows),
            "schema_present": all(control.get(key) is True for key in
             ("module_catalog","module_entitlements","module_installs","outbox","deliveries","consumer_inbox")),
            "migrations_applied": [],
            "migrations_missing": list(MIGRATIONS),
        }
        if control.get("migration_ledger") is True:
            applied = catalog(CONTAINER, CONTROL_DB, CONTROL_LEDGER_SQL)
            if not isinstance(applied,list) or any(not isinstance(x,str) for x in applied):
                raise RuntimeError("Invalid control migration ledger")
            report["control"]["migrations_applied"] = applied
            report["control"]["migrations_missing"] = [x for x in MIGRATIONS if x not in applied]
            if any(x not in MIGRATIONS for x in applied):
                raise RuntimeError("Unexpected Control migration key: manual reconciliation required")
        if report["control"]["schema_present"] and not report["control"]["migrations_missing"] and (
            report["control"]["state"] != "unexpected_migrations"
        ):
            # Only inventory, not checksum, restore or authorization validation.
            report["control"]["state"] = "schema_objects_and_keys_present_unverified"
        for row in rows:
            db = expected_database(row)
            result = {"state":"blocked"}
            try:
                tenant = catalog(CONTAINER, db, TENANT_SQL)
                flags = ("organizations","workspace","whatsapp","crm","inbox",
                         "outbox","deliveries","consumer_inbox","version_constraint")
                ready = (tenant.get("database") == db and
                         170000 <= tenant.get("version", 0) < 180000 and
                         all(tenant.get(flag) is True for flag in flags))
                result = {"state":"schema_objects_present" if ready else "migrations_pending",
                          "missing": [flag for flag in flags if tenant.get(flag) is not True]}
            except (RuntimeError, ValueError, json.JSONDecodeError):
                result = {"state":"database_unavailable"}
            # No tenant UUIDs, DB names, payloads or PII in operator-facing output.
            report["tenant_databases"]["checked"] += 1
            report["tenant_databases"]["ready" if result["state"]=="schema_objects_present" else "blocked"] += 1
            report["tenant_databases"].setdefault("statuses",[]).append(result)
    except (RuntimeError, ValueError, json.JSONDecodeError, TypeError) as exc:
        report["control"] = {"state":"blocked","reason":str(exc)}
    return report

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="machine-readable operator report")
    parser.add_argument("--strict", action="store_true", help="return nonzero while activation gates are missing")
    args = parser.parse_args()
    result = inventory()
    if args.json:
        print(json.dumps(result,ensure_ascii=False,indent=2,sort_keys=True))
    else:
        print("Syndes staging preflight — READ ONLY, no deploy or DB mutation")
        print("Frontend preview:", "available locally" if result["frontend_preview_available"] else "incomplete")
        print("Control:", result["control"]["state"])
        print("Tenants:",result["tenant_databases"]["checked"],
              "schema-ready:",result["tenant_databases"]["ready"])
        print("Activation: BLOCKED until backup/restore, FGA, ENABLED, cutover and explicit approval")
    return 2 if args.strict and not result["operational_activation_ready"] else 0

if __name__ == "__main__":
    sys.exit(main())
