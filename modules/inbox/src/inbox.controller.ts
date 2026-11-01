import {Body,Controller,Get,Headers,HttpException,Inject,Injectable,Param,Patch,Post,Query} from "@nestjs/common";
import {AccessDeniedError} from "@syndes/core-kernel";
import {InboxService} from "./service.js";
import {InboxConflictError,PgInboxRepositoryFactory} from "./postgres.js";
import {InboxTenantMismatchError,InboxValidationError} from "./contracts.js";
import type {ConversationStatus,HandoffMode,InboxContext,CreateConversation} from "./contracts.js";
import {id} from "./validation.js";
import {CORE_RUNTIME,TENANT_DATABASES,type InboxHostRuntime} from "./runtime.js";
import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";

@Injectable()
export class InboxHost{
 readonly inbox:InboxService;
 constructor(
  @Inject(CORE_RUNTIME) private readonly core:InboxHostRuntime,
  @Inject(TENANT_DATABASES) pools:TrustedTenantDatabaseProvider
 ){
  const repo=new PgInboxRepositoryFactory(pools);
  this.inbox=new InboxService(core.kernel,tenantId=>repo.forTenant(tenantId));
 }
 async run<T>(tenantId:string,authorization:string|undefined,task:(context:InboxContext)=>Promise<T>):Promise<T>{
  try{id(tenantId,"tenant")}catch{throw new HttpException("Invalid tenant ID",400)}
  let actor;
  try{actor=await this.core.verifier.verify(authorization)}
  catch{throw new HttpException("Authentication required",401)}
  try{return await task({tenantId,actor})}
  catch(error){
   if(error instanceof HttpException)throw error;
   if(error instanceof AccessDeniedError)throw new HttpException("Forbidden",403);
   if(error instanceof InboxValidationError)throw new HttpException(error.message,400);
   if(error instanceof InboxConflictError||isPgCode(error,"23505"))throw new HttpException("Conflict",409);
   if(isPgCode(error,"23503"))throw new HttpException("Invalid CRM reference",400);
   if(error instanceof InboxTenantMismatchError)throw new HttpException("Tenant unavailable",503);
   throw new HttpException("Inbox temporarily unavailable",503);
  }
 }
}
function isPgCode(error:unknown,code:string):boolean{
 return typeof error==="object"&&error!==null&&"code" in error&&error.code===code;
}
function found<T>(value:T|null):T{
 if(value===null)throw new HttpException("Conversation not found or action unavailable",404);
 return value;
}
@Controller("v1/tenants/:tenantId/inbox")
export class InboxController{
 constructor(private readonly host:InboxHost){}
 private run<T>(tenant:string,header:string|undefined,handler:(ctx:InboxContext)=>Promise<T>):Promise<T>{
  return this.host.run(tenant,header,handler);
 }
 @Get("conversations")
 list(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
      @Query("status")s:string|undefined,@Query("limit")l:string|undefined){
  return this.run(t,h,c=>this.host.inbox.list(c,(s||null) as ConversationStatus|null,l===undefined?30:Number(l)));
 }
 @Post("conversations")
 create(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
        @Body()b:CreateConversation){
  return this.run(t,h,c=>this.host.inbox.create(c,b));
 }
 @Get("conversations/:id")
 get(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@Param("id")key:string){
  return this.run(t,h,async c=>found(await this.host.inbox.get(c,key)));
 }
 @Get("conversations/:id/messages")
 messages(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
          @Param("id")key:string,@Query("limit")l:string|undefined){
  return this.run(t,h,async c=>found(await this.host.inbox.messages(c,key,l===undefined?100:Number(l))));
 }
 @Patch("conversations/:id/assignment")
 assign(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
        @Param("id")key:string,@Body()b:{assigneeId?:string|null}){
  return this.run(t,h,async c=>found(await this.host.inbox.assign(c,key,b?.assigneeId)));
 }
 @Patch("conversations/:id/status")
 status(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
        @Param("id")key:string,@Body()b:{status:ConversationStatus}){
  return this.run(t,h,async c=>found(await this.host.inbox.status(c,key,b?.status)));
 }
 @Patch("conversations/:id/handoff")
 handoff(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
         @Param("id")key:string,@Body()b:{mode:HandoffMode}){
  return this.run(t,h,async c=>found(await this.host.inbox.handoff(c,key,b?.mode)));
 }
 @Post("conversations/:id/replies")
 reply(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
       @Param("id")key:string,@Body()b:{body:string}){
  return this.run(t,h,async c=>found(await this.host.inbox.reply(c,key,b?.body)));
 }
 @Post("conversations/:id/notes")
 note(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
      @Param("id")key:string,@Body()b:{body:string}){
  return this.run(t,h,async c=>found(await this.host.inbox.note(c,key,b?.body)));
 }
 @Post("conversations/:id/simulator/inbound")
 simulate(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
          @Param("id")key:string,@Body()b:{body:string;externalMessageId:string}){
  return this.run(t,h,async c=>found(await this.host.inbox.simulate(c,key,b?.body,b?.externalMessageId)));
 }
 @Get("metrics")
 metrics(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined){
  return this.run(t,h,c=>this.host.inbox.metrics(c));
 }
}
