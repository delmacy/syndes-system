/**
 * IAM-07C: opt-in, read-only Nest HTTP adapter for the disposable composite lab.
 * NOT an Inbox controller, NOT mounted by main.ts or modules.json.
 * This route never reads/conveys business content and never issues a grant.
 */
import {Controller,Get,Headers,HttpException,Inject,Param} from "@nestjs/common";
import type {AuthorizationPort} from "@syndes/core-kernel";
import type {VerifiedClientActorPort,OrganizationContextAdmissionPilot}
 from "./iam-organization-context-pilot.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT="syndes-iam-lab-ui";
export const IAM07C_HTTP_DEPS="SYNDES_IAM07C_HTTP_DEPS";
export type Iam07cHttpDeps=Readonly<{
 verifier:VerifiedClientActorPort;
 admission:Pick<OrganizationContextAdmissionPilot,"resolve">;
 fga:AuthorizationPort;
}>;

@Controller("__ci/iam07c/tenants")
export class Iam07cHttpAdmissionController{
 constructor(@Inject(IAM07C_HTTP_DEPS)private readonly deps:Iam07cHttpDeps){
  if(process.env.CI_MASTER_REAL_PG!=="1"||
     process.env.SYNDES_IAM06B_REAL!=="IAM06B_DISPOSABLE_ONLY")
   throw new Error("IAM-07C Nest admission is disposable-CI ONLY");
 }
 @Get(":tenantId/inbox/conversations/read")
 async read(@Param("tenantId")tenantId:string,
  @Headers("authorization")bearer:string|undefined,
  @Headers("x-syndes-organization-id")organizationId:string|undefined,
  @Headers("x-syndes-workspace-id")workspaceId:string|undefined)
  :Promise<Readonly<{authorized:true}>>{
  // Keep invalid syntax and identities outside every tenant/Control database.
  if(!bearer?.startsWith("Bearer "))
   throw new HttpException("Authentication required",401);
  try{await this.deps.verifier.verifyClient(bearer,CLIENT)}
  catch{throw new HttpException("Authentication required",401)}
  if(!UUID.test(tenantId)||!UUID.test(organizationId??"")||
     !UUID.test(workspaceId??""))
   throw new HttpException("Forbidden",403);
  try{
   const context=await this.deps.admission.resolve(bearer,{
    tenantId,organizationId:organizationId!,workspaceId:workspaceId!,
    capability:"inbox.conversation.read",
   });
   if(context.actor.kind!=="user"||
      context.tenantId!==tenantId||
      context.organizationId!==organizationId||
      context.workspaceId!==workspaceId||
      context.moduleId!=="inbox"||
      context.capability!=="inbox.conversation.read"||
      await this.deps.fga.canAccess({
       actor:context.actor,tenantId,
       resource:"inbox:conversations",action:"read",
      })!==true)
    throw new Error("Access denied");
   // This is a pure admission probe — never return a conversation or grant.
   return {authorized:true};
  }catch{throw new HttpException("Forbidden",403)}
 }
}
