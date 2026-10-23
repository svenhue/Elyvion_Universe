import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ElyvionExceptionFilter, registerModule } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { createOidcProvider } from './oidc/provider.factory';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3011);
  const issuerUrl = process.env.AUTH_ISSUER_URL ?? `http://localhost:${port}`;
  const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';

  const provider = await createOidcProvider(issuerUrl);

  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(provider), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new ElyvionExceptionFilter());
  app.enableCors();

  // oidc-provider owns /auth, /token, /jwks, /userinfo, /.well-known/openid-configuration, etc.
  // Our Nest controllers own /health and /interaction/*, which don't overlap.
  app.use(provider.callback());

  await app.listen(port);
  console.log(`[auth] listening on :${port}`);
  console.log(`[auth] discovery: ${issuerUrl}/.well-known/openid-configuration`);

  await registerModule({
    registryUrl,
    name: 'auth',
    type: 'ts',
    baseUrl: issuerUrl,
    routePrefix: '/',
    healthCheckUrl: `http://localhost:${port}/health`,
    version: '0.1.0',
  });
}
bootstrap();
