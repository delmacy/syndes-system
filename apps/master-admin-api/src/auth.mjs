import {createRemoteJWKSet,jwtVerify} from "jose";

/** A Keycloak login in the tenant Workspace never authenticates the Master.
 * Validation enforces separate token audience AND authorized OIDC client (azp).
 */
export function createMasterTokenVerifier({issuer,audience,clientId,jwksUrl}){
 if(typeof issuer!=="string"||!issuer.startsWith("https://")||
    typeof audience!=="string"||!audience.trim()||
    typeof clientId!=="string"||!clientId.trim()||
    typeof jwksUrl!=="string"||!new URL(jwksUrl).protocol.startsWith("http"))
  throw Error("Invalid Master OIDC configuration");
 const keys=createRemoteJWKSet(new URL(jwksUrl));
 return async(header)=>{
  if(typeof header!=="string"||!header.startsWith("Bearer "))
    throw Error("Invalid bearer");
  const {payload}=await jwtVerify(header.slice(7),keys,{
    issuer,audience,algorithms:["RS256"]
  });
  if(payload.azp!==clientId||typeof payload.sub!=="string"||
     !payload.sub.trim()||payload.sub.length>256)
    throw Error("Wrong OIDC client or principal");
  return payload.sub;
 };
}
