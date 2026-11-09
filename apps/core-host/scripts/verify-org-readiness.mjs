#!/usr/bin/env node
/**
 * Read-only readiness gate before promoting org-scoped Core Host.
 * Operator must resolve canonical tenant database from trusted Control Plane.
 * No data mutation, connection strings, personal data or credentials in output.
 */
import { Pool } from "pg";

const url = process.env.SYNDES_ORG_READINESS_PG_URL;
const tenantId = process.env.SYNDES_ORG_READINESS_TENANT_ID;
const actorId = process.env.SYNDES_ORG_READINESS_ACTOR_ID;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!url || !uuid.test(tenantId ?? "") || !actorId || actorId.length > 256) {
  console.error("DENY: canonical tenant, approved tenant DB URL and authorized administrator ID required");
  process.exit(2);
}

const pool = new Pool({connectionString:url,max:1,connectionTimeoutMillis:5000,idleTimeoutMillis:1000});
let client;
let failed = false;
try {
  client = await pool.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout = '10000ms'");
  const required = [
    "platform_organizations","platform_workspaces","platform_org_memberships",
    "platform_workspace_memberships","platform_legacy_backfill_runs",
    "crm_people","crm_organizations","crm_tags","inbox_conversations","whatsapp_accounts",
  ];
  const tables = await client.query(
    "SELECT name, to_regclass('public.' || name) IS NOT NULL AS present FROM unnest($1::text[]) name",[required]);
  for(const row of tables.rows){
    if(!row.present) throw new Error("Missing tenant table: " + row.name);
  }
  const indexes = await client.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND indexname=ANY($1::text[])",
    [["platform_legacy_single_organization","platform_legacy_single_workspace"]]);
  if(indexes.rows.length !== 2) throw new Error("Physical single-org/workspace SQL gate missing");

  const contexts = await client.query(
    "SELECT o.id AS organization_id,w.id AS workspace_id FROM platform_organizations o " +
    "JOIN platform_workspaces w ON w.tenant_id=o.tenant_id AND w.organization_id=o.id " +
    "WHERE o.tenant_id=$1::uuid AND o.is_default AND w.is_default " +
    "AND o.status='active' AND w.status='active'",[tenantId]);
  if(contexts.rows.length !== 1) throw new Error("Exactly one active default org/workspace required");
  const {organization_id:orgId,workspace_id:wsId} = contexts.rows[0];

  const active = await client.query(
    "SELECT (SELECT count(*)::integer FROM platform_organizations WHERE tenant_id=$1::uuid AND status='active') AS organizations," +
    "(SELECT count(*)::integer FROM platform_workspaces WHERE tenant_id=$1::uuid AND status='active') AS workspaces",[tenantId]);
  if(active.rows[0].organizations !== 1 || active.rows[0].workspaces !== 1)
    throw new Error("Multiple active contexts forbidden before product gate");

  const admin = await client.query(
    "SELECT EXISTS(SELECT 1 FROM platform_org_memberships om " +
    "JOIN platform_workspace_memberships wm ON wm.tenant_id=om.tenant_id " +
    "AND wm.organization_id=om.organization_id AND wm.principal_id=om.principal_id " +
    "WHERE om.tenant_id=$1::uuid AND om.organization_id=$2::uuid AND wm.workspace_id=$3::uuid " +
    "AND om.principal_id=$4 AND om.role='admin' AND wm.role='admin' " +
    "AND om.state='active' AND wm.state='active') AS authorized",[tenantId,orgId,wsId,actorId]);
  if(admin.rows[0]?.authorized !== true)
    throw new Error("Active default organization/workspace admin membership missing");

  const backfill = await client.query(
    "SELECT EXISTS(SELECT 1 FROM platform_legacy_backfill_runs WHERE tenant_id=$1::uuid AND organization_id=$2::uuid) AS completed",
    [tenantId,orgId]);
  if(backfill.rows[0]?.completed !== true) throw new Error("Audited legacy backfill missing");

  // Identifiers below are hard-coded, not interpolated from input.
  const ownershipChecks = [
    ["crm_people","platform_organization_id"],
    ["crm_organizations","platform_organization_id"],
    ["crm_tags","platform_organization_id"],
    ["whatsapp_accounts","platform_organization_id"],
  ];
  for(const [table,column] of ownershipChecks){
    const check = await client.query(
      "SELECT count(*)::integer AS invalid FROM " + table +
      " WHERE tenant_id=$1::uuid AND " + column + " IS DISTINCT FROM $2::uuid",
      [tenantId,orgId]);
    if(check.rows[0].invalid !== 0) throw new Error("Unbound or mismatched owner in " + table);
  }
  const inbox = await client.query(
    "SELECT count(*)::integer AS invalid FROM inbox_conversations WHERE tenant_id=$1::uuid " +
    "AND (platform_organization_id IS DISTINCT FROM $2::uuid " +
    "OR platform_origin_workspace_id IS DISTINCT FROM $3::uuid " +
    "OR platform_current_workspace_id IS DISTINCT FROM $3::uuid)",[tenantId,orgId,wsId]);
  if(inbox.rows[0].invalid !== 0)
    throw new Error("Unbound or mismatched inbox organization/workspace");
  await client.query("COMMIT");
  console.log("PASS: tenant ready for single-context organization-scoped runtime");
} catch(error) {
  failed = true;
  console.error("DENY: Organization cutover not ready (" +
    (error instanceof Error ? error.message : "unknown error") + ")");
  if(client) await client.query("ROLLBACK").catch(() => undefined);
} finally {
  client?.release();
  await pool.end();
}
if(failed) process.exitCode = 1;
