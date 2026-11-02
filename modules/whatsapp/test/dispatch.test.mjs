import test from 'node:test';
import assert from 'node:assert/strict';
import {WhatsAppInboxProjection} from '../dist/dispatch.js';
const tenantId='00000000-0000-4000-8000-000000000001';
const accountId='00000000-0000-4000-8000-000000000011';
const event={version:'1',type:'whatsapp.message.received',tenantId,accountId,message:{accountId,externalMessageId:'m1',senderExternalId:'5511@s.whatsapp.net',body:'oi',occurredAt:'2026-11-02T19:00:00Z'}};
test('projects event atomically into tenant inbox',async()=>{
 const calls=[];
 const db={tenantId,query:async(sql,args)=>{calls.push({sql,args});return {rows:calls.length===1?[{id:42,payload:event}]:[{id:42}]}}};
 const projection=new WhatsAppInboxProjection({resolve:async()=>db});
 assert.equal(await projection.deliverNext(tenantId),'delivered');
 assert.match(calls[1].sql,/inbox_conversations/);
 assert.match(calls[1].sql,/inbox_messages/);
 assert.match(calls[1].sql,/processed_at=clock_timestamp/);
 assert.equal(calls[1].args[0],tenantId);
 assert.equal(calls[1].args[4].length,64);
});
test('does not acknowledge invalid event',async()=>{
 let n=0;
 const projection=new WhatsAppInboxProjection({resolve:async()=>({tenantId,query:async()=>{n++;return {rows:[{id:1,payload:{}}]}}})});
 assert.equal(await projection.deliverNext(tenantId),'invalid');
 assert.equal(n,1);
});
test('rejects foreign tenant database',async()=>{
 const projection=new WhatsAppInboxProjection({resolve:async()=>({tenantId:'wrong',query:async()=>{throw Error('not reached')}})});
 await assert.rejects(()=>projection.deliverNext(tenantId),/Tenant database mismatch/);
});
