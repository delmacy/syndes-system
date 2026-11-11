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
  await api.conversations("","all","groups",100,"grupo de suporte");
  assert.equal(seen[0].url,"/v1/tenants/tenant-a/inbox/conversations?limit=100&status=pending&queue=mine&scope=all&offset=0&q=");
  assert.equal(seen[1].url,"/v1/tenants/tenant-a/inbox/conversations?limit=100&queue=unassigned&scope=all&offset=0&q=");
  assert.equal(seen[2].url,"/v1/tenants/tenant-a/inbox/conversations?limit=100&queue=all&scope=groups&offset=100&q=grupo%20de%20suporte");
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

test("CRM pagination and relation unlink endpoints stay inside the active tenant",async()=>{
 const calls=[];
 globalThis.fetch=async (url,opts)=>{calls.push({url,opts});return Response.json(true)};
 const api=new TenantApi("tenant-main","token",()=>assert.fail("Unexpected logout"));
 await api.people("Ana",25,25);
 await api.organizations("Empresa",50,25);
 await api.unlinkPersonOrganization("person-id","org-id");
 await api.unlinkPersonTag("person-id","tag-id");
 await api.crmCapabilities();
 await api.crmAllTags();
 assert.equal(calls[0].url,"/v1/tenants/tenant-main/crm/people?limit=25&q=Ana&offset=25");
 assert.equal(calls[1].url,"/v1/tenants/tenant-main/crm/organizations?limit=25&q=Empresa&offset=50");
 assert.equal(calls[2].url,"/v1/tenants/tenant-main/crm/people/person-id/organizations/org-id");
 assert.equal(calls[2].opts.method,"DELETE");
 assert.equal(calls[3].url,"/v1/tenants/tenant-main/crm/people/person-id/tags/tag-id");
 assert.equal(calls[4].url,"/v1/tenants/tenant-main/crm/capabilities");
 assert.equal(calls[5].url,"/v1/tenants/tenant-main/crm/tags");
});

test("SSE stream authenticates via Bearer and only dispatches change-only frames",async()=>{
 const seen=[];const invalidations=[];
 const encoder=new TextEncoder();
 globalThis.fetch=async(url,options)=>{
   seen.push({url,options});
   return new Response(new ReadableStream({
     start(controller){
       controller.enqueue(encoder.encode([": connected","","event: changed","data: {}","",""].join("\n")));
       controller.close();
     }
   }),{status:200,headers:{"content-type":"text/event-stream"}});
 };
 const api=new TenantApi("tenant-abc","jwt-token",()=>assert.fail("unexpected logout"));
 const abort=new AbortController();
 await api.watchInbox(abort.signal,()=>invalidations.push("changed"));
 assert.equal(seen[0].url,"/v1/tenants/tenant-abc/inbox/events");
 assert.equal(seen[0].options.headers.Authorization,"Bearer jwt-token");
 assert.deepEqual(invalidations,["changed"]);
});

test("group reads and confirmed edits stay in the authenticated tenant WhatsApp scope",async()=>{
 const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url,options});
  return Response.json({jid:"120363012345678901@g.us",name:"Grupo WhatsApp",description:"",participantCount:5,canEdit:true,locked:false,announce:false});
 };
 const api=new TenantApi("tenant-a","authorized",()=>assert.fail("Unexpected logout"));
 await api.whatsappGroupInfo("conversation-id");
 await api.updateWhatsAppGroup("conversation-id",{name:"Novo grupo"});
 await api.updateWhatsAppGroup("conversation-id",{description:"Nova descrição"});
 assert.equal(calls[0].url,"/v1/tenants/tenant-a/whatsapp/conversations/conversation-id/group");
 assert.equal(calls[0].options.method,"GET");
 assert.equal(calls[1].options.method,"PATCH");
 assert.deepEqual(JSON.parse(calls[1].options.body),{name:"Novo grupo"});
 assert.deepEqual(JSON.parse(calls[2].options.body),{description:"Nova descrição"});
 assert.ok(calls.every(c=>c.options.headers.Authorization==="Bearer authorized"));
});

test("disposing a scoped client aborts GET requests and prevents stale bodies even if fetch ignores abort", async () => {
  let release;
  let signal;
  globalThis.fetch = async (_url, options) => {
    signal = options.signal;
    await new Promise(resolve => { release = resolve; });
    return Response.json([{ id: "stale", name: "Outdated Scope" }]);
  };
  const root = new TenantApi("tenant-a", "token", () => assert.fail("stale request must not log out"));
  const a = root.forWorkspace({ organizationId: "org-a", workspaceId: "ws-a" });
  const pending = a.people();
  assert.equal(signal.aborted, false);
  a.dispose();
  assert.equal(signal.aborted, true);
  release();
  await assert.rejects(pending, e => e?.name === "AbortError");
  await assert.rejects(a.people(), e => e?.name === "AbortError");
  const b = root.forWorkspace({ organizationId: "org-b", workspaceId: "ws-b" });
  globalThis.fetch = async (_, options) => {
    assert.equal(options.signal.aborted, false);
    assert.equal(options.headers["x-syndes-organization-id"], "org-b");
    return Response.json([{ id: "fresh", name: "Current Scope" }]);
  };
  assert.equal((await b.people())[0].name, "Current Scope");
  root.dispose();
  await assert.rejects(root.platformOrganizations(), e => e?.name === "AbortError");
  assert.equal(b.disposed, true, "logout invalidates every scope derived from the same session");
  await assert.rejects(b.people(), e => e?.name === "AbortError");
});

test("a late 401 from the previous workspace never logs out the new workspace", async () => {
  let resolveRequest;
  let logoutCalls = 0;
  globalThis.fetch = async () => await new Promise(resolve => { resolveRequest = resolve; });
  const a = new TenantApi("tenant-a", "token", () => { logoutCalls++; });
  const pending = a.metrics();
  a.dispose();
  resolveRequest(new Response(null, { status: 401 }));
  await assert.rejects(pending, e => e?.name === "AbortError");
  assert.equal(logoutCalls, 0);
});

test("late 401 delivered after body parsing is also ignored on disposed clients", async () => {
  let release;
  globalThis.fetch = async () => ({
    status: 503, ok: false,
    json: () => new Promise(resolve => { release = resolve; }),
  });
  const api = new TenantApi("tenant-a", "token", () => assert.fail("old scope must be silent"));
  const pending = api.conversations();
  // Fetch has already returned an error response and is waiting for its body.
  await new Promise(resolve => setImmediate(resolve));
  api.dispose();
  release({ message: "stale failure" });
  await assert.rejects(pending, e => e?.name === "AbortError");
});

test("CSV exports and in-flight writes cannot deliver stale responses", async () => {
  let releaseCsv;
  const api = new TenantApi("tenant-a", "token", () => assert.fail("unexpected logout"));
  globalThis.fetch = async (_, options) => {
    assert.ok(options.signal);
    return { ok: true, status: 200, text: () => new Promise(resolve => { releaseCsv = resolve; }) };
  };
  const csv = api.exportPeopleCsv();
  await new Promise(resolve => setImmediate(resolve));
  api.dispose();
  releaseCsv("PRIVATE_OLD_SCOPE_RECORD");
  await assert.rejects(csv, e => e?.name === "AbortError");

  let releaseWrite;
  let writeSignal;
  globalThis.fetch = async (_, options) => {
    writeSignal = options.signal;
    return await new Promise(resolve => { releaseWrite = resolve; });
  };
  const scoped = new TenantApi("tenant-b", "token", () => assert.fail("unexpected logout"));
  const pending = scoped.createPerson({ name: "Ana" });
  scoped.dispose();
  assert.equal(writeSignal.aborted, true);
  // Aborting a local mutation does NOT guarantee server-side transaction rollback.
  releaseWrite(Response.json({ id: "p1", name: "Ana" }, { status: 201 }));
  await assert.rejects(pending, e => e?.name === "AbortError");
});

test("disposing a context stops SSE callbacks even if a test transport ignores the abort", async () => {
  const api = new TenantApi("tenant-a", "token", () => assert.fail("unexpected logout"));
  let stream;
  let linkedSignal;
  const callbacks = [];
  globalThis.fetch = async (_url, options) => {
    linkedSignal = options.signal;
    return new Response(new ReadableStream({ start(controller) { stream = controller; } }),
      { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  const external = new AbortController();
  const pending = api.watchInbox(external.signal, () => callbacks.push("change"));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(linkedSignal.aborted, false);
  stream.enqueue(new TextEncoder().encode("event: changed\ndata: {}\n\n"));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(callbacks, ["change"]);
  api.dispose();
  assert.equal(linkedSignal.aborted, true);
  try { stream.enqueue(new TextEncoder().encode("event: changed\ndata: {}\n\n")); }
  catch { /* A real fetch stream is cancelled when the connection is aborted. */ }
  await pending;
  assert.deepEqual(callbacks, ["change"]);
});

test("disposing the session root cancels outstanding scoped streams and requests immediately", async () => {
  const root = new TenantApi("tenant-a", "token", () => assert.fail("unexpected logout"));
  const scoped = root.forWorkspace({ organizationId: "org-a", workspaceId: "ws-a" });
  let resolveStale;
  let requestSignal;
  globalThis.fetch = async (_url, options) => {
    requestSignal = options.signal;
    return new Promise(resolve => { resolveStale = resolve; });
  };
  const pending = scoped.conversations();
  assert.equal(requestSignal.aborted, false);
  root.dispose();
  assert.equal(requestSignal.aborted, true);
  assert.equal(scoped.disposed, true);
  resolveStale(Response.json([{ id: "stale", subject: "old data" }]));
  await assert.rejects(pending, e => e?.name === "AbortError");
  await assert.rejects(scoped.watchInbox(new AbortController().signal, () => {}), e => e?.name === "AbortError");
});

test("already aborted external SSE signal never starts a fetch", async () => {
  const controller = new AbortController();
  controller.abort();
  const api = new TenantApi("tenant-a", "token", () => assert.fail("unexpected logout"));
  globalThis.fetch = async () => assert.fail("an aborted SSE should not be fetched");
  await api.watchInbox(controller.signal, () => assert.fail("no callback"));
});
