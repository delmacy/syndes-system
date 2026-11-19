import test from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
const runner="scripts/deploy/devserver01-multiorg-stage-pg-bootstrap-recovery.sh";
test("MO-REL-04 bootstrap verifies pinned script, exact empty stage catalog and one-shot main gate",async()=>{
 const [shell,workflow]=await Promise.all([
  readFile(runner,"utf8"),readFile(".github/workflows/syndes-ci.yml","utf8"),
 ]);
 assert.match(shell,/label=com.docker.compose.project=\$project/);
 assert.match(shell,/label=syndes.environment=multi-org-staging/);
 assert.match(shell,/label=syndes.component=control-postgres/);
 assert.match(shell,/SYNDES_STAGE_INIT_SHA256/);
 assert.match(shell,/^\s*'0:0:0:0'\)/m);
 assert.match(shell,/^\s*'1:1:1:2'\)/m);
 assert.match(shell,/10-staging-databases\.sh/);
 assert.doesNotMatch(shell,/DROP DATABASE|DROP ROLE|ALTER ROLE|CREATE DATABASE|docker\s+(?:run|rm|stop|compose)/i);
 const i=workflow.indexOf("  devserver01-multiorg-empty-stage-pg-bootstrap:");
 assert.ok(i>0);
 const job=workflow.slice(i);
 assert.match(job,/needs: \[gate\]/);
 assert.match(job,/MO-REL04-EMPTY-STAGE-PG-BOOTSTRAP-APPROVED/);
 assert.match(job,/environment: devserver01/);
 assert.match(job,/github\.event_name == 'push'/);
 assert.match(job,/git ls-remote origin refs\/heads\/main/);
 assert.match(job,/SYNDES_STAGE_PG_BOOTSTRAP=CI_APPROVED_MO_REL04/);
 assert.match(job,/multiorg-staging-services-smoke\.sh/);
 assert.match(job,/gh issue comment 208/);
 assert.match(job,/PRODUCTION_GATE=BLOCKED/);
 assert.equal(spawnSync("bash",["-n",runner],{encoding:"utf8"}).status,0);
});
test("MO-REL-04 empty staging catalog bootstrap is idempotent and refuses every partial catalog",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"syndes-stage-empty-bootstrap-"));
 const checksum="a".repeat(64);
 try{
  const state=join(dir,"state"),writes=join(dir,"writes");
  await writeFile(state,"0:0:0:0");
  for(const [name,body] of Object.entries({
   id:"#!/bin/sh\nprintf 'delmacy\\n'",
   hostname:"#!/bin/sh\nprintf 'DevServer01\\n'",
   docker:`#!/bin/sh
case "$1" in
 ps)
  case "$*" in
   *"com.docker.compose.project=syndes-multiorg-staging"*"syndes.environment=multi-org-staging"*"syndes.component=control-postgres"*) printf 'stage-pg-id\\n';;
   *) exit 8;;
  esac;;
 inspect) printf 'true\\n';;
 exec)
  case "$*" in
   *"sha256sum"*) printf '${checksum}  /docker-entrypoint-initdb.d/10-staging-databases.sh\\n';;
   *"bash /docker-entrypoint-initdb.d/10-staging-databases.sh"*)
     printf 'BOOTSTRAP\\n' >> "$SYNDES_TEST_WRITES"
     printf '1:1:1:2' > "$SYNDES_TEST_STATE";;
   *"SELECT"*"pg_database"*) cat "$SYNDES_TEST_STATE";;
   *) exit 8;;
  esac;;
 *) exit 9;;
esac`,
  })){await writeFile(join(dir,name),body,{mode:0o755})}
  const env={...process.env,PATH:dir+":"+process.env.PATH,
   SYNDES_TEST_STATE:state,SYNDES_TEST_WRITES:writes,
   SYNDES_STAGE_PG_BOOTSTRAP:"CI_APPROVED_MO_REL04",
   SYNDES_STAGE_INIT_SHA256:checksum};
  const call=(mode="bootstrap",vars=env)=>spawnSync("bash",[runner,mode],{env:vars,encoding:"utf8"});
  assert.notEqual(call("apply").status,0);
  assert.notEqual(call("bootstrap",{...env,SYNDES_STAGE_PG_BOOTSTRAP:""}).status,0);
  const first=call();
  assert.equal(first.status,0,first.stdout+" "+first.stderr);
  assert.match(first.stdout,/MO_REL04_STAGE_PG_BOOTSTRAP_RECOVERED_EMPTY_STAGE/);
  assert.match(first.stdout,/MO_REL04_STAGE_PG_BOOTSTRAP_CATALOG_VERIFIED/);
  const again=call();
  assert.equal(again.status,0,again.stdout+" "+again.stderr);
  assert.match(again.stdout,/MO_REL04_STAGE_PG_BOOTSTRAP_ALREADY_COMPLETE/);
  assert.equal((await readFile(writes,"utf8")).trim(),"BOOTSTRAP");
  await writeFile(state,"1:0:1:1");
  assert.notEqual(call().status,0);
  assert.equal((await readFile(writes,"utf8")).trim(),"BOOTSTRAP");
  await writeFile(state,"0:0:0:0");
  assert.notEqual(call("bootstrap",{...env,SYNDES_STAGE_INIT_SHA256:"b".repeat(64)}).status,0);
  assert.equal((await readFile(writes,"utf8")).trim(),"BOOTSTRAP");
 }finally{await rm(dir,{recursive:true,force:true})}
});
