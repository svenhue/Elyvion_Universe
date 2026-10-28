import { Module } from '@nestjs/common';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';
import { RoleResolverService } from './role-resolver.service';

@Module({
  controllers: [AuthorizationController],
  providers: [AuthorizationService, RoleResolverService],
})
export class AuthorizationModule {}
