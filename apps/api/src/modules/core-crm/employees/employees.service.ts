import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import {
  conflictProblemFor,
  forbiddenProblem,
  notFoundProblem,
  pgErrorCause,
} from '../crm-problem-details';
import { CrmAuditWriter } from '../crm-audit';
import type { EmployeeInput } from '../crm-dtos';
import { TenantCrmDatabase } from '../tenant-crm.database';
import { crmEmployees } from '../tenant-crm.schema';
import { CONTROL_PLANE_DATABASE } from '../../platform-core/platform-core.module';

export interface EmployeeResource {
  id: string;
  displayName: string;
  active: boolean;
  controlPlaneActorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeListResult {
  items: EmployeeResource[];
  page: number;
  pageSize: number;
  total: number;
}

type EmployeeRow = typeof crmEmployees.$inferSelect;

const RESOURCE_TYPE = 'employee';

function toResource(row: EmployeeRow): EmployeeResource {
  return {
    id: row.id,
    displayName: row.displayName,
    active: row.active,
    controlPlaneActorId: row.controlPlaneActorId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Maps a tenant unique violation to its stable conflict problem. */
function toProblem(error: unknown): unknown {
  const candidate = pgErrorCause(error);
  if (candidate.code === '23505') {
    return conflictProblemFor(candidate.constraint);
  }
  return error;
}

/**
 * CRM-05 Employees: tenant staff/attendant profiles. An Employee is not a
 * login and stores no credentials; `control_plane_actor_id` is an optional
 * unique reference to a Control Plane actor UUID (verified to exist, with
 * no cross-database key). Reads are member-visible; only `tenant_admin`
 * manages staff profiles, mirroring the membership/matrix contract.
 */
@Injectable()
export class EmployeesService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: CrmAuditWriter,
    @Inject(CONTROL_PLANE_DATABASE) private readonly controlPlane: Pool,
  ) {}

  async list(
    context: TenantContext,
    page: number,
    pageSize: number,
  ): Promise<EmployeeListResult> {
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db
        .select()
        .from(crmEmployees)
        .orderBy(asc(crmEmployees.createdAt), asc(crmEmployees.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      const counted = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(crmEmployees);
      return {
        items: rows.map(toResource),
        page,
        pageSize,
        total: counted[0]?.total ?? 0,
      };
    });
  }

  async get(context: TenantContext, id: string): Promise<EmployeeResource> {
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db
        .select()
        .from(crmEmployees)
        .where(eq(crmEmployees.id, id));
      if (!rows.length) throw notFoundProblem('employee_not_found');
      return toResource(rows[0]);
    });
  }

  async create(
    context: TenantContext,
    input: EmployeeInput,
  ): Promise<EmployeeResource> {
    await this.requireAdmin(context);
    if (input.controlPlaneActorId !== undefined) {
      await this.assertActorExists(input.controlPlaneActorId);
    }
    try {
      const resource = await this.tenantDb.withTenant(context, async (db) => {
        const rows = await db
          .insert(crmEmployees)
          .values({
            displayName: input.displayName,
            ...(input.active !== undefined
              ? { active: input.active }
              : { active: true }),
            ...(input.controlPlaneActorId !== undefined
              ? { controlPlaneActorId: input.controlPlaneActorId }
              : {}),
          })
          .returning();
        return toResource(rows[0]);
      });
      await this.audit.success(
        context,
        'crm.employee.created',
        RESOURCE_TYPE,
        resource.id,
      );
      return resource;
    } catch (error) {
      throw toProblem(error);
    }
  }

  async update(
    context: TenantContext,
    id: string,
    input: Partial<EmployeeInput>,
  ): Promise<EmployeeResource> {
    await this.requireAdmin(context);
    try {
      return await this.tenantDb.withTenant(context, async (db) => {
        const rows = await db
          .update(crmEmployees)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(crmEmployees.id, id))
          .returning();
        if (!rows.length) throw notFoundProblem('employee_not_found');
        await this.audit.success(
          context,
          'crm.employee.updated',
          RESOURCE_TYPE,
          id,
        );
        return toResource(rows[0]);
      });
    } catch (error) {
      throw toProblem(error);
    }
  }

  /**
   * The linked identity must be an existing Control Plane actor (lookup by
   * the tenant-scoped stored uuid only; never by email or external keys).
   */
  private async assertActorExists(actorId: string): Promise<void> {
    const result = await this.controlPlane.query(
      `SELECT 1 FROM identity_actors WHERE id = $1`,
      [actorId],
    );
    if (!result.rowCount) {
      throw notFoundProblem('actor_not_found');
    }
  }

  private async requireAdmin(context: TenantContext): Promise<void> {
    if (context.role !== 'tenant_admin') {
      await this.audit.denied(
        context,
        `crm.${RESOURCE_TYPE}.manage`,
        RESOURCE_TYPE,
      );
      throw forbiddenProblem(
        'Only tenant_admin may manage employee staff profiles.',
      );
    }
  }
}
