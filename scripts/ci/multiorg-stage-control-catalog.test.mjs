import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
test("MO-REL-04 module catalog staging migration is isolated, repeatable and post-CI-only",async()=>{
 const [runner,ci,pg17]=await Promise.all([
   readFile("scripts/deploy/devserver01-multiorg-stage-control-catalog.sh","utf8"),
   readFile(".github/workflows/syndes-ci.yml","utf8"),
   readFile("scripts/ci/multiorg-stage-control-pg17.sh","utf8")
 ]);
 assert.match(runner,/CI_APPROVED_MO_REL04/);
 assert.match(runner,/syndes-multiorg-staging/);
 assert.match(runner,/NO_ENTITLEMENT_GRANTS/);
 assert.match(runner,/partial_module_schema/);
 assert.match(runner,/--single-transaction/);
 assert.match(runner,/sha256sum --check --status/);
 assert.doesNotMatch(runner,/DROP DATABASE|docker restart|docker compose up|GRANT ALL|ALTER ROLE syndes_core.*LOGIN/);
 assert.match(ci,/devserver01-multiorg-stage-control-catalog:/);
 assert.match(ci,/MO-REL04-STAGE-CONTROL-CATALOG-APPROVED/);
 assert.match(ci,/needs: \[gate\]/);
 assert.match(pg17,/MO_REL04_STAGE_CONTROL_CATALOG_PG17_TRANSACTION_REPLAY_PASS/);
 for(const path of ["scripts/deploy/devserver01-multiorg-stage-control-catalog.sh","scripts/ci/multiorg-stage-control-pg17.sh"]){
  const r=spawnSync("bash",["-n",path],{encoding:"utf8"});
  assert.equal(r.status,0,r.stderr);
 }
});
