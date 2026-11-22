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

test("legacy purge requires a suspended database and a verified gateway fence", () => {
  const path = "scripts/deploy/devserver01-purge-confirmed-legacy-database.sh";
  const script = readFileSync(path, "utf8");
  assert.equal(spawnSync("bash", ["-n", path]).status, 0);
  assert.equal(spawnSync("bash", [path], {
    env: { ...process.env, SYNDES_LEGACY_PURGE_APPROVAL: "" },
  }).status, 2);
  assert.match(script, /\[\[ "\$state" == suspended \]\]/);
  assert.match(script, /row.tenantId!==tenant/);
  assert.match(script, /account.enabled\|\|account.connected/);
  assert.ok(script.indexOf("DEVSERVER01_CONFIRMED_LEGACY_GATEWAY_ACCOUNTS_DISABLED") <
    script.indexOf('DROP DATABASE $db'));
  assert.doesNotMatch(script, /DROP DATABASE.*FORCE|DROP ROLE|DELETE FROM|ALTER ROLE/);
});
