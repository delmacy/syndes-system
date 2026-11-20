import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";

test("stage Control operator runs only on exact staging host and verified persistent FGA",async()=>{
 const [runner,smoke,ci]=await Promise.all([
  readFile("scripts/deploy/devserver01-multiorg-stage-control-bootstrap.sh","utf8"),
  readFile("scripts/ci/multiorg-stage-control-pg17.sh","utf8"),
  readFile(".github/workflows/syndes-ci.yml","utf8")
 ]);
 assert.match(runner,/CI_APPROVED_MO_REL04/);
 assert.match(runner,/DevServer01/);
 assert.match(runner,/syndes-multiorg-staging/);
 assert.match(runner,/--single-transaction/);
 assert.match(runner,/sha256sum --check --status/);
 assert.match(runner,/MO_REL04_CONTROL_BLOCKED=partial_schema/);
 assert.match(runner,/NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE/);
 assert.match(runner,/MO_REL04_CONTROL_STAGE_INITIAL_SCHEMAS_TRANSACTIONAL_PASS_NOT_CORE_E2E/);
 assert.doesNotMatch(runner,/docker compose up|docker restart|DROP DATABASE|DROP TABLE|pg_restore|\bSYNDES_PRODUCTION\b/);
 assert.match(smoke,/--network none/);
 assert.match(smoke,/MO_REL04_STAGE_CONTROL_PG17_TRANSACTION_REPLAY_PASS/);
 assert.match(ci,/devserver01-multiorg-stage-control-bootstrap:/);
 assert.match(ci,/MO-REL04-STAGE-CONTROL-BOOTSTRAP-APPROVED/);
 assert.match(ci,/needs: \[gate\]/);
 for(const path of ["scripts/deploy/devserver01-multiorg-stage-control-bootstrap.sh","scripts/ci/multiorg-stage-control-pg17.sh"]){
   const r=spawnSync("bash",["-n",path],{encoding:"utf8"});
   assert.equal(r.status,0,r.stderr);
 }
});
