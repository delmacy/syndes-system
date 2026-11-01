import {randomUUID} from "node:crypto";
import type {CoreKernel,ModuleDefinition} from "@syndes/core-kernel";
import type {InboxContext,InboxRepository,Inbound,ConversationStatus,Conversation,InboxMessage,InboxEvent} from "./contracts.js";
import {InboxValidationError} from "./contracts.js";
import {bounded,channel,uuid,pageSize,cursor} from "./validation.js";
export const inboxModule:ModuleDefinition=Object.freeze({
 id:"inbox",version:"0.1.0",dependencies:["crm"],
});
/** Every action checks membership and OpenFGA BEFORE resolving tenant DB. */
export class InboxService {
 constructor(private readonly kernel:CoreKernel,private readonly resolve:(tenantId:string)=>Promise<InboxRepository>){}
 private execute<T>(ctx:InboxContext,action:"read"|"write",resource:string,fn:(db:InboxRepository)=>Promise<T>):Promise<T>{
  return this.kernel.execute({actor:ctx.actor,tenantId:ctx.tenantId,action,resource},
    async()=>fn(await this.resolve(ctx.tenantId)));
 }
 receive(ctx:InboxContext,input:Inbound):Promise<{conversation:Conversation;message:InboxMessage;created:boolean}>{
  if(ctx.actor.kind!=="service")throw new InboxValidationError("Inbound ingestion requires a service identity");
  const value:Inbound={source:channel(input?.source),externalRef:bounded(input?.externalRef,"external reference",256),
   externalMessageId:bounded(input?.externalMessageId,"external message ID",256),
   body:bounded(input?.body,"message body",4096),
   personId:input?.personId?uuid(input.personId,"person ID"):null};
  return this.execute(ctx,"write","inbox:ingest",db=>db.receive(ctx.tenantId,ctx.actor.id,randomUUID(),randomUUID(),value));
 }
 list(ctx:InboxContext,limit=50):Promise<readonly Conversation[]>{
  const count=pageSize(limit,50);
  return this.execute(ctx,"read","inbox:conversations",db=>db.listConversations(ctx.tenantId,count));
 }
 get(ctx:InboxContext,id:string):Promise<Conversation|null>{
  const conversationId=uuid(id,"conversation ID");
  return this.execute(ctx,"read","inbox:conversations",db=>db.getConversation(ctx.tenantId,conversationId));
 }
 messages(ctx:InboxContext,id:string,limit=100):Promise<readonly InboxMessage[]>{
  const conversationId=uuid(id,"conversation ID"),count=pageSize(limit,100,200);
  return this.execute(ctx,"read","inbox:messages",db=>db.listMessages(ctx.tenantId,conversationId,count));
 }
 reply(ctx:InboxContext,id:string,body:unknown):Promise<InboxMessage>{
  if(ctx.actor.kind!=="user")throw new InboxValidationError("Human reply requires a user");
  const conversationId=uuid(id,"conversation ID"),value=bounded(body,"message body",4096);
  return this.execute(ctx,"write","inbox:messages",db=>db.send(ctx.tenantId,ctx.actor.id,randomUUID(),conversationId,{body:value}));
 }
 assign(ctx:InboxContext,id:string,userId:unknown):Promise<Conversation|null>{
  const conversationId=uuid(id,"conversation ID");
  if(userId!==null&&(typeof userId!=="string"||!userId.trim()||userId.length>160))throw new InboxValidationError("Invalid assignee");
  // MVP: users may claim or release only their own assignment. No unverified\n  // arbitrary Keycloak ID may be inserted as a foreign tenant operator.\n  if(ctx.actor.kind!=="user"||(userId!==null&&userId!==ctx.actor.id))\n    throw new InboxValidationError("Only self-assignment is supported");\n  return this.execute(ctx,"write","inbox:assignments",\n    db=>db.assign(ctx.tenantId,ctx.actor.id,conversationId,userId as string|null));
 }
 status(ctx:InboxContext,id:string,status:unknown):Promise<Conversation|null>{
  const conversationId=uuid(id,"conversation ID");
  if(status!=="open"&&status!=="pending"&&status!=="resolved")throw new InboxValidationError("Invalid status");
  return this.execute(ctx,"write","inbox:conversations",db=>db.setStatus(ctx.tenantId,ctx.actor.id,conversationId,status));
 }
 handoff(ctx:InboxContext,id:string,enabled:unknown):Promise<Conversation|null>{
  const conversationId=uuid(id,"conversation ID");
  if(typeof enabled!=="boolean")throw new InboxValidationError("Invalid handoff flag");
  return this.execute(ctx,"write","inbox:handoff",db=>db.handoff(ctx.tenantId,ctx.actor.id,conversationId,enabled));
 }
 events(ctx:InboxContext,afterId:unknown,limit=50):Promise<readonly InboxEvent[]>{
  const after=cursor(afterId),count=pageSize(limit,50);
  return this.execute(ctx,"read","inbox:events",db=>db.listEvents(ctx.tenantId,after,count));
 }
}
