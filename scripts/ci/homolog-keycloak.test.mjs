import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
const workflow = readFileSync(".github/workflows/syndes-core-host-devserver01.yml","utf8");
const source = readFileSync("scripts/identity/provision-homolog-keycloak.py","utf8");

test("Keycloak homolog identity provisioner passes isolated tests",()=>{
  const r = spawnSync("python3",["scripts/identity/test_provision_homolog_keycloak.py"],{encoding:"utf8"});
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.match(source,/requiredActions.*UPDATE_PASSWORD/);
  assert.match(source,/HOMOLOG_TENANT_MEMBERSHIP_FGA_NOT_PROVISIONED/);
  assert.doesNotMatch(source,/\b(?:pg_dump|psql|CREATE ROLE|INSERT INTO tenant_memberships|docker run)\b/);
});

test("isolated identity is one-shot, after preflight, in the established CD workflow",()=>{
  const job = workflow.split("\n  provision-homolog-identity:\n")[1];
  assert.ok(job,"No identity job in existing CD");
  assert.match(job,/github\.event\.workflow_run\.head_commit\.message/);
  assert.match(job,/github\.event\.workflow_run\.actor\.login == 'delmacy'/);
  assert.match(job,/needs: \[tailnet-preflight\]/);
  assert.match(job,/needs\.tailnet-preflight\.result == 'success'/);
  assert.match(job,/environment: devserver01/);
  assert.match(job,/tailscale\/github-action@v4/);
  assert.match(job,/scripts\/identity\/provision-homolog-keycloak\.py/);
  assert.doesNotMatch(job,/docker (?:build|load|compose|restart|run)/);
});
