import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { TenantApi, ApiError } from "../src/lib/api.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("requests are always scoped to the configured tenant and carry Bearer auth", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json([{ id: "person-1", name: "Ana" }]);
  };
  const api = new TenantApi("tenant-uuid-example", "test-bearer", () => assert.fail("unexpected logout"));
  const people = await api.people("Ana & Cia");
  assert.equal(people[0].name, "Ana");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/v1/tenants/tenant-uuid-example/crm/people?limit=100&q=Ana%20%26%20Cia");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-bearer");
  assert.equal(calls[0].options.cache, "no-store");
});

test("a failed authorization is not retried with another tenant", async () => {
  let calls = 0;
  let logouts = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ message: "Forbidden" }, { status: 403 }); };
  const api = new TenantApi("tenant-a", "token", () => { logouts++; });
  await assert.rejects(api.conversations(), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 403);
    assert.match(err.message, /permissão/);
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(logouts, 0);
});

test("a 401 invalidates the session and rejects the request", async () => {
  let logouts = 0;
  globalThis.fetch = async () => new Response(null, { status: 401 });
  const api = new TenantApi("tenant-a", "expired-token", () => { logouts++; });
  await assert.rejects(api.metrics(), (err) => err instanceof ApiError && err.status === 401);
  assert.equal(logouts, 1);
});

test("writes use tenant path, JSON, and never derive tenant from supplied record", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({ id: "person-2", name: "João" }, { status: 201 });
  };
  const api = new TenantApi("tenant-main", "token", () => assert.fail("unexpected logout"));
  await api.createPerson({ name: "João" });
  assert.equal(request.url, "/v1/tenants/tenant-main/crm/people");
  assert.equal(request.options.method, "POST");
  assert.deepEqual(JSON.parse(request.options.body), { name: "João" });
  assert.equal(request.options.headers["Content-Type"], "application/json");
});

test("handoff and detail use tenant-scoped Inbox routes", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return Response.json({ id: "conversation-id", status: "pending", handoff: "bot" });
  };
  const api = new TenantApi("tenant-main", "token", () => assert.fail("Unexpected logout"));
  await api.conversation("conversation-id");
  await api.setHandoff("conversation-id", "bot");
  assert.equal(requests[0].url, "/v1/tenants/tenant-main/inbox/conversations/conversation-id");
  assert.equal(requests[0].options.method, "GET");
  assert.equal(requests[1].url, "/v1/tenants/tenant-main/inbox/conversations/conversation-id/handoff");
  assert.equal(requests[1].options.method, "PATCH");
  assert.deepEqual(JSON.parse(requests[1].options.body), { mode: "bot" });
});
