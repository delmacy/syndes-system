import type {TenantTransaction} from "@syndes/core-kernel";

export type WhatsAppRouteMutation=Readonly<{
 tenantId:string;organizationId:string;workspaceId:string;accountId:string;
 conversationId:string;recipientExternalId:string;phoneE164:string|null;
 inboundEventId:string;
}>;

/** Public command port owned by WhatsApp, called by the Inbox consumer
 * with a pinned tenant transaction. The Inbox never writes WA tables itself. */
export interface WhatsAppConversationRouteCommands{
 canonicalChat(tx:TenantTransaction,scope:Readonly<{
  tenantId:string;organizationId:string;accountId:string;
  chatExternalId:string;phoneE164:string|null;isGroup:boolean;
 }>):Promise<string>;
 attachAndAcknowledge(tx:TenantTransaction,input:WhatsAppRouteMutation):Promise<void>;
}

export class PgWhatsAppConversationRouteCommands implements WhatsAppConversationRouteCommands{
 async canonicalChat(tx:TenantTransaction,scope:Readonly<{
  tenantId:string;organizationId:string;accountId:string;
  chatExternalId:string;phoneE164:string|null;isGroup:boolean;
 }>):Promise<string>{
  if(tx.tenantId!==scope.tenantId)throw Error("Cross-tenant route command");
  if(scope.isGroup||!scope.phoneE164)return scope.chatExternalId;
  const matches=await tx.query(`
   SELECT r.recipient_external_id
   FROM whatsapp_conversation_routes r
   JOIN inbox_conversations c ON c.tenant_id=r.tenant_id AND c.id=r.conversation_id
   JOIN whatsapp_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id
   WHERE r.tenant_id=$1::uuid AND r.account_id=$2::uuid
    AND c.platform_organization_id=$3::uuid
    AND a.platform_organization_id=$3::uuid AND r.phone_e164=$4
    AND c.channel='whatsapp' AND c.is_group=false
   ORDER BY CASE WHEN r.recipient_external_id LIKE '%@lid' THEN 0 ELSE 1 END,
    c.created_at,c.id LIMIT 1
  `,[scope.tenantId,scope.accountId,scope.organizationId,scope.phoneE164]);
  const candidate=matches.rows[0]?.recipient_external_id;
  return typeof candidate==="string"&&candidate.length<=256?candidate:scope.chatExternalId;
 }
 async attachAndAcknowledge(tx:TenantTransaction,input:WhatsAppRouteMutation):Promise<void>{
  if(tx.tenantId!==input.tenantId)throw Error("Cross-tenant route command");
  const linked=await tx.query(`
   INSERT INTO whatsapp_conversation_routes
    (tenant_id,conversation_id,account_id,recipient_external_id,phone_e164)
   SELECT $1::uuid,c.id,a.id,$6,$7
   FROM inbox_conversations c
   JOIN whatsapp_accounts a ON a.tenant_id=c.tenant_id AND a.id=$4::uuid
   JOIN platform_workspaces w ON w.tenant_id=c.tenant_id
    AND w.organization_id=c.platform_organization_id AND w.id=$5::uuid AND w.status='active'
   WHERE c.tenant_id=$1::uuid AND c.id=$2::uuid
    AND c.platform_organization_id=$3::uuid AND a.platform_organization_id=$3::uuid
    AND a.service_enabled=true AND c.platform_current_workspace_id=w.id
   ON CONFLICT(tenant_id,conversation_id) DO UPDATE
    SET phone_e164=COALESCE(EXCLUDED.phone_e164,whatsapp_conversation_routes.phone_e164)
    WHERE whatsapp_conversation_routes.account_id=EXCLUDED.account_id
     AND whatsapp_conversation_routes.recipient_external_id=EXCLUDED.recipient_external_id
   RETURNING conversation_id::text
  `,[input.tenantId,input.conversationId,input.organizationId,input.accountId,input.workspaceId,
      input.recipientExternalId,input.phoneE164]);
  if(linked.rows.length!==1)throw Error("WhatsApp route ownership conflict");
  const ack=await tx.query(`
   UPDATE whatsapp_inbound_events SET processed_at=COALESCE(processed_at,clock_timestamp())
   WHERE tenant_id=$1::uuid AND account_id=$2::uuid AND id=$3::bigint
     AND event_type='whatsapp.message.received' AND projection_path='events'
   RETURNING id::text
  `,[input.tenantId,input.accountId,input.inboundEventId]);
  if(ack.rows.length!==1)throw Error("WhatsApp inbound acknowledgement missing");
 }
}
