import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElyvionLoggerModule } from '@elyvion/shared';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElyvionLoggerModule.forRoot({ moduleName: 'users' }),
    PrismaModule,
    UsersModule,
    RolesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
