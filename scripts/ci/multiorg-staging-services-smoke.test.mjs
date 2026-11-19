import test from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
const script="scripts/ci/multiorg-staging-services-smoke.sh";
test("MO-REL-04 real-stage service verification is main-only post-gate and read-only",async()=>{
 const [workflow,shell]=await Promise.all([
  readFile(".github/workflows/syndes-ci.yml","utf8"),
  readFile(script,"utf8"),
 ]);
 const pos=workflow.indexOf("  devserver01-multiorg-real-services-smoke:");
 assert.ok(pos>0);
 const job=workflow.slice(pos);
 assert.match(job,/needs: \[gate\]/);
 assert.match(job,/github\.event_name == 'push'/);
 assert.match(job,/github\.ref == 'refs\/heads\/main'/);
 assert.match(job,/MO-REL04-REAL-STAGING-SMOKE-APPROVED/);
 assert.match(job,/environment: devserver01/);
 assert.match(job,/gh issue comment 208/);
 assert.match(job,/PRODUCTION_GATE=BLOCKED/);
 assert.match(job,/tailscale\/github-action@v4/);
 assert.match(job,/scripts\/ci\/multiorg-staging-services-smoke\.sh/);
 assert.doesNotMatch(job,/docker\s+(?:compose|run|stop|rm)|\bpg_restore\b|\bCREATE DATABASE\b/);
 assert.match(shell,/syndes.environment=multi-org-staging/);
 assert.match(shell,/com.docker.compose.project=\$project/);
 assert.match(shell,/http:\/\/keycloak:8080\/realms\/master\/\.well-known\/openid-configuration/);
 assert.match(shell,/http:\/\/openfga:8080\/healthz/);
 assert.match(shell,/syndes_staging_keycloak/);
 assert.match(shell,/syndes_staging_control/);
 assert.doesNotMatch(shell,/docker compose|docker run|docker stop|docker rm|\bUPDATE\s+|\bDELETE FROM\b|\bDROP DATABASE\b/);
 const syntax=spawnSync("bash",["-n",script],{encoding:"utf8"});
 assert.equal(syntax.status,0,syntax.stderr);
});
test("MO-REL-04 actual stage-only smoke accepts all three read-only service responses and fails closed",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"syndes-staging-remote-service-"));
 try{
  for(const [name,body] of Object.entries({
   id:"#!/bin/sh\nprintf 'delmacy\\n'",
   hostname:"#!/bin/sh\nprintf 'DevServer01\\n'",
   docker:`#!/bin/sh
case "$1" in
 ps)
  case "$*" in
   *"syndes.component=control-postgres"*) printf 'stage-pg\\n';;
   *"syndes.component=keycloak"*) printf 'stage-kc\\n';;
   *"syndes.component=openfga"*) printf 'stage-fga\\n';;
   *) exit 9;;
  esac;;
 inspect) printf 'true\\n';;
 exec)
  case "$*" in
   *"psql"*"syndes_staging_control"*) printf 'STAGE_OK\\n';;
   *"wget"*"keycloak:8080"*) exit 0;;
   *"wget"*"openfga:8080"*) exit 0;;
   *) exit 8;;
  esac;;
 *) exit 7;;
esac`,
  })){
   await writeFile(join(dir,name),body,{mode:0o755});
  }
  const env={...process.env,PATH:dir+":"+process.env.PATH,
   SYNDES_STAGING_REMOTE_MODE:"read-only-v1"};
  const run=(mode="verify",vars=env)=>spawnSync("bash",[script,mode],{env:vars,encoding:"utf8"});
  const good=run();
  assert.equal(good.status,0,good.stdout+" "+good.stderr);
  assert.match(good.stdout,/MO_REL04_STAGING_SQL_CONTROL_AND_KEYCLOAK_ROLE_PASS/);
  assert.match(good.stdout,/MO_REL04_STAGING_KEYCLOAK_REAL_HTTP_PASS/);
  assert.match(good.stdout,/MO_REL04_STAGING_OPENFGA_REAL_HTTP_PASS/);
  assert.match(good.stdout,/MO_REL04_STAGING_REAL_SERVICE_SMOKE_PASS_NOT_MULTIORG_E2E/);
  assert.notEqual(run("apply").status,0);
  assert.notEqual(run("verify",{...env,SYNDES_STAGING_REMOTE_MODE:"apply"}).status,0);
  await writeFile(join(dir,"docker"),"#!/bin/sh\nexit 0\n",{mode:0o755});
  const missing=run();
  assert.notEqual(missing.status,0);
  assert.doesNotMatch(missing.stdout,/MO_REL04_STAGING_REAL_SERVICE_SMOKE_PASS/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
