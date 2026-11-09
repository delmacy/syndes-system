import test from "node:test";
import assert from "node:assert/strict";
import {validReceiptEnvelope} from "../dist/inbound-contract.js";
import {WhatsAppInboxProjection} from "../dist/dispatch.js";
import {WhatsAppReplyQueue} from "../dist/outbound-reply.js";
const tenantId="00000000-0000-4000-8000-000000000001";
const accountId="00000000-0000-4000-8000-000000000011";
const msgId="11111111-1111-4111-8111-111111111111";
const jid="5551999999999@s.whatsapp.net";
const receipt=(status)=>({version:"1",type:"whatsapp.message.receipt",tenantId,accountId,
 receipt:{accountId,providerMessageId:"actual-provider-id",chatExternalId:jid,status}});
test("accepts only tenant-bound WhatsApp delivery and read receipts",()=>{
 assert.ok(validReceiptEnvelope(tenantId,receipt("delivered")));
 assert.ok(validReceiptEnvelope(tenantId,receipt("read")));
 for(const e of [
  {...receipt("read"),tenantId:"00000000-0000-4000-8000-000000000099"},
  {...receipt("read"),receipt:{...receipt("read").receipt,accountId:"00000000-0000-4000-8000-000000000099"}},
  receipt("sent"),receipt("unknown"),
  {...receipt("read"),receipt:{...receipt("read").receipt,providerMessageId:""}},
  {...receipt("read"),receipt:{...receipt("read").receipt,chatExternalId:"test@newsletter"}}
 ])assert.equal(validReceiptEnvelope(tenantId,e),false);
});
test("receipt projection only stores provider-confirmed status; read is monotonic",async()=>{
 const statements=[];
 const db={tenantId,query:async(sql,args)=>{
  statements.push({sql,args});
  if(statements.length===1)return {rows:[{id:7,payload:receipt("read")}]};
  return {rows:[{id:7}]};
 }};
 const result=await new WhatsAppInboxProjection({resolve:async()=>db}).deliverNext(tenantId);
 assert.equal(result,"delivered");
 const {sql,args}=statements[1];
 assert.match(sql,/INSERT INTO whatsapp_delivery_receipts/);
 assert.match(sql,/ON CONFLICT\(tenant_id,account_id,provider_message_id\)/);
 assert.match(sql,/EXCLUDED.status='read'/);
 assert.doesNotMatch(sql,/INSERT INTO inbox_messages|INSERT INTO inbox_conversations/);
 assert.deepEqual(args,[tenantId,7,"actual-provider-id",jid,"read"]);
});
test("outbound status is upgraded only for same tenant/account/provider ID and sent outbox",async()=>{
 const statements=[];
 const db={tenantId,query:async(sql,args)=>{
  statements.push({sql,args});
  return {rows:[{message_id:msgId,status:"delivered"}]};
 }};
 const [message]=await new WhatsAppReplyQueue({resolve:async()=>db}).decorate(tenantId,
  [{id:msgId,direction:"outbound",source:"local"}]);
 assert.equal(message.deliveryStatus,"delivered");
 assert.match(statements[0].sql,/o.status='sent'/);
 assert.match(statements[0].sql,/d.account_id=r.account_id/);
 assert.match(statements[0].sql,/r.tenant_id=m.tenant_id/);
 assert.match(statements[0].sql,/d.provider_message_id=COALESCE\(o.external_message_id,m.provider_message_id\)/);
 assert.deepEqual(statements[0].args,[tenantId,[msgId]]);
});


test("synced outgoing messages use provider receipts without inventing delivery from history",async()=>{
 const statuses=["read","synced"];
 let n=0;
 const db={tenantId,query:async()=>({rows:[{message_id:msgId,status:statuses[n++]}]})};
 const service=new WhatsAppReplyQueue({resolve:async()=>db});
 const message={id:msgId,direction:"outbound",source:"history"};
 assert.equal((await service.decorate(tenantId,[message]))[0].deliveryStatus,"read");
 assert.equal((await service.decorate(tenantId,[message]))[0].deliveryStatus,"synced");
});
