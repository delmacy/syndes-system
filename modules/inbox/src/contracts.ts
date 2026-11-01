import type {Actor,TenantDatabase,TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
export type {TenantDatabase,TrustedTenantDatabaseProvider};
export type InboxContext=Readonly<{actor:Actor;tenantId:string}>;
export type ConversationStatus="open"|"pending"|"resolved";
export type Direction="inbound"|"outbound";
export type Conversation=Readonly<{
 id:string;tenantId:string;source:string;externalRef:string;personId:string|null;
 status:ConversationStatus;assignedTo:string|null;humanHandoff:boolean;
 createdAt:string;updatedAt:string;
}>;
export type InboxMessage=Readonly<{
 id:string;tenantId:string;conversationId:string;direction:Direction;
 authorId:string|null;externalMessageId:string|null;body:string;
 delivery:"received"|"queued"|"sent"|"failed";createdAt:string;
}>;
export type InboxEvent=Readonly<{id:number;tenantId:string;conversationId:string;event:string;actorId:string;createdAt:string}>;
export type Inbound=Readonly<{source:string;externalRef:string;externalMessageId:string;body:string;personId?:string|null}>;
export type Outbound=Readonly<{body:string}>;
export interface InboxRepository {
 receive(tenantId:string,serviceId:string,conversationId:string,messageId:string,input:Inbound):Promise<{conversation:Conversation;message:InboxMessage;created:boolean}>;
 listConversations(tenantId:string,limit:number):Promise<readonly Conversation[]>;
 getConversation(tenantId:string,id:string):Promise<Conversation|null>;
 listMessages(tenantId:string,conversationId:string,limit:number):Promise<readonly InboxMessage[]>;
 send(tenantId:string,actorId:string,id:string,conversationId:string,input:Outbound):Promise<InboxMessage>;
 assign(tenantId:string,actorId:string,conversationId:string,assignee:string|null):Promise<Conversation|null>;
 setStatus(tenantId:string,actorId:string,conversationId:string,status:ConversationStatus):Promise<Conversation|null>;
 handoff(tenantId:string,actorId:string,conversationId:string,enabled:boolean):Promise<Conversation|null>;
 listEvents(tenantId:string,afterId:number,limit:number):Promise<readonly InboxEvent[]>;
}
export class InboxValidationError extends Error{
 constructor(message:string){super(message);this.name="InboxValidationError";}
}
export class InboxTenantMismatchError extends Error{
 constructor(){super("Inbox tenant database mismatch");this.name="InboxTenantMismatchError";}
}
