import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {InboxController} from "../dist/inbox.controller.js";

const T="11111111-1111-4111-8111-111111111111";
const O="22222222-2222-4222-8222-222222222222";
const W="33333333-3333-4333-8333-333333333333";
const C="44444444-4444-4444-8444-444444444444";
const target="55555555-5555-4555-8555-555555555555";
const scope={organizationId:O,workspaceId:W};
const bearer="Bearer validated-by-actual-host";

test("ten Inbox mutations route only to exact IAM07D; history sync remains denied",async()=>{
 const old=process.env.SYNDES_MULTI_ORG_ENABLED;
 process.env.SYNDES_MULTI_ORG_ENABLED="true";
 let business=0,admitted=0;
 const exact=[],events=[];
 const context={tenantId:T,organizationId:O,workspaceId:W,
  actor:{id:C,kind:"user"},scopeWriteAllowed:true};
 const host={
  run:async(_tenant,_auth,handler)=>{admitted++;return handler(context)},
  mutateExact:async(_ctx,_auth,capability,key,input)=>{
   exact.push([capability,key,input]);return {id:key??C};
  },
  inbox:new Proxy({}, {get:()=>()=>{business++;throw Error("Unprotected write")}}),
  events:{publish:ctx=>events.push(ctx.workspaceId)},
 };
 const api=new InboxController(host);
 try{
  const attempts=[
   ()=>api.create(T,bearer,scope,{subject:"Ticket"}),
   ()=>api.assign(T,bearer,scope,C,{assigneeId:null}),
   ()=>api.status(T,bearer,scope,C,{status:"resolved"}),
   ()=>api.handoff(T,bearer,scope,C,{mode:"human"}),
   ()=>api.favorite(T,bearer,scope,C,{favorite:true}),
   ()=>api.read(T,bearer,scope,C),
   ()=>api.contact(T,bearer,scope,C,{personId:C}),
   ()=>api.reply(T,bearer,scope,C,{body:"private"}),
   ()=>api.note(T,bearer,scope,C,{body:"private"}),
   ()=>api.simulate(T,bearer,scope,C,{body:"private",externalMessageId:"private"}),
  ];
  for(const attempt of attempts)
   assert.equal((await attempt()).id,C);
  assert.deepEqual(exact.map(x=>x[0]),[
   "inbox.conversation.create","inbox.conversation.assign",
   "inbox.conversation.status","inbox.conversation.handoff",
   "inbox.conversation.favorite","inbox.conversation.mark_read",
   "inbox.conversation.link_contact","inbox.message.reply",
   "inbox.message.note","inbox.message.simulate",
  ]);
  await assert.rejects(api.requestHistory(T,bearer,scope,C),e=>e.status===403);
  assert.equal(admitted,10);
  assert.equal(business,0);
  assert.equal(events.length,10);
 }finally{
  if(old===undefined)delete process.env.SYNDES_MULTI_ORG_ENABLED;
  else process.env.SYNDES_MULTI_ORG_ENABLED=old;
 }
});

test("multi-org Inbox claim and transfer call only exact IAM07D port; legacy repository untouched",async()=>{
 const old=process.env.SYNDES_MULTI_ORG_ENABLED;
 process.env.SYNDES_MULTI_ORG_ENABLED="true";
 const events=[],exact=[];
 const ctx={tenantId:T,...scope,actor:{id:C,kind:"user"}};
 const host={
  run:async(tenant,auth,fn)=>{assert.equal(tenant,T);assert.equal(auth,bearer);return fn(ctx)},
  claimExact:async(context,auth,id)=>{
   exact.push(["claim",context,auth,id]);return {id,assignedTo:C};
  },
  transferExact:async(context,auth,id,destination)=>{
   exact.push(["transfer",context,auth,id,destination]);return {id};
  },
  inbox:{
   assign:()=>{throw Error("Legacy assignment must not run")},
   transferWorkspace:()=>{throw Error("Legacy transfer must not run")},
  },
  events:{publish:ctx=>events.push([ctx.organizationId,ctx.workspaceId])},
 };
 const api=new InboxController(host);
 try{
  assert.equal((await api.claim(T,bearer,scope,C)).assignedTo,C);
  assert.equal((await api.transferWorkspace(T,bearer,scope,C,{workspaceId:target})).id,C);
  assert.deepEqual(exact.map(x=>x[0]),["claim","transfer"]);
  assert.equal(exact[0][2],bearer);
  assert.equal(exact[1][4],target);
  assert.deepEqual(events,[[O,W],[O,W],[O,target]]);
 }finally{
  if(old===undefined)delete process.env.SYNDES_MULTI_ORG_ENABLED;
  else process.env.SYNDES_MULTI_ORG_ENABLED=old;
 }
});
