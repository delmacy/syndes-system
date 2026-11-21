import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";

test("real first-user stage requires signed Keycloak26, exact FGA and signed-in restricted B user",async()=>{
 const [js,runner,control,tenant,workflow]=await Promise.all([
  readFile("scripts/deploy/stage-greenfield-keycloak-fga.mjs","utf8"),
  readFile("scripts/deploy/devserver01-multiorg-stage-real-identity.sh","utf8"),
  readFile("infra/multiorg-staging/greenfield-stage-first-user.sql","utf8"),
  readFile("infra/multiorg-staging/greenfield-stage-membership.sql","utf8"),
  readFile(".github/workflows/syndes-ci.yml","utf8"),
 ]);
 assert.match(js,/syndes-pilot/);
 assert.match(js,/organizationsEnabled:true/);
 assert.match(js,/verifySignature/);
 assert.match(js,/protocol\/openid-connect\/certs/);
 assert.match(js,/PILOT_CROSS_ORG_MEMBER/);
 assert.match(js,/pilot-founder/);
 assert.match(js,/pilot-b-only/);
 assert.match(js,/iam_capability:/);
 assert.match(js,/PILOT_FGA_SCOPE_LEAK/);
 assert.match(js,/FGA_EXACT|fga-grants/);
 assert.match(js,/service\.funnel\.operate/);
 assert.match(js,/get\("?/);
 assert.doesNotMatch(js,/syndes-security-access|syndes-prod|whatsapp-gateway|https:\/\/.*syndes\.com/);
 assert.match(runner,/syndes-multiorg-staging/);
 assert.match(runner,/syndes_staging_control/);
 assert.match(runner,/MO_REAL_IDENTITY_STAGE_CONTROL_READY_TWO_ORGS_SCOPED_PG17_PASS/);
 assert.match(runner,/--network syndes-multiorg-staging_staging_internal/);
 assert.match(runner,/CI_APPROVED_GREENFIELD_IDP_FGA/);
 assert.match(runner,/sha256sum -c MANIFEST\.sha256 --status/);
 assert.match(runner,/greenfield-stage-first-user.sql/);
 assert.match(runner,/greenfield-stage-membership.sql/);
 assert.doesNotMatch(runner,/syndes_control\b|syndes-postgres|docker compose up|docker restart|SYNDES_MULTI_ORG_ENABLED/);
 assert.match(control,/SET ROLE syndes_signup_link_operator/);
 assert.match(control,/SET ROLE syndes_signup_finalize_operator/);
 assert.match(control,/SET ROLE syndes_iam_link_operator/);
 assert.match(control,/platform_signup_finalize/);
 assert.match(control,/platform_keycloak_org_links/);
 assert.match(tenant,/platform_org_memberships/);
 assert.match(tenant,/platform_workspace_memberships/);
 assert.match(tenant,/principal_id=:'restricted'/);
 assert.match(tenant,/organization_id='a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1'/);
 const pos=workflow.indexOf("  devserver01-greenfield-real-keycloak-fga:");
 assert.ok(pos>0);
 const tail=workflow.slice(pos),end=tail.search(/\n  [a-z][a-z0-9-]+:\n/);
 const job=end<0?tail:tail.slice(0,end);
 assert.match(job,/MO-REL04-REAL-FOUNDER-IDP-FGA-APPROVED/);
 assert.match(job,/needs: \[gate\]/);
 assert.match(job,/git ls-remote origin refs\/heads\/main/);
 assert.match(job,/tailscale\/github-action@v4/);
 assert.match(job,/SYNDES_STAGE_REAL_IDENTITY_APPROVAL=CI_APPROVED_GREENFIELD_IDP_FGA/);
 assert.match(job,/PRODUCTION_GATE=BLOCKED/);
 for(const [cmd,args] of [
  ["bash",["-n","scripts/deploy/devserver01-multiorg-stage-real-identity.sh"]],
  ["node",["--check","scripts/deploy/stage-greenfield-keycloak-fga.mjs"]],
 ]){
  const r=spawnSync(cmd,args,{encoding:"utf8"});
  assert.equal(r.status,0,r.stderr);
 }
});
