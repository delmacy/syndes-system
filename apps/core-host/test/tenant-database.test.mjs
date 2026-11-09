import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {expectedTenantDatabase,resolveRegistry,TenantCredentialSource} from "../dist/tenant-database.js";

const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
test("tenant DB names derived from trusted UUID only",()=>{
 const a=expectedTenantDatabase(A);
 assert.equal(a.database_name,"syndes_tenant_"+A.replaceAll("-",""));
 assert.equal(a.role_name,"syndes_t_"+A.replaceAll("-",""));
 assert.throws(()=>expectedTenantDatabase("../postgres"));
});
test("registry rejects missing, inactive or mismatched tenant mappings",async()=>{
 const expected=expectedTenantDatabase(A);
 assert.deepEqual(await resolveRegistry({query:async(_,args)=>{
   assert.deepEqual(args,[A]);
   return {rows:[expected]};
 }},A),expected);
 await assert.rejects(resolveRegistry({query:async()=>({rows:[]})},A));
 await assert.rejects(resolveRegistry({query:async()=>({rows:[expectedTenantDatabase(B)]})},A));
});
test("tenant AppRole verifies role and revokes token, never uses a supplied DSN",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"tenant-cred-"));
 try{
  await writeFile(join(dir,"role"),"role-ci");
  await writeFile(join(dir,"secret"),"secret-ci");
  const stages=[];
  const source=new TenantCredentialSource("https://openbao:8200",{
    role:join(dir,"role"),secret:join(dir,"secret")},async(url,opts)=>{
      stages.push({url:String(url),method:opts.method});
      if(String(url).endsWith("/login"))return new Response(JSON.stringify({auth:{client_token:"token-ci"}}),{status:200});
      if(String(url).endsWith("/revoke-self"))return new Response(null,{status:204});
      return new Response(JSON.stringify({data:{data:{
        username:expectedTenantDatabase(A).role_name,password:"sample-test-password-12345678",
      }}}),{status:200});
    });
  assert.equal(await source.password(A,expectedTenantDatabase(A).role_name),"sample-test-password-12345678");
  assert.deepEqual(stages.map(s=>s.method),["POST","GET","POST"]);
  assert.match(stages[1].url,new RegExp(A));
  await assert.rejects(source.password(A,expectedTenantDatabase(B).role_name),/mismatch/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
