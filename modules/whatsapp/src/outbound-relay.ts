import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {WhatsAppGatewayClient} from "./gateway-client.js";

type Row={id:string;account_id:string;idempotency_key:string;recipient_external_id:string;body:string;status:string;gateway_queue_id:string|null};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Durable transport bridge. The Go gateway's unique (account,idempotencyKey)
 * constraint makes retries safe if a network acknowledgement is lost.
 * A failed/uncertain Go delivery is NEVER resubmitted automatically. */
export class WhatsAppOutboundRelay {
 constructor(private readonly pools:TrustedTenantDatabaseProvider,
  private readonly gateway:Pick<WhatsAppGatewayClient,"sendQueued"|"outboundStatus">){}
 async deliverNext(tenantId:string):Promise<"empty"|"queued"|"pending"|"sent"|"failed"|"retry">{
  if(!UUID.test(tenantId))throw Error("Invalid tenant");
  const db=await this.pools.resolve(tenantId);
  if(db.tenantId!==tenantId)throw Error("Tenant database mismatch");
  const pending=await db.query(`SELECT id::text,account_id::text,idempotency_key,
    recipient_external_id,body,status,gateway_queue_id::text
    FROM whatsapp_outbox WHERE tenant_id=$1::uuid AND status IN ('pending','processing')
    AND next_attempt_at<=clock_timestamp()
    AND EXISTS (
      SELECT 1 FROM whatsapp_accounts a
      WHERE a.tenant_id=whatsapp_outbox.tenant_id
        AND a.id=whatsapp_outbox.account_id
        AND a.service_enabled=true AND a.platform_organization_id IS NOT NULL
        AND (whatsapp_outbox.inbox_message_id IS NULL OR EXISTS (
          SELECT 1 FROM inbox_messages m
          JOIN inbox_conversations c ON c.tenant_id=m.tenant_id AND c.id=m.conversation_id
          WHERE m.tenant_id=whatsapp_outbox.tenant_id
            AND m.id=whatsapp_outbox.inbox_message_id
            AND c.platform_organization_id=a.platform_organization_id
        ))
    ) ORDER BY created_at,id LIMIT 1`,[tenantId]);
  const row=pending.rows[0] as Row|undefined;
  if(!row)return "empty";
  if(!UUID.test(row.id)||!UUID.test(row.account_id)||!row.idempotency_key)throw Error("Invalid durable outbound record");
  try{
   if(row.gateway_queue_id==null){
    const queued=await this.gateway.sendQueued(tenantId,row.account_id,{
     idempotencyKey:row.idempotency_key,recipientExternalId:row.recipient_external_id,body:row.body
    });
    await db.query(`UPDATE whatsapp_outbox SET gateway_queue_id=$3,status='processing',
       next_attempt_at=clock_timestamp()+interval '2 seconds',updated_at=clock_timestamp()
       WHERE tenant_id=$1::uuid AND id=$2::uuid AND status IN ('pending','processing')
         AND gateway_queue_id IS NULL`,[tenantId,row.id,queued.queueId]);
    return "queued";
   }
   const queueId=Number(row.gateway_queue_id);
   if(!Number.isSafeInteger(queueId)||queueId<=0)throw Error("Invalid gateway queue reference");
   const result=await this.gateway.outboundStatus(tenantId,row.account_id,queueId);
   if(result.status==="sent"){
    if(!result.externalMessageId)throw Error("Missing sent message ID");
    await db.query(`WITH completed AS (
      UPDATE whatsapp_outbox SET status='sent',external_message_id=$3,
       updated_at=clock_timestamp() WHERE tenant_id=$1::uuid AND id=$2::uuid
       AND status='processing' RETURNING tenant_id,inbox_message_id,external_message_id
     ), linked AS (
      UPDATE inbox_messages m SET external_message_id=c.external_message_id
      FROM completed c WHERE m.tenant_id=c.tenant_id AND m.id=c.inbox_message_id
        AND m.direction='outbound' RETURNING m.id
     ) SELECT id FROM linked`,[tenantId,row.id,result.externalMessageId]);
    return "sent";
   }
   if(result.status==="failed"){
    await db.query(`UPDATE whatsapp_outbox SET status='failed',updated_at=clock_timestamp()
      WHERE tenant_id=$1::uuid AND id=$2::uuid AND status='processing'`,[tenantId,row.id]);
    return "failed";
   }
   await db.query(`UPDATE whatsapp_outbox SET next_attempt_at=clock_timestamp()+interval '2 seconds'
    WHERE tenant_id=$1::uuid AND id=$2::uuid AND status='processing'`,[tenantId,row.id]);
   return "pending";
  }catch{
   // Retain the same idempotency key across transport errors, never mark as sent.
   await db.query(`UPDATE whatsapp_outbox SET attempts=attempts+1,
    next_attempt_at=clock_timestamp()+make_interval(secs=>LEAST(300,(POWER(2,LEAST(attempts,8)))::integer)),
    updated_at=clock_timestamp() WHERE tenant_id=$1::uuid AND id=$2::uuid
    AND status IN ('pending','processing')`,[tenantId,row.id]);
   return "retry";
  }
 }
}
