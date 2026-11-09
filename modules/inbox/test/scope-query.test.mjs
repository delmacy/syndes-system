import test from "node:test";
import assert from "node:assert/strict";
import {inboxScopedQuery} from "../dist/scope-query.js";
import {InboxTenantMismatchError} from "../dist/contracts.js";
const T="11111111-1111-4111-8111-111111111111",O="22222222-2222-4222-8222-222222222222",W="33333333-3333-4333-8333-333333333333";
const scope={organizationId:O,workspaceId:W};
test("Inbox org + current workspace bound in SQL with no interpolated user values",async()=>{
 const seen=[];
 const db={tenantId:T,query:async(sql,params)=>{seen.push({sql,params});return {rows:[]}}};
 await inboxScopedQuery(db,scope,"SELECT 1 WHERE id=$1::uuid /*SCOPE: AND org=@@ORG@@ AND workspace=@@WS@@*/",[T]);
 assert.deepEqual(seen[0].params,[T,O,W]);
 assert.match(seen[0].sql,/org=\$2::uuid AND workspace=\$3::uuid/);
 assert.doesNotMatch(seen[0].sql,new RegExp(O));
 assert.doesNotMatch(seen[0].sql,/@\@|\/\*SCOPE/);
});
test("legacy direct callers retain plain SQL, partial owner scope must fail closed",async()=>{
 const seen=[];
 const db={tenantId:T,query:async(sql,params)=>{seen.push({sql,params});return {rows:[]}}};
 await inboxScopedQuery(db,undefined,"SELECT 1 /*SCOPE:WHERE org=@@ORG@@ AND ws=@@WS@@*/",[]);
 assert.equal(seen[0].sql.trim(),"SELECT 1");
 assert.throws(()=>inboxScopedQuery(db,{organizationId:O},"SELECT 1 /*SCOPE: WHERE org=@@ORG@@ AND ws=@@WS@@*/",[]),InboxTenantMismatchError);
 assert.throws(()=>inboxScopedQuery(db,scope,"SELECT 1",[]),/lacks organization\/workspace/);
 assert.throws(()=>inboxScopedQuery(db,scope,"SELECT 1 /*SCOPE: WHERE org=@@ORG@@*/",[]),/lacks organization\/workspace/);
 assert.throws(()=>inboxScopedQuery(db,scope,"SELECT 1 /*SCOPE: WHERE ws=@@WS@@*/",[]),/lacks organization\/workspace/);
 assert.throws(()=>inboxScopedQuery(db,{organizationId:"'; DROP TABLE x;",workspaceId:W},"SELECT 1 /*SCOPE: WHERE org=@@ORG@@ AND ws=@@WS@@*/",[]),InboxTenantMismatchError);
 assert.equal(seen.length,1,"all invalid scopes rejected before DB");
});

test("a concurrent inbound dedup winner becomes visible in a second SQL snapshot, still scoped",async()=>{
 const {PgInboxRepository,InboxConflictError}=await import("../dist/postgres.js");
 const key="44444444-4444-4444-8444-444444444444";
 const id="55555555-5555-4555-8555-555555555555";
 const queries=[];
 const db={tenantId:T,query:async(sql,params)=>{
  queries.push({sql,params});
  if(queries.length===1)return {rows:[],rowCount:0};
  return {rows:[{
   tenant_id:T,id,conversation_id:key,direction:"inbound",
   body:"Mesma mensagem",author_id:"simulator",external_message_id:"same",
   created_at:"2026-11-09T12:00:00.000Z"
  }],rowCount:1};
 }};
 const repo=new PgInboxRepository(db,scope);
 const result=await repo.append(T,key,"simulator",{
  id:"66666666-6666-4666-8666-666666666666",
  direction:"inbound",body:"Mesma mensagem",externalMessageId:"same"});
 assert.equal(result.id,id);
 assert.equal(queries.length,2);
 assert.match(queries[1].sql,/c\.platform_organization_id=\$\d+::uuid/);
 assert.match(queries[1].sql,/c\.platform_current_workspace_id=\$\d+::uuid/);
 assert.deepEqual(queries[1].params,[T,key,"same",O,W]);
 const conflictDb={tenantId:T,query:async(sql,params)=>
  sql.includes("SELECT m.* FROM inbox_messages")?db.query(sql,params):{rows:[],rowCount:0}};
 const conflict=new PgInboxRepository(conflictDb,scope);
 await assert.rejects(conflict.append(T,key,"simulator",{
  id:"77777777-7777-4777-8777-777777777777",
  direction:"inbound",body:"Texto diferente",externalMessageId:"same"}),InboxConflictError);
});
