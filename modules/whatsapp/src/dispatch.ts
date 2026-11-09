import {createHash,randomUUID} from "node:crypto";
import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {validIncomingEnvelope,validChatEnvelope,validContactEnvelope,validReceiptEnvelope} from "./inbound-contract.js";

const hash=(account:string,key:string)=>createHash("sha256").update(account+"|"+key).digest("hex");
// History, groups, reactions and outgoing messages must never activate bots.
export function botEligible(input:{source?:"live"|"history";fromMe?:boolean;isGroup?:boolean}):boolean {
 return input.source!=="history"&&input.fromMe!==true&&input.isGroup!==true;
}
export class WhatsAppInboxProjection {
 constructor(private readonly pools:TrustedTenantDatabaseProvider,
  private readonly onChange?:(scope:{tenantId:string;organizationId:string;workspaceId:string})=>void){}
 private notify(tenantId:string,row:Record<string,unknown>|undefined):void{
  const org=row?.platform_organization_id,ws=row?.platform_current_workspace_id;
  if(typeof org!=="string"||typeof ws!=="string"||
    !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(org)||
    !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(ws))return;
  // SSE is only an invalidation signal, not part of the durable WhatsApp
  // transaction. A disconnected reader must not cause message replay.
  try{this.onChange?.({tenantId,organizationId:org,workspaceId:ws});}
  catch{/* observed by caller's eventual polling/reconnect */}
 }
 async deliverNext(tenantId:string):Promise<"delivered"|"empty"|"invalid">{
  const db=await this.pools.resolve(tenantId);
  if(db.tenantId!==tenantId)throw new Error("Tenant database mismatch");
  const pending=await db.query(`SELECT e.id,e.payload FROM whatsapp_inbound_events e
    JOIN whatsapp_accounts a ON a.tenant_id=e.tenant_id AND a.id=e.account_id
     AND a.service_enabled=true AND a.platform_organization_id IS NOT NULL
    JOIN platform_workspaces w ON w.tenant_id=a.tenant_id
      AND w.organization_id=a.platform_organization_id AND w.is_default AND w.status='active'
    WHERE e.tenant_id=$1::uuid AND e.processed_at IS NULL AND e.failed_at IS NULL
    ORDER BY e.id LIMIT 1`,[tenantId]);
  const row=pending.rows[0] as {id?:unknown;payload?:unknown}|undefined;
  if(!row)return "empty";
  // WhatsApp may report the same direct chat as a @lid (live messages)
  // or @s.whatsapp.net (historical sync). A verified phone is the only
  // evidence allowed to reconcile those JIDs; never derive a phone from LID.
  // Selecting the existing route also preserves the working outbound JID,
  // assigned operator, CRM link and existing conversation ID.
  const canonicalChat=async(accountId:string,chatId:string,phone:string|undefined,isGroup:boolean):Promise<string>=>{
   if(isGroup||!phone)return chatId;
   const matches=await db.query(`SELECT r.recipient_external_id
     FROM whatsapp_conversation_routes r
     JOIN inbox_conversations c ON c.tenant_id=r.tenant_id AND c.id=r.conversation_id
     JOIN whatsapp_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id
     WHERE r.tenant_id=$1::uuid AND c.platform_organization_id=a.platform_organization_id AND r.account_id=$2::uuid
       AND r.phone_e164=$3 AND c.channel='whatsapp' AND c.is_group=false
     ORDER BY CASE WHEN r.recipient_external_id LIKE '%@lid' THEN 0 ELSE 1 END,
       c.created_at ASC,c.id ASC LIMIT 1`,[tenantId,accountId,phone]);
   const existing=matches.rows[0]?.recipient_external_id;
   return typeof existing==="string"&&existing.length<=256?existing:chatId;
  };
  if(validReceiptEnvelope(tenantId,row.payload)){
   const event=row.payload,receipt=event.receipt;
   // Receipt may arrive before the outbound worker polls the send result.
   // Persist independently; join against the known provider message ID later.
   // No conversation/message is created by a receipt.
   const result=await db.query(`
     WITH incoming AS (
       SELECT e.id,e.tenant_id,e.account_id,a.platform_organization_id,
        w.id AS initial_workspace_id FROM whatsapp_inbound_events e
       JOIN whatsapp_accounts a ON a.tenant_id=e.tenant_id AND a.id=e.account_id
         AND a.service_enabled=true AND a.platform_organization_id IS NOT NULL
       JOIN platform_workspaces w ON w.tenant_id=a.tenant_id
         AND w.organization_id=a.platform_organization_id AND w.is_default AND w.status='active'
       WHERE e.tenant_id=$1::uuid AND e.id=$2 AND e.processed_at IS NULL FOR UPDATE
     ), stored AS (
       INSERT INTO whatsapp_delivery_receipts
         (tenant_id,account_id,provider_message_id,chat_external_id,status)
       SELECT tenant_id,account_id,$3,$4,$5 FROM incoming
       ON CONFLICT(tenant_id,account_id,provider_message_id)
       DO UPDATE SET status=CASE WHEN whatsapp_delivery_receipts.status='read'
         OR EXCLUDED.status='read' THEN 'read' ELSE 'delivered' END,
         confirmed_at=clock_timestamp()
       RETURNING tenant_id
     ), acknowledged AS (
       UPDATE whatsapp_inbound_events e SET processed_at=clock_timestamp()
       FROM incoming WHERE e.id=incoming.id AND e.tenant_id=incoming.tenant_id
         AND EXISTS(SELECT 1 FROM stored)
       RETURNING e.id
     ) SELECT id FROM acknowledged
   `,[tenantId,row.id,receipt.providerMessageId,receipt.chatExternalId,receipt.status]);
   return result.rows.length===1?"delivered":"invalid";
  }
  if(validContactEnvelope(tenantId,row.payload)){
   const event=row.payload,contact=event.contact;
   const phone=/^([1-9][0-9]{9,14})@s\.whatsapp\.net$/.exec(contact.contactExternalId)?.[1];
   // A contact metadata event must NEVER create a conversation or message.
   // Match an existing tenant+account route by trusted JID or verified PN.
   const result=await db.query(`
    WITH incoming AS (
     SELECT e.id,e.tenant_id,e.account_id,a.platform_organization_id,
       w.id AS initial_workspace_id FROM whatsapp_inbound_events e
     JOIN whatsapp_accounts a ON a.tenant_id=e.tenant_id AND a.id=e.account_id
       AND a.service_enabled=true AND a.platform_organization_id IS NOT NULL
     JOIN platform_workspaces w ON w.tenant_id=a.tenant_id
       AND w.organization_id=a.platform_organization_id AND w.is_default AND w.status='active'
     WHERE e.tenant_id=$1::uuid AND e.id=$2 AND e.processed_at IS NULL FOR UPDATE
    ), updated AS (
     UPDATE inbox_conversations c SET subject=$5
     FROM whatsapp_conversation_routes r,incoming i
     WHERE c.tenant_id=i.tenant_id AND r.tenant_id=c.tenant_id
       AND r.conversation_id=c.id AND r.account_id=$3::uuid
       AND c.platform_organization_id=i.platform_organization_id
       AND c.channel='whatsapp' AND c.is_group=false
       AND (r.recipient_external_id=$4 OR ($6::text IS NOT NULL AND r.phone_e164=$6))
       AND (c.subject LIKE 'WhatsApp · %' OR c.subject IN
        ('Contato sem número disponível','Número não disponível'))
     RETURNING c.id
    ), acknowledged AS (
     UPDATE whatsapp_inbound_events e SET processed_at=clock_timestamp()
     FROM incoming WHERE e.id=incoming.id AND e.tenant_id=incoming.tenant_id
     RETURNING e.id
    ) SELECT id FROM acknowledged
   `,[tenantId,row.id,event.accountId,contact.contactExternalId,contact.name.trim(),
      phone?"+"+phone:null]);
   return result.rows.length===1?"delivered":"invalid";
  }
  if(validChatEnvelope(tenantId,row.payload)){
   const event=row.payload,chat=event.chat;
   const isGroup=chat.isGroup;
   const phone=!isGroup&&/^([1-9][0-9]{9,14})@s\.whatsapp\.net$/.exec(chat.chatExternalId)?.[1];
   const phoneE164=phone?"+"+phone:undefined;
   const chosenChat=await canonicalChat(event.accountId,chat.chatExternalId,phoneE164,isGroup);
   const title=(chat.name?.trim()||(isGroup?"Grupo WhatsApp":phone?"WhatsApp · +"+phone:"Contato sem número disponível")).slice(0,160);
   const result=await db.query(`
    WITH incoming AS (
     SELECT e.id,e.tenant_id,e.account_id,a.platform_organization_id,
        w.id AS initial_workspace_id FROM whatsapp_inbound_events e
     JOIN whatsapp_accounts a ON a.tenant_id=e.tenant_id AND a.id=e.account_id
       AND a.service_enabled=true AND a.platform_organization_id IS NOT NULL
     JOIN platform_workspaces w ON w.tenant_id=a.tenant_id
       AND w.organization_id=a.platform_organization_id AND w.is_default AND w.status='active'
     WHERE e.tenant_id=$1::uuid AND e.id=$2 AND e.processed_at IS NULL FOR UPDATE
    ), thread AS (
     INSERT INTO inbox_conversations
      (tenant_id,id,subject,channel,external_thread_id,is_group,unread_count,is_archived,created_at,updated_at,history_sync_at,platform_organization_id,platform_origin_workspace_id,platform_current_workspace_id)
     SELECT tenant_id,$3::uuid,$4,'whatsapp',$5,$6,$7,$8,
       COALESCE($9::timestamptz,clock_timestamp()),COALESCE($9::timestamptz,clock_timestamp()),clock_timestamp(),
       platform_organization_id,initial_workspace_id,initial_workspace_id
     FROM incoming
     ON CONFLICT(tenant_id,channel,external_thread_id) WHERE external_thread_id IS NOT NULL
     DO UPDATE SET is_group=EXCLUDED.is_group,
       unread_count=GREATEST(inbox_conversations.unread_count,EXCLUDED.unread_count),
       is_archived=CASE WHEN $9::timestamptz IS NULL THEN inbox_conversations.is_archived ELSE EXCLUDED.is_archived END,history_sync_at=clock_timestamp(),
       subject=CASE WHEN ($6::boolean=true AND BTRIM($4)<>'Grupo WhatsApp')
         OR inbox_conversations.subject LIKE 'WhatsApp · %'
         OR inbox_conversations.subject IN ('Contato sem número disponível','Grupo WhatsApp')
         THEN EXCLUDED.subject ELSE inbox_conversations.subject END
     WHERE inbox_conversations.platform_organization_id=EXCLUDED.platform_organization_id
     RETURNING tenant_id,id,platform_organization_id,platform_current_workspace_id
    ), route AS (
     INSERT INTO whatsapp_conversation_routes
       (tenant_id,conversation_id,account_id,recipient_external_id,phone_e164)
     SELECT thread.tenant_id,thread.id,incoming.account_id,$10,$11
     FROM thread JOIN incoming ON incoming.tenant_id=thread.tenant_id
       AND incoming.platform_organization_id=thread.platform_organization_id
     ON CONFLICT(tenant_id,conversation_id) DO UPDATE SET
       phone_e164=COALESCE(EXCLUDED.phone_e164,whatsapp_conversation_routes.phone_e164)
     WHERE whatsapp_conversation_routes.account_id=EXCLUDED.account_id
       AND whatsapp_conversation_routes.recipient_external_id=EXCLUDED.recipient_external_id
     RETURNING conversation_id
    ), acknowledged AS (
     UPDATE whatsapp_inbound_events e SET processed_at=clock_timestamp()
     FROM incoming WHERE e.id=incoming.id AND e.tenant_id=incoming.tenant_id
       AND EXISTS(SELECT 1 FROM route) RETURNING e.id
    ) SELECT acknowledged.id,thread.platform_organization_id,thread.platform_current_workspace_id FROM acknowledged JOIN thread ON TRUE
   `,[tenantId,row.id,randomUUID(),title,hash(event.accountId,chosenChat),isGroup,
     chat.unreadCount??0,chat.archived??false,chat.occurredAt??null,chosenChat,phoneE164??null]);
   if(result.rows.length===1)this.notify(tenantId,result.rows[0]);
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
  const chosenChat=await canonicalChat(event.accountId,chat,m.senderPhone,group);
  const thread=hash(event.accountId,chosenChat);
  const externalId=hash(event.accountId,m.externalMessageId);
  const subject=(group?m.chatName?.trim()||"Grupo WhatsApp":"WhatsApp · "+(m.senderPhone??"Número não disponível")).slice(0,160);
  const inboxBody=m.body.slice(0,5000);
  const result=await db.query(`
   WITH incoming AS (
    SELECT e.id,e.tenant_id,e.account_id,e.payload,
      a.platform_organization_id,w.id AS initial_workspace_id
    FROM whatsapp_inbound_events e
    JOIN whatsapp_accounts a ON a.tenant_id=e.tenant_id AND a.id=e.account_id
      AND a.service_enabled=true AND a.platform_organization_id IS NOT NULL
    JOIN platform_workspaces w ON w.tenant_id=a.tenant_id
      AND w.organization_id=a.platform_organization_id AND w.is_default AND w.status='active'
    WHERE e.tenant_id=$1::uuid
      AND e.id=$2 AND e.processed_at IS NULL FOR UPDATE
   ), thread AS (
    INSERT INTO inbox_conversations
      (tenant_id,id,subject,channel,external_thread_id,is_group,created_at,updated_at,platform_organization_id,platform_origin_workspace_id,platform_current_workspace_id)
    SELECT tenant_id,$3::uuid,$4,'whatsapp',$5,$10::boolean,$11::timestamptz,$11::timestamptz,
     platform_organization_id,initial_workspace_id,initial_workspace_id FROM incoming
    ON CONFLICT(tenant_id,channel,external_thread_id) WHERE external_thread_id IS NOT NULL
    DO UPDATE SET is_group=EXCLUDED.is_group
    WHERE inbox_conversations.platform_organization_id=EXCLUDED.platform_organization_id
    RETURNING tenant_id,id,platform_organization_id,platform_current_workspace_id
   ), route AS (
    INSERT INTO whatsapp_conversation_routes(tenant_id,conversation_id,account_id,recipient_external_id,phone_e164)
    SELECT thread.tenant_id,thread.id,incoming.account_id,$12,$13
    FROM thread JOIN incoming ON incoming.tenant_id=thread.tenant_id
       AND incoming.platform_organization_id=thread.platform_organization_id
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
   ) SELECT acknowledged.id,thread.platform_organization_id,thread.platform_current_workspace_id FROM acknowledged JOIN thread ON TRUE
  `,[tenantId,row.id,randomUUID(),subject,thread,randomUUID(),inboxBody,
     m.senderExternalId,externalId,group,m.occurredAt,chosenChat,m.senderPhone??null,
     outgoing?"outbound":"inbound",historical?"history":"live",eligible,m.externalMessageId,m.senderExternalId]);
  if(result.rows.length===1)this.notify(tenantId,result.rows[0]);
  return result.rows.length===1?"delivered":"invalid";
 }
}
