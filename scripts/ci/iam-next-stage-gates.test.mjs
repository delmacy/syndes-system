import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {selectSuites} from "./plan.mjs";

/**
 * Do NOT turn an IAM-07B pre-implementation test into an operational release
 * approval. The gate is for the NEXT ENGINEERING IMPLEMENTATION only.
 */
const read=path=>readFileSync(path,"utf8");

test("IAM07B next-stage code/tests select the full existing centralized CI and real-identity job",()=>{
 const host=selectSuites(["apps/core-host/test/iam07b-jwt-expiry-sse.test.mjs"])
  .map(x=>x.suite);
 const platform=selectSuites(["tests/platform/iam07b-provider-recovery-ci.mjs"])
  .map(x=>x.suite);
 for(const suites of [host,platform]){
  for(const required of ["host","inbox","organizations","service-management","infra"]){
   assert.ok(suites.includes(required),required+" must run for IAM07B impact");
  }
 }
 const suiteRunner=read("scripts/ci/run-suite.sh");
 assert.ok(suiteRunner.includes('IAM09_SYNTHETIC_PG17_CONTROL_TENANT_RESTORE_DRILL_PASS'));
 assert.ok(suiteRunner.includes('disposable_restore_drill.py'));
 assert.ok(suiteRunner.includes('--disposable --ack-synthetic --json'));
 assert.ok(suiteRunner.includes('archive_sha256_verified'));
 assert.ok(suiteRunner.includes('restored_control_acl_closed'));
 assert.ok(suiteRunner.includes('restored_replay_idempotent'));
 const workflow=read(".github/workflows/syndes-ci.yml");
 const integrated=read("tests/platform/iam06b-composite-ci.mjs");
 const real=read("tests/platform/iam07b-provider-recovery-ci.mjs");
 assert.match(workflow,/platform-manager-parity:/);
 assert.match(workflow,/Syndes CI Gate/);
 assert.ok(integrated.includes("await runIam07bProviderRecoveryLab({"));
 assert.ok(real.includes("CI_MASTER_REAL_PG"));
 assert.ok(real.includes("IAM06B_DISPOSABLE_ONLY"));
 assert.ok(real.includes("IAM07B_REAL_KEYCLOAK_CONTROL_TENANT_FGA_TRANSPORT_FAULT_RECOVERY_PASS"));
 assert.ok(!real.includes("docker run"));
 assert.ok(!real.includes("ssh "));
 execFileSync("node",["--check","tests/platform/iam07b-provider-recovery-ci.mjs"]);
 execFileSync("node",["--check","tests/platform/iam06b-composite-ci.mjs"]);
});

test("IAM09 production remains deny-by-default until distinct operational gates",()=>{
 const host=read("apps/core-host/src/main.ts");
 const moduleSelection=JSON.parse(read("apps/core-host/config/modules.json"));
 const hierarchy=read("modules/organizations/sql/002_legacy_single_context_gate.sql");
 const stage=read("docs/engineering/IAM-07B-09-NEXT-STAGE-GATE-20261118.md");
 assert.equal(host.includes("iam07-sse-session-pilot"),false,
  "IAM 07 remains isolated; approval of test does NOT activate production");
 assert.equal(host.includes("iam06-shadow-compare-pilot"),false);
 assert.equal(JSON.stringify(moduleSelection).includes('"service"'),false,
  "Service release still needs restore, ModuleAccess and authorization gates");
 assert.ok(hierarchy.includes("platform_legacy_single_organization"));
 assert.ok(hierarchy.includes("platform_legacy_single_workspace"));
 assert.ok(stage.includes("PRODUCTION_GATE=BLOCKED"));
 assert.ok(stage.includes("NEXT_IMPLEMENTATION_GATE=ELIGIBLE_ON_GREEN_CI"));
});

test("IAM07D revoke-first PG17 fence remains opt-in and requires exact capabilities",()=>{
 const main=read("apps/core-host/src/main.ts");
 const fence=read("apps/core-host/src/iam07d-revoke-first-pilot.ts");
 const tenant=read("modules/organizations/sql/008_iam07d_revoke_first_candidate.sql");
 const control=read("infra/postgres/bootstrap/control-iam07d-revocation-receipts.schema");
 const hostSuite=read("scripts/ci/run-suite.sh");
 const testSource=read("apps/core-host/test/iam07d-revoke-first-pg17.test.mjs");
 assert.equal(main.includes("iam07d-revoke-first-pilot"),false);
 assert.equal(main.includes("iam07c-http-admission-pilot"),false);
 assert.ok(fence.includes("FOR SHARE OF f,w,o,om,wm"));
 assert.ok(fence.includes("this.specific.canPerform(context,requested.capability)"));
 assert.ok(fence.includes("last_revoke_operation_id"));
 assert.ok(!fence.includes('"inbox:assignment"'));
 assert.ok(!fence.includes('"inbox:messages"'));
 assert.ok(tenant.includes("platform_legacy_single_organization"));
 assert.ok(tenant.includes("platform_legacy_single_workspace"));
 assert.ok(control.includes("platform_iam07d_revocation_receipts"));
 assert.ok(hostSuite.includes("node --test test/iam07d-revoke-first-pg17.test.mjs"));
 assert.ok(testSource.includes("IAM07D_PG17_REVOKE_FIRST_EPOCH_LOCK_CONTROL_OUTAGE_REPLAY_PASS"));
 assert.ok(testSource.includes("IAM07D_FINE_CAPABILITY_NO_COARSE_GRANT_FALLBACK_PASS"));
 execFileSync("node",["--check","apps/core-host/test/iam07d-revoke-first-pg17.test.mjs"]);
});
