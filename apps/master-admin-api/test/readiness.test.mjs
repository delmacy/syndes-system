import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {createHandler} from "../src/server.mjs";

async function serverWith(pool){
 const server=createServer(createHandler({verify:async()=> "operator",pool,
  publicOrigin:"https://master.example.test"}));
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 return {server,url:"http://127.0.0.1:"+server.address().port};
}
test("liveness stays minimal; readiness verifies Control DB privileges without data",async()=>{
 let count=0;
 const pool={query:async(sql)=>{
  count++;
  assert.match(sql,/FROM tenant_registry,tenant_memberships,platform_operator_access,platform_tenant_profiles LIMIT 0/);
  return {rows:[],rowCount:0};
 }};
 const {server,url}=await serverWith(pool);
 try{
  assert.equal((await fetch(url+"/healthz")).status,200);
  assert.equal(count,0,"Liveness must not depend on DB");
  const readiness=await fetch(url+"/readyz");
  assert.equal(readiness.status,200);
  assert.deepEqual(await readiness.json(),{status:"ready"});
  assert.equal(count,1,"Readiness must verify table SELECT privileges");
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test("readiness fails closed if Control DB unavailable or revoked",async()=>{
 const pool={query:async()=>{throw Error("backend/internal/SENSITIVE_METADATA");}};
 const {server,url}=await serverWith(pool);
 try{
  assert.equal((await fetch(url+"/healthz")).status,200);
  const response=await fetch(url+"/readyz");
  assert.equal(response.status,503);
  const body=await response.text();
  assert.match(body,/Control plane unavailable/);
  assert.doesNotMatch(body,/SENSITIVE_METADATA/);
  assert.equal(response.headers.get("cache-control"),"no-store, private");
  assert.equal((await fetch(url+"/v1/platform/admin/me",{
   headers:{authorization:"Bearer ci-only"}
  })).status,503);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
