import {createRemoteJWKSet,jwtVerify} from "jose";
import {createHash} from "node:crypto";
import type {Actor,TenancyPort,AuthorizationPort} from "@syndes/core-kernel";
import type {Pool} from "pg";
export const tenantUUID=(id:unknown):id is string=>typeof id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
/** Classification is based ONLY on cryptographically verified Keycloak claims.
 * Public/browser clients never become services by passing a request header. */
export function actorFromVerifiedClaims(
  payload:Readonly<Record<string,unknown>>,
  trustedServiceClients:ReadonlySet<string>,
):Actor {
  const sub=payload.sub;
  if(typeof sub!=="string"||!sub.trim())throw new Error("missing subject");
  const azp=payload.azp;
  const username=payload.preferred_username;
  const serviceName=typeof azp==="string"?"service-account-"+azp:"";
  if(typeof username==="string"&&username.startsWith("service-account-")){
    if(typeof azp!=="string"||!trustedServiceClients.has(azp)||username!==serviceName)
      throw new Error("Service identity not allowed");
    return Object.freeze({id:sub,kind:"service" as const});
  }
  if(typeof azp==="string"&&trustedServiceClients.has(azp)){
    // A trusted client ID must not be used to mint a human token here.
    throw new Error("Unexpected human token for service-only client");
  }
  return Object.freeze({id:sub,kind:"user" as const});
}
export class ActorVerifier {
  private readonly keys;
  private readonly trustedServices:ReadonlySet<string>;
  constructor(
    private readonly issuer:string,
    private readonly audience:string,
    jwksUrl:string,
    trustedServiceClients=process.env.CORE_TRUSTED_SERVICE_CLIENT_IDS??"",
  ){
    this.keys=createRemoteJWKSet(new URL(jwksUrl));
    this.trustedServices=new Set(trustedServiceClients.split(",").map(x=>x.trim()).filter(Boolean));
  }
  async verify(header:string|undefined):Promise<Actor>{
    if(!header?.startsWith("Bearer "))throw new Error("missing bearer");
    const {payload}=await jwtVerify(header.slice(7),this.keys,{
      issuer:this.issuer,audience:this.audience,algorithms:["RS256"],
    });
    return actorFromVerifiedClaims(payload,this.trustedServices);
  }
}
export class PgMembership implements TenancyPort{
  constructor(private readonly db:Pick<Pool,"query">){}
  async canAccessTenant({actor,tenantId}:Parameters<TenancyPort["canAccessTenant"]>[0]):Promise<boolean>{
    if(!tenantUUID(tenantId)||actor.id.length>256)return false;
    const result=await this.db.query(
      "SELECT 1 FROM tenant_memberships m JOIN tenant_registry t ON t.tenant_id=m.tenant_id WHERE t.tenant_id=$1::uuid AND t.state='active' AND m.principal_id=$2 AND m.state='active' LIMIT 1",
      [tenantId,actor.id]);
    return (result.rowCount??0)>0;
  }
}
export const fgaResourceObject=(tenantId:string,resource:string):string=>
  "resource:"+createHash("sha256").update(tenantId+"|"+resource).digest("hex");
export class FgaPermission implements AuthorizationPort{
  constructor(private readonly endpoint:string,private readonly store:string,private readonly token:string,private readonly send:typeof fetch=fetch){}
  async canAccess({actor,tenantId,resource,action}:Parameters<AuthorizationPort["canAccess"]>[0]):Promise<boolean>{
    if(!tenantUUID(tenantId)||!/^[a-z][a-z0-9:._-]{0,127}$/i.test(resource))return false;
    const permission=action==="read"?"can_read":action==="write"?"can_write":null;
    if(!permission)return false;
    const resp=await this.send(new URL("/stores/"+encodeURIComponent(this.store)+"/check",this.endpoint),{
      method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+this.token},
      body:JSON.stringify({tuple_key:{user:"user:"+actor.id,relation:permission,object:fgaResourceObject(tenantId,resource)}}),
      signal:AbortSignal.timeout(3000)
    });
    if(!resp.ok)throw new Error("OpenFGA unavailable");
    const json:unknown=await resp.json();
    if(!json||typeof json!=="object"||typeof (json as {allowed?:unknown}).allowed!=="boolean")throw new Error("Invalid OpenFGA result");
    return (json as {allowed:boolean}).allowed===true;
  }
}
