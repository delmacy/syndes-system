/**
 * IAM-07D5 — CI-only HTTP entry for an actual Inbox claim.
 * Deliberately NOT included in main.ts or any operational module registry.
 */
import {Controller,Headers,HttpCode,HttpException,Inject,Param,Post} from "@nestjs/common";
import type {VerifiedClientActorPort} from "./iam-organization-context-pilot.js";
import type {Iam07dInboxBusinessPilot} from "./iam07d-inbox-business-pilot.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const IAM07D5_HTTP_DEPS="SYNDES_IAM07D5_HTTP_DEPS";
export type Iam07d5HttpDeps=Readonly<{
 verifier:VerifiedClientActorPort;
 business:Pick<Iam07dInboxBusinessPilot,"claim">;
}>;

@Controller("__ci/iam07d5/tenants")
export class Iam07d5InboxClaimController{
 constructor(@Inject(IAM07D5_HTTP_DEPS) private readonly deps:Iam07d5HttpDeps){
  if(process.env.CI_MASTER_REAL_PG!=="1"||
     process.env.SYNDES_IAM06B_REAL!=="IAM06B_DISPOSABLE_ONLY")
   throw new Error("IAM07D5 business HTTP is disposable CI ONLY");
 }
 @Post(":tenantId/inbox/conversations/:conversationId/claim")
 @HttpCode(200)
 async claim(
  @Param("tenantId") tenantId:string,
  @Param("conversationId") conversationId:string,
  @Headers("authorization") bearer:string|undefined,
  @Headers("x-syndes-organization-id") organizationId:string|undefined,
  @Headers("x-syndes-workspace-id") workspaceId:string|undefined,
 ):Promise<Readonly<{claimed:true}>>{
  if(!bearer?.startsWith("Bearer "))
   throw new HttpException("Authentication required",401);
  try{await this.deps.verifier.verifyClient(bearer,"syndes-iam-lab-ui");}
  catch{throw new HttpException("Authentication required",401);}
  if(![tenantId,conversationId,organizationId,workspaceId]
    .every(x=>typeof x==="string"&&UUID.test(x)))
   throw new HttpException("Forbidden",403);
  try{
   const result=await this.deps.business.claim(bearer,{
    tenantId,organizationId:organizationId!,workspaceId:workspaceId!,
    capability:"inbox.conversation.claim",
   },conversationId);
   if(result.id!==conversationId||!result.assignedTo)
    throw new Error("Business claim not confirmed");
   // Never echo token, membership, tenant database details or identity.
   return {claimed:true};
  }catch{throw new HttpException("Forbidden",403);}
 }
}
