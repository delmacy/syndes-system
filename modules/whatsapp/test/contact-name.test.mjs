import test from "node:test";
import assert from "node:assert/strict";
import {WhatsAppContactNames} from "../dist/contact-name.js";

const tenant="00000000-0000-4000-8000-000000000001";
const conversation="00000000-0000-4000-8000-000000000002";
const account="00000000-0000-4000-8000-000000000003";
const phone="+5551999998888";
test("writes one tenant-scoped contact patch and records server submission",async()=>{
 const queries=[],sent=[];
 const provider={resolve:async()=>({tenantId:tenant,query:async(sql,args)=>{
  queries.push({sql,args});
  if(sql.includes("SELECT r.account_id"))return {rows:[{account_id:account,phone_e164:phone,crm_name:"Maria Silva"}]};
  if(sql.includes("INSERT INTO whatsapp_contact_name_changes"))return {rows:[{id:"saved"}]};
  return {rows:[]};
 }})};
 const gateway={setContactName:async(...args)=>{sent.push(args);return {submitted:true,confirmedOnPhone:false}}};
 const result=await new WhatsAppContactNames(provider,gateway).rename(tenant,"user",conversation,"Maria Silva",false);
 assert.equal(result.confirmedOnPhone,false);
 assert.equal(result.submitted,true);
 assert.deepEqual(sent[0],[tenant,account,{contactJid:"5551999998888@s.whatsapp.net",fullName:"Maria Silva",saveOnPrimaryAddressbook:false}]);
 assert.match(queries[0].sql,/r.tenant_id=\$1::uuid AND r.conversation_id=\$2::uuid/);
 assert.match(queries[0].sql,/c.is_group=false/);
 assert.match(queries.at(-1).sql,/status='submitted'/);
});
test("rejects CRM name conflicts and all group/unverified routes",async()=>{
 let sent=0;
 const provider={resolve:async()=>({tenantId:tenant,query:async(sql)=>{
  if(sql.includes("SELECT r.account_id"))return {rows:[{account_id:account,phone_e164:phone,crm_name:"Maria Silva"}]};
  return {rows:[]};
 }})};
 const service=new WhatsAppContactNames(provider,{setContactName:async()=>{sent++}});
 await assert.rejects(service.rename(tenant,"user",conversation,"Different",false),/CRM/);
 await assert.rejects(service.rename(tenant,"user",conversation,"",false),/Invalid contact name/);
 await assert.rejects(service.rename(tenant,"user",conversation,"Maria Silva","yes"),/Invalid contact name/);
 assert.equal(sent,0);
});
test("failure is logged without making an unaccepted name visible",async()=>{
 const queries=[];
 const provider={resolve:async()=>({tenantId:tenant,query:async(sql,args)=>{
  queries.push(sql);
  if(sql.includes("SELECT r.account_id"))return {rows:[{account_id:account,phone_e164:phone,crm_name:null}]};
  if(sql.includes("INSERT INTO whatsapp_contact_name_changes"))return {rows:[{id:"saved"}]};
  return {rows:[]};
 }})};
 const service=new WhatsAppContactNames(provider,{setContactName:async()=>{throw Error("remote rejected")}});
 await assert.rejects(service.rename(tenant,"user",conversation,"Maria",true),/not accepted/);
 assert.ok(queries.some(sql=>sql.includes("status='failed'")));
 assert.ok(!queries.some(sql=>sql.includes("INSERT INTO whatsapp_contact_name_labels")));
});
