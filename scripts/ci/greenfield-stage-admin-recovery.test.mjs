import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";

test("first Keycloak admin recovery uses official offline stage-only service bootstrap",async()=>{
 const [runner,helper,js,workflow]=await Promise.all([
  readFile("scripts/deploy/devserver01-multiorg-stage-real-identity.sh","utf8"),
  readFile("scripts/deploy/devserver01-stage-keycloak-admin-service-recovery.sh","utf8"),
  readFile("scripts/deploy/stage-greenfield-keycloak-fga.mjs","utf8"),
  readFile(".github/workflows/syndes-ci.yml","utf8"),
 ]);
 assert.match(helper,/CI_APPROVED_STAGE_PILOT_ADMIN/);
 assert.match(helper,/syndes-multiorg-staging/);
 assert.match(helper,/syndes_staging_keycloak/);
 assert.match(helper,/quay\.io\/keycloak\/keycloak:26\.8\.1/);
 assert.match(helper,/bootstrap-admin service/);
 assert.match(helper,/--client-secret:env=PILOT_BOOTSTRAP_SERVICE_SECRET/);
 assert.match(helper,/client_id='\$stage_client'/);
 assert.match(helper,/docker stop "\$kc"/);
 assert.match(helper,/docker start "\$kc"/);
 assert.match(helper,/trap restore EXIT/);
 assert.match(helper,/MO_REL04_STAGE_KEYCLOAK26_OFFLINE_ADMIN_SERVICE_RECOVERED/);
 assert.match(helper,/cat "\$root\/secrets\/keycloak-db"/);
 assert.match(helper,/cat "\$secret"/);
 assert.doesNotMatch(helper,/syndes_control\b|syndes-postgres|syndes-security-access|docker compose down|DROP DATABASE|ALTER TABLE|DROP ROLE/);
 assert.match(runner,/stage-keycloak-recovery\.sh" recover/);
 assert.match(runner,/pilot-admin-service-secret/);
 assert.doesNotMatch(runner,/pilot\.mjs,dst|dst=\/run\/secrets/);
 assert.match(js,/grant_type:"client_credentials"/);
 assert.match(js,/PILOT_ADMIN_SERVICE_HTTP_/);
 assert.match(js,/syndes-stage-pilot-recovery/);
 assert.doesNotMatch(js,/adminPassword|admin-cli|syndes-stage-admin/);
 const pos=workflow.indexOf("  devserver01-greenfield-real-keycloak-fga:");
 assert.ok(pos>0);
 const slice=workflow.slice(pos);
 assert.match(slice,/cp scripts\/deploy\/devserver01-stage-keycloak-admin-service-recovery\.sh/);
 assert.match(slice,/sha256sum \*\.sh \*\.mjs \*\.json \*\.sql/);
 for(const file of [
  "scripts/deploy/devserver01-multiorg-stage-real-identity.sh",
  "scripts/deploy/devserver01-stage-keycloak-admin-service-recovery.sh",
 ]){
  const check=spawnSync("bash",["-n",file],{encoding:"utf8"});
  assert.equal(check.status,0,check.stderr);
 }
 const jsCheck=spawnSync(process.execPath,["--check","scripts/deploy/stage-greenfield-keycloak-fga.mjs"],{encoding:"utf8"});
 assert.equal(jsCheck.status,0,jsCheck.stderr);
});
