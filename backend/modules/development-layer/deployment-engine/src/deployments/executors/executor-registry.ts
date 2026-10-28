import { Injectable, NotImplementedException } from '@nestjs/common';
import { TargetType } from '../schemas/deployment-target.schema';
import { DeploymentExecutor } from './executor.interface';
import { LocalDockerExecutor } from './local-docker.executor';

/**
 * `aws`/`gcp`/`azure` are declared in `TARGET_TYPES` and selectable in the
 * UI so the target architecture ("in jeder möglichen Cloud deployen
 * können") is visible end-to-end, but none are implemented here — each
 * needs that provider's SDK and real credentials, which this environment
 * doesn't have. Wiring one in means adding one class implementing
 * `DeploymentExecutor` and one line below; nothing else in the module
 * changes.
 */
@Injectable()
export class ExecutorRegistry {
  private readonly executors: Map<TargetType, DeploymentExecutor>;

  constructor(localDocker: LocalDockerExecutor) {
    this.executors = new Map<TargetType, DeploymentExecutor>([[localDocker.type, localDocker]]);
  }

  get(type: TargetType): DeploymentExecutor {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new NotImplementedException(`Deployment-Ziel-Typ "${type}" ist noch nicht implementiert.`);
    }
    return executor;
  }
}
