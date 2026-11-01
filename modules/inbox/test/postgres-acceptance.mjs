import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import pg from "../../../apps/core-host/node_modules/pg/lib/index.js";
import {CoreKernel,AccessDeniedError} from "@syndes/core-kernel";
import {InboxService,inboxModule,PgInboxRepository} from "../dist/index.js";
const A="4ab44379-d557-4df6-a2be-d44e121a8077",B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const suffix=x=>x.replaceAll("-","");
const pool=t=>new pg.Pool({host:"127.0.0.1",port:54329,database:"syndes_tenant_"+suffix(t),user:"syndes_t_"+suffix(t),password:"ci-inbox-tenant-pass-123456789",max:3});
const pa=pool(A),pb=pool(B);
const ctx=(t,id,kind)=>({tenantId:t,actor:{id,kind}});
const kernel=new CoreKernel({
 modules:[{id:"platform",version:"0.1.0"},{id:"crm",version:"0.1.0",dependencies:["platform"]},inboxModule],
 tenancy:{canAccessTenant:async({actor,tenantId})=>actor.id==="bob"?tenantId===B:tenantId===A},
 authorization:{canAccess:async({tenantId,actor,resource,action})=>resource.startsWith("inbox:")&&
  (actor.id==="bob"?tenantId===B:tenantId===A)&&!(resource==="inbox:ingest"&&actor.kind!=="service")},
});
await kernel.start();
let resolves=0;
const inbox=new InboxService(kernel,async t=>{
 resolves++;const p=t===A?pa:t===B?pb:null;
 if(!p)throw Error("Unknown tenant");
 return new PgInboxRepository({tenantId:t,query:async(sql,params)=>{
   const r=await p.query(sql,[...params]);return {rows:r.rows,rowCount:r.rowCount};
 }});
});
try{
 const personId=randomUUID();
 await pa.query("INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,$3)",[A,personId,"Maria"]);
 const a=ctx(A,"alice","service"),user=ctx(A,"alice","user"),bob=ctx(B,"bob","user");
 const msg={source:"whatsapp",externalRef:"551199999999",externalMessageId:"remote-001",body:"Bom dia",personId};
 const first=await inbox.receive(a,msg);
 const again=await inbox.receive(a,{...msg,body:"Conteúdo adulterado"});
 assert.equal(first.created,true);assert.equal(again.created,false);
 assert.equal(again.message.id,first.message.id);
 assert.equal(again.message.body,"Bom dia");
 const rows=await pa.query("SELECT count(*)::int AS count FROM inbox_messages");assert.equal(rows.rows[0].count,1);
 const cid=first.conversation.id;
 assert.equal((await inbox.list(user))[0].id,cid);
 assert.equal((await inbox.messages(user,cid))[0].body,"Bom dia");
 const reply=await inbox.reply(user,cid,"Já vou ajudar");
 assert.equal(reply.delivery,"queued");
 const out=await pa.query("SELECT count(*)::int AS count FROM inbox_outbox WHERE tenant_id=$1",[A]);
 assert.equal(out.rows[0].count,1,"Reply must queue, not directly dispatch");
 assert.equal((await inbox.assign(user,cid,"alice")).assignedTo,"alice");
 const another=ctx(A,"charlie","user");
 assert.equal(await inbox.assign(another,cid,"charlie"),null,"Other agent cannot steal assignment");
 assert.equal(await inbox.assign(another,cid,null),null,"Other agent cannot release assignment");
 assert.equal((await inbox.get(user,cid)).assignedTo,"alice");
 assert.equal((await inbox.assign(user,cid,null)).assignedTo,null);
 assert.equal((await inbox.assign(user,cid,"alice")).assignedTo,"alice");
 assert.equal((await inbox.handoff(user,cid,true)).humanHandoff,true);
 assert.equal((await inbox.status(user,cid,"pending")).status,"pending");
 const events=await inbox.events(user,0);
 assert.ok(events.length>=5);
 assert.ok(events.every(x=>x.tenantId===A));
 const bChat=await inbox.list(bob);assert.deepEqual(bChat,[]);
 assert.deepEqual(await inbox.messages(bob,cid),[]);
 const previous=resolves;
 await assert.rejects(inbox.list({...user,tenantId:B}),AccessDeniedError);
 assert.equal(resolves,previous);
 await assert.rejects(async()=>{
  const forbidden=new pg.Pool({host:"127.0.0.1",port:54329,user:"syndes_t_"+suffix(B),
   password:"ci-inbox-tenant-pass-123456789",database:"syndes_tenant_"+suffix(A),connectionTimeoutMillis:1200});
  try{await forbidden.query("SELECT 1")}finally{await forbidden.end()}
 },/permission denied|not allowed/i);
 const duplicate=await inbox.receive(a,{...msg,externalRef:"other-conversation"});
 // Must reject cross-conversation event ID reuse, never link to the wrong chat.
 throw Error("Unexpected reuse accepted: "+duplicate.message.id);
}catch(e){
 if(!(e instanceof Error)||!e.message.includes("different conversation"))throw e;
 console.log("Inbox acceptance: idempotent receipt, durable outbox, handoff, assignments, audit, separate tenant DB roles and cross-conversation collision rejection — PASS");
}finally{await Promise.all([pa.end(),pb.end()])}
