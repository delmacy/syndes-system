import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
test("MO-REL-04 persisted OpenFGA test store is only created by gated stage runner",async()=>{
 const [script,ci]=await Promise.all([
  readFile("scripts/deploy/devserver01-multiorg-stage-fga-persistence-proof.sh","utf8"),
  readFile(".github/workflows/syndes-ci.yml","utf8")
 ]);
 assert.equal(spawnSync("bash",["-n","scripts/deploy/devserver01-multiorg-stage-fga-persistence-proof.sh"]).status,0);
 for(const marker of ["SYNDES_STAGE_FGA_RESTART_APPROVED","syndes-multiorg-staging","syndes_staging_openfga","post_deploy","config_hash"]){
  if(marker!=="post_deploy") assert.match(script,new RegExp(marker));
 }
 assert.ok(script.includes("--force-recreate --no-deps --wait openfga </dev/null"));
 assert.match(script,/store_not_persisted/);
 assert.doesNotMatch(script,/DROP DATABASE|docker system prune|rm -rf|activate_multiple_organizations/);
 assert.match(ci,/devserver01-multiorg-fga-restart-proof:/);
 assert.match(ci,/MO-REL04-FGA-RESTART-PROOF-APPROVED/);
 assert.match(ci,/needs: \[gate\]/);
});
test("MO-REL-04 persisted OpenFGA runner rejects unapproved execution before Docker",()=>{
 const res=spawnSync("bash",["scripts/deploy/devserver01-multiorg-stage-fga-persistence-proof.sh","prove"],{
  encoding:"utf8",env:{...process.env,SYNDES_STAGE_FGA_RESTART_APPROVED:"not-approved"}});
 assert.notEqual(res.status,0);
 assert.doesNotMatch(res.stdout,/PASS/);
});
