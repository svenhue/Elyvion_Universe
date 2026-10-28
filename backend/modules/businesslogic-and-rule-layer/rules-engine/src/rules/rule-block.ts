import { z } from 'zod';
import { CONDITION_OPERATORS } from './condition';

/**
 * A rule is an ordered pipeline of blocks — each one's output becomes
 * the next one's input (the first block receives the rule's own
 * `input`). Four block types cover the two concrete cases this was
 * built for:
 * - `filter` / `aggregate`: "Kolumnfilter" / "Aggregierung" over a
 *   collection (e.g. categorizing data-engine entities by some rule).
 * - `decision`: a threshold/approval ladder over ONE record — "ab
 *   5.000 € muss X freigeben, ab 10.000 € muss Y freigeben": the first
 *   matching case wins, evaluated top to bottom.
 * - `classify`: the same ladder, but applied to EVERY element of a
 *   collection, annotating each with the matching case's result
 *   instead of returning just one value — "Customer-Gruppen basierend
 *   auf Regeln kategorisieren."
 */
const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.unknown(),
});

const decisionCaseSchema = z.object({
  condition: conditionSchema,
  result: z.unknown(),
});

export const filterBlockSchema = z.object({
  type: z.literal('filter'),
  condition: conditionSchema,
});

export const aggregateBlockSchema = z.object({
  type: z.literal('aggregate'),
  groupBy: z.string().optional(),
  field: z.string().min(1),
  function: z.enum(['sum', 'count', 'avg', 'min', 'max']),
});

export const decisionBlockSchema = z.object({
  type: z.literal('decision'),
  cases: z.array(decisionCaseSchema).min(1),
  defaultResult: z.unknown().optional(),
});

export const classifyBlockSchema = z.object({
  type: z.literal('classify'),
  outputField: z.string().min(1),
  cases: z.array(decisionCaseSchema).min(1),
  defaultResult: z.unknown().optional(),
});

export const ruleBlockSchema = z.discriminatedUnion('type', [
  filterBlockSchema,
  aggregateBlockSchema,
  decisionBlockSchema,
  classifyBlockSchema,
]);

export type FilterBlock = z.infer<typeof filterBlockSchema>;
export type AggregateBlock = z.infer<typeof aggregateBlockSchema>;
export type DecisionBlock = z.infer<typeof decisionBlockSchema>;
export type ClassifyBlock = z.infer<typeof classifyBlockSchema>;
export type RuleBlock = z.infer<typeof ruleBlockSchema>;
