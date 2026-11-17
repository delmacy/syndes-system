import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";

const workflow=readFileSync(".github/workflows/syndes-core-host-devserver01.yml","utf8");
const deploy=readFileSync("scripts/deploy/devserver01-core-host.sh","utf8");

test("Core Host CD remote script is valid bash syntax",()=>{
 assert.doesNotThrow(()=>execFileSync("bash",["-n","scripts/deploy/devserver01-core-host.sh"]));
});

test("Core Host CD is gated behind mainline success, main push, repository identity and an operator switch",()=>{
 for(const required of [
  "workflow_run:",'workflows: ["Syndes Mainline CI"]',
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.event == 'push'",
  "github.event.workflow_run.head_branch == 'main'",
  "github.event.workflow_run.head_repository.full_name == github.repository",
  "vars.SYNDES_DEV_CORE_HOST_CD_ENABLED == 'true'",
  "git ls-remote origin refs/heads/main"
 ])assert.ok(workflow.includes(required),required);
 assert.match(workflow,/tailscale\/github-action@v4/);
 assert.match(workflow,/id-token: write/);
 assert.match(workflow,/environment: devserver01/);
 assert.match(workflow,/audience: \$\{\{ secrets\.SYNDES_TAILSCALE_OIDC_AUDIENCE \}\}/);
 assert.match(workflow,/oauth-client-id: \$\{\{ secrets\.SYNDES_TAILSCALE_OAUTH_CLIENT_ID \}\}/);
 assert.doesNotMatch(workflow,/SYNDES_TAILSCALE_OAUTH_SECRET|oauth-secret:/);
 assert.match(workflow,/StrictHostKeyChecking=yes/);
 assert.match(workflow,/UserKnownHostsFile=/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/docker save .* \| gzip -1 \|/);
 assert.doesNotMatch(workflow,/ssh-keyscan|StrictHostKeyChecking=no|pull_request:|workflow_dispatch:/);
});

test("Tailnet OIDC preflight runs before deploy enablement, limited to ephemeral network authentication",()=>{
 const preflight=workflow.split("  tailnet-preflight:\n")[1]?.split("\n  deploy:\n")[0];
 assert.ok(preflight,"preflight job missing");
 for(const critical of [
  "vars.SYNDES_DEV_CORE_HOST_CD_ENABLED != 'true'",
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.event == 'push'",
  "github.event.workflow_run.head_branch == 'main'",
  "github.event.workflow_run.head_repository.full_name == github.repository",
  "environment: devserver01","id-token: write",
  "SYNDES_TAILSCALE_OIDC_AUDIENCE","SYNDES_TAILSCALE_OAUTH_CLIENT_ID",
  "SYNDES_DEV_TAILSCALE_TAG","tailscale/github-action@v4",
  "tailscale ip -4","TAILNET_OIDC_AUTH_VERIFIED",
  "SYNDES_DEV_SSH_HOST","tailscale ping --c=2",
  "DEVSERVER01_TAILNET_PEER_REACHABLE",
  "SSH_LOGIN_USER: delmacy","timeout 25s tailscale ssh",
  "DEVSERVER01_TAILSCALE_SSH_READONLY_PASS",
  "SYNDES_HOST=DevServer01","SYNDES_USER=delmacy"
 ])assert.ok(preflight.includes(critical),"preflight missing "+critical);
 assert.doesNotMatch(preflight,/SYNDES_DEV_SSH_(?!HOST)|COMPOSE_|SYNDES_CORE_HOST_IMAGE|docker (?:build|save|load|compose)|(?<!tailscale )\bssh\s+"|workflow_dispatch:/i);
 const deployment=workflow.split("\n  deploy:\n")[1];
 assert.ok(deployment?.includes("vars.SYNDES_DEV_CORE_HOST_CD_ENABLED == 'true'"));
});

test("Remote cutover is single-service, pinned image and Compose digest with failure rollback",()=>{
 for(const required of [
  "manifest_digest", '[[ "$actual_digest" == "$manifest_digest" ]]',
  "previous=", "rollback_on_failure", "trap rollback_on_failure EXIT",
  'compose up -d --no-deps "$service"',
  "CUTOVER_VERIFIED", "WHATSAPP_DISPATCH_ENABLED","SYNDES_MULTI_ORG_ENABLED",
  "status===200", "status===401", "Product Gate remains OPEN"
 ])assert.ok(deploy.includes(required),required);
 assert.match(deploy,/^set -Eeuo pipefail/m);
 assert.doesNotMatch(deploy,/docker compose down|docker volume rm|docker system prune|pg_dump|psql|migrate/);
});
