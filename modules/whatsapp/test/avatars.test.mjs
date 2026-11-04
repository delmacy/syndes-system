import test from "node:test";
import assert from "node:assert/strict";
import {WhatsAppAvatars} from "../dist/avatars.js";
const tenantId="00000000-0000-4000-8000-000000000001";
const conversationId="00000000-0000-4000-8000-000000000002";
const accountId="00000000-0000-4000-8000-000000000011";
test("avatar lookup is scoped by tenant, conversation, WhatsApp ownership and verified number",async()=>{
 const calls=[],db={tenantId,query:async(sql,args)=>{calls.push({sql,args});return {rows:[{account_id:accountId,phone_e164:"+5551999999999",recipient_external_id:"1234567890123@lid",is_group:false}]}}};
 const gateway={avatar:async(...args)=>{calls.push({gateway:args});return {available:true,imageData:"data:image/png;base64,AA=="}}};
 const result=await new WhatsAppAvatars({resolve:async()=>db},gateway).get(tenantId,conversationId);
 assert.equal(result.available,true);
 assert.deepEqual(calls[1].gateway,[tenantId,accountId,"5551999999999@s.whatsapp.net"]);
 assert.match(calls[0].sql,/c.tenant_id=r.tenant_id/);
 assert.match(calls[0].sql,/a.service_enabled=true/);
 assert.deepEqual(calls[0].args,[tenantId,conversationId]);
});
test("group image uses only the persisted group JID, never phone digits",async()=>{
 const db={tenantId,query:async()=>({rows:[{account_id:accountId,recipient_external_id:"120363012345678901@g.us",is_group:true}]})};
 const gateway={avatar:async(...args)=>({available:false,jid:args[2]})};
 const result=await new WhatsAppAvatars({resolve:async()=>db},gateway).get(tenantId,conversationId);
 assert.equal(result.jid,"120363012345678901@g.us");
});
test("missing or cross-tenant routes never request another WhatsApp account's avatar",async()=>{
 let called=0;
 const gateway={avatar:async()=>{called++;return {available:true}}};
 const foreign=new WhatsAppAvatars({resolve:async()=>({tenantId:"different",query:async()=>{throw Error("unexpected query")}})},gateway);
 await assert.rejects(foreign.get(tenantId,conversationId),/Tenant database mismatch/);
 const missing=new WhatsAppAvatars({resolve:async()=>({tenantId,query:async()=>({rows:[]})})},gateway);
 await assert.rejects(missing.get(tenantId,conversationId),/unavailable/);
 assert.equal(called,0);
});
