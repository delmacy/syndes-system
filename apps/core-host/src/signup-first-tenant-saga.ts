/** UC-SIGNUP-01C — first-tenant operator saga. No HTTP entrypoint.
 * Keycloak owns credentials/membership; Control owns registry/link; tenant
 * installer owns database and SQL; OpenFGA owns narrow resource grants.
 * These ports deliberately do not accept browser DSNs, tenant IDs or tokens.
 */
import {AccessDeniedError} from "@syndes/core-kernel";
import type {SignupReservation,SignupReservationInput} from "./signup-control-intents.js";

type IntentPort={
 reserve(input:SignupReservationInput):Promise<SignupReservation>;
 markReady(requestId:string,founderId:string,keycloakOrgId:string):Promise<void>;
 markReconcileRequired(requestId:string,founderId:string):Promise<void>;
 get(requestId:string,founderId:string):Promise<SignupReservation>;
};
export interface FirstTenantInstallPort{
 /** Creates/recovers the named tenant DB from a trusted registry, using the
  * fixed tenant ID in the reservation. No caller-supplied connection string. */
 ensureDatabase(intent:SignupReservation):Promise<void>;
 verifyDatabase(intent:SignupReservation):Promise<boolean>;
 /** SQL002 stays present for the FIRST default Organization/Workspace. */
 ensureDefaultContext(intent:SignupReservation):Promise<void>;
 verifyDefaultContext(intent:SignupReservation):Promise<boolean>;
 /** Activate Control tenant ONLY after all other dependencies are verified. */
 activate(intent:SignupReservation):Promise<void>;
 verifyActive(intent:SignupReservation):Promise<boolean>;
}
export interface FirstTenantKeycloakPort{
 ensureOrganization(alias:string,name:string):Promise<string>;
 ensureMember(kcOrgId:string,founderId:string):Promise<void>;
 isActiveMember(kcOrgId:string,founderId:string):Promise<boolean>;
}
export interface FirstTenantLinkPort{
 ensure(intent:SignupReservation,kcOrgId:string):Promise<void>;
 verify(intent:SignupReservation,kcOrgId:string):Promise<boolean>;
}
export interface FirstTenantFgaPort{
 /** Must grant ONLY the explicit foundation capabilities, never module-wide. */
 ensureMinimum(intent:SignupReservation):Promise<void>;
 verifyMinimum(intent:SignupReservation):Promise<boolean>;
}
type Ports=Readonly<{
 authorizeOperator(input:SignupReservationInput):Promise<boolean>;
 /** Session-pinned lock, per requestId, across ALL external operations. */
 withRequestLock<T>(requestId:string,work:(assertHeld:()=>Promise<void>)=>Promise<T>):Promise<T>;
 intents:IntentPort;
 installer:FirstTenantInstallPort;
 keycloak:FirstTenantKeycloakPort;
 links:FirstTenantLinkPort;
 grants:FirstTenantFgaPort;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class FirstTenantSignupSaga{
 constructor(private readonly ports:Ports){}
 async resume(input:SignupReservationInput):Promise<Readonly<{
  ready:true;tenantId:string;organizationId:string;workspaceId:string;
 }>>{
  if(!input||!UUID.test(input.requestId)||!UUID.test(input.founderId)||
      await this.ports.authorizeOperator(input)!==true)
   throw new AccessDeniedError();
  // This lease must have a dedicated live PostgreSQL session, NOT a pg Pool
  // query, because a session-level advisory lock cannot survive pooling.
  return this.ports.withRequestLock(input.requestId,async assertHeld=>{
   const intent=await this.ports.intents.reserve(input);
   const response=()=>Object.freeze({
    ready:true as const,tenantId:intent.tenantId,
    organizationId:intent.organizationId,workspaceId:intent.workspaceId,
   });
   const verify=async(kcId:string):Promise<boolean>=>{
    if(!UUID.test(kcId))return false;
    // No cached provider verdict, and no JWT can replace membership lookup.
    return await this.ports.installer.verifyDatabase(intent)===true&&
      await this.ports.installer.verifyDefaultContext(intent)===true&&
      await this.ports.installer.verifyActive(intent)===true&&
      await this.ports.keycloak.isActiveMember(kcId,intent.founderId)===true&&
      await this.ports.links.verify(intent,kcId)===true&&
      await this.ports.grants.verifyMinimum(intent)===true;
   };
   if(intent.state==="ready"){
    // Critical: NO ensure/grant API on replay of ready. A revoked Keycloak
    // membership or FGA grant remains revoked.
    if(!intent.keycloakOrganizationId||
       !await verify(intent.keycloakOrganizationId))throw new AccessDeniedError();
    return response();
   }
   try{
    await this.ports.installer.ensureDatabase(intent);
    if(!await this.ports.installer.verifyDatabase(intent))throw new AccessDeniedError();
    const kcId=await this.ports.keycloak.ensureOrganization(
      intent.keycloakAlias,intent.organizationName);
    if(!UUID.test(kcId)||(intent.keycloakOrganizationId&&
       intent.keycloakOrganizationId!==kcId))throw new AccessDeniedError();
    await this.ports.keycloak.ensureMember(kcId,intent.founderId);
    if(!await this.ports.keycloak.isActiveMember(kcId,intent.founderId))
     throw new AccessDeniedError();
    await this.ports.installer.ensureDefaultContext(intent);
    if(!await this.ports.installer.verifyDefaultContext(intent))
     throw new AccessDeniedError();
    await this.ports.links.ensure(intent,kcId);
    if(!await this.ports.links.verify(intent,kcId))throw new AccessDeniedError();
    await this.ports.grants.ensureMinimum(intent);
    if(!await this.ports.grants.verifyMinimum(intent))throw new AccessDeniedError();
    await this.ports.installer.activate(intent);
    // Only a current live recheck across all systems may precede READY.
    if(!await verify(kcId))throw new AccessDeniedError();
    await assertHeld();
    await this.ports.intents.markReady(intent.requestId,intent.founderId,kcId);
    await assertHeld();
    const final=await this.ports.intents.get(intent.requestId,intent.founderId);
    if(final.state!=="ready"||final.keycloakOrganizationId!==kcId||
       !await verify(kcId))throw new AccessDeniedError();
    return response();
   }catch{
    try{await this.ports.intents.markReconcileRequired(intent.requestId,intent.founderId)}
    catch{/* no success on uncertain reconciliation */}
    throw new AccessDeniedError();
   }
  });
 }
}
