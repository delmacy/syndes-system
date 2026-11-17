import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const workflow=readFileSync(".github/workflows/syndes-core-host-devserver01.yml","utf8");
const probe=readFileSync("scripts/ci/devserver01-core-host-auth-readonly.sh","utf8");

test("operational identity probe is syntactically valid and restricted to read-only Docker exec",()=>{
 const check=spawnSync("bash",["-n","scripts/ci/devserver01-core-host-auth-readonly.sh"],{encoding:"utf8"});
 assert.equal(check.status,0,check.stderr);
 assert.match(probe,/docker ps/);
 assert.match(probe,/docker inspect/);
 assert.match(probe,/docker exec -i "\$core_id" node --input-type=module -/);
 assert.match(probe,/com\.docker\.compose\.service=core-host-whatsapp/);
 assert.match(probe,/\[\[ "\$\(id -un\)" == "delmacy"/);
 assert.doesNotMatch(probe,/docker (?:run|build|pull|load|restart|stop|start|rm|compose\s+up|compose\s+down|network|volume|system)/);
 assert.doesNotMatch(probe,/\b(?:sudo|psql|pg_dump|pg_restore|kubectl|systemctl|chown|chmod|rm -rf|curl -k)\b/);
});
test("operational probe verifies Keycloak/OIDC, FGA health and fail-closed HTTP routes without operational credentials",()=>{
 for(const marker of [
  "CORE_KEYCLOAK_ISSUER","CORE_KEYCLOAK_JWKS_URL","CORE_OPENFGA_URL","CORE_KEYCLOAK_AUDIENCE",
  "KEYCLOAK_JWKS_REACHABLE","OPENFGA_READINESS_REACHABLE",
  "ANONYMOUS_AUTHORIZE_DENIED","INVALID_JWT_AUTHORIZE_DENIED",
  "ANONYMOUS_CRM_DENIED","INVALID_JWT_CRM_DENIED",
  "ANONYMOUS_INBOX_DENIED","INVALID_JWT_INBOX_DENIED",
  "OIDC_MODULE_INBOX","OIDC_MODULE_CRM",
  "DEVSERVER01_IDENTITY_READONLY_PROBE_PASS",
  "AUTH_POSITIVE_MEMBERSHIP_FGA_NOT_TESTED",
  'cache:"no-store"','redirect:"error"'
 ])assert.ok(probe.includes(marker),marker);
 assert.doesNotMatch(probe,/grant_type|client_secret|password=|/admin/realms|/stores/.+/write/);
});
test("live probe runs only after read-only SSH and Compose gates, never inside a deployment job",()=>{
 const preflight=workflow.split("  tailnet-preflight:\n")[1]?.split("\n  deploy:\n")[0];
 assert.ok(preflight);
 assert.ok(preflight.includes("DEVSERVER01_TAILSCALE_SSH_READONLY_PASS"));
 assert.ok(preflight.includes("scripts/deploy/devserver01-core-host.sh"));
 assert.ok(preflight.includes("scripts/ci/devserver01-core-host-auth-readonly.sh"));
 assert.match(preflight,/timeout 70s tailscale ssh/);
 assert.match(workflow, /SYNDES_DEV_CORE_HOST_CD_ENABLED == 'true'/);
 assert.match(workflow, /SYNDES_DEV_CORE_HOST_RECOVERY_APPROVED == 'true'/);
 assert.match(workflow, /SYNDES_DEV_CORE_HOST_RELEASE_APPROVED_SHA == github\.event\.workflow_run\.head_sha/);
});
