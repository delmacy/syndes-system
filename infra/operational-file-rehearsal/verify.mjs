import assert from "node:assert/strict";
import pg from "/workspace/apps/core-host/node_modules/pg/lib/index.js";
import { loadConfiguredCoreSecrets, readCredentialFile } from "/workspace/apps/core-host/dist/secrets.js";
import { expectedTenantDatabase, TenantPgProvider } from "/workspace/apps/core-host/dist/tenant-database.js";

const BASE = "http://openfga:8080";
const PILOT = "1f5a8ce9-3f01-48cc-a013-2198d99e7510";
const SECOND = "f986808f-2cab-4c9a-ba9f-9744b6d3584d";

async function request(url, init = {}) {
  return fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(5000) });
}

async function ready(url, assertion) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const res = await request(url);
      if (res.ok && assertion(await res.json())) return;
    } catch { /* Wait for this disposable service to start. */ }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error("Service did not become ready");
}

async function seedStore(token) {
  const result = await request(BASE + "/stores", {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify({ name: "credential-rehearsal" }),
  });
  assert.equal(result.status, 201);
  const { id } = await result.json();
  assert.match(id, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  console.log(id);
}

async function tenantIsolation(controlDbUrl) {
  const control = new pg.Pool({ connectionString: controlDbUrl, connectionTimeoutMillis: 2500 });
  const provider = new TenantPgProvider({ db: control });
  try {
    const identity = expectedTenantDatabase(PILOT);
    const tenant = await provider.resolve(PILOT);
    const { rows } = await tenant.query("SELECT current_user AS role, current_database() AS db", []);
    assert.deepEqual(rows, [{ role: identity.role_name, db: identity.database_name }]);

    // Both fixture tenants are active in Control. The second has no file made
    // available to the app, so the file provider must deny it before SQL.
    await assert.rejects(() => provider.resolve(SECOND), /credential file/);
    const pilot = await readCredentialFile("/run/secrets/operational-tenants/" + PILOT + ".json", "production");
    const foreign = new pg.Client({
      host: "syndes-postgres", user: identity.role_name, password: pilot.password,
      database: expectedTenantDatabase(SECOND).database_name, connectionTimeoutMillis: 2500,
    });
    try {
      await assert.rejects(() => foreign.connect(), error => error.code === "42501");
    } finally {
      await foreign.end();
    }
  } finally {
    await provider.onModuleDestroy();
    await control.end();
  }
}

let phase = "credential-files";
try {
  const mode = process.argv[2];
  const { openfgaToken, controlDbUrl } = await loadConfiguredCoreSecrets();
  if (mode === "seed") {
    phase = "openfga-seed";
    await ready(BASE + "/healthz", obj => obj.status === "SERVING");
    await seedStore(openfgaToken);
  } else if (mode === "verify") {
    phase = "core-readiness";
    await ready("http://127.0.0.1:8082/readyz", obj => obj.status === "ready");
    phase = "keycloak-jwks";
    await ready(process.env.CORE_KEYCLOAK_JWKS_URL, obj => obj.keys.some(key => key.kty === "RSA"));
    phase = "openfga-store";
    const storeId = process.env.CORE_OPENFGA_STORE_ID;
    const endpoint = BASE + "/stores/" + storeId;
    const anonymous = await request(endpoint);
    assert.ok([401, 403].includes(anonymous.status));
    const authorized = await request(endpoint, { headers: { authorization: "Bearer " + openfgaToken } });
    assert.equal(authorized.status, 200);
    assert.equal((await authorized.json()).id, storeId);
    phase = "core-anonymous";
    const protectedRoute = "http://127.0.0.1:8082/v1/tenants/" + PILOT + "/inbox/conversations";
    assert.equal((await request(protectedRoute)).status, 401);
    phase = "tenant-sql";
    await tenantIsolation(controlDbUrl);
    console.log("OPERATIONAL_REHEARSAL_HTTP_JWKS_FGA_AND_TENANT_SQL_PASS");
  } else {
    throw new Error("Unexpected rehearsal command");
  }
} catch {
  console.error("OPERATIONAL_REHEARSAL_PROBE_FAILED=" + phase);
  process.exitCode = 2;
}
