import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreCrmModule } from './modules/core-crm/core-crm.module';
import { ManagerModule } from './modules/platform-core/manager/manager.module';
import { PlatformCoreModule } from './modules/platform-core/platform-core.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';

@Module({
  imports: [
    PlatformCoreModule,
    ManagerModule,
    CoreCrmModule,
    InboxModule,
    WhatsAppModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
