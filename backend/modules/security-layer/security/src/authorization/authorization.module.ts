import { Module } from '@nestjs/common';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';
import { RoleResolverService } from './role-resolver.service';
import { OperatorTokenGuard } from './operator-token.guard';
import { SecretsController } from '../secrets/secrets.controller';
import { SecretsService } from '../secrets/secrets.service';
import { WorkloadIdentityService } from '../secrets/workload-identity.service';

@Module({
  controllers: [AuthorizationController, SecretsController],
  providers: [
    AuthorizationService,
    RoleResolverService,
    OperatorTokenGuard,
    SecretsService,
    WorkloadIdentityService,
  ],
})
export class AuthorizationModule {}
