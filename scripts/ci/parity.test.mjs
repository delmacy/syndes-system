import test from "node:test";
import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";

const root=new URL("../../",import.meta.url);
const read=async path=>readFile(new URL(path,root),"utf8");
const must=(source,fragments,label)=>{
  for(const fragment of fragments){
    assert.ok(source.includes(fragment),label+": missing critical parity "+fragment);
  }
};

const expectedWorkflows=[
 "platform-manager.yml",
 "support-browser-e2e.yml",
 "syndes-ci.yml",
 "syndes-docs-pages.yml",
 "syndes-docs-project-sync.yml",
];
const mainlineEvents=source=>[...source.matchAll(/^  (push|pull_request|merge_group):/gm)]
 .map(match=>match[1]).sort();

test("only the central mainline owns PR and merge-group regression; Docs push is scoped",async()=>{
 const dir=new URL(".github/workflows/",root);
 const names=(await readdir(dir)).filter(x=>/\.ya?ml$/.test(x)).sort();
 // Fail closed when a new workflow is added without a conscious classification.
 assert.deepEqual(names,expectedWorkflows);
 const main=await read(".github/workflows/syndes-ci.yml");
 must(main,[
   "name: Syndes Mainline CI","pull_request:","push:","merge_group:","workflow_dispatch:",
   "branches: [main]","name: Syndes CI Gate","Deny merge unless all required checks actually passed",
   "uses: ./.github/workflows/support-browser-e2e.yml",
   "uses: ./.github/workflows/platform-manager.yml",
   "needs: [foundation, impact, regression, support-browser-parity, platform-manager-parity]",
   "check_selected_parity","Preserve the physical single-organization guard",
 ],"central mainline");
 assert.deepEqual(mainlineEvents(main),["merge_group","pull_request","push"]);
 for(const name of ["platform-manager.yml","support-browser-e2e.yml"]){
   const content=await read(".github/workflows/"+name);
   assert.match(content,/^on:\s*\n  workflow_call:/m,name+" must be reusable only");
   assert.deepEqual(mainlineEvents(content),[],name+" must not trigger independent regression runs");
 }
 const pages=await read(".github/workflows/syndes-docs-pages.yml");
 assert.deepEqual(mainlineEvents(pages),["push"],"Docs must not duplicate PR/merge-group gates");
 must(pages,[
   "name: Syndes Docs","branches: [main]","    paths:",
   '      - "docs/**"','      - "scripts/docs/**"',
   '      - ".github/workflows/syndes-docs-pages.yml"',
   "actions/deploy-pages@v4"
 ],"scoped documentation publisher");
 assert.doesNotMatch(pages,/^  (?:pull_request|merge_group):/m);
 const project=await read(".github/workflows/syndes-docs-project-sync.yml");
 assert.deepEqual(mainlineEvents(project),[],"GitHub Projects sync must not trigger mainline regression");
 must(project,["workflow_dispatch:","  issues:","SYNDES_PROJECT_URL","SYNDES_PROJECTS_PAT"],
      "independent issue/project sync");
});

test("event classifier rejects independent CI events, not scoped documentation publication",()=>{
 assert.deepEqual(mainlineEvents("on:\n  push:\n  pull_request:\n  merge_group:\n"),
                  ["merge_group","pull_request","push"]);
 assert.deepEqual(mainlineEvents("on:\n  workflow_dispatch:\n  issues:\n"),[]);
 assert.deepEqual(mainlineEvents("on:\n  push:\n    paths:\n      - \"docs/**\"\n"),["push"]);
});

test("mainline planner and suite runner cover all approved independent domains",async()=>{
 const planner=await read("scripts/ci/plan.mjs");
 const suite=await read("scripts/ci/run-suite.sh");
 for(const name of [
  "kernel","organizations","crm","inbox","service-management","whatsapp-ts","whatsapp-go",
  "host","workspace","support","support-web","platform-api","platform-web","account-access","infra"
 ]){
   assert.ok(planner.includes("suite: '"+name+"'"),"planner omits "+name);
   assert.ok(suite.includes("  "+name+")"),"runner omits "+name);
 }
 must(suite,[
  "npm run check","npm test","npm pack --dry-run",
  "modules/core-crm/test/postgres-integration.sh",
  "modules/inbox/test/postgres-integration.sh",
  "go mod verify","gofmt -l","go vet ./...","go test -race -count=1 ./...",
  "go build ./...","docker build --file apps/core-host/Dockerfile",
  "run-workspace-browser.sh","node --test test/pg-integration.test.mjs",
  "node test/pg-backup-restore.mjs","SYNDES_DISPOSABLE_RESTORE_REHEARSAL=true",
  "npm run test:browser","bash scripts/ci/run-account-access.sh",
  "bash scripts/ci/run-infra.sh"
 ],"mainline execution");
});

test("disposable infra keeps PostgreSQL/identity/tenant-only migration and network defenses",async()=>{
 const infra=await read("scripts/ci/run-infra.sh");
 must(infra,[
   "tests/platform/postgres-smoke.sh","tests/platform/openbao-smoke.sh",
   "tests/platform/openfga-smoke.sh","tests/platform/core-host-runtime-smoke.sh",
   "tests/platform/support-migration-gate.test.sh",
   "tests/platform/support-migration-installer.test.sh",
   "tests/platform/platform-manager-postgres-smoke.sh",
   "tests/platform/platform-manager-network-smoke.py",
   "docker network create --internal",
   "CI_RUNTIME_SMOKE=1",
   "security_compose up -d",
   "postgres_compose up -d postgres",
   "Host, database, Keycloak and OpenFGA secret boundaries"
 ],"real infra regression");
});

test("signed identity, denied cross-client tokens, browser and least-privilege Control DB remain in reusable jobs",async()=>{
 const manager=await read(".github/workflows/platform-manager.yml");
 const support=await read(".github/workflows/support-browser-e2e.yml");
 must(manager,[
  "tests/platform/platform-manager-keycloak-ci.mjs",
  "tests/platform/platform-manager-postgres-smoke.sh",
  "tests/platform/platform-manager-network-smoke.py",
  "tests/platform/test-master-secret-render.py",
  "tests/platform/test-owner-bootstrap.py",
  "infra/master-admin/homolog-deploy.sh",
  "npm run test:browser",
  "Docker bridge isolation",
  "Real PostgreSQL denied writes and tenant connections"
 ],"Platform Manager real parity");
 must(support,[
   "postgres:16","quay.io/keycloak/keycloak:26.8.1",
   "openfga/openfga:v1.22.1",
   "syndes-support-e2e-keycloak",
   "node apps/core-host/test/support-e2e-server.mjs",
   "npx playwright install --with-deps chromium",
   "npm run test:e2e"
 ],"Support Browser real parity");
});

test("account delegation keeps dedicated JWT/FGA/SQL negative tests in the mainline gate",async()=>{
 const runner=await read("scripts/ci/run-account-access.sh");
 must(runner,[
   "tests/platform/account-roles-pg-smoke.sh",
   "CI_ACCOUNT_PG=1",
   "apps/account-access-api/test/pg-e2e.mjs",
   "127.0.0.1:15433",
   "postgres:17-alpine",
   "apps/account-access-api/Dockerfile"
 ],"account delegation real parity");
 const sql=await read("infra/postgres/bootstrap/control-account-delegation.schema");
 must(sql,[
   "SECURITY DEFINER","syndes_account_delegate",
   "apply_tenant_account_delegation","pg_advisory_xact_lock",
   "REVOKE ALL ON FUNCTION"
 ],"delegation SQL least privilege");
});

test("separately approved SQL 002 stays physically enforced in mainline",async()=>{
 const main=await read(".github/workflows/syndes-ci.yml");
 const sql=await read("modules/organizations/sql/002_legacy_single_context_gate.sql");
 must(main,[
  "platform_legacy_single_organization","platform_legacy_single_workspace",
  "modules/organizations/sql/manual/activate_multiple_organizations.sql"
 ],"single-organization mainline safety");
 must(sql,["platform_legacy_single_organization","platform_legacy_single_workspace"],"SQL 002");
});
