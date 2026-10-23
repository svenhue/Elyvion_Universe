import { DynamicModule, Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

export const JWT_AUTH_GUARD = 'ELYVION_JWT_AUTH_GUARD';

export interface ElyvionAuthModuleOptions {
  issuerUrl: string;
}

/**
 * Wires the shared JwtAuthGuard with this module's OIDC issuer URL.
 * Usage: imports: [ElyvionAuthModule.forRoot({ issuerUrl: config.AUTH_ISSUER_URL })]
 * then inject with @Inject(JWT_AUTH_GUARD) or apply as `@UseGuards(JwtAuthGuard)`
 * after binding it through APP_GUARD in the consuming module.
 */
@Module({})
export class ElyvionAuthModule {
  static forRoot(options: ElyvionAuthModuleOptions): DynamicModule {
    return {
      module: ElyvionAuthModule,
      providers: [
        {
          provide: JWT_AUTH_GUARD,
          useValue: new JwtAuthGuard(options.issuerUrl),
        },
      ],
      exports: [JWT_AUTH_GUARD],
      global: true,
    };
  }
}
