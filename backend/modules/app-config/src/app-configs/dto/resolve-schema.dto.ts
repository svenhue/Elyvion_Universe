import { z } from 'zod';

export const resolveSchemaRequestSchema = z.object({
  applicationId: z.string().min(1),
  userId: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type ResolveSchemaRequest = z.infer<typeof resolveSchemaRequestSchema>;

const componentNodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['component', 'element', 'text']).optional(),
    name: z.string().min(1).optional(),
    element: z.string().min(1).optional(),
    text: z.string().optional(),
    position: z
      .object({
        x: z.number().finite(),
        y: z.number().finite(),
        zIndex: z.number().finite().optional(),
        order: z.number().finite().optional(),
      })
      .optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
    children: z.array(z.string()).optional(),
    // Loosely typed here on purpose — the frontend's EventAction union is
    // the source of truth for shape; this layer only needs to round-trip
    // it, not re-validate it.
    events: z.record(z.string(), z.array(z.unknown())).optional(),
  })
  .superRefine((node, context) => {
    const type = node.type ?? (node.name ? 'component' : node.element ? 'element' : 'text');
    if (type === 'component' && !node.name) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Component nodes need a name.' });
    }
    if (type === 'element' && !node.element) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Element nodes need an element tag.' });
    }
    if (type === 'text' && node.text === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Text nodes need text content.' });
    }
  });

export const upsertAppConfigSchema = z.object({
  applicationId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1).default('1.0.0'),
  rootComponentId: z.string().min(1),
  components: z.array(componentNodeSchema),
  // Per-application toggle, owned by the Application Runner: when on,
  // saving this schema also mirrors it into its own ontology (see the
  // frontend's AppOntologySyncService). Off by default — nothing calls
  // the ontology-engine module unless an author opts in.
  ontologySyncEnabled: z.boolean().optional(),
}).superRefine((config, context) => {
  if (!config.components.some((component) => component.id === config.rootComponentId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rootComponentId'],
      message: 'rootComponentId must identify a component in components.',
    });
  }
});

export type UpsertAppConfigDto = z.infer<typeof upsertAppConfigSchema>;
