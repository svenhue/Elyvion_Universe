import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElyvionLoggerModule } from '@elyvion/shared';
import type Provider from 'oidc-provider';
import { AppController } from './app.controller';
import { InteractionsController } from './interactions/interactions.controller';
import { OIDC_PROVIDER } from './oidc/oidc.constants';
import { UsersModule } from './users/users.module';

@Module({})
export class AppModule {
  static forRoot(provider: Provider): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ElyvionLoggerModule.forRoot({ moduleName: 'auth' }),
        UsersModule,
      ],
      controllers: [AppController, InteractionsController],
      providers: [{ provide: OIDC_PROVIDER, useValue: provider }],
    };
  }
}
