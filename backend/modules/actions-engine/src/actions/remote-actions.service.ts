import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RegisterRemoteActionDto } from './dto/actions.dto';
import {
  RemoteAction,
  RemoteActionDocument,
} from './schemas/remote-action.schema';

export interface RemoteActionDescriptor {
  key: string;
  name: string;
  description: string;
  category?: string;
  inputSchema: Record<string, unknown>;
  requiredPermission?: string;
  /** Reported as `"backend"`, same as an in-process action — a caller shouldn't have to care that this one's handler lives in another module. */
  target: 'backend';
}

/**
 * Actions owned and implemented by another backend module — any module
 * can call `POST /remote-actions` at boot (mirroring how it already
 * self-registers with the Registry) to expose one of its own endpoints
 * as a callable, MCP-visible action, with no code in actions-engine
 * itself. `execute()` delegates the module call to workflow-engine's
 * single-task runner, substituting `{param}` placeholders in `path`
 * from the input before whatever's left becomes the request body.
 */
@Injectable()
export class RemoteActionsService {
  private readonly registryUrl =
    process.env.REGISTRY_URL ?? 'http://localhost:3010';

  constructor(
    @InjectModel(RemoteAction.name)
    private readonly model: Model<RemoteActionDocument>,
  ) {}

  async upsert(dto: RegisterRemoteActionDto): Promise<RemoteActionDescriptor> {
    const doc = await this.model
      .findOneAndUpdate(
        { key: dto.key },
        { ...dto, updatedAt: new Date() },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
    return toDescriptor(doc!);
  }

  async list(): Promise<RemoteActionDescriptor[]> {
    return (await this.model.find().lean()).map(toDescriptor);
  }

  async findOne(key: string): Promise<RemoteActionDocument | null> {
    return this.model.findOne({ key });
  }

  async execute(
    action: RemoteActionDocument,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const workflowEngine = await this.lookupModule('workflow-engine');
    const prefix =
      workflowEngine.routePrefix === '/' ? '' : workflowEngine.routePrefix;
    const { path, body } = resolvePath(action.path, input);
    const method = action.method ?? 'POST';
    const url = `${workflowEngine.baseUrl}${prefix}/tasks/execute`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        step: {
          id: action.key,
          type: 'call-service',
          serviceName: action.moduleName,
          path,
          method,
          body: method === 'GET' || method === 'DELETE' ? undefined : body,
        },
      }),
    });
    const parsed = await safeJson(response);
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Workflow-Task für Action "${action.key}" fehlgeschlagen: ${JSON.stringify(parsed)}`,
      );
    }

    const result = (
      parsed as { data?: { status: number; body: unknown } } | null
    )?.data;
    if (!result || typeof result.status !== 'number') {
      throw new ServiceUnavailableException(
        `Workflow-Task für Action "${action.key}" lieferte eine ungültige Antwort.`,
      );
    }
    if (result.status < 200 || result.status >= 300) {
      throw new ServiceUnavailableException(
        `Action "${action.key}" (${action.moduleName}) fehlgeschlagen: ${JSON.stringify(result.body)}`,
      );
    }
    return (result.body as { data?: unknown } | null)?.data ?? result.body;
  }

  private async lookupModule(
    name: string,
  ): Promise<{ baseUrl: string; routePrefix: string }> {
    const response = await fetch(`${this.registryUrl}/modules/${name}`);
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Modul "${name}" ist nicht registriert.`,
      );
    }
    const envelope = (await response.json()) as {
      data: { baseUrl: string; routePrefix: string };
    };
    return envelope.data;
  }
}

function resolvePath(
  template: string,
  input: Record<string, unknown>,
): { path: string; body: Record<string, unknown> } {
  const body = { ...input };
  const path = template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = body[key];
    delete body[key];
    return encodeURIComponent(String(value ?? ''));
  });
  return { path, body };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toDescriptor(doc: RemoteAction): RemoteActionDescriptor {
  return {
    key: doc.key,
    name: doc.name,
    description: doc.description,
    category: doc.category,
    inputSchema: doc.inputSchema,
    requiredPermission: doc.requiredPermission,
    target: 'backend',
  };
}
