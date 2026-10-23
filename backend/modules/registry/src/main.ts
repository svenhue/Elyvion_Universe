import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new ElyvionExceptionFilter());
  app.enableCors();

  const port = process.env.PORT ?? 3010;
  await app.listen(port);
  console.log(`[registry] listening on :${port}`);
}
bootstrap();
