/**
 * Restricted Keycloak Organization writer and Control immutable link writer.
 * Service account must have ONLY org-create/member/read privileges; the
 * existing identity reader remains read-only in the operational Core Host.
 * No network calls or SQL commands originate from a browser directly.
 */
import {AccessDeniedError} from "@syndes/core-kernel";
import {KeycloakOrganizationMembershipReader,
 type ServiceTokenSource,PgOrganizationIdentityLinks}
 from "./iam-organization-adapters.js";
import type {OrgProvisionIntent,TrustedKeycloakOrgWriter,TrustedOrgLinkWriter}
 from "./iam-org-provisioning-operator.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REALM=/^[a-z][a-z0-9_-]{1,80}$/;
const ALIAS=/^syndes-[0-9a-f]{32}-[0-9a-f]{32}$/;
function origin(text:string):URL{
 const u=new URL(text);
 if((u.protocol!=="https:"&&!(u.protocol==="http:"&&
     ["localhost","127.0.0.1"].includes(u.hostname)))||
     u.username||u.password||u.search||u.hash||u.pathname!=="/")
  throw new TypeError("Unsafe IAM Keycloak admin origin");
 return u;
}
export class KeycloakOrganizationWriter implements TrustedKeycloakOrgWriter{
 private readonly root:URL;
 private readonly membership:KeycloakOrganizationMembershipReader;
 constructor(base:string,private readonly realm:string,
  private readonly tokens:ServiceTokenSource,private readonly send:typeof fetch=fetch){
  this.root=origin(base);
  if(!REALM.test(realm)||!tokens||typeof tokens.getToken!=="function")
   throw new TypeError("Untrusted Keycloak writer configuration");
  this.membership=new KeycloakOrganizationMembershipReader(base,realm,tokens,send);
 }
 private url(path:string):URL{
  return new URL("/admin/realms/"+encodeURIComponent(this.realm)+"/organizations"+path,this.root);
 }
 private async call(path:string,method:"GET"|"POST",body?:unknown){
  const token=await this.tokens.getToken();
  if(typeof token!=="string"||!token)throw new AccessDeniedError();
  return this.send(this.url(path),{
   method,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(5000),
   headers:{Authorization:"Bearer "+token,Accept:"application/json",
    ...(body!==undefined?{"Content-Type":"application/json"}:{})},
   body:body===undefined?undefined:JSON.stringify(body),
  });
 }
 private async find(alias:string,name:string):Promise<string|null>{
  // Keycloak 26 Organizations search filters NAME or DOMAIN, not alias.
  // Query exact human name, then match our immutable deterministic alias.
  // Page through homonyms; never silently miss an older organization and
  // create a duplicate after losing the original POST response.
  const matches:unknown[]=[];
  for(let first=0;first<=1000;first+=100){
   const path="?search="+encodeURIComponent(name)+
    "&exact=true&briefRepresentation=false&first="+first+"&max=100";
   const list=await this.call(path,"GET");
   if(list.status!==200)throw new AccessDeniedError();
   const values:unknown=await list.json();
   if(!Array.isArray(values)||values.length>100)throw new AccessDeniedError();
   for(const value of values){
    if(value&&typeof value==="object"&&(value as {alias?:unknown}).alias===alias)
     matches.push(value);
   }
   if(matches.length>1)throw new AccessDeniedError();
   if(values.length<100)break;
   if(first===1000)throw new AccessDeniedError();
  }
  if(!matches.length)return null;
  const found=matches[0] as {id?:unknown;name?:unknown;enabled?:unknown};
  if(typeof found.id!=="string"||!UUID.test(found.id)||
    found.name!==name||found.enabled!==true)throw new AccessDeniedError();
  return found.id;
 }
 async ensureOrganization(alias:string,name:string):Promise<string>{
  if(!ALIAS.test(alias)||typeof name!=="string"||
    name.trim().length<2||name.trim().length>160)
   throw new AccessDeniedError();
  const first=await this.find(alias,name);
  if(first)return first;
  const created=await this.call("","POST",{name,alias,enabled:true});
  if(![201,204,409].includes(created.status))throw new AccessDeniedError();
  const found=await this.find(alias,name);
  if(!found)throw new AccessDeniedError();
  return found;
 }
 async ensureMember(organizationId:string,founderId:string):Promise<void>{
  if(!UUID.test(organizationId)||!UUID.test(founderId))
   throw new AccessDeniedError();
  // The immutable Keycloak user UUID is a JSON STRING, not an account copy.
  const response=await this.call("/"+organizationId+"/members","POST",founderId);
  if(![201,204,409].includes(response.status))throw new AccessDeniedError();
  if(!await this.isActiveMember(organizationId,founderId))
   throw new AccessDeniedError();
 }
 isActiveMember(organizationId:string,founderId:string):Promise<boolean>{
  return this.membership.isActiveMember(this.realm,organizationId,founderId);
 }
}
type Control=Readonly<{
 query(sql:string,values:readonly unknown[]):Promise<{
  rows:Record<string,unknown>[];rowCount:number|null;
 }>;
}>;
/** The injected Control pool MUST use the isolated iam_link_operator role.
 * No ACL can be elevated by the Host's syndes_core role to run this function.
 * Revoked links cannot silently be reactivated by a retry of provisioning.
 */
export class PgOrganizationProvisionLinkWriter implements TrustedOrgLinkWriter{
 private readonly reader:PgOrganizationIdentityLinks;
 constructor(private readonly control:Control,private readonly realm:string){
  if(!REALM.test(realm))throw new TypeError("Invalid IAM link realm");
  this.reader=new PgOrganizationIdentityLinks(control as ConstructorParameters<
   typeof PgOrganizationIdentityLinks>[0]);
 }
 async ensure(intent:OrgProvisionIntent,kcId:string):Promise<void>{
  if(!UUID.test(kcId))throw new AccessDeniedError();
  const links=await this.reader.findPlatform(intent.tenantId,intent.organizationId);
  if(links.length>1)throw new AccessDeniedError();
  if(links.length===1){
   if(links[0].keycloakOrganizationId!==kcId||
      links[0].realm!==this.realm||links[0].state!=="active")
    throw new AccessDeniedError();
   return;
  }
  const updated=await this.control.query(`
    SELECT public.transition_platform_keycloak_org_link(
     $1::uuid,$2::uuid,$3,$4::uuid,'active',0,$5::uuid,$6,$7) AS revision
  `,[intent.tenantId,intent.organizationId,this.realm,kcId,
     intent.requestId,intent.founderId,"Resumable Organization provisioning"]);
  if(updated.rows.length!==1||Number(updated.rows[0].revision)!==1)
   throw new AccessDeniedError();
 }
 async verify(intent:OrgProvisionIntent,kcId:string):Promise<boolean>{
  const forward=await this.reader.findPlatform(intent.tenantId,intent.organizationId);
  const reverse=await this.reader.findKeycloak(this.realm,kcId);
  return forward.length===1&&reverse.length===1&&
   forward[0].realm===this.realm&&forward[0].state==="active"&&
   forward[0].keycloakOrganizationId===kcId&&
   reverse[0].revision===forward[0].revision&&
   reverse[0].tenantId===intent.tenantId&&
   reverse[0].organizationId===intent.organizationId&&
   reverse[0].state==="active";
 }
}
