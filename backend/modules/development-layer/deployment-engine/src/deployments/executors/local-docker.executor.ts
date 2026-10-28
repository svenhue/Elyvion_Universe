import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { promisify } from 'util';
import { DeploymentExecutor, DeploymentHandle } from './executor.interface';
import { findFreePort } from './find-free-port';

const execAsync = promisify(exec);

const DOCKERFILE_NAME = 'Dockerfile.elyvion-deployment';
const DOCKERFILE_CONTENTS = 'FROM nginx:alpine\nCOPY . /usr/share/nginx/html\nEXPOSE 80\n';

/**
 * Phase 1 of the deployment-engine concept ("erstmal lokal testen"):
 * packages the already-built client bundle into an nginx image and runs
 * it as a container on the local Docker daemon via the `docker` CLI —
 * no cloud credentials, no registry push, just `docker build` + `docker
 * run` against a free local port.
 *
 * This deploys *the* client app (today's App-Builder is one global app,
 * not yet multiple named apps), not a specific `applicationId` — once
 * multiple named apps exist, this is the one place that needs to change
 * to build a per-app bundle instead of the shared one.
 */
@Injectable()
export class LocalDockerExecutor implements DeploymentExecutor {
  readonly type = 'local-docker' as const;
  private readonly logger = new Logger(LocalDockerExecutor.name);
  private readonly clientDistPath = resolve(
    process.env.CLIENT_DIST_PATH?.trim() || join(process.cwd(), '../../../frontend/dist/client/browser'),
  );

  validateConfig(): void {
    if (!existsSync(this.clientDistPath)) {
      throw new InternalServerErrorException(
        `Client-Build nicht gefunden unter "${this.clientDistPath}". Erst "npm run build:lib && ng build client" im frontend-Ordner ausführen.`,
      );
    }
  }

  async deploy(deploymentName: string, _config: Record<string, unknown>): Promise<DeploymentHandle> {
    this.validateConfig();
    const imageTag = `elyvion-deployment-${sanitize(deploymentName)}`;
    const containerName = imageTag;
    const port = await findFreePort(4100);

    writeFileSync(join(this.clientDistPath, DOCKERFILE_NAME), DOCKERFILE_CONTENTS);
    await execAsync(`docker build -t ${imageTag} -f ${DOCKERFILE_NAME} .`, { cwd: this.clientDistPath });
    await execAsync(`docker rm -f ${containerName}`).catch(() => undefined); // clear a stale container from a previous deploy of the same name
    const { stdout } = await execAsync(`docker run -d --name ${containerName} -p ${port}:80 ${imageTag}`);

    this.logger.log(`Deployed "${deploymentName}" as container ${containerName} on port ${port}`);
    return { handle: stdout.trim(), port, url: `http://localhost:${port}/` };
  }

  async stop(handle: string, _config: Record<string, unknown>): Promise<void> {
    await execAsync(`docker stop ${handle}`).catch((err) => this.logger.warn(`docker stop failed: ${err.message}`));
  }

  async getStatus(handle: string, _config: Record<string, unknown>): Promise<'running' | 'stopped' | 'unknown'> {
    try {
      const { stdout } = await execAsync(`docker inspect --format '{{.State.Status}}' ${handle}`);
      const state = stdout.trim();
      return state === 'running' ? 'running' : 'stopped';
    } catch {
      return 'unknown';
    }
  }
}

function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}
