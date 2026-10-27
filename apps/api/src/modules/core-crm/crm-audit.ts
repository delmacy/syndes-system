import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../platform-core/identity/audit.service';
import type { TenantContext } from '../platform-core/identity/identity.contracts';

/**
 * CRM audit support (Core CRM AGENTS: audit for relevant changes, including
 * denied actions). Audit records contain only stable allowlisted
 * action/resource names and record ids — never request bodies, record field
 * values, credentials or tokens. The Control Plane write is best-effort: a
 * failed audit write is logged with fixed text and never exposes record
 * data, and the caller always surfaces its own CRM decision first.
 */
@Injectable()
export class CrmAuditWriter {
  private readonly logger = new Logger(CrmAuditWriter.name);

  constructor(private readonly audit: AuditService) {}

  async success(
    context: TenantContext,
    action: string,
    resourceType: string,
    resourceId: string | null,
  ): Promise<void> {
    try {
      await this.audit.record({
        tenantId: context.tenantId,
        actorId: context.actorId,
        action,
        resourceType,
        resourceId: resourceId ?? undefined,
        result: 'success',
      });
    } catch {
      this.logger.error(
        `CRM audit write failed (action ${action}); details withheld.`,
      );
    }
  }

  /** Records a denied action; callers throw their own CRM problem after. */
  async denied(
    context: TenantContext,
    action: string,
    resourceType: string,
  ): Promise<void> {
    try {
      await this.audit.record({
        tenantId: context.tenantId,
        actorId: context.actorId,
        action: `${action}.denied`,
        resourceType,
        result: 'denied',
      });
    } catch {
      this.logger.error(
        `CRM denied-audit write failed (action ${action}); details withheld.`,
      );
    }
  }
}
