import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
const source="scripts/ci/multiorg-staging-readonly.sh";
const workflow=".github/workflows/syndes-ci.yml";

test("MO-REL-04 staging preflight is manual, SHA-gated and rejects production host",async()=>{
 const text=await readFile(workflow,"utf8");
 assert.match(text,/workflow_dispatch:/);
 assert.match(text,/staging-readonly:/);
 assert.match(text,/github.event_name == 'workflow_dispatch'/);
 assert.match(text,/environment: multi-org-staging/);
 assert.match(text,/STAGING_PEER.*!= 'delmacy-desktoppc\.tayra-delta\.ts\.net'/);
 assert.match(text,/APPROVED_SHA.*SOURCE_SHA/);
 assert.match(text,/git ls-remote origin refs\/heads\/main/);
 assert.doesNotMatch(text,/docker compose up|docker exec|--apply|psql/);
});
test("MO-REL-04 inventories only pre-labeled staging services and fails closed",async()=>{
 const root=await mkdtemp(join(tmpdir(),"syndes-stage-probe-"));
 try{
  const fake=join(root,"docker");
  await writeFile(fake,`#!/bin/sh
[ "$1" = ps ] || exit 20
case "$*" in
  *"syndes.environment=multi-org-staging"*"syndes.component=control-postgres"*) printf 'id1\\n';;
  *"syndes.environment=multi-org-staging"*"syndes.component=keycloak"*) printf 'id2\\n';;
  *"syndes.environment=multi-org-staging"*"syndes.component=openfga"*) printf 'id3\\n';;
  *"syndes.environment=multi-org-staging"*"syndes.component=core-host"*) printf 'id4\\n';;
  *) exit 21;;
esac
`.replaceAll("\`","`"),{mode:0o755});
  const env={...process.env,PATH:root+":"+process.env.PATH,SYNDES_STAGING_REMOTE_MODE:"read-only-v1"};
  let res=spawnSync("bash",[source,"preflight"],{env,encoding:"utf8"});
  assert.equal(res.status,0,res.stderr+" "+res.stdout);
  assert.match(res.stdout,/MO_REL04_STAGING_COMPONENT_INVENTORY_PASS/);
  assert.doesNotMatch(res.stdout,/tenant_id|password|secret/i);
  res=spawnSync("bash",[source,"apply"],{env,encoding:"utf8"});
  assert.notEqual(res.status,0);
  res=spawnSync("bash",[source,"preflight"],{env:{...env,SYNDES_STAGING_REMOTE_MODE:"apply"},encoding:"utf8"});
  assert.notEqual(res.status,0);
  await writeFile(fake,"#!/bin/sh\nexit 0\n",{mode:0o755});
  res=spawnSync("bash",[source,"preflight"],{env,encoding:"utf8"});
  assert.notEqual(res.status,0,"Missing staging resources must not pass");
  assert.match(res.stdout,/MO_REL04_STAGING_PREFLIGHT=BLOCKED/);
 }finally{await rm(root,{recursive:true,force:true})}
});
