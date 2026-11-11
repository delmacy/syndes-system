import {randomUUID} from "node:crypto";
import {PINNED_TENANT_TRANSACTION,validatePlatformEvent,type PublishPlatformEvent,type TenantTransaction} from "@syndes/core-kernel";

/** Called ONLY from a pinned transaction of the same tenant database. */
export class TenantEventPublisher{
 async publish(tx:TenantTransaction,event:PublishPlatformEvent):Promise<{eventId:string;inserted:boolean}>{
  if(tx[PINNED_TENANT_TRANSACTION]!==true)throw new Error("Pinned tenant transaction required");
  validatePlatformEvent(event);
  if(tx.tenantId!==event.tenantId)throw new Error("Event tenant/transaction mismatch");
  const id=randomUUID();
  const inserted=await tx.query(`
   INSERT INTO platform_events.outbox_events
   (tenant_id,event_id,organization_id,workspace_id,event_type,event_version,producer,
    aggregate_type,aggregate_id,idempotency_key,correlation_id,causation_id,payload)
   VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,1,$6,$7,$8::uuid,$9,$10::uuid,$11::uuid,$12::jsonb)
   ON CONFLICT(tenant_id,producer,idempotency_key) DO NOTHING
   RETURNING event_id::text
  `,[event.tenantId,id,event.organizationId,event.workspaceId??null,event.type,
      event.producer,event.aggregateType,event.aggregateId,event.idempotencyKey,
      event.correlationId,event.causationId??null,JSON.stringify(event.payload)]);
  if(inserted.rows.length===1)return {eventId:id,inserted:true};
  // An idempotency key may be retried, but it must never alias different facts.
  const previous=await tx.query(`
   SELECT event_id::text,event_type,organization_id::text,workspace_id::text,
     aggregate_type,aggregate_id::text,correlation_id::text,causation_id::text,
     payload=$4::jsonb AS same_payload
   FROM platform_events.outbox_events
   WHERE tenant_id=$1::uuid AND producer=$2 AND idempotency_key=$3
  `,[event.tenantId,event.producer,event.idempotencyKey,JSON.stringify(event.payload)]);
  const p=previous.rows[0];
  if(!p||p.event_type!==event.type||p.organization_id!==event.organizationId||
   (p.workspace_id??null)!==(event.workspaceId??null)||
   p.aggregate_type!==event.aggregateType||p.aggregate_id!==event.aggregateId||
   p.correlation_id!==event.correlationId||
   (p.causation_id??null)!==(event.causationId??null)||
   p.same_payload!==true)
   throw new Error("Event idempotency-key collision");
  return {eventId:String(p.event_id),inserted:false};
 }
}
