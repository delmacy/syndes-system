import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import { WHATSAPP_CONFIG, type WhatsAppConfig } from './whatsapp.config';
import { FakeWhatsAppProvider } from './fake-whatsapp.provider';
import { WhatsmeowProvider } from './whatsmeow.provider';
import { WhatsAppConnectionService } from './whatsapp-connection.service';

const REDACTED = '[redacted]';

@Injectable()
export class WhatsAppSessionService {
  private readonly logger = new Logger(WhatsAppSessionService.name);

  constructor(
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsAppConfig,
    private readonly connections: WhatsAppConnectionService,
    private readonly fake: FakeWhatsAppProvider,
    private readonly whatsmeow: WhatsmeowProvider,
  ) {}

  private provider() {
    return this.config.provider === 'fake' ? this.fake : this.whatsmeow;
  }

  private logPairing(tenantId: string) {
    this.logger.log(
      `whatsapp pairing started (tenant=${tenantId}, code=${REDACTED})`,
    );
  }

  async startPairing(context: TenantContext) {
    if (!this.config.enabled) throw new Error('whatsapp_disabled');
    const current = await this.connections.get(context);
    if (current && !current.serviceEnabled)
      throw new Error('whatsapp_suspended');
    if (current?.status === 'connected')
      throw new Error('whatsapp_already_connected');
    const result = await this.provider().startPairing(context.tenantId);
    await this.connections.setState(context, {
      status: 'pairing',
      configured: true,
      authorized: false,
      serviceEnabled: true,
      suspensionReason: null,
    });
    this.logPairing(context.tenantId);
    return result;
  }

  async connect(context: TenantContext) {
    if (!this.config.enabled) throw new Error('whatsapp_disabled');
    const current = await this.connections.get(context);
    if (current && !current.serviceEnabled)
      throw new Error('whatsapp_suspended');
    return this.connectProvider(context);
  }

  private async connectProvider(context: TenantContext) {
    const result = await this.provider().connect(context.tenantId);
    return this.connections.setState(context, {
      status: 'connected',
      phoneExternalId: result.phoneExternalId,
      configured: true,
      authorized: true,
      serviceEnabled: true,
      suspensionReason: null,
    });
  }

  async disconnect(context: TenantContext) {
    const current = await this.connections.get(context);
    await this.provider().disconnect(context.tenantId);
    if (current && !current.serviceEnabled) return current;
    return this.connections.setState(context, {
      status: 'disconnected',
      configured: true,
      serviceEnabled: true,
      suspensionReason: null,
    });
  }

  async reconnect(context: TenantContext) {
    const current = await this.connections.get(context);
    if (current && !current.serviceEnabled)
      throw new Error('whatsapp_suspended');
    if (!current?.phoneExternalId) return this.startPairing(context);
    return this.connect(context);
  }

  async sendText(
    context: TenantContext,
    recipientExternalId: string,
    body: string,
  ) {
    if (!this.config.enabled) throw new Error('whatsapp_disabled');
    const current = await this.connections.get(context);
    if (current && !current.serviceEnabled)
      throw new Error('whatsapp_suspended');
    if (current?.status !== 'connected')
      throw new Error('whatsapp_not_connected');
    this.logger.log(
      `whatsapp outbound send attempted (tenant=${context.tenantId}, recipient=${REDACTED})`,
    );
    return this.provider().sendText(
      context.tenantId,
      recipientExternalId,
      body,
    );
  }

  async suspendForDelinquency(context: TenantContext) {
    const suspended = await this.connections.setState(context, {
      status: 'suspended',
      serviceEnabled: false,
      suspensionReason: 'delinquency',
    });
    await this.provider()
      .disconnect(context.tenantId)
      .catch(() => undefined);
    this.logger.log(
      `whatsapp gateway suspended for delinquency (tenant=${context.tenantId}, sessionPreserved=true)`,
    );
    return suspended;
  }

  async reactivateAfterPayment(context: TenantContext) {
    const current = await this.connections.get(context);
    if (!current?.configured) {
      return this.connections.setState(context, {
        status: 'disconnected',
        serviceEnabled: true,
        suspensionReason: null,
      });
    }
    if (current.authorized && current.phoneExternalId) {
      const alreadyConnected = current.status === 'connected';
      if (!alreadyConnected) return this.connectProvider(context);
      return this.connections.setState(context, {
        status: 'connected',
        serviceEnabled: true,
        suspensionReason: null,
      });
    }
    return this.connections.setState(context, {
      status: 'disconnected',
      serviceEnabled: true,
      suspensionReason: null,
    });
  }
}
