import assert from "node:assert/strict";
import test from "node:test";
import {tenantUUID,PgMembership,FgaPermission,fgaResourceObject} from "../dist/adapters.js";
const id="4ab44379-d557-4df6-a2be-d44e121a8077";
const actor={id:"user-1",kind:"user"};
test("rejects client-selected or malformed database identifiers",()=>{assert.equal(tenantUUID(id),true);assert.equal(tenantUUID("tenant-a;DROP"),false)});
test("membership verifies SQL parameters and denies invalid tenant",async()=>{
 let queries=0;const db={query:async(_,args)=>{queries++;assert.deepEqual(args,[id,"user-1"]);return {rowCount:1}}};
 const s=new PgMembership(db);
 assert.equal(await s.canAccessTenant({actor,tenantId:id}),true);
 assert.equal(await s.canAccessTenant({actor,tenantId:"../other"}),false);
 assert.equal(queries,1);
});
test("OpenFGA query is scoped to tenant and action",async()=>{
 let key;const f=new FgaPermission("http://openfga:8080","test-store","key",async(_,opts)=>{
  key=JSON.parse(opts.body).tuple_key;return new Response(JSON.stringify({allowed:true}),{status:200});
 });
 assert.equal(await f.canAccess({actor,tenantId:id,action:"read",resource:"person:42"}),true);
 assert.equal(key.object,fgaResourceObject(id,"person:42"));assert.equal(key.relation,"can_read");assert.match(key.object,/^resource:[a-f0-9]{64}$/);
 assert.equal(await f.canAccess({actor,tenantId:id,action:"admin",resource:"person:42"}),false);
});
test("OpenFGA failures fail closed",async()=>{
 const f=new FgaPermission("http://openfga:8080","store","key",async()=>new Response("error",{status:503}));
 await assert.rejects(f.canAccess({actor,tenantId:id,action:"write",resource:"person:42"}),/unavailable/);
});
