import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { forbiddenProblem } from '../core-crm/crm-problem-details';
import { tenantOf } from '../core-crm/crm-request';
import {
  IdentityAuthGuard,
  type IdentityRequest,
} from '../platform-core/identity/identity-auth.guard';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import { TenantContextGuard } from '../platform-core/identity/tenant-context.guard';
import { WhatsAppAuditWriter } from './whatsapp-audit';
import { WhatsAppConnectionService } from './whatsapp-connection.service';
import { WhatsAppSessionService } from './whatsapp-session.service';

@Controller('api/v1/whatsapp')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class WhatsAppController {
  constructor(
    private readonly connections: WhatsAppConnectionService,
    private readonly sessions: WhatsAppSessionService,
    private readonly audit: WhatsAppAuditWriter,
  ) {}

  @Get('connection')
  async get(@Request() request: IdentityRequest) {
    const context = await this.requireAdmin(tenantOf(request));
    const connection = await this.connections.get(context);
    return connection
      ? {
          id: connection.id,
          provider: connection.provider,
          status: connection.status,
          phoneExternalId: connection.phoneExternalId,
          configured: connection.configured,
          authorized: connection.authorized,
          serviceEnabled: connection.serviceEnabled,
          suspensionReason: connection.suspensionReason,
          updatedAt: connection.updatedAt.toISOString(),
        }
      : {
          provider: 'whatsmeow',
          status: 'disconnected',
          phoneExternalId: null,
          configured: false,
          authorized: false,
          serviceEnabled: true,
          suspensionReason: null,
          updatedAt: null,
        };
  }

  @Post('pairing')
  async pairing(@Request() request: IdentityRequest) {
    const context = await this.requireAdmin(tenantOf(request));
    const pairing = await this.sessions.startPairing(context);
    await this.audit.record(
      context,
      'whatsapp.connection.pairing_started',
      'success',
    );
    return {
      pairingCode: pairing.pairingCode,
      expiresAt: pairing.expiresAt.toISOString(),
    };
  }

  @Post('connect')
  async connect(@Request() request: IdentityRequest) {
    const context = await this.requireAdmin(tenantOf(request));
    const connection = await this.sessions.connect(context);
    await this.audit.record(
      context,
      'whatsapp.connection.connected',
      'success',
    );
    return {
      status: connection.status,
      phoneExternalId: connection.phoneExternalId,
    };
  }

  @Post('disconnect')
  async disconnect(@Request() request: IdentityRequest) {
    const context = await this.requireAdmin(tenantOf(request));
    const connection = await this.sessions.disconnect(context);
    await this.audit.record(
      context,
      'whatsapp.connection.disconnected',
      'success',
    );
    return {
      status: connection.status,
      phoneExternalId: connection.phoneExternalId,
    };
  }

  @Post('reconnect')
  async reconnect(@Request() request: IdentityRequest) {
    const context = await this.requireAdmin(tenantOf(request));
    const connection = await this.sessions.reconnect(context);
    await this.audit.record(
      context,
      'whatsapp.connection.reconnected',
      'success',
    );
    return connection;
  }

  private async requireAdmin(context: TenantContext): Promise<TenantContext> {
    if (context.role === 'tenant_admin') return context;
    await this.audit.record(
      context,
      'whatsapp.connection.admin_denied',
      'denied',
    );
    throw forbiddenProblem(
      'Only tenant_admin may manage the WhatsApp connection.',
    );
  }
}
