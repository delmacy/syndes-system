import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {WhatsAppInboxProjection,botEligible} from '../dist/dispatch.js';
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
 assert.equal(n,2);
});
test('rejects foreign tenant database',async()=>{
 const projection=new WhatsAppInboxProjection({resolve:async()=>({tenantId:'wrong',query:async()=>{throw Error('not reached')}})});
 await assert.rejects(()=>projection.deliverNext(tenantId),/Tenant database mismatch/);
});
test('preserves WhatsApp routing JID while storing verified phone only as display metadata',async()=>{
 const calls=[];
 const payload={...event,message:{...event.message,senderExternalId:'76467123456789@lid',senderPhone:'+5551976471234'}};
 const db={tenantId,query:async(sql,args)=>{calls.push({sql,args});return {
   rows:calls.length===1?[{id:42,payload}]:sql.includes('SELECT r.recipient_external_id')?[]:[{id:42}]
 }}}; 
 const projection=new WhatsAppInboxProjection({resolve:async()=>db});
 assert.equal(await projection.deliverNext(tenantId),'delivered');
 const projectionSQL=calls.at(-1);
 const sql=projectionSQL.sql;
 assert.match(calls[1].sql,/r.account_id=\$2::uuid/);
 assert.match(sql,/recipient_external_id,phone_e164/);
 assert.equal(projectionSQL.args[11],'76467123456789@lid');
 assert.equal(projectionSQL.args[12],'+5551976471234');
 assert.match(sql,/COALESCE\(EXCLUDED.phone_e164,whatsapp_conversation_routes.phone_e164\)/);
 assert.equal(projectionSQL.args[3],'WhatsApp · +5551976471234');
});


test('a historical outgoing message is never bot-eligible',async()=>{
 const calls=[];
 const payload={...event,message:{...event.message,source:'history',fromMe:true,chatExternalId:'5511@s.whatsapp.net'}};
 const db={tenantId,query:async(sql,args)=>{calls.push({sql,args});return {rows:calls.length===1?[{id:99,payload}]:[{id:99}]}}};
 assert.equal(await new WhatsAppInboxProjection({resolve:async()=>db}).deliverNext(tenantId),'delivered');
 assert.equal(calls[1].args[13],'outbound');
 assert.equal(calls[1].args[14],'history');
 assert.equal(calls[1].args[15],false);
});
test('group messages are visible but never activate the bot',async()=>{
 const calls=[],group='120363012345678901@g.us';
 const payload={...event,message:{...event.message,isGroup:true,chatExternalId:group,senderExternalId:'1234567890123@lid',source:'live'}};
 const db={tenantId,query:async(sql,args)=>{calls.push({sql,args});return {rows:calls.length===1?[{id:99,payload}]:[{id:99}]}}};
 assert.equal(await new WhatsAppInboxProjection({resolve:async()=>db}).deliverNext(tenantId),'delivered');
 assert.equal(calls[1].args[9],true);
 assert.equal(calls[1].args[11],group);
 assert.equal(calls[1].args[15],false);
});
test('historical chat snapshots create group entries without fake messages',async()=>{
 const calls=[],chat='120363012345678901@g.us';
 const payload={version:'1',type:'whatsapp.chat.snapshot',tenantId,accountId,
  chat:{accountId,chatExternalId:chat,isGroup:true,name:'Equipe de testes',unreadCount:6,archived:false}};
 const db={tenantId,query:async(sql,args)=>{calls.push({sql,args});return {rows:calls.length===1?[{id:99,payload}]:[{id:99}]}}};
 assert.equal(await new WhatsAppInboxProjection({resolve:async()=>db}).deliverNext(tenantId),'delivered');
 assert.match(calls[1].sql,/unread_count,is_archived/);
 assert.doesNotMatch(calls[1].sql,/INSERT INTO inbox_messages/);
 assert.equal(calls[1].args[3],'Equipe de testes');
 assert.equal(calls[1].args[6],6);
});
test('bot safety applies to only live direct inbound text',()=>{
 assert.equal(botEligible({source:'live',fromMe:false,isGroup:false}),true);
 for(const val of [
  {source:'history',fromMe:false,isGroup:false},
  {source:'live',fromMe:true,isGroup:false},
  {source:'live',fromMe:false,isGroup:true},
 ]) assert.equal(botEligible(val),false);
});

test('historical PN chat reuses verified LID thread and original outbound route',async()=>{
 const calls=[],lid='76467123456789@lid',pn='5551976471234@s.whatsapp.net';
 const payload={...event,message:{...event.message,chatExternalId:pn,
   senderExternalId:pn,senderPhone:'+5551976471234',source:'history'}};
 const db={tenantId,query:async(sql,args)=>{
  calls.push({sql,args});
  if(calls.length===1)return {rows:[{id:42,payload}]};
  if(sql.includes('SELECT r.recipient_external_id'))return {rows:[{recipient_external_id:lid}]};
  return {rows:[{id:42}]};
 }};
 assert.equal(await new WhatsAppInboxProjection({resolve:async()=>db}).deliverNext(tenantId),'delivered');
 const mutation=calls.at(-1);
 assert.equal(mutation.args[4],createHash('sha256').update(accountId+'|'+lid).digest('hex'));
 assert.equal(mutation.args[11],lid);
 assert.equal(mutation.args[12],'+5551976471234');
 assert.equal(mutation.args[14],'history');
 assert.equal(mutation.args[15],false);
 assert.match(calls[1].sql,/r.tenant_id=\$1::uuid AND r.account_id=\$2::uuid/);
 assert.match(calls[1].sql,/r.phone_e164=\$3/);
});
test('historical PN chat snapshot reuses the same verified direct thread',async()=>{
 const calls=[],lid='76467123456789@lid',pn='5551976471234@s.whatsapp.net';
 const payload={version:'1',type:'whatsapp.chat.snapshot',tenantId,accountId,
   chat:{accountId,chatExternalId:pn,isGroup:false,unreadCount:0,archived:false}};
 const db={tenantId,query:async(sql,args)=>{
  calls.push({sql,args});
  if(calls.length===1)return {rows:[{id:42,payload}]};
  if(sql.includes('SELECT r.recipient_external_id'))return {rows:[{recipient_external_id:lid}]};
  return {rows:[{id:42}]};
 }};
 assert.equal(await new WhatsAppInboxProjection({resolve:async()=>db}).deliverNext(tenantId),'delivered');
 assert.equal(calls.at(-1).args[4],createHash('sha256').update(accountId+'|'+lid).digest('hex'));
 assert.equal(calls.at(-1).args[9],lid);
});
