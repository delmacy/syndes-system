import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
test('Core staging release requires verified artifacts, nonroot singleton and application rollback',async()=>{
 const [script,compose,setup,yaml]=await Promise.all([
  readFile('scripts/deploy/devserver01-stage-core.sh','utf8'),
  readFile('infra/multiorg-staging/core-compose.yaml','utf8'),
  readFile('scripts/deploy/staging-runtime/prepare-core.mjs','utf8'),
  readFile('.github/workflows/syndes-ci.yml','utf8')]);
 assert.match(script,/ACTIONS_APPROVED_STAGE_CORE/);
 assert.match(script,/label=syndes.environment=multi-org-staging/);
 assert.match(script,/org.opencontainers.image.revision/);
 assert.match(script,/previous_image/);assert.match(script,/timeout 20s docker exec/);
 assert.match(compose,/user: '10001:10001'/);assert.match(compose,/read_only: true/);
 assert.match(compose,/CORE_SECRET_PROVIDER: files/);
 assert.doesNotMatch(compose,/CORE_OPENBAO_URL|bao-tenant-role-id/);
 assert.match(script,/STAGE_CORE_FILE_CREDENTIALS_START_WITHOUT_OPENBAO_PASS/);
 assert.match(compose,/SYNDES_CRM_MODULE_GATE: enforce/);
 assert.doesNotMatch(compose,/ports:|privileged:|CORE_CONTROL_DB_URL|CORE_OPENFGA_TOKEN|syndes-data/);
 assert.match(setup,/Ready replay NEVER recreates a revoked grant/);
 assert.ok(setup.includes("check(typeof decision?.allowed==='boolean')"));
 assert.ok(setup.includes("if(bootstrap){"));
 assert.ok(setup.includes("preservedDeniedGrants++"));
 assert.ok(setup.includes("STAGE_CORE_EXISTING_GRANT_DENIALS_PRESERVED="));
 assert.ok(!setup.includes("check(!bootstrap); // Ready replay"));

 assert.match(setup,/verified_existing_post_cutover/);
 // History command schema 009 was prepared independently by the approved
 // staging migration. It must be verified but cannot silently mutate the
 // already enabled immutable WhatsApp 0.1.0 module installation receipt.
 const historyBoundary=setup.indexOf("m.id==='009_whatsapp_history_commands'");
 const moduleReceipt=setup.indexOf("migrations.push({id:m.id,checksum});");
 assert.ok(historyBoundary>0&&historyBoundary<moduleReceipt);
 const independent=setup.slice(historyBoundary,moduleReceipt);
 assert.match(independent,/stage_prepared_before_activation/);
 assert.match(independent,/_syndes\.stage_bootstrap_receipts/);
 assert.match(independent,/prepared\?\.checksum===checksum/);
 assert.match(independent,/whatsapp_history_commands_anchor/);
 assert.match(independent,/continue;/);
 assert.doesNotMatch(independent,/UPDATE tenant_module_installs|DELETE FROM tenant_module_installs/);
 assert.match(setup,/REASSIGN OWNED BY/);
 assert.doesNotMatch(setup,/DROP INDEX|ALTER ROLE.*SUPERUSER|process\.env\.DATABASE_URL/);
 const job=yaml.slice(yaml.indexOf('  devserver01-stage-core-runtime:'));
 assert.match(job,/needs: \[gate, devserver01-stage-runtime-foundation\]/);assert.match(job,/MO-REL04-STAGE-CORE-RUNTIME-APPROVED/);
 assert.match(job,/git ls-remote origin refs\/heads\/main/);
 // Foundation owns the immutable image. Only its dependent deploy may
 // run the stage Core mutating script for an approved release.
 assert.equal((yaml.match(/cp scripts\/deploy\/devserver01-stage-core.sh/g)||[]).length,1);
 for(const [exe,args] of [['bash',['-n','scripts/deploy/devserver01-stage-core.sh']],['node',['--check','scripts/deploy/staging-runtime/prepare-core.mjs']]])
  assert.equal(spawnSync(exe,args).status,0);
});
