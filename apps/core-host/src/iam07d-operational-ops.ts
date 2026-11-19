/**
 * Multi-org IAM07D operational composition. The existing IAM07D protocol
 * remains the only business write / epoch implementation, and all ambient
 * credentials arrive from the trusted Host (never browser headers).
 *
 * The capability model is deliberately small: claim, scoped transfer and
 * Service funnel advance. Other legacy writes must fail closed in multi-org.
 */
import {Inject,Injectable} from "@nestjs/common";
import {AccessDeniedError,type Actor,type TenantTransaction,
 type TrustedTenantTransactionProvider} from "@syndes/core-kernel";
import type {Pool} from "pg";
type PinnedServicePort=Readonly<{
 advancePinned(ctx:Readonly<{tenantId:string;organizationId:string;
  workspaceId:string;actor:Actor}>,input:Readonly<{
  attendanceId:string;nextStageId:string;expectedVersion:number;
 }>,tx:TenantTransaction):Promise<unknown>;
}>;
import {ActorVerifier,PgMembership} from "./adapters.js";
import {PgModuleLifecycle} from "./module-lifecycle.js";
import {PgEffectiveModuleAccess} from "./module-effective-access.js";
import {PgOrganizationIdentityLinks,KeycloakServiceAccountTokens,
 KeycloakOrganizationMembershipReader} from "./iam-organization-adapters.js";
import {OrganizationContextAdmissionPilot,type RequestedIamPilotContext}
 from "./iam-organization-context-pilot.js";
import {OpenFgaFineCapabilityPolicy} from "./iam07d-fine-fga-policy.js";
import {Iam07dRevokeFirstPilot} from "./iam07d-revoke-first-pilot.js";
import {Iam07dInboxBusinessPilot} from "./iam07d-inbox-business-pilot.js";
import {Iam07dServiceFunnelBusinessPilot} from "./iam07d-service-funnel-business-pilot.js";
import type {CoreRuntimeSecrets} from "./secrets.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const required=(name:string)=>{const x=process.env[name];if(!x?.trim())throw Error("Missing "+name);return x};
export const IAM07D_OPS="SYNDES_IAM07D_OPS";
type Host=Readonly<{db:Pool;verifier:ActorVerifier;moduleStates:PgModuleLifecycle}>;
type Selected=Readonly<{tenantId:string;organizationId:string;workspaceId:string}>;
function request(scope:Selected,capability:RequestedIamPilotContext["capability"],
 funnelId?:string):RequestedIamPilotContext{
 if(!scope||![scope.tenantId,scope.organizationId,scope.workspaceId]
    .every(x=>typeof x==="string"&&UUID.test(x))||
    (funnelId!==undefined&&!UUID.test(funnelId)))
   throw new AccessDeniedError();
 return Object.freeze({...scope,capability,...(funnelId?{funnelId}:{})});
}

@Injectable()
export class OperationalIam07dOperations{
 private readonly gate?:Iam07dRevokeFirstPilot;
 private readonly inbox?:Iam07dInboxBusinessPilot;
 constructor(@Inject("SYNDES_CORE_API")core:Host,
  @Inject("SYNDES_TENANT_DB")tenants:TrustedTenantTransactionProvider,
  @Inject("SYNDES_CORE_RUNTIME_SECRETS")secrets:CoreRuntimeSecrets){
  if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true")return;
  const issuer=new URL(required("CORE_KEYCLOAK_ISSUER"));
  const match=/^\/realms\/([a-z][a-z0-9_-]{1,80})$/.exec(issuer.pathname);
  if(!match||issuer.search||issuer.hash||
     (issuer.protocol!=="https:"&&!(issuer.protocol==="http:"&&
        ["localhost","127.0.0.1"].includes(issuer.hostname))))
   throw Error("Invalid operational IAM issuer");
  const realm=match[1];
  const reader=new KeycloakServiceAccountTokens(issuer.origin,realm,
   required("CORE_IAM_ORG_READER_CLIENT_ID"),
   required("CORE_IAM_ORG_READER_SECRET_FILE"));
  const admission=new OrganizationContextAdmissionPilot({
   realm,clientId:required("CORE_IAM_TENANT_OIDC_CLIENT_ID"),
   multiOrganizationEnabled:true,
   verifier:core.verifier,
   tenancy:new PgMembership(core.db),
   links:new PgOrganizationIdentityLinks(core.db),
   keycloakMembers:new KeycloakOrganizationMembershipReader(
    issuer.origin,realm,reader),
   moduleAccess:new PgEffectiveModuleAccess(core.moduleStates),
   tenantDatabases:tenants,
   funnelOwnership:{isActiveInWorkspace:async s=>{
    if(![s.tenantId,s.organizationId,s.workspaceId,s.funnelId]
       .every(x=>typeof x==="string"&&UUID.test(x)))return false;
    const db=await tenants.resolve(s.tenantId);
    if(db.tenantId!==s.tenantId)return false;
    const rows=await db.query(`
      SELECT 1 FROM service.service_funnels f
      JOIN public.platform_workspaces w
       ON w.tenant_id=f.tenant_id AND w.organization_id=f.organization_id
        AND w.id=f.workspace_id AND w.status='active'
      JOIN public.platform_organizations o
       ON o.tenant_id=f.tenant_id AND o.id=f.organization_id
        AND o.status='active'
      WHERE f.tenant_id=$1::uuid AND f.organization_id=$2::uuid
       AND f.workspace_id=$3::uuid AND f.id=$4::uuid
       AND f.state='published' LIMIT 1
     `,[s.tenantId,s.organizationId,s.workspaceId,s.funnelId]);
    return rows.rows.length===1;
   }},
  });
  const specific=new OpenFgaFineCapabilityPolicy(
   required("CORE_OPENFGA_URL"),required("CORE_IAM07D_FINE_FGA_STORE_ID"),
   secrets.openfgaToken);
  this.gate=new Iam07dRevokeFirstPilot(admission,specific,tenants,core.db);
  this.inbox=new Iam07dInboxBusinessPilot(this.gate);
 }
 async claim(bearer:string,scope:Selected,conversationId:string){
  if(!this.inbox)throw new AccessDeniedError();
  return this.inbox.claim(bearer,request(scope,"inbox.conversation.claim"),conversationId);
 }
 async transfer(bearer:string,scope:Selected,conversationId:string,destination:string){
  if(!this.inbox)throw new AccessDeniedError();
  return this.inbox.transfer(bearer,request(scope,"inbox.conversation.transfer"),
   conversationId,destination);
 }
 async advance(bearer:string,scope:Selected,funnelId:string,
  service:PinnedServicePort,input:Readonly<{
    attendanceId:string;nextStageId:string;expectedVersion:number;
  }>){
  if(!this.gate)throw new AccessDeniedError();
  const business=new Iam07dServiceFunnelBusinessPilot(this.gate,service);
  return business.advance(bearer,request(scope,"service.funnel.operate",funnelId),input);
 }
}
