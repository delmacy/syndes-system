import type {TenantTransaction} from "@syndes/core-kernel";

/** WhatsApp owns the routing details. CRM consumes only this trusted, scoped
 * read contract rather than writing or querying WhatsApp routing tables. */
export type WhatsAppConversationIdentity=Readonly<{
 tenantId:string;organizationId:string;workspaceId:string;conversationId:string;
 providerJid:string;phoneE164:string|null;linkedPersonId:string|null;
}>;
export interface WhatsAppConversationIdentityReader{
 loadIdentity(tx:TenantTransaction,lookup:Readonly<{
  tenantId:string;organizationId:string;workspaceId:string;conversationId:string;
 }>):Promise<WhatsAppConversationIdentity>;
}
export class PgWhatsAppConversationIdentityReader implements WhatsAppConversationIdentityReader{
 async loadIdentity(tx:TenantTransaction,lookup:Readonly<{
  tenantId:string;organizationId:string;workspaceId:string;conversationId:string;
 }>):Promise<WhatsAppConversationIdentity>{
  if(tx.tenantId!==lookup.tenantId)throw Error("Cross-tenant conversation identity read");
  const result=await tx.query(`
   SELECT r.recipient_external_id,r.phone_e164,c.crm_person_id::text
   FROM whatsapp_conversation_routes r
   JOIN inbox_conversations c ON c.tenant_id=r.tenant_id AND c.id=r.conversation_id
   JOIN whatsapp_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id
    AND a.service_enabled=true AND a.platform_organization_id=$3::uuid
   JOIN platform_organizations o ON o.tenant_id=c.tenant_id
    AND o.id=c.platform_organization_id AND o.status='active'
   JOIN platform_workspaces w ON w.tenant_id=c.tenant_id
    AND w.organization_id=o.id AND w.id=$4::uuid AND w.status='active'
   WHERE c.tenant_id=$1::uuid AND c.id=$2::uuid AND c.channel='whatsapp'
    AND c.is_group=false AND c.platform_organization_id=$3::uuid
    AND c.platform_current_workspace_id=w.id
   FOR SHARE OF r,c,a,o,w
  `,[lookup.tenantId,lookup.conversationId,lookup.organizationId,lookup.workspaceId]);
  const r=result.rows[0];
  if(result.rows.length!==1||typeof r.recipient_external_id!=="string")
   throw Error("Conversation identity route missing or unauthorized");
  const phone=typeof r.phone_e164==="string"&&/^\+[1-9][0-9]{9,14}$/.test(r.phone_e164)?
   r.phone_e164:null;
  return {...lookup,providerJid:r.recipient_external_id,phoneE164:phone,
   linkedPersonId:typeof r.crm_person_id==="string"?r.crm_person_id:null};
 }
}
