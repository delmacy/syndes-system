import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

test('encrypted historical clone is isolated, authorized, compared, and cleaned',async()=>{
 const script='scripts/deploy/devserver01-stage-historical-clone.sh';
 const denied=spawnSync('bash',[script,'verify','/tmp/nonexistent'],{
  env:{...process.env,SYNDES_STAGE_HISTORICAL_CLONE_APPROVAL:''},encoding:'utf8'});
 assert.equal(denied.status,2);assert.equal(denied.stdout,'');
 const [shell,fixture]=await Promise.all([
  readFile(script,'utf8'),readFile('scripts/deploy/staging-runtime/historical-clone.mjs','utf8')]);
 assert.match(shell,/sha256sum -c MANIFEST.sha256/);
 assert.match(shell,/EXPECTED_CORE_SHA/);
 assert.match(shell,/syndes_hist_\$\{nonce\}_s/);
 assert.match(shell,/\[\[ "\$db" == "\$source" \|\| "\$db" == "\$target" \]\]/);
 assert.match(shell,/DROP DATABASE \$db/);
 assert.match(shell,/pg_dump .* -n historical -Fc/);
 assert.match(shell,/pg_restore --exit-on-error/);
 assert.match(shell,/psql -X --single-transaction -v ON_ERROR_STOP=1/);
 assert.match(shell,/operator compare/);assert.match(shell,/operator cutover-check/);
 assert.doesNotMatch(shell,/syndes_staging_control|syndes_tenant_[0-9a-f]{32}|docker compose down/);
 assert.match(fixture,/STAGE_HISTORICAL_SOURCE/);
 assert.match(fixture,/STAGE_HISTORICAL_TARGET/);
 assert.match(fixture,/assert.deepEqual\(s.rows,t.rows\)/);
 assert.match(fixture,/platform_backfill_legacy_ownership/);
 assert.equal(spawnSync('bash',['-n',script]).status,0);
 assert.equal(spawnSync('node',['--check','scripts/deploy/staging-runtime/historical-clone.mjs']).status,0);
});
