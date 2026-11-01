import type {Conversation,ConversationStatus,ConversationQueue,HandoffMode,Message,InboxRepository,InboxMetrics,TenantDatabase,TrustedTenantDatabaseProvider} from "./contracts.js";
import {InboxTenantMismatchError} from "./contracts.js";
import {id} from "./validation.js";
const iso=(value:unknown):string=>value instanceof Date?value.toISOString():String(value);
function conversation(row:Record<string,unknown>):Conversation{
 return {id:String(row.id),tenantId:String(row.tenant_id),crmPersonId:row.crm_person_id==null?null:String(row.crm_person_id),
  subject:String(row.subject),channel:String(row.channel),externalThreadId:row.external_thread_id==null?null:String(row.external_thread_id),
  status:row.status as ConversationStatus,assignedTo:row.assigned_to==null?null:String(row.assigned_to),
  handoff:row.handoff as HandoffMode,createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)};
}
function message(row:Record<string,unknown>):Message{
 return {id:String(row.id),tenantId:String(row.tenant_id),conversationId:String(row.conversation_id),
  direction:row.direction as Message["direction"],body:String(row.body),authorId:String(row.author_id),
  externalMessageId:row.external_message_id==null?null:String(row.external_message_id),createdAt:iso(row.created_at)};
}
/** All operations use tenant-scoped SQL and a Host-approved, per-tenant DB lease. */
export class PgInboxRepository implements InboxRepository {
 constructor(private readonly db:TenantDatabase){}
 private check(tenantId:string):void{
  if(id(tenantId,"tenant")!==this.db.tenantId)throw new InboxTenantMismatchError();
 }
 async create(tenantId:string,actorId:string,record:Readonly<{id:string;subject:string;crmPersonId:string|null;externalThreadId:string|null}>):Promise<Conversation>{
  this.check(tenantId);
  const rows=(await this.db.query(`
    WITH created AS (
      INSERT INTO inbox_conversations (tenant_id,id,crm_person_id,subject,channel,external_thread_id)
      VALUES ($1::uuid,$2::uuid,$3::uuid,$4,'simulation',$5)
      RETURNING *
    ), audit AS (
      INSERT INTO inbox_events(tenant_id,conversation_id,actor_id,action)
      SELECT tenant_id,id,$6,'created' FROM created RETURNING id
    )
    SELECT created.* FROM created CROSS JOIN audit
  `,[tenantId,record.id,record.crmPersonId,record.subject,record.externalThreadId,actorId])).rows;
  if(!rows[0])throw Error("Conversation insert failed");
  return conversation(rows[0]);
 }
 async list(tenantId:string,status:ConversationStatus|null,limit:number,queue:ConversationQueue="all",actorId=""):Promise<readonly Conversation[]>{
  this.check(tenantId);
  // Filter before LIMIT, in the tenant's database. Never query all tenants and then filter in UI.
  if(!["all","mine","unassigned"].includes(queue))throw new Error("Invalid queue");
  const rows=(await this.db.query(`
    SELECT * FROM inbox_conversations WHERE tenant_id=$1::uuid
    AND ($2::text IS NULL OR status=$2)
    AND ($4::text='all' OR ($4::text='mine' AND assigned_to=$5::text)
      OR ($4::text='unassigned' AND assigned_to IS NULL))
    ORDER BY updated_at DESC,id DESC LIMIT $3
  `,[tenantId,status,limit,queue,actorId])).rows;
  return rows.map(conversation);
 }
 async get(tenantId:string,key:string):Promise<Conversation|null>{
  this.check(tenantId);
  const rows=(await this.db.query(
    "SELECT * FROM inbox_conversations WHERE tenant_id=$1::uuid AND id=$2::uuid",
    [tenantId,key])).rows;
  return rows[0]?conversation(rows[0]):null;
 }
 async messages(tenantId:string,key:string,limit:number):Promise<readonly Message[]|null>{
  this.check(tenantId);
  // Existence check prevents silently returning an empty history for a missing/foreign record.
  if(!await this.get(tenantId,key))return null;
  const rows=(await this.db.query(`
    SELECT * FROM (
      SELECT * FROM inbox_messages WHERE tenant_id=$1::uuid AND conversation_id=$2::uuid
      ORDER BY created_at DESC,id DESC LIMIT $3
    ) recent ORDER BY created_at ASC,id ASC
  `,[tenantId,key,limit])).rows;
  return rows.map(message);
 }
 private async change(tenantId:string,key:string,actorId:string,field:"assigned_to"|"status"|"handoff",value:string|null,action:string):Promise<Conversation|null>{
  this.check(tenantId);
  // field is an internal enum, never request-controlled SQL interpolation.
  const rows=(await this.db.query(`
   WITH changed AS (
     UPDATE inbox_conversations SET ${field}=$3,updated_at=clock_timestamp()
     WHERE tenant_id=$1::uuid AND id=$2::uuid AND ${field} IS DISTINCT FROM $3
     RETURNING *
   ), audit AS (
     INSERT INTO inbox_events(tenant_id,conversation_id,actor_id,action,detail)
     SELECT tenant_id,id,$4,$5,jsonb_build_object('value',$3::text) FROM changed RETURNING id
   )
   SELECT changed.* FROM changed CROSS JOIN audit
  `,[tenantId,key,value,actorId,action])).rows;
  return rows[0]?conversation(rows[0]):this.get(tenantId,key);
 }
 assign(tenantId:string,key:string,actorId:string,assignee:string|null):Promise<Conversation|null>{
  return this.change(tenantId,key,actorId,"assigned_to",assignee,"assigned");
 }
 status(tenantId:string,key:string,actorId:string,status:ConversationStatus):Promise<Conversation|null>{
  return this.change(tenantId,key,actorId,"status",status,status==="open"?"reopened":status);
 }
 handoff(tenantId:string,key:string,actorId:string,mode:HandoffMode):Promise<Conversation|null>{
  return this.change(tenantId,key,actorId,"handoff",mode,"handoff");
 }
 async append(tenantId:string,key:string,actorId:string,item:Readonly<{id:string;direction:Message["direction"];body:string;externalMessageId:string|null}>):Promise<Message|null>{
  this.check(tenantId);
  const rows=(await this.db.query(`
    WITH target AS (
      SELECT 1 FROM inbox_conversations
      WHERE tenant_id=$1::uuid AND id=$2::uuid
        AND ( ($4='inbound' AND channel='simulation')
              OR ($4 IN ('outbound','internal') AND status <> 'resolved'
                AND handoff='human' AND assigned_to=$3) )
    ), inserted AS (
      INSERT INTO inbox_messages(tenant_id,id,conversation_id,direction,body,author_id,external_message_id)
      SELECT $1::uuid,$5::uuid,$2::uuid,$4,$6,$3,$7
      FROM target
      ON CONFLICT DO NOTHING RETURNING *
    ), updated AS (
      UPDATE inbox_conversations
      SET updated_at=clock_timestamp(),
          status=CASE WHEN $4='inbound' AND status='resolved' THEN 'open' ELSE status END
      WHERE tenant_id=$1::uuid AND id=$2::uuid AND EXISTS(SELECT 1 FROM inserted)
      RETURNING id
    ), audit AS (
      INSERT INTO inbox_events(tenant_id,conversation_id,actor_id,action)
      SELECT tenant_id,conversation_id,$3,
        CASE WHEN direction='inbound' THEN 'inbound' WHEN direction='internal' THEN 'note' ELSE 'reply' END
      FROM inserted WHERE EXISTS(SELECT 1 FROM updated) RETURNING id
    )
    SELECT inserted.* FROM inserted CROSS JOIN audit
    UNION ALL
    SELECT prior.* FROM inbox_messages prior
    WHERE prior.tenant_id=$1::uuid AND prior.conversation_id=$2::uuid
      AND $4='inbound' AND $7::text IS NOT NULL
      AND prior.external_message_id=$7
      AND EXISTS(SELECT 1 FROM target) AND NOT EXISTS(SELECT 1 FROM inserted)
  `,[tenantId,key,actorId,item.direction,item.id,item.body,item.externalMessageId])).rows;
  const result=rows[0];
  if(!result)return null;
  // A reused external message ID with different content is a conflict, not silent overwriting.
  if(result.direction!==item.direction||result.body!==item.body)throw new InboxConflictError();
  return message(result);
 }
 async metrics(tenantId:string):Promise<InboxMetrics>{
  this.check(tenantId);
  const rows=(await this.db.query(`
    SELECT count(*) FILTER (WHERE status='open') AS open,
           count(*) FILTER (WHERE status='pending') AS pending,
           count(*) FILTER (WHERE status='resolved') AS resolved,
           count(*) FILTER (WHERE assigned_to IS NULL) AS unassigned
    FROM inbox_conversations WHERE tenant_id=$1::uuid
  `,[tenantId])).rows;
  const row=rows[0]??{};
  return {open:Number(row.open??0),pending:Number(row.pending??0),
    resolved:Number(row.resolved??0),unassigned:Number(row.unassigned??0)};
 }
}
export class InboxConflictError extends Error{
 constructor(){super("Conflicting external message ID");this.name="InboxConflictError"}
}
export class PgInboxRepositoryFactory{
 constructor(private readonly provider:TrustedTenantDatabaseProvider){}
 async forTenant(tenantId:string):Promise<InboxRepository>{
  id(tenantId,"tenant");
  const lease=await this.provider.resolve(tenantId);
  if(lease.tenantId!==tenantId)throw new InboxTenantMismatchError();
  return new PgInboxRepository(lease);
 }
}
