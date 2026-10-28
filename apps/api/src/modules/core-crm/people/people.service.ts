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
import { personScopeCondition } from '../crm-scope';
import type { LinkedPersonInput, ListQuery, PersonInput } from '../crm-dtos';
import { TenantCrmDatabase } from '../tenant-crm.database';
import {
  crmOrganizations,
  crmPeople,
  crmRelationships,
} from '../tenant-crm.schema';
import type { TenantCrmTx } from '../timeline/timeline-recorder';
import { TimelineEventRecorder } from '../timeline/timeline-recorder';

export interface PersonResource {
  id: string;
  fullName: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonListResult {
  items: PersonResource[];
  page: number;
  pageSize: number;
  total: number;
}

type PersonRow = typeof crmPeople.$inferSelect;

const RESOURCE_TYPE = 'person';

export function personResourceOf(row: PersonRow): PersonResource {
  return {
    id: row.id,
    fullName: row.fullName,
    cpf: row.cpf ?? null,
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

function safeNow(): Date {
  return new Date();
}

/**
 * CRM-05 People: tenant-scoped CRUD with soft archive and server-side
 * customer_scope visibility (`cpf` -> unlinked Persons, `pj` -> Persons
 * linked to an Organization, `both` -> all).
 *
 * Scope is enforced on writes too: a `pj` member may only create a Person
 * together with (or linked to) an Organization; a `cpf` member may never
 * link Organizations. Invisible records resolve to not found.
 */
@Injectable()
export class PeopleService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: CrmAuditWriter,
    private readonly timeline: TimelineEventRecorder,
  ) {}

  async list(
    context: TenantContext,
    query: ListQuery,
  ): Promise<PersonListResult> {
    return this.tenantDb.withTenant(context, async (db) => {
      const where = and(
        isNull(crmPeople.archivedAt),
        personScopeCondition(context),
      );
      const rows = await db
        .select()
        .from(crmPeople)
        .where(where)
        .orderBy(desc(crmPeople.createdAt), asc(crmPeople.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      const counted = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(crmPeople)
        .where(where);
      return {
        items: rows.map(personResourceOf),
        page: query.page,
        pageSize: query.pageSize,
        total: counted[0]?.total ?? 0,
      };
    });
  }

  async get(context: TenantContext, id: string): Promise<PersonResource> {
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db
        .select()
        .from(crmPeople)
        .where(and(eq(crmPeople.id, id), personScopeCondition(context)));
      if (!rows.length) throw notFoundProblem('person_not_found');
      return personResourceOf(rows[0]);
    });
  }

  async create(
    context: TenantContext,
    input: LinkedPersonInput,
  ): Promise<PersonResource & { organizationId?: string }> {
    await this.assertCreateScope(context, input);
    try {
      const outcome = await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
          if (input.organizationId !== undefined) {
            const organization = await tx
              .select({
                id: crmOrganizations.id,
                archivedAt: crmOrganizations.archivedAt,
              })
              .from(crmOrganizations)
              .where(eq(crmOrganizations.id, input.organizationId));
            if (!organization.length)
              throw notFoundProblem('organization_not_found');
            if (organization[0].archivedAt) {
              throw conflictProblem(
                'resource_archived',
                'Archived organizations cannot receive links.',
              );
            }
          }
          const rows = await tx
            .insert(crmPeople)
            .values({
              fullName: input.fullName,
              ...(input.cpf !== undefined ? { cpf: input.cpf } : {}),
              ...(input.email !== undefined ? { email: input.email } : {}),
              ...(input.phone !== undefined ? { phone: input.phone } : {}),
            })
            .returning();
          const person = personResourceOf(rows[0]);
          await this.timeline.record(tx, {
            kind: 'person.created',
            actorId: context.actorId,
            personId: person.id,
          });
          if (input.organizationId !== undefined) {
            await tx.insert(crmRelationships).values({
              personId: person.id,
              organizationId: input.organizationId,
              role: 'contact',
            });
            await this.timeline.record(tx, {
              kind: 'relationship.created',
              actorId: context.actorId,
              personId: person.id,
              organizationId: input.organizationId,
            });
          }
          return { person, linkedOrganizationId: input.organizationId };
        }),
      );
      await this.audit.success(
        context,
        'crm.person.created',
        RESOURCE_TYPE,
        outcome.person.id,
      );
      if (outcome.linkedOrganizationId !== undefined) {
        await this.audit.success(
          context,
          'crm.relationship.created',
          'relationship',
          `${outcome.person.id}:${outcome.linkedOrganizationId}`,
        );
      }
      return {
        ...outcome.person,
        ...(outcome.linkedOrganizationId !== undefined
          ? { organizationId: outcome.linkedOrganizationId }
          : {}),
      };
    } catch (error) {
      throw toProblem(error);
    }
  }

  async update(
    context: TenantContext,
    id: string,
    input: Partial<PersonInput>,
  ): Promise<PersonResource> {
    try {
      const resource = await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
          const rows = await tx
            .update(crmPeople)
            .set({ ...input, updatedAt: safeNow() })
            .where(
              and(
                eq(crmPeople.id, id),
                isNull(crmPeople.archivedAt),
                personScopeCondition(context),
              ),
            )
            .returning();
          if (rows.length) {
            await this.timeline.record(tx, {
              kind: 'person.updated',
              actorId: context.actorId,
              personId: id,
            });
            return personResourceOf(rows[0]);
          }
          const existing = await tx
            .select({ id: crmPeople.id, archivedAt: crmPeople.archivedAt })
            .from(crmPeople)
            .where(and(eq(crmPeople.id, id), personScopeCondition(context)));
          if (!existing.length) throw notFoundProblem('person_not_found');
          throw conflictProblem(
            'resource_archived',
            'Archived records cannot be updated.',
          );
        }),
      );
      await this.audit.success(
        context,
        'crm.person.updated',
        RESOURCE_TYPE,
        id,
      );
      return resource;
    } catch (error) {
      throw toProblem(error);
    }
  }

  /** Soft archive (idempotent), admin-only. */
  async archive(context: TenantContext, id: string): Promise<PersonResource> {
    await this.requireArchivePermission(context);
    let archived = false;
    const resource = await this.tenantDb.withTenant(context, async (db) =>
      db.transaction(async (tx: TenantCrmTx) => {
        const rows = await tx
          .update(crmPeople)
          .set({ archivedAt: safeNow() })
          .where(and(eq(crmPeople.id, id), isNull(crmPeople.archivedAt)))
          .returning();
        if (rows.length) {
          archived = true;
          await this.timeline.record(tx, {
            kind: 'person.archived',
            actorId: context.actorId,
            personId: id,
          });
          return personResourceOf(rows[0]);
        }
        const existing = await tx
          .select()
          .from(crmPeople)
          .where(eq(crmPeople.id, id));
        if (!existing.length) throw notFoundProblem('person_not_found');
        return personResourceOf(existing[0]);
      }),
    );
    if (archived) {
      await this.audit.success(
        context,
        'crm.person.archived',
        RESOURCE_TYPE,
        id,
      );
    }
    return resource;
  }

  private async assertCreateScope(
    context: TenantContext,
    input: LinkedPersonInput,
  ): Promise<void> {
    if (context.customerScope === 'pj' && input.organizationId === undefined) {
      await this.audit.denied(context, 'crm.person.create', RESOURCE_TYPE);
      throw scopeDeniedProblem(
        'pj attendants may only create Persons linked to an Organization.',
      );
    }
    if (context.customerScope === 'cpf' && input.organizationId !== undefined) {
      await this.audit.denied(context, 'crm.person.create', RESOURCE_TYPE);
      throw scopeDeniedProblem(
        'cpf attendants manage Persons outside PJ organizations.',
      );
    }
  }

  private async requireArchivePermission(
    context: TenantContext,
  ): Promise<void> {
    if (context.role !== 'tenant_admin') {
      await this.audit.denied(context, 'crm.person.archive', RESOURCE_TYPE);
      throw forbiddenProblem('Only tenant_admin may archive CRM records.');
    }
  }
}
