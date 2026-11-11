#!/usr/bin/env python3
"""Fail-closed, read-only readiness inventory for Syndes Service Management.

Default: source-code compatibility audit only. Optional local operational
inventory uses a fixed Docker container and fixed SELECT-only SQL scripts.
NEVER applies DDL, provisions grants, touches user messages, or activates
a module. Output contains no tenant names, tenant UUIDs, roles or credentials.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTAINER = "syndes-postgres-postgres-1"
CONTROL_DB = "syndes_control"
MAX_TENANTS = 50
MODULE_SLUG = "@syndes/service-management/plugin"
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
DB_NAME = re.compile(r"^syndes_tenant_[0-9a-f]{32}$")
CATALOG_ID = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
MIGRATION_ID = re.compile(r"^\d{3}_[a-z0-9_]+$")
EXPECTED_MIGRATIONS = (
    "001_service_funnels",
    "002_service_team_transfer",
    "003_service_conversation_inspector",
)
SERVICE_TABLES = (
    "service_funnels", "service_funnel_stages", "service_attendances",
    "service_attendance_events",
)
STAFF_TABLES = (
    "platform_staff_identity_links", "platform_workspace_staff_roles",
    "platform_staff_teams", "platform_staff_team_workspaces",
    "platform_staff_team_members",
)
CONTROL_SQL = """
SELECT json_build_object(
  'database',current_database(),
  'version',current_setting('server_version_num')::int,
  'catalog',to_regclass('public.module_catalog') IS NOT NULL,
  'versions',to_regclass('public.module_catalog_versions') IS NOT NULL,
  'entitlements',to_regclass('public.tenant_module_entitlements') IS NOT NULL,
  'installs',to_regclass('public.tenant_module_installs') IS NOT NULL,
  'tenants',(
    SELECT coalesce(json_agg(json_build_object(
      'tenant_id',tenant_id::text,'database_name',database_name,'state',state
    ) ORDER BY database_name),'[]'::json)
    FROM public.tenant_registry
  )
)::text;
"""
TENANT_SQL = """
SELECT json_build_object(
 'database',current_database(),
 'version',current_setting('server_version_num')::int,
 'sql002_org',to_regclass('public.platform_legacy_single_organization') IS NOT NULL,
 'sql002_workspace',to_regclass('public.platform_legacy_single_workspace') IS NOT NULL,
 'crm',to_regclass('public.crm_employees') IS NOT NULL,
 'inbox',to_regclass('public.inbox_conversations') IS NOT NULL,
 'workforce_identity',to_regclass('public.platform_staff_identity_links') IS NOT NULL,
 'workforce_roles',to_regclass('public.platform_workspace_staff_roles') IS NOT NULL,
 'workforce_teams',to_regclass('public.platform_staff_teams') IS NOT NULL,
 'workforce_team_workspace',to_regclass('public.platform_staff_team_workspaces') IS NOT NULL,
 'workforce_team_members',to_regclass('public.platform_staff_team_members') IS NOT NULL,
 'service_funnels',to_regclass('public.service_funnels') IS NOT NULL,
 'service_stages',to_regclass('public.service_funnel_stages') IS NOT NULL,
 'service_attendances',to_regclass('public.service_attendances') IS NOT NULL,
 'service_events',to_regclass('public.service_attendance_events') IS NOT NULL,
 'service_team_guard',to_regprocedure('public.service_team_can_read(uuid,uuid,uuid,uuid,text)') IS NOT NULL,
 'service_inspector_index',EXISTS (
   SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname='public'
     AND indexname='service_attendance_inspector_conversation_idx'
 ),
 'module_ledger',to_regclass('_syndes.module_migrations') IS NOT NULL,
 'runtime_superuser',(
   SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname='syndes_core'
 )
)::text;
"""
APPROVED_SELECTS = (CONTROL_SQL, TENANT_SQL)
TENANT_FLAGS = (
    "sql002_org", "sql002_workspace", "crm", "inbox",
    "workforce_identity", "workforce_roles", "workforce_teams",
    "workforce_team_workspace", "workforce_team_members",
    "service_funnels", "service_stages", "service_attendances",
    "service_events", "service_team_guard", "service_inspector_index",
    "module_ledger",
)


def source_contract(root: Path = ROOT) -> dict:
    """Inspect actual descriptors, never infer deployment approval from source."""
    src = (root / "modules/service-management/src/service.ts").read_text()
    plugin = (root / "modules/service-management/src/plugin.ts").read_text()
    package = json.loads((root / "modules/service-management/package.json").read_text())
    lock = json.loads((root / "modules/service-management/package-lock.json").read_text())
    installer = (root / "apps/core-host/src/module-installer.ts").read_text()
    host_modules = (root / "apps/core-host/src/module-host.ts").read_text()
    control_catalog = (root / "infra/postgres/bootstrap/control-module-catalog.schema").read_text()
    installed = json.loads((root / "apps/core-host/config/modules.json").read_text())
    match = re.search(r'\bid:"([^"]+)",version:"([^"]+)"', src)
    identifier = match.group(1) if match else None
    version = match.group(2) if match else None
    migrations = re.findall(r'\bid:"(\d{3}_[a-z0-9_]+)"', plugin)
    sql_dir = root / "modules/service-management/sql"
    files_exist = all((sql_dir / (migration + ".sql")).is_file()
                      for migration in EXPECTED_MIGRATIONS)
    sql = "\n".join((sql_dir / (migration + ".sql")).read_text()
                    for migration in EXPECTED_MIGRATIONS
                    if (sql_dir / (migration + ".sql")).is_file())
    wrapper = bool(re.search(r"(?im)^\s*(BEGIN|COMMIT)\s*;\s*$", sql))
    # Installer insists on an identical, separately owned module schema, yet
    # the current migrations create all service objects in 'public'.
    schema_ready = bool(identifier and all(
        re.search(r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+" +
                  re.escape(identifier) + r"\." + re.escape(table) + r"\b",
                  sql, re.I) for table in SERVICE_TABLES))
    installer_restriction = "const ID=/^[a-z][a-z0-9_]*$/;" in installer
    catalog_restriction = "module_id ~ '^[a-z][a-z0-9_]*$'" in control_catalog
    module_id_valid = bool(identifier and CATALOG_ID.fullmatch(identifier)
                           and installer_restriction and catalog_restriction)
    declared_resources = re.findall(r'\{resource:"([^"]+)"',plugin)
    resource_namespace_valid = bool(identifier and declared_resources and all(
        r.startswith(identifier+":") for r in declared_resources))
    # Domain authorization gate and plugin descriptor must use one canonical
    # Control module ID, not two spellings accepted by different subsystems.
    gate_ids = re.findall(r'moduleId:"([^"]+)"',src)
    # Inbox is an explicitly authorized cross-module READ dependency of the
    # Inspector; it must remain a separate gate, not be rewritten to Service.
    module_gate_id_consistent = bool(identifier and identifier in gate_ids and
                                     all(gate in (identifier,"inbox") for gate in gate_ids))
    package_name = package.get("name")
    package_slug = (package_name.split("/")[-1] if isinstance(package_name,str)
                    and package_name.startswith("@syndes/") else None)
    host_package_id_consistent = bool(package_slug and identifier and
        package_slug.replace("core-","",1) == identifier and
        "plugin.definition.id!==packageId.replace" in host_modules)
    checks = {
        "control_module_id_compatible": module_id_valid,
        "host_package_id_matches_descriptor": host_package_id_consistent,
        "permission_resources_match_module_id": resource_namespace_valid,
        "authorization_module_ids_match_descriptor": module_gate_id_consistent,
        "release_version_consistent": bool(version and version == package.get("version")
            and lock.get("packages",{}).get("",{}).get("version") == version),
        "three_reviewed_migrations_declared": migrations == list(EXPECTED_MIGRATIONS) and files_exist,
        "installer_transaction_safe": bool(sql) and not wrapper,
        "module_owned_schema_qualified": schema_ready,
        "runtime_plugin_deliberately_unmounted": MODULE_SLUG not in installed.get("modules",[]),
    }
    blockers = [name for name,ok in checks.items() if not ok]
    return {
        "module_id": identifier if module_id_valid else "incompatible",
        "module_version": version if isinstance(version,str) and
                          re.fullmatch(r"\d+\.\d+\.\d+",version) else "invalid",
        "checks": checks,
        "blockers": blockers,
        "source_compatible": not blockers,
    }


def expected_database(row: dict) -> str:
    """Registry mapping is checked and never accepted from CLI parameters."""
    ident, database = row.get("tenant_id"), row.get("database_name")
    if (not isinstance(ident,str) or not UUID.fullmatch(ident) or
        not isinstance(database,str) or not DB_NAME.fullmatch(database) or
        database != "syndes_tenant_" + ident.replace("-","")):
        raise ValueError("Untrusted Control tenant mapping")
    return database


def read_catalog(container: str,database: str, sql: str):
    if container != CONTAINER or (database != CONTROL_DB and
                                  not DB_NAME.fullmatch(database)):
        raise ValueError("Unapproved local database target")
    if (sql not in APPROVED_SELECTS or
        (database == CONTROL_DB and sql != CONTROL_SQL) or
        (database != CONTROL_DB and sql != TENANT_SQL)):
        raise ValueError("Unapproved read-only statement for this database")
    # psql -X suppresses local rc files. Never echo stderr or raw identities.
    script = "BEGIN TRANSACTION READ ONLY;\n" + sql + "\nROLLBACK;\n"
    result = subprocess.run(
        ["docker","exec","-i","-u","postgres",CONTAINER,
         "psql","-w","-X","-A","-t","-q","-v","ON_ERROR_STOP=1",
         "-U","postgres","-d",database,"-f","-"],
        input=script,text=True,capture_output=True,check=False,timeout=12)
    if result.returncode:
        raise RuntimeError("Local read-only PostgreSQL inventory unavailable")
    records = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if len(records) != 1:
        raise RuntimeError("Unexpected PostgreSQL inventory result")
    return json.loads(records[0])


def inventory(*,root:Path=ROOT,catalog=read_catalog,operational:bool=False) -> dict:
    source = source_contract(root)
    report = {
        "kind": "syndes_service_management_readiness_v1",
        "read_only": True,
        "mode": "local_catalog_read_only" if operational else "offline_source_only",
        "source": source,
        "control": {"state":"not_checked" if not operational else "blocked"},
        "tenants": {"checked":0,"schema_inventory_complete":0,"blocked":0},
        "gates": {
            "backup_restore_real":"not_proven",
            "control_enabled_and_attested":"not_proven",
            "keycloak_and_openfga_grants":"not_proven",
            "installer_ledger_and_roles":"not_proven",
            "physical_migrations":"not_authorized",
            "frontend_product_gate":"not_proven",
        },
        # No catalog flag or synthetic fixture may turn this on.
        "safe_to_install_or_enable": False,
    }
    if not operational:
        return report
    try:
        control = catalog(CONTAINER,CONTROL_DB,CONTROL_SQL)
        rows = control.get("tenants")
        if (control.get("database") != CONTROL_DB or
            not 170000 <= control.get("version",0) < 180000 or
            not isinstance(rows,list) or len(rows) > MAX_TENANTS):
            raise ValueError("Unverified Control metadata")
        # Validate ALL mapping rows before invoking ANY tenant query.
        targets = [expected_database(row) for row in rows]
        if len(targets)!=len(set(targets)):
            raise ValueError("Duplicate tenant database mapping")
        control_flags=("catalog","versions","entitlements","installs")
        report["control"] = {
            "state": "schema_present_unverified" if all(control.get(k) is True
                            for k in control_flags) else "control_migrations_pending",
            "schema_flags": {k:control.get(k) is True for k in control_flags},
            "tenant_count": len(targets),
        }
        for database in targets:
            status = {"state":"database_unavailable"}
            try:
                data = catalog(CONTAINER,database,TENANT_SQL)
                if data.get("database") != database or not 170000 <= data.get("version",0) < 180000:
                    raise ValueError("Invalid tenant database identity")
                missing=[flag for flag in TENANT_FLAGS if data.get(flag) is not True]
                role_safe=data.get("runtime_superuser") is False
                status = {
                    "state": "schema_inventory_complete_unverified" if not missing and role_safe
                             else "schema_or_runtime_role_incomplete",
                    "missing":missing,
                    "runtime_non_superuser_verified":role_safe,
                }
            except (ValueError,RuntimeError,TypeError,KeyError,json.JSONDecodeError):
                pass
            report["tenants"]["checked"]+=1
            report["tenants"]["schema_inventory_complete" if status["state"]==
               "schema_inventory_complete_unverified" else "blocked"]+=1
            report["tenants"].setdefault("statuses",[]).append(status)
    except (ValueError,RuntimeError,TypeError,KeyError,json.JSONDecodeError):
        report["control"] = {"state":"blocked","reason":"untrusted_or_unavailable_inventory"}
    return report


def main()->int:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--json",action="store_true")
    p.add_argument("--strict",action="store_true",help="exit 2 while rollout is blocked")
    p.add_argument("--local-read-only",action="store_true",
                   help="opt into READ ONLY catalog probes on preapproved local PG17")
    p.add_argument("--ack-catalog",action="store_true",
                   help="explicitly acknowledge local PG17 catalog reads")
    args=p.parse_args()
    if args.ack_catalog != args.local_read_only:
        p.error("--local-read-only requires --ack-catalog, and vice versa")
    result=inventory(operational=args.local_read_only)
    if args.json:
        print(json.dumps(result,ensure_ascii=False,indent=2,sort_keys=True))
    else:
        print("Syndes Service Management preflight: READ ONLY")
        print("Source compatibility:", "PASS" if result["source"]["source_compatible"]
              else "BLOCKED")
        print("Source blockers:", ", ".join(result["source"]["blockers"]) or "none")
        print("Control:",result["control"]["state"])
        print("Tenants inventoried:",result["tenants"]["checked"],
              "catalog-compatible:",result["tenants"]["schema_inventory_complete"])
        print("Operational install/enable: BLOCKED (restore, grants, operator authorization)")
    return 2 if args.strict and not result["safe_to_install_or_enable"] else 0


if __name__=="__main__":
    sys.exit(main())
