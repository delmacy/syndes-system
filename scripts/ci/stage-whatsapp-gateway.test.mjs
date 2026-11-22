import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("stage WhatsApp gateway uses a private network and dedicated database", () => {
  const path = "scripts/deploy/devserver01-stage-whatsapp-gateway.sh";
  const script = readFileSync(path, "utf8");
  const compose = readFileSync("infra/multiorg-staging/whatsapp-compose.yaml", "utf8");
  assert.equal(spawnSync("bash", ["-n", path]).status, 0);
  assert.equal(spawnSync("bash", [path, "apply", "/tmp/nonexistent"], {
    env: { ...process.env, SYNDES_STAGE_WHATSAPP_APPROVAL: "" },
  }).status, 2);
  assert.match(script, /\.Internal/);
  assert.match(script, /label=syndes.environment=multi-org-staging/);
  assert.match(script, /whatsapp-gateway:19083\/healthz/);
  assert.match(script, /sha256sum -c MANIFEST\.sha256/);
  assert.doesNotMatch(compose, /^\s*(ports|external):/m);
  assert.match(compose, /internal: true/);
  assert.match(compose, /POSTGRES_DB: whatsapp_stage/);
});
