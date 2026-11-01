import test from "node:test";
import assert from "node:assert/strict";
import {CoreKernel,AccessDeniedError} from "@syndes/core-kernel";
import {InboxService,inboxModule,InboxValidationError,PgInboxRepositoryFactory} from "../dist/index.js";
const A="4ab44379-d557-4df6-a2be-d44e121a8077",B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const user={tenantId:A,actor:{id:"alice",kind:"user"}};
const service={tenantId:A,actor:{id:"connector",kind:"service"}};
const inbound={source:"whatsapp",externalRef:"client-1",externalMessageId:"upstream-1",body:"Oi!"};
class MemoryInbox {
 constructor(t){this.tenant=t;this.c=new Map();this.m=new Map();this.events=[];}
 async receive(t,_a,cid,mid,input){
  const key=[t,input.source,input.externalRef].join(":");
  let conversation=this.c.get(key);
  if(!conversation){
   conversation={id:cid,tenantId:t,source:input.source,externalRef:input.externalRef,personId:null,
   status:"open",assignedTo:null,humanHandoff:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
   this.c.set(key,conversation);
  }
  const mk=t+":"+input.source+":"+input.externalMessageId;
  let msg=this.m.get(mk);
  if(msg&&msg.conversationId!==conversation.id)throw Error("Message ID collision");
  const created=!msg;
  if(!msg){msg={id:mid,tenantId:t,conversationId:conversation.id,direction:"inbound",
   authorId:"connector",externalMessageId:input.externalMessageId,body:input.body,delivery:"received",createdAt:new Date().toISOString()};
   this.m.set(mk,msg);}
  return {conversation,message:msg,created};
 }
 async listConversations(t){return [...this.c.values()].filter(c=>c.tenantId===t)}
 async getConversation(t,id){return [...this.c.values()].find(c=>c.tenantId===t&&c.id===id)??null}
 async listMessages(t,id){return [...this.m.values()].filter(m=>m.tenantId===t&&m.conversationId===id)}
 async send(t,a,id,cid,input){const c=await this.getConversation(t,cid);if(!c||c.status==="resolved")throw Error("Conversation unavailable");
  const msg={id,tenantId:t,conversationId:cid,direction:"outbound",authorId:a,externalMessageId:null,
   body:input.body,delivery:"queued",createdAt:new Date().toISOString()};
  this.m.set(id,msg);return msg;
 }
 async assign(t,a,id,assignee){const c=await this.getConversation(t,id);if(!c)return null;
  c.assignedTo=assignee;return {...c};}
 async setStatus(t,a,id,status){const c=await this.getConversation(t,id);if(!c)return null;c.status=status;return {...c}}
 async handoff(t,a,id,enabled){const c=await this.getConversation(t,id);if(!c)return null;c.humanHandoff=enabled;return {...c}}
 async listEvents(t){return this.events}
}
async function harness(options={}){
 let resolved=0;const repos=new Map([[A,new MemoryInbox(A)],[B,new MemoryInbox(B)]]);
 const kernel=new CoreKernel({modules:[{id:"platform",version:"0.1.0"},{id:"crm",version:"0.1.0",dependencies:["platform"]},inboxModule],
  tenancy:{canAccessTenant:async({actor,tenantId})=>actor.id==="bob"?tenantId===B:tenantId===A},
  authorization:{canAccess:async({resource})=>options.reject!=="all"&&resource.startsWith("inbox:")}});
 await kernel.start();
 const inbox=new InboxService(kernel,async t=>{resolved++;return repos.get(t)});
 return {inbox,resolved:()=>resolved,repos};
}
test("Inbox is mountable with explicit CRM dependency",()=>{
 assert.equal(inboxModule.id,"inbox");assert.deepEqual(inboxModule.dependencies,["crm"]);
});
test("idempotent inbound receipt and human reply are separate from provider delivery",async()=>{
 const {inbox}=await harness();
 const first=await inbox.receive(service,inbound);
 const again=await inbox.receive(service,inbound);
 assert.equal(first.message.id,again.message.id);assert.equal(again.created,false);
 const cid=first.conversation.id;
 assert.equal((await inbox.messages(user,cid)).length,1);
 const sent=await inbox.reply(user,cid,"Vou verificar e retorno");
 assert.equal(sent.delivery,"queued");
 assert.equal(sent.authorId,"alice");
 assert.equal((await inbox.messages(user,cid)).length,2);
 const claimed=await inbox.assign(user,cid,"alice");assert.equal(claimed.assignedTo,"alice");
 assert.equal((await inbox.handoff(user,cid,true)).humanHandoff,true);
 assert.equal((await inbox.status(user,cid,"resolved")).status,"resolved");
 await assert.rejects(inbox.reply(user,cid,"Mais mensagem"),/Conversation unavailable/);
});
test("deny cross-tenant and permissions before tenant database selection",async()=>{
 const {inbox,resolved}=await harness();
 await inbox.receive(service,inbound);
 const count=resolved();
 await assert.rejects(inbox.list({...user,tenantId:B}),AccessDeniedError);
 await assert.rejects(inbox.reply({...user,tenantId:B},"9b3df87e-ec6c-46f5-9339-3a6851da0119","x"),AccessDeniedError);
 assert.equal(resolved(),count);
 const deny=await harness({reject:"all"});
 await assert.rejects(deny.inbox.list(user),AccessDeniedError);assert.equal(deny.resolved(),0);
});
test("channel ingress is restricted to authenticated service identities",async()=>{
 const {inbox}=await harness();
 assert.throws(()=>inbox.receive(user,inbound),InboxValidationError);
 assert.throws(()=>inbox.receive(service,{...inbound,source:"arbitrary"}),InboxValidationError);
 assert.throws(()=>inbox.receive(service,{...inbound,body:""}),InboxValidationError);
 assert.throws(()=>inbox.reply(service,"9b3df87e-ec6c-46f5-9339-3a6851da0119","hello"),InboxValidationError);
 assert.throws(()=>inbox.assign(user,"9b3df87e-ec6c-46f5-9339-3a6851da0119","bob"),InboxValidationError);
 assert.throws(()=>inbox.events(user,-1),InboxValidationError);
});
test("trusted resolver requires exact tenant database identity",async()=>{
 const f=new PgInboxRepositoryFactory({resolve:async()=>({tenantId:B,query:async()=>({rows:[],rowCount:0})})});
 await assert.rejects(f.forTenant(A),/mismatch/);
});
