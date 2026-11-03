import {Body,Controller,Get,Headers,HttpException,Inject,Injectable,Optional,Param,Patch,Post,Query,Res} from "@nestjs/common";
import {AccessDeniedError} from "@syndes/core-kernel";
import {InboxService} from "./service.js";
import {SimulatedChannelAdapter} from "./channels.js";
import {InboxConflictError,PgInboxRepositoryFactory} from "./postgres.js";
import {InboxTenantMismatchError,InboxValidationError} from "./contracts.js";
import type {ConversationStatus,ConversationQueue,HandoffMode,InboxContext,CreateConversation} from "./contracts.js";
import {id} from "./validation.js";
import {InboxChangeBus,type SseSink} from "./realtime.js";
import {CORE_RUNTIME,TENANT_DATABASES,type InboxHostRuntime} from "./runtime.js";
import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";

@Injectable()
export class InboxHost{
 readonly inbox:InboxService;
 readonly simulator:SimulatedChannelAdapter;
 readonly events=new InboxChangeBus();
 constructor(
  @Inject(CORE_RUNTIME) private readonly core:InboxHostRuntime,
  @Inject(TENANT_DATABASES) pools:TrustedTenantDatabaseProvider,
  @Optional() @Inject("SYNDES_WHATSAPP_REPLY")
  private readonly whatsappReply?:{
   enqueue(ctx:InboxContext,conversationId:string,body:unknown):Promise<unknown|null>;
   decorate(tenantId:string,messages:readonly {id:string;direction:string}[]):Promise<readonly unknown[]>;
   decorateConversations(tenantId:string,conversations:readonly {id:string;channel:string}[]):Promise<readonly unknown[]>;
  }
 ){
  const repo=new PgInboxRepositoryFactory(pools);
  this.inbox=new InboxService(core.kernel,tenantId=>repo.forTenant(tenantId));
  this.simulator=new SimulatedChannelAdapter(this.inbox);
 }
 async list(ctx:InboxContext,status:ConversationStatus|null,limit:number,queue:ConversationQueue){
  const records=await this.inbox.list(ctx,status,limit,queue);
  if(!this.whatsappReply)return records;
  return this.whatsappReply.decorateConversations(ctx.tenantId,records);
 }
 async get(ctx:InboxContext,conversationId:string){
  const result=await this.inbox.get(ctx,conversationId);
  if(!result||!this.whatsappReply)return result;
  const [decorated]=await this.whatsappReply.decorateConversations(ctx.tenantId,[result]);
  return decorated;
 }
 async messages(ctx:InboxContext,conversationId:string,limit:number){
  const selected=await this.inbox.messages(ctx,conversationId,limit);
  if(!selected || !this.whatsappReply)return selected;
  // The Inbox authorization and tenant-scoped query run before any decoration.
  return this.whatsappReply.decorate(ctx.tenantId,selected);
 }
 async reply(ctx:InboxContext,conversationId:string,body:unknown){
  const conv=await this.inbox.get(ctx,conversationId);
  if(!conv)return null;
  if(conv.channel!=="whatsapp")return this.inbox.reply(ctx,conversationId,body);
  if(!this.whatsappReply)throw new HttpException("WhatsApp outbound module unavailable",503);
  // The WhatsApp adapter is invoked only after both tenant membership and
  // the *same* inbox:messages/write grant required by ordinary Inbox replies.
  return this.core.kernel.execute({
   tenantId:ctx.tenantId,actor:ctx.actor,action:"write",resource:"inbox:messages",
  },()=>this.whatsappReply!.enqueue(ctx,conversationId,body));
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
 @Get("events")
 async eventsStream(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
    @Res()response:SseSink):Promise<void>{
   // Before writing HTTP headers, verify JWT + tenancy membership + inbox read access.
   await this.run(t,h,c=>this.host.inbox.watch(c));
   try{this.host.events.connect(t,response);}
   catch{throw new HttpException("Too many live connections",429);}
 }
 @Get("conversations")
 list(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
      @Query("status")s:string|undefined,@Query("limit")l:string|undefined,
      @Query("queue")queue:string|undefined){
  return this.run(t,h,c=>this.host.list(c,(s||null) as ConversationStatus|null,
    l===undefined?30:Number(l),(queue||"all") as ConversationQueue));
 }
 @Post("conversations")
 create(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
        @Body()b:CreateConversation){
  return this.run(t,h,async c=>{const result=await this.host.inbox.create(c,b);this.host.events.publish(c.tenantId);return result;});
 }
 @Get("conversations/:id")
 get(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@Param("id")key:string){
  return this.run(t,h,async c=>found(await this.host.get(c,key)));
 }
 @Get("conversations/:id/messages")
 messages(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
          @Param("id")key:string,@Query("limit")l:string|undefined){
  return this.run(t,h,async c=>found(await this.host.messages(c,key,l===undefined?100:Number(l))));
 }
 @Patch("conversations/:id/assignment")
 assign(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
        @Param("id")key:string,@Body()b:{assigneeId?:string|null}){
  return this.run(t,h,async c=>{const result=found(await this.host.inbox.assign(c,key,b?.assigneeId));this.host.events.publish(c.tenantId);return result;});
 }
 @Patch("conversations/:id/status")
 status(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
        @Param("id")key:string,@Body()b:{status:ConversationStatus}){
  return this.run(t,h,async c=>{const result=found(await this.host.inbox.status(c,key,b?.status));this.host.events.publish(c.tenantId);return result;});
 }
 @Patch("conversations/:id/handoff")
 handoff(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
         @Param("id")key:string,@Body()b:{mode:HandoffMode}){
  return this.run(t,h,async c=>{const result=found(await this.host.inbox.handoff(c,key,b?.mode));this.host.events.publish(c.tenantId);return result;});
 }
 @Patch("conversations/:id/contact")
 contact(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
         @Param("id")key:string,@Body()b:{personId?:string}){
  return this.run(t,h,async c=>{
   const result=found(await this.host.inbox.linkContact(c,key,b?.personId??""));
   this.host.events.publish(c.tenantId);
   return this.host.get(c,key);
  });
 }
 @Post("conversations/:id/replies")
 reply(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
       @Param("id")key:string,@Body()b:{body:string}){
  return this.run(t,h,async c=>{const result=found(await this.host.reply(c,key,b?.body));this.host.events.publish(c.tenantId);return result;});
 }
 @Post("conversations/:id/notes")
 note(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
      @Param("id")key:string,@Body()b:{body:string}){
  return this.run(t,h,async c=>{const result=found(await this.host.inbox.note(c,key,b?.body));this.host.events.publish(c.tenantId);return result;});
 }
 @Post("conversations/:id/simulator/inbound")
 simulate(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
          @Param("id")key:string,@Body()b:{body:string;externalMessageId:string}){
  return this.run(t,h,async c=>{const result=found(await this.host.simulator.receive(c,{channel:"simulation",conversationId:key,body:b?.body,externalMessageId:b?.externalMessageId}));this.host.events.publish(c.tenantId);return result;});
 }
 @Get("metrics")
 metrics(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined){
  return this.run(t,h,c=>this.host.inbox.metrics(c));
 }
}
