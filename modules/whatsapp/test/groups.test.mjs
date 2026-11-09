import test from "node:test";
import assert from "node:assert/strict";
import {WhatsAppGroupService} from "../dist/groups.js";
const tenantId="00000000-0000-4000-8000-000000000001";
const conversationId="00000000-0000-4000-8000-000000000020";
const accountId="00000000-0000-4000-8000-000000000011";
const jid="120363012345678901@g.us";
const info={jid,name:"Nome no WhatsApp",description:"Descrição canônica",participantCount:9,canEdit:true,locked:false,announce:false};
test("group identity is loaded from existing tenant-scoped, enabled group route",async()=>{
 const queries=[],calls=[];
 const db={tenantId,query:async(sql,args)=>{queries.push({sql,args});return {rows:[{account_id:accountId,recipient_external_id:jid}]}}};
 const gateway={groupInfo:async(...args)=>{calls.push(args);return info}};
 const service=new WhatsAppGroupService({resolve:async()=>db},gateway);
 assert.deepEqual(await service.info(tenantId,conversationId),info);
 assert.deepEqual(calls[0],[tenantId,accountId,jid]);
 assert.match(queries[0].sql,/c.is_group=true/);
 assert.match(queries[0].sql,/a.service_enabled=true/);
 assert.deepEqual(queries[0].args,[tenantId,conversationId]);
});
test("name is changed locally only after WhatsApp confirmed the canonical group name",async()=>{
 const calls=[],db={tenantId,query:async(sql,args)=>{
  calls.push({sql,args});
  return {rows:sql.includes("SELECT r.account_id")?[{account_id:accountId,recipient_external_id:jid}]:[]};
 }};
 const gateway={updateGroup:async()=>({...info,name:"Confirmado no WhatsApp"})};
 const service=new WhatsAppGroupService({resolve:async()=>db},gateway);
 assert.equal((await service.update(tenantId,conversationId,{name:"Desejado"})).name,"Confirmado no WhatsApp");
 assert.equal(calls[1].args[2],"Confirmado no WhatsApp");
 assert.match(calls[1].sql,/r.account_id=\$4::uuid/);
});
test("WhatsApp rejects group change: no optimistic local write",async()=>{
 const calls=[],db={tenantId,query:async(sql)=>{calls.push(sql);return {rows:[{account_id:accountId,recipient_external_id:jid}]}}};
 const service=new WhatsAppGroupService({resolve:async()=>db},{updateGroup:async()=>{throw Error("provider rejected")}});
 await assert.rejects(service.update(tenantId,conversationId,{description:"Novo"}),/provider rejected/);
 assert.equal(calls.length,1);
});
test("cannot read group outside tenant, PN JID or non-group conversation",async()=>{
 const db={tenantId,query:async()=>({rows:[{account_id:accountId,recipient_external_id:"5511999999999@s.whatsapp.net"}]})};
 const service=new WhatsAppGroupService({resolve:async()=>db},{groupInfo:async()=>assert.fail("provider must not be called")});
 await assert.rejects(service.info(tenantId,conversationId),/group unavailable/);
 await assert.rejects(service.info("another-tenant",conversationId),/Invalid group context/);
 await assert.rejects(service.update(tenantId,conversationId,{name:"X",description:"Y"}),/Invalid group change/);
});
