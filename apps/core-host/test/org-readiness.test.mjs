import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const script=fileURLToPath(new URL("../scripts/verify-org-readiness.mjs",import.meta.url));

test("organization cutover refuses missing canonical DB/tenant/admin context",()=>{
 const result=spawnSync(process.execPath,[script],{
  encoding:"utf8",timeout:5000,
  env:{...process.env,
   SYNDES_ORG_READINESS_PG_URL:"",
   SYNDES_ORG_READINESS_TENANT_ID:"",
   SYNDES_ORG_READINESS_ACTOR_ID:""},
 });
 assert.equal(result.status,2);
 assert.match(result.stderr,/DENY: canonical tenant/);
 assert.doesNotMatch(result.stdout,/PASS:/);
});

test("preflight uses a read-only transaction and preserves SQL 002 lock",()=>{
 const content=readFileSync(script,"utf8");
 for(const contract of [
  "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  "platform_legacy_single_organization",
  "platform_legacy_single_workspace",
  "platform_legacy_backfill_runs",
  "platform_organizations",
  "platform_workspaces",
  "platform_org_memberships",
  "platform_workspace_memberships",
 ])assert.ok(content.includes(contract),contract);
});
