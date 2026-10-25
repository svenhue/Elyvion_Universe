import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * What kind of thing a member reference points at — each type's actual
 * record lives in its own module (app-config, workflow-engine,
 * agent-engine, ontology-engine, data-engine); a Solution only ever
 * holds a reference (`resourceType` + `resourceKey`), never a copy.
 * Named "ResourceType" in code because "Resource" is already how the
 * `security` module calls a backend module acting as a permission
 * boundary — a *different* concept from a Solution member — so this
 * type lives entirely inside `SolutionMember`, never exported standalone,
 * to keep the two apart.
 */
export const SOLUTION_MEMBER_TYPES = ['application', 'workflow', 'agent', 'knowledge_graph', 'entity'] as const;
export type SolutionMemberType = (typeof SOLUTION_MEMBER_TYPES)[number];

export class SolutionMember {
  @Prop({ enum: SOLUTION_MEMBER_TYPES, required: true })
  resourceType!: SolutionMemberType;

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

  @Prop({ type: [SolutionMember], default: [] })
  members!: SolutionMember[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type SolutionDocument = Solution & Document;
export const SolutionSchema = SchemaFactory.createForClass(Solution);
