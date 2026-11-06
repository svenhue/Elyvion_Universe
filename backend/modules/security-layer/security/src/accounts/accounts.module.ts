import { Module } from '@nestjs/common';
import { OperatorTokenGuard } from '../authorization/operator-token.guard';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { SecurityInternalTokenGuard } from './security-internal-token.guard';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, OperatorTokenGuard, SecurityInternalTokenGuard],
})
export class AccountsModule {}
