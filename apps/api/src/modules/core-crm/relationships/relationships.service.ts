import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import {
  conflictProblem,
  conflictProblemFor,
  notFoundProblem,
  pgErrorCause,
  scopeDeniedProblem,
} from '../crm-problem-details';
import { CrmAuditWriter } from '../crm-audit';
import { organizationsInScope, personScopeCondition } from '../crm-scope';
import type { RelationshipInput } from '../crm-dtos';
import { TenantCrmDatabase } from '../tenant-crm.database';
import {
  crmOrganizations,
  crmPeople,
  crmRelationships,
} from '../tenant-crm.schema';
import type { TenantCrmTx } from '../timeline/timeline-recorder';
import { TimelineEventRecorder } from '../timeline/timeline-recorder';

export interface RelationshipResource {
  personId: string;
  organizationId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipRef {
  personId: string;
  organizationId: string;
}

export interface PersonOrganizationLink extends RelationshipResource {
  organizationName: string;
}

type RelationshipRow = typeof crmRelationships.$inferSelect;

const RESOURCE_TYPE = 'relationship';

function toResource(row: RelationshipRow): RelationshipResource {
  return {
    personId: row.personId,
    organizationId: row.organizationId,
    role: row.role,
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

function refOf(row: { personId: string; organizationId: string }): string {
  return `${row.personId}:${row.organizationId}`;
}

/**
 * CRM-05 Relationships: server-validated Person <-> Organization contact
 * links with `pj`/`both` scope guarding. Both referenced records must exist
 * and be un-archived; duplicate links conflict; removal is admin or member
 * (an update-class action on an existing link), never a person/org deletion.
 */
@Injectable()
export class RelationshipsService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: CrmAuditWriter,
    private readonly timeline: TimelineEventRecorder,
  ) {}

  async listForPerson(
    context: TenantContext,
    personId: string,
  ): Promise<{ items: PersonOrganizationLink[] }> {
    await this.requireOrganizationScope(context);
    return this.tenantDb.withTenant(context, async (db) => {
      const person = await db
        .select({ id: crmPeople.id })
        .from(crmPeople)
        .where(and(eq(crmPeople.id, personId), personScopeCondition(context)));
      if (!person.length) throw notFoundProblem('person_not_found');
      const rows = await db
        .select({
          personId: crmRelationships.personId,
          organizationId: crmRelationships.organizationId,
          role: crmRelationships.role,
          createdAt: crmRelationships.createdAt,
          updatedAt: crmRelationships.updatedAt,
          organizationName: crmOrganizations.name,
        })
        .from(crmRelationships)
        .innerJoin(
          crmOrganizations,
          eq(crmOrganizations.id, crmRelationships.organizationId),
        )
        .where(eq(crmRelationships.personId, personId));
      return {
        items: rows.map((row) => ({
          personId: row.personId,
          organizationId: row.organizationId,
          role: row.role,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          organizationName: row.organizationName,
        })),
      };
    });
  }

  async create(
    context: TenantContext,
    input: RelationshipInput,
  ): Promise<RelationshipResource> {
    await this.requireOrganizationScope(context);
    try {
      const resource = await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
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
          const person = await tx
            .select({ id: crmPeople.id, archivedAt: crmPeople.archivedAt })
            .from(crmPeople)
            .where(
              and(
                eq(crmPeople.id, input.personId),
                personScopeCondition(context),
              ),
            );
          if (!person.length) throw notFoundProblem('person_not_found');
          if (person[0].archivedAt) {
            throw conflictProblem(
              'resource_archived',
              'Archived people cannot receive links.',
            );
          }
          const rows = await tx
            .insert(crmRelationships)
            .values({
              personId: input.personId,
              organizationId: input.organizationId,
              role: 'contact',
            })
            .onConflictDoNothing()
            .returning();
          if (!rows.length)
            throw conflictProblem(
              'relationship_exists_conflict',
              'The person is already linked to the organization.',
            );
          await this.timeline.record(tx, {
            kind: 'relationship.created',
            actorId: context.actorId,
            personId: input.personId,
            organizationId: input.organizationId,
          });
          return toResource(rows[0]);
        }),
      );
      await this.audit.success(
        context,
        'crm.relationship.created',
        RESOURCE_TYPE,
        refOf(resource),
      );
      return resource;
    } catch (error) {
      throw toProblem(error);
    }
  }

  async get(
    context: TenantContext,
    personId: string,
    organizationId: string,
  ): Promise<RelationshipResource> {
    await this.requireOrganizationScope(context);
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db
        .select()
        .from(crmRelationships)
        .where(
          and(
            eq(crmRelationships.personId, personId),
            eq(crmRelationships.organizationId, organizationId),
          ),
        );
      if (!rows.length) throw notFoundProblem('relationship_not_found');
      return toResource(rows[0]);
    });
  }

  async remove(
    context: TenantContext,
    personId: string,
    organizationId: string,
  ): Promise<RelationshipResource> {
    await this.requireOrganizationScope(context);
    try {
      const resource = await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
          const rows = await tx
            .delete(crmRelationships)
            .where(
              and(
                eq(crmRelationships.personId, personId),
                eq(crmRelationships.organizationId, organizationId),
              ),
            )
            .returning();
          if (!rows.length) throw notFoundProblem('relationship_not_found');
          await this.timeline.record(tx, {
            kind: 'relationship.removed',
            actorId: context.actorId,
            personId,
            organizationId,
          });
          return toResource(rows[0]);
        }),
      );
      await this.audit.success(
        context,
        'crm.relationship.removed',
        RESOURCE_TYPE,
        `${personId}:${organizationId}`,
      );
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
        'Relationships are outside the attendant customer scope.',
      );
    }
  }
}
