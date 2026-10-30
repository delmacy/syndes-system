import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../platform-core/identity/audit.service';
import type { TenantContext } from '../platform-core/identity/identity.contracts';

@Injectable()
export class WhatsAppAuditWriter {
  private readonly logger = new Logger(WhatsAppAuditWriter.name);

  constructor(private readonly audit: AuditService) {}

  async record(
    context: TenantContext,
    action: string,
    result: 'success' | 'denied' | 'failure',
  ): Promise<void> {
    try {
      await this.audit.record({
        tenantId: context.tenantId,
        actorId: context.actorId,
        action,
        resourceType: 'whatsapp_connection',
        result,
      });
    } catch {
      this.logger.error(
        `WhatsApp audit write failed (action ${action}); details withheld.`,
      );
    }
  }
}
