import test from "node:test";
import assert from "node:assert/strict";
import {WhatsAppOutboundRelay} from "../dist/outbound-relay.js";

const T1="00000000-0000-4000-8000-000000000001";
const T2="00000000-0000-4000-8000-000000000002";
const ACCOUNT1="00000000-0000-4000-8000-000000000011";
const ACCOUNT2="00000000-0000-4000-8000-000000000012";
const ID1="00000000-0000-4000-8000-000000000031";
const ID2="00000000-0000-4000-8000-000000000032";

function createTenant(tenantId,accountId,id) {
 const state={
  tenantId,id,accountId,
  status:"pending",gatewayQueueId:null,
  nextAttempt:0,attempts:0,
  externalMessageId:null,queries:[]
 };
 const db={
  tenantId,
  query:async(sql,args=[])=>{
   state.queries.push({sql,args});
   assert.equal(args[0],tenantId,"Every SQL operation must bind its trusted tenant");
   if(sql.includes("SELECT id::text")) {
    return {rows:state.status==="pending"||state.status==="processing" ? [{
     id,account_id:accountId,idempotency_key:"inbox:"+id,
     recipient_external_id:"5551999999999@s.whatsapp.net",
     body:"Mensagem de homologação simulada",
     status:state.status,gateway_queue_id:state.gatewayQueueId
    }]:[]};
   }
   if(sql.includes("SET gateway_queue_id")) {
    state.gatewayQueueId=String(args[2]);state.status="processing";
   } else if(sql.includes("status='sent'")) {
    state.status="sent";state.externalMessageId=args[2];
   } else if(sql.includes("status='failed'")) {
    state.status="failed";
   } else if(sql.includes("SET attempts=attempts+1")) {
    state.attempts++;
   }
   return {rows:[]};
  }
 };
 return {state,db};
}

test("two tenants queue separately and poll only own provider state",async()=>{
 const a=createTenant(T1,ACCOUNT1,ID1),b=createTenant(T2,ACCOUNT2,ID2);
 const calls=[];
 const gateway={
  sendQueued:async(tenant,account,payload)=>{
   calls.push({kind:"send",tenant,account,payload});
   return {queueId:tenant===T1?101:202};
  },
  outboundStatus:async(tenant,account,queueId)=>{
   calls.push({kind:"poll",tenant,account,queueId});
   return {status:"sent",externalMessageId:tenant===T1?"provider-A":"provider-B"};
  }
 };
 const provider={resolve:async tenant=>tenant===T1?a.db:tenant===T2?b.db:Promise.reject(Error("Unrecognized tenant"))};
 const relay=new WhatsAppOutboundRelay(provider,gateway);
 assert.equal(await relay.deliverNext(T1),"queued");
 assert.equal(await relay.deliverNext(T2),"queued");
 assert.equal(await relay.deliverNext(T2),"sent");
 assert.equal(await relay.deliverNext(T1),"sent");
 assert.equal(a.state.externalMessageId,"provider-A");
 assert.equal(b.state.externalMessageId,"provider-B");
 assert.deepEqual(calls.filter(c=>c.kind==="send").map(c=>[c.tenant,c.account,c.payload.idempotencyKey]),
  [[T1,ACCOUNT1,"inbox:"+ID1],[T2,ACCOUNT2,"inbox:"+ID2]]);
 assert.deepEqual(calls.filter(c=>c.kind==="poll").map(c=>[c.tenant,c.account,c.queueId]),
  [[T2,ACCOUNT2,202],[T1,ACCOUNT1,101]]);
 assert.equal(await relay.deliverNext(T1),"empty");
 assert.equal(await relay.deliverNext(T2),"empty");
 assert.equal(calls.filter(c=>c.kind==="send").length,2,"Sent records must not be queued again");
});
test("gateway timeout retains the same idempotency key and never confirms delivery",async()=>{
 const a=createTenant(T1,ACCOUNT1,ID1);
 let attempts=0;
 const keys=[];
 const gateway={
  sendQueued:async(_tenant,_account,payload)=>{
   keys.push(payload.idempotencyKey);
   if(++attempts===1)throw new Error("Gateway timeout after unknown ACK");
   return {queueId:101};
  },
  outboundStatus:async()=>({status:"sent",externalMessageId:"WA-confirmed"})
 };
 const relay=new WhatsAppOutboundRelay({resolve:async()=>a.db},gateway);
 assert.equal(await relay.deliverNext(T1),"retry");
 assert.equal(a.state.status,"pending");
 assert.equal(a.state.attempts,1);
 assert.equal(a.state.externalMessageId,null);
 assert.match(a.state.queries.at(-1).sql,/next_attempt_at=clock_timestamp\(\)\+make_interval/);
 assert.equal(await relay.deliverNext(T1),"queued");
 assert.equal(await relay.deliverNext(T1),"sent");
 assert.deepEqual(keys,["inbox:"+ID1,"inbox:"+ID1]);
 assert.equal(a.state.externalMessageId,"WA-confirmed");
});
test("failure remains terminal and never blindly resends to a customer",async()=>{
 const a=createTenant(T1,ACCOUNT1,ID1);
 let queues=0;
 const gateway={
  sendQueued:async()=>{queues++;return {queueId:101}},
  outboundStatus:async()=>({status:"failed"})
 };
 const relay=new WhatsAppOutboundRelay({resolve:async()=>a.db},gateway);
 assert.equal(await relay.deliverNext(T1),"queued");
 assert.equal(await relay.deliverNext(T1),"failed");
 assert.equal(await relay.deliverNext(T1),"empty");
 assert.equal(queues,1);
 assert.equal(a.state.status,"failed");
 assert.equal(a.state.externalMessageId,null);
});
test("fake tenant database lease is rejected before processing another tenant's outbound",async()=>{
 const a=createTenant(T1,ACCOUNT1,ID1);
 const relay=new WhatsAppOutboundRelay({resolve:async()=>a.db},{sendQueued:async()=>assert.fail("sent"),outboundStatus:async()=>assert.fail("polled")});
 await assert.rejects(relay.deliverNext(T2),/Tenant database mismatch/);
 assert.equal(a.state.queries.length,0);
});
