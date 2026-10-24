import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AgentApiService } from './agent-api.service';
import { AgentRun, PromptDef } from './agent-schema';

type AgentEngineTab = 'agents' | 'prompts';

/**
 * Two tabs behind its own left sub-nav (to the right of the app's main
 * nav, same "shell within a shell" shape the floating assistant panel
 * uses): "Agenten" — every `agent-engine` run, the "active agents" view
 * (a run with `status: "running"` is actively executing right now, each
 * step appearing as its agent finishes — see `agent-engine`'s
 * `router.py`, which streams the LangGraph graph rather than just
 * awaiting its final result); "Prompt-Konfiguration" — every prompt a
 * module exposed as editable (currently just agent-engine's own planner
 * prompt). Polls while anything is running, same shallow poll-and-diff
 * approach as the rest of this project's run views
 * (`WorkflowBuilderComponent`'s run result), not a websocket — simple,
 * and runs here are infrequent enough that polling cost is a non-issue.
 */
@Component({
  selector: 'elv-agent-engine',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './agent-engine.component.html',
})
export class AgentEngineComponent implements OnInit, OnDestroy {
  private readonly agentApi = inject(AgentApiService);

  readonly activeTab = signal<AgentEngineTab>('agents');

  readonly runs = signal<AgentRun[]>([]);
  readonly selectedRunId = signal<string | null>(null);
  readonly selectedRun = signal<AgentRun | null>(null);
  readonly loadError = signal('');
  readonly newTask = signal('');
  readonly starting = signal(false);

  readonly prompts = signal<PromptDef[]>([]);
  readonly editingPromptKey = signal<string | null>(null);
  readonly editingValue = signal('');
  readonly savingPrompt = signal(false);

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadRuns();
    this.loadPrompts();
    this.pollHandle = setInterval(() => this.poll(), 2000);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  selectTab(tab: AgentEngineTab): void {
    this.activeTab.set(tab);
  }

  private loadRuns(): void {
    this.agentApi.listRuns().subscribe({
      next: (runs) => this.runs.set(runs),
      error: () => this.loadError.set('Läufe konnten nicht geladen werden.'),
    });
  }

  private poll(): void {
    this.loadRuns();
    const id = this.selectedRunId();
    if (id && this.selectedRun()?.status === 'running') {
      this.agentApi.getRun(id).subscribe({ next: (run) => this.selectedRun.set(run) });
    }
  }

  selectRun(run: AgentRun): void {
    this.selectedRunId.set(run.id);
    this.selectedRun.set(run);
  }

  async startRun(): Promise<void> {
    const task = this.newTask().trim();
    if (!task || this.starting()) return;
    this.starting.set(true);
    this.loadError.set('');
    try {
      const run = await firstValueFrom(this.agentApi.startRun(task));
      this.newTask.set('');
      this.runs.update((runs) => [run, ...runs]);
      this.selectRun(run);
    } catch (error) {
      this.loadError.set(errorMessage(error, 'Lauf konnte nicht gestartet werden.'));
    } finally {
      this.starting.set(false);
    }
  }

  // --- Prompt-Konfiguration ---

  private loadPrompts(): void {
    this.agentApi.listPrompts().subscribe({
      next: (prompts) => this.prompts.set(prompts),
      error: () => this.loadError.set('Prompts konnten nicht geladen werden.'),
    });
  }

  startEditPrompt(prompt: PromptDef): void {
    this.editingPromptKey.set(prompt.key);
    this.editingValue.set(prompt.value);
  }

  cancelEditPrompt(): void {
    this.editingPromptKey.set(null);
  }

  async savePrompt(): Promise<void> {
    const key = this.editingPromptKey();
    if (!key || this.savingPrompt()) return;
    this.savingPrompt.set(true);
    try {
      const updated = await firstValueFrom(this.agentApi.updatePrompt(key, this.editingValue()));
      this.prompts.update((prompts) => prompts.map((prompt) => (prompt.key === key ? updated : prompt)));
      this.editingPromptKey.set(null);
    } catch (error) {
      this.loadError.set(errorMessage(error, 'Prompt konnte nicht gespeichert werden.'));
    } finally {
      this.savingPrompt.set(false);
    }
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return `${fallback} ${error.message}`;
  return fallback;
}
