import test from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
const script="scripts/deploy/devserver01-multiorg-stage-keycloak-recovery.sh";
test("MO-REL-04 Keycloak recovery is main-only post-gate and restricted to staging labels",async()=>{
 const [s,y]=await Promise.all([readFile(script,"utf8"),
  readFile(".github/workflows/syndes-ci.yml","utf8")]);
 const start=y.indexOf("  devserver01-multiorg-stage-keycloak-recovery:");
 assert.ok(start>0);
 const job=y.slice(start);
 assert.match(job,/needs: \[gate\]/);
 assert.match(job,/github\.event_name == 'push'/);
 assert.match(job,/MO-REL04-STAGE-KEYCLOAK-RECOVERY-APPROVED/);
 assert.match(job,/environment: devserver01/);
 assert.match(job,/git ls-remote origin refs\/heads\/main/);
 assert.match(job,/gh issue comment 208/);
 assert.match(job,/PRODUCTION_GATE=BLOCKED/);
 assert.match(s,/label=com.docker.compose.project=\$project/);
 assert.match(s,/label=syndes.environment=multi-org-staging/);
 assert.match(s,/label=syndes.component=\$component/);
 assert.match(s,/\.Config.Labels "com.docker.compose.service"/);
 assert.match(s,/docker restart "\$kc"/);
 assert.match(s,/syndes_staging_control/);
 assert.match(s,/syndes_staging_keycloak/);
 assert.doesNotMatch(s,/docker\s+(?:stop|rm|compose|run)|\bpsql.*\b(?:INSERT|UPDATE|CREATE|DROP)\b/);
 assert.equal(spawnSync("bash",["-n",script],{encoding:"utf8"}).status,0);
});
test("MO-REL-04 stage-only Keycloak recovery restarts just labeled Keycloak and never touches PG",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"syndes-stage-kc-recover-"));
 try{
  const state=join(dir,"ready"),changes=join(dir,"changes");
  await writeFile(state,"no");
  for(const [name,body] of Object.entries({
   id:"#!/bin/sh\nprintf 'delmacy\\n'",
   hostname:"#!/bin/sh\nprintf 'DevServer01\\n'",
   docker:`#!/bin/sh
case "$1" in
 ps)
  case "$*" in
   *"syndes.component=control-postgres"*) echo stagepg;;
   *"syndes.component=keycloak"*) echo stagekc;;
   *) exit 12;;
  esac;;
 inspect)
  case "$*" in
   *"stagepg"*"com.docker.compose.service"*) echo control-postgres;;
   *"stagekc"*"com.docker.compose.service"*) echo keycloak;;
   *"stagepg"*) echo true;;
   *) exit 12;;
  esac;;
 exec)
  case "$*" in
   *"psql"*"syndes_staging_control"*) echo "1:1:1";;
   *"wget"*"-issuer-"*) exit 1;;
   *"wget"*)
    [ "$(cat "$STAGE_KC_READY")" = yes ] || exit 1;;
   *) exit 12;;
  esac;;
 restart)
  [ "$2" = stagekc ] || exit 14
  printf 'restart stagekc\\n' >> "$STAGE_KC_CHANGES"
  echo yes > "$STAGE_KC_READY";;
 *) exit 15;;
esac`,
  })){await writeFile(join(dir,name),body,{mode:0o755})}
  const env={...process.env,PATH:dir+":"+process.env.PATH,
   STAGE_KC_READY:state,STAGE_KC_CHANGES:changes,
   SYNDES_STAGE_KC_RECOVERY:"CI_APPROVED_MO_REL04"};
  const call=(mode="recover",vars=env)=>spawnSync("bash",[script,mode],{env:vars,encoding:"utf8"});
  assert.notEqual(call("apply").status,0);
  assert.notEqual(call("recover",{...env,SYNDES_STAGE_KC_RECOVERY:""}).status,0);
  const first=call();
  assert.equal(first.status,0,first.stdout+" "+first.stderr);
  assert.match(first.stdout,/MO_REL04_STAGE_KC_RESTARTED_STAGE_ONLY/);
  assert.match(first.stdout,/MO_REL04_STAGE_KC_POST_BOOTSTRAP_OIDC_PASS/);
  const second=call();
  assert.equal(second.status,0,second.stdout+" "+second.stderr);
  assert.match(second.stdout,/MO_REL04_STAGE_KC_ALREADY_HTTP_READY/);
  assert.equal((await readFile(changes,"utf8")).trim(),"restart stagekc");
 }finally{await rm(dir,{recursive:true,force:true})}
});
