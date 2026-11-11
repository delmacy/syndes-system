import {randomUUID} from "node:crypto";
import {
 platformEventTypes,validatePlatformEvent,
 type Actor,type PlatformEventType,type PublishPlatformEvent,
 type TenantTransaction,type TrustedTenantTransactionProvider,
} from "@syndes/core-kernel";

const UUID=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const MAX_ATTEMPTS=8;
const LEASE_SECONDS=30;
const SUSPENSION_SECONDS=60;

/** Explicitly registered trusted consumer, never loaded from event payload. */
export type EventSubscription=Readonly<{
 id:string;moduleId:"crm"|"inbox"|"whatsapp"|"organizations";
 types:readonly PlatformEventType[];
 handle:(tx:TenantTransaction,event:DeliveredPlatformEvent)=>Promise<void>;
}>;
export type DeliveredPlatformEvent=PublishPlatformEvent & Readonly<{eventId:string;createdAt:Date}>;

/** The Host must provide service identity and real Control/FGA state.
 * No user JWT is constructed or accepted. Fail closed on authorization outage. */
export type EventWorkerAuthorization=Readonly<{
 authorize:(request:Readonly<{actor:Actor;tenantId:string;organizationId:string;
  workspaceId:string|null;consumerId:string;moduleId:string;
  eventType:PlatformEventType}>)=>Promise<"enabled"|"suspended"|"denied">;
}>;
export class PermanentEventError extends Error{
 constructor(){super("Permanent event processing error");this.name="PermanentEventError"}
}
export function retryDelaySeconds(attempts:number):number{
 if(!Number.isInteger(attempts)||attempts<1)throw Error("Invalid attempt");
 return Math.min(3600,5*2**Math.min(attempts-1,10));
}
type Claim=Readonly<{eventId:string;consumerId:string;leaseOwner:string;attempts:number;
 organizationId:string;workspaceId:string|null;eventType:PlatformEventType}>;

export class TenantEventDispatcher{
 private readonly consumers=new Map<string,EventSubscription>();
 private readonly actor:Actor;
 constructor(
  private readonly databases:TrustedTenantTransactionProvider,
  consumers:readonly EventSubscription[],
  private readonly authorization:EventWorkerAuthorization,
  principalId:string,
 ){
  if(!principalId||principalId.length>128||!authorization?.authorize)
   throw Error("Trusted service identity and authorization required");
  this.actor=Object.freeze({kind:"service",id:principalId});
  for(const consumer of consumers){
   if(!/^[a-z][a-z0-9_.-]{1,95}$/.test(consumer.id)||
      !consumer.id.startsWith(consumer.moduleId+".")||
      !consumer.types.length||consumer.types.some(x=>!platformEventTypes.includes(x))||
      typeof consumer.handle!=="function"||this.consumers.has(consumer.id))
    throw Error("Invalid or duplicate platform consumer registration");
   this.consumers.set(consumer.id,consumer);
  }
 }
 private checkTenant(tenantId:string):void{
  if(!UUID.test(tenantId))throw Error("Invalid tenant identifier");
 }
 /** SKIP LOCKED routes event to each registered consumer, without executing effects.
  * Unsupported events are retained, not silently dropped. */
 async routePending(tenantId:string,limit=50):Promise<number>{
  this.checkTenant(tenantId);
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("Invalid route batch");
  return this.databases.withTransaction(tenantId,async tx=>{
   const batch=await tx.query(`
    SELECT event_id::text,organization_id::text,workspace_id::text,event_type,
     event_version,producer,aggregate_type,aggregate_id::text,idempotency_key,
     correlation_id::text,causation_id::text,payload,created_at
    FROM platform_events.outbox_events
    WHERE tenant_id=$1::uuid AND routing_state='pending'
    ORDER BY created_at,event_id LIMIT $2 FOR UPDATE SKIP LOCKED
   `,[tenantId,limit]);
   for(const row of batch.rows){
    const type=row.event_type as PlatformEventType;
    const delivery:PublishPlatformEvent={
     tenantId,organizationId:String(row.organization_id),
     workspaceId:typeof row.workspace_id==="string"?row.workspace_id:null,
     type,producer:row.producer as PublishPlatformEvent["producer"],
     aggregateType:String(row.aggregate_type),aggregateId:String(row.aggregate_id),
     idempotencyKey:String(row.idempotency_key),correlationId:String(row.correlation_id),
     causationId:typeof row.causation_id==="string"?row.causation_id:null,
     payload:row.payload as Record<string,unknown>,
    };
    let supported=false;
    try{
     if(row.event_version!==1)throw Error("Event version unsupported");
     validatePlatformEvent(delivery);
     supported=true;
    }catch{/* malformed or unknown persisted event is preserved for review */}
    const subscribers=supported?[...this.consumers.values()].filter(x=>x.types.includes(type)):[];
    for(const sub of subscribers){
     await tx.query(`
      INSERT INTO platform_events.event_deliveries(tenant_id,event_id,consumer_id)
      VALUES($1::uuid,$2::uuid,$3)
      ON CONFLICT(tenant_id,event_id,consumer_id) DO NOTHING
     `,[tenantId,row.event_id,sub.id]);
    }
    await tx.query(`
     UPDATE platform_events.outbox_events SET routing_state=$3,
      routed_at=clock_timestamp()
     WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND routing_state='pending'
    `,[tenantId,row.event_id,subscribers.length?"routed":"unsupported"]);
   }
   return batch.rows.length;
  });
 }
 private async claim(tenantId:string):Promise<Claim|null>{
  const owner=randomUUID();
  return this.databases.withTransaction(tenantId,async tx=>{
   // Expired last-attempt leases may not remain in a processing limbo.
   await tx.query(`
    UPDATE platform_events.event_deliveries
    SET state='dead',lease_owner=NULL,lease_until=NULL,
     last_error_class='transient',failed_at=clock_timestamp()
    WHERE tenant_id=$1::uuid AND state='processing' AND
      lease_until<clock_timestamp() AND attempts>=$2
   `,[tenantId,MAX_ATTEMPTS]);
   const found=await tx.query(`
    WITH candidate AS(
     SELECT d.tenant_id,d.event_id,d.consumer_id
     FROM platform_events.event_deliveries d
     WHERE d.tenant_id=$1::uuid AND d.attempts<$2 AND
      ((d.state IN ('pending','retry','suspended') AND d.next_attempt_at<=clock_timestamp())
       OR (d.state='processing' AND d.lease_until<clock_timestamp()))
     ORDER BY d.next_attempt_at,d.event_id,d.consumer_id
     LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE platform_events.event_deliveries d
    SET state='processing',lease_owner=$3::uuid,
     lease_until=clock_timestamp()+($4::int*interval '1 second'),
     attempts=d.attempts+1,claimed_at=clock_timestamp()
    FROM candidate c
    WHERE d.tenant_id=c.tenant_id AND d.event_id=c.event_id AND d.consumer_id=c.consumer_id
    RETURNING d.event_id::text,d.consumer_id,d.attempts
   `,[tenantId,MAX_ATTEMPTS,owner,LEASE_SECONDS]);
   const first=found.rows[0];
   if(!first)return null;
   const ev=await tx.query(`
    SELECT organization_id::text,workspace_id::text,event_type
    FROM platform_events.outbox_events WHERE tenant_id=$1::uuid AND event_id=$2::uuid
   `,[tenantId,first.event_id]);
   const row=ev.rows[0];
   if(!row)throw Error("Delivery missing source event");
   return {eventId:String(first.event_id),consumerId:String(first.consumer_id),
    leaseOwner:owner,attempts:Number(first.attempts),
    organizationId:String(row.organization_id),
    workspaceId:typeof row.workspace_id==="string"?row.workspace_id:null,
    eventType:row.event_type as PlatformEventType};
  });
 }
 private async changeClaim(tenantId:string,claim:Claim,
  state:"suspended"|"dead"|"retry",failure:"transient"|"permanent"|"unauthorized"|"suspended"):Promise<void>{
  const isSuspended=state==="suspended";
  const delay=isSuspended?SUSPENSION_SECONDS:retryDelaySeconds(claim.attempts);
  await this.databases.withTransaction(tenantId,async tx=>{
   await tx.query(`
    UPDATE platform_events.event_deliveries
     SET state=$4,lease_owner=NULL,lease_until=NULL,
      attempts=CASE WHEN $7::bool THEN GREATEST(0,attempts-1) ELSE attempts END,
      last_error_class=$5,
      failed_at=clock_timestamp(),
      next_attempt_at=clock_timestamp()+($6::int*interval '1 second')
     WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND consumer_id=$3
      AND state='processing' AND lease_owner=$8::uuid
   `,[tenantId,claim.eventId,claim.consumerId,state,failure,delay,isSuspended,claim.leaseOwner]);
  });
 }
 private async deliver(tenantId:string,claim:Claim,consumer:EventSubscription):Promise<boolean>{
  return this.databases.withTransaction(tenantId,async tx=>{
   const state=await tx.query(`
    SELECT d.state,d.lease_until
    FROM platform_events.event_deliveries d
    WHERE d.tenant_id=$1::uuid AND d.event_id=$2::uuid AND d.consumer_id=$3
      AND d.lease_owner=$4::uuid
    FOR UPDATE
   `,[tenantId,claim.eventId,claim.consumerId,claim.leaseOwner]);
   const owned=state.rows[0];
   if(!owned||owned.state!=="processing"||!(owned.lease_until instanceof Date)||
      owned.lease_until.getTime()<=Date.now())
    throw new Error("Claim expired");
   const r=await tx.query(`
    SELECT organization_id::text,workspace_id::text,event_type,producer,
     aggregate_type,aggregate_id::text,idempotency_key,correlation_id::text,
     causation_id::text,payload,created_at
    FROM platform_events.outbox_events WHERE tenant_id=$1::uuid AND event_id=$2::uuid
   `,[tenantId,claim.eventId]);
   const row=r.rows[0];
   if(!row||row.organization_id!==claim.organizationId||
    (row.workspace_id??null)!==claim.workspaceId||row.event_type!==claim.eventType)
    throw new PermanentEventError();
   const evt:DeliveredPlatformEvent={
    tenantId,organizationId:claim.organizationId,workspaceId:claim.workspaceId,
    eventId:claim.eventId,createdAt:row.created_at as Date,
    type:claim.eventType,producer:row.producer as PublishPlatformEvent["producer"],
    aggregateType:String(row.aggregate_type),aggregateId:String(row.aggregate_id),
    idempotencyKey:String(row.idempotency_key),correlationId:String(row.correlation_id),
    causationId:typeof row.causation_id==="string"?row.causation_id:null,
    payload:row.payload as Record<string,unknown>,
   };
   validatePlatformEvent(evt);
   const prior=await tx.query(`
    SELECT 1 FROM platform_events.consumer_inbox
    WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND consumer_id=$3
   `,[tenantId,claim.eventId,claim.consumerId]);
   if(!prior.rows.length){
    await consumer.handle(tx,evt);
    await tx.query(`
     INSERT INTO platform_events.consumer_inbox(tenant_id,event_id,consumer_id)
     VALUES($1::uuid,$2::uuid,$3)
     ON CONFLICT(tenant_id,event_id,consumer_id) DO NOTHING
    `,[tenantId,claim.eventId,claim.consumerId]);
   }
   const ack=await tx.query(`
    UPDATE platform_events.event_deliveries
    SET state='completed',completed_at=clock_timestamp(),
     lease_owner=NULL,lease_until=NULL,last_error_class=NULL
    WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND consumer_id=$3
     AND state='processing' AND lease_owner=$4::uuid
   `,[tenantId,claim.eventId,claim.consumerId,claim.leaseOwner]);
   if(ack.rowCount!==1)throw Error("Delivery acknowledgement lost");
   return prior.rows.length===0;
  });
 }
 /** One durable delivery attempt. Caller schedules ticks only after tenant & service
  * admission. An exception never silently confirms the event. */
 async processNext(tenantId:string):Promise<"empty"|"delivered"|"already_processed"|"retry"|"dead"|"suspended">{
  this.checkTenant(tenantId);
  const claim=await this.claim(tenantId);
  if(!claim)return "empty";
  const consumer=this.consumers.get(claim.consumerId);
  if(!consumer||!consumer.types.includes(claim.eventType)){
   await this.changeClaim(tenantId,claim,"dead","permanent");
   return "dead";
  }
  let status:"enabled"|"suspended"|"denied";
  try{
   status=await this.authorization.authorize({
    actor:this.actor,tenantId,organizationId:claim.organizationId,workspaceId:claim.workspaceId,
    consumerId:claim.consumerId,moduleId:consumer.moduleId,eventType:claim.eventType,
   });
  }catch{status="denied"}
  if(status==="suspended"){
   await this.changeClaim(tenantId,claim,"suspended","suspended");
   return "suspended";
  }
  if(status!=="enabled"){
   await this.changeClaim(tenantId,claim,"dead","unauthorized");
   return "dead";
  }
  try{
   const applied=await this.deliver(tenantId,claim,consumer);
   return applied?"delivered":"already_processed";
  }catch(error){
   const fatal=error instanceof PermanentEventError;
   const dead=fatal||claim.attempts>=MAX_ATTEMPTS;
   await this.changeClaim(tenantId,claim,dead?"dead":"retry",fatal?"permanent":"transient");
   return dead?"dead":"retry";
  }
 }
}
