import {createHash} from "node:crypto";
import type {TenantTransaction,TrustedTenantTransactionProvider,TransactionalEventPublisher} from "@syndes/core-kernel";
import {validIncomingEnvelope,type IncomingWhatsAppEnvelope} from "./inbound-contract.js";

/** Marker derived solely from tenant-owned IDs; retries preserve correlation identity. */
function correlationUuid(tenantId:string,accountId:string,inboundId:string):string{
 const h=createHash("sha256").update([tenantId,accountId,inboundId].join("|")).digest("hex");
 return h.slice(0,8)+"-"+h.slice(8,12)+"-5"+h.slice(13,16)+"-a"+h.slice(17,20)+"-"+h.slice(20,32);
}

/** New, opt-in ingestion path. The legacy HTTP store is unchanged unless
 * a trusted Host composes this adapter after schema/worker rollout gates. */
export class WhatsAppTransactionalInboundBridge{
 constructor(private readonly databases:TrustedTenantTransactionProvider,
  private readonly events:TransactionalEventPublisher){}

 async persist(tenantId:string,input:IncomingWhatsAppEnvelope):Promise<{accepted:true;duplicate:boolean}>{
  if(!validIncomingEnvelope(tenantId,input))
   throw new Error("Invalid WhatsApp inbound event contract");
  return this.databases.withTransaction(tenantId,async tx=>{
   // Lock the canonical account, owner and default workspace through COMMIT.
   // This is an account setting, never a tenant-scoped fallback for multi-org.
   const scope=await tx.query(`
    SELECT a.platform_organization_id::text AS organization_id,w.id::text AS workspace_id
    FROM whatsapp_accounts a
    JOIN platform_organizations o ON o.tenant_id=a.tenant_id
     AND o.id=a.platform_organization_id AND o.status='active'
    JOIN platform_workspaces w ON w.tenant_id=a.tenant_id
     AND w.organization_id=a.platform_organization_id
     AND w.is_default=true AND w.status='active'
    WHERE a.tenant_id=$1::uuid AND a.id=$2::uuid AND a.service_enabled=true
    FOR SHARE OF a,o,w
   `,[tenantId,input.accountId]);
   if(scope.rows.length!==1)throw new Error("WhatsApp account owner/workspace unavailable");
   const organizationId=String(scope.rows[0].organization_id);
   const workspaceId=String(scope.rows[0].workspace_id);
   const payload=JSON.stringify(input);
   const record=await tx.query(`
    INSERT INTO whatsapp_inbound_events
      (tenant_id,account_id,external_message_id,event_type,payload,projection_path)
    VALUES($1::uuid,$2::uuid,$3,$4,$5::jsonb,'events')
    ON CONFLICT(tenant_id,account_id,external_message_id) DO NOTHING
    RETURNING id::text
   `,[tenantId,input.accountId,input.message.externalMessageId,input.type,payload]);
   let duplicate=false;
   let inboundId=record.rows[0]?.id as string|undefined;
   if(!inboundId){
    duplicate=true;
    const previous=await tx.query(`
     SELECT id::text,payload=$4::jsonb AS same_payload,projection_path
     FROM whatsapp_inbound_events
     WHERE tenant_id=$1::uuid AND account_id=$2::uuid AND external_message_id=$3
    `,[tenantId,input.accountId,input.message.externalMessageId,payload]);
    if(previous.rows.length!==1||previous.rows[0].same_payload!==true)
     throw new Error("WhatsApp inbound duplicate conflicts with original payload");
    inboundId=String(previous.rows[0].id);
    // A duplicate first written to the legacy queue belongs to that queue.
    // Never emit a second events-path projection for an existing legacy row.
    if(previous.rows[0].projection_path==="legacy")return {accepted:true,duplicate:true};
    if(previous.rows[0].projection_path!=="events")
     throw Error("Unexpected immutable WhatsApp projection path");
   }
   // BIGINT identifier is a canonical decimal string in v2.
   // No JID, phone, message body or contact name enters the platform ledger.
   await this.events.publish(tx,{
    tenantId,organizationId,workspaceId,
    type:"whatsapp.message.received.v2",producer:"whatsapp",
    aggregateType:"whatsapp_account",aggregateId:input.accountId,
    idempotencyKey:"received:"+input.accountId+":"+inboundId,
    correlationId:correlationUuid(tenantId,input.accountId,inboundId),
    payload:{inboundEventId:inboundId,accountId:input.accountId},
   });
   return {accepted:true,duplicate};
  });
 }
}

export type ScopedInboundWhatsAppMessage=Readonly<{
 tenantId:string;organizationId:string;workspaceId:string;accountId:string;
 inboundEventId:string;message:IncomingWhatsAppEnvelope["message"];
}>;

/** WhatsApp owns the raw inbound row; other modules only receive a scoped
 * transient DTO via this explicit read port inside the consumer transaction. */
export interface WhatsAppInboundMessageReader{
 load(tx:TenantTransaction,lookup:Readonly<{tenantId:string;organizationId:string;
  workspaceId:string;accountId:string;inboundEventId:string}>):Promise<ScopedInboundWhatsAppMessage>;
}
export class PostgresWhatsAppInboundMessageReader implements WhatsAppInboundMessageReader{
 async load(tx:TenantTransaction,lookup:Readonly<{tenantId:string;organizationId:string;
  workspaceId:string;accountId:string;inboundEventId:string}>):Promise<ScopedInboundWhatsAppMessage>{
  if(tx.tenantId!==lookup.tenantId||!/^[1-9][0-9]{0,18}$/.test(lookup.inboundEventId))
   throw new Error("Invalid WhatsApp inbound read scope");
  const r=await tx.query(`
   SELECT e.payload FROM whatsapp_inbound_events e
   JOIN whatsapp_accounts a ON a.tenant_id=e.tenant_id
    AND a.id=e.account_id AND a.service_enabled=true
   JOIN platform_organizations o ON o.tenant_id=a.tenant_id
    AND o.id=a.platform_organization_id AND o.status='active'
   JOIN platform_workspaces w ON w.tenant_id=a.tenant_id
    AND w.organization_id=o.id AND w.id=$4::uuid AND w.status='active'
   WHERE e.tenant_id=$1::uuid AND e.account_id=$2::uuid
    AND e.id=$3::bigint AND e.event_type='whatsapp.message.received'
    AND o.id=$5::uuid AND e.projection_path='events'
   FOR SHARE OF e,a,o,w
  `,[lookup.tenantId,lookup.accountId,lookup.inboundEventId,
      lookup.workspaceId,lookup.organizationId]);
  const payload=r.rows[0]?.payload;
  if(r.rows.length!==1||!validIncomingEnvelope(lookup.tenantId,payload)||
   payload.accountId!==lookup.accountId)
   throw new Error("Inbound reference unavailable in authorized scope");
  return {...lookup,message:payload.message};
 }
}
