import type {Conversation,ConversationStatus,ConversationQueue,ChatScope,HandoffMode,Message,InboxRepository,InboxMetrics,TenantDatabase,TrustedTenantDatabaseProvider} from "./contracts.js";
import {InboxTenantMismatchError,InboxValidationError} from "./contracts.js";
import {id} from "./validation.js";
import {inboxScopedQuery,type InboxDataScope} from "./scope-query.js";
const iso=(value:unknown):string=>value instanceof Date?value.toISOString():String(value);
function conversation(row:Record<string,unknown>):Conversation{
 return {id:String(row.id),tenantId:String(row.tenant_id),crmPersonId:row.crm_person_id==null?null:String(row.crm_person_id),
  subject:String(row.subject),channel:String(row.channel),externalThreadId:row.external_thread_id==null?null:String(row.external_thread_id),
  status:row.status as ConversationStatus,assignedTo:row.assigned_to==null?null:String(row.assigned_to),
  handoff:row.handoff as HandoffMode,createdAt:iso(row.created_at),updatedAt:iso(row.updated_at),
  isGroup:row.is_group===true,unreadCount:Number(row.unread_count??0),
  isFavorite:row.is_favorite===true,isArchived:row.is_archived===true,
  historySyncAt:row.history_sync_at==null?null:iso(row.history_sync_at)};
}
function message(row:Record<string,unknown>):Message{
 return {id:String(row.id),tenantId:String(row.tenant_id),conversationId:String(row.conversation_id),
  direction:row.direction as Message["direction"],body:String(row.body),authorId:String(row.author_id),
  externalMessageId:row.external_message_id==null?null:String(row.external_message_id),createdAt:iso(row.created_at),
  source:(row.source??"local") as NonNullable<Message["source"]>,botEligible:row.bot_eligible===true};
}
/** All operations use tenant-scoped SQL and a Host-approved, per-tenant DB lease. */
export class PgInboxRepository implements InboxRepository {
 constructor(private readonly db:TenantDatabase,private readonly scope?:InboxDataScope){}
 private query(sql:string,values:readonly unknown[]){
  return inboxScopedQuery(this.db,this.scope,sql,values);
 }
 private check(tenantId:string):void{
  if(id(tenantId,"tenant")!==this.db.tenantId)throw new InboxTenantMismatchError();
 }
 async create(tenantId:string,actorId:string,record:Readonly<{id:string;subject:string;crmPersonId:string|null;externalThreadId:string|null}>):Promise<Conversation>{
  this.check(tenantId);
  const rows=(await this.query(`
    WITH created AS (
      INSERT INTO inbox_conversations (tenant_id,id,crm_person_id,subject,channel,external_thread_id /*SCOPE:,platform_organization_id,platform_origin_workspace_id,platform_current_workspace_id*/)
      SELECT $1::uuid,$2::uuid,$3::uuid,$4,'simulation',$5
      /*SCOPE:,@@ORG@@,@@WS@@,@@WS@@*/
      /*SCOPE:WHERE $3::uuid IS NULL OR EXISTS (
        SELECT 1 FROM crm_people p WHERE p.tenant_id=$1::uuid
        AND p.id=$3::uuid AND p.archived_at IS NULL
        AND p.platform_organization_id=@@ORG@@
      )*/
      RETURNING *
    ), audit AS (
      INSERT INTO inbox_events(tenant_id,conversation_id,actor_id,action)
      SELECT tenant_id,id,$6,'created' FROM created RETURNING id
    )
    SELECT created.* FROM created CROSS JOIN audit
  `,[tenantId,record.id,record.crmPersonId,record.subject,record.externalThreadId,actorId])).rows;
  if(!rows[0])throw new InboxValidationError("Invalid CRM reference");
  return conversation(rows[0]);
 }
 async list(tenantId:string,status:ConversationStatus|null,limit:number,queue:ConversationQueue="all",
    actorId="",scope:ChatScope="all",offset=0,search=""):Promise<readonly Conversation[]>{
  this.check(tenantId);
  // Filter before LIMIT, in the tenant's database. Never query all tenants and then filter in UI.
  if(!["all","mine","unassigned"].includes(queue))throw new Error("Invalid queue");
  if(!["all","unread","favorites","groups","archived"].includes(scope))throw new Error("Invalid filter");
  if(!Number.isInteger(offset)||offset<0||offset>100000)throw new Error("Invalid offset");
  if(search.length>80)throw new Error("Invalid search");
  const rows=(await this.query(`
    SELECT c.* FROM inbox_conversations c
    LEFT JOIN whatsapp_conversation_routes r ON r.tenant_id=c.tenant_id
      AND r.conversation_id=c.id /*SCOPE:AND EXISTS (SELECT 1 FROM whatsapp_accounts a WHERE a.tenant_id=r.tenant_id AND a.id=r.account_id AND a.platform_organization_id=@@ORG@@ AND c.platform_current_workspace_id=@@WS@@)*/
    WHERE c.tenant_id=$1::uuid /*SCOPE:AND c.platform_organization_id=@@ORG@@ AND c.platform_current_workspace_id=@@WS@@*/
    AND ($2::text IS NULL OR c.status=$2)
    AND ($4::text='all' OR ($4::text='mine' AND c.assigned_to=$5::text)
      OR ($4::text='unassigned' AND c.assigned_to IS NULL))
    AND ($6::text='all' OR
      ($6::text='unread' AND c.unread_count>0) OR
      ($6::text='favorites' AND c.is_favorite=true) OR
      ($6::text='groups' AND c.channel='whatsapp' AND c.is_group=true) OR
      ($6::text='archived' AND c.is_archived=true))
    AND ($6::text='archived' OR c.is_archived=false)
    AND ($8::text='' OR c.subject ILIKE '%'||$8||'%'
       OR COALESCE(r.phone_e164,'') ILIKE '%'||$8||'%'
       )
    ORDER BY COALESCE((SELECT m.created_at FROM inbox_messages m
      WHERE m.tenant_id=c.tenant_id AND m.conversation_id=c.id
      ORDER BY m.created_at DESC,m.id DESC LIMIT 1),c.updated_at) DESC,
      c.id DESC LIMIT $3 OFFSET $7
  `,[tenantId,status,limit,queue,actorId,scope,offset,search])).rows;
  return rows.map(conversation);
 }
 async get(tenantId:string,key:string):Promise<Conversation|null>{
  this.check(tenantId);
  const rows=(await this.query(
    "SELECT * FROM inbox_conversations WHERE tenant_id=$1::uuid AND id=$2::uuid /*SCOPE:AND platform_organization_id=@@ORG@@ AND platform_current_workspace_id=@@WS@@*/",
    [tenantId,key])).rows;
  return rows[0]?conversation(rows[0]):null;
 }
 async messages(tenantId:string,key:string,limit:number):Promise<readonly Message[]|null>{
  this.check(tenantId);
  // Existence check prevents silently returning an empty history for a missing/foreign record.
  if(!await this.get(tenantId,key))return null;
  const rows=(await this.query(`
    SELECT * FROM (
      SELECT * FROM inbox_messages WHERE tenant_id=$1::uuid AND conversation_id=$2::uuid
      /*SCOPE:AND EXISTS (SELECT 1 FROM inbox_conversations c
        WHERE c.tenant_id=inbox_messages.tenant_id AND c.id=inbox_messages.conversation_id
          AND c.platform_organization_id=@@ORG@@ AND c.platform_current_workspace_id=@@WS@@)*/
      ORDER BY created_at DESC,id DESC LIMIT $3
    ) recent ORDER BY created_at ASC,id ASC
  `,[tenantId,key,limit])).rows;
  return rows.map(message);
 }
 private async change(tenantId:string,key:string,actorId:string,field:"assigned_to"|"status"|"handoff",value:string|null,action:string):Promise<Conversation|null>{
  this.check(tenantId);
  // field is an internal enum, never request-controlled SQL interpolation.
  const rows=(await this.query(`
   WITH changed AS (
     UPDATE inbox_conversations SET ${field}=$3,updated_at=clock_timestamp()
     WHERE tenant_id=$1::uuid AND id=$2::uuid AND ${field} IS DISTINCT FROM $3 /*SCOPE:AND platform_organization_id=@@ORG@@ AND platform_current_workspace_id=@@WS@@*/
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
 async favorite(tenantId:string,key:string,actorId:string,value:boolean):Promise<Conversation|null>{
  this.check(tenantId);
  const rows=(await this.query(`WITH updated AS (
   UPDATE inbox_conversations SET is_favorite=$3
   WHERE tenant_id=$1::uuid AND id=$2::uuid AND channel='whatsapp' /*SCOPE:AND platform_organization_id=@@ORG@@ AND platform_current_workspace_id=@@WS@@*/
   RETURNING *
  ), audit AS (
   INSERT INTO inbox_events(tenant_id,conversation_id,actor_id,action,detail)
   SELECT tenant_id,id,$4,'favorite_changed',jsonb_build_object('favorite',$3) FROM updated
   RETURNING id
  ) SELECT updated.* FROM updated CROSS JOIN audit`,[tenantId,key,value,actorId])).rows;
  return rows[0]?conversation(rows[0]):null;
 }
 async markRead(tenantId:string,key:string,actorId:string):Promise<Conversation|null>{
  this.check(tenantId);
  const rows=(await this.query(`UPDATE inbox_conversations SET unread_count=0
   WHERE tenant_id=$1::uuid AND id=$2::uuid AND channel='whatsapp' /*SCOPE:AND platform_organization_id=@@ORG@@ AND platform_current_workspace_id=@@WS@@*/
   RETURNING *`,[tenantId,key])).rows;
  return rows[0]?conversation(rows[0]):null;
 }
 async linkContact(tenantId:string,key:string,actorId:string,personId:string):Promise<Conversation|null>{
  this.check(tenantId);
  const rows=(await this.query(`
   WITH valid_person AS (
    SELECT id FROM crm_people WHERE tenant_id=$1::uuid AND id=$3::uuid AND archived_at IS NULL /*SCOPE:AND platform_organization_id=@@ORG@@ AND EXISTS (SELECT 1 FROM inbox_conversations c WHERE c.tenant_id=$1::uuid AND c.id=$2::uuid AND c.platform_current_workspace_id=@@WS@@ AND c.platform_organization_id=@@ORG@@)*/
   ), changed AS (
    UPDATE inbox_conversations c SET crm_person_id=$3::uuid,updated_at=clock_timestamp()
    WHERE c.tenant_id=$1::uuid AND c.id=$2::uuid AND c.channel='whatsapp' /*SCOPE:AND c.platform_organization_id=@@ORG@@ AND c.platform_current_workspace_id=@@WS@@*/
      AND EXISTS(SELECT 1 FROM valid_person)
    RETURNING *
   ), audit AS (
    INSERT INTO inbox_events(tenant_id,conversation_id,actor_id,action,detail)
    SELECT tenant_id,id,$4,'contact_linked',jsonb_build_object('personId',$3::text)
    FROM changed RETURNING id
   )
   SELECT changed.* FROM changed JOIN audit ON TRUE
  `,[tenantId,key,personId,actorId])).rows;
  return rows[0]?conversation(rows[0]):null;
 }
 async append(tenantId:string,key:string,actorId:string,item:Readonly<{id:string;direction:Message["direction"];body:string;externalMessageId:string|null}>):Promise<Message|null>{
  this.check(tenantId);
  const rows=(await this.query(`
    WITH target AS (
      SELECT 1 FROM inbox_conversations
      WHERE tenant_id=$1::uuid AND id=$2::uuid
        /*SCOPE:AND platform_organization_id=@@ORG@@ AND platform_current_workspace_id=@@WS@@*/
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
      WHERE tenant_id=$1::uuid AND id=$2::uuid AND EXISTS(SELECT 1 FROM inserted) /*SCOPE:AND platform_organization_id=@@ORG@@ AND platform_current_workspace_id=@@WS@@*/
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
  const rows=(await this.query(`
    SELECT count(*) FILTER (WHERE status='open') AS open,
           count(*) FILTER (WHERE status='pending') AS pending,
           count(*) FILTER (WHERE status='resolved') AS resolved,
           count(*) FILTER (WHERE assigned_to IS NULL) AS unassigned
    FROM inbox_conversations WHERE tenant_id=$1::uuid /*SCOPE:AND platform_organization_id=@@ORG@@ AND platform_current_workspace_id=@@WS@@*/
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
 async forTenant(tenantId:string,scope?:InboxDataScope):Promise<InboxRepository>{
  id(tenantId,"tenant");
  const lease=await this.provider.resolve(tenantId);
  if(lease.tenantId!==tenantId)throw new InboxTenantMismatchError();
  return new PgInboxRepository(lease,scope);
 }
}
