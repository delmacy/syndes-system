import {
  Body,
  Controller,
  Headers,
  Inject,
  Param,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import { parseUuidParam } from '../core-crm/crm-dtos';
import { notFoundProblem } from '../core-crm/crm-problem-details';
import { TenantContext } from '../platform-core/identity/identity.contracts';
import { ChannelIngressService } from '../inbox/channel/channel-ingress.service';
import type { ChannelBindingRecord } from '../inbox/channel/inbox-channel-registry';
import { CONTROL_PLANE_DATABASE } from '../platform-core/platform-core.module';
import { WHATSAPP_CONFIG, type WhatsAppConfig } from './whatsapp.config';
import { WhatsAppConnectionService } from './whatsapp-connection.service';

const CHANNEL_ROUTING_ACTOR_ID = '00000000-0000-4000-8000-0000000000cc';

/**
 * WA-03 WhatsApp inbound webhook.
 *
 * Trust chain (INBOX-03), server-side only:
 * 1. Bearer token authenticated with timingSafeEqual before any tenant lookup.
 * 2. Tenant resolved from the URL param and validated as UUID.
 * 3. Tenant database resolved from the Control Plane `tenants` table — NEVER
 *    from the provider payload.
 * 4. WhatsApp channel binding built server-side from control-plane data
 *    (tenantId, databaseName, productChannel) and delivered through
 *    `ingestTrustedBinding`, the INBOX-03 trusted internal entrypoint. The
 *    provider payload never carries tenant/database/selectors. No binding is
 *    registered per request from the raw `:tenantId` path.
 * 5. Suspension gate: a tenant whose WhatsApp connection has
 *    service_enabled=false and suspension_reason='delinquency' cannot receive
 *    or deliver any inbound message.
 * 6. Event validated against the frozen channel contract and persisted only in
 *    the tenant database resolved in step 3, with channel-scoped idempotency.
 */
@Controller('api/v1/internal/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsAppConfig,
    @Inject(CONTROL_PLANE_DATABASE) private readonly controlPlane: Pool,
    private readonly ingress: ChannelIngressService,
    private readonly connections: WhatsAppConnectionService,
  ) {}

  @Post('events/:tenantId')
  async event(
    @Param('tenantId') rawTenantId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    this.authenticate(authorization);
    const tenantId = parseUuidParam(rawTenantId, 'tenantId');

    // 3) Tenant database from Control Plane, never from the payload.
    const result = await this.controlPlane.query<{ database_name: string }>(
      `SELECT database_name FROM tenants WHERE id = $1 AND provisioning_state = 'ready'`,
      [tenantId],
    );
    const databaseName = result.rows[0]?.database_name;
    if (!databaseName)
      throw notFoundProblem('whatsapp_tenant_binding_not_found');

    // 4) Trusted channel binding resolved server-side from control-plane data,
    // never fabricated from the provider payload nor registered per-request
    // from the raw path. Delivered through the INBOX-03 trusted entrypoint.
    const binding: ChannelBindingRecord = {
      bindingToken: `whatsmeow:${tenantId}`,
      tenantId,
      databaseName,
      productChannel: 'whatsapp',
    };

    // 5) Suspension gate: delinquent tenants cannot receive or deliver messages.
    const context: TenantContext = {
      actorId: CHANNEL_ROUTING_ACTOR_ID,
      tenantId,
      databaseName,
      role: 'tenant_admin',
      customerScope: 'both',
    };
    const connection = await this.connections.get(context);
    if (
      connection?.serviceEnabled === false &&
      connection?.suspensionReason === 'delinquency'
    ) {
      throw new ServiceUnavailableException(
        'whatsapp service suspended for delinquency',
      );
    }

    return this.ingress.ingestTrustedBinding(binding, body);
  }

  private authenticate(header: string | undefined): void {
    const expected = this.config.webhookToken;
    const actual = header?.startsWith('Bearer ') ? header.slice(7) : '';
    if (!expected || !actual) throw new UnauthorizedException();
    const expectedBytes = Buffer.from(expected);
    const actualBytes = Buffer.from(actual);
    if (
      expectedBytes.length !== actualBytes.length ||
      !timingSafeEqual(expectedBytes, actualBytes)
    ) {
      throw new UnauthorizedException();
    }
  }
}
