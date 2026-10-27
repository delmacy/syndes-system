import { Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { notFoundProblem, scopeDeniedProblem } from '../crm-problem-details';
import { CrmAuditWriter } from '../crm-audit';
import { organizationsInScope, personScopeCondition } from '../crm-scope';
import type { ListQuery } from '../crm-dtos';
import { TenantCrmDatabase } from '../tenant-crm.database';
import type { TenantCrmDb } from '../tenant-crm.database';
import { crmOrganizations } from '../tenant-crm.schema';
import { crmPeople } from '../tenant-crm.schema';
import { crmTimelineEvents } from './timeline.schema';

export interface TimelineEventResource {
  id: string;
  kind: string;
  actorId: string;
  personId: string | null;
  organizationId: string | null;
  tagId: string | null;
  noteId: string | null;
  occurredAt: string;
}

export interface TimelineListResult {
  items: TimelineEventResource[];
  page: number;
  pageSize: number;
  total: number;
}

type EventRow = typeof crmTimelineEvents.$inferSelect;

const RESOURCE_TYPE = 'timeline';

function toResource(row: EventRow): TimelineEventResource {
  return {
    id: row.id,
    kind: row.eventKind,
    actorId: row.actorId,
    personId: row.personId ?? null,
    organizationId: row.organizationId ?? null,
    tagId: row.tagId ?? null,
    noteId: row.noteId ?? null,
    occurredAt: row.occurredAt.toISOString(),
  };
}

/**
 * CRM-06 chronological Timeline reads. History comes exclusively from the
 * append-only tenant event store (ascending by occurrence time), never
 * from the Control Plane security audit. The caller's customer scope is
 * applied to the target Person/Organization before any event is read:
 * invisible targets resolve to 404, out-of-scope surfaces are denied
 * server-side.
 */
@Injectable()
export class TimelineService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: CrmAuditWriter,
  ) {}

  async personTimeline(
    context: TenantContext,
    personId: string,
    query: ListQuery,
  ): Promise<TimelineListResult> {
    return this.tenantDb.withTenant(context, async (db) => {
      const people = await db
        .select({ id: crmPeople.id })
        .from(crmPeople)
        .where(and(eq(crmPeople.id, personId), personScopeCondition(context)));
      if (!people.length) throw notFoundProblem('person_not_found');
      const where = eq(crmTimelineEvents.personId, personId);
      return this.readPage(db, where, query);
    });
  }

  async organizationTimeline(
    context: TenantContext,
    organizationId: string,
    query: ListQuery,
  ): Promise<TimelineListResult> {
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
    return this.tenantDb.withTenant(context, async (db) => {
      const organizations = await db
        .select({ id: crmOrganizations.id })
        .from(crmOrganizations)
        .where(eq(crmOrganizations.id, organizationId));
      if (!organizations.length)
        throw notFoundProblem('organization_not_found');
      const where = eq(crmTimelineEvents.organizationId, organizationId);
      return this.readPage(db, where, query);
    });
  }

  private async readPage(
    db: TenantCrmDb,
    where: SQL,
    query: ListQuery,
  ): Promise<TimelineListResult> {
    const rows = await db
      .select()
      .from(crmTimelineEvents)
      .where(where)
      .orderBy(asc(crmTimelineEvents.occurredAt), asc(crmTimelineEvents.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const counted = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(crmTimelineEvents)
      .where(where);
    return {
      items: rows.map(toResource),
      page: query.page,
      pageSize: query.pageSize,
      total: counted[0]?.total ?? 0,
    };
  }
}
