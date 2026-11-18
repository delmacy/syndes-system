/**
 * Operational, read-only Keycloak Organizations admission component.
 * Keycloak owns identity and live organization membership. Control owns the
 * immutable org ↔ tenant association. SQL ownership and OpenFGA grants are
 * separate mandatory gates; this component NEVER issues a business grant.
 */
import {AccessDeniedError} from "@syndes/core-kernel";
import type {OrganizationIdentityLinksPort,KeycloakOrganizationMembershipPort}
 from "./iam-organization-context-pilot.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REALM=/^[a-z][a-z0-9_-]{1,80}$/;

/** Fail-closed and NEVER cache membership. A revoked Keycloak Organization
 * must block the next authorized operation even if JWT remains valid.
 */
export class OperationalOrganizationMembershipGate{
 constructor(private readonly realm:string,
  private readonly links:OrganizationIdentityLinksPort,
  private readonly members:KeycloakOrganizationMembershipPort){
  if(!REALM.test(realm)||!links||!members||
     typeof links.findPlatform!=="function"||
     typeof links.findKeycloak!=="function"||
     typeof members.isActiveMember!=="function")
    throw new TypeError("Invalid operational Organizations gate");
 }
 async requireActive(tenantId:string,organizationId:string,principalId:string):Promise<void>{
  if(![tenantId,organizationId,principalId].every(x=>typeof x==="string"&&UUID.test(x)))
   throw new AccessDeniedError();
  try{
   const forward=await this.links.findPlatform(tenantId,organizationId);
   if(forward.length!==1)throw new AccessDeniedError();
   const link=forward[0];
   if(link.state!=="active"||link.realm!==this.realm||
      link.tenantId!==tenantId||link.organizationId!==organizationId||
      !UUID.test(link.keycloakOrganizationId))
    throw new AccessDeniedError();
   const reverse=await this.links.findKeycloak(this.realm,link.keycloakOrganizationId);
   if(reverse.length!==1)throw new AccessDeniedError();
   const inverse=reverse[0];
   if(inverse.state!=="active"||inverse.revision!==link.revision||
      inverse.realm!==this.realm||inverse.tenantId!==tenantId||
      inverse.organizationId!==organizationId||
      inverse.keycloakOrganizationId!==link.keycloakOrganizationId)
    throw new AccessDeniedError();
   if(await this.members.isActiveMember(
      this.realm,link.keycloakOrganizationId,principalId)!==true)
    throw new AccessDeniedError();
  }catch{
   // Never interpret a Keycloak/Control outage, malformed reply, or stale
   // link as an ALLOW. Do not surface membership details in HTTP errors.
   throw new AccessDeniedError();
  }
 }
}
