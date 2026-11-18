import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";

const lab=readFileSync("tests/platform/keycloak-organizations-authz-ci.mjs","utf8");
const entry=readFileSync("tests/platform/platform-manager-keycloak-ci.mjs","utf8");
const adapter=readFileSync("apps/core-host/src/keycloak-authorization-pilot.ts","utf8");

test("IAM-03 disposable lab integrated only with existing real Keycloak CI test",()=>{
  assert.ok(entry.includes('import {runIam03Lab} from "./keycloak-organizations-authz-ci.mjs";'));
  assert.ok(entry.includes("await runIam03Lab({base,adminToken,managerToken:adminAccess});"));
  assert.ok(lab.includes('assert.equal(process.env.CI_MASTER_REAL_PG,"1"'));
  assert.ok(lab.includes('assert.equal(base,"http://127.0.0.1:18088"'));
  assert.ok(!lab.includes('"/admin/realms/syndes/"'));
  assert.ok(lab.includes('const LAB_REALM="syndes-iam-lab-ci"'));
  assert.ok(lab.includes("organizationsEnabled:true"));
  assert.ok(lab.includes('IAM03_REAL_DISPOSABLE_KEYCLOAK_PASS'));
  assert.ok(!lab.includes("docker run"));
  assert.ok(!lab.includes("ssh"));
});

test("Keycloak UMA permission must use resource and scope immutable IDs",()=>{
  assert.ok(adapter.includes('permission: mapped.id + "#" + mapped.scopeName'));
  assert.ok(adapter.includes("mapped.name !== name"));
  assert.ok(adapter.includes("mapped.scopeName !== input.capability"));
  assert.ok(!adapter.includes('permission: name + "#" + input.capability'));
  assert.ok(lab.includes('permission:id+"#"+cap'));
  assert.ok(lab.includes('response_mode:"decision"'));
  assert.ok(lab.includes('const combined=await membership(orgs.a,alice)&&umaAfterOrgRevocation'));
  assert.ok(lab.includes("assert.equal(combined,false"));
});

test("IAM-03 Node 22 real lab source passes syntax validation",()=>{
  execFileSync("node",["--check","tests/platform/keycloak-organizations-authz-ci.mjs"]);
  execFileSync("node",["--check","tests/platform/platform-manager-keycloak-ci.mjs"]);
});

test("IAM-06B is attached only to existing disposable Keycloak and PG17/OpenFGA fixture",()=>{
  const composite=readFileSync("tests/platform/iam06b-composite-ci.mjs","utf8");
  const workflow=readFileSync(".github/workflows/platform-manager.yml","utf8");
  assert.ok(lab.includes('await runIam06bLab({'));
  assert.ok(composite.includes('CI_MASTER_REAL_PG,"1"'));
  assert.ok(composite.includes('IAM06B_DISPOSABLE_ONLY'));
  assert.ok(composite.includes('127.0.0.1:15432'));
  assert.ok(composite.includes('127.0.0.1:18089'));
  assert.ok(composite.includes("002_legacy_single_context_gate.sql"));
  assert.ok(composite.includes("KeycloakOrganizationMembershipReader"));
  assert.ok(composite.includes("FgaPermission"));
  assert.ok(composite.includes("ActorVerifier"));
  assert.ok(!composite.includes("docker run"));
  assert.ok(workflow.includes("syndes-iam06b-fga-ci"));
  assert.ok(workflow.includes("SYNDES_IAM06B_REAL"));
  execFileSync("node",["--check","tests/platform/iam06b-composite-ci.mjs"]);
});


test("IAM-07A live SSE uses only the established disposable real-identity job",()=>{
 const live=readFileSync("tests/platform/iam07-sse-live-ci.mjs","utf8");
 const combined=readFileSync("tests/platform/iam06b-composite-ci.mjs","utf8");
 const pilot=readFileSync("apps/core-host/src/iam07-sse-session-pilot.ts","utf8");
 const realtime=readFileSync("modules/inbox/src/realtime.ts","utf8");
 assert.ok(combined.includes('await runIam07SseLiveLab({'));
 assert.ok(live.includes('CI_MASTER_REAL_PG,"1"'));
 assert.ok(live.includes('IAM06B_DISPOSABLE_ONLY'));
 assert.ok(live.includes('InboxChangeBus'));
 assert.ok(live.includes('IAM07_REAL_SSE_FGA_SQL_MODULE_LINK_ORG_REVOCATION_PASS'));
 assert.ok(live.includes('IAM07_REAL_SSE_CROSS_SCOPE_AND_PROVIDER_FAILURE_DENY_PASS'));
 assert.ok(live.includes('IAM07_REAL_CI_REVALIDATION_P95_MS'));
 assert.ok(!live.includes("docker run"));
 assert.ok(!live.includes('"/admin/realms/syndes/"'));
 assert.ok(pilot.includes("this.admission.resolve(bearer,fixed)"));
 assert.ok(pilot.includes("this.fga.canAccess"));
 assert.ok(!pilot.includes("main.ts\""));
 assert.ok(realtime.includes("An in-progress periodic or prior publish check"));
 assert.ok(realtime.includes("Coalesce bursts per stream"));
 execFileSync("node",["--check","tests/platform/iam07-sse-live-ci.mjs"]);
});
