import { Injectable } from '@nestjs/common';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import type { TenantCrmDb } from '../tenant-crm.database';
import { crmTimelineEvents } from './timeline.schema';
import type { TimelineEventKind } from './timeline.schema';

/**
 * Transaction type of a tenant CRM transaction. The recorder never opens
 * its own connection: it must be called with the open transaction of the
 * mutation it describes so event and mutation commit or roll back
 * together.
 */
export type TenantCrmTx = Parameters<
  Parameters<TenantCrmDb['transaction']>[0]
>[0];

export interface TimelineEventDraft {
  kind: TimelineEventKind;
  actorId: string;
  personId?: string;
  organizationId?: string;
  tagId?: string;
  noteId?: string;
}

/**
 * CRM-06 Timeline event recorder. Writes append-only event rows with only
 * the frozen minimum (kind, CRM identifiers, actor id, occurrence time
 * from `clock_timestamp()`); no mutable CRM field is copied and no
 * update/delete path exists. Runs strictly inside the mutation's tenant
 * transaction, so a failed mutation never leaves a history row.
 */
@Injectable()
export class TimelineEventRecorder {
  async record(
    transaction: TenantCrmTx,
    draft: TimelineEventDraft,
  ): Promise<void> {
    await transaction.insert(crmTimelineEvents).values({
      eventKind: draft.kind,
      actorId: draft.actorId,
      ...(draft.personId !== undefined ? { personId: draft.personId } : {}),
      ...(draft.organizationId !== undefined
        ? { organizationId: draft.organizationId }
        : {}),
      ...(draft.tagId !== undefined ? { tagId: draft.tagId } : {}),
      ...(draft.noteId !== undefined ? { noteId: draft.noteId } : {}),
    });
  }

  /** Convenience wrapper keeping services short inside transactions. */
  recorderFor(
    context: TenantContext,
  ): (
    transaction: TenantCrmTx,
    draft: Omit<TimelineEventDraft, 'actorId'>,
  ) => Promise<void> {
    return (transaction, draft) =>
      this.record(transaction, { ...draft, actorId: context.actorId });
  }
}
