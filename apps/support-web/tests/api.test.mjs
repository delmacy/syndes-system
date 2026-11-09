import test from "node:test";
import assert from "node:assert/strict";
import {SupportApi,ApiError,ALLOWED_NEXT,QUEUES} from "../src/api.ts";
const T="11111111-1111-4111-8111-111111111111",TOKEN="synthetic-test-token";
test("Support API sends only fixed operational tenant and bearer for internal/external",async()=>{
 const original=globalThis.fetch,requests=[];
 globalThis.fetch=async(url,options={})=>{
  requests.push({url,options});
  return Response.json([]);
 };
 try{
  const api=new SupportApi(T,TOKEN,()=>{throw Error("unexpected auth loss");});
  await api.cases("internal",{queue:"it_infra",status:"triage",priority:"high"});
  await api.cases("external",{});
  assert.equal(requests.length,2);
  assert.match(requests[0].url,new RegExp("/v1/tenants/"+T+"/support/internal/cases"));
  assert.match(requests[1].url,/\/support\/external\/cases/);
  assert.match(requests[0].url,/queue=it_infra/);
  for(const r of requests){
   assert.equal(r.options.headers.Authorization,"Bearer "+TOKEN);
   assert.equal(r.options.cache,"no-store");
  }
  assert.equal(QUEUES.internal.some(q=>q.code==="external_general"),false);
  assert.deepEqual(ALLOWED_NEXT.closed,["triage"]);
 }finally{globalThis.fetch=original;}
});
test("API propagates authorization errors, expires session on 401 and never silently simulates success",async()=>{
 const previous=globalThis.fetch;let ended=0;
 const api=new SupportApi(T,TOKEN,()=>ended++);
 try{
  globalThis.fetch=async()=>Response.json({message:"deny"},{status:403});
  await assert.rejects(api.createInternal("it_infra","normal","x"),e=>e instanceof ApiError&&e.status===403);
  assert.equal(ended,0);
  globalThis.fetch=async()=>Response.json({message:"expired"},{status:401});
  await assert.rejects(api.cases("internal"),e=>e instanceof ApiError&&e.status===401);
  assert.equal(ended,1);
  globalThis.fetch=async()=>Response.json({message:"duplicate"},{status:409});
  await assert.rejects(api.createExternal(T,"high"),e=>e instanceof ApiError&&e.status===409);
 }finally{globalThis.fetch=previous;}
});
test("external Inbox picker offers only actual WhatsApp conversations linked to Syndes CRM",async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json([
  {id:"one",subject:"WA vinculado",channel:"whatsapp",crmPersonId:T},
  {id:"two",subject:"WA sem contato",channel:"whatsapp",crmPersonId:null},
  {id:"three",subject:"Simulador",channel:"simulation",crmPersonId:T}
 ]);
 try{
  const api=new SupportApi(T,TOKEN,()=>{});
  const list=await api.whatsappConversations();
  assert.deepEqual(list.map(x=>x.id),["one"]);
 }finally{globalThis.fetch=original;}
});
