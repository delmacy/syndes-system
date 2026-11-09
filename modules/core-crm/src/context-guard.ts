import {AccessDeniedError,type Actor,type CoreKernel,type TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {TenantDatabaseMismatchError} from "./contracts.js";

export type AuthorizedCrmDefaultContext=Readonly<{
  tenantId:string;
  actor:Actor;
  /** Platform organization, NOT crm_organizations contact-company. */
  organizationId:string;
  workspaceId:string;
}>;

/**
 * Stage C1, intentionally restricted to the ONE default Organization/Workspace
 * while 002_legacy_single_context_gate.sql is active.
 *
 * The Kernel confirms tenant membership + CRM context read FGA BEFORE a DB
 * lease is resolved; tenant DB must then confirm both active memberships and
 * a completed legacy backfill. Removing the 002 indexes requires a new,
 * independently reviewed org-aware SQL query layer.
 */
export class CrmDefaultContextGuard{
  constructor(
    private readonly kernel:CoreKernel,
    private readonly databases:TrustedTenantDatabaseProvider,
  ){}
  async resolve(tenantId:string,actor:Actor):Promise<AuthorizedCrmDefaultContext>{
    return this.kernel.execute({actor,tenantId,action:"read",resource:"crm:context"},
      async()=>{
        const db=await this.databases.resolve(tenantId);
        if(db.tenantId!==tenantId)throw new TenantDatabaseMismatchError();
        const result=await db.query(`
          SELECT o.id AS organization_id,w.id AS workspace_id
          FROM platform_organizations o
          JOIN platform_org_memberships om
            ON om.tenant_id=o.tenant_id AND om.organization_id=o.id
          JOIN platform_workspaces w
            ON w.tenant_id=o.tenant_id AND w.organization_id=o.id
          JOIN platform_workspace_memberships wm
            ON wm.tenant_id=w.tenant_id AND wm.organization_id=w.organization_id
              AND wm.workspace_id=w.id AND wm.principal_id=om.principal_id
          WHERE o.tenant_id=$1::uuid
            AND om.principal_id=$2 AND om.state='active'
            AND wm.state='active' AND o.is_default AND w.is_default
            AND o.status='active' AND w.status='active'
            AND EXISTS(
              SELECT 1 FROM platform_legacy_backfill_runs audit
              WHERE audit.tenant_id=o.tenant_id
                AND audit.organization_id=o.id
            )
            AND EXISTS(
              SELECT 1 FROM pg_indexes
              WHERE schemaname=current_schema()
                AND indexname='platform_legacy_single_organization'
            )
            AND EXISTS(
              SELECT 1 FROM pg_indexes
              WHERE schemaname=current_schema()
                AND indexname='platform_legacy_single_workspace'
            )
          LIMIT 1`,[tenantId,actor.id]);
        const row=result.rows[0];
        if(!row)throw new AccessDeniedError();
        return {
          tenantId,actor,
          organizationId:String(row.organization_id),
          workspaceId:String(row.workspace_id),
        };
      });
  }
}
