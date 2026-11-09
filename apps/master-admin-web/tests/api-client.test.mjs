import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transformWithOxc} from "vite";
async function loadClient(){
 const source=readFileSync(new URL("../src/api.ts",import.meta.url),"utf8");
 const {code:output}=await transformWithOxc(source,"api.ts");
 return import("data:text/javascript;base64,"+Buffer.from(output).toString("base64"));
}
test("API uses isolated read-only routes and signed bearer",async t=>{
 const {MasterApi,ApiError}=await loadClient();
 const calls=[],prior=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{calls.push({url,opts});return new Response(JSON.stringify({id:"ok"}),{status:200,headers:{"content-type":"application/json"}})};
 t.after(()=>{globalThis.fetch=prior;});
 const api=new MasterApi("signed-token");
 await api.me(); await api.overview();
 await api.tenants({query:"abc",state:"active",page:2});
 await api.tenant("11111111-1111-4111-8111-111111111111");
 assert.deepEqual(calls.map(x=>x.url),[
 "/v1/platform/admin/me","/v1/platform/admin/summary",
 "/v1/platform/admin/tenants?query=abc&state=active&page=2",
 "/v1/platform/admin/tenants/11111111-1111-4111-8111-111111111111"
 ]);
 for(const x of calls){assert.equal(x.opts.headers.Authorization,"Bearer signed-token");assert.equal(x.opts.cache,"no-store");}
 assert.throws(()=>api.tenant("bad-id"),e=>e instanceof ApiError&&e.status===400);
 assert.equal(calls.length,4);
});
test("API denies expired, unauthorized and failing requests",async t=>{
 const {MasterApi,ApiError}=await loadClient(),prior=globalThis.fetch;
 t.after(()=>{globalThis.fetch=prior;});
 for(const status of [401,403,500]){
  globalThis.fetch=async()=>new Response("{}",{status});
  await assert.rejects(new MasterApi("token").me(),e=>e instanceof ApiError&&e.status===status);
 }
});
