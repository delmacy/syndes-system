import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {OpenFgaInitialTenantGrant} from "../dist/signup-initial-fga.js";
import {fgaResourceObject} from "../dist/adapters.js";

const intent=()=>({requestId:randomUUID(),founderId:randomUUID(),
 tenantId:randomUUID(),organizationId:randomUUID(),workspaceId:randomUUID()});
const json=(body,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{"Content-Type":"application/json"},
});
test("UC-SIGNUP-01C grants only one direct directory viewer, never tenant:admin",async()=>{
 const i=intent(),tuples=[],writes=[];
 const send=async(url,options)=>{
  const body=JSON.parse(options.body);
  if(url.pathname.endsWith("/read")){
   assert.equal(body.page_size,2);
   const key=body.tuple_key;
   return json({tuples:tuples.filter(t=>t.user===key.user&&
    t.relation===key.relation&&t.object===key.object).map(key=>({key}))});
  }
  if(url.pathname.endsWith("/write")){
   const keys=body.writes?.tuple_keys;
   assert.equal(keys.length,1);
   writes.push(keys[0]);tuples.push(keys[0]);
   return json({});
  }
  throw Error("Unexpected OpenFGA endpoint");
 };
 const gateway=new OpenFgaInitialTenantGrant(
  "http://127.0.0.1:8080","localstore123","synthetic-token-123",send);
 assert.equal(await gateway.verifyMinimum(i),false);
 await gateway.ensureMinimum(i);
 await gateway.ensureMinimum(i);
 assert.equal(writes.length,1);
 assert.deepEqual(writes[0],{
  user:"user:"+i.founderId,relation:"viewer",
  object:fgaResourceObject(i.tenantId,"organizations:directory"),
 });
 assert.equal(await gateway.verifyMinimum(i),true);
 assert.equal(tuples.some(t=>t.relation==="admin"||t.relation==="editor"),false);
 tuples.push({user:"user:"+i.founderId,relation:"admin",object:"tenant:"+i.tenantId});
 await assert.rejects(gateway.verifyMinimum(i),"Tenant admin must not qualify as minimal onboarding");
 await assert.rejects(gateway.ensureMinimum(i),"No broad privilege is ever normalized into a valid signup");
 assert.equal(writes.length,1);
});
test("UC-SIGNUP-01C FGA outage, bad tuple, unknown HTTP fail closed",async()=>{
 const i=intent();
 const noStore=new OpenFgaInitialTenantGrant("http://openfga:8080",
  "localstore123","synthetic-token-123",async()=>json({tuples:null}));
 await assert.rejects(noStore.ensureMinimum(i));
 const outage=new OpenFgaInitialTenantGrant("http://openfga:8080",
  "localstore123","synthetic-token-123",async()=>json({message:"down"},503));
 await assert.rejects(outage.verifyMinimum(i));
 for(const bad of [
  {...i,tenantId:"../../../db"},
  {...i,founderId:"user:alice"},
 ]){
  await assert.rejects(outage.verifyMinimum(bad));
 }
 for(const url of ["http://example.com/","http://openfga:8080/evil",
  "http://admin:pass@openfga:8080/"])
  assert.throws(()=>new OpenFgaInitialTenantGrant(
   url,"localstore123","synthetic-token-123",async()=>json({})));
});
