import { Injectable, Logger } from '@nestjs/common';
import { desc } from 'drizzle-orm';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import { TenantCrmDatabase } from '../core-crm/tenant-crm.database';
import { whatsappConnections } from './whatsapp.schema';

export type WhatsAppConnectionStatus =
  'disconnected' | 'pairing' | 'connected' | 'suspended' | 'error';

export interface WhatsAppConnectionPatch {
  status: WhatsAppConnectionStatus;
  phoneExternalId?: string | null;
  sessionSecretRef?: string | null;
  configured?: boolean;
  authorized?: boolean;
  serviceEnabled?: boolean;
  suspensionReason?: 'delinquency' | null;
}

const REDACTED = '[redacted]';

@Injectable()
export class WhatsAppConnectionService {
  private readonly logger = new Logger(WhatsAppConnectionService.name);

  constructor(private readonly tenantDb: TenantCrmDatabase) {}

  async get(context: TenantContext) {
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db
        .select()
        .from(whatsappConnections)
        .orderBy(desc(whatsappConnections.updatedAt))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async setStatus(
    context: TenantContext,
    status: WhatsAppConnectionStatus,
    phoneExternalId?: string | null,
  ) {
    return this.setState(context, { status, phoneExternalId });
  }

  async setState(context: TenantContext, patch: WhatsAppConnectionPatch) {
    return this.tenantDb.withTenant(context, async (db) => {
      const current = await db
        .select()
        .from(whatsappConnections)
        .orderBy(desc(whatsappConnections.updatedAt))
        .limit(1);
      const resolvedPhone =
        patch.phoneExternalId === undefined
          ? (current[0]?.phoneExternalId ?? null)
          : patch.phoneExternalId;
      const resolvedSecret =
        patch.sessionSecretRef === undefined
          ? (current[0]?.sessionSecretRef ?? null)
          : patch.sessionSecretRef;
      const configured = patch.configured ?? current[0]?.configured ?? false;
      const authorized = patch.authorized ?? current[0]?.authorized ?? false;
      const serviceEnabled =
        patch.serviceEnabled ?? current[0]?.serviceEnabled ?? true;
      const suspensionReason =
        patch.suspensionReason === undefined
          ? (current[0]?.suspensionReason ?? null)
          : patch.suspensionReason;
      const rows = await db
        .insert(whatsappConnections)
        .values({
          singletonKey: 'default',
          status: patch.status,
          phoneExternalId: resolvedPhone,
          sessionSecretRef: resolvedSecret,
          configured,
          authorized,
          serviceEnabled,
          suspensionReason,
        })
        .onConflictDoUpdate({
          target: whatsappConnections.singletonKey,
          set: {
            status: patch.status,
            phoneExternalId: resolvedPhone,
            sessionSecretRef: resolvedSecret,
            configured,
            authorized,
            serviceEnabled,
            suspensionReason,
            updatedAt: new Date(),
          },
        })
        .returning();
      this.logger.log(
        `whatsapp connection state updated (tenant=${context.tenantId}, status=${patch.status}, secret=${REDACTED})`,
      );
      return rows[0];
    });
  }
}
