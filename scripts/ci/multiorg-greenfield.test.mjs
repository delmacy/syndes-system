import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";

test("greenfield stage provisions a real isolated tenant, never mutates legacy gateway",async()=>{
 const [operator,fixture,ci,workflow,infra]=await Promise.all([
  readFile("scripts/deploy/devserver01-multiorg-greenfield.sh","utf8"),
  readFile("infra/multiorg-staging/greenfield-pilot-seed.sql","utf8"),
  readFile("scripts/ci/multiorg-greenfield-pg17.sh","utf8"),
  readFile(".github/workflows/syndes-ci.yml","utf8"),
  readFile("scripts/ci/run-infra.sh","utf8"),
 ]);
 assert.match(operator,/CI_APPROVED_GREENFIELD_MO/);
 assert.match(operator,/syndes-multiorg-staging/);
 assert.match(operator,/--single-transaction/);
 assert.match(operator,/greenfield-pilot-tenant-db/);
 assert.match(operator,/sha256sum -c MANIFEST\.sha256 --status/);
 assert.match(operator,/partial_tenant_schema/);
 assert.match(operator,/MO_GREENFIELD_REAL_PG17_NEW_TENANT_TWO_ORGS_FOUR_WS_EIGHT_FUNNELS_PASS/);
 assert.match(operator,/PROVISIONED_NOT_KC_FGA_OR_CORE_RELEASED/);
 assert.doesNotMatch(operator,/syndes-postgres-postgres-1|syndes-whatsapp-whatsapp-gateway-1|docker compose (?:up|down)|docker restart|docker rm -f/);
 assert.match(fixture,/platform_organizations/);
 assert.match(fixture,/platform_workspaces/);
 assert.match(fixture,/service\.service_funnels/);
 assert.match(fixture,/WHEN foreign_key_violation/);
 assert.doesNotMatch(fixture,/DROP TABLE|DROP DATABASE|TRUNCATE/);
 assert.match(ci,/--network none/);
 assert.match(ci,/syndes_ci_legacy/);
 assert.match(ci,/syndes_ci_fresh/);
 assert.match(ci,/MO_GREENFIELD_LEGACY_SQL002_UNCHANGED_AND_WHATSAPP_EMPTY_PASS/);
 assert.match(infra,/SYNDES_GREENFIELD_DISPOSABLE=CI_ONLY bash scripts\/ci\/multiorg-greenfield-pg17\.sh/);
 const pos=workflow.indexOf("  devserver01-multiorg-greenfield-pilot:");
 assert.ok(pos>0);
 const next=workflow.slice(pos+1).search(/\n  [a-z][a-z0-9-]+:\n/);
 const job=next<0?workflow.slice(pos):workflow.slice(pos,pos+1+next);
 assert.match(job,/MO-REL04-GREENFIELD-PILOT-APPROVED/);
 assert.match(job,/needs: \[gate\]/);
 assert.match(job,/environment: devserver01/);
 assert.match(job,/github\.event_name == 'push'/);
 assert.match(job,/git ls-remote origin refs\/heads\/main/);
 assert.match(job,/SYNDES_GREENFIELD_PILOT_APPROVAL=CI_APPROVED_GREENFIELD_MO/);
 assert.match(job,/gh issue comment 208/);
 const prod=await readFile("scripts/deploy/devserver01-multiorg-greenfield-production.sh","utf8");
 assert.match(prod,/syndes-postgres/);
 assert.match(prod,/syndes_control/);
 assert.match(prod,/MO_GREENFIELD_PRODUCTION_NEW_TENANT_TWO_ORGS_FOUR_WS_EIGHT_FUNNELS_PASS/);
 assert.match(prod,/syndes-security-access-keycloak-1/);
 assert.match(prod,/syndes-whatsapp-whatsapp-gateway-1/);
 assert.doesNotMatch(prod,/syndes_staging_control|syndes-multiorg-staging|docker (?:stop|restart|compose up)|DROP DATABASE/);
 const prodJob=workflow.indexOf("  devserver01-multiorg-greenfield-production:");
 assert.ok(prodJob>0);
 const prodTail=workflow.slice(prodJob);
 assert.match(prodTail,/needs: \[gate, devserver01-multiorg-greenfield-pilot\]/);
 assert.match(prodTail,/SYNDES_GREENFIELD_PROD_APPROVAL=CI_APPROVED_GREENFIELD_PRODUCTION/);
 assert.match(prodTail,/gh issue comment 211/);

 for(const path of ["scripts/deploy/devserver01-multiorg-greenfield-production.sh","scripts/deploy/devserver01-multiorg-greenfield.sh","scripts/ci/multiorg-greenfield-pg17.sh"]){
  const check=spawnSync("bash",["-n",path],{encoding:"utf8"});
  assert.equal(check.status,0,check.stderr);
 }
});
