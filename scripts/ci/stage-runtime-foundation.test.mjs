import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('stage runtime operator denies wrong host, action or approval before Docker or secrets',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'stage-foundation-'));
 try{
  await writeFile(join(dir,'id'),'#!/bin/sh\necho outsider\n',{mode:0o755});
  await writeFile(join(dir,'hostname'),'#!/bin/sh\necho foreign-host\n',{mode:0o755});
  const script='scripts/deploy/devserver01-stage-runtime-foundation.sh';
  for(const args of [[],['apply','/tmp/bundle','image']]){
   const r=spawnSync('bash',[script,...args],{encoding:'utf8',env:{...process.env,
    PATH:dir+':'+process.env.PATH,SYNDES_STAGE_RUNTIME_APPROVAL:'ACTIONS_APPROVED_STAGE_RUNTIME',SOURCE_SHA:'a'.repeat(40)}});
   assert.equal(r.status,2);assert.equal(r.stdout,'');
  }
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('runtime overlay remains private, stage-only, persistent and scoped to approved Actions',async()=>{
 const [overlay,script,js,workflow]=await Promise.all([
  readFile('infra/multiorg-staging/runtime-compose.yaml','utf8'),
  readFile('scripts/deploy/devserver01-stage-runtime-foundation.sh','utf8'),
  readFile('scripts/deploy/staging-runtime/setup.mjs','utf8'),
  readFile('.github/workflows/syndes-ci.yml','utf8')]);
 assert.doesNotMatch(overlay,/\bports:|network_mode:|syndes-data|syndes-secrets|privileged:/);
 assert.match(overlay,/openbao\/openbao:2.7.0/);assert.match(overlay,/staging_openbao/);
 assert.match(script,/label=syndes.environment=multi-org-staging/);
 assert.match(script,/sha256sum -c MANIFEST.sha256 --status/);
 assert.match(script,/pg_dump .* -Fc/);assert.match(script,/-aes-256-cbc -pbkdf2/);
 assert.doesNotMatch(script,/docker compose down|docker system prune|DROP DATABASE|syndes_control\b/);
 assert.match(js,/token_no_default_policy:true/);assert.match(js,/view-organizations/);
 assert.doesNotMatch(js,/manage-users|manage-realm|manage-organizations|rejectUnauthorized:false|NODE_TLS_REJECT_UNAUTHORIZED/);
 assert.match(js,/statuses:\[403\]/);assert.match(js,/has_table_privilege/);
 const job=workflow.slice(workflow.indexOf('  devserver01-stage-runtime-foundation:'));
 assert.match(job,/needs: \[gate\]/);assert.match(job,/MO-REL04-STAGE-RUNTIME-FOUNDATION-APPROVED/);
 assert.match(job,/git ls-remote origin refs\/heads\/main/);
 assert.match(job,/STAGE_RUNTIME_FOUNDATION_COMPLETE_NOT_CORE_HTTP/);
 assert.equal(spawnSync('bash',['-n','scripts/deploy/devserver01-stage-runtime-foundation.sh']).status,0);
 assert.equal(spawnSync('node',['--check','scripts/deploy/staging-runtime/setup.mjs']).status,0);
});
