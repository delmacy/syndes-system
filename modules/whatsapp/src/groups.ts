import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {WhatsAppGatewayClient,type WhatsAppGroupInfo} from "./gateway-client.js";
import {whatsappScopedQuery,type WhatsAppScope} from "./scope.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const groupJID=/^[0-9]+@g\.us$/;
export class WhatsAppGroupService {
 constructor(private readonly pools:TrustedTenantDatabaseProvider,
  private readonly gateway:Pick<WhatsAppGatewayClient,"groupInfo"|"updateGroup">=new WhatsAppGatewayClient()){}
 private async route(tenantId:string,conversationId:string,scope?:WhatsAppScope){
  if(!UUID.test(tenantId)||!UUID.test(conversationId))throw Error("Invalid group context");
  const db=await this.pools.resolve(tenantId);
  if(db.tenantId!==tenantId)throw Error("Tenant database mismatch");
  const result=await whatsappScopedQuery(db,scope,`SELECT r.account_id::text,r.recipient_external_id
    FROM whatsapp_conversation_routes r
    JOIN inbox_conversations c ON c.tenant_id=r.tenant_id AND c.id=r.conversation_id
    JOIN whatsapp_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id
    WHERE r.tenant_id=$1::uuid AND r.conversation_id=$2::uuid
      AND c.channel='whatsapp' AND c.is_group=true AND a.service_enabled=true
      /*WSCOPE:AND c.platform_organization_id=@@ORG@@ AND c.platform_current_workspace_id=@@WS@@ AND a.platform_organization_id=@@ORG@@*/`,[tenantId,conversationId]);
  const row=result.rows[0];
  if(!row||typeof row.account_id!=="string"||typeof row.recipient_external_id!=="string"||
    !UUID.test(row.account_id)||!groupJID.test(row.recipient_external_id))throw Error("WhatsApp group unavailable");
  return {db,accountId:row.account_id,jid:row.recipient_external_id};
 }
 async avatar(tenantId:string,conversationId:string,scope?:WhatsAppScope):Promise<{available:boolean;imageData?:string}>{
  const route=await this.route(tenantId,conversationId,scope);
  return new WhatsAppGatewayClient().avatar(tenantId,route.accountId,route.jid);
 }
 async info(tenantId:string,conversationId:string,scope?:WhatsAppScope):Promise<WhatsAppGroupInfo>{
  const route=await this.route(tenantId,conversationId,scope);
  return this.gateway.groupInfo(tenantId,route.accountId,route.jid);
 }
 async update(tenantId:string,conversationId:string,change:unknown,scope?:WhatsAppScope):Promise<WhatsAppGroupInfo>{
  const body=change as {name?:unknown;description?:unknown}|null;
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(key=>!["name","description"].includes(key))||
    (body.name===undefined)===(body.description===undefined))throw Error("Invalid group change");
  if(body.name!==undefined&&(typeof body.name!=="string"||!body.name.trim()||[...body.name].length>100))throw Error("Invalid group change");
  if(body.description!==undefined&&(typeof body.description!=="string"||[...body.description].length>2048))throw Error("Invalid group change");
  const route=await this.route(tenantId,conversationId,scope);
  const requested=body.name!==undefined?{name:String(body.name).trim()}:{description:String(body.description)};
  const confirmed=await this.gateway.updateGroup(tenantId,route.accountId,route.jid,requested);
  if(confirmed.jid!==route.jid)throw Error("WhatsApp group confirmation mismatch");
  // No optimistic write. Only the name re-read from WhatsApp may replace local title.
  if(typeof confirmed.name==="string"&&confirmed.name.trim()){
   await whatsappScopedQuery(route.db,scope,`UPDATE inbox_conversations c SET subject=$3
     FROM whatsapp_conversation_routes r
     WHERE r.tenant_id=c.tenant_id AND r.conversation_id=c.id
       AND c.tenant_id=$1::uuid AND c.id=$2::uuid AND c.is_group=true
       AND r.account_id=$4::uuid AND r.recipient_external_id=$5
      /*WSCOPE:AND c.platform_organization_id=@@ORG@@ AND c.platform_current_workspace_id=@@WS@@*/`,
    [tenantId,conversationId,confirmed.name.trim(),route.accountId,route.jid]);
  }
  return confirmed;
 }
}
