import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {TenantEventPublisher} from "../dist/platform-event-publisher.js";
test("publisher refuses query-only handles, even with a valid event",async()=>{
 const person=randomUUID(),tenantId=randomUUID(),organizationId=randomUUID();
 const publisher=new TenantEventPublisher();
 let called=false;
 await assert.rejects(publisher.publish({
  tenantId,query:async()=>{called=true;return {rows:[],rowCount:0}}
 },{
  tenantId,organizationId,aggregateType:"person",aggregateId:person,
  type:"crm.person.created.v1",producer:"crm",idempotencyKey:"create:"+person,
  correlationId:person,payload:{personId:person},
 }),/Pinned tenant transaction required/);
 assert.equal(called,false);
});
