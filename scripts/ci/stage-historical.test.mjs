import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

test('historical stage drill is authorized and rollback-only',async()=>{
 const script='scripts/deploy/devserver01-stage-historical.sh';
 const rejected=spawnSync('bash',[script,'verify','/tmp/nonexistent'],{
  env:{...process.env,SYNDES_STAGE_HISTORICAL_APPROVAL:''},encoding:'utf8'});
 assert.equal(rejected.status,2);
 assert.equal(rejected.stdout,'');
 const [shell,fixture]=await Promise.all([
  readFile(script,'utf8'),readFile('scripts/deploy/staging-runtime/historical-cutover.mjs','utf8')]);
 assert.match(shell,/EXPECTED_CORE_SHA/);
 assert.match(shell,/label=syndes.environment=multi-org-staging/);
 assert.match(shell,/sha256sum -c MANIFEST.sha256/);
 assert.doesNotMatch(shell,/DROP DATABASE|CREATE DATABASE|docker compose down|syndes_control\b/);
 assert.match(fixture,/database:'postgres'/);
 assert.match(fixture,/await client.query\('ROLLBACK'\)/);
 assert.match(fixture,/SELECT to_regnamespace/);
 assert.match(fixture,/platform_backfill_legacy_ownership/);
 assert.match(fixture,/activate_multiple_organizations.sql/);
 for(const release of ['008_iam07d_revoke_first_candidate','009_iam_multiorg_fence_candidate','010_iam07d_cutover_capabilities_candidate'])
  assert.match(fixture,new RegExp(release));
 assert.equal(spawnSync('bash',['-n',script]).status,0);
 assert.equal(spawnSync('node',['--check','scripts/deploy/staging-runtime/historical-cutover.mjs']).status,0);
});
