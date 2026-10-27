import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreCrmModule } from './modules/core-crm/core-crm.module';
import { ManagerModule } from './modules/platform-core/manager/manager.module';
import { PlatformCoreModule } from './modules/platform-core/platform-core.module';

@Module({
  imports: [PlatformCoreModule, ManagerModule, CoreCrmModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
