import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCoreSecrets, openBaoSourceFromEnv } from "../dist/secrets.js";

const createSource = async () => {
 const dir = await mkdtemp(join(tmpdir(), "syndes-bao-"));
 await writeFile(join(dir,"role-id"),"test-role\n");
 await writeFile(join(dir,"secret-id"),"test-secret\n");
 return {dir, source:{address:"https://openbao:8200",roleIdFile:join(dir,"role-id"),secretIdFile:join(dir,"secret-id")}};
};
const login = ()=>new Response(JSON.stringify({auth:{client_token:"ephemeral-token"}}),{status:200});
const read = ()=>new Response(JSON.stringify({data:{data:{control_db_url:"postgres://control",openfga_token:"fga-ci-secret"}}}),{status:200});

test("fetches credentials from OpenBao and always revokes bootstrap token",async()=>{
 const {dir,source}=await createSource();
 const methods=[];
 try {
  const result=await loadCoreSecrets(source,async (url,options)=>{
   methods.push({url,method:options.method,headers:options.headers,body:options.body});
   if(url.endsWith("/auth/approle/login"))return login();
   if(url.endsWith("/kv/data/production/core-host"))return read();
   if(url.endsWith("/auth/token/revoke-self"))return new Response("{}",{status:204});
   throw Error("Unexpected request");
  });
  assert.deepEqual(result,{controlDbUrl:"postgres://control",openfgaToken:"fga-ci-secret"});
  assert.deepEqual(methods.map(m=>m.method),["POST","GET","POST"]);
  assert.deepEqual(JSON.parse(methods[0].body),{role_id:"test-role",secret_id:"test-secret"});
  assert.equal(methods[1].headers["X-Vault-Token"],"ephemeral-token");
  assert.equal(methods[2].headers["X-Vault-Token"],"ephemeral-token");
  assert.equal(JSON.stringify(methods).includes("postgres://control"),false);
 } finally {await rm(dir,{force:true,recursive:true})}
});

test("denies missing permissions or missing KV keys; still revokes token",async()=>{
 const {dir,source}=await createSource();
 try {
  let revoke=0;
  await assert.rejects(loadCoreSecrets(source,async url=>{
   if(url.endsWith("/login"))return login();
   if(url.endsWith("revoke-self")){revoke++;return new Response("{}",{status:204})}
   return new Response("denied",{status:403});
  }),/OpenBao request rejected/);
  assert.equal(revoke,1);
  await assert.rejects(loadCoreSecrets(source,async url=>{
   if(url.endsWith("/login"))return login();
   if(url.endsWith("revoke-self"))return new Response("{}",{status:204});
   return new Response(JSON.stringify({data:{data:{control_db_url:"postgres://test"}}}),{status:200});
  }),/Missing or malformed OpenBao secret/);
 } finally {await rm(dir,{force:true,recursive:true})}
});

test("refuses HTTP and invalid OpenBao root URLs",async()=>{
 const {dir,source}=await createSource();
 try {
  await assert.rejects(loadCoreSecrets({...source,address:"http://openbao:8200"},async()=>login()),/HTTPS root/);
  await assert.rejects(loadCoreSecrets({...source,address:"https://attacker:password@openbao:8200"},async()=>login()),/HTTPS root/);
 } finally{await rm(dir,{force:true,recursive:true})}
});

test("failed revocation blocks startup, no environment fallback",async()=>{
 const {dir,source}=await createSource();
 try{
  await assert.rejects(loadCoreSecrets(source,async url=>{
   if(url.endsWith("/login"))return login();
   if(url.endsWith("revoke-self"))return new Response("rejected",{status:500});
   return read();
  }),/revocation failed/);
  assert.equal(openBaoSourceFromEnv({}).roleIdFile,"/run/secrets/core_host_role_id");
 }finally{await rm(dir,{force:true,recursive:true})}
});
