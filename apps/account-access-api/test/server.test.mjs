import test from "node:test";
import assert from "node:assert/strict";
import {createAccountAccessServer} from "../src/server.mjs";

const tenant="11111111-1111-4111-8111-111111111111";
const idempotency="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const origin="https://workspace.syndes.test";
const url="/v1/accounts/"+tenant+"/access/delegations";
const admin={id:"verified-owner-sub",kind:"user"};
const input={operation:"grant",principalId:"target-account-member",role:"admin"};

async function withServer(config,fn){
 const counts={verify:0,allow:0,delegate:0};
 const server=createAccountAccessServer({
  allowedOrigin:origin,
  verifyBearer:async header=>{
   counts.verify++;
   if(header!=="Bearer fixture")throw Error("Invalid token");
   return admin;
  },
  canManageAccountRoles:async(actor,tid)=>{
   counts.allow++;
   assert.equal(actor,admin);
   assert.equal(tid,tenant);
   return true;
  },
  delegate:async query=>{
   counts.delegate++;
   assert.deepEqual(query,{tenantId:tenant,actorId:admin.id,
    targetId:input.principalId,operation:"grant",role:"admin",requestId:idempotency});
   return {role:"admin",state:"active",alreadyApplied:counts.delegate>1};
  },
  ready:async()=>true,
  ...config,
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const endpoint="http://127.0.0.1:"+server.address().port;
 const request=(route=url,opts={})=>fetch(endpoint+route,{
  method:"POST",headers:{
   origin,authorization:"Bearer fixture", "content-type":"application/json",
   "idempotency-key":idempotency,
  },body:JSON.stringify(input),...opts,
 });
 try{await fn({request,endpoint,counts});}
 finally{await new Promise(resolve=>server.close(resolve));}
}

test("valid verified owner + FGA + DB grant succeeds; retry delegates idempotency to DB",async()=>{
 await withServer({},async({request,counts})=>{
  let r=await request();
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{role:"admin",state:"active",alreadyApplied:false});
  r=await request();
  assert.equal(r.status,200);
  assert.equal((await r.json()).alreadyApplied,true);
  assert.deepEqual(counts,{verify:2,allow:2,delegate:2});
 });
});

test("wrong tenant, route or method never enters authenticator or DB",async()=>{
 await withServer({},async({request,counts})=>{
  for(const path of [
   "/v1/accounts/not-a-uuid/access/delegations",
   "/v1/accounts/"+tenant+"/crm/people",
   "/v1/accounts/"+tenant+"/access/delegations?tenant="+tenant,
   "/v1/accounts/22222222-2222-4222-8222-222222222222/access/grants",
  ])assert.equal((await request(path)).status,404);
  assert.equal((await request(url,{method:"PUT"})).status,404);
  assert.deepEqual(counts,{verify:0,allow:0,delegate:0});
 });
});

test("invalid origin, idempotency key and Content-Type never touch FGA or DB",async()=>{
 await withServer({},async({request,counts})=>{
  assert.equal((await request(url,{headers:{origin:"https://evil.invalid",authorization:"Bearer fixture",
   "content-type":"application/json","idempotency-key":idempotency}})).status,403);
  assert.equal((await request(url,{headers:{origin,authorization:"Bearer fixture",
   "content-type":"application/json","idempotency-key":"not-a-uuid"}})).status,400);
  assert.equal((await request(url,{headers:{origin,authorization:"Bearer fixture",
   "content-type":"text/plain","idempotency-key":idempotency}})).status,400);
  assert.deepEqual(counts,{verify:0,allow:0,delegate:0});
 });
});

test("invalid/unsigned token denied before parsing JSON or querying FGA",async()=>{
 await withServer({},async({request,counts})=>{
  const r=await request(url,{headers:{origin,authorization:"Bearer nope",
   "content-type":"application/json","idempotency-key":idempotency},body:"{invalid"});
  assert.equal(r.status,401);
  assert.deepEqual(counts,{verify:1,allow:0,delegate:0});
 });
});

test("bad payload, additional keys and oversized body fail closed",async()=>{
 await withServer({},async({request,counts})=>{
  for(const bad of [
    {...input,tenantId:tenant},{...input,role:"owner",extra:true},
    {...input,operation:"upsert"},{...input,role:"platform_owner"},
    {...input,principalId:""},{...input,principalId:"abc\nmalicious"},
    {operation:"grant",role:"admin"},
  ]){
   const r=await request(url,{body:JSON.stringify(bad)});
   assert.equal(r.status,400);
  }
  assert.equal((await request(url,{body:"{}"+' '.repeat(2200)})).status,413);
  assert.equal(counts.delegate,0);
  assert.equal(counts.allow,0);
 });
});

test("FGA denial or outage never call SQL",async()=>{
 await withServer({canManageAccountRoles:async()=>false},async({request,counts})=>{
  assert.equal((await request()).status,403);
  assert.equal(counts.delegate,0);
 });
 await withServer({canManageAccountRoles:async()=>{throw Error("offline");}},
  async({request,counts})=>{
   const r=await request();
   assert.equal(r.status,503);
   assert.deepEqual(await r.json(),{error:"Authorization unavailable"});
   assert.equal(counts.delegate,0);
  });
});

test("SQL denial, last-owner conflict and database errors are sanitized",async()=>{
 for(const [code,status] of [["42501",403],["23505",409],
                            ["23514",409],["22023",400],["XX000",503]]){
  await withServer({delegate:async()=>{throw Object.assign(Error("private SQL detail"),{code});}},
   async({request})=>{
    const r=await request();
    assert.equal(r.status,status);
    assert.doesNotMatch(JSON.stringify(await r.json()),/private SQL detail/);
   });
 }
});

test("health and readiness do not expose internal details",async()=>{
 await withServer({ready:async()=>{throw Error("password=ci");}},
 async({endpoint})=>{
  assert.deepEqual(await (await fetch(endpoint+"/healthz")).json(),{status:"ok"});
  const r=await fetch(endpoint+"/readyz");
  assert.equal(r.status,503);
  assert.deepEqual(await r.json(),{error:"Unavailable"});
 });
});
