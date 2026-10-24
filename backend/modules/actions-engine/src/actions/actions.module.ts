import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ActionsController } from './actions.controller';
import { ActionsRegistry } from './actions.registry';
import { LogMessageAction } from './builtin/log-message.action';
import { SendEmailAction } from './builtin/send-email.action';
import { FrontendActionsService } from './frontend-actions.service';
import { McpController } from './mcp/mcp.controller';
import { FrontendAction, FrontendActionSchema } from './schemas/frontend-action.schema';

@Module({
  imports: [DiscoveryModule, MongooseModule.forFeature([{ name: FrontendAction.name, schema: FrontendActionSchema }])],
  controllers: [ActionsController, McpController],
  providers: [ActionsRegistry, FrontendActionsService, SendEmailAction, LogMessageAction],
})
export class ActionsModule {}
