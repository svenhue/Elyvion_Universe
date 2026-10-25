import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RulesEngineApiService } from './rules-engine-api.service';
import { RULE_BLOCK_TYPES, Rule, RuleBlockType, defaultBlockFor } from './rules-engine-schema';

/**
 * The "Logik" page — business-rule authoring. A rule's `blocks` pipeline
 * is edited as one JSON array rather than a bespoke form per block type:
 * four block shapes (filter/aggregate/decision/classify, see
 * rules-engine's README) would mean four different editors for not much
 * real gain over a textarea, matching this project's established
 * pattern for structurally-varying config (e.g. Data-Adapters'
 * connectionConfig).
 */
@Component({
  selector: 'elv-rules-engine',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './rules-engine.component.html',
})
export class RulesEngineComponent implements OnInit {
  private readonly api = inject(RulesEngineApiService);

  readonly blockTypes = RULE_BLOCK_TYPES;
  readonly rules = signal<Rule[]>([]);
  readonly selectedKey = signal<string | null>(null);
  readonly loadError = signal('');

  readonly newKey = signal('');
  readonly newName = signal('');
  readonly newDescription = signal('');
  readonly creating = signal(false);

  readonly blocksJson = signal('[]');
  readonly blocksError = signal('');
  readonly savingBlocks = signal(false);

  readonly testInputJson = signal('{}');
  readonly testResult = signal<string | null>(null);
  readonly testError = signal('');
  readonly running = signal(false);

  readonly selectedRule = computed(() => this.rules().find((r) => r.key === this.selectedKey()) ?? null);

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.api.list().subscribe({
      next: (rules) => this.rules.set(rules),
      error: () => this.loadError.set('Regeln konnten nicht geladen werden.'),
    });
  }

  select(key: string): void {
    this.selectedKey.set(key);
    const rule = this.rules().find((r) => r.key === key);
    this.blocksJson.set(JSON.stringify(rule?.blocks ?? [], null, 2));
    this.blocksError.set('');
    this.testResult.set(null);
    this.testError.set('');
  }

  async createRule(): Promise<void> {
    const key = this.newKey().trim();
    const name = this.newName().trim();
    if (!key || !name || this.creating()) return;
    this.creating.set(true);
    try {
      const created = await firstValueFrom(this.api.create(key, name, this.newDescription().trim() || undefined));
      this.newKey.set('');
      this.newName.set('');
      this.newDescription.set('');
      this.rules.update((rules) => [...rules, created]);
      this.select(created.key);
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Regel konnte nicht angelegt werden.');
    } finally {
      this.creating.set(false);
    }
  }

  async removeRule(key: string): Promise<void> {
    await firstValueFrom(this.api.remove(key));
    this.rules.update((rules) => rules.filter((r) => r.key !== key));
    if (this.selectedKey() === key) this.selectedKey.set(null);
  }

  addBlock(type: RuleBlockType): void {
    try {
      const blocks = JSON.parse(this.blocksJson() || '[]');
      blocks.push(defaultBlockFor(type));
      this.blocksJson.set(JSON.stringify(blocks, null, 2));
    } catch {
      this.blocksError.set('Aktuelles JSON ist ungültig — erst korrigieren, bevor ein Block hinzugefügt wird.');
    }
  }

  async saveBlocks(): Promise<void> {
    const key = this.selectedKey();
    if (!key || this.savingBlocks()) return;
    this.blocksError.set('');
    this.savingBlocks.set(true);
    try {
      const blocks = JSON.parse(this.blocksJson());
      const updated = await firstValueFrom(this.api.updateBlocks(key, blocks));
      this.rules.update((rules) => rules.map((r) => (r.key === key ? updated : r)));
    } catch (error) {
      this.blocksError.set(error instanceof Error ? error.message : 'Blöcke konnten nicht gespeichert werden.');
    } finally {
      this.savingBlocks.set(false);
    }
  }

  async runTest(): Promise<void> {
    const key = this.selectedKey();
    if (!key || this.running()) return;
    this.testError.set('');
    this.testResult.set(null);
    this.running.set(true);
    try {
      const input = JSON.parse(this.testInputJson());
      const output = await firstValueFrom(this.api.execute(key, input));
      this.testResult.set(JSON.stringify(output, null, 2));
    } catch (error) {
      this.testError.set(error instanceof Error ? error.message : 'Regel-Ausführung fehlgeschlagen.');
    } finally {
      this.running.set(false);
    }
  }
}
