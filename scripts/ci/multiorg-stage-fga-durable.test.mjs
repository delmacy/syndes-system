import test from "node:test";
import assert from "node:assert/strict";
import {readFile,mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
const installer="scripts/deploy/devserver01-multiorg-stage-fga-durable.sh";
test("MO-REL-04 durable FGA installer is stage-only and safeguards in-memory stores",async()=>{
 const [script,compose,ci]=await Promise.all([
  readFile(installer,"utf8"),
  readFile("infra/multiorg-staging/compose.yaml","utf8"),
  readFile(".github/workflows/syndes-ci.yml","utf8")
 ]);
 assert.equal(spawnSync("bash",["-n",installer],{encoding:"utf8"}).status,0);
 assert.match(script,/syndes-multiorg-staging/);
 assert.match(script,/nonempty_memory_store/);
 assert.match(script,/partial_pg_catalog/);
 assert.match(script,/SYNDES_STAGE_FGA_COMPOSE_SHA256/);
 assert.match(script,/docker compose --project-name/);
 assert.match(script,/up -d --force-recreate --no-deps --wait openfga/);
 assert.match(script,/post_deploy_config_hash/);
 assert.match(script,/post_deploy_config_mount/);
 assert.match(script,/post_deploy_schema/);
 assert.ok(script.includes("run -T --rm --no-deps openfga-migrate </dev/null"));
 assert.ok(script.includes("up -d --force-recreate --no-deps --wait openfga </dev/null"));
 assert.match(ci,/missing_post_deploy_attestation/);
 assert.match(ci,/MO-REL04-FGA-STDIN-GUARD-APPROVED/);
 assert.doesNotMatch(script,/DROP DATABASE|docker system prune|rm -rf|activate_multiple_organizations/);
 assert.match(compose,/openfga-migrate:/);
 assert.match(compose,/staging_openfga_config/);
 assert.doesNotMatch(compose,/datastore-engine", "memory"/);
 assert.match(ci,/devserver01-multiorg-durable-openfga:/);
 assert.match(ci,/MO-REL04-FGA-PERSISTENCE-APPROVED/);
 assert.match(ci,/needs: \[gate\]/);
 assert.match(ci,/issues: write/);
});
test("MO-REL-04 refuses remote preflight without CI marker and never accesses Docker",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"syndes-fga-gate-"));
 try {
   await writeFile(join(dir,"docker"),"#!/bin/sh\necho UNSAFE_DOCKER_CALL\nexit 99\n",{mode:0o755});
   const res=spawnSync("bash",[installer,"preflight"],{encoding:"utf8",
    env:{...process.env,PATH:dir+":"+process.env.PATH,SYNDES_STAGE_FGA_DURABLE_APPROVAL:"not-approved"}});
   assert.notEqual(res.status,0);
   assert.doesNotMatch(res.stdout+res.stderr,/UNSAFE_DOCKER_CALL/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
