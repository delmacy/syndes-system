import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {createHandler} from "../src/server.mjs";

const T="11111111-1111-4111-8111-111111111111";
const row={tenant_id:T,display_name:"Cliente de teste",
 state:"active",created_at:"2026-11-09T12:00:00.000Z",active_members:3};
const origin="https://example.ts.net:9445";

test("only the dedicated platform role may query control metadata; tenant APIs are unreachable",async()=>{
 const queries=[];
 const pool={query:async(sql,args=[])=>{
  queries.push({sql,args});
  if(sql.includes("platform_operator_access"))
   return {rows:args[0]==="master-user"?[{role:"owner"}]:
    args[0]==="readonly-operator"?[{role:"viewer"}]:[],rowCount:1};
  if(sql.includes("FILTER(WHERE"))return {rows:[{total:1,active:1,provisioned:0,suspended:0,memberships:3}]};
  if(sql.includes("count(*)::int AS total FROM tenant_registry t"))
   return {rows:[{total:1}]};
  if(sql.includes("FROM tenant_registry t"))return {rows:[row]};
  throw Error("Unexpected SQL: "+sql);
 }};
 const verified=[];
 const verify=async header=>{
  verified.push(header);
  if(!["Bearer master-user","Bearer tenant-admin","Bearer readonly-operator"].includes(header))
   throw Error("Bad signed token");
  return header.slice(7);
 };
 const server=createServer(createHandler({verify,pool,publicOrigin:origin}));
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const base="http://127.0.0.1:"+server.address().port;
 const fetchApi=(path,who,extra={})=>fetch(base+path,{
  ...extra,headers:{authorization:"Bearer "+who,...extra.headers}
 });
 try{
  assert.equal((await fetch(base+"/v1/platform/admin/me")).status,401);
  assert.equal(queries.length,0,"Invalid JWT must be rejected before control DB");
  assert.equal((await fetchApi("/v1/platform/admin/summary","tenant-admin")).status,403,
   "Tenant-admin does not imply Master Admin");
  assert.equal(queries.length,1);
  assert.deepEqual(queries[0].args,["tenant-admin"]);
  const me=await fetchApi("/v1/platform/admin/me","master-user");
  assert.equal(me.status,200);
  assert.equal(me.headers.get("cache-control"),"no-store, private");
  assert.equal(me.headers.get("access-control-allow-origin"),null,
   "Master Admin API does not advertise cross-origin access");
  assert.deepEqual(await me.json(),{
   role:"owner",capabilities:{viewTenants:true,manageTenants:false,viewCustomerData:false}
  });
  assert.equal((await fetchApi("/v1/platform/admin/me","readonly-operator")).status,200);
  assert.deepEqual(await (await fetchApi("/v1/platform/admin/summary","master-user")).json(),
   {total:1,active:1,provisioned:0,suspended:0,memberships:3});
  const injection="' OR 1=1 --";
  const result=await fetchApi("/v1/platform/admin/tenants?query="+encodeURIComponent(injection)+
   "&state=active&page=2","master-user");
  assert.equal(result.status,200);
  assert.deepEqual(await result.json(),{
   total:1,page:2,pageSize:25,items:[{
    id:T,displayName:"Cliente de teste",status:"active",
    createdAt:row.created_at,activeMembers:3
   }]
  });
  const scoped=queries.filter(q=>q.args?.[0]===injection);
  assert.equal(scoped.length,2);
  assert.deepEqual(scoped[0].args,[injection,"active"]);
  assert.deepEqual(scoped[1].args,[injection,"active",25]);
  assert.doesNotMatch(scoped[0].sql,/OR 1=1/);
  assert.equal((await fetchApi("/v1/platform/admin/tenants/"+T,"master-user")).status,200);
  for(const suffix of [
   "/v1/platform/admin/tenants/not-a-uuid",
   "/v1/platform/admin/tenants?state=unknown",
   "/v1/platform/admin/tenants?page=0",
   "/v1/platform/admin/tenants?query="+encodeURIComponent("x".repeat(90)),
   "/v1/platform/admin/tenants?query=one&query=two",
   "/v1/platform/admin/tenants?secret=1"
  ])assert.equal((await fetchApi(suffix,"master-user")).status,400,suffix);
  const before=queries.length;
  for(const path of [
   "/v1/tenants/"+T+"/crm/people",
   "/v1/tenants/"+T+"/inbox/conversations",
   "/v1/tenants/"+T+"/whatsapp/accounts",
   "/modules/core-crm/config",
   "/v1/platform/organizations",
   "/v1/platform/admin/tenants/"+T+"/db",
  ])assert.equal((await fetchApi(path,"master-user")).status,404,path);
  assert.equal(queries.length,before,"No tenant API can resolve a DB from Master origin");
  assert.equal((await fetchApi("/v1/platform/admin/tenants","master-user",
   {method:"POST"})).status,404,"No tenant creation or impersonation endpoint");
  assert.equal((await fetchApi("/v1/platform/admin/me","master-user",
   {headers:{origin:"https://app.example.ts.net"}})).status,403);
  assert.equal(queries.length,before);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
