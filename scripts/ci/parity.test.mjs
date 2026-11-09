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

test("only the central mainline workflow handles Git push, PR and merge-group",async()=>{
 const dir=new URL(".github/workflows/",root);
 const names=(await readdir(dir)).filter(x=>/\.ya?ml$/.test(x)).sort();
 assert.deepEqual(names,["platform-manager.yml","support-browser-e2e.yml","syndes-ci.yml"]);
 const main=await read(".github/workflows/syndes-ci.yml");
 must(main,[
   "name: Syndes Mainline CI","pull_request:","push:","merge_group:","workflow_dispatch:",
   "branches: [main]","name: Syndes CI Gate","Deny merge unless all required checks actually passed",
   "uses: ./.github/workflows/support-browser-e2e.yml",
   "uses: ./.github/workflows/platform-manager.yml",
   "needs: [foundation, impact, regression, support-browser-parity, platform-manager-parity]",
   "check_selected_parity","Preserve the physical single-organization guard",
 ],"central mainline");
 for(const name of names.filter(n=>n!=="syndes-ci.yml")){
   const content=await read(".github/workflows/"+name);
   assert.match(content,/^on:\s*\n  workflow_call:/m,name+" must be reusable only");
   assert.doesNotMatch(content,/^  (?:push|pull_request|merge_group):/m,name+" must not trigger duplicate runs");
 }
});

test("mainline planner and suite runner cover all approved independent domains",async()=>{
 const planner=await read("scripts/ci/plan.mjs");
 const suite=await read("scripts/ci/run-suite.sh");
 for(const name of [
  "kernel","organizations","crm","inbox","whatsapp-ts","whatsapp-go",
  "host","workspace","support","support-web","platform-api","platform-web","infra"
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
  "npm run test:browser","bash scripts/ci/run-infra.sh"
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

test("separately approved SQL 002 stays physically enforced in mainline",async()=>{
 const main=await read(".github/workflows/syndes-ci.yml");
 const sql=await read("modules/organizations/sql/002_legacy_single_context_gate.sql");
 must(main,[
  "platform_legacy_single_organization","platform_legacy_single_workspace",
  "modules/organizations/sql/manual/activate_multiple_organizations.sql"
 ],"single-organization mainline safety");
 must(sql,["platform_legacy_single_organization","platform_legacy_single_workspace"],"SQL 002");
});
