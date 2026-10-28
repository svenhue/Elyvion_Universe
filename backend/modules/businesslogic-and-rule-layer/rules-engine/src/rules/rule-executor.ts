import { BadRequestException } from '@nestjs/common';
import { evaluateCondition } from './condition';
import { AggregateBlock, ClassifyBlock, DecisionBlock, FilterBlock, RuleBlock } from './rule-block';

/** Runs every block in order, each one's output feeding the next — the rule's own `input` feeds the first block. */
export function runRule(blocks: RuleBlock[], input: unknown): unknown {
  return blocks.reduce((value, block) => runBlock(block, value), input);
}

function runBlock(block: RuleBlock, value: unknown): unknown {
  switch (block.type) {
    case 'filter':
      return runFilter(block, value);
    case 'aggregate':
      return runAggregate(block, value);
    case 'decision':
      return runDecision(block, value);
    case 'classify':
      return runClassify(block, value);
  }
}

function asRecordArray(value: unknown, blockType: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException(`"${blockType}"-Block erwartet eine Liste als Eingabe, bekam: ${typeof value}.`);
  }
  return value as Record<string, unknown>[];
}

function asRecord(value: unknown, blockType: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException(`"${blockType}"-Block erwartet ein einzelnes Objekt als Eingabe.`);
  }
  return value as Record<string, unknown>;
}

function runFilter(block: FilterBlock, value: unknown): Record<string, unknown>[] {
  return asRecordArray(value, 'filter').filter((record) => evaluateCondition(record, block.condition));
}

function runAggregate(block: AggregateBlock, value: unknown): unknown {
  const records = asRecordArray(value, 'aggregate');
  if (!block.groupBy) return aggregate(records, block.field, block.function);

  const groups = new Map<string, Record<string, unknown>[]>();
  for (const record of records) {
    const key = String(record[block.groupBy] ?? 'null');
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  return Object.fromEntries([...groups.entries()].map(([key, group]) => [key, aggregate(group, block.field, block.function)]));
}

function aggregate(records: Record<string, unknown>[], field: string, fn: AggregateBlock['function']): number {
  if (fn === 'count') return records.length;
  const numbers = records.map((r) => r[field]).filter((v): v is number => typeof v === 'number');
  if (numbers.length === 0) return 0;
  switch (fn) {
    case 'sum':
      return numbers.reduce((sum, n) => sum + n, 0);
    case 'avg':
      return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
  }
}

/** First matching case wins, evaluated top to bottom — a threshold/approval ladder like "ab 10.000 € → Y, ab 5.000 € → X, sonst → kein Approval nötig". */
function runDecision(block: DecisionBlock, value: unknown): unknown {
  const record = asRecord(value, 'decision');
  const match = block.cases.find((c) => evaluateCondition(record, c.condition));
  return match ? match.result : block.defaultResult;
}

function runClassify(block: ClassifyBlock, value: unknown): Record<string, unknown>[] {
  return asRecordArray(value, 'classify').map((record) => {
    const match = block.cases.find((c) => evaluateCondition(record, c.condition));
    return { ...record, [block.outputField]: match ? match.result : block.defaultResult };
  });
}
