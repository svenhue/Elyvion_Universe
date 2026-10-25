export type RuleBlockType = 'filter' | 'aggregate' | 'decision' | 'classify';
export const RULE_BLOCK_TYPES: RuleBlockType[] = ['filter', 'aggregate', 'decision', 'classify'];

/** Each block's own shape varies by `type` (see rules-engine's README) — kept as a loose record here since the editor round-trips it as JSON rather than a per-field form. */
export interface RuleBlock {
  type: RuleBlockType;
  [key: string]: unknown;
}

export interface Rule {
  _id: string;
  key: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  blocks: RuleBlock[];
  outputFormat: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Default starter content for a new block of a given type, so the JSON textarea isn't blank. */
export function defaultBlockFor(type: RuleBlockType): RuleBlock {
  switch (type) {
    case 'filter':
      return { type, condition: { field: '', operator: 'eq', value: '' } };
    case 'aggregate':
      return { type, field: '', function: 'sum' };
    case 'decision':
      return { type, cases: [{ condition: { field: '', operator: 'gte', value: 0 }, result: null }], defaultResult: null };
    case 'classify':
      return {
        type,
        outputField: 'category',
        cases: [{ condition: { field: '', operator: 'eq', value: '' }, result: '' }],
        defaultResult: null,
      };
  }
}
