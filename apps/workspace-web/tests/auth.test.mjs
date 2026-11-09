import { test } from "node:test";
import assert from "node:assert/strict";
import { finishLogin } from "../src/lib/auth.ts";

test("OIDC authorization code is exchanged only once for concurrent callers", async () => {
  const previous = {
    window: globalThis.window,
    sessionStorage: globalThis.sessionStorage,
    history: globalThis.history,
    fetch: globalThis.fetch,
  };
  const stored = new Map([
    ["syndes.workspace.pkce", JSON.stringify({ state: "valid", verifier: "pkce-verifier", created: Date.now() })],
  ]);
  let exchanges = 0;
  globalThis.window = { location: { search: "?code=single-use&state=valid", pathname: "/" } };
  globalThis.sessionStorage = {
    getItem: (name) => stored.get(name) ?? null,
    removeItem: (name) => { stored.delete(name); },
  };
  globalThis.history = { replaceState: () => { globalThis.window.location.search = ""; } };
  globalThis.fetch = async (url, args) => {
    exchanges++;
    assert.match(url, /openid-connect\/token$/);
    assert.equal(new URLSearchParams(args.body).get("code_verifier"), "pkce-verifier");
    return Response.json({ access_token: "signed-access-token" });
  };
  try {
    const config = { issuer: "https://idp.example/realms/syndes", clientId: "workspace", tenantId: "demo", tenantLabel: "Demo" };
    const [a, b] = await Promise.all([finishLogin(config), finishLogin(config)]);
    assert.equal(a, "signed-access-token");
    assert.equal(b, a);
    assert.equal(exchanges, 1);
    assert.equal(stored.size, 0);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
