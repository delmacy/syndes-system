import {
  Body,
  Controller,
  Headers,
  Inject,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import { parseUuidParam } from '../core-crm/crm-dtos';
import { notFoundProblem } from '../core-crm/crm-problem-details';
import { ChannelIngressService } from '../inbox/channel/channel-ingress.service';
import { CONTROL_PLANE_DATABASE } from '../platform-core/platform-core.module';
import { WHATSAPP_CONFIG, type WhatsAppConfig } from './whatsapp.config';

@Controller('api/v1/internal/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsAppConfig,
    @Inject(CONTROL_PLANE_DATABASE) private readonly controlPlane: Pool,
    private readonly ingress: ChannelIngressService,
  ) {}

  @Post('events/:tenantId')
  async event(
    @Param('tenantId') rawTenantId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    this.authenticate(authorization);
    const tenantId = parseUuidParam(rawTenantId, 'tenantId');
    const result = await this.controlPlane.query<{ database_name: string }>(
      `SELECT database_name FROM tenants WHERE id = $1 AND provisioning_state = 'ready'`,
      [tenantId],
    );
    const databaseName = result.rows[0]?.database_name;
    if (!databaseName)
      throw notFoundProblem('whatsapp_tenant_binding_not_found');
    return this.ingress.ingestTrustedBinding(
      {
        bindingToken: `whatsmeow:${tenantId}`,
        tenantId,
        databaseName,
        productChannel: 'whatsapp',
      },
      body,
    );
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
