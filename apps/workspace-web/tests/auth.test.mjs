import { test } from "node:test";
import assert from "node:assert/strict";
import { autoLoginAllowed, beginLogin, finishLogin, markSignedOut } from "../src/lib/auth.ts";

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


test("single sign-in starts automatically, preserves Inbox destination and respects explicit sign-out", async () => {
  const previous = { window: globalThis.window, sessionStorage: globalThis.sessionStorage };
  const stored = new Map();
  const redirects = [];
  globalThis.window = { location: {
    origin: "https://syndes.example", hash: "#inbox",
    assign: (url) => redirects.push(new URL(url)),
  } };
  globalThis.sessionStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  };
  try {
    assert.equal(autoLoginAllowed(), true);
    markSignedOut();
    assert.equal(autoLoginAllowed(), false);
    await beginLogin({ issuer: "https://idp.example/realms/syndes", clientId: "workspace", tenantId: "demo", tenantLabel: "Demo" });
    assert.equal(autoLoginAllowed(), true);
    assert.equal(redirects.length, 1);
    assert.equal(redirects[0].searchParams.get("redirect_uri"), "https://syndes.example/");
    assert.equal(redirects[0].searchParams.get("code_challenge_method"), "S256");
    assert.equal(JSON.parse(stored.get("syndes.workspace.pkce")).returnHash, "#inbox");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
