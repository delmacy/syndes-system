#!/usr/bin/env python3
"""Offline-reviewed, SHA-256 pinned Control DB module migrations.

Default: --plan (read only). --apply needs explicit release SHA, backup and
restoration evidence plus an acknowledgement env var. Never called by runtime.
Uses Docker's local PostgreSQL superuser via stdin, never prints secrets.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
BOOT = ROOT / "infra/postgres/bootstrap"
MIGRATIONS = (
    ("001_catalog", "control-module-catalog.schema"),
    ("002_lifecycle", "control-module-lifecycle.schema"),
    ("003_attestation", "control-module-attestation.schema"),
    ("004_activation", "control-module-activation.schema"),
    ("005_manager_readonly", "control-module-manager-readonly.schema"),
)
ALLOWED_CONTAINER = re.compile(r"^[a-z][a-z0-9-]{5,90}$")
HEX40 = re.compile(r"^[0-9a-f]{40}$")
EVIDENCE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{8,120}$")
PG17_MIN = 170000
PG18_MIN = 180000
LEDGER = "public.control_module_schema_migrations"
TABLES = (
    "module_catalog", "module_catalog_versions",
    "module_catalog_dependencies", "tenant_module_entitlements",
    "tenant_module_installs", "tenant_module_audit",
)
MIGRATION_SCHEMA = """
CREATE TABLE IF NOT EXISTS public.control_module_schema_migrations (
 migration_key TEXT PRIMARY KEY CHECK(migration_key ~ '^[0-9]{3}_[a-z0-9_]+$'),
 sha256 TEXT NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 release_commit TEXT NOT NULL CHECK(release_commit ~ '^[0-9a-f]{40}$'),
 applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON public.control_module_schema_migrations FROM PUBLIC,syndes_core;
"""

def release_files():
    """Only fixed checked-in SQL files, with SHA pin calculated from their bytes."""
    result = []
    for key, rel in MIGRATIONS:
        path = BOOT / rel
        raw = path.read_bytes()
        if not raw or b"\x00" in raw:
            raise ValueError("Invalid migration source: " + rel)
        content = raw.decode("utf-8")
        if "\\gexec" in content or "\\include" in content or "\\ir " in content:
            raise ValueError("psql meta-command not allowed in a migration: " + rel)
        result.append((key, rel, hashlib.sha256(raw).hexdigest(), content))
    return result

def psql(container, sql, db="syndes_control"):
    if not ALLOWED_CONTAINER.fullmatch(container) or db != "syndes_control":
        raise ValueError("Invalid container or target Control database")
    cmd = ["docker", "exec", "-i", "-u", "postgres", container,
           "psql", "-w", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
           "-U", "postgres", "-d", db, "-f", "-"]
    result = subprocess.run(cmd, input=sql, text=True, capture_output=True,
                            check=False, timeout=120)
    if result.returncode:
        raise RuntimeError("Control PostgreSQL query failed (details withheld; inspect local operator logs)")
    return result.stdout

def inventory(container):
    sql = """
SELECT json_build_object(
 'database',current_database(),
 'version_num',current_setting('server_version_num')::int,
 'user',current_user,
 'is_superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),
 'ledger_exists',to_regclass('public.control_module_schema_migrations') IS NOT NULL,
 'existing_module_tables',(
   SELECT coalesce(json_agg(table_name),'[]'::json)
   FROM information_schema.tables
   WHERE table_schema='public'
     AND table_name IN ('module_catalog','module_catalog_versions',
       'module_catalog_dependencies','tenant_module_entitlements',
       'tenant_module_installs','tenant_module_audit')
 ),
 'tenants',(SELECT count(*) FROM public.tenant_registry)
)::text;
"""
    raw = psql(container, sql).strip().splitlines()
    if len(raw) != 1:
        raise RuntimeError("Unexpected Control DB inventory")
    record = json.loads(raw[0])
    if (record["database"] != "syndes_control"
        or record["user"] != "postgres"
        or record["is_superuser"] is not True
        or not PG17_MIN <= record["version_num"] < PG18_MIN):
        raise RuntimeError("Control DB identity/PG17 gate denied")
    history = []
    if record["ledger_exists"]:
        query = ("SELECT coalesce(json_agg(row_to_json(v)),'[]'::json)::text FROM "
                 "(SELECT migration_key,sha256 FROM " + LEDGER + " ORDER BY migration_key) v;")
        raw_history = psql(container, query).strip().splitlines()
        if len(raw_history) != 1:
            raise RuntimeError("Invalid Control migration history")
        history = json.loads(raw_history[0])
    return record, history

def reconcile(container, migrations):
    meta, recorded = inventory(container)
    known = {key: checksum for key, _, checksum, _ in migrations}
    past = {}
    for row in recorded:
        if row["migration_key"] not in known:
            raise RuntimeError("Unexpected Control migration key: refusing to modify historical state")
        if row["sha256"] != known[row["migration_key"]]:
            raise RuntimeError("Control migration checksum drift: " + row["migration_key"])
        if row["migration_key"] in past:
            raise RuntimeError("Duplicate migration history")
        past[row["migration_key"]] = row["sha256"]
    if meta["existing_module_tables"] and not recorded:
        raise RuntimeError("Existing Control module tables without migration history: manual reconciliation required")
    # Disallow partially applied migration sets even if checksums are valid:
    # ordered migrations are the source of truth.
    encountered_gap = False
    for key in known:
        if key not in past:
            encountered_gap = True
        elif encountered_gap:
            raise RuntimeError("Out-of-order Control migration history: manual reconciliation required")
    return meta, past

def apply_sql(migrations, sha):
    commands = [
        "\\set ON_ERROR_STOP on",
        "BEGIN;",
        "SET LOCAL lock_timeout='5s';",
        "SET LOCAL statement_timeout='120s';",
        "SET LOCAL search_path=pg_catalog;",
        """DO $check$ BEGIN
 IF current_database()<>'syndes_control'
    OR current_setting('server_version_num')::int<170000
    OR current_setting('server_version_num')::int>=180000
    OR current_user<>'postgres'
 THEN RAISE EXCEPTION 'Control database identity gate denied'; END IF;
END $check$;""",
        "SELECT pg_advisory_xact_lock(hashtextextended('syndes-control-module-migrations',0));",
        MIGRATION_SCHEMA,
    ]
    for idx, (key, _rel, checksum, content) in enumerate(migrations, 1):
        # A changed checksum always aborts before any DDL is committed.
        commands.append(
            "DO $drift$ BEGIN IF EXISTS(SELECT 1 FROM " + LEDGER +
            " WHERE migration_key='" + key + "' AND sha256<>'" + checksum + "') THEN "
            "RAISE EXCEPTION 'Control module migration checksum mismatch'; END IF; END $drift$;")
        variable = "migrate_" + str(idx)
        commands += [
            "SELECT CASE WHEN EXISTS(SELECT 1 FROM " + LEDGER +
            " WHERE migration_key='" + key + "') THEN 'false' ELSE 'true' END AS " +
            variable + " \\gset",
            "\\if :" + variable,
            content.rstrip(),
            "INSERT INTO " + LEDGER +
            "(migration_key,sha256,release_commit) VALUES('" +
            key + "','" + checksum + "','" + sha + "');",
            "\\endif",
        ]
    commands += ["COMMIT;", "SELECT 'CONTROL_MODULE_MIGRATIONS_COMMITTED' AS marker;"]
    return "\n".join(commands) + "\n"

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", default="syndes-postgres-postgres-1")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--plan", action="store_true")
    group.add_argument("--apply", action="store_true")
    parser.add_argument("--approved-sha")
    parser.add_argument("--backup-id")
    parser.add_argument("--restore-test-id")
    args = parser.parse_args()
    migrations = release_files()
    try:
        meta, recorded = reconcile(args.container, migrations)
        print("CONTROL DB:", meta["database"], "PG17; tenants:", meta["tenants"])
        for key, rel, checksum, _ in migrations:
            print("APPLIED" if key in recorded else "PENDING", key, rel, checksum)
        if not args.apply:
            print("PLAN ONLY: no Control DB changes")
            return 0
        # No credentials, approvals or evidence are inferred from the user.
        # This is an accident-prevention guard, not a replacement for product approval.
        if os.environ.get("SYNDES_CONTROL_MIGRATION_APPLY") != "APPROVED_CONTROL_DB_ONLY":
            raise RuntimeError("Explicit apply mode environment acknowledgement missing")
        if not HEX40.fullmatch(args.approved_sha or ""):
            raise RuntimeError("Approved source SHA required")
        if not (EVIDENCE.fullmatch(args.backup_id or "") and
                EVIDENCE.fullmatch(args.restore_test_id or "")):
            raise RuntimeError("Backup and real restore rehearsal identifiers required")
        git = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "HEAD"],
                             capture_output=True, text=True, check=True)
        if git.stdout.strip() != args.approved_sha:
            raise RuntimeError("Approved SHA must match the checked-out release")
        clean = subprocess.run(["git", "-C", str(ROOT), "status", "--porcelain",
                                "--untracked-files=no"], capture_output=True,
                               text=True, check=True)
        if clean.stdout.strip():
            raise RuntimeError("Source checkout has tracked changes; apply denied")
        if len(recorded) == len(migrations):
            print("NOOP: Control module migrations are already applied with matching checksums")
            return 0
        result = psql(args.container, apply_sql(migrations, args.approved_sha))
        if "CONTROL_MODULE_MIGRATIONS_COMMITTED" not in result:
            raise RuntimeError("Migration transaction returned no commit acknowledgement")
        _meta, finished = reconcile(args.container, migrations)
        if len(finished) != len(migrations):
            raise RuntimeError("Incomplete Control module migration ledger after apply")
        print("APPLY SUCCEEDED: all changes committed with pinned checksums")
        return 0
    except (OSError, subprocess.SubprocessError, RuntimeError, ValueError, KeyError) as error:
        print("BLOCKED:", error, file=sys.stderr)
        return 2

if __name__ == "__main__":
    sys.exit(main())
