import test from "node:test";
import assert from "node:assert/strict";
import {CoreKernel,AccessDeniedError} from "@syndes/core-kernel";
import {InboxService,inboxModule,PgInboxRepositoryFactory,InboxTenantMismatchError,InboxValidationError,SimulatedChannelAdapter} from "../dist/index.js";
const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const alice={actor:{id:"alice",kind:"user"},tenantId:A};
class MemoryStore{
 conversations=new Map();history=new Map();externalIds=new Map();
 async create(tenantId,actorId,value){
  const c={...value,tenantId,channel:"simulation",status:"open",assignedTo:null,handoff:"human",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  this.conversations.set(value.id,c);this.history.set(value.id,[]);
  return c;
 }
 async list(tenantId,status,limit){return [...this.conversations.values()].filter(c=>c.tenantId===tenantId&&(!status||c.status===status)).slice(0,limit)}
 async get(tenantId,key){const c=this.conversations.get(key);return c?.tenantId===tenantId?c:null}
 async messages(tenantId,key,limit){const c=await this.get(tenantId,key);return c?this.history.get(key).slice(-limit):null}
 async change(tenantId,key,field,value){const c=await this.get(tenantId,key);if(!c)return null;Object.assign(c,{[field]:value});return c}
 assign(t,k,a,v){return this.change(t,k,"assignedTo",v)}
 status(t,k,a,v){return this.change(t,k,"status",v)}
 handoff(t,k,a,v){return this.change(t,k,"handoff",v)}
 async append(t,k,a,item){
  const c=await this.get(t,k);if(!c)return null;
  if(item.direction!=="inbound"&&(c.status==="resolved"||c.handoff!=="human"||c.assignedTo!==a))return null;
  const ref=t+"/"+k+"/"+item.externalMessageId;
  if(item.externalMessageId&&this.externalIds.has(ref)){
   const prior=this.externalIds.get(ref);if(prior.body!==item.body)throw Error("conflicting replay");return prior;
  }
  const m={...item,tenantId:t,conversationId:k,authorId:a,createdAt:new Date().toISOString()};
  this.history.get(k).push(m);if(item.externalMessageId)this.externalIds.set(ref,m);
  if(item.direction==="inbound"&&c.status==="resolved")c.status="open";
  return m;
 }
 async metrics(t){
  const list=await this.list(t,null,100);
  return {open:list.filter(c=>c.status==="open").length,pending:list.filter(c=>c.status==="pending").length,
   resolved:list.filter(c=>c.status==="resolved").length,unassigned:list.filter(c=>!c.assignedTo).length};
 }
}
async function setup(deny=null){
 let selected=0;
 const stores=new Map([[A,new MemoryStore()],[B,new MemoryStore()]]);
 const kernel=new CoreKernel({modules:[{id:"platform",version:"0.1.0"},{id:"crm",version:"0.1.0",dependencies:["platform"]},inboxModule],
  tenancy:{canAccessTenant:async({actor,tenantId})=>actor.id==="alice"?tenantId===A:actor.id==="bob"&&tenantId===B},
  authorization:{canAccess:async q=>deny!==q.action&&deny!=="outage"}});
 await kernel.start();
 const inbox=new InboxService(kernel,async tenantId=>{selected++;return stores.get(tenantId)});
 return {inbox,selects:()=>selected,stores};
}
test("Inbox mounts after CRM in the modular kernel",()=>{
 assert.equal(inboxModule.id,"inbox");assert.deepEqual(inboxModule.dependencies,["platform","crm"]);
});
test("human journey: receive, assign, reply, note, pending, resolve, reopen, handoff, transfer",async()=>{
 const {inbox}=await setup();
 const c=await inbox.create(alice,{subject:"Atendimento demonstrativo"});
 assert.equal((await inbox.metrics(alice)).unassigned,1);
 const inbound=await inbox.simulate(alice,c.id,"Olá","retry-100");
 assert.equal((await inbox.simulate(alice,c.id,"Olá","retry-100")).id,inbound.id);
 assert.equal((await inbox.messages(alice,c.id)).length,1);
 assert.equal(await inbox.reply(alice,c.id,"Sem atribuição"),null);
 await inbox.assign(alice,c.id,"alice");
 assert.equal((await inbox.reply(alice,c.id,"Bom dia")).direction,"outbound");
 assert.equal((await inbox.note(alice,c.id,"Consultar estoque")).direction,"internal");
 assert.equal((await inbox.messages(alice,c.id)).length,3);
 assert.equal((await inbox.status(alice,c.id,"pending")).status,"pending");
 assert.equal((await inbox.status(alice,c.id,"resolved")).status,"resolved");
 assert.equal(await inbox.reply(alice,c.id,"Não pode responder resolvida"),null);
 await inbox.simulate(alice,c.id,"Ainda preciso de ajuda","retry-101");
 assert.equal((await inbox.get(alice,c.id)).status,"open");
 await inbox.handoff(alice,c.id,"bot");
 assert.equal(await inbox.reply(alice,c.id,"Handoff para bot"),null);
 await inbox.handoff(alice,c.id,"human");
 await inbox.assign(alice,c.id,"other-agent");
 assert.equal(await inbox.reply(alice,c.id,"Somente responsável"),null);
 assert.equal((await inbox.list(alice,"open")).length,1);
});
test("authorization and membership deny before database resolution",async()=>{
 const {inbox,selects}=await setup();
 await inbox.create(alice,{subject:"Privado"});
 const before=selects();
 await assert.rejects(inbox.list({...alice,tenantId:B}),AccessDeniedError);
 await assert.rejects(inbox.metrics({...alice,tenantId:B}),AccessDeniedError);
 assert.equal(selects(),before);
 const denied=await setup("write");
 await assert.rejects(denied.inbox.reply(alice,"b341ae20-8215-4796-8ab3-3997abb3d575","teste"),AccessDeniedError);
 assert.equal(denied.selects(),0);
});
test("input validation and tenant resolver mismatch fail closed",async()=>{
 const {inbox}=await setup();
 assert.throws(()=>inbox.create(alice,{subject:"  "}),InboxValidationError);
 assert.throws(()=>inbox.create(alice,{subject:"A",crmPersonId:"../../secret"}),InboxValidationError);
 assert.throws(()=>inbox.list(alice,null,101),InboxValidationError);
 assert.throws(()=>inbox.simulate(alice,"8e2e66c3-47a8-46be-b16a-b3ac78e38e4a","text",""),InboxValidationError);
 const factory=new PgInboxRepositoryFactory({resolve:async()=>({tenantId:B,query:async()=>({rows:[],rowCount:0})})});
 await assert.rejects(factory.forTenant(A),InboxTenantMismatchError);
});
test("authorization outage does not resolve any database",async()=>{
 let selected=0;
 const kernel=new CoreKernel({modules:[{id:"platform",version:"0.1.0"},inboxModule,
  {id:"crm",version:"0.1.0",dependencies:["platform"]}],
  tenancy:{canAccessTenant:async()=>true},authorization:{canAccess:async()=>{throw Error("FGA down")}}});
 await kernel.start();
 const service=new InboxService(kernel,async()=>{selected++;return new MemoryStore()});
 await assert.rejects(service.list(alice),/FGA down/);
 assert.equal(selected,0);
});

test("simulation adapter accepts only its channel envelope",async()=>{
 const {inbox}=await setup();
 const c=await inbox.create(alice,{subject:"Channel adapter"});
 const adapter=new SimulatedChannelAdapter(inbox);
 const inbound=await adapter.receive(alice,{channel:"simulation",conversationId:c.id,body:"Olá adapter",externalMessageId:"adapter-1"});
 assert.equal(inbound.direction,"inbound");
 await assert.rejects(adapter.receive(alice,{channel:"whatsapp",conversationId:c.id,body:"untrusted",externalMessageId:"adapter-2"}),InboxValidationError);
 assert.equal((await inbox.messages(alice,c.id)).length,1);
});
