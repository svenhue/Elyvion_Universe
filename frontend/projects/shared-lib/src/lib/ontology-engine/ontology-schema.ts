/**
 * Mirrors the `ontology-engine` backend module's Pydantic schemas
 * field-for-field (same frontend/backend schema-pair pattern as this
 * project's other modules, e.g. `DynamicAppSchema` / workflow's
 * `WorkflowStep`). `attributes` can only hold scalars — Neo4j node and
 * relationship properties can't be nested objects, so that's a real
 * constraint of the graph itself, not a simplification here.
 */
export type OntologyAttributeValue = string | number | boolean;
export type OntologyAttributes = Record<string, OntologyAttributeValue>;

/**
 * Which ontology *template* this is — what node/relationship `type`
 * vocabulary to expect, and (future work) what a validator checks it
 * against. Not a closed union on purpose: new ontology types get added
 * by whatever introduces them (a sync service, a user), not by editing
 * this module. `"angular_app_config"` is the first one, produced by
 * `AppOntologySyncService` from a pro-code application's own schema.
 */
export type OntologyType = 'angular_app_config' | 'custom' | (string & {});

export interface Ontology {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  type: OntologyType;
  /** The key of the formal Ontology this knowledge graph's node/edge types should conform to — see `platform-ontology` and `OntologyApiService.validateGraph`. */
  conforms_to?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OntologyCreatePayload {
  key: string;
  name: string;
  description?: string;
  type?: OntologyType;
  conforms_to?: string;
}

export interface OntologyNode {
  id: string;
  ontology_key: string;
  type: string;
  name: string;
  attributes: OntologyAttributes;
  x: number;
  y: number;
  created_at: string;
  updated_at: string;
}

export interface OntologyNodeCreatePayload {
  type: string;
  name: string;
  attributes?: OntologyAttributes;
  x?: number;
  y?: number;
  /** Reuse an external id (e.g. a pro-code component's own node id) so re-creating it upserts instead of duplicating — see the backend's `create_node`. */
  id?: string;
}

export interface OntologyNodeUpdatePayload {
  type?: string;
  name?: string;
  attributes?: OntologyAttributes;
  x?: number;
  y?: number;
}

export interface OntologyEdge {
  id: string;
  ontology_key: string;
  source_id: string;
  target_id: string;
  type: string;
  attributes: OntologyAttributes;
  created_at: string;
}

export interface OntologyEdgeCreatePayload {
  source_id: string;
  target_id: string;
  type: string;
  attributes?: OntologyAttributes;
}

export interface OntologyEdgeUpdatePayload {
  type?: string;
  attributes?: OntologyAttributes;
}

export interface OntologyGraph {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}

export interface RelationshipTypeMismatch {
  edge_id: string;
  type: string;
  expected: string;
  actual: string;
}

/** Mirrors the backend's `KnowledgeGraphValidationReport` — a report, not a write-time gate (see `ontology-engine`'s README). */
export interface KnowledgeGraphValidationReport {
  ontology_key: string;
  knowledge_graph_key: string;
  valid: boolean;
  unknown_node_types: string[];
  unknown_relationship_types: string[];
  relationship_type_mismatches: RelationshipTypeMismatch[];
}
