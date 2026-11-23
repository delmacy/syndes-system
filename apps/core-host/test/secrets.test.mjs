import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCoreSecrets, loadConfiguredCoreSecrets, loadFileCoreSecrets, openBaoSourceFromEnv } from "../dist/secrets.js";
import {secretNamespaceFromEnv,tenantDatabaseHost} from "../dist/secret-namespace.js";

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
   if(url.endsWith("/auth/token/revoke-self"))return new Response(null,{status:204});
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
   if(url.endsWith("revoke-self")){revoke++;return new Response(null,{status:204})}
   return new Response("denied",{status:403});
  }),/OpenBao request rejected/);
  assert.equal(revoke,1);
  await assert.rejects(loadCoreSecrets(source,async url=>{
   if(url.endsWith("/login"))return login();
   if(url.endsWith("revoke-self"))return new Response(null,{status:204});
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

test("staging reads only its namespace, validates Control target, revokes on denial and never retries production",async()=>{
 const {dir,source}=await createSource();
 try{
  for(const target of [
   "postgresql://syndes_staging_core:synthetic@control-postgres:5432/syndes_staging_control",
   "postgresql://syndes_staging_core:synthetic@syndes-postgres:5432/syndes_control",
   "postgresql://postgres:synthetic@control-postgres:5432/syndes_staging_control",
   "postgresql://syndes_staging_core:synthetic@control-postgres:5432/syndes_staging_control?host=syndes-postgres",
   null,
  ]){
   const calls=[];
   const pending=loadCoreSecrets({...source,namespace:"multi-org-staging"},async url=>{
    calls.push(url);
    if(url.endsWith("/login"))return login();
    if(url.endsWith("/revoke-self"))return new Response(null,{status:204});
    assert.ok(url.endsWith("/kv/data/multi-org-staging/core-host"));
    if(target===null)return new Response(null,{status:403});
    return new Response(JSON.stringify({data:{data:{control_db_url:target,openfga_token:"synthetic"}}}));
   });
   if(target?.includes("@control-postgres:5432/")&&target.includes("syndes_staging_core")&&!target.includes("?"))
    assert.equal((await pending).controlDbUrl,target);
   else await assert.rejects(pending);
   assert.equal(calls.length,3);
   assert.ok(calls.at(-1).endsWith("/revoke-self"));
   assert.ok(calls.every(url=>!url.includes("/production/")));
  }
  assert.equal(openBaoSourceFromEnv({SYNDES_DEPLOYMENT_ENV:"staging"}).namespace,"multi-org-staging");
  assert.equal(secretNamespaceFromEnv({}),"production");
  assert.equal(tenantDatabaseHost("multi-org-staging"),"control-postgres");
  assert.equal(tenantDatabaseHost("production"),"syndes-postgres");
  assert.throws(()=>openBaoSourceFromEnv({SYNDES_DEPLOYMENT_ENV:"stagign"}));
  let requests=0;
  await assert.rejects(loadCoreSecrets({...source,namespace:"../production"},async()=>{requests++;return login()}));
  assert.equal(requests,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test("staging file credentials require an explicit provider and check the Control boundary",async t=>{
 const dir=await mkdtemp(join(tmpdir(),"syndes-stage-credential-"));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const path=join(dir,"runtime.json");
 const values={
  namespace:"multi-org-staging",
  control_db_url:"postgresql://syndes_staging_core:fixture@control-postgres:5432/syndes_staging_control",
  openfga_token:"stage-fixture",
 };
 await assert.rejects(loadConfiguredCoreSecrets({CORE_SECRET_PROVIDER:"files"}),/Invalid credential provider/);
 await assert.rejects(loadFileCoreSecrets("multi-org-staging",path),/Missing or malformed staging/);
 await writeFile(path,JSON.stringify(values));
 assert.deepEqual(await loadFileCoreSecrets("multi-org-staging",path),{
  controlDbUrl:values.control_db_url,openfgaToken:values.openfga_token,
 });
 await writeFile(path,JSON.stringify({...values,namespace:"production"}));
 await assert.rejects(loadFileCoreSecrets("multi-org-staging",path),/Missing or malformed staging/);
 await writeFile(path,JSON.stringify({...values,control_db_url:"postgres://bad:fixture@syndes-postgres/syndes_control"}));
 await assert.rejects(loadFileCoreSecrets("multi-org-staging",path),/Invalid staging Control database boundary/);
});

test("operational file credentials admit only the dedicated Control login",async t=>{
 const dir=await mkdtemp(join(tmpdir(),"syndes-operational-credential-"));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const path=join(dir,"runtime.json");
 const values={
  namespace:"production",
  control_db_url:"postgresql://syndes_core:fixture@syndes-postgres:5432/syndes_control?sslmode=disable",
  openfga_token:"operational-fixture",
 };
 await writeFile(path,JSON.stringify(values));
 assert.deepEqual(await loadFileCoreSecrets("production",path),{
  controlDbUrl:values.control_db_url,openfgaToken:values.openfga_token,
 });
 await assert.rejects(loadFileCoreSecrets("multi-org-staging",path),/Missing or malformed staging/);
 for(const control_db_url of [
  values.control_db_url.replace("syndes_core:","postgres:"),
  values.control_db_url.replace("syndes-postgres:","other-db:"),
  values.control_db_url.replace("/syndes_control?","/syndes_tenant_fixture?"),
  values.control_db_url+"&host=other-db",
 ]){
  await writeFile(path,JSON.stringify({...values,control_db_url}));
  await assert.rejects(loadFileCoreSecrets("production",path),/Invalid operational Control database boundary/);
 }
});
