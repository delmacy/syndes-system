import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("history schema preparation is stage-only and leaves runtime admission untouched", () => {
  const path = "scripts/deploy/devserver01-stage-history-schema.sh";
  const script = readFileSync(path, "utf8");
  assert.equal(spawnSync("bash", ["-n", path]).status, 0);
  assert.equal(spawnSync("bash", [path, "apply", "/tmp/nonexistent"], {
    env: { ...process.env, SYNDES_STAGE_HISTORY_SCHEMA_APPROVAL: "" },
  }).status, 2);
  assert.match(script, /label=syndes.environment=multi-org-staging/);
  assert.match(script, /--single-transaction -v ON_ERROR_STOP=1/);
  assert.match(script, /_syndes\.stage_bootstrap_receipts/);
  assert.match(script, /migration_id='008_whatsapp_projection_owner'/);
  assert.match(script, /STAGE_WHATSAPP_HISTORY_SCHEMA_PREPARED_RUNTIME_FLAG_PENDING/);
  assert.doesNotMatch(script, /DROP DATABASE|INSERT INTO platform_iam_capability_fences|SYNDES_MULTI_ORG_HISTORY_SYNC=true|docker restart/);
});
