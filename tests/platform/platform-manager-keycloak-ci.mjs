// Real signed tokens from an ephemeral Keycloak 26 container. CI-only test realm.
// Direct Access Grant is enabled only on disposable test clients. Never enable it
// for real Syndes Platform Manager / Workspace browser clients.
import assert from "node:assert/strict";
import {createServer} from "node:http";
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
 console.log("Real Keycloak CI: RS256, HTTPS issuer, audience, azp, ungranted sub and HTTP denial PASS");
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
