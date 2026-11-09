import type {Actor,TenantDatabase,TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
export type {TenantDatabase,TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
export type InboxContext=Readonly<{actor:Actor;tenantId:string}>;
export type ConversationStatus="open"|"pending"|"resolved";
export type HandoffMode="human"|"bot";
export type Conversation=Readonly<{
  id:string;tenantId:string;crmPersonId:string|null;subject:string;
  channel:string;externalThreadId:string|null;status:ConversationStatus;
  assignedTo:string|null;handoff:HandoffMode;createdAt:string;updatedAt:string;
}>;
export type Message=Readonly<{
  id:string;tenantId:string;conversationId:string;direction:"inbound"|"outbound"|"internal";
  body:string;authorId:string;externalMessageId:string|null;createdAt:string;
}>;
export type CreateConversation=Readonly<{
  subject:string;crmPersonId?:string|null;externalThreadId?:string|null;
}>;
export type InboxMetrics=Readonly<{open:number;pending:number;resolved:number;unassigned:number}>;
export interface InboxRepository {
 create(tenantId:string,actorId:string,record:Readonly<{id:string;subject:string;crmPersonId:string|null;externalThreadId:string|null}>):Promise<Conversation>;
 list(tenantId:string,status:ConversationStatus|null,limit:number):Promise<readonly Conversation[]>;
 get(tenantId:string,id:string):Promise<Conversation|null>;
 messages(tenantId:string,id:string,limit:number):Promise<readonly Message[]|null>;
 assign(tenantId:string,id:string,actorId:string,assignee:string|null):Promise<Conversation|null>;
 status(tenantId:string,id:string,actorId:string,status:ConversationStatus):Promise<Conversation|null>;
 handoff(tenantId:string,id:string,actorId:string,mode:HandoffMode):Promise<Conversation|null>;
 append(tenantId:string,id:string,actorId:string,message:Readonly<{
    id:string;direction:Message["direction"];body:string;externalMessageId:string|null;
 }>):Promise<Message|null>;
 metrics(tenantId:string):Promise<InboxMetrics>;
}
export class InboxValidationError extends Error {
 constructor(message:string){super(message);this.name="InboxValidationError"}
}
export class InboxTenantMismatchError extends Error {
 constructor(){super("Trusted tenant database mismatch");this.name="InboxTenantMismatchError"}
}
