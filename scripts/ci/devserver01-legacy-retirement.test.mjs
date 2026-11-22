import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("legacy retirement is limited to the expressly confirmed tenant", () => {
  const path = "scripts/deploy/devserver01-retire-confirmed-legacy-tenant.sh";
  const script = readFileSync(path, "utf8");
  assert.equal(spawnSync("bash", ["-n", path]).status, 0);
  assert.equal(spawnSync("bash", [path], {
    env: { ...process.env, SYNDES_LEGACY_RETIREMENT_APPROVAL: "" },
  }).status, 2);
  assert.match(script, /8d22676bfedb/);
  assert.match(script, /a7c825f1fa4d/);
  assert.match(script, /platform_legacy_single_organization/);
  assert.match(script, /datname='\$db' AND backend_type='client backend'/);
  assert.match(script, /ALLOW_CONNECTIONS false/);
  assert.doesNotMatch(script, /DROP DATABASE|DROP ROLE|DELETE FROM|ALTER ROLE/);
});
