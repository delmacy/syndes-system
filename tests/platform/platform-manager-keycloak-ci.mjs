// Real signed tokens from an ephemeral Keycloak 26 container. CI-only test realm.
// Direct Access Grant is enabled only on disposable test clients. Never enable it
// for real Syndes Platform Manager / Workspace browser clients.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {createMasterTokenVerifier} from "../../apps/master-admin-api/src/auth.mjs";
import {createHandler} from "../../apps/master-admin-api/src/server.mjs";

const base=process.env.KC_CI_BASE_URL||"http://127.0.0.1:18088";
const issuer="https://id.ci.syndes.invalid/realms/syndes-ci";
const realm="syndes-ci";
const adminName="syndes-ci-admin";
const adminPassword="ci-disposable-admin-not-for-production";
const userPassword="ci-disposable-operator-not-for-production";
const authPath="/realms/"+realm+"/protocol/openid-connect/token";

async function request(path,options={}){
 const res=await fetch(base+path,{...options,cache:"no-store"});
 if(!res.ok){
  throw Error("Disposable Keycloak request denied: path="+path+" status="+res.status);
 }
 return res;
}
async function json(path,body,token,method="POST"){
 return request(path,{
  method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
  body:JSON.stringify(body),
 });
}
async function token(path,data){
 const res=await fetch(base+path,{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams(data),cache:"no-store",
 });
 if(!res.ok){
  const error=await res.json().catch(()=>({}));
  const code=typeof error.error==="string"?error.error:"unknown";
  const reason=typeof error.error_description==="string"?error.error_description:"unavailable";
  throw Error("Disposable Keycloak token grant denied: "+res.status+" "+code+" "+reason);
 }
 const value=await res.json();
 assert.equal(typeof value.access_token,"string");
 return value.access_token;
}
function claims(jwt){
 return JSON.parse(Buffer.from(jwt.split(".")[1],"base64url").toString("utf8"));
}
async function waitReady(){
 for(let i=0;i<120;i++){
  try{
   const r=await fetch(base+"/realms/master/.well-known/openid-configuration");
   if(r.ok)return;
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw Error("Disposable Keycloak never became ready");
}
async function main(){
 await waitReady();
 const adminToken=await token("/realms/master/protocol/openid-connect/token",{
  grant_type:"password",client_id:"admin-cli",username:adminName,password:adminPassword
 });
 await json("/admin/realms",{realm,enabled:true,sslRequired:"none"},adminToken);
 const mapper=(aud)=>({
  name:"test-api-audience",protocol:"openid-connect",
  protocolMapper:"oidc-audience-mapper",
  config:{"included.custom.audience":aud,"access.token.claim":"true","id.token.claim":"false"}
 });
 for(const [id,aud] of [
  ["syndes-master-admin","syndes-master-api"],
  // Intentionally misconfigured broad audience: azp MUST still prevent access.
  ["syndes-workspace","syndes-master-api"],
  ["syndes-unrelated","unrelated-api"]
 ]){
  await json("/admin/realms/"+realm+"/clients",{
   clientId:id,enabled:true,protocol:"openid-connect",publicClient:true,
   standardFlowEnabled:true,implicitFlowEnabled:false,directAccessGrantsEnabled:true,
   serviceAccountsEnabled:false,redirectUris:["https://"+id+".ci.syndes.invalid/*"],
   webOrigins:["https://"+id+".ci.syndes.invalid"],protocolMappers:[mapper(aud)]
  },adminToken);
 }
 for(const username of ["ci-owner","ci-unauthorized"]){
  await json("/admin/realms/"+realm+"/users",{
   username,enabled:true,firstName:"Syndes",lastName:"CI Operator",
   email:username+"@example.test",emailVerified:true,requiredActions:[],
   credentials:[{type:"password",value:userPassword,temporary:false}]
  },adminToken);
 }
 const getAccess=(client,username="ci-owner")=>token(authPath,{
  grant_type:"password",client_id:client,username,password:userPassword,scope:"openid"
 });
 const adminAccess=await getAccess("syndes-master-admin");
 const workspaceAccess=await getAccess("syndes-workspace");
 const unrelatedAccess=await getAccess("syndes-unrelated");
 const notGranted=await getAccess("syndes-master-admin","ci-unauthorized");
 const master=claims(adminAccess),workspace=claims(workspaceAccess),unrelated=claims(unrelatedAccess);
 assert.equal(master.iss,issuer);
 assert.equal(workspace.iss,issuer);
 assert.equal(master.azp,"syndes-master-admin");
 assert.equal(workspace.azp,"syndes-workspace");
 assert.ok([master.aud].flat().includes("syndes-master-api"));
 assert.ok([workspace.aud].flat().includes("syndes-master-api"),
  "Workspace token deliberately receives administrative audience for adversarial testing");
 assert.ok(![unrelated.aud].flat().includes("syndes-master-api"));

 const verify=createMasterTokenVerifier({
  issuer,audience:"syndes-master-api",clientId:"syndes-master-admin",
  jwksUrl:base+"/realms/"+realm+"/protocol/openid-connect/certs"
 });
 assert.equal(await verify("Bearer "+adminAccess),master.sub);
 await assert.rejects(verify("Bearer "+workspaceAccess),/Wrong OIDC client/);
 await assert.rejects(verify("Bearer "+unrelatedAccess));
 await assert.rejects(verify("Bearer malformed.value"));
 const pool={query:async(sql,args)=>{
  assert.match(sql,/platform_operator_access/);
  return {rows:args?.[0]===master.sub?[{role:"viewer"}]:[]};
 }};
 const http=createServer(createHandler({verify,pool,publicOrigin:"https://master.ci.syndes.invalid"}));
 await new Promise(resolve=>http.listen(0,"127.0.0.1",resolve));
 try{
  const url="http://127.0.0.1:"+http.address().port+"/v1/platform/admin/me";
  const status=async bearer=>(await fetch(url,{headers:bearer?{Authorization:"Bearer "+bearer}:{}})).status;
  assert.equal(await status(adminAccess),200,"Valid owner granted only by immutable sub");
  assert.equal(await status(workspaceAccess),401,"Workspace token cannot authenticate Master");
  assert.equal(await status(unrelatedAccess),401,"Wrong audience denied");
  assert.equal(await status(notGranted),403,"Valid Master token without database grant denied");
  assert.equal(await status(""),401,"Unauthenticated denied");
 }finally{
  await new Promise(resolve=>http.close(resolve));
 }
 if(process.env.CI_MASTER_REAL_PG==="1"){
  await runLiveDatabaseIntegration({master,adminAccess,workspaceAccess,unrelatedAccess,notGranted});
 }
 console.log("Real Keycloak CI: RS256, HTTPS issuer, audience, azp, ungranted sub and HTTP denial PASS");
}
async function runLiveDatabaseIntegration({master,adminAccess,workspaceAccess,unrelatedAccess,notGranted}){
 // This exercise uses only disposable Keycloak + PostgreSQL created in the CI job.
 // The unchanged production main.mjs, real DB role and real signed tokens are tested.
 const require=createRequire(new URL("../../apps/master-admin-api/package.json",import.meta.url));
 const {Pool}=require("pg");
 const admin=new Pool({connectionString:"postgresql://postgres:ci-only-disposable@127.0.0.1:15432/syndes_control"});
 const restricted=new Pool({
  connectionString:"postgresql://syndes_master_api:ci-master-only@127.0.0.1:15432/syndes_control",
  options:"-c default_transaction_read_only=on"
 });
 const apiPort=18085;
 const live="http://127.0.0.1:"+apiPort;
 const api=spawn(process.execPath,["src/main.mjs"],{
  cwd:fileURLToPath(new URL("../../apps/master-admin-api/",import.meta.url)),
  env:{...process.env,MASTER_KEYCLOAK_ISSUER:issuer,
   MASTER_KEYCLOAK_AUDIENCE:"syndes-master-api",
   MASTER_KEYCLOAK_CLIENT_ID:"syndes-master-admin",
   MASTER_KEYCLOAK_JWKS_URL:base+"/realms/"+realm+"/protocol/openid-connect/certs",
   MASTER_PUBLIC_ORIGIN:"https://master.ci.syndes.invalid",
   MASTER_CONTROL_DB_URL_FILE:"/run/secrets/ci-master-db-url",
   MASTER_PORT:String(apiPort)},
  stdio:"ignore"
 });
 try{
  for(let i=0;i<60;i++){
   if(api.exitCode!==null)throw Error("Production API process exited during start");
   try{if((await fetch(live+"/readyz")).status===200)break;}catch{}
   if(i===59)throw Error("Production API readiness failed on real SQL role");
   await new Promise(resolve=>setTimeout(resolve,200));
  }
  const apiFetch=async(path,bearer,method="GET",origin)=>fetch(live+path,{
   method,headers:{
    ...(bearer?{authorization:"Bearer "+bearer}:{}),
    ...(origin?{origin}:{})
   }
  });
  const endpoint="/v1/platform/admin";
  assert.equal((await apiFetch(endpoint+"/me",adminAccess)).status,403,
    "Even valid signed administrative token must be rejected before explicit grant");
  assert.equal((await apiFetch(endpoint+"/me",notGranted)).status,403);
  assert.equal((await apiFetch(endpoint+"/me",workspaceAccess)).status,401);
  assert.equal((await apiFetch(endpoint+"/me",unrelatedAccess)).status,401);
  assert.equal((await apiFetch(endpoint+"/me",null)).status,401);
  const t="22222222-2222-4222-8222-222222222222";
  await admin.query(
   "INSERT INTO tenant_registry(tenant_id,database_name,role_name,state) VALUES ($1,$2,$3,'active')",
   [t,"syndes_tenant_"+t.replaceAll("-",""),"syndes_t_"+t.replaceAll("-","")]
  );
  await admin.query("INSERT INTO platform_tenant_profiles(tenant_id,display_name) VALUES ($1,$2)",
   [t,"Empresa de Teste [CI]"]);
  await admin.query("INSERT INTO platform_operator_access(principal_id,role,state) VALUES ($1,'viewer','active')",
   [master.sub]);
  const me=await apiFetch(endpoint+"/me",adminAccess);
  assert.equal(me.status,200);
  assert.equal((await me.json()).role,"viewer");
  assert.equal((await apiFetch(endpoint+"/me",notGranted)).status,403);
  assert.equal((await apiFetch(endpoint+"/me",workspaceAccess)).status,401,
   "Workspace client cannot cross boundary despite valid audience");
  const summary=await apiFetch(endpoint+"/summary",adminAccess);
  assert.equal(summary.status,200);
  assert.equal((await summary.json()).total,1);
  const list=await apiFetch(endpoint+"/tenants?query=Teste&state=active&page=1",adminAccess);
  assert.equal(list.status,200);
  const entries=await list.json();
  assert.equal(entries.total,1);
  assert.equal(entries.items[0].id,t);
  assert.equal(entries.items[0].displayName,"Empresa de Teste [CI]");
  const details=await apiFetch(endpoint+"/tenants/"+t,adminAccess);
  assert.equal(details.status,200);
  assert.equal((await details.json()).id,t);
  assert.equal((await apiFetch(endpoint+"/me",adminAccess,"POST")).status,404);
  assert.equal((await apiFetch(endpoint+"/me",adminAccess,"GET","https://workspace.ci.invalid")).status,403);
  assert.equal((await apiFetch("/v1/tenants/"+t+"/crm/people",adminAccess)).status,404);
  assert.equal((await restricted.query("SELECT count(*) AS n FROM tenant_registry")).rows[0].n,"1");
  await assert.rejects(restricted.query(
   "INSERT INTO platform_operator_access(principal_id,role) VALUES ('ci-improper','owner')"
  ),e=>e.code==="25006"||e.code==="42501");
  await admin.query("UPDATE platform_operator_access SET state='revoked' WHERE principal_id=$1",[master.sub]);
  assert.equal((await apiFetch(endpoint+"/me",adminAccess)).status,403,
   "Revoking database grant must immediately remove API access");
  console.log("Real integrated Control DB + Keycloak + production API: grant, revoke, SQL deny, 401/403, directory PASS");
 }finally{
  api.kill();
  await restricted.end().catch(()=>{});
  await admin.end().catch(()=>{});
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
