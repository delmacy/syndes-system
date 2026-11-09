import {randomUUID} from "node:crypto";
import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {WhatsAppGatewayClient} from "./gateway-client.js";
import {whatsappScopedQuery,type WhatsAppScope} from "./scope.js";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nameOk=(value:unknown):value is string=>typeof value==="string"&&
 value.trim().length>0&&[...value.trim()].length<=160&&!/[\x00-\x1f\x7f]/.test(value);
export type ContactNameResult={submitted:true;confirmedOnPhone:false;fullName:string;phoneNumber:string};
export class WhatsAppContactNames {
 constructor(private readonly pools:TrustedTenantDatabaseProvider,
  private readonly gateway:Pick<WhatsAppGatewayClient,"setContactName">=new WhatsAppGatewayClient()){}
 async rename(tenantId:string,actorId:string,conversationId:string,fullName:unknown,
  saveOnPrimaryAddressbook:unknown,scope?:WhatsAppScope):Promise<ContactNameResult>{
  if(!uuid.test(tenantId)||!uuid.test(conversationId)||!actorId)throw Error("Invalid contact context");
  if(!nameOk(fullName)||typeof saveOnPrimaryAddressbook!=="boolean")throw Error("Invalid contact name");
  const name=fullName.trim();
  const db=await this.pools.resolve(tenantId);
  if(db.tenantId!==tenantId)throw Error("Tenant database mismatch");
  const eligible=await whatsappScopedQuery(db,scope,`SELECT r.account_id::text AS account_id,
    r.phone_e164, p.name AS crm_name
   FROM whatsapp_conversation_routes r
   JOIN inbox_conversations c ON c.tenant_id=r.tenant_id AND c.id=r.conversation_id
   JOIN whatsapp_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id
   LEFT JOIN crm_people p ON p.tenant_id=c.tenant_id AND p.id=c.crm_person_id AND p.archived_at IS NULL
    AND (c.platform_organization_id IS NULL OR p.platform_organization_id=c.platform_organization_id)
   WHERE r.tenant_id=$1::uuid AND r.conversation_id=$2::uuid
    AND c.channel='whatsapp' AND c.is_group=false AND a.service_enabled=true
    AND r.phone_e164 ~ '^\\+[1-9][0-9]{9,14}$'
    /*WSCOPE:AND c.platform_organization_id=@@ORG@@ AND c.platform_current_workspace_id=@@WS@@ AND a.platform_organization_id=@@ORG@@*/`,[tenantId,conversationId]);
  const row=eligible.rows[0];
  if(!row)throw Error("WhatsApp contact not eligible");
  if(typeof row.crm_name==="string"&&row.crm_name.trim()!==name)
   throw Error("Use the CRM contact name first");
  const accountId=String(row.account_id),phone=String(row.phone_e164);
  if(!uuid.test(accountId))throw Error("Invalid account");
  const requestId=randomUUID();
  const inserted=await whatsappScopedQuery(db,scope,`INSERT INTO whatsapp_contact_name_changes
    (id,tenant_id,conversation_id,account_id,phone_e164,requested_name,actor_id,save_on_primary,status)
    SELECT $3::uuid,r.tenant_id,r.conversation_id,r.account_id,r.phone_e164,$4,$5,$6,'pending'
    FROM whatsapp_conversation_routes r JOIN whatsapp_accounts a
     ON a.tenant_id=r.tenant_id AND a.id=r.account_id
    JOIN inbox_conversations c ON c.tenant_id=r.tenant_id AND c.id=r.conversation_id
    WHERE r.tenant_id=$1::uuid AND r.conversation_id=$2::uuid AND c.is_group=false
     AND a.service_enabled=true AND r.account_id=$7::uuid AND r.phone_e164=$8
     /*WSCOPE:AND c.platform_organization_id=@@ORG@@ AND c.platform_current_workspace_id=@@WS@@ AND a.platform_organization_id=@@ORG@@*/
    RETURNING id`,[tenantId,conversationId,requestId,name,actorId,saveOnPrimaryAddressbook,accountId,phone]);
  if(inserted.rows.length!==1)throw Error("WhatsApp contact route changed");
  try {
   await this.gateway.setContactName(tenantId,accountId,{
    contactJid:phone.slice(1)+"@s.whatsapp.net",fullName:name,saveOnPrimaryAddressbook
   });
  }catch(error){
   await db.query(`UPDATE whatsapp_contact_name_changes
    SET status='failed',updated_at=clock_timestamp()
    WHERE tenant_id=$1::uuid AND id=$2::uuid AND status='pending'`,[tenantId,requestId]);
   throw Error("WhatsApp name update was not accepted");
  }
  // Server acknowledgement is not primary phone confirmation. Keep those
  // concepts distinct in both the audit log and the UI.
  await db.query(`WITH sent AS (
    UPDATE whatsapp_contact_name_changes SET status='submitted',updated_at=clock_timestamp()
    WHERE tenant_id=$1::uuid AND id=$2::uuid AND status='pending'
    RETURNING tenant_id,account_id,phone_e164,requested_name,id
   ) INSERT INTO whatsapp_contact_name_labels
    (tenant_id,account_id,phone_e164,full_name,last_change_id)
   SELECT tenant_id,account_id,phone_e164,requested_name,id FROM sent
   ON CONFLICT(tenant_id,account_id,phone_e164)
    DO UPDATE SET full_name=EXCLUDED.full_name,last_change_id=EXCLUDED.last_change_id,
     updated_at=clock_timestamp()`,[tenantId,requestId]);
  return {submitted:true,confirmedOnPhone:false,fullName:name,phoneNumber:phone};
 }
}
