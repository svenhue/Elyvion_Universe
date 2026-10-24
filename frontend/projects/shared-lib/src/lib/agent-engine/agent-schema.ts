export interface AgentRole {
  name: string;
  system_prompt: string;
  focus: string;
}

export interface TeamSpec {
  reasoning: string;
  agents: AgentRole[];
}

export interface AgentStepResult {
  agent_name: string;
  output: string;
  tool_calls: string[];
}

export type AgentRunStatus = 'running' | 'succeeded' | 'failed';

/** One `agent-engine` run, exactly as it returns it — updated in place while `status` is `"running"`, so polling `GET /runs/:id` shows live progress. */
export interface AgentRun {
  id: string;
  task: string;
  status: AgentRunStatus;
  team: TeamSpec | null;
  steps: AgentStepResult[];
  final_answer: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/** A named, editable prompt a module exposes — currently just agent-engine's own planner prompt, but the mechanism generalizes to any module. */
export interface PromptDef {
  key: string;
  name: string;
  description: string;
  value: string;
}
