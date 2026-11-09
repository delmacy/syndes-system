import {createRemoteJWKSet,jwtVerify} from "jose";
import {createHash} from "node:crypto";

/** Dedicated audience. Never accept the master-admin OIDC client in a tenant API. */
export function createTokenVerifier({issuer,audience,clientId,jwksUrl}){
 if(!issuer?.startsWith("https://")||!audience||!clientId||!jwksUrl)
  throw Error("Dedicated OIDC configuration is required");
 const keys=createRemoteJWKSet(new URL(jwksUrl));
 return async function verifyBearer(header){
  if(typeof header!=="string"||!/^Bearer [A-Za-z0-9_.-]{20,12000}$/.test(header))
   throw Error("Invalid bearer");
  const {payload}=await jwtVerify(header.slice(7),keys,{
   issuer,audience,algorithms:["RS256"],clockTolerance:5,
  });
  if(!payload.sub||typeof payload.sub!=="string"||
     payload.sub.length>256||payload.azp!==clientId||
     payload.azp==="syndes-master-admin")
   throw Error("Invalid OIDC client or principal");
  return Object.freeze({kind:"user",id:payload.sub});
 };
}
export function fgaObject(tenantId,resource){
 return "resource:"+createHash("sha256").update(tenantId+"|"+resource).digest("hex");
}
export function createFgaWriteAuthorizer({endpoint,store,token,send=fetch}){
 if(!endpoint||!store||!token)throw Error("OpenFGA configuration unavailable");
 return async function canManageAccountRoles(actor,tenantId){
  const uri=new URL("/stores/"+encodeURIComponent(store)+"/check",endpoint);
  const response=await send(uri,{
   method:"POST",
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
   body:JSON.stringify({tuple_key:{
    user:"user:"+actor.id,relation:"can_write",
    object:fgaObject(tenantId,"account:roles"),
   }}),
   signal:AbortSignal.timeout(3000),
  });
  if(!response.ok)throw Error("OpenFGA unavailable");
  const value=await response.json();
  if(typeof value?.allowed!=="boolean")throw Error("Invalid FGA decision");
  return value.allowed;
 };
}
