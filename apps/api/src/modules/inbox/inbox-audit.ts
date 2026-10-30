import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../platform-core/identity/audit.service';
import type { TenantContext } from '../platform-core/identity/identity.contracts';

/**
 * INBOX audit writer.
 *
 * Audit records record *that* an action happened and *by whom*, never message
 * bodies, note text, filenames, storage keys or tokens. The same writer is
 * used for actor-attributed actions (attachment created, assignment changed,
 * outbound dispatched/failed) and actor-less channel events (message received,
 * duplicated).
 *
 * Records go to the Control Plane `audit_events` table through the existing
 * `AuditService`; the write is best-effort so a Control Plane hiccup never
 * turns a successfully persisted Inbox decision into an error. Only stable
 * allowlisted action/resource names and record ids are sent. Structured
 * operational logs carry the same identifiers and are always content-free.
 */
@Injectable()
export class InboxAuditWriter {
  private readonly logger = new Logger(InboxAuditWriter.name);

  constructor(private readonly audit: AuditService) {}

  async success(
    context: TenantContext,
    code: string,
    type: string,
    id: string,
  ): Promise<void> {
    await this.record(
      context.tenantId,
      context.actorId,
      code,
      type,
      id,
      'success',
    );
    this.log(code, type, id, context.tenantId, context.actorId, 'success');
  }

  /** Denied action: the caller still surfaces its own authorization problem. */
  async denied(
    context: TenantContext,
    code: string,
    type: string,
    id: string,
  ): Promise<void> {
    await this.record(
      context.tenantId,
      context.actorId,
      code,
      type,
      id,
      'denied',
    );
    this.log(code, type, id, context.tenantId, context.actorId, 'denied');
  }

  async failure(
    context: TenantContext,
    code: string,
    type: string,
    id: string,
  ): Promise<void> {
    await this.record(
      context.tenantId,
      context.actorId,
      code,
      type,
      id,
      'failure',
    );
    this.log(code, type, id, context.tenantId, context.actorId, 'failure');
  }

  /** Actor-less channel event: tenant comes from the trusted binding only. */
  async channel(
    tenantId: string,
    code: string,
    outcome: 'success' | 'failure',
    id: string,
    actorId?: string,
  ): Promise<void> {
    await this.record(tenantId, actorId, code, 'channel_message', id, outcome);
    this.log(code, 'channel_message', id, tenantId, actorId, outcome);
  }

  private async record(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    resourceType: string,
    resourceId: string,
    result: 'success' | 'denied' | 'failure',
  ): Promise<void> {
    try {
      await this.audit.record({
        tenantId,
        ...(actorId ? { actorId } : {}),
        action,
        resourceType,
        resourceId,
        result,
      });
    } catch {
      this.logger.error(
        `Inbox audit write failed (action ${action}); details withheld.`,
      );
    }
  }

  private log(
    code: string,
    type: string,
    id: string,
    tenantId: string,
    actorId: string | undefined,
    outcome: 'success' | 'denied' | 'failure',
  ): void {
    this.logger.log(
      JSON.stringify({ code, type, id, tenantId, actorId, outcome }),
    );
  }
}
