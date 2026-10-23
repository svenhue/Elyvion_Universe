import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ELYVION_GATEWAY_URL } from '../api/gateway-url.token';
import {
  Ontology,
  OntologyCreatePayload,
  OntologyEdge,
  OntologyEdgeCreatePayload,
  OntologyEdgeUpdatePayload,
  OntologyGraph,
  OntologyNode,
  OntologyNodeCreatePayload,
  OntologyNodeUpdatePayload,
} from './ontology-schema';

/**
 * Talks to the `ontology-engine` backend module through the Gateway.
 * A thin `HttpClient` wrapper of its own, like `ApiClientService`, but
 * not built on it — `ApiClientService` assumes every module wraps its
 * JSON in a `{ data, meta? }` envelope (true for this project's NestJS
 * modules), while this FastAPI module returns each Pydantic model
 * directly, so unwrapping it the same way would be wrong, not just
 * redundant.
 */
@Injectable({ providedIn: 'root' })
export class OntologyApiService {
  private readonly http = inject(HttpClient);
  private readonly gatewayUrl = inject(ELYVION_GATEWAY_URL);
  private readonly base = `${this.gatewayUrl}/api/ontology-engine`;

  listOntologies(): Observable<Ontology[]> {
    return this.http.get<Ontology[]>(`${this.base}/ontologies`);
  }

  createOntology(payload: OntologyCreatePayload): Observable<Ontology> {
    return this.http.post<Ontology>(`${this.base}/ontologies`, payload);
  }

  getOntology(key: string): Observable<Ontology> {
    return this.http.get<Ontology>(`${this.base}/ontologies/${key}`);
  }

  deleteOntology(key: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/ontologies/${key}`);
  }

  getGraph(key: string): Observable<OntologyGraph> {
    return this.http.get<OntologyGraph>(`${this.base}/ontologies/${key}/graph`);
  }

  createNode(key: string, payload: OntologyNodeCreatePayload): Observable<OntologyNode> {
    return this.http.post<OntologyNode>(`${this.base}/ontologies/${key}/nodes`, payload);
  }

  updateNode(key: string, nodeId: string, payload: OntologyNodeUpdatePayload): Observable<OntologyNode> {
    return this.http.patch<OntologyNode>(`${this.base}/ontologies/${key}/nodes/${nodeId}`, payload);
  }

  deleteNode(key: string, nodeId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/ontologies/${key}/nodes/${nodeId}`);
  }

  createEdge(key: string, payload: OntologyEdgeCreatePayload): Observable<OntologyEdge> {
    return this.http.post<OntologyEdge>(`${this.base}/ontologies/${key}/edges`, payload);
  }

  updateEdge(key: string, edgeId: string, payload: OntologyEdgeUpdatePayload): Observable<OntologyEdge> {
    return this.http.patch<OntologyEdge>(`${this.base}/ontologies/${key}/edges/${edgeId}`, payload);
  }

  deleteEdge(key: string, edgeId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/ontologies/${key}/edges/${edgeId}`);
  }
}
