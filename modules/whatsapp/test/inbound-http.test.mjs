import test from 'node:test';
import assert from 'node:assert/strict';
import {WhatsAppInboundStore,verifyWebhookToken} from '../dist/inbound-http.js';
const tenantId='00000000-0000-4000-8000-000000000001';
const accountId='00000000-0000-4000-8000-000000000011';
const event={version:'1',type:'whatsapp.message.received',tenantId,accountId,message:{accountId,externalMessageId:'msg-1',senderExternalId:'5511@s.whatsapp.net',body:'olá',occurredAt:'2026-11-02T19:00:00Z'}};
test('webhook token requires exact bearer secret',()=>{
 assert.equal(verifyWebhookToken('secret','Bearer secret'),true);
 assert.equal(verifyWebhookToken('secret','Bearer wrong'),false);
 assert.equal(verifyWebhookToken(undefined,'Bearer secret'),false);
 assert.equal(verifyWebhookToken('secret','secret'),false);
});
test('inbound insert binds tenant ownership atomically',async()=>{
 let sql='';
 const store=new WhatsAppInboundStore({resolve:async()=>({tenantId,query:async(statement,values)=>{sql=statement;assert.equal(values[0],tenantId);assert.equal(values[1],accountId);return {rows:[{id:1}],rowCount:1}}})});
 assert.deepEqual(await store.persist(tenantId,event),{accepted:true,duplicate:false});
 assert.match(sql,/SELECT a\.tenant_id,a\.id/);
 assert.match(sql,/a\.tenant_id=\$1::uuid AND a\.id=\$2::uuid/);
});
test('rejects resolved database tenant mismatch',async()=>{
 const store=new WhatsAppInboundStore({resolve:async()=>({tenantId:'another',query:async()=>{throw Error('never query')}})});
 await assert.rejects(()=>store.persist(tenantId,event),/Tenant database mismatch/);
});
test('duplicate event acknowledged idempotently',async()=>{
 let n=0;
 const store=new WhatsAppInboundStore({resolve:async()=>({tenantId,query:async()=>({rows:++n===1?[]:[{exists:1}],rowCount:0})})});
 assert.deepEqual(await store.persist(tenantId,event),{accepted:true,duplicate:true});
});
