import {createHash,randomUUID} from "node:crypto";
import {Inject,Injectable} from "@nestjs/common";
import type {TrustedTenantDatabaseProvider,TenantDatabase} from "@syndes/core-kernel";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context={tenantId:string;actor:{id:string}};
type Reply={id:string;tenantId:string;conversationId:string;direction:"outbound";body:string;authorId:string;externalMessageId:null;createdAt:string};
function asReply(row:Record<string,unknown>):Reply{
 return {id:String(row.id),tenantId:String(row.tenant_id),conversationId:String(row.conversation_id),
  direction:"outbound",body:String(row.body),authorId:String(row.author_id),
  externalMessageId:null,createdAt:row.created_at instanceof Date?row.created_at.toISOString():String(row.created_at)};
}
export class WhatsAppRouteError extends Error {
 constructor(){super("WhatsApp conversation route unavailable");this.name="WhatsAppRouteError"}
}
/** Never trusts a caller-chosen recipient, account, or database. An approved
 * inbound event is the sole authority to bind a WhatsApp conversation route. */
export class WhatsAppReplyQueue{
 constructor(private readonly pools:TrustedTenantDatabaseProvider){}
 private async backfill(db:TenantDatabase,tenantId:string,conversationId:string):Promise<void>{
  const conversations=await db.query(`SELECT external_thread_id FROM inbox_conversations
   WHERE tenant_id=$1::uuid AND id=$2::uuid AND channel='whatsapp'`,[tenantId,conversationId]);
  const thread=conversations.rows[0]?.external_thread_id;
  if(typeof thread!=="string"||!/^[a-f0-9]{64}$/.test(thread))throw new WhatsAppRouteError();
  const events=await db.query(`SELECT e.account_id::text AS account_id,
    e.payload->'message'->>'senderExternalId' AS sender
    FROM whatsapp_inbound_events e WHERE e.tenant_id=$1::uuid
    AND e.processed_at IS NOT NULL AND e.failed_at IS NULL
    ORDER BY e.id DESC LIMIT 10000`,[tenantId]);
  const matches=events.rows.filter(e=>typeof e.account_id==="string"&&UUID.test(e.account_id)&&
    typeof e.sender==="string"&&e.sender.length>0&&e.sender.length<=256&&
    createHash("sha256").update(e.account_id+"|"+e.sender).digest("hex")===thread);
  if(!matches.length)throw new WhatsAppRouteError();
  const match=matches[0];
  const result=await db.query(`INSERT INTO whatsapp_conversation_routes
    (tenant_id,conversation_id,account_id,recipient_external_id)
    SELECT c.tenant_id,c.id,a.id,$4 FROM inbox_conversations c
    JOIN whatsapp_accounts a ON a.tenant_id=c.tenant_id AND a.id=$3::uuid
    WHERE c.tenant_id=$1::uuid AND c.id=$2::uuid AND c.channel='whatsapp'
      AND c.external_thread_id=$5 AND a.service_enabled=true
    ON CONFLICT(tenant_id,conversation_id) DO UPDATE
      SET recipient_external_id=EXCLUDED.recipient_external_id
      WHERE whatsapp_conversation_routes.account_id=EXCLUDED.account_id
        AND whatsapp_conversation_routes.recipient_external_id=EXCLUDED.recipient_external_id
    RETURNING conversation_id`,[tenantId,conversationId,match.account_id,match.sender,thread]);
  if(result.rows.length!==1)throw new WhatsAppRouteError();
 }
 /** Authenticated Inbox readers can see the verified phone attached to the
  * conversation. Never infer a phone from a LID nor expose other tenants. */
 async decorateConversations<T extends {id:string;channel:string}>(tenantId:string,conversations:readonly T[]):Promise<readonly (T & {phoneNumber?:string|null})[]>{
  const whatsapp=conversations.filter(record=>record.channel==="whatsapp"&&UUID.test(record.id));
  if(!whatsapp.length)return conversations;
  if(!UUID.test(tenantId))throw Error("Invalid tenant");
  const db=await this.pools.resolve(tenantId);
  if(db.tenantId!==tenantId)throw Error("Tenant database mismatch");
  const rows=await db.query(`SELECT r.conversation_id::text AS id,r.phone_e164
   FROM whatsapp_conversation_routes r JOIN inbox_conversations c
   ON c.tenant_id=r.tenant_id AND c.id=r.conversation_id
   WHERE r.tenant_id=$1::uuid AND c.channel='whatsapp'
   AND r.conversation_id=ANY($2::uuid[])`,[tenantId,whatsapp.map(c=>c.id)]);
  const known=new Map(rows.rows.map(row=>[String(row.id),typeof row.phone_e164==="string"?row.phone_e164:null]));
  return conversations.map(c=>c.channel==="whatsapp"?{...c,phoneNumber:known.get(c.id)??null}:c);
 }
 /** Decorates only messages already selected by an authorized Inbox read.
  * Missing outbox rows expose old local-only replies instead of implying delivery. */
 async decorate<T extends {id:string;direction:string}>(tenantId:string,messages:readonly T[]):Promise<readonly (T & {deliveryStatus?:"pending"|"processing"|"sent"|"failed"|"not_queued"})[]>{
  if(!UUID.test(tenantId))throw Error("Invalid tenant");
  const outgoing=messages.filter(message=>message.direction==="outbound"&&UUID.test(message.id));
  if(!outgoing.length)return messages;
  const db=await this.pools.resolve(tenantId);
  if(db.tenantId!==tenantId)throw Error("Tenant database mismatch");
  const result=await db.query(`SELECT inbox_message_id::text AS message_id,status
   FROM whatsapp_outbox WHERE tenant_id=$1::uuid AND inbox_message_id=ANY($2::uuid[])`,[tenantId,outgoing.map(m=>m.id)]);
  const known=new Map(result.rows.map(row=>[String(row.message_id),String(row.status)]));
  return messages.map(message=>{
   if(message.direction!=="outbound")return message;
   const state=known.get(message.id);
   const deliveryStatus=state==="pending"||state==="processing"||state==="sent"||state==="failed"?state:"not_queued";
   return {...message,deliveryStatus};
  });
 }
 async enqueue(ctx:Context,conversationId:string,input:unknown):Promise<Reply|null>{
  if(!UUID.test(ctx.tenantId)||!UUID.test(conversationId)||typeof ctx.actor.id!=="string"||!ctx.actor.id.trim())
   throw new WhatsAppRouteError();
  if(typeof input!=="string"||!input.trim()||input.length>5000)throw Error("Invalid reply body");
  const body=input.trim();
  const db=await this.pools.resolve(ctx.tenantId);
  if(db.tenantId!==ctx.tenantId)throw Error("Tenant database mismatch");
  const existing=await db.query(`SELECT 1 FROM whatsapp_conversation_routes
    WHERE tenant_id=$1::uuid AND conversation_id=$2::uuid`,[ctx.tenantId,conversationId]);
  if(!existing.rows.length)await this.backfill(db,ctx.tenantId,conversationId);
  const messageId=randomUUID(),outboxId=randomUUID();
  // One statement means there can never be a visible outbound Inbox message
  // without its tenant-local, durable WhatsApp outbox intent.
  const result=await db.query(`
   WITH target AS (
    SELECT c.tenant_id,c.id,r.account_id,r.recipient_external_id
    FROM inbox_conversations c
    JOIN whatsapp_conversation_routes r ON r.tenant_id=c.tenant_id AND r.conversation_id=c.id
    JOIN whatsapp_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id
    WHERE c.tenant_id=$1::uuid AND c.id=$2::uuid AND c.channel='whatsapp'
      AND c.status <> 'resolved' AND c.handoff='human' AND c.assigned_to=$3
      AND a.service_enabled=true
   ), inserted AS (
    INSERT INTO inbox_messages(tenant_id,id,conversation_id,direction,body,author_id,external_message_id)
    SELECT tenant_id,$4::uuid,id,'outbound',$5,$3,NULL FROM target
    RETURNING *
   ), queued AS (
    INSERT INTO whatsapp_outbox
     (id,tenant_id,account_id,idempotency_key,recipient_external_id,body,inbox_message_id)
    SELECT $6::uuid,m.tenant_id,t.account_id,'inbox:'||m.id::text,t.recipient_external_id,m.body,m.id
    FROM inserted m JOIN target t ON t.tenant_id=m.tenant_id AND t.id=m.conversation_id
    RETURNING tenant_id,inbox_message_id
   ), touched AS (
    UPDATE inbox_conversations c SET updated_at=clock_timestamp()
    FROM queued q WHERE c.tenant_id=q.tenant_id AND c.id=$2::uuid
    RETURNING c.id
   ), audit AS (
    INSERT INTO inbox_events(tenant_id,conversation_id,actor_id,action)
    SELECT m.tenant_id,m.conversation_id,$3,'reply_queued'
    FROM inserted m JOIN queued q ON q.tenant_id=m.tenant_id AND q.inbox_message_id=m.id
    RETURNING id
   )
   SELECT m.* FROM inserted m JOIN queued q
     ON q.tenant_id=m.tenant_id AND q.inbox_message_id=m.id
   WHERE EXISTS(SELECT 1 FROM touched) AND EXISTS(SELECT 1 FROM audit)
  `,[ctx.tenantId,conversationId,ctx.actor.id,messageId,body,outboxId]);
  return result.rows[0]?asReply(result.rows[0]):null;
 }
}
@Injectable()
export class WhatsAppReplyService extends WhatsAppReplyQueue {
 constructor(@Inject("SYNDES_TENANT_DB")pools:TrustedTenantDatabaseProvider){super(pools)}
}
