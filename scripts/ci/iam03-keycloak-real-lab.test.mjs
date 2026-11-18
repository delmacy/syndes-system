import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";

const lab=readFileSync("tests/platform/keycloak-organizations-authz-ci.mjs","utf8");
const entry=readFileSync("tests/platform/platform-manager-keycloak-ci.mjs","utf8");
const adapter=readFileSync("apps/core-host/src/keycloak-authorization-pilot.ts","utf8");

test("IAM-03 disposable lab integrated only with existing real Keycloak CI test",()=>{
  assert.ok(entry.includes('import {runIam03Lab} from "./keycloak-organizations-authz-ci.mjs";'));
  assert.ok(entry.includes("await runIam03Lab({base,adminToken});"));
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
