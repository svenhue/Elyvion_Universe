import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * What kind of thing a member reference points at — every object type
 * the platform manages (app-config, workflow-engine, agent-engine,
 * actions-engine, rules-engine, ontology-engine, data-engine, and
 * `repository`/`solution` themselves). Shared verbatim with the
 * `repository` module's own `RepositoryMember` — both are just typed
 * references into the owning module, never a copy.
 *
 * Named "ResourceType" in code even though "Resource" is already how
 * the `security` module calls a backend module acting as a permission
 * boundary — a *different* concept. Kept scoped to `SolutionMember`/
 * `RepositoryMember` (never exported as a bare top-level "Resource")
 * to keep the two apart.
 */
export const RESOURCE_TYPES = [
  'application',
  'workflow',
  'agent',
  'knowledge_graph',
  'entity',
  'action',
  'rule',
  'repository',
  'solution',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export class SolutionMember {
  @Prop({ enum: RESOURCE_TYPES, required: true })
  resourceType!: ResourceType;

  /** The member's own natural key in its owning module (an app-config applicationId, a workflow key, an agent-engine config id, an ontology-engine knowledge-graph key, a data-engine entity name). */
  @Prop({ required: true })
  resourceKey!: string;

  /** Display label, purely presentational — the owning module remains the source of truth for the member's actual name. */
  @Prop()
  label?: string;
}

/**
 * A named, deployable bundle of apps/workflows/agents/knowledge
 * graphs/entities — "eine Ressource kann aus beliebig vielen Apps,
 * Workflows, AI-Agents bestehen... und diese kann ich dann gesamthaft
 * unter ein Deployment deployen." Called "Solution" in code (German UI
 * label: "Lösung") specifically to avoid colliding with `security`'s
 * "Resource" (a backend module as a permission boundary) — a real risk
 * since the user's own term for this ("Ressource") is the same word.
 */
@Schema({ timestamps: true })
export class Solution {
  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  /** Set when this Solution is the deploy-snapshot of a `repository` module Repository — see "Repository deployen". */
  @Prop()
  sourceRepositoryKey?: string;

  @Prop({ type: [SolutionMember], default: [] })
  members!: SolutionMember[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type SolutionDocument = Solution & Document;
export const SolutionSchema = SchemaFactory.createForClass(Solution);
