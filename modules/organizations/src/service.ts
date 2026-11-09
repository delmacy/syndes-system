import {randomUUID} from "node:crypto";
import type {Actor,CoreKernel,TenantDatabase,TrustedTenantDatabaseProvider} from "@syndes/core-kernel";

export type OrgContext=Readonly<{tenantId:string;actor:Actor}>;
export class OrgInputError extends Error{}
export class OrgTenantMismatchError extends Error{}
export const validUUID=(s:unknown):s is string=>
  typeof s==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const principal=(id:string)=>id.length>=1&&id.length<=256;
function unitName(input:unknown):{name:string;kind:"headquarters"|"branch"|"other"}{
  if(!input||typeof input!=="object"||Array.isArray(input))throw new OrgInputError("Invalid unit");
  const {name,kind} = input as {name?:unknown;kind?:unknown};
  if(typeof name!=="string"||!name.trim()||name.trim().length>160||/[\u0000-\u001f]/.test(name))
    throw new OrgInputError("Invalid unit name");
  if(kind!=="headquarters"&&kind!=="branch"&&kind!=="other")
    throw new OrgInputError("Invalid unit kind");
  return {name:name.trim(),kind};
}

export class OrganizationService{
  constructor(private readonly kernel:CoreKernel,
    private readonly databases:TrustedTenantDatabaseProvider){}
  private execute<T>(ctx:OrgContext,action:"read"|"write",resource:string,
      operation:(db:TenantDatabase)=>Promise<T>):Promise<T>{
    if(!validUUID(ctx?.tenantId)||!principal(ctx?.actor?.id??""))
      throw new OrgInputError("Invalid authenticated context");
    return this.kernel.execute({actor:ctx.actor,tenantId:ctx.tenantId,action,resource},
      async()=>{
        const db=await this.databases.resolve(ctx.tenantId);
        if(db.tenantId!==ctx.tenantId)throw new OrgTenantMismatchError("Database mismatch");
        return operation(db);
      });
  }
  /** Tenant admin only. CTEs guarantee first-writer ownership and no retry privilege escalation. */
  bootstrap(ctx:OrgContext):Promise<{initialized:boolean}>{
    const organizationId=randomUUID(),workspaceId=randomUUID();
    return this.execute(ctx,"write","organizations:bootstrap",async db=>{
      const result=await db.query(`
        WITH new_org AS (
          INSERT INTO platform_organizations(tenant_id,id,display_name,is_default)
          VALUES($1::uuid,$2::uuid,'Minha organização',true)
          ON CONFLICT DO NOTHING
          RETURNING tenant_id,id
        ), new_workspace AS (
          INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default)
          SELECT tenant_id,$3::uuid,id,'Principal','principal',true FROM new_org
          RETURNING tenant_id,id,organization_id
        ), org_grant AS (
          INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role)
          SELECT tenant_id,id,$4,'admin' FROM new_org RETURNING organization_id
        ), workspace_grant AS (
          INSERT INTO platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role)
          SELECT w.tenant_id,w.organization_id,w.id,$4,'admin'
          FROM new_workspace w JOIN org_grant g ON g.organization_id=w.organization_id
          RETURNING workspace_id
        ), audit AS (
          INSERT INTO platform_org_audit(tenant_id,organization_id,actor_id,event,entity_id)
          SELECT tenant_id,id,$4,'default_context_initialized',id FROM new_org
          RETURNING entity_id
        )
        SELECT o.id FROM new_org o
        JOIN new_workspace w ON w.organization_id=o.id
        JOIN org_grant g ON g.organization_id=o.id
        JOIN workspace_grant wg ON wg.workspace_id=w.id
        JOIN audit a ON a.entity_id=o.id`,
        [ctx.tenantId,organizationId,workspaceId,ctx.actor.id]);
      return {initialized:result.rows.length===1};
    });
  }
  /** Bind legacy CRM, Inbox and WhatsApp records to the verified default.
   *  A MATERIALIZED authorized row is the only input to the volatile function;
   *  a caller without active org AND workspace admin membership cannot invoke it.
   *  FGA 'organizations:bootstrap/write' and tenant membership run first. */
  backfillDefaultOwnership(ctx:OrgContext):Promise<readonly {entityType:string;updatedCount:number}[]|null>{
    return this.execute(ctx,"write","organizations:bootstrap",async db=>{
      const result=await db.query(`
        WITH allowed AS MATERIALIZED (
          SELECT o.tenant_id
          FROM platform_organizations o
          INNER JOIN platform_org_memberships m
            ON m.tenant_id=o.tenant_id AND m.organization_id=o.id
          INNER JOIN platform_workspaces w
            ON w.tenant_id=o.tenant_id AND w.organization_id=o.id
          INNER JOIN platform_workspace_memberships wm
            ON wm.tenant_id=w.tenant_id AND wm.organization_id=w.organization_id
               AND wm.workspace_id=w.id AND wm.principal_id=m.principal_id
          WHERE o.tenant_id=$1::uuid AND o.is_default AND o.status='active'
            AND w.is_default AND w.status='active'
            AND m.principal_id=$2 AND m.state='active' AND m.role='admin'
            AND wm.state='active' AND wm.role='admin'
          LIMIT 1
        )
        SELECT scope.entity_type,scope.updated_count
        FROM allowed a CROSS JOIN LATERAL
          platform_backfill_legacy_ownership(a.tenant_id) scope
      `,[ctx.tenantId,ctx.actor.id]);
      if(!result.rows.length)return null;
      return result.rows.map(row=>({
        entityType:String(row.entity_type),updatedCount:Number(row.updated_count),
      }));
    });
  }
  listOrganizations(ctx:OrgContext):Promise<readonly Record<string,unknown>[]>{
    return this.execute(ctx,"read","organizations:directory",async db=>{
      const r=await db.query(`
        SELECT o.id,o.display_name,o.is_default,o.status
        FROM platform_organizations o
        INNER JOIN platform_org_memberships m
          ON m.tenant_id=o.tenant_id AND m.organization_id=o.id
        WHERE o.tenant_id=$1::uuid AND m.principal_id=$2
          AND m.state='active' AND o.status='active'
        ORDER BY o.is_default DESC,o.display_name,o.id LIMIT 100`,
        [ctx.tenantId,ctx.actor.id]);
      return r.rows;
    });
  }
  listWorkspaces(ctx:OrgContext,organizationId:string):Promise<readonly Record<string,unknown>[]>{
    if(!validUUID(organizationId))throw new OrgInputError("Invalid organization");
    return this.execute(ctx,"read","organizations:directory",async db=>{
      const r=await db.query(`
        SELECT w.id,w.organization_id,w.name,w.slug,w.is_default,w.status
        FROM platform_workspaces w
        INNER JOIN platform_workspace_memberships m
          ON m.tenant_id=w.tenant_id AND m.organization_id=w.organization_id AND m.workspace_id=w.id
        INNER JOIN platform_org_memberships om
          ON om.tenant_id=w.tenant_id AND om.organization_id=w.organization_id
          AND om.principal_id=m.principal_id AND om.state='active'
        INNER JOIN platform_organizations o
          ON o.tenant_id=w.tenant_id AND o.id=w.organization_id
        WHERE w.tenant_id=$1::uuid AND w.organization_id=$2::uuid
          AND m.principal_id=$3 AND m.state='active'
          AND o.status='active' AND w.status='active'
        ORDER BY w.is_default DESC,w.name,w.id LIMIT 100`,
        [ctx.tenantId,organizationId,ctx.actor.id]);
      return r.rows;
    });
  }
  listUnits(ctx:OrgContext,organizationId:string):Promise<readonly Record<string,unknown>[]>{
    if(!validUUID(organizationId))throw new OrgInputError("Invalid organization");
    return this.execute(ctx,"read","organizations:units",async db=>{
      const r=await db.query(`
        SELECT u.id,u.organization_id,u.name,u.kind,u.status
        FROM platform_units u
        INNER JOIN platform_org_memberships m
          ON m.tenant_id=u.tenant_id AND m.organization_id=u.organization_id
        INNER JOIN platform_organizations o ON o.tenant_id=u.tenant_id AND o.id=u.organization_id
        WHERE u.tenant_id=$1::uuid AND u.organization_id=$2::uuid
          AND m.principal_id=$3 AND m.state='active' AND o.status='active' AND u.status='active'
        ORDER BY u.name,u.id LIMIT 100`,
        [ctx.tenantId,organizationId,ctx.actor.id]);
      return r.rows;
    });
  }
  createUnit(ctx:OrgContext,organizationId:string,input:unknown):Promise<Record<string,unknown>|null>{
    if(!validUUID(organizationId))throw new OrgInputError("Invalid organization");
    const value=unitName(input),unitId=randomUUID();
    return this.execute(ctx,"write","organizations:units",async db=>{
      const r=await db.query(`
        WITH created AS (
          INSERT INTO platform_units(tenant_id,id,organization_id,name,kind)
          SELECT o.tenant_id,$3::uuid,o.id,$4,$5
          FROM platform_organizations o
          JOIN platform_org_memberships m
            ON m.tenant_id=o.tenant_id AND m.organization_id=o.id
          WHERE o.tenant_id=$1::uuid AND o.id=$2::uuid AND o.status='active'
            AND m.principal_id=$6 AND m.state='active' AND m.role IN ('admin','editor')
          RETURNING tenant_id,id,organization_id,name,kind,status
        ), audit AS (
          INSERT INTO platform_org_audit(tenant_id,organization_id,actor_id,event,entity_id)
          SELECT tenant_id,organization_id,$6,'unit_created',id FROM created
          RETURNING entity_id
        )
        SELECT c.id,c.organization_id,c.name,c.kind,c.status FROM created c
        JOIN audit a ON a.entity_id=c.id`,
        [ctx.tenantId,organizationId,unitId,value.name,value.kind,ctx.actor.id]);
      return r.rows[0]??null;
    });
  }
}
