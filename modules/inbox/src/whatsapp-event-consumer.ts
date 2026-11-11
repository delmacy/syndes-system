import {createHash,randomUUID} from "node:crypto";
import type {TenantTransaction,TransactionalEventPublisher,StoredPlatformEvent} from "@syndes/core-kernel";

type IncomingText=Readonly<{
 accountId:string;externalMessageId:string;senderExternalId:string;senderPhone?:string;
 body:string;occurredAt:string;chatExternalId?:string;chatName?:string;
 isGroup?:boolean;fromMe?:boolean;source?:"live"|"history";
}>;
type Scope=Readonly<{tenantId:string;organizationId:string;workspaceId:string;
 accountId:string;inboundEventId:string}>;
export type InboxWhatsAppMessageReader=Readonly<{
 load:(tx:TenantTransaction,lookup:Scope)=>Promise<Scope & {message:IncomingText}>;
}>;
export type InboxWhatsAppRouteCommands=Readonly<{
 canonicalChat:(tx:TenantTransaction,scope:Readonly<{
  tenantId:string;organizationId:string;accountId:string;
  chatExternalId:string;phoneE164:string|null;isGroup:boolean;
 }>)=>Promise<string>;
 attachAndAcknowledge:(tx:TenantTransaction,input:Scope & Readonly<{
  conversationId:string;recipientExternalId:string;phoneE164:string|null;
 }>)=>Promise<void>;
}>;
const hash=(accountId:string,value:string)=>createHash("sha256")
 .update(accountId+"|"+value).digest("hex");

/** Inbox owns its conversation and message effects. WhatsApp raw source and
 * route writes are invoked through domain-owner ports in the SAME tenant tx. */
export class InboxWhatsAppReceivedConsumer{
 constructor(private readonly source:InboxWhatsAppMessageReader,
  private readonly routes:InboxWhatsAppRouteCommands,
  private readonly publisher:TransactionalEventPublisher){}

 async handle(tx:TenantTransaction,event:StoredPlatformEvent):Promise<void>{
  if(event.type!=="whatsapp.message.received.v2"||tx.tenantId!==event.tenantId)
   throw Error("Unexpected Inbox event context");
  const inboundEventId=event.payload.inboundEventId;
  const accountId=event.payload.accountId;
  if(typeof inboundEventId!=="string"||typeof accountId!=="string"||
   !event.workspaceId)throw Error("Missing scoped WhatsApp reference");
  const scope:Scope={
   tenantId:event.tenantId,organizationId:event.organizationId,workspaceId:event.workspaceId,
   accountId,inboundEventId,
  };
  const inbound=await this.source.load(tx,scope);
  if(inbound.tenantId!==scope.tenantId||
   inbound.organizationId!==scope.organizationId||
   inbound.workspaceId!==scope.workspaceId||inbound.accountId!==scope.accountId)
   throw Error("WhatsApp source scope mismatch");
  const m=inbound.message;
  const group=m.isGroup===true||(m.chatExternalId??m.senderExternalId).endsWith("@g.us");
  const chat=m.chatExternalId??m.senderExternalId;
  const chosen=await this.routes.canonicalChat(tx,{
   tenantId:scope.tenantId,organizationId:scope.organizationId,accountId:scope.accountId,
   chatExternalId:chat,phoneE164:m.senderPhone??null,isGroup:group,
  });
  const subject=(group?(m.chatName?.trim()||"Grupo WhatsApp"):
   "WhatsApp · "+(m.senderPhone??"Número não disponível")).slice(0,160);
  const threadKey=hash(accountId,chosen);
  const messageKey=hash(accountId,m.externalMessageId);
  const conversations=await tx.query(`
   INSERT INTO inbox_conversations
    (tenant_id,id,subject,channel,external_thread_id,is_group,
     platform_organization_id,platform_origin_workspace_id,platform_current_workspace_id,
     created_at,updated_at)
   VALUES ($1::uuid,$2::uuid,$3,'whatsapp',$4,$5::bool,
    $6::uuid,$7::uuid,$7::uuid,$8::timestamptz,$8::timestamptz)
   ON CONFLICT(tenant_id,channel,external_thread_id)
    WHERE external_thread_id IS NOT NULL
   DO UPDATE SET is_group=EXCLUDED.is_group
   WHERE inbox_conversations.platform_organization_id=EXCLUDED.platform_organization_id
   RETURNING id::text,platform_organization_id::text,platform_current_workspace_id::text
  `,[scope.tenantId,randomUUID(),subject,threadKey,group,
      scope.organizationId,scope.workspaceId,m.occurredAt]);
  if(conversations.rows.length!==1)throw Error("Inbox conversation unavailable");
  const conversation=conversations.rows[0]!;
  if(conversation.platform_organization_id!==scope.organizationId||
   conversation.platform_current_workspace_id!==scope.workspaceId)
   throw Error("Inbox conversation crosses authorized organization/workspace");
  const conversationId=String(conversation.id);
  const sentByUs=m.fromMe===true,historical=m.source==="history";
  const inserted=await tx.query(`
   INSERT INTO inbox_messages
    (tenant_id,id,conversation_id,direction,body,author_id,external_message_id,
     source,bot_eligible,provider_message_id,provider_sender_id,created_at)
   VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9::bool,$10,$11,$12::timestamptz)
   ON CONFLICT(tenant_id,conversation_id,external_message_id)
    WHERE external_message_id IS NOT NULL DO NOTHING
   RETURNING id::text
  `,[scope.tenantId,randomUUID(),conversationId,sentByUs?"outbound":"inbound",
      m.body.slice(0,5000),m.senderExternalId,messageKey,historical?"history":"live",
      !group&&!sentByUs&&!historical,m.externalMessageId,m.senderExternalId,m.occurredAt]);
  if(inserted.rows.length===1){
   await tx.query(`
    UPDATE inbox_conversations SET
     updated_at=GREATEST(updated_at,$4::timestamptz),
     unread_count=unread_count+CASE WHEN $5::bool THEN 1 ELSE 0 END,
     status=CASE WHEN $5::bool AND status='resolved' THEN 'open' ELSE status END
    WHERE tenant_id=$1::uuid AND id=$2::uuid AND platform_organization_id=$3::uuid
      AND platform_current_workspace_id=$6::uuid
   `,[scope.tenantId,conversationId,scope.organizationId,m.occurredAt,
       !group&&!historical&&!sentByUs,scope.workspaceId]);
  }
  await this.routes.attachAndAcknowledge(tx,{
   ...scope,conversationId,recipientExternalId:chosen,phoneE164:m.senderPhone??null,
  });
  if(!group&&!sentByUs){
   await this.publisher.publish(tx,{
    tenantId:scope.tenantId,organizationId:scope.organizationId,workspaceId:scope.workspaceId,
    type:"inbox.participant.observed.v1",producer:"inbox",
    aggregateType:"conversation",aggregateId:conversationId,
    idempotencyKey:"participant:"+conversationId+":"+inboundEventId,
    correlationId:event.correlationId,causationId:event.eventId,
    payload:{conversationId},
   });
  }
 }
}
