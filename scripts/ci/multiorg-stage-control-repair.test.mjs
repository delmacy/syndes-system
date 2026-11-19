import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
const script="scripts/deploy/devserver01-multiorg-stage-control-repair.sh";
test("MO-REL-04 stage Control DB repair is one-shot and cannot mutate operational SQL",async()=>{
 const [shell,ci]=await Promise.all([readFile(script,"utf8"),
  readFile(".github/workflows/syndes-ci.yml","utf8")]);
 const start=ci.indexOf("  devserver01-multiorg-control-db-repair:");
 assert.ok(start>0);
 const job=ci.slice(start);
 assert.match(job,/needs: \[gate\]/);
 assert.match(job,/github\.event_name == 'push'/);
 assert.match(job,/MO-REL04-STAGING-CONTROL-REPAIR-APPROVED/);
 assert.match(job,/environment: devserver01/);
 assert.match(job,/SYNDES_STAGE_CONTROL_REPAIR=CI_APPROVED_MO_REL04/);
 assert.match(job,/gh issue comment 208/);
 assert.match(job,/PRODUCTION_GATE=BLOCKED/);
 assert.match(shell,/label=com.docker.compose.project=\$project/);
 assert.match(shell,/label=syndes.environment=multi-org-staging/);
 assert.match(shell,/label=syndes.component=control-postgres/);
 assert.match(shell,/CREATE DATABASE syndes_staging_control/);
 assert.doesNotMatch(shell,/DROP DATABASE|CREATE ROLE|ALTER ROLE|\bDELETE FROM\b|\bUPDATE\s+|\bTRUNCATE\b|\bdocker\s+(?:run|stop|rm|compose)/i);
 assert.equal(spawnSync("bash",["-n",script],{encoding:"utf8"}).status,0);
});
test("MO-REL-04 stage DB repair only creates missing Control when KC DB and role exist, replay safe",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"syndes-stage-pg-repair-"));
 try{
  const state=join(dir,"catalog"),writes=join(dir,"writes");
  await writeFile(state,"1:0:1");
  for(const [name,content] of Object.entries({
   id:"#!/bin/sh\nprintf 'delmacy\\n'",
   hostname:"#!/bin/sh\nprintf 'DevServer01\\n'",
   docker:`#!/bin/sh
case "$1" in
 ps)
  case "$*" in
   *"com.docker.compose.project=syndes-multiorg-staging"*"syndes.environment=multi-org-staging"*"syndes.component=control-postgres"*) printf 'isolated-pg-id\\n';;
   *) exit 9;;
  esac;;
 inspect) printf 'true\\n';;
 exec)
  case "$*" in
   *"CREATE DATABASE syndes_staging_control"*)
      printf 'CREATE\\n' >> "$SYNDES_TEST_WRITES"
      printf '1:1:1' > "$SYNDES_TEST_STATE";;
   *"SELECT"*"pg_database"*) cat "$SYNDES_TEST_STATE";;
   *) exit 8;;
  esac;;
 *) exit 7;;
esac`,
  })){
   await writeFile(join(dir,name),content,{mode:0o755});
  }
  const env={...process.env,PATH:dir+":"+process.env.PATH,
   SYNDES_TEST_STATE:state,SYNDES_TEST_WRITES:writes,
   SYNDES_STAGE_CONTROL_REPAIR:"CI_APPROVED_MO_REL04"};
  const run=(mode="repair",vars=env)=>spawnSync("bash",[script,mode],{env:vars,encoding:"utf8"});
  assert.notEqual(run("apply").status,0);
  assert.notEqual(run("repair",{...env,SYNDES_STAGE_CONTROL_REPAIR:""}).status,0);
  const first=run();
  assert.equal(first.status,0,first.stdout+" "+first.stderr);
  assert.match(first.stdout,/MO_REL04_STAGING_CONTROL_DB_CREATED/);
  assert.match(first.stdout,/MO_REL04_STAGING_CONTROL_DB_CATALOG_PASS/);
  assert.equal((await readFile(writes,"utf8")).trim(),"CREATE");
  const replay=run();
  assert.equal(replay.status,0,replay.stderr);
  assert.match(replay.stdout,/MO_REL04_STAGING_CONTROL_DB_ALREADY_PRESENT/);
  assert.equal((await readFile(writes,"utf8")).trim(),"CREATE");
  await writeFile(state,"0:0:0");
  const unsafe=run();
  assert.notEqual(unsafe.status,0);
  assert.match(unsafe.stdout,/MO_REL04_STAGING_CONTROL_REPAIR_DENY=catalog_state_0:0:0/);
  assert.equal((await readFile(writes,"utf8")).trim(),"CREATE");
 }finally{await rm(dir,{recursive:true,force:true})}
});
