import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import cytoscape from 'cytoscape';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import edgehandles from 'cytoscape-edgehandles';
import { firstValueFrom } from 'rxjs';
import { OntologyApiService } from './ontology-api.service';
import { Ontology, OntologyAttributeValue } from './ontology-schema';

cytoscape.use(edgehandles);

interface AttributeRow {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean';
}

interface SelectedNodeForm {
  id: string;
  type: string;
  name: string;
  attributes: AttributeRow[];
}

interface SelectedEdgeForm {
  id: string;
  type: string;
}

function attributesToRows(attributes: Record<string, OntologyAttributeValue>): AttributeRow[] {
  return Object.entries(attributes).map(([key, value]) => ({
    key,
    value: String(value),
    type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
  }));
}

function rowsToAttributes(rows: AttributeRow[]): Record<string, OntologyAttributeValue> {
  const attributes: Record<string, OntologyAttributeValue> = {};
  for (const row of rows) {
    if (!row.key.trim()) continue;
    attributes[row.key.trim()] =
      row.type === 'number' ? Number(row.value) || 0 : row.type === 'boolean' ? row.value === 'true' : row.value;
  }
  return attributes;
}

/** True when two or more nodes share the exact same position — the signature of nodes that were never given a real layout (e.g. everything synced in at the same default x/y) and would render stacked on top of each other. */
function needsAutoLayout(nodes: { x: number; y: number }[]): boolean {
  if (nodes.length < 2) return false;
  const seen = new Set<string>();
  for (const node of nodes) {
    const key = `${node.x},${node.y}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/** Golden-angle spiral around a center point — each successive index lands further out and at a different angle than the last, so newly added nodes never stack on an earlier one. */
function spreadPosition(centerX: number, centerY: number, index: number): { x: number; y: number } {
  const angle = index * 137.5 * (Math.PI / 180);
  const radius = 50 * Math.sqrt(index + 1);
  return { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
}

/** Stable, readable color per node `type`, so every node of the same type reads as the same color without a hand-maintained palette. */
function colorForType(type: string): string {
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = (hash << 5) - hash + type.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/**
 * Graphical editor for one ontology at a time, on a Cytoscape.js canvas
 * instead of a hand-rolled SVG/div canvas (what the workflow builder's
 * graph view uses) — an ontology can grow into thousands of nodes, and
 * Cytoscape's canvas renderer, built-in wheel/pinch-zoom and drag-pan,
 * and viewport culling are exactly the "designed for large graphs" parts
 * a DOM-per-node approach doesn't have. `cytoscape-edgehandles` gives
 * the same "drag from a node to connect it to another" gesture the
 * custom canvas had, just implemented against a render tree built for it.
 */
@Component({
  selector: 'elv-ontology-engine',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './ontology-engine.component.html',
})
export class OntologyEngineComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly ontologyApi = inject(OntologyApiService);
  private readonly canvasRef = viewChild<ElementRef<HTMLElement>>('cyEl');

  readonly ontologies = signal<Ontology[]>([]);
  readonly loadError = signal('');
  readonly selectedOntologyKey = signal<string | null>(null);

  readonly newOntologyKey = signal('');
  readonly newOntologyName = signal('');

  readonly selectedNode = signal<SelectedNodeForm | null>(null);
  readonly selectedEdge = signal<SelectedEdgeForm | null>(null);
  readonly nodeCount = signal(0);
  readonly edgeCount = signal(0);

  readonly edgesForSelectedNode = computed(() => {
    const node = this.selectedNode();
    if (!node || !this.cy) return [];
    const cyNode = this.cy.getElementById(node.id);
    return cyNode
      .connectedEdges()
      .map((edge) => ({
        id: edge.id() as string,
        type: edge.data('type') as string,
        direction: edge.data('source') === node.id ? ('out' as const) : ('in' as const),
      }));
  });

  private cy: cytoscape.Core | null = null;
  private eh: ReturnType<cytoscape.Core['edgehandles']> | null = null;
  // Incremented synchronously on every addNode() call, independent of
  // cy.nodes().length — that count only updates once the node's create
  // request resolves, so two "+ Node" clicks fired before the first one
  // resolves would otherwise compute the same spiral position twice.
  private nodeSpreadCounter = 0;

  ngOnInit(): void {
    this.loadOntologies();
  }

  ngAfterViewInit(): void {
    const container = this.canvasRef()?.nativeElement;
    if (!container) return;
    this.initCytoscape(container);
  }

  ngOnDestroy(): void {
    this.eh?.destroy();
    this.cy?.destroy();
  }

  private initCytoscape(container: HTMLElement): void {
    const cy = cytoscape({
      container,
      wheelSensitivity: 0.2,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (el: cytoscape.NodeSingular) => colorForType(el.data('type')),
            label: 'data(name)',
            color: '#1e293b',
            'font-size': 10,
            'text-valign': 'bottom',
            'text-margin-y': 4,
            width: 36,
            height: 36,
            'border-width': 2,
            'border-color': '#ffffff',
          },
        },
        {
          selector: 'node:selected',
          style: { 'border-width': 3, 'border-color': '#4f46e5' },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(type)',
            'font-size': 8,
            color: '#475569',
            'text-background-color': '#ffffff',
            'text-background-opacity': 1,
            'text-background-padding': '2px',
          },
        },
        {
          selector: 'edge:selected',
          style: { 'line-color': '#4f46e5', 'target-arrow-color': '#4f46e5', width: 2.5 },
        },
      ],
    });

    this.eh = cy.edgehandles({
      canConnect: (source, target) => !source.same(target),
      edgeParams: () => ({ data: { type: 'relates_to' } }),
    });
    this.eh.enable();

    cy.on('tap', (event) => {
      if (event.target === cy) {
        this.selectedNode.set(null);
        this.selectedEdge.set(null);
      }
    });

    cy.on('tap', 'node', (event) => this.onNodeTapped(event.target));
    cy.on('tap', 'edge', (event) => this.onEdgeTapped(event.target));

    cy.on('dragfree', 'node', (event) => {
      const node = event.target as cytoscape.NodeSingular;
      const key = this.selectedOntologyKey();
      if (!key) return;
      const { x, y } = node.position();
      void firstValueFrom(this.ontologyApi.updateNode(key, node.id(), { x, y }));
    });

    cy.on('ehcomplete', (_event, sourceNode, targetNode, addedEdge) => {
      void this.onEdgeDrawn(sourceNode as cytoscape.NodeSingular, targetNode as cytoscape.NodeSingular, addedEdge as cytoscape.EdgeSingular);
    });

    this.cy = cy;
  }

  private onNodeTapped(node: cytoscape.NodeSingular): void {
    this.selectedEdge.set(null);
    this.selectedNode.set({
      id: node.id(),
      type: node.data('type'),
      name: node.data('name'),
      attributes: attributesToRows(node.data('attributes') ?? {}),
    });
  }

  private onEdgeTapped(edge: cytoscape.EdgeSingular): void {
    this.selectedNode.set(null);
    this.selectedEdge.set({ id: edge.id(), type: edge.data('type') });
  }

  private async onEdgeDrawn(
    sourceNode: cytoscape.NodeSingular,
    targetNode: cytoscape.NodeSingular,
    addedEdge: cytoscape.EdgeSingular,
  ): Promise<void> {
    // edgehandles already added a provisional edge to the graph (with a
    // made-up id) the instant the gesture completed — drop it and add
    // the real one once the backend has assigned an id, instead of
    // reconciling the two afterwards.
    addedEdge.remove();
    const key = this.selectedOntologyKey();
    if (!key) return;
    try {
      const created = await firstValueFrom(
        this.ontologyApi.createEdge(key, { source_id: sourceNode.id(), target_id: targetNode.id(), type: 'relates_to' }),
      );
      this.cy?.add({ group: 'edges', data: { id: created.id, source: created.source_id, target: created.target_id, type: created.type } });
      this.onEdgeTapped(this.cy!.getElementById(created.id) as unknown as cytoscape.EdgeSingular);
    } catch (error) {
      this.loadError.set(errorMessage(error, 'Beziehung konnte nicht erstellt werden.'));
    }
  }

  loadOntologies(): void {
    this.ontologyApi.listOntologies().subscribe({
      next: (ontologies) => this.ontologies.set(ontologies),
      error: (error: unknown) => this.loadError.set(errorMessage(error, 'Ontologien konnten nicht geladen werden.')),
    });
  }

  async createOntology(): Promise<void> {
    const key = this.newOntologyKey().trim();
    const name = this.newOntologyName().trim();
    if (!key || !name) return;
    try {
      const created = await firstValueFrom(this.ontologyApi.createOntology({ key, name }));
      this.newOntologyKey.set('');
      this.newOntologyName.set('');
      this.loadOntologies();
      await this.selectOntology(created.key);
    } catch (error) {
      this.loadError.set(errorMessage(error, 'Ontologie konnte nicht erstellt werden.'));
    }
  }

  async selectOntology(key: string): Promise<void> {
    this.selectedOntologyKey.set(key);
    this.selectedNode.set(null);
    this.selectedEdge.set(null);
    await this.reloadGraph();
  }

  private async reloadGraph(): Promise<void> {
    const key = this.selectedOntologyKey();
    const cy = this.cy;
    if (!key || !cy) return;
    try {
      const graph = await firstValueFrom(this.ontologyApi.getGraph(key));
      cy.elements().remove();
      cy.add([
        ...graph.nodes.map((node) => ({
          group: 'nodes' as const,
          data: { id: node.id, type: node.type, name: node.name, attributes: node.attributes },
          position: { x: node.x, y: node.y },
        })),
        ...graph.edges.map((edge) => ({
          group: 'edges' as const,
          data: { id: edge.id, source: edge.source_id, target: edge.target_id, type: edge.type },
        })),
      ]);
      this.nodeCount.set(graph.nodes.length);
      this.edgeCount.set(graph.edges.length);
      // The container is hidden (display:none) until an ontology is
      // selected, so Cytoscape's cached size is stale the first time —
      // resize before fitting, or the viewport math is wrong.
      cy.resize();
      if (needsAutoLayout(graph.nodes)) {
        await this.runAutoLayout(key, cy);
      }
      cy.fit(undefined, 60);
    } catch (error) {
      this.loadError.set(errorMessage(error, 'Graph konnte nicht geladen werden.'));
    }
  }

  /** Runs a force-directed layout once (for graphs whose nodes were never positioned, e.g. a fresh sync) and persists the computed positions, so this only ever runs once per such graph instead of re-shuffling it on every load. */
  private async runAutoLayout(key: string, cy: cytoscape.Core): Promise<void> {
    await new Promise<void>((resolve) => {
      const layout = cy.layout({ name: 'cose', animate: false, padding: 60 });
      layout.one('layoutstop', () => resolve());
      layout.run();
    });
    await Promise.all(
      cy.nodes().map((node) => {
        const { x, y } = node.position();
        return firstValueFrom(this.ontologyApi.updateNode(key, node.id(), { x, y })).catch(() => undefined);
      }),
    );
  }

  async addNode(): Promise<void> {
    const key = this.selectedOntologyKey();
    const cy = this.cy;
    if (!key || !cy) return;
    const extent = cy.extent();
    const { x, y } = spreadPosition((extent.x1 + extent.x2) / 2, (extent.y1 + extent.y2) / 2, this.nodeSpreadCounter++);
    const created = await firstValueFrom(
      this.ontologyApi.createNode(key, { type: 'Object', name: 'Neues Objekt', x, y, attributes: {} }),
    );
    cy.add({
      group: 'nodes',
      data: { id: created.id, type: created.type, name: created.name, attributes: created.attributes },
      position: { x: created.x, y: created.y },
    });
    this.nodeCount.update((count) => count + 1);
    this.onNodeTapped(cy.getElementById(created.id) as unknown as cytoscape.NodeSingular);
  }

  zoomBy(factor: number): void {
    const cy = this.cy;
    if (!cy) return;
    cy.zoom({ level: cy.zoom() * factor, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  }

  fitToScreen(): void {
    this.cy?.fit(undefined, 60);
  }

  async removeSelectedNode(): Promise<void> {
    const key = this.selectedOntologyKey();
    const node = this.selectedNode();
    if (!key || !node) return;
    await firstValueFrom(this.ontologyApi.deleteNode(key, node.id));
    this.cy?.getElementById(node.id).remove();
    this.nodeCount.update((count) => Math.max(0, count - 1));
    this.selectedNode.set(null);
  }

  async removeEdge(edgeId: string): Promise<void> {
    const key = this.selectedOntologyKey();
    if (!key) return;
    await firstValueFrom(this.ontologyApi.deleteEdge(key, edgeId));
    this.cy?.getElementById(edgeId).remove();
    this.edgeCount.update((count) => Math.max(0, count - 1));
    if (this.selectedEdge()?.id === edgeId) this.selectedEdge.set(null);
  }

  updateSelectedNode(patch: Partial<SelectedNodeForm>): void {
    this.selectedNode.update((node) => (node ? { ...node, ...patch } : node));
  }

  updateSelectedEdge(patch: Partial<SelectedEdgeForm>): void {
    this.selectedEdge.update((edge) => (edge ? { ...edge, ...patch } : edge));
  }

  addAttribute(): void {
    this.selectedNode.update((node) =>
      node ? { ...node, attributes: [...node.attributes, { key: '', value: '', type: 'string' }] } : node,
    );
  }

  updateAttribute(index: number, patch: Partial<AttributeRow>): void {
    this.selectedNode.update((node) =>
      node ? { ...node, attributes: node.attributes.map((attr, i) => (i === index ? { ...attr, ...patch } : attr)) } : node,
    );
  }

  removeAttribute(index: number): void {
    this.selectedNode.update((node) =>
      node ? { ...node, attributes: node.attributes.filter((_, i) => i !== index) } : node,
    );
    this.saveNode();
  }

  async saveNode(): Promise<void> {
    const key = this.selectedOntologyKey();
    const node = this.selectedNode();
    if (!key || !node) return;
    const attributes = rowsToAttributes(node.attributes);
    await firstValueFrom(this.ontologyApi.updateNode(key, node.id, { type: node.type, name: node.name, attributes }));
    const cyNode = this.cy?.getElementById(node.id);
    cyNode?.data('type', node.type);
    cyNode?.data('name', node.name);
    cyNode?.data('attributes', attributes);
  }

  async saveEdge(): Promise<void> {
    const key = this.selectedOntologyKey();
    const edge = this.selectedEdge();
    if (!key || !edge) return;
    await firstValueFrom(this.ontologyApi.updateEdge(key, edge.id, { type: edge.type }));
    this.cy?.getElementById(edge.id).data('type', edge.type);
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return `${fallback} ${error.message}`;
  return fallback;
}
