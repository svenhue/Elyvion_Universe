import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElyvionLoggerModule } from '@elyvion/shared';
import { AppController } from './app.controller';
import { ModulesModule } from './modules/modules.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElyvionLoggerModule.forRoot({ moduleName: 'registry' }),
    PrismaModule,
    ModulesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
