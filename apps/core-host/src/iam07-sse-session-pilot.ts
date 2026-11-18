/**
 * IAM-07A isolated stream pilot: signed user + current memberships, module
 * entitlement, tenant SQL002 context, and CURRENT OpenFGA on every SSE check.
 *
 * NOT wired to Core Host or the operational Inbox. No UMA shadow decision is
 * treated as an entitlement; Keycloak UMA cannot override an FGA DENY.
 * A new SSE listener must only be registered after open() returns.
 */
import type {AuthorizationPort} from "@syndes/core-kernel";
import {
  OrganizationContextAdmissionPilot,
  type RequestedIamPilotContext,type ResolvedIamPilotContext,
} from "./iam-organization-context-pilot.js";

export type Iam07SseSession=Readonly<{
  address:Readonly<{tenantId:string;organizationId:string;workspaceId:string}>;
  /** The InboxChangeBus is responsible for rechecking BEFORE publishing. */
  revalidate:()=>Promise<boolean>;
}>;

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The endpoint must supply the ORIGINAL Authorization bearer and selected
 * scope; neither is replaced by data coming from a downstream SSE publish.
 * All check errors become deny (false), including Keycloak/Control/PG/FGA.
 */
export class Iam07SseSessionPilot {
  constructor(private readonly admission:Pick<OrganizationContextAdmissionPilot,"resolve">,
    private readonly fga:AuthorizationPort){
    if(!admission||typeof admission.resolve!=="function"||
       !fga||typeof fga.canAccess!=="function")
      throw new TypeError("Invalid IAM-07 SSE provider configuration");
  }
  async open(bearer:string,requested:RequestedIamPilotContext):Promise<Iam07SseSession>{
    if(typeof bearer!=="string"||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer)||
       !requested||requested.capability!=="inbox.conversation.read"||
       !UUID.test(requested.tenantId)||!UUID.test(requested.organizationId)||
       !UUID.test(requested.workspaceId)||requested.funnelId!==undefined)
      throw new Error("IAM-07 stream admission denied");
    // Freeze exact authoritative resource keys; the caller cannot mutate a
    // request selection after opening the connection.
    const fixed:RequestedIamPilotContext=Object.freeze({
      tenantId:requested.tenantId,
      organizationId:requested.organizationId,
      workspaceId:requested.workspaceId,
      capability:"inbox.conversation.read" as const,
    });
    let initial:ResolvedIamPilotContext;
    try{
      initial=await this.admission.resolve(bearer,fixed);
      if(initial.capability!=="inbox.conversation.read"||
         initial.moduleId!=="inbox"||
         initial.tenantId!==fixed.tenantId||
         initial.organizationId!==fixed.organizationId||
         initial.workspaceId!==fixed.workspaceId||
         initial.actor.kind!=="user"||!UUID.test(initial.actor.id)||
         !UUID.test(initial.keycloakOrganizationId)||
         !await this.fga.canAccess({
           actor:initial.actor,tenantId:initial.tenantId,
           resource:"inbox:conversations",action:"read",
         }))
        throw new Error("IAM-07 stream access denied");
    }catch{throw new Error("IAM-07 stream admission denied");}
    const address=Object.freeze({
      tenantId:initial.tenantId,
      organizationId:initial.organizationId,
      workspaceId:initial.workspaceId,
    });
    const revalidate=async():Promise<boolean>=>{
      try{
        const current=await this.admission.resolve(bearer,fixed);
        if(current.actor.kind!==initial.actor.kind||
           current.actor.id!==initial.actor.id||
           current.tenantId!==address.tenantId||
           current.organizationId!==address.organizationId||
           current.workspaceId!==address.workspaceId||
           current.keycloakOrganizationId!==initial.keycloakOrganizationId||
           current.realm!==initial.realm||
           current.capability!=="inbox.conversation.read"||
           current.moduleId!=="inbox"||
           current.resourceName!==initial.resourceName)return false;
        // FGA is always the final effective authority. No cached verdict,
        // including when a positive UMA result survives membership revocation.
        return await this.fga.canAccess({
          actor:current.actor,tenantId:current.tenantId,
          resource:"inbox:conversations",action:"read",
        })===true;
      }catch{return false;}
    };
    return Object.freeze({address,revalidate});
  }
}
