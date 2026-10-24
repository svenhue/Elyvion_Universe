import { JsonPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ActionDescriptor } from './action-schema';
import { ActionsApiService } from './actions-api.service';
import { FrontendActionsService } from './frontend-actions.service';

interface ActionFormField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  value: string;
}

interface ObjectJsonSchema {
  properties?: Record<string, { type?: string }>;
  required?: string[];
}

/**
 * Every action currently available anywhere in the environment — backend
 * ones (in-process or proxied to another module, see actions-engine's
 * RemoteActionsService), and frontend ones (this browser's
 * FrontendActionsService), grouped by the category their owning module
 * gave them. The same catalog a workflow's `action` step and an agent
 * (via MCP) both see — this page is the human-facing view of it, a
 * full-page sibling of the floating assistant widget's narrower Actions
 * tab, for when the list is the point rather than a quick aside.
 */
@Component({
  selector: 'elv-actions-page',
  standalone: true,
  imports: [FormsModule, RouterLink, JsonPipe],
  templateUrl: './actions-page.component.html',
})
export class ActionsPageComponent implements OnInit {
  private readonly actionsApi = inject(ActionsApiService);
  private readonly frontendActions = inject(FrontendActionsService);

  readonly actions = signal<ActionDescriptor[]>([]);
  readonly loadError = signal('');
  readonly selectedAction = signal<ActionDescriptor | null>(null);
  readonly formFields = signal<ActionFormField[]>([]);
  readonly running = signal(false);
  readonly runResult = signal<{ success: boolean; output?: unknown; error?: string } | null>(null);

  readonly groupedActions = computed(() => {
    const groups = new Map<string, ActionDescriptor[]>();
    for (const action of this.actions()) {
      const category = action.category ?? 'Sonstige';
      groups.set(category, [...(groups.get(category) ?? []), action]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  ngOnInit(): void {
    this.actionsApi.list().subscribe({
      next: (actions) => this.actions.set(actions),
      error: () => this.loadError.set('Actions konnten nicht geladen werden.'),
    });
  }

  selectAction(action: ActionDescriptor): void {
    this.selectedAction.set(action);
    this.runResult.set(null);
    const schema = action.inputSchema as ObjectJsonSchema;
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    this.formFields.set(
      Object.entries(properties).map(([key, def]) => ({
        key,
        type: isFormFieldType(def.type) ? def.type : 'string',
        required: required.has(key),
        value: '',
      })),
    );
  }

  updateField(key: string, value: string): void {
    this.formFields.update((fields) => fields.map((field) => (field.key === key ? { ...field, value } : field)));
  }

  async runSelectedAction(): Promise<void> {
    const action = this.selectedAction();
    if (!action) return;
    this.running.set(true);
    this.runResult.set(null);
    try {
      const input: Record<string, unknown> = {};
      for (const field of this.formFields()) {
        if (!field.value) continue;
        input[field.key] = coerceField(field);
      }
      const output =
        action.target === 'frontend'
          ? await this.frontendActions.execute(action.key, input)
          : await firstValueFrom(this.actionsApi.execute(action.key, input));
      this.runResult.set({ success: true, output });
    } catch (error) {
      this.runResult.set({ success: false, error: errorMessage(error, 'Aktion fehlgeschlagen.') });
    } finally {
      this.running.set(false);
    }
  }
}

function isFormFieldType(type: string | undefined): type is ActionFormField['type'] {
  return type === 'number' || type === 'boolean' || type === 'object' || type === 'array';
}

/** Object/array fields are edited as JSON text — parsed here, not sent as a literal string, which is why `add_element`/`update_element`-style actions (whose `element`/`patch` fields are objects) actually work from this form. */
function coerceField(field: ActionFormField): unknown {
  if (field.type === 'number') return Number(field.value) || 0;
  if (field.type === 'boolean') return field.value === 'true';
  if (field.type === 'object' || field.type === 'array') return JSON.parse(field.value);
  return field.value;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return `${fallback} ${error.message}`;
  return fallback;
}
