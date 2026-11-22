import {Body,Controller,Get,Headers,HttpException,Inject,Injectable,Optional,Param,Patch,Post,Query,Res} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import {AccessDeniedError,type Actor,type TenantTransaction,
 type RequestedOperationalScope} from "@syndes/core-kernel";
import {SelectedScope} from "./selection-header.js";
import {InboxService} from "./service.js";
import {SimulatedChannelAdapter} from "./channels.js";
import {InboxConflictError,PgInboxRepository,PgInboxRepositoryFactory} from "./postgres.js";
import {InboxTenantMismatchError,InboxValidationError} from "./contracts.js";
import type {ConversationStatus,ConversationQueue,ChatScope,HandoffMode,InboxContext,CreateConversation,Conversation,Message} from "./contracts.js";
import {id,text,optionalExternal,assignee} from "./validation.js";
import {InboxChangeBus,type SseSink} from "./realtime.js";
import {InboxDefaultContextGuard} from "./context-guard.js";
import {CORE_RUNTIME,TENANT_DATABASES,type InboxHostRuntime} from "./runtime.js";
import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";

type PinnedInboxCapability=
 |"inbox.conversation.create"|"inbox.conversation.assign"|
 "inbox.conversation.status"|"inbox.conversation.handoff"|
 "inbox.conversation.favorite"|"inbox.conversation.mark_read"|
 "inbox.conversation.link_contact"|"inbox.message.reply"|
 "inbox.message.note"|"inbox.message.simulate"|"inbox.conversation.history_sync";
@Injectable()
export class InboxHost{
 readonly inbox:InboxService;
 readonly simulator:SimulatedChannelAdapter;
 readonly events:InboxChangeBus;
 readonly scope:InboxDefaultContextGuard;
 readonly requiresStreamRevalidation:boolean;
 constructor(
  @Inject(CORE_RUNTIME) private readonly core:InboxHostRuntime,
  @Inject(TENANT_DATABASES) pools:TrustedTenantDatabaseProvider,
  @Inject("SYNDES_INBOX_EVENTS") events:InboxChangeBus,
  @Optional() @Inject("SYNDES_WHATSAPP_REPLY")
  private readonly whatsappReply?:{
   enqueue(ctx:InboxContext,conversationId:string,body:unknown):Promise<unknown|null>;
   enqueuePinned(ctx:InboxContext,conversationId:string,body:unknown,
    tx:TenantTransaction):Promise<Message|null>;
   enqueueHistoryPinned(ctx:InboxContext,conversationId:string,tx:TenantTransaction):Promise<{requested:boolean;note:string}>;
   requestHistory(ctx:InboxContext,conversationId:string):Promise<{requested:boolean;note:string}>;
   decorate(ctx:InboxContext,messages:readonly {id:string;direction:string}[]):Promise<readonly unknown[]>;
   decorateConversations(ctx:InboxContext,conversations:readonly {id:string;channel:string}[]):Promise<readonly unknown[]>;
  },
  @Optional() @Inject("SYNDES_IAM07D_OPS")
  private readonly exact?:{
   claim(bearer:string,scope:{tenantId:string;organizationId:string;workspaceId:string},
    conversationId:string):Promise<{id:string}>;
   transfer(bearer:string,scope:{tenantId:string;organizationId:string;workspaceId:string},
    conversationId:string,destination:string):Promise<{id:string}>;
   executeMutation<T>(bearer:string,
    scope:{tenantId:string;organizationId:string;workspaceId:string},
    capability:PinnedInboxCapability,funnelId:undefined,
    effect:(tx:TenantTransaction,actor:Actor)=>Promise<T>):Promise<T>;
  },
 ){
  this.events=events;
  // A multi-org tenant cannot keep a legacy SSE stream with only the
  // coarse FGA grant and no re-check of the scoped membership.
  if(process.env.SYNDES_MULTI_ORG_ENABLED==="true"&&
     core.inboxModuleGateMode!=="enforce")
    throw Error("Multi-org Inbox requires enforced live SSE module gate");
  this.requiresStreamRevalidation=core.inboxModuleGateMode==="enforce";
  const repo=new PgInboxRepositoryFactory(pools);
  this.scope=new InboxDefaultContextGuard(core.kernel,pools,core.inboxModuleGateMode==="enforce");
  this.inbox=new InboxService(core.kernel,(tenantId,scope)=>repo.forTenant(tenantId,scope));
  this.simulator=new SimulatedChannelAdapter(this.inbox);
 }
 async list(ctx:InboxContext,status:ConversationStatus|null,limit:number,queue:ConversationQueue,scope:ChatScope,offset:number,search:string){
  const records=await this.inbox.list(ctx,status,limit,queue,scope,offset,search);
  if(!this.whatsappReply)return records;
  return this.whatsappReply.decorateConversations(ctx,records);
 }
 async get(ctx:InboxContext,conversationId:string){
  const result=await this.inbox.get(ctx,conversationId);
  if(!result||!this.whatsappReply)return result;
  const [decorated]=await this.whatsappReply.decorateConversations(ctx,[result]);
  return decorated;
 }
 async messages(ctx:InboxContext,conversationId:string,limit:number){
  const selected=await this.inbox.messages(ctx,conversationId,limit);
  if(!selected || !this.whatsappReply)return selected;
  // The Inbox authorization and tenant-scoped query run before any decoration.
  return this.whatsappReply.decorate(ctx,selected);
 }
 async history(ctx:InboxContext,conversationId:string){
  const conv=await this.inbox.get(ctx,conversationId);
  if(!conv||conv.channel!=="whatsapp")throw new HttpException("WhatsApp conversation unavailable",404);
  if(!this.whatsappReply)throw new HttpException("WhatsApp integration unavailable",503);
  return this.core.kernel.execute({actor:ctx.actor,tenantId:ctx.tenantId,
     action:"read",resource:"whatsapp:accounts"},
    ()=>this.whatsappReply!.requestHistory(ctx,conversationId));
 }
 async queueHistory(ctx:InboxContext,bearer:string|undefined,conversationId:string){
  if(process.env.SYNDES_MULTI_ORG_HISTORY_SYNC!=="true"||!this.whatsappReply?.enqueueHistoryPinned||
     !this.exact?.executeMutation||!bearer||!ctx.organizationId||!ctx.workspaceId||
     ctx.scopeWriteAllowed!==true)throw new AccessDeniedError();
  const key=id(conversationId,"conversation");
  await this.core.kernel.executeModule({actor:ctx.actor,tenantId:ctx.tenantId,
   moduleId:"whatsapp",action:"read",resource:"whatsapp:accounts"},async()=>{});
  const scope={tenantId:ctx.tenantId,organizationId:ctx.organizationId,workspaceId:ctx.workspaceId};
  const queue=this.whatsappReply;
  return this.exact.executeMutation(bearer,scope,"inbox.conversation.history_sync",undefined,async(tx,actor)=>{
   if(actor.id!==ctx.actor.id||actor.kind!==ctx.actor.kind||tx.tenantId!==ctx.tenantId)
    throw new AccessDeniedError();
   const repo=new PgInboxRepository(tx,scope);
   const conversation=await repo.get(ctx.tenantId,key);
   if(!conversation||conversation.channel!=="whatsapp")throw new HttpException("WhatsApp conversation unavailable",404);
   return queue.enqueueHistoryPinned(ctx,key,tx);
  });
 }
 async reply(ctx:InboxContext,conversationId:string,body:unknown){
  if(ctx.scopeWriteAllowed===false)throw new AccessDeniedError();
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
 private async requireLiveOrganization(context:InboxContext):Promise<void>{
  if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true")return;
  if(!context.organizationId||!this.core.organizationAccess)
   throw new AccessDeniedError();
  await this.core.organizationAccess.requireActive(
   context.tenantId,context.organizationId,context.actor.id);
 }
 async claimExact(context:InboxContext,bearer:string|undefined,conversationId:string){
  if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true"||!this.exact||
     !context.organizationId||!context.workspaceId||!bearer)
   throw new AccessDeniedError();
  return this.exact.claim(bearer,{tenantId:context.tenantId,
   organizationId:context.organizationId,workspaceId:context.workspaceId},conversationId);
 }
 async transferExact(context:InboxContext,bearer:string|undefined,
  conversationId:string,destination:string){
  if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true"||!this.exact||
     !context.organizationId||!context.workspaceId||!bearer)
   throw new AccessDeniedError();
  return this.exact.transfer(bearer,{tenantId:context.tenantId,
   organizationId:context.organizationId,workspaceId:context.workspaceId},
   conversationId,destination);
 }
 /** Entire business mutation AND existing Inbox/WhatsApp audit happen in
  * the exact IAM07D epoch-lock transaction. No separate tenant pool query,
  * remote provider call or second transaction is allowed inside the effect.
  */
 async mutateExact(context:InboxContext,bearer:string|undefined,
  capability:PinnedInboxCapability,conversationId:string|undefined,
  input:unknown):Promise<Conversation|Message|null>{
  if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true"||
     !this.exact?.executeMutation||!bearer||
     !context.organizationId||!context.workspaceId||
     context.scopeWriteAllowed===false)throw new AccessDeniedError();
  const key=capability==="inbox.conversation.create"
   ?undefined:id(conversationId,"conversation");
  const body=(input&&typeof input==="object"&&!Array.isArray(input))
   ?input as Record<string,unknown>:{};
  let validated:Record<string,unknown>={};
  switch(capability){
   case "inbox.conversation.create":
    validated={
     subject:text(body.subject,"subject",160),
     crmPersonId:body.crmPersonId==null?null:id(body.crmPersonId,"CRM person"),
     externalThreadId:optionalExternal(body.externalThreadId),
    };
    break;
   case "inbox.conversation.assign":{
    const assigned=assignee(body.assigneeId);
    if(assigned!==null){
     const recipient={id:assigned,kind:"user" as const};
     for(const permission of [
      {action:"read",resource:"inbox:conversations"},
      {action:"write",resource:"inbox:messages"},
     ] as const){
      // Additional recipient FGA, before opening the epoch transaction.
      await this.core.kernel.execute({
       actor:recipient,tenantId:context.tenantId,...permission,
      },async()=>{});
     }
    }
    validated={assigneeId:assigned};
    break;
   }
   case "inbox.conversation.status":
    if(!["open","pending","resolved"].includes(String(body.status)))
     throw new InboxValidationError("Invalid status");
    validated={status:body.status};
    break;
   case "inbox.conversation.handoff":
    if(!["human","bot"].includes(String(body.mode)))
     throw new InboxValidationError("Invalid handoff");
    validated={mode:body.mode};
    break;
   case "inbox.conversation.favorite":
    if(typeof body.favorite!=="boolean")
     throw new InboxValidationError("Invalid favorite state");
    validated={favorite:body.favorite};
    break;
   case "inbox.conversation.mark_read":break;
   case "inbox.conversation.link_contact":
    validated={personId:id(body.personId,"CRM person")};
    await this.core.kernel.executeModule({
     actor:context.actor,tenantId:context.tenantId,moduleId:"crm",
     action:"read",resource:"crm:people",
    },async()=>{});
    break;
   case "inbox.message.reply":
    validated={body:text(body.body,"message",5000)};
    break;
   case "inbox.message.note":
    validated={body:text(body.body,"note",5000)};
    break;
   case "inbox.message.simulate":{
    const reference=optionalExternal(body.externalMessageId);
    if(!reference)throw new InboxValidationError("Simulation message ID required");
    validated={body:text(body.body,"message",5000),externalMessageId:reference};
    break;
   }
   default:throw new AccessDeniedError();
  }
  const scope={tenantId:context.tenantId,
   organizationId:context.organizationId,workspaceId:context.workspaceId};
  const selected=Object.freeze({...validated});
  return this.exact.executeMutation(bearer,scope,capability,undefined,
   async(tx,actor)=>{
    if(actor.kind!==context.actor.kind||actor.id!==context.actor.id||
       tx.tenantId!==context.tenantId)throw new AccessDeniedError();
    const repo=new PgInboxRepository(tx,{
     organizationId:scope.organizationId,workspaceId:scope.workspaceId,
    });
    const tenant=scope.tenantId,principal=actor.id;
    switch(capability){
     case "inbox.conversation.create":
      return repo.create(tenant,principal,{
       id:randomUUID(),subject:selected.subject as string,
       crmPersonId:selected.crmPersonId as string|null,
       externalThreadId:selected.externalThreadId as string|null,
      });
     case "inbox.conversation.assign":
      return repo.assign(tenant,key!,principal,selected.assigneeId as string|null);
     case "inbox.conversation.status":
      return repo.status(tenant,key!,principal,selected.status as ConversationStatus);
     case "inbox.conversation.handoff":
      return repo.handoff(tenant,key!,principal,selected.mode as HandoffMode);
     case "inbox.conversation.favorite":
      return repo.favorite(tenant,key!,principal,selected.favorite as boolean);
     case "inbox.conversation.mark_read":
      return repo.markRead(tenant,key!,principal);
     case "inbox.conversation.link_contact":
      return repo.linkContact(tenant,key!,principal,selected.personId as string);
     case "inbox.message.reply":{
      const conversation=await repo.get(tenant,key!);
      if(!conversation)return null;
      if(conversation.channel==="whatsapp"){
       if(!this.whatsappReply?.enqueuePinned)throw new AccessDeniedError();
       // A reply must not bypass current WhatsApp entitlement or its own
       // coarse per-account grant, even when Inbox fine-grant is valid.
       await this.core.kernel.executeModule({
        actor,tenantId:tenant,moduleId:"whatsapp",
        action:"write",resource:"whatsapp:accounts",
       },async()=>{});
       return this.whatsappReply.enqueuePinned(
        {...context,actor,organizationId:scope.organizationId,
         workspaceId:scope.workspaceId},key!,selected.body,tx);
      }
      return repo.append(tenant,key!,principal,{
       id:randomUUID(),direction:"outbound",body:selected.body as string,
       externalMessageId:null,
      });
     }
     case "inbox.message.note":
      return repo.append(tenant,key!,principal,{
       id:randomUUID(),direction:"internal",body:selected.body as string,
       externalMessageId:null,
      });
     case "inbox.message.simulate":
      return repo.append(tenant,key!,principal,{
       id:randomUUID(),direction:"inbound",body:selected.body as string,
       externalMessageId:selected.externalMessageId as string,
      });
     default:throw new AccessDeniedError();
    }
   });
 }
 async revalidateStream(context:InboxContext,bearer:string|undefined,selection?:RequestedOperationalScope):Promise<boolean>{
  // Module suspension and a stale JWT revoke an already-connected SSE stream.
  // Never reuse a user-supplied scope without checking both memberships again.
  const actor=await this.core.verifier.verify(bearer);
  if(actor.id!==context.actor.id||actor.kind!==context.actor.kind)throw new AccessDeniedError();
  const actual=await this.scope.resolve(context.tenantId,actor,selection);
  if(actual.organizationId!==context.organizationId||actual.workspaceId!==context.workspaceId)
   throw new AccessDeniedError();
  await this.requireLiveOrganization(context);
  return true;
 }
 async run<T>(tenantId:string,authorization:string|undefined,task:(context:InboxContext)=>Promise<T>,selection?:RequestedOperationalScope):Promise<T>{
  try{id(tenantId,"tenant")}catch{throw new HttpException("Invalid tenant ID",400)}
  let actor;
  try{actor=await this.core.verifier.verify(authorization)}
  catch{throw new HttpException("Authentication required",401)}
  try{
   const scoped=await this.scope.resolve(tenantId,actor,selection);
   await this.requireLiveOrganization(scoped);
   return await task(scoped);
  }
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
 private run<T>(tenant:string,header:string|undefined,handler:(ctx:InboxContext)=>Promise<T>,
  selection?:RequestedOperationalScope):Promise<T>{
  return this.host.run(tenant,header,handler,selection);
 }
 private legacyWrite<T>(tenant:string,header:string|undefined,
  handler:(ctx:InboxContext)=>Promise<T>,selection?:RequestedOperationalScope):Promise<T>{
  // No tenant-wide legacy mutation can borrow FGA coarse grants in multi-org.
  if(process.env.SYNDES_MULTI_ORG_ENABLED==="true")
   throw new HttpException("Exact write capability required",403);
  return this.run(tenant,header,handler,selection);
 }
 private mutate(tenant:string,bearer:string|undefined,
  selection:RequestedOperationalScope|undefined,
  capability:PinnedInboxCapability,key:string|undefined,input:unknown,
  legacy:(ctx:InboxContext)=>Promise<unknown>):Promise<unknown>{
  return this.run(tenant,bearer,async ctx=>{
   const result=found(process.env.SYNDES_MULTI_ORG_ENABLED==="true"
    ?await this.host.mutateExact(ctx,bearer,capability,key,input)
    :await legacy(ctx));
   this.host.events.publish(ctx);
   return result;
  },selection);
 }
 @Get("events")
 async eventsStream(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
    @Res()response:SseSink):Promise<void>{
   // Before writing HTTP headers, verify JWT + tenancy membership + inbox read access.
   const context=await this.run(t,h,async c=>{await this.host.inbox.watch(c);return c;},selection);
   // In enforcement mode, re-check the original principal, scoped memberships,
   // tenant FGA and ENABLED state while the stream remains open.
   const validate=this.host.requiresStreamRevalidation
    ?()=>this.host.revalidateStream(context,h,selection)
    :undefined;
   try{this.host.events.connect(context,response,validate);}
   catch{throw new HttpException("Too many live connections",429);}
 }
 @Get("conversations")
 list(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
      @Query("status")s:string|undefined,@Query("limit")l:string|undefined,
      @Query("queue")queue:string|undefined,@Query("scope")scope:string|undefined,
      @Query("offset")offset:string|undefined,@Query("q")search:string|undefined){
  return this.run(t,h,c=>this.host.list(c,(s||null) as ConversationStatus|null,
    l===undefined?30:Number(l),(queue||"all") as ConversationQueue,
   (scope||"all") as ChatScope,offset===undefined?0:Number(offset),search??""),selection);
 }
 @Post("conversations")
 create(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
        @Body()b:CreateConversation){
  return this.mutate(t,h,selection,"inbox.conversation.create",undefined,b,c=>this.host.inbox.create(c,b));
 }
 @Get("conversations/:id")
 get(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,@Param("id")key:string){
  return this.run(t,h,async c=>found(await this.host.get(c,key)),selection);
 }
 @Get("conversations/:id/messages")
 messages(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
          @Param("id")key:string,@Query("limit")l:string|undefined){
  return this.run(t,h,async c=>found(await this.host.messages(c,key,l===undefined?100:Number(l))),selection);
 }
 @Post("conversations/:id/claim")
 claim(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,
  @SelectedScope()selection:RequestedOperationalScope|undefined,
  @Param("id")key:string){
  return this.run(t,h,async c=>{
   const result=found(await this.host.claimExact(c,h,key));
   this.host.events.publish(c);
   return result;
  },selection);
 }
 @Patch("conversations/:id/assignment")
 assign(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
        @Param("id")key:string,@Body()b:{assigneeId?:string|null}){
  return this.mutate(t,h,selection,"inbox.conversation.assign",key,b,c=>this.host.inbox.assign(c,key,b?.assigneeId));
 }
 @Patch("conversations/:id/status")
 status(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
        @Param("id")key:string,@Body()b:{status:ConversationStatus}){
  return this.mutate(t,h,selection,"inbox.conversation.status",key,b,c=>this.host.inbox.status(c,key,b?.status));
 }
 @Patch("conversations/:id/handoff")
 handoff(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
         @Param("id")key:string,@Body()b:{mode:HandoffMode}){
  return this.mutate(t,h,selection,"inbox.conversation.handoff",key,b,c=>this.host.inbox.handoff(c,key,b?.mode));
 }
 @Patch("conversations/:id/workspace")
 transferWorkspace(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")key:string,@Body()b:{workspaceId?:string}){
  return this.run(t,h,async ctx=>{
   const target=id(b?.workspaceId??"","destination workspace");
   const moved=found(process.env.SYNDES_MULTI_ORG_ENABLED==="true"
    ?await this.host.transferExact(ctx,h,key,target)
    :await this.host.inbox.transferWorkspace(ctx,key,target));
   // Invalidate BOTH authorized snapshots. The service verifies that actor
   // can operate in the source and target workspaces before this emission.
   this.host.events.publish(ctx);
   this.host.events.publish({...ctx,workspaceId:target});
   return moved;
  },selection);
 }
 @Patch("conversations/:id/favorite")
 favorite(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")key:string,@Body()b:{favorite:boolean}){
   return this.mutate(t,h,selection,"inbox.conversation.favorite",key,b,c=>this.host.inbox.favorite(c,key,b?.favorite));
 }
 @Patch("conversations/:id/read")
 read(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,@Param("id")key:string){
   return this.mutate(t,h,selection,"inbox.conversation.mark_read",key,{},c=>this.host.inbox.markRead(c,key));
 }
 @Patch("conversations/:id/contact")
 contact(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
         @Param("id")key:string,@Body()b:{personId?:string}){
  return this.mutate(t,h,selection,"inbox.conversation.link_contact",key,b,c=>this.host.inbox.linkContact(c,key,b?.personId??""));
 }
 @Post("conversations/:id/history")
 requestHistory(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")key:string){
   if(process.env.SYNDES_MULTI_ORG_ENABLED==="true"&&process.env.SYNDES_MULTI_ORG_HISTORY_SYNC==="true")
    return this.run(t,h,c=>this.host.queueHistory(c,h,key),selection);
   return this.legacyWrite(t,h,c=>this.host.history(c,key),selection);
 }
 @Post("conversations/:id/replies")
 reply(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
       @Param("id")key:string,@Body()b:{body:string}){
  return this.mutate(t,h,selection,"inbox.message.reply",key,b,c=>this.host.reply(c,key,b?.body));
 }
 @Post("conversations/:id/notes")
 note(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
      @Param("id")key:string,@Body()b:{body:string}){
  return this.mutate(t,h,selection,"inbox.message.note",key,b,c=>this.host.inbox.note(c,key,b?.body));
 }
 @Post("conversations/:id/simulator/inbound")
 simulate(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
          @Param("id")key:string,@Body()b:{body:string;externalMessageId:string}){
  return this.mutate(t,h,selection,"inbox.message.simulate",key,b,c=>this.host.simulator.receive(c,{channel:"simulation",conversationId:key,body:b?.body,externalMessageId:b?.externalMessageId}));
 }
 @Get("metrics")
 metrics(@Param("tenantId")t:string,@Headers("authorization")h:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined){
  return this.run(t,h,c=>this.host.inbox.metrics(c),selection);
 }
}
