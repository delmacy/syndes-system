import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";

test("greenfield funnels must use FGA-compatible UUIDs, preserving legacy as archived database",async()=>{
 const [seed,runner,ci,workflow]=await Promise.all([
  readFile("infra/multiorg-staging/greenfield-pilot-seed.sql","utf8"),
  readFile("scripts/deploy/devserver01-greenfield-funnel-uuid-rebuild.sh","utf8"),
  readFile("scripts/ci/multiorg-greenfield-pg17.sh","utf8"),
  readFile(".github/workflows/syndes-ci.yml","utf8"),
 ]);
 assert.doesNotMatch(seed,/md5\([^\n]+::uuid/);
 assert.equal((seed.match(/pg_catalog\.gen_random_uuid\(\)/g)||[]).length,3);
 assert.match(seed,/service\.service_funnels WHERE id::text !~/);
 assert.match(seed,/service\.service_funnel_stages WHERE id::text !~/);
 assert.match(ci,/MO_GREENFIELD_PG17_FINE_AUTHZ_VALID_UUIDS_8_FUNNELS_16_STAGES_PASS/);
 assert.match(runner,/CI_APPROVED_UUID_MO_REL04/);
 assert.match(runner,/sha256sum --check --status/);
 assert.match(runner,/syndes-multiorg-staging/);
 assert.match(runner,/syndes-postgres/);
 assert.match(runner,/state='provisioned'/);
 assert.match(runner,/pg_stat_activity/);
 assert.match(runner,/service\.service_attendances/);
 assert.match(runner,/platform_org_memberships/);
 assert.match(runner,/syndes_greenfield_v1_/);
 assert.match(runner,/syndes_greenfield_v2_/);
 assert.match(runner,/ALTER DATABASE \$canonical RENAME TO \$archive/);
 assert.match(runner,/ALTER DATABASE \$candidate RENAME TO \$canonical/);
 assert.match(runner,/MO_REL04_UUID_OLD_SYNTHETIC_DATABASE_ARCHIVED_LEGACY_GATEWAY_UNTOUCHED/);
 assert.doesNotMatch(runner,/DROP DATABASE|TRUNCATE|DELETE FROM|docker (?:stop|rm|restart)|docker compose (?:up|down)|SYNDES_MULTI_ORG_ENABLED/);
 for(const [id,depends] of [
  ["devserver01-greenfield-funnel-uuid-stage","needs: [gate]"],
  ["devserver01-greenfield-funnel-uuid-production","needs: [gate, devserver01-greenfield-funnel-uuid-stage]"]]){
  const index=workflow.indexOf("  "+id+":");
  assert.ok(index>0,id);
  const tail=workflow.slice(index+1),n=tail.search(/\n  [a-z][a-z0-9-]+:\n/);
  const job=n<0?workflow.slice(index):workflow.slice(index,index+1+n);
  assert.ok(job.includes(depends));
  assert.match(job,/MO-REL04-FUNNEL-UUID-REBUILD-APPROVED/);
  assert.match(job,/github\.event_name == 'push'/);
  assert.match(job,/git ls-remote origin refs\/heads\/main/);
  assert.match(job,/SYNDES_GREENFIELD_REBUILD_APPROVAL=CI_APPROVED_UUID_MO_REL04/);
  assert.match(job,/sha256sum runner\.sh \*\.sql/);
  assert.match(job,/PRODUCTION_GATE=BLOCKED/);
 }
 for(const path of ["scripts/deploy/devserver01-greenfield-funnel-uuid-rebuild.sh","scripts/ci/multiorg-greenfield-pg17.sh"]){
  const check=spawnSync("bash",["-n",path],{encoding:"utf8"});
  assert.equal(check.status,0,check.stderr);
 }
});
