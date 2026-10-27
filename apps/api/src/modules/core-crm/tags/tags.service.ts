import { Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import {
  conflictProblem,
  notFoundProblem,
  pgErrorCause,
  scopeDeniedProblem,
} from '../crm-problem-details';
import { CrmAuditWriter } from '../crm-audit';
import { organizationsInScope, personScopeCondition } from '../crm-scope';
import type { ListQuery } from '../crm-dtos';
import type { TagInput } from './tags-dtos';
import { TenantCrmDatabase } from '../tenant-crm.database';
import { crmOrganizations } from '../tenant-crm.schema';
import { crmPeople } from '../tenant-crm.schema';
import { crmTags, crmTagAssignments } from './tags.schema';
import type { TenantCrmTx } from '../timeline/timeline-recorder';
import { TimelineEventRecorder } from '../timeline/timeline-recorder';

export interface TagResource {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TagListResult {
  items: TagResource[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TagAssignmentResource {
  tagId: string;
  personId?: string;
  organizationId?: string;
  createdAt: string;
}

type TagRow = typeof crmTags.$inferSelect;

const RESOURCE_TYPE = 'tag';

function toResource(row: TagRow): TagResource {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Maps a tenant unique violation to its stable conflict problem. */
function toProblem(error: unknown): unknown {
  const candidate = pgErrorCause(error);
  if (candidate.code === '23505') {
    if (candidate.constraint === 'crm_tags_name_unique') {
      return conflictProblem('tag_name_conflict');
    }
    if (
      candidate.constraint === 'crm_tag_assignments_person_unique' ||
      candidate.constraint === 'crm_tag_assignments_organization_unique'
    ) {
      return conflictProblem('tag_assignment_exists_conflict');
    }
  }
  return error;
}

/**
 * CRM-06 Tags: tenant workspace labels attachable to Person or
 * Organization only, with the caller's customer scope enforced on every
 * target (a Person must be visible to the attendant; Organization writes
 * require `pj`/`both`). Assignments run in one tenant transaction with
 * their `tag.attached`/`tag.detached` Timeline events; archived targets
 * cannot receive new attachments.
 */
@Injectable()
export class TagsService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: CrmAuditWriter,
    private readonly timeline: TimelineEventRecorder,
  ) {}

  async create(context: TenantContext, input: TagInput): Promise<TagResource> {
    try {
      const resource = await this.tenantDb.withTenant(context, async (db) => {
        const rows = await db
          .insert(crmTags)
          .values({
            name: input.name,
            ...(input.color !== undefined ? { color: input.color } : {}),
          })
          .returning();
        return toResource(rows[0]);
      });
      await this.audit.success(
        context,
        'crm.tag.created',
        RESOURCE_TYPE,
        resource.id,
      );
      return resource;
    } catch (error) {
      throw toProblem(error);
    }
  }

  async list(context: TenantContext, query: ListQuery): Promise<TagListResult> {
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db
        .select()
        .from(crmTags)
        .orderBy(asc(crmTags.name), asc(crmTags.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      const counted = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(crmTags);
      return {
        items: rows.map(toResource),
        page: query.page,
        pageSize: query.pageSize,
        total: counted[0]?.total ?? 0,
      };
    });
  }

  async get(context: TenantContext, tagId: string): Promise<TagResource> {
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db.select().from(crmTags).where(eq(crmTags.id, tagId));
      if (!rows.length) throw notFoundProblem('tag_not_found');
      return toResource(rows[0]);
    });
  }

  async assignToPerson(
    context: TenantContext,
    tagId: string,
    personId: string,
  ): Promise<TagAssignmentResource> {
    try {
      const resource = await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
          await this.assertPersonTarget(context, tx, personId);
          await this.assertTag(tx, tagId);
          const rows = await tx
            .insert(crmTagAssignments)
            .values({ tagId, personId })
            .onConflictDoNothing()
            .returning();
          if (!rows.length) {
            throw conflictProblem(
              'tag_assignment_exists_conflict',
              'The tag is already assigned to the person.',
            );
          }
          await this.timeline.record(tx, {
            kind: 'tag.attached',
            actorId: context.actorId,
            tagId,
            personId,
          });
          return {
            tagId,
            personId,
            createdAt: rows[0].createdAt.toISOString(),
          };
        }),
      );
      await this.audit.success(
        context,
        'crm.tag.assigned',
        RESOURCE_TYPE,
        `${tagId}:${personId}`,
      );
      return resource;
    } catch (error) {
      throw toProblem(error);
    }
  }

  async assignToOrganization(
    context: TenantContext,
    tagId: string,
    organizationId: string,
  ): Promise<TagAssignmentResource> {
    await this.requireOrganizationScope(context, 'assign');
    try {
      const resource = await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
          await this.assertOrganizationTarget(tx, organizationId);
          await this.assertTag(tx, tagId);
          const rows = await tx
            .insert(crmTagAssignments)
            .values({ tagId, organizationId })
            .onConflictDoNothing()
            .returning();
          if (!rows.length) {
            throw conflictProblem(
              'tag_assignment_exists_conflict',
              'The tag is already assigned to the organization.',
            );
          }
          await this.timeline.record(tx, {
            kind: 'tag.attached',
            actorId: context.actorId,
            tagId,
            organizationId,
          });
          return {
            tagId,
            organizationId,
            createdAt: rows[0].createdAt.toISOString(),
          };
        }),
      );
      await this.audit.success(
        context,
        'crm.tag.assigned',
        RESOURCE_TYPE,
        `${tagId}:${organizationId}`,
      );
      return resource;
    } catch (error) {
      throw toProblem(error);
    }
  }

  async detachFromPerson(
    context: TenantContext,
    tagId: string,
    personId: string,
  ): Promise<TagAssignmentResource> {
    try {
      const resource = await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
          await this.assertPersonVisible(context, tx, personId);
          await this.assertTag(tx, tagId);
          const rows = await tx
            .delete(crmTagAssignments)
            .where(
              and(
                eq(crmTagAssignments.tagId, tagId),
                eq(crmTagAssignments.personId, personId),
              ),
            )
            .returning();
          if (!rows.length) throw notFoundProblem('tag_assignment_not_found');
          await this.timeline.record(tx, {
            kind: 'tag.detached',
            actorId: context.actorId,
            tagId,
            personId,
          });
          return {
            tagId,
            personId,
            createdAt: rows[0].createdAt.toISOString(),
          };
        }),
      );
      await this.audit.success(
        context,
        'crm.tag.detached',
        RESOURCE_TYPE,
        `${tagId}:${personId}`,
      );
      return resource;
    } catch (error) {
      throw toProblem(error);
    }
  }

  async detachFromOrganization(
    context: TenantContext,
    tagId: string,
    organizationId: string,
  ): Promise<TagAssignmentResource> {
    await this.requireOrganizationScope(context, 'detach');
    try {
      const resource = await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
          await this.assertOrganizationVisible(tx, organizationId);
          await this.assertTag(tx, tagId);
          const rows = await tx
            .delete(crmTagAssignments)
            .where(
              and(
                eq(crmTagAssignments.tagId, tagId),
                eq(crmTagAssignments.organizationId, organizationId),
              ),
            )
            .returning();
          if (!rows.length) throw notFoundProblem('tag_assignment_not_found');
          await this.timeline.record(tx, {
            kind: 'tag.detached',
            actorId: context.actorId,
            tagId,
            organizationId,
          });
          return {
            tagId,
            organizationId,
            createdAt: rows[0].createdAt.toISOString(),
          };
        }),
      );
      await this.audit.success(
        context,
        'crm.tag.detached',
        RESOURCE_TYPE,
        `${tagId}:${organizationId}`,
      );
      return resource;
    } catch (error) {
      throw toProblem(error);
    }
  }

  /** A tag is not a customer record; it exists, or the id is not found. */
  private async assertTag(tx: TenantCrmTx, tagId: string): Promise<void> {
    const rows = await tx
      .select({ id: crmTags.id })
      .from(crmTags)
      .where(eq(crmTags.id, tagId));
    if (!rows.length) throw notFoundProblem('tag_not_found');
  }

  /** Scope-enforced, un-archived Person target (invisible ids are 404). */
  private async assertPersonTarget(
    context: TenantContext,
    tx: TenantCrmTx,
    personId: string,
  ): Promise<void> {
    await this.assertPersonVisible(context, tx, personId);
    const rows = await tx
      .select({ id: crmPeople.id, archivedAt: crmPeople.archivedAt })
      .from(crmPeople)
      .where(and(eq(crmPeople.id, personId), personScopeCondition(context)));
    if (!rows.length) throw notFoundProblem('person_not_found');
    if (rows[0].archivedAt) {
      await this.audit.denied(
        context,
        `crm.${RESOURCE_TYPE}.assign`,
        RESOURCE_TYPE,
      );
      throw conflictProblem(
        'resource_archived',
        'Archived records cannot receive tags.',
      );
    }
  }

  private async assertPersonVisible(
    context: TenantContext,
    tx: TenantCrmTx,
    personId: string,
  ): Promise<void> {
    const rows = await tx
      .select({ id: crmPeople.id })
      .from(crmPeople)
      .where(and(eq(crmPeople.id, personId), personScopeCondition(context)));
    if (!rows.length) throw notFoundProblem('person_not_found');
  }

  private async assertOrganizationTarget(
    tx: TenantCrmTx,
    organizationId: string,
  ): Promise<void> {
    await this.assertOrganizationVisible(tx, organizationId);
    const rows = await tx
      .select({
        id: crmOrganizations.id,
        archivedAt: crmOrganizations.archivedAt,
      })
      .from(crmOrganizations)
      .where(
        and(
          eq(crmOrganizations.id, organizationId),
          isNull(crmOrganizations.archivedAt),
        ),
      );
    if (!rows.length) throw notFoundProblem('organization_not_found');
  }

  private async assertOrganizationVisible(
    tx: TenantCrmTx,
    organizationId: string,
  ): Promise<void> {
    const rows = await tx
      .select({ id: crmOrganizations.id })
      .from(crmOrganizations)
      .where(eq(crmOrganizations.id, organizationId));
    if (!rows.length) throw notFoundProblem('organization_not_found');
  }

  private async requireOrganizationScope(
    context: TenantContext,
    action: string,
  ): Promise<void> {
    if (!organizationsInScope(context)) {
      await this.audit.denied(
        context,
        `crm.${RESOURCE_TYPE}.${action}`,
        RESOURCE_TYPE,
      );
      throw scopeDeniedProblem(
        'Organizations are outside the attendant customer scope.',
      );
    }
  }
}
