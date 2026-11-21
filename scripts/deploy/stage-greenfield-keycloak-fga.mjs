#!/usr/bin/env node
// Real stage-only identity+authorization pilot, run in a fresh network-isolated
// Node sidecar. No production Keycloak/FGA, no WhatsApp, no browser credentials.
import {readFile} from "node:fs/promises";
import {createHash,createPublicKey,verify as verifySignature} from "node:crypto";

const KC="http://keycloak:8080";
const FGA="http://openfga:8080";
const REALM="syndes-pilot";
const TENANT="1f5a8ce9-3f01-48cc-a013-2198d99e7510";
const ORG_A="a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1";
const ORG_B="b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2";
const WS_A1="cae8c1e2-4a1d-4b69-9e02-0dd15b0d1001";
const WS_B1="cbe8c1e2-4a1d-4b69-9e02-0dd15b0d2001";
const REQ="e5f2aafc-16d8-48ac-a7f1-392701b10001";
const ALIAS_A="syndes-"+TENANT.replaceAll("-","")+"-"+REQ.replaceAll("-","");
const ALIAS_B="syndes-greenfield-pilot-b";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mustUuid=(x)=>{if(typeof x!=="string"||!UUID.test(x))throw Error("PILOT_INVALID_UUID");return x};
const aFunnel=mustUuid(process.env.PILOT_A_FUNNEL_ID);
const bFunnel=mustUuid(process.env.PILOT_B_FUNNEL_ID);
let phase="init";
async function call(base,path,method="GET",body,token,statuses=[200]){
 const headers={Accept:"application/json"};
 if(token)headers.Authorization="Bearer "+token;
 let payload;
 if(body!==undefined){
  headers["Content-Type"]="application/json";
  payload=JSON.stringify(body);
 }
 let result;
 try{
  result=await fetch(base+path,{
   method,headers,body:payload,redirect:"error",cache:"no-store",
   signal:AbortSignal.timeout(15000),
  });
 }catch{throw Error("PILOT_"+phase+"_TRANSPORT")}
 if(!statuses.includes(result.status))
  throw Error("PILOT_"+phase+"_HTTP_"+result.status);
 let json;
 if(result.status!==204){
  const text=await result.text();
  if(text){try{json=JSON.parse(text)}catch{throw Error("PILOT_"+phase+"_JSON")}}
 }
 return {status:result.status,json,location:result.headers.get("location")};
}
const kc=(path,method="GET",body,token,statuses=[200])=>
 call(KC,path,method,body,token,statuses);
const fga=(path,method="GET",body,statuses=[200])=>
 call(FGA,path,method,body,undefined,statuses);
const adminServiceSecret=(await readFile("/tmp/pilot/pilot-admin-service-secret","utf8")).trim();
const founderPassword=(await readFile("/tmp/pilot/pilot-founder-password","utf8")).trim();
const restrictedPassword=(await readFile("/tmp/pilot/pilot-b-only-password","utf8")).trim();
for(const password of [adminServiceSecret,founderPassword,restrictedPassword])
 if(!/^[a-f0-9]{64}$/.test(password))throw Error("PILOT_SECRET_FORMAT");
async function tokenFor(realm,client,username,password){
 phase="oidc-token";
 const data=new URLSearchParams({
  grant_type:"password",client_id:client,username,password,
 });
 let response;
 try{response=await fetch(KC+"/realms/"+realm+"/protocol/openid-connect/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:data,redirect:"error",signal:AbortSignal.timeout(15000),
 });}catch{throw Error("PILOT_OIDC_NETWORK")}
 if(response.status!==200)throw Error("PILOT_OIDC_HTTP_"+response.status);
 let result;
 try{result=await response.json()}catch{throw Error("PILOT_OIDC_JSON")}
 if(typeof result.access_token!=="string")throw Error("PILOT_OIDC_TOKEN_MISSING");
 return result.access_token;
}
async function masterServiceToken(){
 phase="master-service-token";
 const data=new URLSearchParams({
  grant_type:"client_credentials",client_id:"syndes-stage-pilot-recovery",
  client_secret:adminServiceSecret,
 });
 let response;
 try{response=await fetch(KC+"/realms/master/protocol/openid-connect/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:data,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000),
 });}catch{throw Error("PILOT_ADMIN_SERVICE_TRANSPORT")}
 if(response.status!==200){
  let reason="unknown";
  try{
   const fault=await response.json();
   if(["invalid_client","unauthorized_client","invalid_grant","invalid_request"].includes(fault?.error))
    reason=fault.error;
  }catch{}
  throw Error("PILOT_ADMIN_SERVICE_HTTP_"+response.status+"_"+reason);
 }
 let value;
 try{value=await response.json()}catch{throw Error("PILOT_ADMIN_SERVICE_JSON")}
 if(typeof value?.access_token!=="string"||
    value.access_token.split(".").length!==3)
  throw Error("PILOT_ADMIN_SERVICE_TOKEN");
 return value.access_token;
}
const admin=await masterServiceToken();
phase="realm";
let realm=await kc("/admin/realms/"+REALM,"GET",undefined,admin,[200,404]);
if(realm.status===404){
 await kc("/admin/realms","POST",{
  realm:REALM,enabled:true,organizationsEnabled:true,
  sslRequired:"none",registrationAllowed:false,resetPasswordAllowed:false,
  loginWithEmailAllowed:false,bruteForceProtected:true,
 },admin,[201,204]);
 realm=await kc("/admin/realms/"+REALM,"GET",undefined,admin);
}
if(realm.json?.organizationsEnabled!==true||realm.json?.enabled!==true)
 throw Error("PILOT_REALM_CONFIG");
const prefix="/admin/realms/"+REALM;
phase="client";
let clients=(await kc(prefix+"/clients","GET",undefined,admin)).json;
if(!Array.isArray(clients))throw Error("PILOT_CLIENT_LIST");
const CLIENT="syndes-pilot-staging-login";
if(!clients.some(x=>x.clientId===CLIENT)){
 await kc(prefix+"/clients","POST",{
  clientId:CLIENT,enabled:true,protocol:"openid-connect",publicClient:true,
  standardFlowEnabled:true,directAccessGrantsEnabled:true,
  implicitFlowEnabled:false,serviceAccountsEnabled:false,
  redirectUris:["http://127.0.0.1:3333/*"],
  webOrigins:["http://127.0.0.1:3333"],
 },admin,[201,204]);
 clients=(await kc(prefix+"/clients","GET",undefined,admin)).json;
}
if(clients.filter(x=>x.clientId===CLIENT).length!==1)
 throw Error("PILOT_DUPLICATE_CLIENT");
phase="users";
async function user(username,password){
 const lookup=async()=>(await kc(prefix+"/users?username="+encodeURIComponent(username)+"&exact=true","GET",undefined,admin)).json;
 let users=await lookup();
 if(!Array.isArray(users))throw Error("PILOT_USERS_LIST");
 if(users.length===0){
  await kc(prefix+"/users","POST",{
   username,enabled:true,email:username+"@example.invalid",
   emailVerified:true,requiredActions:[],
   credentials:[{type:"password",value:password,temporary:false}],
  },admin,[201,204]);
  users=await lookup();
 }
 if(users.length!==1||users[0].username!==username||users[0].enabled!==true)
  throw Error("PILOT_USER_CONFLICT");
 return mustUuid(users[0].id);
}
const founder=await user("pilot-founder",founderPassword);
const restricted=await user("pilot-b-only",restrictedPassword);
if(founder===restricted)throw Error("PILOT_DISTINCT_USERS");
phase="organizations";
async function organization(alias,name){
 const list=async()=>(await kc(prefix+"/organizations?first=0&max=100","GET",undefined,admin)).json;
 let orgs=await list();
 if(!Array.isArray(orgs))throw Error("PILOT_ORGANIZATIONS_LIST");
 let matches=orgs.filter(x=>x.alias===alias);
 if(matches.length===0){
  await kc(prefix+"/organizations","POST",{name,alias,enabled:true},admin,[201,204]);
  orgs=await list();
  matches=orgs.filter(x=>x.alias===alias);
 }
 if(matches.length!==1||matches[0].name!==name||matches[0].enabled!==true)
  throw Error("PILOT_ORGANIZATION_ALIAS_COLLISION");
 return mustUuid(matches[0].id);
}
const kcA=await organization(ALIAS_A,"Piloto Organização A");
const kcB=await organization(ALIAS_B,"Piloto Organização B");
if(kcA===kcB)throw Error("PILOT_DUPLICATE_ORGANIZATIONS");
phase="memberships";
async function member(orgId,userId,expected){
 const path=prefix+"/organizations/"+orgId+"/members/"+userId;
 const observed=await kc(path,"GET",undefined,admin,[200,404]);
 if(expected===false){
  if(observed.status!==404)throw Error("PILOT_CROSS_ORG_MEMBER");
  return;
 }
 if(observed.status===404){
  await kc(prefix+"/organizations/"+orgId+"/members","POST",userId,admin,[201,204]);
 }
 const verify=await kc(path,"GET",undefined,admin,[200]);
 if(verify.json?.id!==userId)throw Error("PILOT_MEMBERSHIP_MISSING");
}
await member(kcA,founder,true);
await member(kcB,founder,true);
await member(kcB,restricted,true);
await member(kcA,restricted,false);
phase="signed-jwt";
async function signedUser(username,password,expectedSubject){
 const bearer=await tokenFor(REALM,CLIENT,username,password);
 const segments=bearer.split(".");
 if(segments.length!==3)throw Error("PILOT_JWT_SHAPE");
 const header=JSON.parse(Buffer.from(segments[0],"base64url").toString("utf8"));
 const payload=JSON.parse(Buffer.from(segments[1],"base64url").toString("utf8"));
 if(header.alg!=="RS256"||typeof header.kid!=="string"||
    payload.sub!==expectedSubject||
    payload.iss!==KC+"/realms/"+REALM||
    payload.exp*1000<Date.now())throw Error("PILOT_JWT_CLAIMS");
 const certs=(await kc("/realms/"+REALM+"/protocol/openid-connect/certs")).json;
 const key=certs?.keys?.find(x=>x.kid===header.kid&&x.kty==="RSA");
 if(!key)throw Error("PILOT_JWT_JWKS");
 if(!verifySignature("RSA-SHA256",Buffer.from(segments[0]+"."+segments[1]),
   createPublicKey({key,format:"jwk"}),Buffer.from(segments[2],"base64url")))
  throw Error("PILOT_JWT_SIGNATURE");
}
await signedUser("pilot-founder",founderPassword,founder);
await signedUser("pilot-b-only",restrictedPassword,restricted);
phase="fga-store";
const STORE_NAME="syndes-pilot-stage-exact-access";
const stores=(await fga("/stores")).json;
if(!Array.isArray(stores?.stores)||stores.continuation_token)
 throw Error("PILOT_FGA_STORES_LIST");
let all=stores.stores.filter(s=>s.name===STORE_NAME);
if(all.length===0){
 const created=(await fga("/stores","POST",{name:STORE_NAME},[201,200])).json;
 if(typeof created?.id!=="string")throw Error("PILOT_FGA_STORE_CREATE");
 all=[created];
}
if(all.length!==1||typeof all[0].id!=="string")throw Error("PILOT_FGA_STORE_CONFLICT");
const storeId=all[0].id;
const model=JSON.parse(await readFile("/tmp/pilot/fga-model.json","utf8"));
if(!Array.isArray(model.type_definitions)||
   !model.type_definitions.some(x=>x.type==="iam_capability"&&x.relations?.grantee))
 throw Error("PILOT_FGA_MODEL_SCHEMA");
const existingModels=(await fga("/stores/"+storeId+"/authorization-models")).json;
if(!Array.isArray(existingModels?.authorization_models))
 throw Error("PILOT_FGA_MODELS_LIST");
if(existingModels.authorization_models.length===0)
 await fga("/stores/"+storeId+"/authorization-models","POST",model,[201,200]);
function object(organization,workspace,funnel){
 const base="syndes:v1:tenant:"+TENANT+":org:"+organization+":workspace:"+workspace+
  ":funnel:"+funnel;
 return "iam_capability:"+createHash("sha256").update([
   "v1",TENANT,organization,workspace,"service.funnel.operate",base
 ].join("\x1f")).digest("hex");
}
const objectA=object(ORG_A,WS_A1,aFunnel);
const objectB=object(ORG_B,WS_B1,bFunnel);
phase="fga-grants";
async function check(id,resource){
 const {json}=await fga("/stores/"+storeId+"/check","POST",{
   tuple_key:{user:"user:"+id,relation:"can_execute",object:resource},
 },[200]);
 if(typeof json?.allowed!=="boolean")throw Error("PILOT_FGA_CHECK_FORMAT");
 return json.allowed;
}
async function grant(id,resource){
 if(await check(id,resource))return;
 await fga("/stores/"+storeId+"/write","POST",{
  writes:{tuple_keys:[{user:"user:"+id,relation:"grantee",object:resource}]},
 },[200,201,204]);
}
await grant(founder,objectA);
await grant(restricted,objectB);
if(!(await check(founder,objectA))||
   !(await check(restricted,objectB))||
   await check(restricted,objectA)||
   await check(founder,objectB))
 throw Error("PILOT_FGA_SCOPE_LEAK");
process.stdout.write(JSON.stringify({
 founder,restricted,kcA,kcB,storeId,realm:REALM,client:CLIENT,
})+"\n");
