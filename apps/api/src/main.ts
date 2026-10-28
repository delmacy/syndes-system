import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { registerCsvBodyParser } from './modules/core-crm/csv/csv-body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  registerCsvBodyParser(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
