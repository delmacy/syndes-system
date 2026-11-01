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

test("owner queue filters are sent to the tenant-scoped API, never chosen via actor input",async()=>{
  const seen=[];
  globalThis.fetch=async(url,options)=>{seen.push({url,options});return Response.json([])};
  const api=new TenantApi("tenant-a","signed-token",()=>assert.fail("Unexpected logout"));
  await api.conversations("pending","mine");
  await api.conversations("","unassigned");
  assert.equal(seen[0].url,"/v1/tenants/tenant-a/inbox/conversations?limit=100&status=pending&queue=mine");
  assert.equal(seen[1].url,"/v1/tenants/tenant-a/inbox/conversations?limit=100&queue=unassigned");
  assert.equal(seen[0].options.headers.Authorization,"Bearer signed-token");
  assert.ok(!seen[0].url.includes("assigneeId"));
});

test("CRM context reads only the current tenant person detail, notes and timeline",async()=>{
  const seen=[];
  globalThis.fetch=async url=>{seen.push(url);return Response.json([])};
  const api=new TenantApi("tenant-a","token",()=>assert.fail("Unexpected logout"));
  await Promise.all([api.person("person-id"),api.personNotes("person-id"),api.personTimeline("person-id")]);
  assert.deepEqual(seen.sort(),[
    "/v1/tenants/tenant-a/crm/people/person-id",
    "/v1/tenants/tenant-a/crm/people/person-id/notes",
    "/v1/tenants/tenant-a/crm/people/person-id/timeline",
  ].sort());
});

test("relationship and tag context reads stay within authenticated CRM tenant",async()=>{
 const calls=[];
 globalThis.fetch=async url=>{calls.push(url);return Response.json([])};
 const api=new TenantApi("tenant-a","access-token",()=>assert.fail("Unexpected logout"));
 await Promise.all([api.personOrganizations("person-id"),api.personTags("person-id")]);
 assert.deepEqual(calls.sort(),[
  "/v1/tenants/tenant-a/crm/people/person-id/organizations",
  "/v1/tenants/tenant-a/crm/people/person-id/tags",
 ].sort());
});
