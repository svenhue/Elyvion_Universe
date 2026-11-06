import { Module } from '@nestjs/common';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';
import { RoleResolverService } from './role-resolver.service';
import { OperatorTokenGuard } from './operator-token.guard';
import { SecretsController } from '../secrets/secrets.controller';
import { SecretsService } from '../secrets/secrets.service';
import { WorkloadIdentityService } from '../secrets/workload-identity.service';
import { WorkspacesController } from '../workspaces/workspaces.controller';

@Module({
  controllers: [AuthorizationController, SecretsController, WorkspacesController],
  providers: [
    AuthorizationService,
    RoleResolverService,
    OperatorTokenGuard,
    SecretsService,
    WorkloadIdentityService,
  ],
})
export class AuthorizationModule {}
