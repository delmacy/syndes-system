import {randomUUID} from "node:crypto";
import {AccessDeniedError,type Actor,type CoreKernel,type TenantDatabase,
 type TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {OrgInputError,OrgTenantMismatchError,validUUID} from "./service.js";

export type StaffContext=Readonly<{tenantId:string;actor:Actor}>;
export type WorkspaceStaffRole="supervisor"|"agent"|"viewer";
export type TeamRole="lead"|"member";
const humanId=(value:unknown):value is string=>
 typeof value==="string"&&value.length>=1&&value.length<=256&&
 !/[\u0000-\u001f\u007f]/.test(value);

/** Tested, read-only domain output. NOT an authorization token or FGA grant. */
export type StaffProfile=Readonly<{
 employeeId:string;businessRole:WorkspaceStaffRole;organizationId:string;workspaceId:string;
}>;

/** Both required security gates must run before even resolving a tenant DB.
 * Every mutation also checks the actor's active org AND workspace admin
 * memberships inside the same SQL that performs its write. This service is
 * intentionally NOT mounted as a public HTTP controller until Product Gate.
 */
export class WorkforceService{
 constructor(private readonly kernel:CoreKernel,
  private readonly databases:TrustedTenantDatabaseProvider){}

 private run<T>(ctx:StaffContext,action:"read"|"write",
   execute:(db:TenantDatabase)=>Promise<T>):Promise<T>{
  if(!validUUID(ctx?.tenantId)||ctx.actor?.kind!=="user"||
     !humanId(ctx.actor.id))throw new OrgInputError("Invalid workforce actor");
  return this.kernel.execute({actor:ctx.actor,tenantId:ctx.tenantId,
   action,resource:"organizations:staff"},async()=>{
   const db=await this.databases.resolve(ctx.tenantId);
   if(db.tenantId!==ctx.tenantId)throw new OrgTenantMismatchError("Wrong tenant database");
   return execute(db);
  });
 }

 private scope(org:unknown,ws:unknown):asserts org is string{
  if(!validUUID(org)||!validUUID(ws))throw new OrgInputError("Invalid workforce scope");
 }

 /** No role is inferred from a team, title, platform_owner or stale employee.
  * To be eligible, active identity link and explicit workspace business role
  * must coexist with actual active org/workspace memberships and CRM owner.
  */
 myProfile(ctx:StaffContext,org:string,ws:string):Promise<StaffProfile|null>{
  this.scope(org,ws);
  return this.run(ctx,"read",async db=>{
   const r=await db.query(`
     SELECT l.employee_id AS "employeeId",
       wr.business_role AS "businessRole",
       wr.organization_id AS "organizationId",
       wr.workspace_id AS "workspaceId"
     FROM platform_staff_identity_links l
     JOIN crm_employees e ON e.tenant_id=l.tenant_id
       AND e.id=l.employee_id AND e.active=true
     JOIN crm_people p ON p.tenant_id=e.tenant_id AND p.id=e.person_id
       AND p.archived_at IS NULL AND p.platform_organization_id=l.organization_id
     JOIN platform_org_memberships om ON om.tenant_id=l.tenant_id
       AND om.organization_id=l.organization_id AND om.principal_id=l.principal_id
       AND om.state='active'
     JOIN platform_workspace_memberships wm ON wm.tenant_id=om.tenant_id
       AND wm.organization_id=om.organization_id AND wm.principal_id=om.principal_id
       AND wm.workspace_id=$3::uuid AND wm.state='active'
     JOIN platform_organizations o ON o.tenant_id=om.tenant_id AND o.id=om.organization_id
       AND o.status='active'
     JOIN platform_workspaces w ON w.tenant_id=wm.tenant_id
       AND w.organization_id=wm.organization_id AND w.id=wm.workspace_id
       AND w.status='active'
     JOIN platform_workspace_staff_roles wr ON wr.tenant_id=wm.tenant_id
       AND wr.organization_id=wm.organization_id AND wr.workspace_id=wm.workspace_id
       AND wr.principal_id=wm.principal_id AND wr.state='active'
     WHERE l.tenant_id=$1::uuid AND l.organization_id=$2::uuid
       AND l.principal_id=$4 AND l.state='active'
       AND (
         wr.business_role='viewer'
         OR (wr.business_role IN ('agent','supervisor')
             AND wm.role IN ('admin','editor'))
       )
     LIMIT 1`,[ctx.tenantId,org,ws,ctx.actor.id]);
   const row=r.rows[0];
   return row?{employeeId:String(row.employeeId),
    businessRole:row.businessRole as WorkspaceStaffRole,
    organizationId:String(row.organizationId),workspaceId:String(row.workspaceId)}:null;
  });
 }

 bindEmployee(ctx:StaffContext,org:string,ws:string,employeeId:string,
  principalId:string):Promise<boolean>{
  this.scope(org,ws);
  if(!validUUID(employeeId)||!humanId(principalId))
   throw new OrgInputError("Invalid employee identity link");
  const link=randomUUID();
  return this.run(ctx,"write",async db=>{
   const r=await db.query(`
    WITH allowed AS MATERIALIZED(
      SELECT o.tenant_id,o.id AS organization_id
      FROM platform_organizations o
      JOIN platform_org_memberships m ON m.tenant_id=o.tenant_id
       AND m.organization_id=o.id AND m.principal_id=$5
       AND m.state='active' AND m.role='admin'
      JOIN platform_workspaces w ON w.tenant_id=o.tenant_id
       AND w.organization_id=o.id AND w.id=$3::uuid AND w.status='active'
      JOIN platform_workspace_memberships wm ON wm.tenant_id=w.tenant_id
       AND wm.organization_id=w.organization_id AND wm.workspace_id=w.id
       AND wm.principal_id=$5 AND wm.state='active' AND wm.role='admin'
      WHERE o.tenant_id=$1::uuid AND o.id=$2::uuid AND o.status='active'
    ), target AS MATERIALIZED(
      SELECT m.principal_id,e.id AS employee_id
      FROM platform_org_memberships m
      JOIN platform_workspace_memberships wm ON wm.tenant_id=m.tenant_id
       AND wm.organization_id=m.organization_id AND wm.principal_id=m.principal_id
       AND wm.workspace_id=$3::uuid AND wm.state='active'
      JOIN crm_employees e ON e.tenant_id=m.tenant_id AND e.id=$4::uuid
       AND e.active=true
      JOIN crm_people p ON p.tenant_id=e.tenant_id AND p.id=e.person_id
       AND p.archived_at IS NULL AND p.platform_organization_id=m.organization_id
      WHERE m.tenant_id=$1::uuid AND m.organization_id=$2::uuid
       AND m.principal_id=$6 AND m.state='active'
    ), created AS(
      INSERT INTO platform_staff_identity_links(
       tenant_id,organization_id,id,employee_id,principal_id,bound_by
      )
      SELECT a.tenant_id,a.organization_id,$7::uuid,t.employee_id,t.principal_id,$5
      FROM allowed a CROSS JOIN target t
      RETURNING id
    ) SELECT id FROM created`,
    [ctx.tenantId,org,ws,employeeId,ctx.actor.id,principalId,link]);
   return r.rows.length===1;
  });
 }

 assignWorkspaceRole(ctx:StaffContext,org:string,ws:string,principalId:string,
  role:WorkspaceStaffRole):Promise<boolean>{
  this.scope(org,ws);
  if(!humanId(principalId)||!["supervisor","agent","viewer"].includes(role))
   throw new OrgInputError("Invalid staff role");
  return this.run(ctx,"write",async db=>{
   const r=await db.query(`
    WITH allowed AS MATERIALIZED(
      SELECT o.tenant_id,o.id AS organization_id,w.id AS workspace_id
      FROM platform_organizations o
      JOIN platform_org_memberships m ON m.tenant_id=o.tenant_id
       AND m.organization_id=o.id AND m.principal_id=$4
       AND m.state='active' AND m.role='admin'
      JOIN platform_workspaces w ON w.tenant_id=o.tenant_id
       AND w.organization_id=o.id AND w.id=$3::uuid AND w.status='active'
      JOIN platform_workspace_memberships wm ON wm.tenant_id=w.tenant_id
       AND wm.organization_id=w.organization_id AND wm.workspace_id=w.id
       AND wm.principal_id=$4 AND wm.state='active' AND wm.role='admin'
      WHERE o.tenant_id=$1::uuid AND o.id=$2::uuid AND o.status='active'
    ), target AS MATERIALIZED(
      SELECT wm.principal_id
      FROM platform_workspace_memberships wm
      JOIN platform_org_memberships om ON om.tenant_id=wm.tenant_id
       AND om.organization_id=wm.organization_id AND om.principal_id=wm.principal_id
       AND om.state='active'
      JOIN platform_staff_identity_links l ON l.tenant_id=om.tenant_id
       AND l.organization_id=om.organization_id AND l.principal_id=om.principal_id
       AND l.state='active'
      JOIN crm_employees e ON e.tenant_id=l.tenant_id AND e.id=l.employee_id
       AND e.active=true
      JOIN crm_people p ON p.tenant_id=e.tenant_id AND p.id=e.person_id
       AND p.archived_at IS NULL AND p.platform_organization_id=l.organization_id
      WHERE wm.tenant_id=$1::uuid AND wm.organization_id=$2::uuid
       AND wm.workspace_id=$3::uuid AND wm.principal_id=$5 AND wm.state='active'
       AND ($6='viewer' OR wm.role IN ('admin','editor'))
    ), assigned AS(
      INSERT INTO platform_workspace_staff_roles(
       tenant_id,organization_id,workspace_id,principal_id,business_role,
       assigned_by,changed_by
      )
      SELECT a.tenant_id,a.organization_id,a.workspace_id,t.principal_id,$6,$4,$4
      FROM allowed a CROSS JOIN target t
      ON CONFLICT(tenant_id,organization_id,workspace_id,principal_id)
      DO UPDATE SET business_role=EXCLUDED.business_role,state='active',
        changed_by=EXCLUDED.changed_by,changed_at=clock_timestamp()
      WHERE platform_workspace_staff_roles.business_role<>EXCLUDED.business_role
        OR platform_workspace_staff_roles.state<>'active'
      RETURNING principal_id
    ) SELECT principal_id FROM assigned`,
    [ctx.tenantId,org,ws,ctx.actor.id,principalId,role]);
   return r.rows.length===1;
  });
 }

 revokeWorkspaceRole(ctx:StaffContext,org:string,ws:string,
  principalId:string):Promise<boolean>{
  this.scope(org,ws);
  if(!humanId(principalId))throw new OrgInputError("Invalid principal");
  return this.run(ctx,"write",async db=>{
   const r=await db.query(`
    WITH allowed AS MATERIALIZED(
      SELECT 1 FROM platform_organizations o
      JOIN platform_org_memberships m ON m.tenant_id=o.tenant_id
       AND m.organization_id=o.id AND m.principal_id=$4
       AND m.role='admin' AND m.state='active'
      JOIN platform_workspace_memberships wm ON wm.tenant_id=o.tenant_id
       AND wm.organization_id=o.id AND wm.workspace_id=$3::uuid
       AND wm.principal_id=$4 AND wm.role='admin' AND wm.state='active'
      WHERE o.tenant_id=$1::uuid AND o.id=$2::uuid AND o.status='active'
    )
    UPDATE platform_workspace_staff_roles sr SET state='revoked',
      changed_by=$4,changed_at=clock_timestamp()
    WHERE sr.tenant_id=$1::uuid AND sr.organization_id=$2::uuid
      AND sr.workspace_id=$3::uuid AND sr.principal_id=$5
      AND sr.state='active' AND EXISTS(SELECT 1 FROM allowed)
    RETURNING sr.principal_id`,
    [ctx.tenantId,org,ws,ctx.actor.id,principalId]);
   return r.rows.length===1;
  });
 }

 createTeam(ctx:StaffContext,org:string,ws:string,name:string):Promise<string|null>{
  this.scope(org,ws);
  if(typeof name!=="string"||!name.trim()||name.trim().length>120||
    /[\u0000-\u001f\u007f]/.test(name))throw new OrgInputError("Invalid team name");
  const id=randomUUID();
  return this.run(ctx,"write",async db=>{
   const r=await db.query(`
     WITH allowed AS MATERIALIZED(
      SELECT o.tenant_id,o.id AS organization_id,w.id AS workspace_id
      FROM platform_organizations o
      JOIN platform_org_memberships m ON m.tenant_id=o.tenant_id
       AND m.organization_id=o.id AND m.principal_id=$4
       AND m.role='admin' AND m.state='active'
      JOIN platform_workspaces w ON w.tenant_id=o.tenant_id
       AND w.organization_id=o.id AND w.id=$3::uuid AND w.status='active'
      JOIN platform_workspace_memberships wm ON wm.tenant_id=w.tenant_id
       AND wm.organization_id=w.organization_id AND wm.workspace_id=w.id
       AND wm.principal_id=$4 AND wm.role='admin' AND wm.state='active'
      WHERE o.tenant_id=$1::uuid AND o.id=$2::uuid AND o.status='active'
     ), team AS(
      INSERT INTO platform_staff_teams(tenant_id,organization_id,id,name,created_by)
      SELECT a.tenant_id,a.organization_id,$5::uuid,$6,$4 FROM allowed a
      RETURNING tenant_id,organization_id,id
     ), linked AS(
      INSERT INTO platform_staff_team_workspaces(
       tenant_id,organization_id,team_id,workspace_id)
      SELECT t.tenant_id,t.organization_id,t.id,$3::uuid FROM team t
      RETURNING team_id
     ), audit AS(
      INSERT INTO platform_staff_access_audit(
       tenant_id,organization_id,actor_id,principal_id,event,resource_id)
      SELECT t.tenant_id,t.organization_id,$4,$4,'team_created',t.id
      FROM team t JOIN linked l ON l.team_id=t.id RETURNING resource_id
     )
     SELECT resource_id FROM audit`,[ctx.tenantId,org,ws,ctx.actor.id,id,name.trim()]);
   return r.rows[0]?String(r.rows[0].resource_id):null;
  });
 }

 addTeamMember(ctx:StaffContext,org:string,ws:string,team:string,
  principalId:string,teamRole:TeamRole):Promise<boolean>{
  this.scope(org,ws);
  if(!validUUID(team)||!humanId(principalId)||!["lead","member"].includes(teamRole))
   throw new OrgInputError("Invalid team assignment");
  return this.run(ctx,"write",async db=>{
   const r=await db.query(`
    WITH allowed AS MATERIALIZED(
      SELECT t.tenant_id,t.organization_id,t.id
      FROM platform_staff_teams t
      JOIN platform_staff_team_workspaces tw ON tw.tenant_id=t.tenant_id
       AND tw.organization_id=t.organization_id AND tw.team_id=t.id
       AND tw.workspace_id=$3::uuid
      JOIN platform_org_memberships am ON am.tenant_id=t.tenant_id
       AND am.organization_id=t.organization_id AND am.principal_id=$5
       AND am.state='active' AND am.role='admin'
      JOIN platform_workspace_memberships wm ON wm.tenant_id=t.tenant_id
       AND wm.organization_id=t.organization_id AND wm.workspace_id=$3::uuid
       AND wm.principal_id=$5 AND wm.state='active' AND wm.role='admin'
      WHERE t.tenant_id=$1::uuid AND t.organization_id=$2::uuid
       AND t.id=$4::uuid AND t.state='active'
    ), candidate AS MATERIALIZED(
      SELECT om.principal_id FROM platform_org_memberships om
      JOIN platform_workspace_memberships wm ON wm.tenant_id=om.tenant_id
       AND wm.organization_id=om.organization_id AND wm.principal_id=om.principal_id
       AND wm.workspace_id=$3::uuid AND wm.state='active'
      JOIN platform_workspace_staff_roles sr ON sr.tenant_id=wm.tenant_id
       AND sr.organization_id=wm.organization_id AND sr.workspace_id=wm.workspace_id
       AND sr.principal_id=wm.principal_id AND sr.state='active'
      JOIN platform_staff_identity_links l ON l.tenant_id=om.tenant_id
       AND l.organization_id=om.organization_id AND l.principal_id=om.principal_id
       AND l.state='active'
      JOIN crm_employees e ON e.tenant_id=l.tenant_id AND e.id=l.employee_id
       AND e.active=true
      JOIN crm_people p ON p.tenant_id=e.tenant_id AND p.id=e.person_id
       AND p.archived_at IS NULL AND p.platform_organization_id=om.organization_id
      WHERE om.tenant_id=$1::uuid AND om.organization_id=$2::uuid
        AND om.principal_id=$6 AND om.state='active'
    ), assigned AS(
      INSERT INTO platform_staff_team_members(
       tenant_id,organization_id,team_id,principal_id,team_role,assigned_by)
      SELECT a.tenant_id,a.organization_id,a.id,c.principal_id,$7,$5
      FROM allowed a CROSS JOIN candidate c
      ON CONFLICT (tenant_id,organization_id,team_id,principal_id)
      DO UPDATE SET team_role=EXCLUDED.team_role,state='active',
        assigned_by=EXCLUDED.assigned_by
      WHERE platform_staff_team_members.team_role<>EXCLUDED.team_role
        OR platform_staff_team_members.state<>'active'
      RETURNING tenant_id,organization_id,team_id,principal_id
    ), audit AS(
      INSERT INTO platform_staff_access_audit(
       tenant_id,organization_id,actor_id,principal_id,event,resource_id)
      SELECT tenant_id,organization_id,$5,principal_id,'team_member_assigned',team_id
      FROM assigned RETURNING resource_id
    ) SELECT resource_id FROM audit`,[ctx.tenantId,org,ws,team,ctx.actor.id,principalId,teamRole]);
   return r.rows.length===1;
  });
 }
}
