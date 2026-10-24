import { JsonPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ActionDescriptor } from '../actions/action-schema';
import { ActionsApiService } from '../actions/actions-api.service';
import { FrontendActionsService } from '../actions/frontend-actions.service';
import { ChatApiService } from '../chat/chat-api.service';
import { MessageRecord } from '../chat/chat-schema';

type AssistantTab = 'chat' | 'actions';

interface ActionFormField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  value: string;
}

interface DragState {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

interface ResizeState {
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

/** A JSON Schema object, as `ActionDescriptor.inputSchema` carries it — only the parts a generic form needs. */
interface ObjectJsonSchema {
  properties?: Record<string, { type?: string }>;
  required?: string[];
}

/**
 * The floating "always available" assistant: a square launcher button
 * (bottom-right, fixed) that opens a draggable, resizable panel overlapping
 * the app — never routed, so it works the same on every page. Mounted once
 * from `AppShellComponent`. Drag/resize both reuse the same pointer-capture
 * technique as `WorkflowBuilderComponent`'s canvas (`setPointerCapture` on
 * pointerdown, plain signal updates on pointermove, clear on pointerup) —
 * no new drag mechanism, just the same one applied to the panel's title
 * bar and its resize handle instead of a graph node.
 *
 * The "Actions" tab is this phase's real, working slice: it lists every
 * action `actions-engine` knows about (backend and frontend) and runs one
 * against a form generated from its JSON Schema `inputSchema` — the same
 * registry a workflow's `action` step and an MCP-connected agent both go
 * through. "Chat" is a placeholder; the chat module lands in the next
 * phase.
 */
@Component({
  selector: 'elv-assistant-widget',
  standalone: true,
  imports: [FormsModule, JsonPipe],
  templateUrl: './assistant-widget.component.html',
})
export class AssistantWidgetComponent implements OnInit {
  private readonly actionsApi = inject(ActionsApiService);
  private readonly frontendActions = inject(FrontendActionsService);
  private readonly chatApi = inject(ChatApiService);

  readonly isOpen = signal(false);
  readonly activeTab = signal<AssistantTab>('actions');
  readonly position = signal({ x: 0, y: 0 });
  readonly size = signal({ width: 480, height: 600 });

  readonly actions = signal<ActionDescriptor[]>([]);
  readonly actionsError = signal('');
  readonly selectedAction = signal<ActionDescriptor | null>(null);
  readonly formFields = signal<ActionFormField[]>([]);
  readonly running = signal(false);
  readonly runResult = signal<{ success: boolean; output?: unknown; error?: string } | null>(null);

  readonly conversationId = signal<string | null>(null);
  readonly conversationMode = signal<'chat' | 'agent'>('chat');
  readonly chatMessages = signal<MessageRecord[]>([]);
  readonly chatInput = signal('');
  readonly chatSending = signal(false);
  readonly chatError = signal('');

  private drag: DragState | null = null;
  private resize: ResizeState | null = null;

  ngOnInit(): void {
    this.actionsApi.list().subscribe({
      next: (actions) => this.actions.set(actions),
      error: () => this.actionsError.set('Actions konnten nicht geladen werden.'),
    });
  }

  toggle(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      return;
    }
    const width = Math.min(560, window.innerWidth * 0.5);
    const height = Math.min(720, window.innerHeight * 0.75);
    this.size.set({ width, height });
    this.position.set({ x: window.innerWidth - width - 32, y: window.innerHeight - height - 104 });
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  selectTab(tab: AssistantTab): void {
    this.activeTab.set(tab);
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
        type: isActionFormFieldType(def.type) ? def.type : 'string',
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

  // --- Chat tab ---

  setConversationMode(mode: 'chat' | 'agent'): void {
    this.conversationMode.set(mode);
  }

  /** Drops the current conversation so the next message starts a fresh one — e.g. after switching mode. */
  newConversation(): void {
    this.conversationId.set(null);
    this.chatMessages.set([]);
    this.chatError.set('');
  }

  private async ensureConversation(): Promise<string> {
    const existing = this.conversationId();
    if (existing) return existing;
    const conversation = await firstValueFrom(this.chatApi.create({ mode: this.conversationMode() }));
    this.conversationId.set(conversation.id);
    return conversation.id;
  }

  async sendChatMessage(): Promise<void> {
    const content = this.chatInput().trim();
    if (!content || this.chatSending()) return;
    this.chatSending.set(true);
    this.chatError.set('');
    this.chatInput.set('');
    try {
      const id = await this.ensureConversation();
      this.chatMessages.update((messages) => [
        ...messages,
        { id: `pending-${Date.now()}`, conversationId: id, role: 'user', content, createdAt: new Date().toISOString() },
      ]);
      const reply = await firstValueFrom(this.chatApi.postMessage(id, content));
      this.chatMessages.update((messages) => [...messages, reply]);
    } catch (error) {
      this.chatError.set(errorMessage(error, 'Nachricht konnte nicht gesendet werden.'));
    } finally {
      this.chatSending.set(false);
    }
  }

  // --- Panel: dragging the title bar to reposition it ---

  startDrag(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const position = this.position();
    this.drag = { startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y };
  }

  onDragMove(event: PointerEvent): void {
    if (!this.drag) return;
    this.position.set({
      x: this.drag.originX + (event.clientX - this.drag.startX),
      y: this.drag.originY + (event.clientY - this.drag.startY),
    });
  }

  endDrag(): void {
    this.drag = null;
  }

  // --- Panel: dragging the corner handle to resize it ---

  startResize(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const size = this.size();
    this.resize = { startX: event.clientX, startY: event.clientY, startWidth: size.width, startHeight: size.height };
  }

  onResizeMove(event: PointerEvent): void {
    if (!this.resize) return;
    this.size.set({
      width: Math.max(360, this.resize.startWidth + (event.clientX - this.resize.startX)),
      height: Math.max(280, this.resize.startHeight + (event.clientY - this.resize.startY)),
    });
  }

  endResize(): void {
    this.resize = null;
  }
}

function isActionFormFieldType(type: string | undefined): type is ActionFormField['type'] {
  return type === 'number' || type === 'boolean' || type === 'object' || type === 'array';
}

/** Object/array fields are edited as JSON text — parsed here, not sent as a literal string. */
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
