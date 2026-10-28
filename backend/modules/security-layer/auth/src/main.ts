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

  // provider.callback() is a Koa app under the hood: it never calls
  // next(), it always writes *some* response (including a 400 for a path
  // it doesn't recognize) — so it can't just be appended after Nest's own
  // routes and rely on "falls through if unmatched". Instead we only
  // delegate to it for paths our own Nest controllers don't own
  // (/health, /interaction/*); everything else — /auth, /token, /jwks,
  // /userinfo, /.well-known/*, etc. — goes to oidc-provider.
  const NEST_OWNED_PATHS = ['/health', '/interaction'];
  app.use((req, res, next) => {
    const ownedByNest = NEST_OWNED_PATHS.some((p) => req.path === p || req.path.startsWith(`${p}/`));
    if (ownedByNest) return next();
    return provider.callback()(req, res, next);
  });

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
