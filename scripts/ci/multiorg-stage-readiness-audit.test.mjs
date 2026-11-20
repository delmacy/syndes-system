import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";

const audit="scripts/ci/multiorg-stage-readiness-audit.sh";
const workflow=".github/workflows/syndes-ci.yml";

test("MO-REL-04 stage storage audit is read-only and fail-closed", async()=>{
 const [script,ci]=await Promise.all([readFile(audit,"utf8"),readFile(workflow,"utf8")]);
 assert.match(script,/SYNDES_STAGING_REMOTE_MODE/);
 assert.match(script,/syndes-multiorg-staging/);
 assert.match(script,/fga_not_persistent/);
 assert.match(script,/control_schema_missing/);
 assert.match(script,/core-host/);
 assert.doesNotMatch(script,/\b(?:INSERT|UPDATE|DELETE|DROP|CREATE DATABASE|ALTER ROLE|docker restart|docker compose up|docker exec -i)\b/);
 assert.match(ci,/devserver01-multiorg-stage-readiness-audit:/);
 assert.match(ci,/needs: \[gate\]/);
 assert.match(ci,/MO-REL04-STAGE-READINESS-AUDIT-APPROVED/);
 const syntax=spawnSync("bash",["-n",audit],{encoding:"utf8"});
 assert.equal(syntax.status,0,syntax.stderr);
});

test("MO-REL-04 existing memory FGA blocks release readiness with no credentials printed",async()=>{
 const d=await mkdtemp(join(tmpdir(),"syndes-stage-audit-"));
 try {
  const stubs={
   id:'# !/bin/sh\necho delmacy\n'.replace("# !","#!"),
   hostname:'#!/bin/sh\necho DevServer01\n',
   docker:`#!/bin/sh
case "$1" in
 ps)
  case "$*" in
   *syndes.component=control-postgres*) echo pgid;;
   *syndes.component=keycloak*) echo kcid;;
   *syndes.component=openfga*) echo fgaid;;
   *syndes.component=core-host*) echo coreid;;
   *) exit 8;;
  esac;;
 inspect)
  case "$*" in
   *State.Running*) echo true;;
   *Config.Env*) echo "";;
   *Config.Cmd*) echo '["run","--datastore-engine","memory"]';;
   *) exit 9;;
  esac;;
 *) exit 10;;
esac
`,
  };
  for(const [name,body] of Object.entries(stubs))
   await writeFile(join(d,name),body,{mode:0o755});
  const res=spawnSync("bash",[audit,"audit"],{encoding:"utf8",
   env:{...process.env,PATH:d+":"+process.env.PATH,SYNDES_STAGING_REMOTE_MODE:"read-only-v1"}});
  assert.equal(res.status,4,res.stderr);
  assert.match(res.stdout,/MO_REL04_READINESS_BLOCKED=fga_not_persistent/);
  assert.doesNotMatch(res.stdout,/password|token|secret|postgres:\/\//i);
 }finally{await rm(d,{recursive:true,force:true})}
});
