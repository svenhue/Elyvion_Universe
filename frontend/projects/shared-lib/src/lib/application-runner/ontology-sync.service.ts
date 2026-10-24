import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OntologyApiService } from '../ontology-engine/ontology-api.service';
import { OntologyAttributes } from '../ontology-engine/ontology-schema';
import { DynamicAppSchema, DynamicComponentNode } from './schema/dynamic-app-schema';

/**
 * Mirrors a pro-code application's `DynamicAppSchema` into its own
 * ontology — the first concrete ontology *type*, `"angular_app_config"`
 * (see `OntologyType`'s doc comment). Root node is the application
 * itself (`AngularApplication`); every schema component becomes a node
 * of its own (keyed by that component's own `id`, not a generated one),
 * connected by `"ist_element"` edges that mirror the schema's parent/child
 * tree — so calling this again after an edit upserts the same nodes and
 * edges (see the backend's `create_node`/`create_edge`, both MERGE-based)
 * instead of growing a second copy of the app next to the first.
 *
 * Only wired up where the Application Runner's author has turned
 * ontology sync on for that application (see `ProCodeComponent`'s
 * `ontologySyncEnabled` toggle) — this never runs on its own.
 */
@Injectable({ providedIn: 'root' })
export class AppOntologySyncService {
  private readonly ontologyApi = inject(OntologyApiService);

  /** The `angular_app_config` ontology type's one relationship: parent → child, whether the parent is the application root or another element. */
  private static readonly EDGE_IS_ELEMENT = 'ist_element';

  async sync(applicationId: string, schema: DynamicAppSchema): Promise<void> {
    const key = ontologyKeyFor(applicationId);
    await this.ensureOntology(key, schema.name);

    const rootNodeId = `app-root-${applicationId}`;
    await firstValueFrom(
      this.ontologyApi.createNode(key, {
        id: rootNodeId,
        type: 'AngularApplication',
        name: schema.name,
        attributes: { version: schema.version, rootComponentId: schema.rootComponentId },
      }),
    );

    for (const node of schema.components) {
      await firstValueFrom(
        this.ontologyApi.createNode(key, {
          id: node.id,
          type: nodeOntologyType(node),
          name: node.id,
          attributes: flattenAttributes(node),
        }),
      );
    }

    await firstValueFrom(
      this.ontologyApi.createEdge(key, {
        source_id: rootNodeId,
        target_id: schema.rootComponentId,
        type: AppOntologySyncService.EDGE_IS_ELEMENT,
      }),
    );

    for (const node of schema.components) {
      for (const childId of node.children ?? []) {
        await firstValueFrom(
          this.ontologyApi.createEdge(key, { source_id: node.id, target_id: childId, type: AppOntologySyncService.EDGE_IS_ELEMENT }),
        );
      }
    }
  }

  private async ensureOntology(key: string, appName: string): Promise<void> {
    try {
      await firstValueFrom(this.ontologyApi.getOntology(key));
    } catch {
      await firstValueFrom(
        this.ontologyApi.createOntology({ key, name: `${appName} (Ontologie)`, type: 'angular_app_config' }),
      );
    }
  }
}

export function ontologyKeyFor(applicationId: string): string {
  return `app-${applicationId}`;
}

function nodeOntologyType(node: DynamicComponentNode): string {
  if (node.type === 'text') return 'Text';
  if (node.type === 'element') return node.element ?? 'Element';
  return node.name ?? 'Component';
}

/** Neo4j attributes can only be scalars — nested objects (e.g. `properties`, `style`) get stringified rather than dropped, so nothing in the schema is silently lost. */
function flattenAttributes(node: DynamicComponentNode): OntologyAttributes {
  const result: OntologyAttributes = {};
  for (const [key, value] of Object.entries(node.attributes ?? {})) {
    if (value === null || value === undefined) continue;
    result[key] =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? value
        : JSON.stringify(value);
  }
  if (node.element) result['element'] = node.element;
  if (node.text !== undefined) result['text'] = node.text;
  return result;
}
