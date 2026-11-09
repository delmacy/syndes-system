import test from "node:test";
import assert from "node:assert/strict";
import {AccessDeniedError} from "@syndes/core-kernel";
import {SupportService} from "../dist/service.js";
import {SupportInputError} from "../dist/domain.js";
const S="11111111-1111-4111-8111-111111111111",C="22222222-2222-4222-8222-222222222222";
const I={tenantId:S,actor:{id:"alice",kind:"user"}};
function harness({operationalTenantId=S,accountId=C,deny=null,dbTenant=S}={}){
 const calls=[],queries=[];
 const db={tenantId:dbTenant,async query(sql,args){queries.push({sql,args});return {rows:[],rowCount:0}}};
 const kernel={async execute(req,handler){
  calls.push(req);
  if(deny===req.resource||deny==="outage")throw new AccessDeniedError();
  return handler(req);
 }};
 let resolutions=0;
 const provider={async resolve(){resolutions++;return db}};
 const svc=new SupportService(kernel,provider,()=>({tenantId:operationalTenantId,whatsappAccountId:accountId}));
 return {svc,calls,queries,resolutions:()=>resolutions};
}
test("wrong tenant and missing Syndes config deny before FGA and DB",async()=>{
 const h=harness();
 await assert.rejects(h.svc.list({...I,tenantId:C},"internal",{}),AccessDeniedError);
 assert.equal(h.resolutions(),0);assert.equal(h.calls.length,0);
 for(const bad of ["","not-a-uuid"]){
  const x=harness({operationalTenantId:bad});
  await assert.rejects(x.svc.list(I,"internal",{}),AccessDeniedError);
  assert.equal(x.resolutions(),0);
 }
});
test("FGA denial or outage happens before database selection",async()=>{
 const h=harness({deny:"support:cases:internal"});
 await assert.rejects(h.svc.list(I,"internal",{}),AccessDeniedError);
 assert.equal(h.resolutions(),0);
 const e=harness({deny:"support:cases:external"});
 await assert.rejects(e.svc.createExternal(I,{conversationId:C,priority:"high"}),AccessDeniedError);
 assert.equal(e.resolutions(),0);
 const o=harness({deny:"outage"});
 await assert.rejects(o.svc.list(I,"internal",{}),AccessDeniedError);
 assert.equal(o.resolutions(),0);
});
test("trusted database mismatch denies read",async()=>{
 const h=harness({dbTenant:C});
 await assert.rejects(h.svc.list(I,"internal",{}),/Trusted Syndes database mismatch/);
});
test("create internal derives requester from verified principal",async()=>{
 const h=harness();
 await h.svc.createInternal(I,{queue:"it_infra",priority:"normal",description:"Senha do Wi-Fi"});
 assert.equal(h.calls[0].resource,"support:cases:internal");
 assert.equal(h.calls[0].action,"write");
 assert.equal(h.queries.length,1);
 assert.equal(h.queries[0].args[0],S);
 assert.equal(h.queries[0].args[3],"alice");
 assert.match(h.queries[0].sql,/support_case_events/);
 assert.doesNotMatch(h.queries[0].sql,/inbox_messages|whatsapp_outbox/);
});
test("external creation requires dedicated account and Inbox+CRM permissions",async()=>{
 const noAcc=harness({accountId:""});
 await assert.rejects(noAcc.svc.createExternal(I,{conversationId:C,priority:"normal"}),AccessDeniedError);
 assert.equal(noAcc.resolutions(),0);
 const h=harness();
 await h.svc.createExternal(I,{conversationId:C,priority:"high"});
 assert.deepEqual(h.calls.map(c=>[c.resource,c.action]),[
  ["support:cases:external","write"],["inbox:conversations","read"],["crm:people","read"]
 ]);
 assert.equal(h.queries.length,1);
 assert.ok(h.queries[0].args.includes(C));
 assert.match(h.queries[0].sql,/whatsapp_conversation_routes/);
 assert.match(h.queries[0].sql,/platform_workspace_memberships/);
 assert.match(h.queries[0].sql,/support_queue_memberships/);
});
test("lists filter by audience, tenant and queue before SQL pagination",async()=>{
 const h=harness();
 await h.svc.list(I,"external",{});
 assert.match(h.queries[0].sql,/support_queue_memberships/);
 assert.match(h.queries[0].sql,/c\.tenant_id/);
 assert.match(h.queries[0].sql,/c\.kind/);
 assert.equal(h.queries[0].args[1],"external");
});
test("notes/status/assignment/queue changes audit in the same SQL statement",async()=>{
 const h=harness();
 await h.svc.note(I,"internal",C,{body:"Somente equipe"});
 await h.svc.status(I,"internal",C,{status:"triage"});
 await h.svc.assign(I,"internal",C,{assigneeId:"alice"});
 await h.svc.transferQueue(I,"internal",C,{queue:"product"});
 for(const q of h.queries){
  assert.match(q.sql,/support_case_events/);
  assert.match(q.sql,/support_queue_memberships/);
  assert.doesNotMatch(q.sql,/whatsapp_outbox|inbox_messages/);
 }
});
test("requester-only history excludes internal notes at SQL boundary",async()=>{
 const h=harness();
 await h.svc.history(I,"internal",C);
 assert.match(h.queries[0].sql,/e.action<>'internal_note'/);
 assert.match(h.queries[0].sql,/support_queue_memberships/);
});
test("invalid state, foreign ID and unsupported filter reject before DB",async()=>{
 const h=harness();
 await assert.rejects(h.svc.status(I,"internal",C,{status:"deleted"}),SupportInputError);
 await assert.rejects(h.svc.get(I,"external","../../private"),SupportInputError);
 await assert.rejects(h.svc.list(I,"internal",{status:"archived"}),SupportInputError);
 assert.equal(h.resolutions(),0);
});
