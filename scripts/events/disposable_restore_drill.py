#!/usr/bin/env python3
"""Synthetic PostgreSQL 17 backup/restore rehearsal for Syndes event ledgers.

NEVER reads, dumps, connects to, or changes an operational PostgreSQL database.
Creates a brand-new network-disconnected Docker container with NO published ports,
synthetic module data, control/tenant fixture records, and temporary pg_dump
archives protected by filesystem permissions (NOT encrypted). Not a production gate.
Run only with --disposable and --ack-synthetic; no DB URL/host/credentials accepted.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
IMAGE = "postgres:17-alpine"
CONTAINER_PREFIX = "syndes-events-restore-drill-"
SAFE_DB = re.compile(r"^(?:postgres|syndes_control|syndes_tenant_[a-f0-9]{32}|drill_restore_[a-z]+_[a-f0-9]{12})$")
CONTROL = (
    "infra/postgres/bootstrap/control.schema",
    "infra/postgres/bootstrap/control-module-catalog.schema",
    "infra/postgres/bootstrap/control-module-lifecycle.schema",
    "infra/postgres/bootstrap/control-module-attestation.schema",
    "infra/postgres/bootstrap/control-module-activation.schema",
    "infra/postgres/bootstrap/control-module-manager-readonly.schema",
    "infra/postgres/bootstrap/control-module-events.schema",
)
TENANT = (
    "modules/organizations/sql/001_account_hierarchy.sql",
    "modules/organizations/sql/002_legacy_single_context_gate.sql",
    "modules/core-crm/sql/001_crm_foundation.sql",
    "modules/core-crm/sql/002_crm_tags_notes.sql",
    "modules/core-crm/sql/003_crm_employees_channels.sql",
    "modules/inbox/sql/001_inbox_foundation.sql",
    "modules/whatsapp/sql/001_whatsapp_accounts.sql",
    "modules/whatsapp/sql/002_whatsapp_inbound.sql",
    "modules/whatsapp/sql/003_whatsapp_outbound_inbox.sql",
    "modules/whatsapp/sql/004_whatsapp_conversation_phone.sql",
    "modules/whatsapp/sql/005_whatsapp_history.sql",
    "modules/organizations/sql/003_legacy_ownership.sql",
    "modules/organizations/sql/004_whatsapp_route_owner_guard.sql",
    "modules/organizations/sql/005_scoped_relationship_integrity.sql",
    "apps/core-host/sql/001_platform_events.sql",
    "apps/core-host/sql/002_event_type_version_consistency.sql",
)
CONTROL_FACTS = """
SELECT json_build_object(
 'registry',(SELECT count(*) FROM tenant_registry),
 'audit',(SELECT count(*) FROM tenant_module_audit),
 'outbox',(SELECT count(*) FROM control_events.outbox_events),
 'events',(SELECT coalesce(json_agg(json_build_object(
  'event_id',event_id,'type',event_type,'version',event_version,
  'audit_event_id',audit_event_id,'tenant',tenant_id,'module',module_id,
  'payload',payload) ORDER BY audit_event_id),'[]'::json)
  FROM control_events.outbox_events),
 'triggers',(SELECT count(*) FROM pg_trigger
  WHERE tgrelid='public.tenant_module_audit'::regclass
    AND tgname='control_module_audit_event_outbox' AND NOT tgisinternal),
 'scope_fk',(SELECT count(*) FROM pg_constraint
  WHERE conrelid='control_events.outbox_events'::regclass AND contype='f'
    AND array_length(conkey,1)=3 AND convalidated),
 'module_state',(SELECT state FROM tenant_module_entitlements
  WHERE module_id='crm' LIMIT 1)
)::text;
"""
TENANT_FACTS = """
SELECT json_build_object(
 'organizations',(SELECT count(*) FROM platform_organizations),
 'workspaces',(SELECT count(*) FROM platform_workspaces),
 'people',(SELECT count(*) FROM crm_people),
 'accounts',(SELECT count(*) FROM whatsapp_accounts),
 'inbound',(SELECT count(*) FROM whatsapp_inbound_events),
 'conversations',(SELECT count(*) FROM inbox_conversations),
 'outbox',(SELECT count(*) FROM platform_events.outbox_events),
 'events',(SELECT coalesce(json_agg(json_build_object(
   'event',event_id,'type',event_type,'version',event_version,
   'organization',organization_id,'payload',payload) ORDER BY event_type),'[]'::json)
   FROM platform_events.outbox_events),
 'deliveries',(SELECT coalesce(json_agg(json_build_object(
   'event',event_id,'consumer',consumer_id,'state',state,'attempts',attempts
 ) ORDER BY consumer_id),'[]'::json) FROM platform_events.event_deliveries),
 'processed',(SELECT count(*) FROM platform_events.consumer_inbox),
 'constraint',(SELECT count(*) FROM pg_constraint
  WHERE conrelid='platform_events.outbox_events'::regclass
    AND conname='platform_outbox_type_version_matches' AND convalidated)
)::text;
"""


class DrillError(RuntimeError):
    pass


def safe_database(name: str) -> str:
    if not SAFE_DB.fullmatch(name):
        raise DrillError("Refusing unexpected database name")
    return name


def run(argv: list[str], *, stdin: bytes | None = None,
        timeout: int = 90, allowed_failure: bool = False) -> bytes:
    result = subprocess.run(argv, input=stdin, capture_output=True, timeout=timeout, check=False)
    if result.returncode and not allowed_failure:
        # Never dump raw SQL/DB STDERR into logs.
        raise DrillError("Disposable PostgreSQL operation failed: " + argv[-1][:36])
    return result.stdout if not result.returncode else b""


class Postgres:
    def __init__(self, container: str):
        self.container = container

    def command(self, *args: str) -> list[str]:
        if not self.container.startswith(CONTAINER_PREFIX):
            raise DrillError("Untrusted disposable container identity")
        return ["docker", "exec", "-i", "-u", "postgres", self.container, *args]

    def sql(self, database: str, sql: str) -> str:
        database = safe_database(database)
        out = run(self.command("psql", "-w", "-X", "-q", "-A", "-t",
                               "-v", "ON_ERROR_STOP=1", "-d", database),
                  stdin=sql.encode("utf-8"))
        return out.decode("utf-8").strip()

    def dump(self, database: str) -> bytes:
        database = safe_database(database)
        archive = run(self.command("pg_dump", "-Fc", "--no-owner", "--no-acl",
                                   "-d", database), timeout=90)
        if len(archive) < 100 or not archive.startswith(b"PGDMP"):
            raise DrillError("Invalid disposable PG17 dump format")
        return archive

    def restore(self, database: str, archive: bytes):
        database = safe_database(database)
        if not archive.startswith(b"PGDMP"):
            raise DrillError("Invalid disposable restore archive")
        run(self.command("pg_restore", "--single-transaction", "--exit-on-error",
                         "--no-owner", "--no-acl", "-d", database),
            stdin=archive, timeout=120)


def sql_file(relative: str) -> str:
    if relative not in (*CONTROL, *TENANT):
        raise DrillError("Untrusted migration path")
    file = (ROOT / relative).resolve()
    if ROOT not in file.parents:
        raise DrillError("Migration escapes repository")
    return file.read_text(encoding="utf-8")


def uuid4() -> str:
    return str(uuid.uuid4())


def seed_control(pg: Postgres, tenant_id: str, tenant_db: str):
    # Roles exist ONLY inside the brand-new container.
    pg.sql("syndes_control", """
    DO $roles$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='syndes_core')
      THEN CREATE ROLE syndes_core NOLOGIN; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='syndes_master_api')
      THEN CREATE ROLE syndes_master_api NOLOGIN NOINHERIT; END IF;
    END $roles$;
    """)
    for relative in CONTROL:
        pg.sql("syndes_control", sql_file(relative))
    pg.sql("syndes_control", f"""
    INSERT INTO tenant_registry(tenant_id,database_name,role_name,state)
    VALUES('{tenant_id}','{tenant_db}','syndes_t_{tenant_id.replace("-", "")}','active');
    INSERT INTO module_catalog(module_id,schema_name) VALUES('crm','crm');
    INSERT INTO module_catalog_versions(module_id,version,approved,approved_at,approved_by)
    VALUES('crm','1.0.0',true,clock_timestamp(),'synthetic');
    SELECT transition_tenant_module_entitlement(
      '{tenant_id}'::uuid,'crm','grant','{uuid4()}'::uuid,
      'synthetic-operator','Disposable restore exercise');
    """)
    facts = json.loads(pg.sql("syndes_control", CONTROL_FACTS).splitlines()[-1])
    if (facts["audit"], facts["outbox"], facts["triggers"], facts["scope_fk"]) != (1, 1, 1, 1):
        raise DrillError("Control audit did not atomically emit one event")


def seed_tenant(pg: Postgres, tenant_db: str, tenant_id: str):
    for relative in TENANT:
        pg.sql(tenant_db, sql_file(relative))
    org, workspace, account, person = (uuid4() for _ in range(4))
    conversation, first_event, second_event = (uuid4() for _ in range(3))
    pg.sql(tenant_db, f"""
    INSERT INTO platform_organizations(tenant_id,id,display_name,is_default)
    VALUES('{tenant_id}','{org}','Synthetic org',true);
    INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default)
    VALUES('{tenant_id}','{workspace}','{org}','Synthetic','synthetic',true);
    INSERT INTO crm_people(tenant_id,id,name,phone,platform_organization_id)
    VALUES('{tenant_id}','{person}','Synthetic CRM person','+5511000000000','{org}');
    INSERT INTO whatsapp_accounts(tenant_id,id,display_name,platform_organization_id,service_enabled)
    VALUES('{tenant_id}','{account}','Synthetic WhatsApp','{org}',true);
    INSERT INTO inbox_conversations
       (tenant_id,id,subject,channel,external_thread_id,is_group,
        platform_organization_id,platform_origin_workspace_id,platform_current_workspace_id)
    VALUES('{tenant_id}','{conversation}','Synthetic inbox','whatsapp',
           'drill:synthetic',false,'{org}','{workspace}','{workspace}');
    """)
    inbound_id = pg.sql(tenant_db, f"""
    INSERT INTO whatsapp_inbound_events
      (tenant_id,account_id,external_message_id,event_type,payload)
    VALUES('{tenant_id}','{account}','synthetic-message',
           'whatsapp.message.received',
           '{{"version":"1","type":"whatsapp.message.received"}}'::jsonb)
    RETURNING id::text;
    """).splitlines()[-1]
    if not inbound_id.isdecimal() or int(inbound_id) <= 0:
        raise DrillError("Synthetic BIGINT inbound reference not created")
    pg.sql(tenant_db, f"""
    INSERT INTO platform_events.outbox_events
      (tenant_id,event_id,organization_id,workspace_id,event_type,event_version,
       producer,aggregate_type,aggregate_id,idempotency_key,correlation_id,payload,
       routing_state,routed_at)
    VALUES
      ('{tenant_id}','{first_event}','{org}','{workspace}',
       'crm.person.created.v1',1,'crm','person','{person}',
       'drill-created','{uuid4()}','{{"personId":"{person}"}}'::jsonb,
       'routed',clock_timestamp()),
      ('{tenant_id}','{second_event}','{org}','{workspace}',
       'whatsapp.message.received.v2',2,'whatsapp','whatsapp_account','{account}',
       'drill-received','{uuid4()}',
       '{{"inboundEventId":"{inbound_id}","accountId":"{account}"}}'::jsonb,
       'routed',clock_timestamp());
    INSERT INTO platform_events.event_deliveries
      (tenant_id,event_id,consumer_id,state,attempts,completed_at)
    VALUES ('{tenant_id}','{first_event}','inbox.restore-fixture','completed',1,clock_timestamp());
    INSERT INTO platform_events.consumer_inbox(tenant_id,event_id,consumer_id)
    VALUES('{tenant_id}','{first_event}','inbox.restore-fixture');
    INSERT INTO platform_events.event_deliveries
      (tenant_id,event_id,consumer_id,state,attempts,next_attempt_at,last_error_class)
    VALUES('{tenant_id}','{second_event}','crm.restore-fixture','retry',2,
           clock_timestamp()-interval '1 minute','transient');
    CREATE TABLE restore_drill_effects(event_id UUID PRIMARY KEY,
                                      processed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
    """)
    facts = json.loads(pg.sql(tenant_db, TENANT_FACTS).splitlines()[-1])
    if (facts["people"], facts["inbound"], facts["outbox"],
        len(facts["deliveries"]), facts["processed"], facts["constraint"]) != (1, 1, 2, 2, 1, 1):
        raise DrillError("Synthetic tenant ledger was not seeded correctly")
    return second_event, tenant_id


def collect(pg: Postgres, database: str, sql: str) -> dict:
    return json.loads(pg.sql(database, sql).splitlines()[-1])


def sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def verified_archive(path: Path, digest: str) -> bytes:
    if path.stat().st_mode & 0o077:
        raise DrillError("Disposable backup has insecure file permissions")
    archive = path.read_bytes()
    if not archive.startswith(b"PGDMP") or sha(archive) != digest:
        raise DrillError("Disposable backup failed format/checksum verification")
    return archive


def restore_drill() -> dict:
    suffix = secrets.token_hex(6)
    container = CONTAINER_PREFIX + suffix
    # Name and label verify that only this run's disposable container is touched.
    pg = Postgres(container)
    tenant_id = uuid4()
    tenant_db = "syndes_tenant_" + tenant_id.replace("-", "")
    restore_control = "drill_restore_control_" + suffix
    restore_tenant = "drill_restore_tenant_" + suffix
    source_snapshot = {}
    started = False
    report = {"kind": "syndes_synthetic_pg17_restore_v1",
              "isolated": True, "network": "none", "source": "synthetic_only",
              "production_backup_verified": False,
              "production_restore_approved": False,
              "operational_ddl_executed": False,
              "checks": {}}
    try:
        password = secrets.token_urlsafe(32)
        # No -p published port, no external network, no persistent volume.
        started = True  # Also clean up if Docker starts but the client call times out.
        run(["docker", "run", "-d", "--rm", "--network", "none",
             "--name", container, "--label", "syndes.disposable=restore-drill",
             "--memory", "768m", "--pids-limit", "192",
             "-e", "POSTGRES_PASSWORD=" + password, IMAGE], timeout=60)
        password = ""
        for _ in range(40):
            status = subprocess.run(pg.command("pg_isready", "-q", "-d", "postgres"),
                                    capture_output=True, timeout=5, check=False)
            if status.returncode == 0:
                break
            time.sleep(.5)
        else:
            raise DrillError("Disposable postgres did not become ready")
        version = int(pg.sql("postgres", "SELECT current_setting('server_version_num')::integer;"))
        if version < 170000 or version >= 180000:
            raise DrillError("Fixture is not PostgreSQL 17")
        report["checks"]["pg17"] = True
        for database in ("syndes_control", tenant_db,
                         restore_control, restore_tenant):
            pg.sql("postgres", f'CREATE DATABASE "{safe_database(database)}";')
        seed_control(pg, tenant_id, tenant_db)
        pending_event, _ = seed_tenant(pg, tenant_db, tenant_id)
        original_control = collect(pg, "syndes_control", CONTROL_FACTS)
        original_tenant = collect(pg, tenant_db, TENANT_FACTS)
        report["checks"]["source_audit_and_outboxes"] = True
        with tempfile.TemporaryDirectory(prefix="syndes-synthetic-restore-") as directory:
            os.chmod(directory, 0o700)
            paths = {}
            for label, source in (("control", "syndes_control"), ("tenant", tenant_db)):
                data = pg.dump(source)
                filename = Path(directory) / (label + ".dump")
                filename.write_bytes(data)
                filename.chmod(0o600)
                paths[label] = (filename, sha(data))
            report["checks"]["custom_archives"] = True
            for label, target in (("control", restore_control), ("tenant", restore_tenant)):
                filename, digest = paths[label]
                current = verified_archive(filename, digest)
                pg.restore(target, current)
            report["checks"]["archive_sha256_verified"] = True
        restored_control = collect(pg, restore_control, CONTROL_FACTS)
        restored_tenant = collect(pg, restore_tenant, TENANT_FACTS)
        if original_control != restored_control:
            raise DrillError("Control ledger facts diverged after restore")
        if original_tenant != restored_tenant:
            raise DrillError("Tenant ledger facts diverged after restore")
        report["checks"]["control_event_audit_restored"] = True
        report["checks"]["tenant_data_and_events_restored"] = True
        report["checks"]["tenant_delivery_inbox_restored"] = True
        # Verify that the RESTORED Control DB remains operational (function +
        # trigger) without changing the original synthetic source database.
        pg.sql(restore_control, f"""
        SELECT transition_tenant_module_entitlement(
          '{tenant_id}'::uuid,'crm','suspend','{uuid4()}'::uuid,
          'synthetic-operator','Restore functionality check');
        """)
        resumed_control = collect(pg, restore_control, CONTROL_FACTS)
        if resumed_control["audit"] != 2 or resumed_control["outbox"] != 2:
            raise DrillError("Restored Control trigger/transition did not resume")
        if collect(pg, "syndes_control", CONTROL_FACTS) != original_control:
            raise DrillError("Source Control DB changed during restored replay")
        report["checks"]["restored_control_trigger_operational"] = True
        # Explicitly verify that even after DB restore the runtime Core role
        # has no SELECT privilege on the Control event ledger.
        permission = pg.sql(restore_control,
            "SELECT has_table_privilege('syndes_core','control_events.outbox_events','SELECT');")
        if permission != "f":
            raise DrillError("Restored event ledger has unsafe runtime privileges")
        report["checks"]["restored_control_acl_closed"] = True
        # Simulated idempotent resume is only on the RESTORED disposable tenant.
        replay = f"""
        BEGIN;
        INSERT INTO restore_drill_effects(event_id) VALUES('{pending_event}')
           ON CONFLICT DO NOTHING;
        INSERT INTO platform_events.consumer_inbox(tenant_id,event_id,consumer_id)
         VALUES('{tenant_id}','{pending_event}','crm.restore-fixture')
         ON CONFLICT DO NOTHING;
        UPDATE platform_events.event_deliveries
          SET state='completed',completed_at=clock_timestamp(),
              last_error_class=NULL
          WHERE event_id='{pending_event}' AND tenant_id='{tenant_id}'
             AND consumer_id='crm.restore-fixture';
        COMMIT;
        """
        pg.sql(restore_tenant, replay)
        pg.sql(restore_tenant, replay)
        count = pg.sql(restore_tenant, "SELECT count(*) FROM restore_drill_effects;")
        processed = pg.sql(restore_tenant, """
          SELECT count(*) FROM platform_events.consumer_inbox
          WHERE consumer_id='crm.restore-fixture';""")
        if count != "1" or processed != "1":
            raise DrillError("Restored idempotent replay duplicated effects")
        if collect(pg, tenant_db, TENANT_FACTS) != original_tenant:
            raise DrillError("Source tenant changed during restored replay")
        report["checks"]["restored_replay_idempotent"] = True
        report["checks"]["source_unchanged_after_replay"] = True
        report["result"] = "passed_synthetic_only"
    finally:
        if started:
            # Only the random container created by this run is removed.
            subprocess.run(["docker", "stop", "--time", "8", container],
                           capture_output=True, timeout=25, check=False)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--disposable", action="store_true",
                        help="explicitly require a fresh network-isolated PG17 container")
    parser.add_argument("--ack-synthetic", action="store_true",
                        help="confirm this is synthetic, NOT a production restore")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    if not (args.disposable and args.ack_synthetic):
        parser.error("Both --disposable and --ack-synthetic are required")
    try:
        result = restore_drill()
        print(json.dumps(result, indent=2, sort_keys=True) if args.json else
              "Synthetic PG17 restore PASSED (no operational data or network access)")
        return 0
    except (DrillError, subprocess.TimeoutExpired, OSError, ValueError) as exc:
        print(json.dumps({"kind": "syndes_synthetic_pg17_restore_v1",
                          "result": "failed",
                          "reason": type(exc).__name__,
                          "operational_ddl_executed": False}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
