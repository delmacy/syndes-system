import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
test('stage acceptance refuses unauthenticated invocation and never restores over source',async()=>{
 const script='scripts/deploy/devserver01-stage-acceptance.sh';
 const denied=spawnSync('bash',[script,'verify','/tmp/nonexistent'],{env:{...process.env,SYNDES_STAGE_ACCEPTANCE_APPROVAL:''},encoding:'utf8'});
 assert.equal(denied.status,2);assert.equal(denied.stdout,'');
 const [shell,verify,compare,outage]=await Promise.all([
  readFile(script,'utf8'),readFile('scripts/deploy/staging-runtime/validate-core.mjs','utf8'),
  readFile('scripts/deploy/staging-runtime/compare-restore.mjs','utf8'),
  readFile('scripts/deploy/staging-runtime/outage.mjs','utf8')]);
 assert.match(shell,/EXPECTED_CORE_SHA/);assert.match(shell,/label=syndes.environment=multi-org-staging/);
 assert.match(shell,/CREATE DATABASE \$target OWNER postgres/);
 assert.match(shell,/pg_restore --exit-on-error/);
 assert.doesNotMatch(shell,/pg_restore.*--clean|DROP DATABASE|docker compose down|syndes_control\b/);
 assert.match(shell,/trap recover EXIT/);assert.match(shell,/docker unpause/);
 assert.match(verify,/STAGE_CORE_REAL_HTTP_IDP_FGA_SQL_WORKER_SSE_ACCEPTANCE_PASS/);
 assert.match(verify,/statuses:\[404\]/);assert.match(verify,/statuses:\[403\]/);
 assert.match(verify,/finally\{await fga/);assert.match(verify,/reconnected/);
 assert.match(verify,/new WhatsAppInboundStore\(provider\)/);
 assert.match(compare,/pairs.length!==5/);assert.match(compare,/jsonb_agg/);
 assert.match(outage,/count\(\)!==before/);assert.match(outage,/\[403,503\]/);
 for(const f of ['validate-core','compare-restore','outage'])assert.equal(spawnSync('node',['--check','scripts/deploy/staging-runtime/'+f+'.mjs']).status,0);
 assert.equal(spawnSync('bash',['-n',script]).status,0);
});
