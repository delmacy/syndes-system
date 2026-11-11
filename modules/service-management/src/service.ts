import {randomUUID} from "node:crypto";
import {
 AccessDeniedError,type Actor,type CoreKernel,type TenantTransaction,
 type TrustedTenantTransactionProvider,
} from "@syndes/core-kernel";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE=/^[a-z][a-z0-9_-]{1,47}$/;
const REQUEST_KEY=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;
const uid=(v:unknown):v is string=>typeof v==="string"&&UUID.test(v);
const good=(v:unknown,max=160)=>typeof v==="string"&&v.trim().length>=2&&v.trim().length<=max;
const val=(v:unknown):string=>String(v??"");
export class ServiceFunnelInputError extends Error{
 constructor(message:string){super(message);this.name="ServiceFunnelInputError";}
}
export class ServiceFunnelConflictError extends Error{
 constructor(){super("Attendance not found or changed concurrently");this.name="ServiceFunnelConflictError";}
}
export type FunnelContext=Readonly<{
 tenantId:string;organizationId:string;workspaceId:string;actor:Actor;
}>;
export type FunnelStage=Readonly<{code:string;label:string}>;
const definition=Object.freeze({id:"service-management",version:"0.2.0",
 dependencies:["platform","organizations","crm","inbox"]});

function validateContext(ctx:FunnelContext):void{
 if(!ctx||!uid(ctx.tenantId)||!uid(ctx.organizationId)||!uid(ctx.workspaceId)||
  ctx.actor?.kind!=="user"||typeof ctx.actor.id!=="string"||
  !ctx.actor.id.trim()||ctx.actor.id.length>256)
  throw new AccessDeniedError();
}
function requireVersion(version:unknown):number{
 if(!Number.isSafeInteger(version)||Number(version)<1)
  throw new ServiceFunnelInputError("Expected positive attendance version");
 return version as number;
}
function guardStages(stages:unknown):asserts stages is FunnelStage[]{
 if(!Array.isArray(stages)||stages.length<2||stages.length>8||
  !stages.every(s=>s&&typeof s.code==="string"&&CODE.test(s.code)&&good(s.label,120))||
  new Set(stages.map(s=>s.code)).size!==stages.length)
  throw new ServiceFunnelInputError("Two to eight distinct named stages required");
}
const asAttendance=(r:Record<string,unknown>)=>({
 id:val(r.id),protocol:"ATD-"+val(r.protocol).padStart(9,"0"),
 funnelId:val(r.funnel_id),stageId:val(r.stage_id),
 conversationId:r.inbox_conversation_id==null?null:val(r.inbox_conversation_id),
 assignedTo:r.assigned_to==null?null:val(r.assigned_to),
 teamId:r.team_id==null?null:val(r.team_id),
 state:val(r.state),result:r.result==null?null:val(r.result),
 version:Number(r.version),
});
/** Construction does not mount HTTP routes, create grants, run migrations or
 * activate the module. Only a trusted Host may provide kernel and pinned PG. */
export class ServiceFunnelService{
 constructor(private readonly kernel:CoreKernel,
  private readonly tenants:TrustedTenantTransactionProvider){}

 private async run<T>(ctx:FunnelContext,resource:"service-management:funnels"|"service-management:attendances"|"service-management:teams",
  action:"read"|"write",permission:"admin"|"editor"|"viewer",
  work:(tx:TenantTransaction)=>Promise<T>):Promise<T>{
  validateContext(ctx);
  // The module Control Plane admission runs *after* tenant/FGA and before
  // resolving a tenant DB. A missing ENABLED gate is never a legacy fallback.
  return this.kernel.executeModule({actor:ctx.actor,tenantId:ctx.tenantId,
    moduleId:"service-management",resource,action},
   ()=>this.tenants.withTransaction(ctx.tenantId,async tx=>{
    if(tx.tenantId!==ctx.tenantId)throw new AccessDeniedError();
    const allowed=await tx.query(`
     SELECT 1 FROM platform_workspaces w
     JOIN platform_organizations o ON o.tenant_id=w.tenant_id
      AND o.id=w.organization_id AND o.status='active'
     JOIN platform_org_memberships om ON om.tenant_id=w.tenant_id
      AND om.organization_id=w.organization_id AND om.principal_id=$4
     JOIN platform_workspace_memberships wm ON wm.tenant_id=w.tenant_id
      AND wm.organization_id=w.organization_id AND wm.workspace_id=w.id
      AND wm.principal_id=$4
     WHERE w.tenant_id=$1::uuid AND w.organization_id=$2::uuid
      AND w.id=$3::uuid AND w.status='active'
      AND om.state='active' AND wm.state='active'
      AND ($5='viewer' OR
       ($5='editor' AND om.role IN ('admin','editor') AND wm.role IN ('admin','editor'))
       OR ($5='admin' AND om.role='admin' AND wm.role='admin'))
     LIMIT 1
    `,[ctx.tenantId,ctx.organizationId,ctx.workspaceId,ctx.actor.id,permission]);
    if(allowed.rows.length!==1)throw new AccessDeniedError();
    // Only set the trusted actor within the pinned transaction; SQL triggers
    // require this for every attendance mutation. No frontend-set session var.
    if(action==="write")
     await tx.query("SELECT set_config('syndes.service_actor_id',$1,true)",[ctx.actor.id]);
    return work(tx);
   }));
 }

 /** Published funnel definitions are shared read-only inside the selected scope.
  * No drafts or customer messages are ever exposed by this endpoint. */
 async listFunnels(ctx:FunnelContext){
  return this.run(ctx,"service-management:funnels","read","viewer",async tx=>{
   const rows=await tx.query(`
    SELECT f.id::text, f.code,f.name,f.state,f.revision,
      COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'code',s.code,
       'label',s.label,'position',s.position,'terminal',s.terminal)
       ORDER BY s.position) FILTER(WHERE s.id IS NOT NULL),'[]'::jsonb) AS stages
    FROM service_funnels f
    LEFT JOIN service_funnel_stages s ON s.tenant_id=f.tenant_id
      AND s.organization_id=f.organization_id AND s.workspace_id=f.workspace_id
      AND s.funnel_id=f.id
    WHERE f.tenant_id=$1::uuid AND f.organization_id=$2::uuid
      AND f.workspace_id=$3::uuid AND f.state='published'
    GROUP BY f.tenant_id,f.organization_id,f.workspace_id,f.id
    ORDER BY f.name,f.id LIMIT 50
   `,[ctx.tenantId,ctx.organizationId,ctx.workspaceId]);
   return rows.rows.map(r=>({id:String(r.id),code:String(r.code),name:String(r.name),
    revision:Number(r.revision),stages:r.stages}));
  });
 }

 async get(ctx:FunnelContext,attendanceId:string){
  if(!uid(attendanceId))throw new ServiceFunnelInputError("Invalid attendance");
  return this.run(ctx,"service-management:attendances","read","viewer",async tx=>{
   const r=await tx.query(`SELECT * FROM service_attendances
    WHERE tenant_id=$1::uuid AND organization_id=$2::uuid
      AND workspace_id=$3::uuid AND id=$4::uuid
      AND service_team_can_read(tenant_id,organization_id,workspace_id,team_id,$5)
    LIMIT 1`,
    [ctx.tenantId,ctx.organizationId,ctx.workspaceId,attendanceId,ctx.actor.id]);
   return r.rows[0]?asAttendance(r.rows[0]):null;
  });
 }

 async publishSimpleFunnel(ctx:FunnelContext,input:Readonly<{
  code:string;name:string;stages:readonly FunnelStage[];
 }>){
  if(!input||typeof input.code!=="string"||!CODE.test(input.code)||!good(input.name))
   throw new ServiceFunnelInputError("Invalid funnel definition");
  guardStages(input.stages);
  return this.run(ctx,"service-management:funnels","write","admin",async tx=>{
   const id=randomUUID(),scope=[ctx.tenantId,ctx.organizationId,ctx.workspaceId];
   const created=await tx.query(`
    INSERT INTO service_funnels(tenant_id,organization_id,workspace_id,
     id,code,name,created_by)
    VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7)
    RETURNING id::text
   `,[...scope,id,input.code,input.name.trim(),ctx.actor.id]);
   if(created.rows.length!==1)throw new ServiceFunnelConflictError();
   for(let i=0;i<input.stages.length;i++){
    const stage=input.stages[i];
    await tx.query(`
     INSERT INTO service_funnel_stages(tenant_id,organization_id,workspace_id,
      funnel_id,id,code,label,position,terminal)
     VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9)
    `,[...scope,id,randomUUID(),stage.code,stage.label.trim(),i+1,
       i===input.stages.length-1]);
   }
   const published=await tx.query(`
    UPDATE service_funnels SET state='published',published_at=clock_timestamp()
    WHERE tenant_id=$1::uuid AND organization_id=$2::uuid
     AND workspace_id=$3::uuid AND id=$4::uuid AND state='draft'
    RETURNING id::text,code,name,state,revision
   `,[...scope,id]);
   if(published.rows.length!==1)throw new ServiceFunnelConflictError();
   return {id,code:input.code,name:input.name.trim(),state:"published",revision:1};
  });
 }

 async open(ctx:FunnelContext,input:Readonly<{
  funnelId:string;conversationId?:string|null;idempotencyKey:string;
 }>){
  if(!uid(input?.funnelId)||typeof input.idempotencyKey!=="string"||
   !REQUEST_KEY.test(input.idempotencyKey)||(
   input.conversationId!=null&&!uid(input.conversationId)))
   throw new ServiceFunnelInputError("Invalid funnel/conversation/idempotency reference");
  return this.run(ctx,"service-management:attendances","write","editor",async tx=>{
   const id=randomUUID(),scope=[ctx.tenantId,ctx.organizationId,ctx.workspaceId];
   const r=await tx.query(`
    INSERT INTO service_attendances(tenant_id,organization_id,workspace_id,
     id,funnel_id,stage_id,inbox_conversation_id,created_by,request_key)
    SELECT f.tenant_id,f.organization_id,f.workspace_id,$4::uuid,f.id,s.id,
       $6::uuid,$7,$8 FROM service_funnels f JOIN service_funnel_stages s
      ON s.tenant_id=f.tenant_id AND s.organization_id=f.organization_id
       AND s.workspace_id=f.workspace_id AND s.funnel_id=f.id AND s.position=1
    WHERE f.tenant_id=$1::uuid AND f.organization_id=$2::uuid
     AND f.workspace_id=$3::uuid AND f.id=$5::uuid AND f.state='published'
     AND ($6::uuid IS NULL OR EXISTS(
      SELECT 1 FROM inbox_conversations c
      WHERE c.tenant_id=f.tenant_id AND c.id=$6::uuid
       AND c.platform_organization_id=f.organization_id
       AND c.platform_current_workspace_id=f.workspace_id))
    ON CONFLICT(tenant_id,organization_id,workspace_id,request_key) DO NOTHING
    RETURNING *
   `,[...scope,id,input.funnelId,input.conversationId??null,ctx.actor.id,input.idempotencyKey]);
   if(r.rows.length===1)return asAttendance(r.rows[0]);
   // A network retry gets the same protocol; changing the payload/actor under
   // an existing key is a conflict and never alters the previous attendance.
   const prior=await tx.query(`
    SELECT * FROM service_attendances WHERE tenant_id=$1::uuid
      AND organization_id=$2::uuid AND workspace_id=$3::uuid
      AND request_key=$4 AND funnel_id=$5::uuid
      AND inbox_conversation_id IS NOT DISTINCT FROM $6::uuid
      AND created_by=$7
   `,[...scope,input.idempotencyKey,input.funnelId,
     input.conversationId??null,ctx.actor.id]);
   if(prior.rows.length!==1)throw new ServiceFunnelConflictError();
   return asAttendance(prior.rows[0]);
  });
 }

 async advance(ctx:FunnelContext,input:Readonly<{
  attendanceId:string;nextStageId:string;expectedVersion:number;
 }>){
  if(!uid(input?.attendanceId)||!uid(input.nextStageId))
   throw new ServiceFunnelInputError("Invalid stage reference");
  requireVersion(input.expectedVersion);
  return this.run(ctx,"service-management:attendances","write","editor",async tx=>{
   const r=await tx.query(`
    UPDATE service_attendances a
    SET stage_id=s.id,version=a.version+1,updated_at=clock_timestamp()
    FROM service_funnel_stages current,service_funnel_stages s
    WHERE a.tenant_id=$1::uuid AND a.organization_id=$2::uuid
     AND a.workspace_id=$3::uuid AND a.id=$4::uuid AND a.state='open'
     AND a.version=$5
     AND service_team_can_read(a.tenant_id,a.organization_id,a.workspace_id,a.team_id,$7)
     AND current.tenant_id=a.tenant_id AND current.organization_id=a.organization_id
     AND current.workspace_id=a.workspace_id AND current.funnel_id=a.funnel_id
     AND current.id=a.stage_id
     AND s.tenant_id=a.tenant_id AND s.organization_id=a.organization_id
     AND s.workspace_id=a.workspace_id AND s.funnel_id=a.funnel_id
     AND s.id=$6::uuid AND abs(s.position-current.position)=1
    RETURNING a.*
   `,[ctx.tenantId,ctx.organizationId,ctx.workspaceId,input.attendanceId,
       input.expectedVersion,input.nextStageId,ctx.actor.id]);
   if(r.rows.length!==1)throw new ServiceFunnelConflictError();
   return asAttendance(r.rows[0]);
  });
 }

 async assign(ctx:FunnelContext,input:Readonly<{
  attendanceId:string;assigneeId:string;expectedVersion:number;
 }>){
  if(!uid(input?.attendanceId)||typeof input.assigneeId!=="string"||
   !input.assigneeId.trim()||input.assigneeId.length>256)
   throw new ServiceFunnelInputError("Invalid assignee");
  requireVersion(input.expectedVersion);
  return this.run(ctx,"service-management:attendances","write","editor",async tx=>{
   const r=await tx.query(`
    UPDATE service_attendances a
    SET assigned_to=$6,version=a.version+1,updated_at=clock_timestamp()
    WHERE a.tenant_id=$1::uuid AND a.organization_id=$2::uuid
     AND a.workspace_id=$3::uuid AND a.id=$4::uuid
     AND a.version=$5 AND a.state='open'
     AND a.assigned_to IS DISTINCT FROM $6
     AND service_team_can_read(a.tenant_id,a.organization_id,a.workspace_id,a.team_id,$7)
     AND (a.team_id IS NULL OR service_team_can_read(a.tenant_id,
       a.organization_id,a.workspace_id,a.team_id,$6))
     AND EXISTS(
      SELECT 1 FROM platform_workspace_memberships wm
      JOIN platform_org_memberships om
       ON om.tenant_id=wm.tenant_id AND om.organization_id=wm.organization_id
        AND om.principal_id=wm.principal_id
      WHERE wm.tenant_id=a.tenant_id AND wm.organization_id=a.organization_id
       AND wm.workspace_id=a.workspace_id AND wm.principal_id=$6
       AND wm.state='active' AND om.state='active'
       AND wm.role IN ('admin','editor') AND om.role IN ('admin','editor'))
    RETURNING *
   `,[ctx.tenantId,ctx.organizationId,ctx.workspaceId,input.attendanceId,
       input.expectedVersion,input.assigneeId,ctx.actor.id]);
   if(r.rows.length!==1)throw new ServiceFunnelConflictError();
   return asAttendance(r.rows[0]);
  });
 }

 async close(ctx:FunnelContext,input:Readonly<{
  attendanceId:string;expectedVersion:number;result:string;
 }>){
  if(!uid(input?.attendanceId)||!good(input.result,240))
   throw new ServiceFunnelInputError("Invalid close result");
  requireVersion(input.expectedVersion);
  return this.run(ctx,"service-management:attendances","write","editor",async tx=>{
   const r=await tx.query(`
    UPDATE service_attendances a
    SET state='closed',result=$6,closed_at=clock_timestamp(),
      version=a.version+1,updated_at=clock_timestamp()
    WHERE a.tenant_id=$1::uuid AND a.organization_id=$2::uuid
     AND a.workspace_id=$3::uuid AND a.id=$4::uuid
     AND a.version=$5 AND a.state='open'
     AND service_team_can_read(a.tenant_id,a.organization_id,a.workspace_id,a.team_id,$7)
     AND EXISTS(SELECT 1 FROM service_funnel_stages s
      WHERE s.tenant_id=a.tenant_id AND s.organization_id=a.organization_id
       AND s.workspace_id=a.workspace_id AND s.funnel_id=a.funnel_id
       AND s.id=a.stage_id AND s.terminal)
    RETURNING *
   `,[ctx.tenantId,ctx.organizationId,ctx.workspaceId,input.attendanceId,
       input.expectedVersion,input.result.trim(),ctx.actor.id]);
   if(r.rows.length!==1)throw new ServiceFunnelConflictError();
   return asAttendance(r.rows[0]);
  });
 }

 /** Teams are owned by Organizations/Workforce. This read-only projection
  * exposes only staffed teams in the caller's workspace, never creates roles. */
 async listTeams(ctx:FunnelContext){
  return this.run(ctx,"service-management:teams","read","viewer",async tx=>{
   const r=await tx.query(`
    SELECT t.id::text,t.name FROM platform_staff_teams t
    JOIN platform_staff_team_workspaces tw ON tw.tenant_id=t.tenant_id
      AND tw.organization_id=t.organization_id AND tw.team_id=t.id
    WHERE t.tenant_id=$1::uuid AND t.organization_id=$2::uuid
     AND tw.workspace_id=$3::uuid AND t.state='active'
     AND service_team_is_staffed(t.tenant_id,t.organization_id,tw.workspace_id,t.id)
     AND service_team_can_read(t.tenant_id,t.organization_id,tw.workspace_id,t.id,$4)
    ORDER BY t.name,t.id LIMIT 50
   `,[ctx.tenantId,ctx.organizationId,ctx.workspaceId,ctx.actor.id]);
   return r.rows.map(x=>({id:val(x.id),name:val(x.name)}));
  });
 }

 /** Transfer requires both FGA grants, active workspace admin and active
  * Workforce supervisor status. It changes only team/assignment/version,
  * never the Inbox conversation and never any FGA membership or grant. */
 async transferTeam(ctx:FunnelContext,input:Readonly<{
  attendanceId:string;destinationTeamId:string;expectedVersion:number;reason:string;
 }>){
  if(!uid(input?.attendanceId)||!uid(input.destinationTeamId)||
      !good(input.reason,240)||input.reason.trim().length<4)
   throw new ServiceFunnelInputError("Invalid destination or transfer reason");
  requireVersion(input.expectedVersion);
  const destinationTeamId=input.destinationTeamId.toLowerCase();
  validateContext(ctx);
  // Team-level OpenFGA is in addition to the module permission and
  // Workforce supervisor designation. Grants must be provisioned explicitly.
  // Read old ownership under the same scoped/authorized tenant provider; CAS
  // in the final write rejects changes racing this pre-authorization.
  const current=await this.run(ctx,"service-management:attendances","write","admin",async tx=>{
   const r=await tx.query(`SELECT a.team_id::text AS team_id
    FROM service_attendances a
    WHERE a.tenant_id=$1::uuid AND a.organization_id=$2::uuid
     AND a.workspace_id=$3::uuid AND a.id=$4::uuid
     AND a.version=$5 AND a.state='open'
     AND service_team_can_read(a.tenant_id,a.organization_id,a.workspace_id,a.team_id,$6)
    LIMIT 1`,[ctx.tenantId,ctx.organizationId,ctx.workspaceId,
     input.attendanceId,input.expectedVersion,ctx.actor.id]);
   return r.rows[0]?r.rows[0].team_id as string|null:undefined;
  });
  if(current===undefined||current===destinationTeamId)
   throw new ServiceFunnelConflictError();
  const teamResources=[...(current?[current]:[]),destinationTeamId];
  for(const teamId of teamResources){
   await this.kernel.executeModule({actor:ctx.actor,tenantId:ctx.tenantId,
    moduleId:"service-management",resource:"service-management:team:"+teamId,
    action:"write"},async()=>{});
  }
  await this.kernel.executeModule({actor:ctx.actor,tenantId:ctx.tenantId,
   moduleId:"service-management",resource:"service-management:teams",action:"write"},
   async()=>{});
  return this.run(ctx,"service-management:attendances","write","admin",async tx=>{
   await tx.query("SELECT set_config('syndes.service_transfer_reason',$1,true)",
    [input.reason.trim()]);
   const r=await tx.query(`
    UPDATE service_attendances a
      SET team_id=$6::uuid,assigned_to=NULL,version=a.version+1,
        updated_at=clock_timestamp()
    WHERE a.tenant_id=$1::uuid AND a.organization_id=$2::uuid
      AND a.workspace_id=$3::uuid AND a.id=$4::uuid
      AND a.version=$5 AND a.state='open'
      AND a.team_id IS DISTINCT FROM $6::uuid
      AND service_team_is_supervisor(a.tenant_id,a.organization_id,a.workspace_id,$7)
      AND service_team_can_read(a.tenant_id,a.organization_id,a.workspace_id,a.team_id,$7)
      AND service_team_is_staffed(a.tenant_id,a.organization_id,a.workspace_id,$6::uuid)
    RETURNING *
   `,[ctx.tenantId,ctx.organizationId,ctx.workspaceId,input.attendanceId,
     input.expectedVersion,destinationTeamId,ctx.actor.id]);
   if(r.rows.length!==1)throw new ServiceFunnelConflictError();
   return asAttendance(r.rows[0]);
  });
 }

 async board(ctx:FunnelContext,funnelId:string){
  if(!uid(funnelId))throw new ServiceFunnelInputError("Invalid funnel");
  return this.run(ctx,"service-management:attendances","read","viewer",async tx=>{
   const r=await tx.query(`
    SELECT a.* FROM service_attendances a
    WHERE a.tenant_id=$1::uuid AND a.organization_id=$2::uuid
     AND a.workspace_id=$3::uuid AND a.funnel_id=$4::uuid
     AND a.state='open'
     AND service_team_can_read(a.tenant_id,a.organization_id,a.workspace_id,a.team_id,$5)
    ORDER BY a.updated_at DESC,a.id DESC LIMIT 100
   `,[ctx.tenantId,ctx.organizationId,ctx.workspaceId,funnelId,ctx.actor.id]);
   return r.rows.map(asAttendance);
  });
 }

 async history(ctx:FunnelContext,attendanceId:string){
  if(!uid(attendanceId))throw new ServiceFunnelInputError("Invalid attendance");
  return this.run(ctx,"service-management:attendances","read","viewer",async tx=>{
   const r=await tx.query(`
    SELECT e.* FROM service_attendance_events e
    JOIN service_attendances a ON a.tenant_id=e.tenant_id
      AND a.organization_id=e.organization_id AND a.workspace_id=e.workspace_id
      AND a.id=e.attendance_id
    WHERE e.tenant_id=$1::uuid AND e.organization_id=$2::uuid
     AND e.workspace_id=$3::uuid AND e.attendance_id=$4::uuid
     AND service_team_can_read(a.tenant_id,a.organization_id,a.workspace_id,a.team_id,$5)
    ORDER BY e.id ASC LIMIT 200
   `,[ctx.tenantId,ctx.organizationId,ctx.workspaceId,attendanceId,ctx.actor.id]);
   return r.rows.map(e=>({
    action:val(e.action),actorId:val(e.actor_id),version:Number(e.version),
    previousStageId:e.previous_stage_id==null?null:val(e.previous_stage_id),
    nextStageId:val(e.next_stage_id),
    previousAssignee:e.previous_assignee==null?null:val(e.previous_assignee),
    nextAssignee:e.next_assignee==null?null:val(e.next_assignee),
    result:e.result==null?null:val(e.result),
    previousTeamId:e.previous_team_id==null?null:val(e.previous_team_id),
    nextTeamId:e.next_team_id==null?null:val(e.next_team_id),
    transferReason:e.transfer_reason==null?null:val(e.transfer_reason),
   }));
  });
 }
}
export const serviceManagementModule=definition;
