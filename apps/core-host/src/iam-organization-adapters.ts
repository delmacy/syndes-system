/**
 * IAM-04B/05B isolated, read-only adapters.
 * NOT wired to main.ts: an admission result never bypasses OpenFGA or SQL owner.
 * The control schema is a manual migration candidate, not a new grant store.
 */
import {readFile} from "node:fs/promises";
import type {Pool} from "pg";
import type {
  OrganizationIdentityLink,OrganizationIdentityLinksPort,
  KeycloakOrganizationMembershipPort,
} from "./iam-organization-context-pilot.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REALM=/^[a-z][a-z0-9_-]{1,80}$/;
const CLIENT=/^[a-z][a-z0-9-]{2,127}$/;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Never use LIMIT 1 to hide a duplicate or drifted Control record. */
export class PgOrganizationIdentityLinks implements OrganizationIdentityLinksPort {
  constructor(private readonly control:Pick<Pool,"query">){}
  private async rows(sql:string,values:readonly string[]):Promise<readonly OrganizationIdentityLink[]>{
    const result=await this.control.query(sql,[...values]);
    if(!Array.isArray(result.rows))throw new Error("IAM Control unavailable");
    return result.rows.map((row:Record<string,unknown>)=>{
      const revision=typeof row.revision==="string"?Number(row.revision):row.revision;
      if(typeof row.realm!=="string"||!REALM.test(row.realm)||
         typeof row.keycloak_organization_id!=="string"||!UUID.test(row.keycloak_organization_id)||
         typeof row.tenant_id!=="string"||!UUID.test(row.tenant_id)||
         typeof row.organization_id!=="string"||!UUID.test(row.organization_id)||
         (row.state!=="active"&&row.state!=="revoked")||
         !Number.isSafeInteger(revision)||Number(revision)<=0)
        throw new Error("IAM Control identity link malformed");
      return Object.freeze({
        realm:row.realm,keycloakOrganizationId:row.keycloak_organization_id,
        tenantId:row.tenant_id,organizationId:row.organization_id,
        state:row.state,revision:Number(revision),
      });
    });
  }
  async findPlatform(tenantId:string,organizationId:string):Promise<readonly OrganizationIdentityLink[]>{
    if(!UUID.test(tenantId)||!UUID.test(organizationId))return [];
    return this.rows(
      "SELECT l.realm,l.keycloak_organization_id,l.tenant_id,l.organization_id,l.state,l.revision "+
      "FROM public.platform_keycloak_org_links l "+
      "JOIN public.tenant_registry t ON t.tenant_id=l.tenant_id AND t.state='active' "+
      "WHERE l.tenant_id=$1::uuid AND l.organization_id=$2::uuid",
      [tenantId,organizationId]);
  }
  async findKeycloak(realm:string,keycloakOrganizationId:string):Promise<readonly OrganizationIdentityLink[]>{
    if(!REALM.test(realm)||!UUID.test(keycloakOrganizationId))return [];
    return this.rows(
      "SELECT l.realm,l.keycloak_organization_id,l.tenant_id,l.organization_id,l.state,l.revision "+
      "FROM public.platform_keycloak_org_links l "+
      "JOIN public.tenant_registry t ON t.tenant_id=l.tenant_id AND t.state='active' "+
      "WHERE l.realm=$1 AND l.keycloak_organization_id=$2::uuid",
      [realm,keycloakOrganizationId]);
  }
}

function originFor(endpoint:string):URL{
  let url:URL;
  try{url=new URL(endpoint);}catch{throw new TypeError("Unsafe Keycloak endpoint");}
  const loopback=url.protocol==="http:" &&
    ["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  if(!(url.protocol==="https:"||loopback)||url.username||url.password||
    url.search||url.hash||url.pathname!=="/")
    throw new TypeError("Unsafe Keycloak endpoint");
  return url;
}
function memberPath(realm:string,org:string,sub:string):string{
  return "/admin/realms/"+encodeURIComponent(realm)+"/organizations/"+
    encodeURIComponent(org)+"/members/"+encodeURIComponent(sub);
}

export interface ServiceTokenSource {
  getToken():Promise<string>;
}

/** Confidential client_credentials token, obtained from a protected file on
 * each membership check. No admin password, browser token or token caching.
 * The Keycloak service account must only have read permission for users.
 */
export class KeycloakServiceAccountTokens implements ServiceTokenSource {
  private readonly endpoint:string;
  constructor(baseUrl:string,realm:string,private readonly clientId:string,
    private readonly secretFile:string,private readonly send:typeof fetch=fetch){
    const base=originFor(baseUrl);
    if(!REALM.test(realm)||!CLIENT.test(clientId)||
       clientId==="syndes-master-admin"||
       !secretFile.startsWith("/")||secretFile.includes("\0"))
      throw new TypeError("Unsafe IAM service identity");
    this.endpoint=new URL("/realms/"+encodeURIComponent(realm)+
      "/protocol/openid-connect/token",base).toString();
  }
  async getToken():Promise<string>{
    const secret=(await readFile(this.secretFile,"utf8")).trim();
    if(secret.length<12||secret.includes("\n"))throw new Error("IAM service credentials unavailable");
    let response:Response;
    try{
      response=await this.send(this.endpoint,{
        method:"POST",redirect:"error",cache:"no-store",
        signal:AbortSignal.timeout(3000),
        headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},
        body:new URLSearchParams({
          grant_type:"client_credentials",client_id:this.clientId,client_secret:secret,
        }).toString(),
      });
    }catch{throw new Error("IAM service token transport unavailable");}
    if(response.status!==200)throw new Error("IAM service token unavailable");
    let data:unknown;
    try{data=await response.json();}catch{throw new Error("IAM service token invalid");}
    const token=(data as {access_token?:unknown})?.access_token;
    if(typeof token!=="string"||!JWT.test(token))
      throw new Error("IAM service token invalid");
    return token;
  }
}

/** Keycloak 26.8.1 official Admin REST endpoint; requires the service account's
 * scoped user-read permission. 404 means no membership; every other anomaly
 * throws and the context-admission caller denies the operation.
 */
export class KeycloakOrganizationMembershipReader implements KeycloakOrganizationMembershipPort {
  private readonly base:URL;
  constructor(baseUrl:string,private readonly realm:string,
    private readonly service:ServiceTokenSource,private readonly send:typeof fetch=fetch){
    this.base=originFor(baseUrl);
    if(!REALM.test(realm)||!service||typeof service.getToken!=="function")
      throw new TypeError("Invalid Keycloak Organization membership reader");
  }
  async isActiveMember(realm:string,keycloakOrganizationId:string,principalId:string):Promise<boolean>{
    if(realm!==this.realm||!UUID.test(keycloakOrganizationId)||!UUID.test(principalId))
      return false;
    const token=await this.service.getToken();
    if(!JWT.test(token))throw new Error("IAM service token invalid");
    let response:Response;
    try{
      response=await this.send(new URL(memberPath(realm,keycloakOrganizationId,principalId),this.base),{
        method:"GET",redirect:"error",cache:"no-store",
        signal:AbortSignal.timeout(3000),
        headers:{Authorization:"Bearer "+token,Accept:"application/json"},
      });
    }catch{throw new Error("Keycloak Organization transport unavailable");}
    if(response.status===404)return false;
    if(response.status!==200)throw new Error("Keycloak Organization unavailable");
    let result:unknown;
    try{result=await response.json();}catch{throw new Error("Keycloak Organization response invalid");}
    return !!result && typeof result==="object" && !Array.isArray(result) &&
      (result as {id?:unknown}).id===principalId &&
      (result as {enabled?:unknown}).enabled===true;
  }
}
