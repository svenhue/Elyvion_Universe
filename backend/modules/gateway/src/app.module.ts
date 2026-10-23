import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElyvionLoggerModule } from '@elyvion/shared';
import { AppController } from './app.controller';
import { RegistryModule } from './registry/registry.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElyvionLoggerModule.forRoot({ moduleName: 'gateway' }),
    RegistryModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
