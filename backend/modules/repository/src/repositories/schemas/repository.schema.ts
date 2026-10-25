import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * What kind of thing a member reference points at — identical union to
 * `solutions`' own `ResourceType` (deliberately duplicated, not imported
 * across modules: each NestJS module here is deployed independently).
 * Named "ResourceType" rather than bare "Resource" for the same reason as
 * in `solutions` — `security` already uses "Resource" for a backend module
 * acting as a permission boundary, a different concept.
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

export class RepositoryMemberOrigin {
  @Prop({ enum: RESOURCE_TYPES, required: true })
  resourceType!: ResourceType;

  @Prop({ required: true })
  resourceKey!: string;
}

export class RepositoryMember {
  @Prop({ enum: RESOURCE_TYPES, required: true })
  resourceType!: ResourceType;

  /** The member's own natural key in its owning module — same key whether this member was authored here directly or copied in. */
  @Prop({ required: true })
  resourceKey!: string;

  @Prop()
  label?: string;

  /**
   * Set only when this member is a *copy* of another resource (e.g. "copy
   * this Workflow-Definition from the Kernrepository into this Repository")
   * rather than something authored here directly. Lets the owning module's
   * edit UI find every copy of a given resource and offer to update them
   * too when the original changes — see `RepositoriesService.copiesOf`.
   */
  @Prop({ type: RepositoryMemberOrigin })
  copiedFrom?: RepositoryMemberOrigin;
}

/**
 * A named, Mongo-backed bundle of Workflow-/Entity-/Application-/Action-/
 * Rule-definitions — "ein Repository kann aus Workflow-Definition,
 * Entitätsdefinition, Anwendungsdefinition, Aktionsdefinition oder Logik
 * bestehen." Distinct from `solutions`' Solution: a Repository is the
 * editable, evolving definition-bundle (design time); deploying one
 * snapshots its members onto a Solution (deploy time) — see
 * `POST /repositories/:key/deploy`.
 *
 * The "Kernrepository" — where every object lives *by default* — is
 * deliberately NOT a document here: it's the implicit union of every
 * object that exists anywhere on the platform, computed by the frontend
 * from each owning module's own list endpoint, not a membership list
 * this module would have to keep in sync via hooks into five other
 * modules. Only user-created, *curated* repositories are real documents.
 */
@Schema({ timestamps: true })
export class Repository {
  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ type: [RepositoryMember], default: [] })
  members!: RepositoryMember[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type RepositoryDocument = Repository & Document;
export const RepositorySchema = SchemaFactory.createForClass(Repository);
