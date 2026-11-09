import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {WhatsAppGatewayClient} from "./gateway-client.js";
import {whatsappScopedQuery,type WhatsAppScope} from "./scope.js";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const jid=/^[0-9._:-]+@(s\.whatsapp\.net|lid|g\.us)$/;
export class WhatsAppAvatars{
 constructor(private readonly pools:TrustedTenantDatabaseProvider,
 private readonly gateway:Pick<WhatsAppGatewayClient,"avatar">=new WhatsAppGatewayClient()){}
 async get(tenantId:string,conversationId:string,scope?:WhatsAppScope){
  if(!uuid.test(tenantId)||!uuid.test(conversationId))throw Error("Invalid avatar context");
  const db=await this.pools.resolve(tenantId);
  if(db.tenantId!==tenantId)throw Error("Tenant database mismatch");
  const result=await whatsappScopedQuery(db,scope,`SELECT r.account_id::text AS account_id,r.recipient_external_id,
     r.phone_e164,c.is_group
    FROM whatsapp_conversation_routes r
    JOIN inbox_conversations c ON c.tenant_id=r.tenant_id AND c.id=r.conversation_id
    JOIN whatsapp_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id
    WHERE r.tenant_id=$1::uuid AND r.conversation_id=$2::uuid
      AND c.channel='whatsapp' AND a.service_enabled=true
      /*WSCOPE:AND c.platform_organization_id=@@ORG@@ AND c.platform_current_workspace_id=@@WS@@ AND a.platform_organization_id=@@ORG@@*/`,[tenantId,conversationId]);
  const row=result.rows[0];
  if(!row||typeof row.account_id!=="string"||!uuid.test(row.account_id))throw Error("WhatsApp avatar conversation unavailable");
  // The route is authoritative. PN takes priority over a device-local LID for a profile picture.
  const contact=typeof row.phone_e164==="string"&&/^\+[1-9][0-9]{9,14}$/.test(row.phone_e164)&&row.is_group!==true
   ?row.phone_e164.slice(1)+"@s.whatsapp.net":String(row.recipient_external_id??"");
  if(!jid.test(contact)||contact.endsWith("@g.us")!==Boolean(row.is_group))throw Error("Invalid avatar recipient");
  return this.gateway.avatar(tenantId,row.account_id,contact);
 }
}
