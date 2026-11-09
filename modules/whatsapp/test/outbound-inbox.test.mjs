import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {WhatsAppReplyQueue} from "../dist/outbound-reply.js";
import {WhatsAppOutboundRelay} from "../dist/outbound-relay.js";
const tenantId="00000000-0000-4000-8000-000000000001";
const conversationId="00000000-0000-4000-8000-000000000020";
const accountId="00000000-0000-4000-8000-000000000011";
const messageId="00000000-0000-4000-8000-000000000030";
const owner="user-1";
const sender="5511999999999@s.whatsapp.net";
const ctx={tenantId,actor:{id:owner}};
test("WhatsApp reply inserts Inbox message and durable gateway intent atomically",async()=>{
 const queries=[];
 const provider={resolve:async()=>({tenantId,query:async(sql,params)=>{
  queries.push({sql,params});
  if(sql.includes("SELECT 1 FROM whatsapp_conversation_routes"))return {rows:[{exists:1}]};
  return {rows:[{id:messageId,tenant_id:tenantId,conversation_id:conversationId,
   body:"resposta",author_id:owner,created_at:new Date("2026-11-03T19:00:00Z")}]};
 }})};
 const r=await new WhatsAppReplyQueue(provider).enqueue(ctx,conversationId,"resposta");
 assert.equal(r?.body,"resposta");
 assert.equal(queries.length,2);
 const q=queries[1];
 assert.match(q.sql,/WITH target AS/);
 assert.match(q.sql,/JOIN whatsapp_conversation_routes r ON r.tenant_id=c.tenant_id/);
 assert.match(q.sql,/c.assigned_to=\$3/);
 assert.match(q.sql,/a.service_enabled=true/);
 assert.match(q.sql,/INSERT INTO inbox_messages/);
 assert.match(q.sql,/INSERT INTO whatsapp_outbox/);
 assert.match(q.sql,/inbox_message_id/);
 assert.match(q.sql,/reply_queued/);
 assert.deepEqual(q.params.slice(0,3),[tenantId,conversationId,owner]);
});
test("old inbound thread route can be recovered only from processed matching tenant events",async()=>{
 const queries=[];
 const thread=createHash("sha256").update(accountId+"|"+sender).digest("hex");
 const provider={resolve:async()=>({tenantId,query:async(sql,params)=>{
  queries.push({sql,params});
  if(sql.includes("SELECT 1 FROM whatsapp_conversation_routes"))return {rows:[]};
  if(sql.includes("SELECT external_thread_id"))return {rows:[{external_thread_id:thread}]};
  if(sql.includes("FROM whatsapp_inbound_events"))return {rows:[{account_id:accountId,sender}]};
  if(sql.includes("INSERT INTO whatsapp_conversation_routes"))return {rows:[{conversation_id:conversationId}]};
  return {rows:[]};
 }})};
 const result=await new WhatsAppReplyQueue(provider).enqueue(ctx,conversationId,"teste");
 assert.equal(result,null);
 const route=queries.find(q=>q.sql.includes("INSERT INTO whatsapp_conversation_routes"));
 assert.ok(route);
 assert.deepEqual(route.params.slice(0,4),[tenantId,conversationId,accountId,sender]);
 assert.match(route.sql,/AND c.channel='whatsapp'/);
 assert.match(route.sql,/a.service_enabled=true/);
});
test("relay forwards durable intent only once, then polls exact gateway queue",async()=>{
 const calls=[],q=[];
 const item={id:messageId,account_id:accountId,idempotency_key:"inbox:"+messageId,
  recipient_external_id:sender,body:"hello",status:"pending",gateway_queue_id:null};
 const provider={resolve:async()=>({tenantId,query:async(sql,args)=>{
  q.push({sql,args});return {rows:sql.includes("SELECT id::text")?[item]:[]};
 }})};
 const gateway={
  sendQueued:async(...args)=>{calls.push({op:"queue",args});return {queueId:21}},
  outboundStatus:async()=>{throw Error("not reached")}
 };
 assert.equal(await new WhatsAppOutboundRelay(provider,gateway).deliverNext(tenantId),"queued");
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0].args.slice(0,2),[tenantId,accountId]);
 assert.equal(calls[0].args[2].idempotencyKey,item.idempotency_key);
 assert.match(q.at(-1).sql,/gateway_queue_id=\$3,status='processing'/);
});
test("relay records external message ID only after gateway confirms sent",async()=>{
 const queries=[];
 const item={id:messageId,account_id:accountId,idempotency_key:"inbox:"+messageId,
  recipient_external_id:sender,body:"hello",status:"processing",gateway_queue_id:"44"};
 const provider={resolve:async()=>({tenantId,query:async(sql,args)=>{
  queries.push({sql,args});return {rows:sql.includes("SELECT id::text")?[item]:[]};
 }})};
 const gateway={sendQueued:async()=>{throw Error("must not requeue")},outboundStatus:async()=>({status:"sent",externalMessageId:"wa-out-1"})};
 assert.equal(await new WhatsAppOutboundRelay(provider,gateway).deliverNext(tenantId),"sent");
 assert.match(queries.at(-1).sql,/UPDATE inbox_messages m SET external_message_id=c.external_message_id/);
 assert.equal(queries.at(-1).args[2],"wa-out-1");
});
test("failed/uncertain delivery is never replayed automatically",async()=>{
 const queries=[];
 const item={id:messageId,account_id:accountId,idempotency_key:"inbox:"+messageId,
  recipient_external_id:sender,body:"hello",status:"processing",gateway_queue_id:"44"};
 const provider={resolve:async()=>({tenantId,query:async(sql,args)=>{
  queries.push(sql);return {rows:sql.includes("SELECT id::text")?[item]:[]};
 }})};
 const gateway={sendQueued:async()=>{throw Error("must not replay")},outboundStatus:async()=>({status:"failed"})};
 assert.equal(await new WhatsAppOutboundRelay(provider,gateway).deliverNext(tenantId),"failed");
 assert.match(queries.at(-1),/status='failed'/);
});
test("tenant database mismatches fail closed",async()=>{
 const provider={resolve:async()=>({tenantId:"another",query:async()=>{throw Error("unexpected")}})};
 await assert.rejects(new WhatsAppReplyQueue(provider).enqueue(ctx,conversationId,"hey"),/Tenant database mismatch/);
 await assert.rejects(new WhatsAppOutboundRelay(provider,{}).deliverNext(tenantId),/Tenant database mismatch/);
});
test("delivery status distinguishes sent, queued and older local-only replies",async()=>{
 const ids=["00000000-0000-4000-8000-000000000040","00000000-0000-4000-8000-000000000041","00000000-0000-4000-8000-000000000042"];
 const messages=ids.map(id=>({id,direction:"outbound",body:"test"}));
 const provider={resolve:async()=>({tenantId,query:async(sql,args)=>{
  assert.match(sql,/m.id=ANY\(\$2::uuid\[\]\)/);
  assert.equal(args[0],tenantId);
  assert.deepEqual(args[1],ids);
  return {rows:[{message_id:ids[0],status:"sent"},{message_id:ids[1],status:"processing"}]};
 }})};
 const result=await new WhatsAppReplyQueue(provider).decorate(tenantId,messages);
 assert.deepEqual(result.map(m=>m.deliveryStatus),["sent","processing","not_queued"]);
});
test('decorates WhatsApp conversations with verified per-tenant phone without mixing tenant rows',async()=>{
 const calls=[];
 const provider={resolve:async()=>({tenantId,query:async(sql,args)=>{
  calls.push({sql,args});return {rows:[{id:conversationId,phone_e164:"+5551976471234"}]};
 }})};
 const records=[{id:conversationId,channel:"whatsapp",subject:"old lid"},{id:accountId,channel:"simulation",subject:"simulated"}];
 const output=await new WhatsAppReplyQueue(provider).decorateConversations(tenantId,records);
 assert.equal(output[0].phoneNumber,"+5551976471234");
 assert.equal(output[1].phoneNumber,undefined);
 assert.match(calls[0].sql,/r.tenant_id=\$1::uuid/);
 assert.match(calls[0].sql,/r.conversation_id=ANY\(\$2::uuid\[\]\)/);
 assert.deepEqual(calls[0].args,[tenantId,[conversationId]]);
});

test("WhatsApp Inbox uses synced chat title without falsely marking a contact name write",async()=>{
 const queries=[];
 const provider={resolve:async()=>({tenantId,query:async(sql,args)=>{
  queries.push({sql,args});
  return {rows:[{id:conversationId,phone_e164:"+5551999999999",
   display_name:"Maria Sincronizada",saved_name:null}]};
 }})};
 const result=await new WhatsAppReplyQueue(provider).decorateConversations(tenantId,
  [{id:conversationId,channel:"whatsapp",subject:"Maria Sincronizada"}]);
 assert.equal(result[0].displayName,"Maria Sincronizada");
 assert.equal(result[0].phoneNumber,"+5551999999999");
 assert.equal(result[0].contactNameSyncStatus,null);
 assert.match(queries[0].sql,/BTRIM\(c.subject\)/);
 assert.match(queries[0].sql,/r.tenant_id=\$1::uuid/);
});
test("explicitly saved WhatsApp name takes priority over synced name",async()=>{
 const provider={resolve:async()=>({tenantId,query:async()=>({rows:[{
  id:conversationId,phone_e164:"+5551999999999",
  display_name:"Maria Cadastrada",saved_name:"Maria Cadastrada"}]})})};
 const [record]=await new WhatsAppReplyQueue(provider).decorateConversations(tenantId,[{id:conversationId,channel:"whatsapp"}]);
 assert.equal(record.displayName,"Maria Cadastrada");
 assert.equal(record.contactNameSyncStatus,"submitted");
});
