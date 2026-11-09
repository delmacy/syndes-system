import {randomUUID} from "node:crypto";
import {AccessDeniedError,type Actor,type CoreKernel,type TenantDatabase,type TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {
 allowedPreviousStates,assignmentRequest,externalRequest,internalRequest,noteRequest,
 parseList,priority,queueRequest,requireUuid,stateRequest,SupportInputError,
 validateKind,validateQueue,validUuid,type SupportKind
} from "./domain.js";

export type SupportContext=Readonly<{tenantId:string;actor:Actor}>;
export type SupportSettings=Readonly<{tenantId:string|undefined;whatsappAccountId:string|undefined}>;
export class SupportDatabaseMismatchError extends Error{
 constructor(){super("Trusted Syndes database mismatch");this.name="SupportDatabaseMismatchError";}
}
export const supportModule=Object.freeze({
 id:"support",version:"0.1.0",dependencies:["platform","crm","inbox","whatsapp","organizations"]
});
const iso=(v:unknown)=>v instanceof Date?v.toISOString():v==null?null:String(v);
const asCase=(r:Record<string,unknown>)=>({
 id:String(r.id),protocol:"SYN-"+String(r.protocol).padStart(9,"0"),kind:String(r.kind),
 channel:String(r.channel),requesterId:String(r.requester_id),queue:String(r.queue_code),
 assignedTo:r.assigned_to==null?null:String(r.assigned_to),priority:String(r.priority),
 status:String(r.status),canOperate:r.can_operate===true,crmPersonId:r.crm_person_id==null?null:String(r.crm_person_id),
 conversationId:r.inbox_conversation_id==null?null:String(r.inbox_conversation_id),
 commercialTenantRef:r.commercial_tenant_ref==null?null:String(r.commercial_tenant_ref),
 createdAt:iso(r.created_at),updatedAt:iso(r.updated_at),resolvedAt:iso(r.resolved_at),closedAt:iso(r.closed_at),
});
const asEvent=(r:Record<string,unknown>)=>({
 id:String(r.id),action:String(r.action),actorId:String(r.actor_id),
 previousStatus:r.previous_status==null?null:String(r.previous_status),
 nextStatus:r.next_status==null?null:String(r.next_status),
 body:r.body==null?null:String(r.body),recordedAt:iso(r.recorded_at),
});
/** Production caller supplies ONLY an authenticated Host principal; no HTTP-selected tenant credentials. */
export class SupportService{
 constructor(private readonly kernel:CoreKernel,
  private readonly databases:TrustedTenantDatabaseProvider,
  private readonly settings:()=>SupportSettings=()=>({
   tenantId:process.env.SYNDES_SUPPORT_TENANT_ID,
   whatsappAccountId:process.env.SYNDES_SUPPORT_WHATSAPP_ACCOUNT_ID,
  })){}
 private async run<T>(ctx:SupportContext,kind:SupportKind,action:"read"|"write",
   handler:(db:TenantDatabase,settings:SupportSettings)=>Promise<T>,
   extra:readonly {resource:string;action:"read"|"write"}[]=[]):Promise<T>{
  const config=this.settings();
  // A master/another tenant member can never configure or infer this value from HTTP.
  if(!validUuid(config.tenantId)||!validUuid(ctx?.tenantId)||ctx.tenantId!==config.tenantId||
     ctx.actor?.kind!=="user"||typeof ctx.actor.id!=="string"||!ctx.actor.id.trim()||ctx.actor.id.length>256)
    throw new AccessDeniedError();
  return this.kernel.execute({actor:ctx.actor,tenantId:ctx.tenantId,action,
    resource:"support:cases:"+kind},async()=>{
    for(const check of extra){
     await this.kernel.execute({actor:ctx.actor,tenantId:ctx.tenantId,...check},async()=>true);
    }
    const db=await this.databases.resolve(ctx.tenantId);
    if(db.tenantId!==ctx.tenantId)throw new SupportDatabaseMismatchError();
    return handler(db,config);
  });
 }
 async createInternal(ctx:SupportContext,input:unknown){
  const p=internalRequest(input),caseId=randomUUID();
  return this.run(ctx,"internal","write",async db=>{
   const r=await db.query(`
    WITH created AS (
     INSERT INTO support_cases(tenant_id,id,kind,channel,requester_id,queue_code,priority,status)
     SELECT $1::uuid,$2::uuid,'internal','form',$4,q.code,$5,'new'
     FROM support_queues q WHERE q.code=$3 AND q.kind='internal'
     RETURNING *
    ), audit AS (
     INSERT INTO support_case_events(tenant_id,case_id,actor_id,action,next_status,body)
     SELECT tenant_id,id,$4,'created','new',$6 FROM created RETURNING case_id
    )
    SELECT c.* FROM created c JOIN audit a ON a.case_id=c.id
   `,[ctx.tenantId,caseId,p.queue,ctx.actor.id,p.priority,p.description]);
   return r.rows[0]?asCase(r.rows[0]):null;
  });
 }
 async createExternal(ctx:SupportContext,input:unknown){
  const p=externalRequest(input),caseId=randomUUID();
  if(!validUuid(this.settings().whatsappAccountId))throw new AccessDeniedError();
  return this.run(ctx,"external","write",async(db,config)=>{
   if(!validUuid(config.whatsappAccountId))throw new AccessDeniedError();
   const r=await db.query(`
    WITH eligible AS (
     SELECT c.tenant_id,c.crm_person_id
     FROM inbox_conversations c
     JOIN whatsapp_conversation_routes route
       ON route.tenant_id=c.tenant_id AND route.conversation_id=c.id
     JOIN whatsapp_accounts account
       ON account.tenant_id=route.tenant_id AND account.id=route.account_id
     JOIN crm_people p ON p.tenant_id=c.tenant_id AND p.id=c.crm_person_id
     WHERE c.tenant_id=$1::uuid AND c.id=$2::uuid AND c.channel='whatsapp'
       AND account.id=$3::uuid AND account.service_enabled=true
       AND c.platform_organization_id IS NOT NULL
       AND c.platform_current_workspace_id IS NOT NULL
       AND account.platform_organization_id=c.platform_organization_id
       AND p.platform_organization_id=c.platform_organization_id
       AND p.archived_at IS NULL
       AND EXISTS (SELECT 1 FROM platform_workspace_memberships wm
         WHERE wm.tenant_id=c.tenant_id
           AND wm.organization_id=c.platform_organization_id
           AND wm.workspace_id=c.platform_current_workspace_id
           AND wm.principal_id=$4 AND wm.state='active'
           AND wm.role IN ('admin','editor'))
       AND EXISTS (SELECT 1 FROM support_queue_memberships m
         WHERE m.tenant_id=c.tenant_id AND m.queue_code='external_general'
           AND m.principal_id=$4)
    ), created AS (
      INSERT INTO support_cases(tenant_id,id,kind,channel,requester_id,
         crm_person_id,inbox_conversation_id,queue_code,priority,status)
      SELECT e.tenant_id,$5::uuid,'external','whatsapp',e.crm_person_id::text,
         e.crm_person_id,$2::uuid,'external_general',$6,'new'
      FROM eligible e
      RETURNING *
    ), audit AS (
      INSERT INTO support_case_events(tenant_id,case_id,actor_id,action,next_status)
      SELECT tenant_id,id,$4,'created','new' FROM created RETURNING case_id
    )
    SELECT c.* FROM created c JOIN audit a ON a.case_id=c.id
   `,[ctx.tenantId,p.conversationId,config.whatsappAccountId,ctx.actor.id,caseId,p.priority]);
   return r.rows[0]?asCase(r.rows[0]):null;
  },[{resource:"inbox:conversations",action:"read"},{resource:"crm:people",action:"read"}]);
 }
 async list(ctx:SupportContext,kindValue:unknown,filters:Record<string,unknown>={}){
  const kind=validateKind(kindValue),p=parseList(kind,filters);
  return this.run(ctx,kind,"read",async db=>{
   const r=await db.query(`
     SELECT c.*,EXISTS(SELECT 1 FROM support_queue_memberships permission
       WHERE permission.tenant_id=c.tenant_id AND permission.queue_code=c.queue_code
         AND permission.principal_id=$3) AS can_operate
     FROM support_cases c
     WHERE c.tenant_id=$1::uuid AND c.kind=$2
       AND ($4::text IS NULL OR c.queue_code=$4)
       AND ($5::text IS NULL OR c.priority=$5)
       AND ($6::text IS NULL OR c.status=$6)
       AND ($7::text IS NULL OR c.assigned_to=$7)
       AND (
         (c.kind='internal' AND c.requester_id=$3)
         OR EXISTS (SELECT 1 FROM support_queue_memberships m
          WHERE m.tenant_id=c.tenant_id AND m.queue_code=c.queue_code
            AND m.principal_id=$3)
       )
     ORDER BY c.updated_at DESC,c.id DESC LIMIT $8 OFFSET $9
   `,[ctx.tenantId,kind,ctx.actor.id,p.queue??null,p.priority??null,p.status??null,
       p.assigneeId??null,p.limit,p.offset]);
   return r.rows.map(asCase);
  });
 }
 async get(ctx:SupportContext,kindValue:unknown,caseId:unknown){
  const kind=validateKind(kindValue),id=requireUuid(caseId,"case");
  return this.run(ctx,kind,"read",async db=>{
   const r=await db.query(`
     SELECT c.*,EXISTS(SELECT 1 FROM support_queue_memberships permission
       WHERE permission.tenant_id=c.tenant_id AND permission.queue_code=c.queue_code
         AND permission.principal_id=$4) AS can_operate
     FROM support_cases c
     WHERE c.tenant_id=$1::uuid AND c.kind=$2 AND c.id=$3::uuid
       AND ((c.kind='internal' AND c.requester_id=$4)
         OR EXISTS(SELECT 1 FROM support_queue_memberships m
           WHERE m.tenant_id=c.tenant_id AND m.queue_code=c.queue_code AND m.principal_id=$4))
   `,[ctx.tenantId,kind,id,ctx.actor.id]);
   return r.rows[0]?asCase(r.rows[0]):null;
  });
 }
 async history(ctx:SupportContext,kindValue:unknown,caseId:unknown){
  const kind=validateKind(kindValue),id=requireUuid(caseId,"case");
  return this.run(ctx,kind,"read",async db=>{
   const r=await db.query(`
    SELECT e.* FROM support_case_events e
    JOIN support_cases c ON c.tenant_id=e.tenant_id AND c.id=e.case_id
    WHERE e.tenant_id=$1::uuid AND c.kind=$2 AND e.case_id=$3::uuid
      AND (
        EXISTS (SELECT 1 FROM support_queue_memberships m
         WHERE m.tenant_id=c.tenant_id AND m.queue_code=c.queue_code AND m.principal_id=$4)
        OR (c.kind='internal' AND c.requester_id=$4 AND e.action<>'internal_note')
      )
    ORDER BY e.id DESC LIMIT 100
   `,[ctx.tenantId,kind,id,ctx.actor.id]);
   return r.rows.map(asEvent);
  });
 }
 async status(ctx:SupportContext,kindValue:unknown,caseId:unknown,input:unknown){
  const kind=validateKind(kindValue),id=requireUuid(caseId,"case"),next=stateRequest(input);
  const previous=allowedPreviousStates(next);
  if(previous.length===0)throw new SupportInputError("Invalid state transition");
  return this.run(ctx,kind,"write",async db=>{
   const r=await db.query(`
     WITH permitted AS MATERIALIZED (
      SELECT c.id,c.status FROM support_cases c
      WHERE c.tenant_id=$1::uuid AND c.kind=$2 AND c.id=$3::uuid
        AND EXISTS (SELECT 1 FROM support_queue_memberships m
          WHERE m.tenant_id=c.tenant_id AND m.queue_code=c.queue_code AND m.principal_id=$4)
      FOR UPDATE
     ), changed AS (
      UPDATE support_cases c SET status=$5::text,
       updated_at=clock_timestamp(),
       resolved_at=CASE WHEN $5::text='resolved' THEN clock_timestamp()
         WHEN $5::text='triage' THEN NULL ELSE c.resolved_at END,
       closed_at=CASE WHEN $5::text='closed' THEN clock_timestamp()
         WHEN $5::text='triage' THEN NULL ELSE c.closed_at END
      FROM permitted p WHERE c.tenant_id=$1::uuid AND c.id=p.id
        AND c.status=p.status AND p.status=ANY($6::text[])
      RETURNING c.*
     ), audit AS (
      INSERT INTO support_case_events(tenant_id,case_id,actor_id,action,previous_status,next_status)
      SELECT c.tenant_id,c.id,$4,'status_changed',p.status,$5::text
      FROM changed c JOIN permitted p ON p.id=c.id RETURNING case_id
     )
     SELECT c.* FROM changed c JOIN audit a ON a.case_id=c.id
   `,[ctx.tenantId,kind,id,ctx.actor.id,next,previous]);
   return r.rows[0]?asCase(r.rows[0]):null;
  });
 }
 async assign(ctx:SupportContext,kindValue:unknown,caseId:unknown,input:unknown){
  const kind=validateKind(kindValue),id=requireUuid(caseId,"case"),assignee=assignmentRequest(input);
  return this.run(ctx,kind,"write",async db=>{
   const r=await db.query(`
    WITH eligible AS MATERIALIZED (
     SELECT c.id FROM support_cases c
     WHERE c.tenant_id=$1::uuid AND c.kind=$2 AND c.id=$3::uuid
       AND c.status NOT IN ('resolved','closed')
       AND EXISTS (SELECT 1 FROM support_queue_memberships actor_member
          WHERE actor_member.tenant_id=c.tenant_id
            AND actor_member.queue_code=c.queue_code AND actor_member.principal_id=$4)
       AND EXISTS (SELECT 1 FROM support_queue_memberships assignee_member
          WHERE assignee_member.tenant_id=c.tenant_id
            AND assignee_member.queue_code=c.queue_code AND assignee_member.principal_id=$5)
     FOR UPDATE
    ), changed AS (
     UPDATE support_cases c SET assigned_to=$5,updated_at=clock_timestamp()
     FROM eligible e WHERE c.tenant_id=$1::uuid AND c.id=e.id RETURNING c.*
    ), audit AS (
     INSERT INTO support_case_events(tenant_id,case_id,actor_id,action,body)
     SELECT tenant_id,id,$4,'assigned',$5 FROM changed RETURNING case_id
    )
    SELECT c.* FROM changed c JOIN audit a ON a.case_id=c.id
   `,[ctx.tenantId,kind,id,ctx.actor.id,assignee]);
   return r.rows[0]?asCase(r.rows[0]):null;
  });
 }
 async transferQueue(ctx:SupportContext,kindValue:unknown,caseId:unknown,input:unknown){
  const kind=validateKind(kindValue),id=requireUuid(caseId,"case"),queue=queueRequest(kind,input);
  return this.run(ctx,kind,"write",async db=>{
   const r=await db.query(`
    WITH eligible AS MATERIALIZED (
     SELECT c.id FROM support_cases c
     WHERE c.tenant_id=$1::uuid AND c.kind=$2 AND c.id=$3::uuid
       AND c.queue_code<>$5 AND c.status NOT IN ('resolved','closed')
       AND EXISTS (SELECT 1 FROM support_queue_memberships m
         WHERE m.tenant_id=c.tenant_id AND m.queue_code=c.queue_code AND m.principal_id=$4)
       AND EXISTS (SELECT 1 FROM support_queue_memberships target
         WHERE target.tenant_id=c.tenant_id AND target.queue_code=$5 AND target.principal_id=$4)
     FOR UPDATE
    ), changed AS (
     UPDATE support_cases c SET queue_code=$5,assigned_to=NULL,updated_at=clock_timestamp()
     FROM eligible e WHERE c.tenant_id=$1::uuid AND c.id=e.id RETURNING c.*
    ), audit AS (
     INSERT INTO support_case_events(tenant_id,case_id,actor_id,action,body)
     SELECT tenant_id,id,$4,'queue_transferred',$5 FROM changed RETURNING case_id
    )
    SELECT c.* FROM changed c JOIN audit a ON a.case_id=c.id
   `,[ctx.tenantId,kind,id,ctx.actor.id,queue]);
   return r.rows[0]?asCase(r.rows[0]):null;
  });
 }
 async note(ctx:SupportContext,kindValue:unknown,caseId:unknown,input:unknown){
  const kind=validateKind(kindValue),id=requireUuid(caseId,"case"),body=noteRequest(input);
  return this.run(ctx,kind,"write",async db=>{
   const r=await db.query(`
    WITH eligible AS MATERIALIZED (
     SELECT c.tenant_id,c.id FROM support_cases c
     WHERE c.tenant_id=$1::uuid AND c.kind=$2 AND c.id=$3::uuid
       AND EXISTS(SELECT 1 FROM support_queue_memberships m
         WHERE m.tenant_id=c.tenant_id AND m.queue_code=c.queue_code AND m.principal_id=$4)
     FOR UPDATE
    ), audit AS (
     INSERT INTO support_case_events(tenant_id,case_id,actor_id,action,body)
     SELECT tenant_id,id,$4,'internal_note',$5 FROM eligible RETURNING *
    )
    SELECT * FROM audit
   `,[ctx.tenantId,kind,id,ctx.actor.id,body]);
   return r.rows[0]?asEvent(r.rows[0]):null;
  });
 }
}
