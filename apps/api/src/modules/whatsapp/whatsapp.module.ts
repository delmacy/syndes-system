import { Module } from '@nestjs/common';
import { CoreCrmModule } from '../core-crm/core-crm.module';
import { InboxModule } from '../inbox/inbox.module';
import { PlatformCoreModule } from '../platform-core/platform-core.module';
import { readWhatsAppConfig, WHATSAPP_CONFIG } from './whatsapp.config';
import { WhatsAppConnectionService } from './whatsapp-connection.service';
import { FakeWhatsAppProvider } from './fake-whatsapp.provider';
import { WhatsAppSessionService } from './whatsapp-session.service';
import { WhatsmeowProvider } from './whatsmeow.provider';
import { WhatsAppAuditWriter } from './whatsapp-audit';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppRateLimiter } from './whatsapp-rate-limiter';
import { WhatsAppOutboundQueue } from './whatsapp-outbound.queue';
import { WhatsAppOutboundAdapter } from './whatsapp-outbound.adapter';

@Module({
  imports: [PlatformCoreModule, CoreCrmModule, InboxModule],
  controllers: [WhatsAppController, WhatsAppWebhookController],
  providers: [
    {
      provide: WHATSAPP_CONFIG,
      useFactory: () => readWhatsAppConfig(process.env),
    },
    WhatsAppConnectionService,
    FakeWhatsAppProvider,
    WhatsmeowProvider,
    WhatsAppSessionService,
    WhatsAppAuditWriter,
    WhatsAppRateLimiter,
    WhatsAppOutboundQueue,
    WhatsAppOutboundAdapter,
  ],
  exports: [WHATSAPP_CONFIG, WhatsAppConnectionService, WhatsAppSessionService],
})
export class WhatsAppModule {}
