import type {TenantDatabase,TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import type {InboxRepository,Inbound,Outbound,Conversation,InboxMessage,InboxEvent,ConversationStatus} from "./contracts.js";
import {InboxTenantMismatchError} from "./contracts.js";
import {uuid} from "./validation.js";
function conv(x:Record<string,unknown>):Conversation{return {
 id:String(x.id),tenantId:String(x.tenant_id),source:String(x.source),externalRef:String(x.external_ref),
 personId:x.person_id===null?null:String(x.person_id),
 status:x.status as ConversationStatus,assignedTo:x.assigned_to===null?null:String(x.assigned_to),
 humanHandoff:Boolean(x.human_handoff),createdAt:String(x.created_at),updatedAt:String(x.updated_at),
};}
function msg(x:Record<string,unknown>):InboxMessage{return {
 id:String(x.id),tenantId:String(x.tenant_id),conversationId:String(x.conversation_id),
 direction:x.direction as "inbound"|"outbound",authorId:x.author_id===null?null:String(x.author_id),
 externalMessageId:x.external_message_id===null?null:String(x.external_message_id),
 body:String(x.body),delivery:x.delivery as InboxMessage["delivery"],createdAt:String(x.created_at),
};}
const C="id,tenant_id,source,external_ref,person_id,status,assigned_to,human_handoff,created_at,updated_at";
const M="id,tenant_id,conversation_id,direction,author_id,external_message_id,body,delivery,created_at";
export class PgInboxRepository implements InboxRepository {
 constructor(private readonly db:TenantDatabase){}
 private verify(t:string){if(uuid(t,"tenant")!==this.db.tenantId)throw new InboxTenantMismatchError();}
 async receive(t:string,actor:string,conversationId:string,messageId:string,input:Inbound){
  this.verify(t);
  const chat=await this.db.query(`INSERT INTO inbox_conversations
    (tenant_id,id,source,external_ref,person_id)
    SELECT $1::uuid,$2::uuid,$3,$4,$5::uuid
    WHERE ($5::uuid IS NULL OR EXISTS(SELECT 1 FROM crm_people
      WHERE tenant_id=$1::uuid AND id=$5::uuid AND archived_at IS NULL))
    ON CONFLICT(tenant_id,source,external_ref)
    DO UPDATE SET external_ref=EXCLUDED.external_ref
    RETURNING ${C}`,[t,conversationId,input.source,input.externalRef,input.personId??null]);
  const c=chat.rows[0];if(!c)throw new Error("Inbox contact does not belong to tenant");
  const inserted=await this.db.query(`WITH inserted AS (
    INSERT INTO inbox_messages
     (tenant_id,id,conversation_id,source,external_message_id,direction,author_id,body,delivery)
    VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,'inbound',$6,$7,'received')
    ON CONFLICT DO NOTHING RETURNING ${M}
  ), audit AS (
    INSERT INTO inbox_events(tenant_id,conversation_id,event,actor_id)
    SELECT tenant_id,conversation_id,'message_received',$6 FROM inserted RETURNING id
  ), bumped AS (
    UPDATE inbox_conversations SET updated_at=now()
    WHERE tenant_id=$1::uuid AND id=$3::uuid AND EXISTS(SELECT 1 FROM inserted)
    RETURNING id
  )
  SELECT inserted.*,true AS inserted_now FROM inserted CROSS JOIN audit CROSS JOIN bumped`,
  [t,messageId,c.id,input.source,input.externalMessageId,actor,input.body]);
  let row=inserted.rows[0];let created=Boolean(row);
  if(!row){
    // Separate SELECT handles concurrent insert commit visibility after conflict.
    const prior=await this.db.query(`SELECT ${M} FROM inbox_messages WHERE
      tenant_id=$1::uuid AND source=$2 AND external_message_id=$3
      AND direction='inbound'`,[t,input.source,input.externalMessageId]);
    row=prior.rows[0];
    if(!row)throw new Error("Inbound deduplication conflict unresolved");
  }
  if(row.conversation_id!==c.id)
    throw new Error("External message ID reused for a different conversation");
  return {conversation:conv(c),message:msg(row),created};
 }
 async listConversations(t:string,limit:number):Promise<readonly Conversation[]>{
  this.verify(t);
  const r=await this.db.query(`SELECT ${C} FROM inbox_conversations
    WHERE tenant_id=$1::uuid ORDER BY updated_at DESC,id LIMIT $2`,[t,limit]);
  return r.rows.map(conv);
 }
 async getConversation(t:string,id:string):Promise<Conversation|null>{
  this.verify(t);
  const r=await this.db.query(`SELECT ${C} FROM inbox_conversations
    WHERE tenant_id=$1::uuid AND id=$2::uuid`,[t,id]);
  return r.rows[0]?conv(r.rows[0]):null;
 }
 async listMessages(t:string,id:string,limit:number):Promise<readonly InboxMessage[]>{
  this.verify(t);
  const r=await this.db.query(`SELECT ${M} FROM (
    SELECT ${M},seq FROM inbox_messages WHERE tenant_id=$1::uuid AND conversation_id=$2::uuid
    ORDER BY seq DESC LIMIT $3
  ) latest ORDER BY seq ASC`,[t,id,limit]);
  return r.rows.map(msg);
 }
 async send(t:string,actor:string,id:string,conversationId:string,input:Outbound):Promise<InboxMessage>{
  this.verify(t);
  const r=await this.db.query(`WITH inserted AS (
    INSERT INTO inbox_messages
      (tenant_id,id,conversation_id,source,direction,author_id,body,delivery)
    SELECT $1::uuid,$2::uuid,id,source,'outbound',$3,$5,'queued'
    FROM inbox_conversations
    WHERE tenant_id=$1::uuid AND id=$4::uuid AND status<>'resolved'
    RETURNING ${M}
  ), queued AS (
    INSERT INTO inbox_outbox(tenant_id,message_id,conversation_id)
    SELECT tenant_id,id,conversation_id FROM inserted RETURNING message_id
  ), audit AS(
    INSERT INTO inbox_events(tenant_id,conversation_id,event,actor_id)
    SELECT tenant_id,conversation_id,'reply_queued',$3 FROM inserted RETURNING id
  )
  SELECT inserted.* FROM inserted CROSS JOIN queued CROSS JOIN audit`,[t,id,actor,conversationId,input.body]);
  if(!r.rows[0])throw new Error("Conversation not found or resolved");
  return msg(r.rows[0]);
 }
 private async update(t:string,actor:string,id:string,sql:string,params:readonly unknown[],event:string):Promise<Conversation|null>{
  this.verify(t);
  const r=await this.db.query(`WITH changed AS (
    UPDATE inbox_conversations SET ${sql},updated_at=now()
    WHERE tenant_id=$1::uuid AND id=$2::uuid
    RETURNING ${C}
  ), audit AS (
    INSERT INTO inbox_events(tenant_id,conversation_id,event,actor_id)
    SELECT tenant_id,id,$3,$4 FROM changed RETURNING id
  )
  SELECT changed.* FROM changed CROSS JOIN audit`,[t,id,event,actor,...params]);
  return r.rows[0]?conv(r.rows[0]):null;
 }
 async assign(t:string,a:string,id:string,assignee:string|null):Promise<Conversation|null>{
  this.verify(t);
  // Atomic self-claim or self-release. Another agent cannot steal/release it.
  const r=await this.db.query(`WITH changed AS (
    UPDATE inbox_conversations SET assigned_to=$5,updated_at=now()
    WHERE tenant_id=$1::uuid AND id=$2::uuid
      AND (($5::text IS NULL AND assigned_to=$4)
        OR ($5::text=$4 AND (assigned_to IS NULL OR assigned_to=$4)))
    RETURNING ${C}
  ), audit AS(
    INSERT INTO inbox_events(tenant_id,conversation_id,event,actor_id)
    SELECT tenant_id,id,$3,$4 FROM changed RETURNING id
  )
  SELECT changed.* FROM changed CROSS JOIN audit`,[t,id,"assigned",a,assignee]);
  return r.rows[0]?conv(r.rows[0]):null;
 }
 setStatus(t:string,a:string,id:string,status:ConversationStatus){
  return this.update(t,a,id,"status=$5",[status],"status_changed");
 }
 handoff(t:string,a:string,id:string,enabled:boolean){
  return this.update(t,a,id,"human_handoff=$5",[enabled],"handoff_changed");
 }
 async listEvents(t:string,after:number,limit:number):Promise<readonly InboxEvent[]>{
  this.verify(t);
  const r=await this.db.query(`SELECT id,tenant_id,conversation_id,event,actor_id,created_at FROM inbox_events
    WHERE tenant_id=$1::uuid AND id>$2 ORDER BY id ASC LIMIT $3`,[t,after,limit]);
  return r.rows.map(x=>({id:Number(x.id),tenantId:String(x.tenant_id),
    conversationId:String(x.conversation_id),event:String(x.event),
    actorId:String(x.actor_id),createdAt:String(x.created_at)}));
 }
}
export class PgInboxRepositoryFactory{
 constructor(private readonly provider:TrustedTenantDatabaseProvider){}
 async forTenant(t:string):Promise<InboxRepository>{
  const id=uuid(t,"tenant");
  const db=await this.provider.resolve(id);
  if(db.tenantId!==id)throw new InboxTenantMismatchError();
  return new PgInboxRepository(db);
 }
}
