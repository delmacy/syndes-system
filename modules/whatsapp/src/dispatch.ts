import {createHash,randomUUID} from "node:crypto";
import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {validIncomingEnvelope,validChatEnvelope} from "./inbound-contract.js";

const hash=(account:string,key:string)=>createHash("sha256").update(account+"|"+key).digest("hex");
// History, groups, reactions and outgoing messages must never activate bots.
export function botEligible(input:{source?:"live"|"history";fromMe?:boolean;isGroup?:boolean}):boolean {
 return input.source!=="history"&&input.fromMe!==true&&input.isGroup!==true;
}
export class WhatsAppInboxProjection {
 constructor(private readonly pools:TrustedTenantDatabaseProvider){}
 async deliverNext(tenantId:string):Promise<"delivered"|"empty"|"invalid">{
  const db=await this.pools.resolve(tenantId);
  if(db.tenantId!==tenantId)throw new Error("Tenant database mismatch");
  const pending=await db.query(`SELECT id,payload FROM whatsapp_inbound_events
    WHERE tenant_id=$1::uuid AND processed_at IS NULL AND failed_at IS NULL ORDER BY id LIMIT 1`,[tenantId]);
  const row=pending.rows[0] as {id?:unknown;payload?:unknown}|undefined;
  if(!row)return "empty";
  if(validChatEnvelope(tenantId,row.payload)){
   const event=row.payload,chat=event.chat;
   const isGroup=chat.isGroup;
   const phone=!isGroup&&/^([1-9][0-9]{9,14})@s\.whatsapp\.net$/.exec(chat.chatExternalId)?.[1];
   const title=(chat.name?.trim()||(isGroup?"Grupo WhatsApp":phone?"WhatsApp · +"+phone:"Contato sem número disponível")).slice(0,160);
   const result=await db.query(`
    WITH incoming AS (
     SELECT e.id,e.tenant_id,e.account_id FROM whatsapp_inbound_events e
     WHERE e.tenant_id=$1::uuid AND e.id=$2 AND e.processed_at IS NULL FOR UPDATE
    ), thread AS (
     INSERT INTO inbox_conversations
      (tenant_id,id,subject,channel,external_thread_id,is_group,unread_count,is_archived,created_at,updated_at,history_sync_at)
     SELECT tenant_id,$3::uuid,$4,'whatsapp',$5,$6,$7,$8,
       COALESCE($9::timestamptz,clock_timestamp()),COALESCE($9::timestamptz,clock_timestamp()),clock_timestamp()
     FROM incoming
     ON CONFLICT(tenant_id,channel,external_thread_id) WHERE external_thread_id IS NOT NULL
     DO UPDATE SET is_group=EXCLUDED.is_group,
       unread_count=GREATEST(inbox_conversations.unread_count,EXCLUDED.unread_count),
       is_archived=EXCLUDED.is_archived,history_sync_at=clock_timestamp(),
       subject=CASE WHEN inbox_conversations.subject LIKE 'WhatsApp · %'
         OR inbox_conversations.subject IN ('Contato sem número disponível','Grupo WhatsApp')
         THEN EXCLUDED.subject ELSE inbox_conversations.subject END
     RETURNING tenant_id,id
    ), route AS (
     INSERT INTO whatsapp_conversation_routes
       (tenant_id,conversation_id,account_id,recipient_external_id,phone_e164)
     SELECT thread.tenant_id,thread.id,incoming.account_id,$10,$11
     FROM thread JOIN incoming ON incoming.tenant_id=thread.tenant_id
     ON CONFLICT(tenant_id,conversation_id) DO UPDATE SET
       phone_e164=COALESCE(EXCLUDED.phone_e164,whatsapp_conversation_routes.phone_e164)
     WHERE whatsapp_conversation_routes.account_id=EXCLUDED.account_id
       AND whatsapp_conversation_routes.recipient_external_id=EXCLUDED.recipient_external_id
     RETURNING conversation_id
    ), acknowledged AS (
     UPDATE whatsapp_inbound_events e SET processed_at=clock_timestamp()
     FROM incoming WHERE e.id=incoming.id AND e.tenant_id=incoming.tenant_id
       AND EXISTS(SELECT 1 FROM route) RETURNING e.id
    ) SELECT id FROM acknowledged
   `,[tenantId,row.id,randomUUID(),title,hash(event.accountId,chat.chatExternalId),isGroup,
     chat.unreadCount??0,chat.archived??false,chat.occurredAt??null,chat.chatExternalId,phone?"+"+phone:null]);
   return result.rows.length===1?"delivered":"invalid";
  }
  if(!validIncomingEnvelope(tenantId,row.payload)){
   await db.query("UPDATE whatsapp_inbound_events SET failed_at=clock_timestamp(),last_error=$3 WHERE tenant_id=$1::uuid AND id=$2 AND processed_at IS NULL AND failed_at IS NULL",
     [tenantId,row.id,"invalid envelope"]);
   return "invalid";
  }
  const event=row.payload,m=event.message;
  const chat=m.chatExternalId??m.senderExternalId;
  const group=m.isGroup===true;
  const historical=m.source==="history";
  const outgoing=m.fromMe===true;
  const eligible=botEligible(m);
  const thread=hash(event.accountId,chat);
  const externalId=hash(event.accountId,m.externalMessageId);
  const subject=(group?m.chatName?.trim()||"Grupo WhatsApp":"WhatsApp · "+(m.senderPhone??"Número não disponível")).slice(0,160);
  const inboxBody=m.body.slice(0,5000);
  const result=await db.query(`
   WITH incoming AS (
    SELECT e.id,e.tenant_id,e.account_id,e.payload
    FROM whatsapp_inbound_events e WHERE e.tenant_id=$1::uuid
      AND e.id=$2 AND e.processed_at IS NULL FOR UPDATE
   ), thread AS (
    INSERT INTO inbox_conversations
      (tenant_id,id,subject,channel,external_thread_id,is_group,created_at,updated_at)
    SELECT tenant_id,$3::uuid,$4,'whatsapp',$5,$10::boolean,$11::timestamptz,$11::timestamptz FROM incoming
    ON CONFLICT(tenant_id,channel,external_thread_id) WHERE external_thread_id IS NOT NULL
    DO UPDATE SET is_group=EXCLUDED.is_group
    RETURNING tenant_id,id
   ), route AS (
    INSERT INTO whatsapp_conversation_routes(tenant_id,conversation_id,account_id,recipient_external_id,phone_e164)
    SELECT thread.tenant_id,thread.id,incoming.account_id,$12,$13
    FROM thread JOIN incoming ON incoming.tenant_id=thread.tenant_id
    ON CONFLICT(tenant_id,conversation_id) DO UPDATE
      SET phone_e164=COALESCE(EXCLUDED.phone_e164,whatsapp_conversation_routes.phone_e164)
      WHERE whatsapp_conversation_routes.account_id=EXCLUDED.account_id
        AND whatsapp_conversation_routes.recipient_external_id=EXCLUDED.recipient_external_id
    RETURNING tenant_id,conversation_id
   ), inserted AS (
    INSERT INTO inbox_messages
      (tenant_id,id,conversation_id,direction,body,author_id,external_message_id,
       source,bot_eligible,provider_message_id,provider_sender_id,created_at)
    SELECT route.tenant_id,$6::uuid,route.conversation_id,$14,$7,$8,$9,
     $15,$16,$17,$18,$11::timestamptz FROM route
    ON CONFLICT(tenant_id,conversation_id,external_message_id)
      WHERE external_message_id IS NOT NULL DO NOTHING
    RETURNING tenant_id,conversation_id
   ), changed AS (
    UPDATE inbox_conversations c SET
      updated_at=GREATEST(c.updated_at,$11::timestamptz),
      unread_count=c.unread_count+CASE WHEN $15='live' AND $14='inbound' THEN 1 ELSE 0 END,
      status=CASE WHEN $15='live' AND $14='inbound' AND c.status='resolved'
        THEN 'open' ELSE c.status END
    FROM inserted i WHERE c.tenant_id=i.tenant_id AND c.id=i.conversation_id
    RETURNING c.id
   ), acknowledged AS (
    UPDATE whatsapp_inbound_events e SET processed_at=clock_timestamp()
    FROM incoming WHERE e.id=incoming.id AND e.tenant_id=incoming.tenant_id
      AND EXISTS(SELECT 1 FROM route)
      AND (EXISTS(SELECT 1 FROM inserted) OR EXISTS(
        SELECT 1 FROM inbox_messages prior JOIN thread t ON t.tenant_id=prior.tenant_id
          AND t.id=prior.conversation_id
        WHERE prior.external_message_id=$9 AND prior.body=$7 AND prior.direction=$14
      ))
    RETURNING e.id
   ) SELECT id FROM acknowledged
  `,[tenantId,row.id,randomUUID(),subject,thread,randomUUID(),inboxBody,
     m.senderExternalId,externalId,group,m.occurredAt,chat,m.senderPhone??null,
     outgoing?"outbound":"inbound",historical?"history":"live",eligible,m.externalMessageId,m.senderExternalId]);
  return result.rows.length===1?"delivered":"invalid";
 }
}
