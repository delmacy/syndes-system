/**
 * TOPO-04B: disposable CI-only Nest adapter for REAL Inbox claim mutation.
 * Never registered by main.ts or operational modules.json.
 * Reuses IAM07D verified JWT, Organization membership, Control module gate,
 * exact FGA capability and tenant-first pinned epoch fence.
 */
import {Controller,Post,Headers,HttpCode,HttpException,Inject,Param}
 from "@nestjs/common";
import type {VerifiedClientActorPort}
 from "./iam-organization-context-pilot.js";
import type {Iam07dInboxBusinessPilot}
 from "./iam07d-inbox-business-pilot.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const IAM_TOPOLOGY_CLAIM_DEPS="SYNDES_IAM_TOPOLOGY_CLAIM_DEPS";
export type IamTopologyClaimDeps=Readonly<{
 verifier:VerifiedClientActorPort;
 business:Pick<Iam07dInboxBusinessPilot,"claim">;
}>;

@Controller("__ci/iam-topology/tenants")
export class IamTopologyInboxClaimController{
 constructor(@Inject(IAM_TOPOLOGY_CLAIM_DEPS)
  private readonly deps:IamTopologyClaimDeps){
  if(process.env.CI_MASTER_REAL_PG!=="1"||
     process.env.SYNDES_IAM06B_REAL!=="IAM06B_DISPOSABLE_ONLY")
   throw new Error("TOPO-04B Inbox claim is disposable CI ONLY");
 }
 @Post(":tenantId/inbox/conversations/:conversationId/claim")
 @HttpCode(200)
 async claim(
  @Param("tenantId")tenantId:string,
  @Param("conversationId")conversationId:string,
  @Headers("authorization")bearer:string|undefined,
  @Headers("x-syndes-organization-id")organizationId:string|undefined,
  @Headers("x-syndes-workspace-id")workspaceId:string|undefined,
 ):Promise<Readonly<{claimed:true}>>{
  if(!bearer?.startsWith("Bearer "))
   throw new HttpException("Authentication required",401);
  try{await this.deps.verifier.verifyClient(bearer,"syndes-iam-lab-ui")}
  catch{throw new HttpException("Authentication required",401)}
  if(!UUID.test(tenantId)||!UUID.test(conversationId)||
     !UUID.test(organizationId??"")||!UUID.test(workspaceId??""))
   throw new HttpException("Forbidden",403);
  try{
   const result=await this.deps.business.claim(bearer,{
    tenantId,organizationId:organizationId!,workspaceId:workspaceId!,
    capability:"inbox.conversation.claim",
   },conversationId);
   if(result.id!==conversationId)throw new Error("Claim scope mismatch");
   return {claimed:true};
  }catch{throw new HttpException("Forbidden",403)}
 }
}
