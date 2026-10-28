import { Injectable, ServiceUnavailableException } from '@nestjs/common';

interface AgentRole {
  name: string;
  system_prompt: string;
  focus: string;
}

interface TeamSpec {
  reasoning: string;
  agents: AgentRole[];
}

interface AgentStepResult {
  agent_name: string;
  output: string;
  tool_calls: string[];
}

export interface AgentRunResult {
  id: string;
  task: string;
  team: TeamSpec;
  steps: AgentStepResult[];
  final_answer: string;
}

/**
 * Calls `agent-engine` directly via a Registry lookup — the same
 * service-to-service pattern `workflow-engine`'s processor uses for its
 * `call-service` step, not the gateway's `/api/...` proxy. A multi-agent
 * run can run several sequential LLM calls (each potentially with its own
 * tool round trips) well past the gateway proxy's 10s timeout, and this
 * is backend-to-backend traffic anyway, not something a browser calls
 * directly.
 */
@Injectable()
export class AgentEngineClient {
  private readonly registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';

  async run(task: string): Promise<AgentRunResult> {
    const moduleInfo = await this.lookupModule('agent-engine');
    const prefix = moduleInfo.routePrefix === '/' ? '' : moduleInfo.routePrefix;
    const response = await fetch(`${moduleInfo.baseUrl}${prefix}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task }),
    });
    if (!response.ok) {
      const body = (await safeJson(response)) as { error?: { message?: string } } | null;
      const message = body?.error?.message ?? `HTTP ${response.status}`;
      throw new ServiceUnavailableException(`agent-engine: ${message}`);
    }
    return (await response.json()) as AgentRunResult;
  }

  private async lookupModule(name: string): Promise<{ baseUrl: string; routePrefix: string }> {
    const response = await fetch(`${this.registryUrl}/modules/${name}`);
    if (!response.ok) {
      throw new ServiceUnavailableException(`Service "${name}" ist nicht registriert.`);
    }
    const envelope = (await response.json()) as { data: { baseUrl: string; routePrefix: string } };
    return envelope.data;
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Renders an `AgentRunResult` as one readable assistant message. */
export function formatAgentRunResult(result: AgentRunResult): string {
  const teamLine = `**Team:** ${result.team.agents.map((agent) => agent.name).join(', ')}`;
  const reasoning = `_${result.team.reasoning}_`;
  const steps = result.steps
    .map((step) => `**${step.agent_name}:** ${step.output}`)
    .join('\n\n');
  return [teamLine, reasoning, steps, `**Antwort:** ${result.final_answer}`].filter(Boolean).join('\n\n');
}
