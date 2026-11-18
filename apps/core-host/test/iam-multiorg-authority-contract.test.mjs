/**
 * IAM authority and hierarchy regression contract.
 * These tests prove that reviewed SQL and guard contracts have not drifted;
 * they do NOT claim a PostgreSQL/Keycloak multi-org operational cutover.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const root=new URL("../../../",import.meta.url);
const source=async path=>readFile(new URL(path,root),"utf8");

test("tenant is one DB but organization and workspace cardinalities are not hardcoded into foundation",async()=>{
 const hierarchy=await source("modules/organizations/sql/001_account_hierarchy.sql");
 assert.match(hierarchy,/CREATE TABLE IF NOT EXISTS platform_organizations\s*\(/);
 assert.match(hierarchy,/PRIMARY KEY\(tenant_id,id\)/);
 assert.match(hierarchy,/CREATE TABLE IF NOT EXISTS platform_workspaces\s*\(/);
 assert.match(hierarchy,/UNIQUE\(tenant_id,organization_id,id\)/);
 assert.match(hierarchy,/REFERENCES platform_organizations\(tenant_id,id\)/);
 assert.match(hierarchy,/CREATE TABLE IF NOT EXISTS platform_workspace_memberships/);
 assert.match(hierarchy,/REFERENCES platform_org_memberships\(tenant_id,organization_id,principal_id\)/);
 assert.doesNotMatch(hierarchy,/platform_legacy_single_(organization|workspace)/,
  "Only SQL002 may impose the physical legacy one-context barrier");
});

test("workspace owns multiple independent funnels and every stage/attendance is scoped",async()=>{
 const sql=await source("modules/service-management/sql/001_service_funnels.sql");
 assert.match(sql,/CREATE TABLE IF NOT EXISTS service\.service_funnels/);
 assert.match(sql,/PRIMARY KEY\(tenant_id,organization_id,workspace_id,id\)/);
 assert.match(sql,/UNIQUE\(tenant_id,organization_id,workspace_id,code\)/);
 assert.match(sql,/REFERENCES public\.platform_workspaces\(tenant_id,organization_id,id\)/);
 assert.match(sql,/REFERENCES service\.service_funnels\(tenant_id,organization_id,workspace_id,id\)/);
 assert.match(sql,/REFERENCES service\.service_funnel_stages\(tenant_id,organization_id,workspace_id,funnel_id,id\)/);
});

test("legacy physical gate remains installed until explicit, reviewed multi-org cutover",async()=>{
 const gate=await source("modules/organizations/sql/002_legacy_single_context_gate.sql");
 assert.match(gate,/CREATE UNIQUE INDEX IF NOT EXISTS platform_legacy_single_organization\s+ON platform_organizations\(tenant_id\)/);
 assert.match(gate,/CREATE UNIQUE INDEX IF NOT EXISTS platform_legacy_single_workspace\s+ON platform_workspaces\(tenant_id\)/);
 const resolver=await source("packages/core-kernel/src/operational-scope.ts");
 for(const name of ["platform_legacy_single_organization","platform_legacy_single_workspace"])
  assert.ok(resolver.includes(name),`Missing hard denial for ${name}`);
 assert.match(resolver,/\$5::boolean/);
 assert.match(resolver,/om\.principal_id=\$2 AND om\.state='active'/);
 assert.match(resolver,/wm\.principal_id=\$2 AND wm\.state='active'/);
 assert.match(resolver,/o\.id=\$3::uuid AND w\.id=\$4::uuid/);
 const fence=await source("modules/organizations/sql/008_iam07d_revoke_first_candidate.sql");
 assert.match(fence,/IAM07D requires active single-context barrier/);
});

test("Keycloak remains verified identity and live organization source; FGA stays exact resource grant",async()=>{
 const admission=await source("apps/core-host/src/iam-organization-context-pilot.ts");
 assert.match(admission,/verifier\.verifyClient\(bearer,this\.deps\.clientId\)/);
 assert.match(admission,/keycloakMembers\.isActiveMember\(/);
 assert.match(admission,/links\.findPlatform\(tenantId,organizationId\)/);
 assert.match(admission,/links\.findKeycloak\(/);
 assert.match(admission,/resolveSelectedOperationalScope\(/);
 assert.match(admission,/funnelOwnership\.isActiveInWorkspace\(/);
 const fga=await source("apps/core-host/src/iam07d-fine-fga-policy.ts");
 assert.match(fga,/iam_capability:/);
 assert.match(fga,/can_execute/);
 const adr=await source("docs/engineering/ADR-IAM-IDENTITY-AUTHORITY-MULTIORG-20261118.md");
 assert.match(adr,/Keycloak é o único Identity Provider/);
 assert.match(adr,/PRODUCTION_GATE=BLOCKED/);
});
