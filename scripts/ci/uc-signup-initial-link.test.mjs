import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";

test("initial signup link only for enrolled founder in provisioned tenant",async()=>{
 const [migration,fixture,ci,runner,workflow]=await Promise.all([
  readFile("infra/postgres/bootstrap/control-signup-initial-link-candidate.schema","utf8"),
  readFile("tests/platform/signup-initial-link-pg17.sql","utf8"),
  readFile("scripts/ci/multiorg-stage-control-pg17.sh","utf8"),
  readFile("scripts/deploy/devserver01-first-signup-control.sh","utf8"),
  readFile(".github/workflows/syndes-ci.yml","utf8"),
 ]);
 assert.match(migration,/Initial founder enrollment missing or ambiguous/);
 assert.match(migration,/i\.keycloak_organization_id,t\.state AS tenant_state/);
 assert.match(migration,/Immutable signup link\/audit replay conflict/);
 assert.match(migration,/v_intent\.state='ready'/);
 assert.match(migration,/syndes_signup_link_operator NOLOGIN/);
 assert.match(migration,/SECURITY DEFINER SET search_path=pg_catalog/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.platform_signup_bind_initial_keycloak_org/);
 assert.doesNotMatch(migration,/UPDATE public\.tenant_registry SET state='active'|GRANT EXECUTE.*syndes_core/);
 assert.match(fixture,/SET ROLE syndes_signup_link_operator/);
 assert.match(fixture,/SET ROLE syndes_signup_finalize_operator/);
 assert.match(fixture,/platform_signup_finalize/);
 assert.match(fixture,/Generic IAM accepted PROVISIONED tenant/);
 assert.match(fixture,/Wrong founder accepted/);
 assert.match(fixture,/Wrong KC Org replay accepted/);
 assert.match(ci,/UC_SIGNUP01C_PG17_INITIAL_KEYCLOAK_LINK_PROVISIONED_TO_READY_PASS/);
 assert.match(runner,/syndes_staging_control/);
 assert.match(runner,/syndes_control/);
 assert.match(runner,/CI_APPROVED_FIRST_SIGNUP/);
 assert.match(runner,/sha256sum --check --status/);
 assert.match(runner,/--single-transaction/);
 assert.match(runner,/PROVISIONED/);
 assert.doesNotMatch(runner,/DROP DATABASE|DROP TABLE|ALTER ROLE.*SUPERUSER|docker compose up|SYNDES_MULTI_ORG_ENABLED/);
 for(const [id,scope] of [
  ["devserver01-first-signup-control-stage","stage"],
  ["devserver01-first-signup-control-production","production"],
 ]) {
  const index=workflow.indexOf("  "+id+":");
  assert.ok(index>0,id);
  const tail=workflow.slice(index+1);
  const boundary=tail.search(/\n  [a-z][a-z0-9-]+:\n/);
  const job=boundary<0?workflow.slice(index):workflow.slice(index,index+1+boundary);
  assert.match(job,/UC-SIGNUP01C-INITIAL-LINK-INSTALL-APPROVED/);
  assert.match(job,/github\.event_name == 'push'/);
  assert.match(job,/github\.ref == 'refs\/heads\/main'/);
  assert.match(job,/git ls-remote origin refs\/heads\/main/);
  assert.match(job,/devserver01-first-signup-control\.sh/);
  assert.match(job,/SYNDES_SIGNUP_LINK_RELEASE=CI_APPROVED_FIRST_SIGNUP/);
  assert.match(job,/PRODUCTION_GATE=BLOCKED/);
  if(scope==="production")assert.match(job,/needs: \[gate, devserver01-first-signup-control-stage\]/);
  else assert.match(job,/needs: \[gate\]/);
 }
 for(const path of ["scripts/deploy/devserver01-first-signup-control.sh","scripts/ci/multiorg-stage-control-pg17.sh"]){
  const checked=spawnSync("bash",["-n",path],{encoding:"utf8"});
  assert.equal(checked.status,0,checked.stderr);
 }
});
