import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync('.github/workflows/syndes-core-host-devserver01.yml','utf8');
const deploy=readFileSync('scripts/deploy/devserver01-core-host.sh','utf8');
const gitSha='1'.repeat(40);
const releaseImage='syndes/core-host:git-'+gitSha;

test('Core Host CD is gated by main SHA, mainline CI, repository and owner enablement',()=>{
 for(const must of [
  'workflow_run:','workflows: ["Syndes Mainline CI"]',
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.event == 'push'",
  "github.event.workflow_run.head_branch == 'main'",
  'github.event.workflow_run.head_repository.full_name == github.repository',
  "vars.SYNDES_DEV_CORE_HOST_CD_ENABLED == 'true'",
  'vars.SYNDES_DEV_CORE_HOST_RELEASE_APPROVED_SHA == github.event.workflow_run.head_sha',
  "vars.SYNDES_DEV_CORE_HOST_RECOVERY_APPROVED == 'true'",
  '!(vars.SYNDES_DEV_CORE_HOST_CD_ENABLED',
  '[[ "$RELEASE_APPROVED_SHA" == "$SOURCE_SHA" && "$RECOVERY_APPROVED" == \'true\' ]]',
  'git ls-remote origin refs/heads/main','id-token: write',
  'environment: devserver01','persist-credentials: false',
  'tailscale/github-action@v4',
  'oauth-client-id: ${{ secrets.SYNDES_TAILSCALE_OAUTH_CLIENT_ID }}',
  'audience: ${{ secrets.SYNDES_TAILSCALE_OIDC_AUDIENCE }}'
 ])assert.ok(workflow.includes(must),must);
 assert.doesNotMatch(workflow,/pull_request:|workflow_dispatch:|ssh-keyscan|StrictHostKeyChecking=no/);
});
test('Remote access is Tailscale SSH only, with an independent read-only Compose gate',()=>{
 for(const must of [
  'tailscale ssh "delmacy@$DEPLOY_HOST"',
  "'bash -s -- preflight'",
  "'gzip -dc | docker load'",
  'docker save "syndes/core-host:git-$SOURCE_SHA"',
  'bash -s -- deploy syndes/core-host:git-$SOURCE_SHA',
  'DEVSERVER01_TAILSCALE_SSH_READONLY_PASS',
  'DEVSERVER01_TAILNET_PEER_REACHABLE'
 ])assert.ok(workflow.includes(must),must);
 assert.doesNotMatch(workflow,/SYNDES_DEV_SSH_KEY|SYNDES_DEV_SSH_KNOWN_HOSTS|SSH_PRIVATE_KEY|ssh-keyscan/);
 const preflight=workflow.split('  tailnet-preflight:\n')[1]?.split('\n  deploy:\n')[0];
 assert.ok(preflight);
 assert.doesNotMatch(preflight,/docker (?:build|save|load|compose)|\bup -d\b|\bdeploy syndes\b/);
});
test('Deployer pins four manifests and only rewrites its own image override with safe rollback',()=>{
 const syntax=spawnSync('bash',['-n','scripts/deploy/devserver01-core-host.sh'],{encoding:'utf8'});
 assert.equal(syntax.status,0,syntax.stderr);
 for(const must of [
  'readonly manifest_files=(', 'readonly manifest_sha256=(',
  'sha256sum "$path"', '[[ "$actual" == "$expected" ]]',
  'managed_override=', 'expected_override()', 'cmp -s "$managed_override"',
  'compose_base config --quiet','compose_release config --quiet',
  'compose_release up -d --no-deps --force-recreate "$service"',
  'rollback_on_failure()', 'trap rollback_on_failure EXIT',
  'write_override "$previous"','WHATSAPP_DISPATCH_ENABLED','SYNDES_MULTI_ORG_ENABLED',
  'status===200','status===401','CUTOVER_VERIFIED','Product Gate remains OPEN',
  'DEVSERVER01_COMPOSE_READONLY_PREFLIGHT_PASS',
  'Rollback image tag no longer identifies the running image',
  '[[ -n "$current_image_id" && "$current_image_id" == "$previous_tag_image_id" ]]',
  'DEVSERVER01_DOCKER_FREE_MIB=',
  'docker_free_kib >= 2097152',
  'override_free_kib >= 131072'
 ])assert.ok(deploy.includes(must),must);
 assert.doesNotMatch(deploy,/docker compose down|docker volume rm|docker system prune|pg_dump|\bpsql\b|\bmigrate\b|\bsudo\b/);
});

const mockDocker=[
 '#!/usr/bin/env node',
 'const fs=require("node:fs");',
 'const a=process.argv.slice(2);',
 'const file=process.env.MOCK_STATE,override=process.env.MOCK_OVERRIDE;',
 'const old="syndes/core-host:inbox-assign-4126665",now="syndes/core-host:git-"+("1".repeat(40));',
 'function state(){return fs.readFileSync(file,"utf8").trim()}',
 'function out(s){console.log(s);process.exit(0)}',
 'function image(){try{return /image: (\\S+)/.exec(fs.readFileSync(override,"utf8"))?.[1]||old}catch{return old}}',
 'if(a[0]==="compose"){',
 ' const cmd=a.find(x=>["version","config","ps","up"].includes(x));',
 ' if(cmd==="version")out("v5");',
 ' if(cmd==="config"){if(a.includes("--services"))out("core-host-whatsapp\\nworkspace-whatsapp");process.exit(0)}',
 ' if(cmd==="ps")out(a.at(-1)==="workspace-whatsapp"?"workspace-old":state()==="new"?"core-new":"core-old");',
 ' if(cmd==="up"){fs.writeFileSync(file,image()===old?"old":"new");process.exit(0)}',
 '}',
 'if(a[0]==="info"&&a.includes("--format"))out("/tmp");',
 'if(a[0]==="image"&&a[1]==="inspect"){if(a.includes("--format"))out(a.at(-1)===old?(process.env.MOCK_PREV_TAG_DRIFT==="1"?"sha256:SWAPPED":"sha256:OLD"):"sha256:NEW");process.exit(0)}',
 'if(a[0]==="inspect"){',
 ' const f=a[2]||"",newCid=a.at(-1)==="core-new";',
 ' if(f.includes("com.docker.compose.project"))out("syndes-whatsapp-cutover");',
 ' if(f.includes("com.docker.compose.service"))out("core-host-whatsapp");',
 ' if(f.includes(".Config.Image"))out(newCid?now:old);',
 ' if(f.includes(".State.Running"))out("true");',
 ' if(f.includes("{{.Image}}"))out(newCid?"sha256:NEW":"sha256:OLD");',
 ' if(f.includes(".Config.Env"))out("WHATSAPP_DISPATCH_ENABLED=true\\nSYNDES_MULTI_ORG_ENABLED=false");',
 ' process.exit(3);',
 '}',
 'if(a[0]==="exec"){if(process.env.MOCK_FAIL_ANON==="1"&&a.join(" ").includes("/inbox/conversations"))process.exit(1);process.exit(0)}',
 'process.stderr.write("Unexpected docker command: "+a.join(" ")+"\\n");process.exit(81);',
].join('\n')+'\n';

function fixture(){
 const root=mkdtempSync(join(tmpdir(),'syndes-cd-'));
 const bin=join(root,'bin');mkdirSync(bin);
 const files=['base.yaml','receipt.yaml','org.yaml','assignment.yaml'].map(x=>join(root,x));
 files.forEach((p,i)=>writeFileSync(p,'services:\n  core-host-whatsapp:\n    x-test: '+i+'\n'));
 let script=deploy;
 script=script.replace("readonly compose_dir='/home/delmacy/syndes-system/modules/whatsapp/deploy'","readonly compose_dir='"+root+"'");
 const paths=Array.from(deploy.matchAll(/'\/home\/delmacy\/[^']+\.ya?ml'/g),m=>m[0]);
 const hashes=Array.from(deploy.matchAll(/'([a-f0-9]{64})'/g),m=>m[1]);
 assert.equal(paths.length,4);assert.equal(hashes.length,4);
 for(let i=0;i<4;i++){
  script=script.replace(paths[i],"'"+files[i]+"'");
  const digest=createHash('sha256').update(readFileSync(files[i])).digest('hex');
  script=script.replace("'"+hashes[i]+"'","'"+digest+"'");
 }
 const sh=join(root,'script.sh');writeFileSync(sh,script);
 const override=join(root,'.syndes-core-host-cd.override.yaml'),state=join(root,'state');writeFileSync(state,'old');
 const d=join(bin,'docker');writeFileSync(d,mockDocker);chmodSync(d,0o755);
 for(const [cmd,value] of [['id','delmacy'],['hostname','DevServer01']]){
  const p=join(bin,cmd);writeFileSync(p,'#!/bin/sh\necho '+value+'\n');chmodSync(p,0o755);
 }
 return {files,state,override,
  run(args,more={}){return spawnSync('bash',[sh,...args],{encoding:'utf8',timeout:15000,env:{...process.env,PATH:bin+':'+process.env.PATH,MOCK_STATE:state,MOCK_OVERRIDE:override,...more}})},
  clean(){rmSync(root,{force:true,recursive:true})}
 };
}
test('Preflight is read-only; a drifted manifest cannot start a release',()=>{
 const f=fixture();
 try{
  let r=f.run(['preflight']);assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/DEVSERVER01_COMPOSE_READONLY_PREFLIGHT_PASS/);
  assert.equal(existsSync(f.override),false);
  writeFileSync(f.files[2],'services: {}\n');
  r=f.run(['deploy',releaseImage]);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/Compose manifest drift/);
  assert.equal(readFileSync(f.state,'utf8'),'old');
  assert.equal(existsSync(f.override),false);
 }finally{f.clean()}
});
test('Successful deployment changes only image override and not historical Compose manifests',()=>{
 const f=fixture();
 try{
  const before=f.files.map(p=>readFileSync(p,'utf8'));
  const r=f.run(['deploy',releaseImage]);
  assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
  assert.match(r.stdout,/CUTOVER_VERIFIED/);
  assert.equal(readFileSync(f.state,'utf8'),'new');
  assert.equal(readFileSync(f.override,'utf8'),'services:\n  core-host-whatsapp:\n    image: '+releaseImage+'\n');
  assert.deepEqual(f.files.map(p=>readFileSync(p,'utf8')),before);
 }finally{f.clean()}
});
test('Failed Inbox check rolls back only Core Host and persists previous image',()=>{
 const f=fixture();
 try{
  const r=f.run(['deploy',releaseImage],{MOCK_FAIL_ANON:'1'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/ROLLBACK_CORE_HOST_RESTORED/);
  assert.equal(readFileSync(f.state,'utf8'),'old');
  assert.match(readFileSync(f.override,'utf8'),/image: syndes\/core-host:inbox-assign-4126665/);
 }finally{f.clean()}
});

test('Rollback tag drift blocks a release before writing any override',()=>{
 const f=fixture();
 try{
  const r=f.run(['deploy',releaseImage],{MOCK_PREV_TAG_DRIFT:'1'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/Rollback image tag no longer identifies/);
  assert.equal(readFileSync(f.state,'utf8'),'old');
  assert.equal(existsSync(f.override),false);
 }finally{f.clean()}
});
