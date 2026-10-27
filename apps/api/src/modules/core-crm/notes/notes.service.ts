import { Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import type { SQL } from 'drizzle-orm';
import {
  conflictProblem,
  notFoundProblem,
  scopeDeniedProblem,
} from '../crm-problem-details';
import { CrmAuditWriter } from '../crm-audit';
import { organizationsInScope, personScopeCondition } from '../crm-scope';
import type { ListQuery } from '../crm-dtos';
import type { NoteInput, NoteResource, NoteTargetRef } from './notes-dtos';
import { TenantCrmDatabase } from '../tenant-crm.database';
import type { TenantCrmDb } from '../tenant-crm.database';
import type { TenantCrmTx } from '../timeline/timeline-recorder';
import { TimelineEventRecorder } from '../timeline/timeline-recorder';
import { crmOrganizations } from '../tenant-crm.schema';
import { crmPeople } from '../tenant-crm.schema';
import { crmNotes } from './notes.schema';

type NoteRow = typeof crmNotes.$inferSelect;

const RESOURCE_TYPE = 'note';

function toResource(row: NoteRow): NoteResource {
  return {
    id: row.id,
    body: row.body,
    ...(row.personId ? { personId: row.personId } : {}),
    ...(row.organizationId ? { organizationId: row.organizationId } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * CRM-06 Notes: notes attach only to Person/Organization targets visible
 * to the attendant's customer scope; archived targets cannot receive new
 * notes, but existing notes stay readable (archive preserves history).
 * Notes are create-only in the MVP slice and every creation emits its
 * `note.created` Timeline event in the same tenant transaction, with the
 * Control Plane actor id recorded server-side.
 */
@Injectable()
export class NotesService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: CrmAuditWriter,
    private readonly timeline: TimelineEventRecorder,
  ) {}

  async create(
    context: TenantContext,
    input: NoteInput,
  ): Promise<NoteResource> {
    const resource = await this.tenantDb.withTenant(context, async (db) =>
      db.transaction(async (tx: TenantCrmTx) => {
        await this.assertTarget(context, tx, input, 'write');
        const rows = await tx
          .insert(crmNotes)
          .values({
            body: input.body,
            ...(input.personId !== undefined
              ? { personId: input.personId }
              : {}),
            ...(input.organizationId !== undefined
              ? { organizationId: input.organizationId }
              : {}),
          })
          .returning();
        const note = toResource(rows[0]);
        await this.timeline.record(tx, {
          kind: 'note.created',
          actorId: context.actorId,
          noteId: note.id,
          personId: input.personId,
          organizationId: input.organizationId,
        });
        return note;
      }),
    );
    await this.audit.success(
      context,
      'crm.note.created',
      RESOURCE_TYPE,
      resource.id,
    );
    return resource;
  }

  async list(
    context: TenantContext,
    target: NoteTargetRef,
    query: ListQuery,
  ): Promise<{
    items: NoteResource[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    return this.tenantDb.withTenant(context, async (db) => {
      const where = await this.targetWhere(context, db, target, 'read');
      const rows = await db
        .select()
        .from(crmNotes)
        .where(where)
        .orderBy(asc(crmNotes.createdAt), asc(crmNotes.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      const counted = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(crmNotes)
        .where(where);
      return {
        items: rows.map(toResource),
        page: query.page,
        pageSize: query.pageSize,
        total: counted[0]?.total ?? 0,
      };
    });
  }

  async get(context: TenantContext, noteId: string): Promise<NoteResource> {
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db
        .select()
        .from(crmNotes)
        .where(eq(crmNotes.id, noteId));
      if (!rows.length) throw notFoundProblem('note_not_found');
      const row = rows[0];
      await this.assertTarget(
        context,
        db,
        row.personId
          ? { personId: row.personId }
          : { organizationId: row.organizationId as string },
        'read',
      );
      return toResource(row);
    });
  }

  /**
   * Scope-enforced target visibility. Write access additionally requires
   * an active (un-archived) target; reads keep working for archived ones.
   */
  private async assertTarget(
    context: TenantContext,
    db: TenantCrmDb,
    target: { personId?: string; organizationId?: string },
    mode: 'read' | 'write',
  ): Promise<void> {
    if (target.personId !== undefined) {
      const rows = await db
        .select({ archivedAt: crmPeople.archivedAt })
        .from(crmPeople)
        .where(
          and(eq(crmPeople.id, target.personId), personScopeCondition(context)),
        );
      if (!rows.length) throw notFoundProblem('person_not_found');
      if (mode === 'write' && rows[0].archivedAt) {
        await this.audit.denied(
          context,
          `crm.${RESOURCE_TYPE}.create`,
          RESOURCE_TYPE,
        );
        throw conflictProblem(
          'resource_archived',
          'Archived records cannot receive notes.',
        );
      }
      return;
    }
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
    const organizationId = target.organizationId;
    if (organizationId === undefined)
      throw notFoundProblem('organization_not_found');
    const rows = await db
      .select({ archivedAt: crmOrganizations.archivedAt })
      .from(crmOrganizations)
      .where(eq(crmOrganizations.id, organizationId));
    if (!rows.length) throw notFoundProblem('organization_not_found');
    if (mode === 'write' && rows[0].archivedAt) {
      await this.audit.denied(
        context,
        `crm.${RESOURCE_TYPE}.create`,
        RESOURCE_TYPE,
      );
      throw conflictProblem(
        'resource_archived',
        'Archived records cannot receive notes.',
      );
    }
  }

  private async targetWhere(
    context: TenantContext,
    db: TenantCrmDb,
    target: NoteTargetRef,
    mode: 'read' | 'write',
  ): Promise<SQL> {
    await this.assertTarget(context, db, target, mode);
    if ('personId' in target) return eq(crmNotes.personId, target.personId);
    return eq(crmNotes.organizationId, target.organizationId);
  }
}
