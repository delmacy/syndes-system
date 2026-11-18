/**
 * TOPO-04: read-only CI ONLY multi-org admission using the SAME signed human
 * Keycloak JWT and independently scoped fine OpenFGA grant. Not operational.
 */
import {Controller,Get,Headers,HttpException,Inject,Param} from "@nestjs/common";
import type {OrganizationContextAdmissionPilot,VerifiedClientActorPort}
 from "./iam-organization-context-pilot.js";
import type {SpecificIam07dPolicy} from "./iam07d-revoke-first-pilot.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const IAM_TOPOLOGY_HTTP_DEPS="SYNDES_IAM_TOPOLOGY_HTTP_DEPS";
export type IamTopologyHttpDeps=Readonly<{
 verifier:VerifiedClientActorPort;
 admission:Pick<OrganizationContextAdmissionPilot,"resolve">;
 fine:SpecificIam07dPolicy;
}>;

@Controller("__ci/iam-topology/tenants")
export class IamTopologyMultiOrgHttpController{
 constructor(@Inject(IAM_TOPOLOGY_HTTP_DEPS)
  private readonly deps:IamTopologyHttpDeps){
  if(process.env.CI_MASTER_REAL_PG!=="1"||
     process.env.SYNDES_IAM06B_REAL!=="IAM06B_DISPOSABLE_ONLY")
   throw new Error("Multi-org HTTP admission is disposable CI ONLY");
 }
 @Get(":tenantId/inbox/conversations/claim-admission")
 async claimAdmission(
  @Param("tenantId")tenantId:string,
  @Headers("authorization")bearer:string|undefined,
  @Headers("x-syndes-organization-id")organizationId:string|undefined,
  @Headers("x-syndes-workspace-id")workspaceId:string|undefined,
 ):Promise<Readonly<{authorized:true}>>{
  if(!bearer?.startsWith("Bearer "))
   throw new HttpException("Authentication required",401);
  try{await this.deps.verifier.verifyClient(bearer,"syndes-iam-lab-ui")}
  catch{throw new HttpException("Authentication required",401)}
  if(!UUID.test(tenantId)||!UUID.test(organizationId??"")||
     !UUID.test(workspaceId??""))
   throw new HttpException("Forbidden",403);
  try{
   const context=await this.deps.admission.resolve(bearer,{
    tenantId,organizationId:organizationId!,workspaceId:workspaceId!,
    capability:"inbox.conversation.claim",
   });
   if(context.tenantId!==tenantId||
      context.organizationId!==organizationId||
      context.workspaceId!==workspaceId||
      context.actor.kind!=="user"||
      context.moduleId!=="inbox"||
      context.capability!=="inbox.conversation.claim"||
      context.scopeWriteAllowed!==true||
      await this.deps.fine.canPerform(context,"inbox.conversation.claim")!==true)
    throw new Error("Denied");
   return {authorized:true};
  }catch{throw new HttpException("Forbidden",403)}
 }
}
