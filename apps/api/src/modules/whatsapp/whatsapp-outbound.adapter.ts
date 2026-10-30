import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type {
  ChannelAdapter,
  ChannelOutboundRequest,
} from '../inbox/channel/inbox-channel.contracts';
import { ChannelAdapterRegistry } from '../inbox/channel/channel-adapter-registry';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import { WhatsAppOutboundQueue } from './whatsapp-outbound.queue';
import { WHATSAPP_CONFIG, type WhatsAppConfig } from './whatsapp.config';

@Injectable()
export class WhatsAppOutboundAdapter implements ChannelAdapter, OnModuleInit {
  readonly adapterId = 'whatsmeow';
  readonly productionProvider = true;

  constructor(
    private readonly registry: ChannelAdapterRegistry,
    private readonly queue: WhatsAppOutboundQueue,
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsAppConfig,
  ) {}

  onModuleInit(): void {
    if (this.config.enabled)
      this.registry.registerProductionAdapter('whatsapp', this);
  }

  dispatchOutbound(request: ChannelOutboundRequest) {
    const context: TenantContext = {
      tenantId: request.accountId,
      databaseName: request.accountDatabaseName,
      actorId: '00000000-0000-4000-8000-0000000000cc',
      role: 'tenant_admin',
      customerScope: 'both',
    };
    return this.queue.dispatch(
      context,
      request.recipientExternalId,
      request.body,
    );
  }
}
