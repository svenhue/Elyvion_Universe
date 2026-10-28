import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';
import { ExecutorRegistry } from './executors/executor-registry';
import { LocalDockerExecutor } from './executors/local-docker.executor';
import { Deployment, DeploymentSchema } from './schemas/deployment.schema';
import { DeploymentTarget, DeploymentTargetSchema } from './schemas/deployment-target.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeploymentTarget.name, schema: DeploymentTargetSchema },
      { name: Deployment.name, schema: DeploymentSchema },
    ]),
  ],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, ExecutorRegistry, LocalDockerExecutor],
})
export class DeploymentsModule {}
