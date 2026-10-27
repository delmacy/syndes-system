import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import {
  conflictProblem,
  conflictProblemFor,
  forbiddenProblem,
  notFoundProblem,
  pgErrorCause,
  scopeDeniedProblem,
} from '../crm-problem-details';
import { CrmAuditWriter } from '../crm-audit';
import { organizationsInScope } from '../crm-scope';
import type { ListQuery, OrganizationInput } from '../crm-dtos';
import { TenantCrmDatabase } from '../tenant-crm.database';
import { crmOrganizations } from '../tenant-crm.schema';
import type { TenantCrmTx } from '../timeline/timeline-recorder';
import { TimelineEventRecorder } from '../timeline/timeline-recorder';

export interface OrganizationResource {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationListResult {
  items: OrganizationResource[];
  page: number;
  pageSize: number;
  total: number;
}

type OrganizationRow = typeof crmOrganizations.$inferSelect;

const RESOURCE_TYPE = 'organization';

function toResource(row: OrganizationRow): OrganizationResource {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
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
 * CRM-05 Organizations: tenant-scoped CRUD with soft archive only.
 *
 * - Customer scope `pj`/`both` guards every surface server-side (`cpf`
 *   attendants manage Persons only, so Organization surfaces are denied).
 * - Archive is a soft, admin-only operation; `tenant_member` archive is
 *   audited as denied and rendered forbidden.
 * - Tenant isolation comes from the TenantContext-routed tenant database;
 *   record ids from other tenants resolve to not found.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: CrmAuditWriter,
    private readonly timeline: TimelineEventRecorder,
  ) {}

  async list(
    context: TenantContext,
    query: ListQuery,
  ): Promise<OrganizationListResult> {
    await this.requireOrganizationScope(context);
    return this.tenantDb.withTenant(context, async (db) => {
      const where = isNull(crmOrganizations.archivedAt);
      const rows = await db
        .select()
        .from(crmOrganizations)
        .where(where)
        .orderBy(desc(crmOrganizations.createdAt), asc(crmOrganizations.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      const counted = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(crmOrganizations)
        .where(where);
      return {
        items: rows.map(toResource),
        page: query.page,
        pageSize: query.pageSize,
        total: counted[0]?.total ?? 0,
      };
    });
  }

  async get(context: TenantContext, id: string): Promise<OrganizationResource> {
    await this.requireOrganizationScope(context);
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db
        .select()
        .from(crmOrganizations)
        .where(eq(crmOrganizations.id, id));
      if (!rows.length) throw notFoundProblem('organization_not_found');
      return toResource(rows[0]);
    });
  }

  async create(
    context: TenantContext,
    input: OrganizationInput,
  ): Promise<OrganizationResource> {
    await this.requireOrganizationScope(context);
    try {
      const resource = await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
          const rows = await tx
            .insert(crmOrganizations)
            .values({
              name: input.name,
              ...(input.cnpj !== undefined ? { cnpj: input.cnpj } : {}),
              ...(input.email !== undefined ? { email: input.email } : {}),
              ...(input.phone !== undefined ? { phone: input.phone } : {}),
            })
            .returning();
          await this.timeline.record(tx, {
            kind: 'organization.created',
            actorId: context.actorId,
            organizationId: rows[0].id,
          });
          return toResource(rows[0]);
        }),
      );
      await this.audit.success(
        context,
        'crm.organization.created',
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
    input: Partial<OrganizationInput>,
  ): Promise<OrganizationResource> {
    await this.requireOrganizationScope(context);
    try {
      const resource = await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
          const rows = await tx
            .update(crmOrganizations)
            .set({
              ...input,
              updatedAt: safeNow(),
            })
            .where(
              and(
                eq(crmOrganizations.id, id),
                isNull(crmOrganizations.archivedAt),
              ),
            )
            .returning();
          if (rows.length) {
            await this.timeline.record(tx, {
              kind: 'organization.updated',
              actorId: context.actorId,
              organizationId: id,
            });
            return toResource(rows[0]);
          }
          const existing = await tx
            .select()
            .from(crmOrganizations)
            .where(eq(crmOrganizations.id, id));
          if (existing.length) {
            throw conflictProblem(
              'resource_archived',
              'Archived records cannot be updated.',
            );
          }
          throw notFoundProblem('organization_not_found');
        }),
      );
      await this.audit.success(
        context,
        'crm.organization.updated',
        RESOURCE_TYPE,
        id,
      );
      return resource;
    } catch (error) {
      throw toProblem(error);
    }
  }

  /** Soft archive (idempotent). Destruction is not part of the MVP. */
  async archive(
    context: TenantContext,
    id: string,
  ): Promise<OrganizationResource> {
    await this.requireOrganizationScope(context);
    await this.requireArchivePermission(context);
    try {
      const resource = await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
          const rows = await tx
            .update(crmOrganizations)
            .set({ archivedAt: safeNow() })
            .where(
              and(
                eq(crmOrganizations.id, id),
                isNull(crmOrganizations.archivedAt),
              ),
            )
            .returning();
          if (rows.length) {
            await this.timeline.record(tx, {
              kind: 'organization.archived',
              actorId: context.actorId,
              organizationId: id,
            });
            return toResource(rows[0]);
          }
          const existing = await tx
            .select()
            .from(crmOrganizations)
            .where(eq(crmOrganizations.id, id));
          if (!existing.length) throw notFoundProblem('organization_not_found');
          return toResource(existing[0]);
        }),
      );
      if (resource.archivedAt) {
        await this.audit.success(
          context,
          'crm.organization.archived',
          RESOURCE_TYPE,
          id,
        );
      }
      return resource;
    } catch (error) {
      throw toProblem(error);
    }
  }

  private async requireOrganizationScope(
    context: TenantContext,
  ): Promise<void> {
    if (!organizationsInScope(context)) {
      await this.audit.denied(
        context,
        `crm.${RESOURCE_TYPE}.access`,
        RESOURCE_TYPE,
      );
      throw scopeDeniedProblem(
        'Organizations are outside the attendant customer scope.',
      );
    }
  }

  private async requireArchivePermission(
    context: TenantContext,
  ): Promise<void> {
    if (context.role !== 'tenant_admin') {
      await this.audit.denied(
        context,
        `crm.${RESOURCE_TYPE}.archive`,
        RESOURCE_TYPE,
      );
      throw forbiddenProblem('Only tenant_admin may archive CRM records.');
    }
  }
}

function safeNow(): Date {
  return new Date();
}
