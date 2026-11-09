import {randomUUID} from "node:crypto";
import type {CoreKernel,ModuleDefinition} from "@syndes/core-kernel";
import type {InboxContext,InboxRepository,Conversation,ConversationStatus,ConversationQueue,CreateConversation,HandoffMode,Message,InboxMetrics} from "./contracts.js";
import {InboxValidationError} from "./contracts.js";
import {id,text,optionalExternal,limit,assignee} from "./validation.js";

export const inboxModule:ModuleDefinition=Object.freeze({
 id:"inbox",version:"0.1.0",dependencies:["platform","crm"]
});
/** All repository resolution is inside the authorized kernel handler. */
export class InboxService {
 constructor(private readonly kernel:CoreKernel,
             private readonly storeForTenant:(tenantId:string)=>Promise<InboxRepository>){}
 private execute<T>(ctx:InboxContext,action:string,resource:string,handler:(store:InboxRepository)=>Promise<T>):Promise<T>{
   return this.kernel.execute({actor:ctx.actor,tenantId:ctx.tenantId,action,resource},
     async()=>handler(await this.storeForTenant(ctx.tenantId)));
 }
 /** Authorization for a live change-only stream; NO database lease or tenant-supplied actor. */
 watch(ctx:InboxContext):Promise<void>{
   return this.kernel.execute({actor:ctx.actor,tenantId:ctx.tenantId,action:"read",resource:"inbox:conversations"},async()=>{});
 }
 create(ctx:InboxContext,input:CreateConversation):Promise<Conversation>{
   const record={
     id:randomUUID(),subject:text(input?.subject,"subject",160),
     crmPersonId:input?.crmPersonId==null?null:id(input.crmPersonId,"CRM person"),
     externalThreadId:optionalExternal(input?.externalThreadId)
   };
   return this.execute(ctx,"write","inbox:conversations",repo=>repo.create(ctx.tenantId,ctx.actor.id,record));
 }
 list(ctx:InboxContext,status:ConversationStatus|null=null,pageSize=30,queue:ConversationQueue="all"):Promise<readonly Conversation[]>{
   if(status!==null&&!["open","pending","resolved"].includes(status))
     throw new InboxValidationError("Invalid status");
   if(!["all","mine","unassigned"].includes(queue))throw new InboxValidationError("Invalid queue");
   const size=limit(pageSize);
   // "mine" derives assignee exclusively from the verified actor, never a user-supplied ID.
   return this.execute(ctx,"read","inbox:conversations",repo=>repo.list(ctx.tenantId,status,size,queue,ctx.actor.id));
 }
 get(ctx:InboxContext,conversationId:string):Promise<Conversation|null>{
   const key=id(conversationId);
   return this.execute(ctx,"read","inbox:conversations",repo=>repo.get(ctx.tenantId,key));
 }
 messages(ctx:InboxContext,conversationId:string,pageSize=100):Promise<readonly Message[]|null>{
   const key=id(conversationId),size=limit(pageSize);
   return this.execute(ctx,"read","inbox:messages",repo=>repo.messages(ctx.tenantId,key,size));
 }
 assign(ctx:InboxContext,conversationId:string,value:unknown):Promise<Conversation|null>{
   const key=id(conversationId),to=assignee(value);
   return this.execute(ctx,"write","inbox:assignment",
     repo=>repo.assign(ctx.tenantId,key,ctx.actor.id,to));
 }
 status(ctx:InboxContext,conversationId:string,value:ConversationStatus):Promise<Conversation|null>{
   const key=id(conversationId);
   if(!["open","pending","resolved"].includes(value))throw new InboxValidationError("Invalid status");
   return this.execute(ctx,"write","inbox:conversations",
     repo=>repo.status(ctx.tenantId,key,ctx.actor.id,value));
 }
 handoff(ctx:InboxContext,conversationId:string,value:HandoffMode):Promise<Conversation|null>{
   const key=id(conversationId);
   if(value!=="human"&&value!=="bot")throw new InboxValidationError("Invalid handoff");
   return this.execute(ctx,"write","inbox:conversations",
     repo=>repo.handoff(ctx.tenantId,key,ctx.actor.id,value));
 }
 reply(ctx:InboxContext,conversationId:string,value:unknown):Promise<Message|null>{
   const key=id(conversationId),body=text(value,"message",5000);
   return this.execute(ctx,"write","inbox:messages",
     repo=>repo.append(ctx.tenantId,key,ctx.actor.id,
       {id:randomUUID(),direction:"outbound",body,externalMessageId:null}));
 }
 note(ctx:InboxContext,conversationId:string,value:unknown):Promise<Message|null>{
   const key=id(conversationId),body=text(value,"note",5000);
   return this.execute(ctx,"write","inbox:notes",
     repo=>repo.append(ctx.tenantId,key,ctx.actor.id,
       {id:randomUUID(),direction:"internal",body,externalMessageId:null}));
 }
 /** Explicitly authenticated simulation; never exposed as anonymous provider webhook. */
 simulate(ctx:InboxContext,conversationId:string,bodyValue:unknown,externalId:unknown):Promise<Message|null>{
   const key=id(conversationId),body=text(bodyValue,"message",5000),ref=optionalExternal(externalId);
   if(!ref)throw new InboxValidationError("Simulation message ID is required for retries");
   return this.execute(ctx,"write","inbox:simulation",
     repo=>repo.append(ctx.tenantId,key,ctx.actor.id,
       {id:randomUUID(),direction:"inbound",body,externalMessageId:ref}));
 }
 metrics(ctx:InboxContext):Promise<InboxMetrics>{
   return this.execute(ctx,"read","inbox:metrics",repo=>repo.metrics(ctx.tenantId));
 }
}
