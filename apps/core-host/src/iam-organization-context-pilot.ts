/**
 * IAM-04/05 candidate: resolves a trusted identity/organization/workspace
 * context. This is NOT an access decision for a business capability.
 *
 * In particular, a successful result MUST NOT bypass the current OpenFGA
 * AuthorizationPort, module-specific resource policy, or SQL owner checks.
 * Not wired into Core Host runtime, no Keycloak/PG mutations or secrets.
 */
import {
  AccessDeniedError,requireModuleAccess,resolveSelectedOperationalScope,
  type Actor,type ModuleAccessPort,type TenancyPort,
  type TrustedTenantDatabaseProvider,
} from "@syndes/core-kernel";
import {IAM07D_CAPABILITIES,iam07dModule,iam07dScopeKind} from "./iam07d-capability-catalog.js";
import {pilotResourceName,type TrustedKeycloakPilotContext,
  type KeycloakPilotCapability} from "./keycloak-authorization-pilot.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REALM=/^[a-z][a-z0-9_-]{1,80}$/;
const CLIENT=/^[a-z][a-z0-9-]{2,127}$/;
const CAPABILITIES=Object.freeze({
 "inbox.conversation.read":{moduleId:"inbox",write:false,kind:"workspace"},
 "inbox.message.send":{moduleId:"inbox",write:true,kind:"workspace"},
 ...Object.fromEntries(IAM07D_CAPABILITIES.map(cap=>[cap,{
  moduleId:iam07dModule(cap),write:true,kind:iam07dScopeKind(cap),
 }]))
} as Record<KeycloakPilotCapability,{moduleId:"inbox"|"service";write:boolean;kind:"workspace"|"funnel"}>);

export type OrganizationIdentityLink=Readonly<{
  realm:string;
  keycloakOrganizationId:string;
  tenantId:string;
  organizationId:string;
  state:"active"|"revoked";
  revision:number;
}>;

/** Candidate Control Plane index, NOT a second user/grant store.
 * Both directions are mandatory to detect collisions and stale reconciliations.
 * Implementations must return all matching records (not LIMIT 1).
 */
export interface OrganizationIdentityLinksPort {
  findPlatform(tenantId:string,organizationId:string):Promise<readonly OrganizationIdentityLink[]>;
  findKeycloak(realm:string,keycloakOrganizationId:string):Promise<readonly OrganizationIdentityLink[]>;
}

/** A fresh Keycloak Organization membership check by immutable principal sub.
 * Not a cached JWT "organization" claim, local group or trust in the browser.
 * Outages and 404 must never grant membership.
 */
export interface KeycloakOrganizationMembershipPort {
  isActiveMember(realm:string,keycloakOrganizationId:string,principalId:string):Promise<boolean>;
}

/** Business-domain owner guard; active funnel must belong to the same context.
 * A positive UMA policy or org role alone does not verify funnel ownership.
 */
export interface PilotFunnelOwnershipPort {
  isActiveInWorkspace(input:Readonly<{
    tenantId:string;organizationId:string;workspaceId:string;funnelId:string;
  }>):Promise<boolean>;
}

/** Existing ActorVerifier verifies signature, issuer, audience AND azp client.
 * This port must NEVER be implemented by decoding JWT payload without verification.
 */
export interface VerifiedClientActorPort {
  verifyClient(bearer:string|undefined,clientId:string):Promise<Actor>;
}

export type RequestedIamPilotContext=Readonly<{
  tenantId:string;
  organizationId:string;
  workspaceId:string;
  funnelId?:string;
  capability:KeycloakPilotCapability;
}>;

export type ResolvedIamPilotContext=Readonly<{
  actor:Actor;
  tenantId:string;
  organizationId:string;
  workspaceId:string;
  keycloakOrganizationId:string;
  realm:string;
  capability:KeycloakPilotCapability;
  moduleId:"inbox"|"service";
  resourceName:string;
  scopeWriteAllowed:boolean;
}>;

export class OrganizationContextAdmissionPilot {
  constructor(private readonly deps:Readonly<{
    realm:string;
    clientId:string;
    multiOrganizationEnabled:boolean;
    verifier:VerifiedClientActorPort;
    tenancy:TenancyPort;
    links:OrganizationIdentityLinksPort;
    keycloakMembers:KeycloakOrganizationMembershipPort;
    moduleAccess:ModuleAccessPort;
    tenantDatabases:TrustedTenantDatabaseProvider;
    funnelOwnership:PilotFunnelOwnershipPort;
  }>){
    if(!REALM.test(deps?.realm??"")||!CLIENT.test(deps?.clientId??"")||
       deps.clientId==="syndes-master-admin"||
       typeof deps.multiOrganizationEnabled!=="boolean"||
       !deps.verifier||!deps.tenancy||!deps.links||!deps.keycloakMembers||
       !deps.moduleAccess||!deps.tenantDatabases||!deps.funnelOwnership)
      throw new TypeError("IAM pilot configuration invalid");
  }

  async resolve(bearer:string|undefined,requested:RequestedIamPilotContext)
    :Promise<ResolvedIamPilotContext>{
    // Every failure is an access denial. Never log the bearer, sub, Keycloak
    // response body, membership rows, SQL credentials, or admin tokens.
    try{
      if(!requested)throw new AccessDeniedError();
      const {tenantId,organizationId,workspaceId,capability,funnelId}=requested;
      if(!UUID.test(tenantId??"")||!UUID.test(organizationId??"")||
         !UUID.test(workspaceId??"")||
         !Object.hasOwn(CAPABILITIES,capability??""))throw new AccessDeniedError();
      const definition=CAPABILITIES[capability];
      if(definition.kind==="funnel"?!UUID.test(funnelId??""):funnelId!==undefined)
        throw new AccessDeniedError();

      // Verify signed OIDC identity before ANY source of customer data.
      // The verifier must enforce the fixed issuer, audience and client azp.
      const actor=await this.deps.verifier.verifyClient(bearer,this.deps.clientId);
      if(actor.kind!=="user"||!UUID.test(actor.id))throw new AccessDeniedError();
      if(await this.deps.tenancy.canAccessTenant({actor,tenantId})!==true)
        throw new AccessDeniedError();

      // The account must have the module installed, enabled and entitled.
      await requireModuleAccess(this.deps.moduleAccess,{
        actor,tenantId,moduleId:definition.moduleId,
      });

      // Resolve exactly ONE ACTIVE immutable link in both directions.
      // Duplicate, revoked or mismatched records fail closed.
      const byPlatform=await this.deps.links.findPlatform(tenantId,organizationId);
      if(!Array.isArray(byPlatform)||byPlatform.length!==1)
        throw new AccessDeniedError();
      const link=byPlatform[0];
      if(!this.linkMatches(link,tenantId,organizationId))
        throw new AccessDeniedError();
      const byKeycloak=await this.deps.links.findKeycloak(
        this.deps.realm,link.keycloakOrganizationId);
      if(!Array.isArray(byKeycloak)||byKeycloak.length!==1||
         !this.sameLink(link,byKeycloak[0]))
        throw new AccessDeniedError();

      // A valid UMA grant is NOT proof of organization membership. IAM-03
      // showed positive UMA after removing the user from the organization.
      if(await this.deps.keycloakMembers.isActiveMember(
        this.deps.realm,link.keycloakOrganizationId,actor.id)!==true)
        throw new AccessDeniedError();

      // Server-selected tenant database and existing SQL002/backfill checks.
      const db=await this.deps.tenantDatabases.resolve(tenantId);
      const selected=await resolveSelectedOperationalScope(
        db,tenantId,actor,{organizationId,workspaceId},
        this.deps.multiOrganizationEnabled);
      if(selected.organizationId!==organizationId||
         selected.workspaceId!==workspaceId)throw new AccessDeniedError();
      if(definition.write&&selected.scopeWriteAllowed!==true)
        throw new AccessDeniedError();

      if(definition.kind==="funnel"&&await this.deps.funnelOwnership.isActiveInWorkspace({
        tenantId,organizationId,workspaceId,funnelId:funnelId!,
      })!==true)throw new AccessDeniedError();

      const scope:TrustedKeycloakPilotContext={
        tenantId,organizationId,workspaceId,kind:definition.kind,
        ...(definition.kind==="funnel"?{funnelId}:{}),
      };
      return Object.freeze({
        actor:Object.freeze({...actor}),
        tenantId,organizationId,workspaceId,
        keycloakOrganizationId:link.keycloakOrganizationId,
        realm:this.deps.realm,capability,moduleId:definition.moduleId,
        resourceName:pilotResourceName(scope),
        scopeWriteAllowed:selected.scopeWriteAllowed,
      });
    }catch{
      throw new AccessDeniedError();
    }
  }

  private linkMatches(link:OrganizationIdentityLink,tenantId:string,
    organizationId:string):boolean{
    return link?.realm===this.deps.realm&&
      UUID.test(link?.keycloakOrganizationId??"")&&
      link?.tenantId===tenantId&&link.organizationId===organizationId&&
      link.state==="active"&&Number.isSafeInteger(link.revision)&&link.revision>0;
  }
  private sameLink(a:OrganizationIdentityLink,b:OrganizationIdentityLink):boolean{
    return b?.realm===a.realm&&b.keycloakOrganizationId===a.keycloakOrganizationId&&
      b.tenantId===a.tenantId&&b.organizationId===a.organizationId&&
      b.state===a.state&&b.revision===a.revision;
  }
}
