import test from "node:test";
import assert from "node:assert/strict";
import {readFile,mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";

const compose="infra/multiorg-staging/compose.yaml";
const runner="scripts/deploy/devserver01-multiorg-staging-infra.sh";
const inventory="scripts/ci/multiorg-staging-readonly.sh";
const workflow=".github/workflows/syndes-ci.yml";
test("MO-REL-04 isolated foundation never exposes ports, prod volumes or networks",async()=>{
 const spec=await readFile(compose,"utf8");
 assert.match(spec,/name: syndes-multiorg-staging/);
 for(const component of ["control-postgres","keycloak","openfga"]){
  assert.match(spec,new RegExp("syndes.component: "+component));
 }
 assert.match(spec,/image: postgres:17-alpine/);
 assert.match(spec,/image: quay\.io\/keycloak\/keycloak:26\.8\.1/);
 assert.match(spec,/image: openfga\/openfga:v1\.22\.1/);
 assert.match(spec,/internal: true/);
 assert.match(spec,/staging_control_pg17/);
 assert.match(spec,/staging_pg_admin_password/);
 assert.doesNotMatch(spec,/\n\s*ports:|\n\s*network_mode:|\n\s*privileged:|\n\s*pid: host/);
 assert.doesNotMatch(spec,/syndes-data|syndes-secrets|syndes-master-data|syndes_core\b/);
 assert.doesNotMatch(spec,/\n\s*core-host:|\n\s*volumes:\s*\[.*:\/var\/run\/docker\.sock/);
 assert.match(spec,/datastore-engine", "memory"/);
});
test("MO-REL-04 one-shot staging installer remains post-gate main-only, not general CD",async()=>{
 const [ci,script,init]=await Promise.all([
  readFile(workflow,"utf8"),readFile(runner,"utf8"),
  readFile("infra/multiorg-staging/init-staging-postgres.sh","utf8"),
 ]);
 const start=ci.indexOf("  devserver01-multiorg-stage-foundation:");
 assert.ok(start>0);
 const job=ci.slice(start);
 assert.match(job,/github\.event_name == 'push'/);
 assert.match(job,/contains\(github\.event\.head_commit\.message, 'MO-REL04-DEVSERVER-STAGE-INFRA-APPROVED'\)/);
 assert.match(job,/needs: \[gate\]/);
 assert.match(job,/environment: devserver01/);
 assert.match(job,/delmacy-desktoppc\.tayra-delta\.ts\.net/);
 assert.match(job,/SOURCE_SHA/);
 assert.match(job,/git ls-remote origin refs\/heads\/main/);
 assert.match(job,/SYNDES_STAGE_INFRA_APPLY=MO_REL04_CI_APPROVED/);
 assert.match(job,/syndes-multiorg-staging-infra\.sh/);
 assert.match(job,/-- foundation/);
 assert.doesNotMatch(job,/modules\/organizations\/sql\/manual\/activate_multiple_organizations|pg_restore/);
 assert.match(script,/MO_REL04_STAGE_INFRA_DENY=wrong_host/);
 assert.match(script,/MO_REL04_STAGE_INFRA_BLOCKED=less_than_4gib/);
 assert.match(script,/MO_REL04_STAGE_INFRA_DENY=foreign_project_container/);
 assert.match(script,/MO_REL04_STAGE_INFRA_DENY=artifact_drift/);
 assert.match(script,/openssl rand -hex 32/);
 assert.match(script,/staging-multiorg|syndes-multiorg-staging/);
 assert.doesNotMatch(script,/DROP DATABASE|docker (?:rm|stop|system prune)|\bpsql\b/);
 assert.match(init,/CREATE DATABASE syndes_staging_control/);
 assert.match(init,/format\('CREATE ROLE %I LOGIN PASSWORD %L'/);
 assert.doesNotMatch(init,/syndes_control\b|syndes_keycloak\b/);
 const shell=spawnSync("bash",["-n",runner],{encoding:"utf8"});
 assert.equal(shell.status,0,shell.stderr);
});
test("MO-REL-04 foundation verifies three staged labels but never masquerades as full Core",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"syndes-stage-foundation-"));
 try{
  const script=join(dir,"docker");
  await writeFile(script,`#!/bin/sh
[ "$1" = ps ] || exit 20
case "$*" in
 *"syndes.environment=multi-org-staging"*"syndes.component=control-postgres"*) printf 'postgres-id\\n';;
 *"syndes.environment=multi-org-staging"*"syndes.component=keycloak"*) printf 'keycloak-id\\n';;
 *"syndes.environment=multi-org-staging"*"syndes.component=openfga"*) printf 'openfga-id\\n';;
 *"syndes.environment=multi-org-staging"*"syndes.component=core-host"*) : ;;
 *) exit 21;;
esac
`,{mode:0o755});
  const env={...process.env,PATH:dir+":"+process.env.PATH,
   SYNDES_STAGING_REMOTE_MODE:"read-only-v1"};
  const foundation=spawnSync("bash",[inventory,"foundation"],{env,encoding:"utf8"});
  assert.equal(foundation.status,0,foundation.stderr+" "+foundation.stdout);
  assert.match(foundation.stdout,/MO_REL04_STAGING_FOUNDATION_PG17_KEYCLOAK_FGA_PASS/);
  const full=spawnSync("bash",[inventory,"preflight"],{env,encoding:"utf8"});
  assert.notEqual(full.status,0);
  assert.match(full.stdout,/MO_REL04_STAGING_PREFLIGHT=BLOCKED/);
  const deny=spawnSync("bash",[inventory,"foundation"],{
   env:{...env,SYNDES_STAGING_REMOTE_MODE:"apply"},encoding:"utf8"});
  assert.notEqual(deny.status,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});
