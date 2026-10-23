import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClientService } from '../api/api-client.service';
import { ELYVION_GATEWAY_URL } from '../api/gateway-url.token';
import { AuthService } from '../auth/auth.service';
import { DynamicAppService } from '../application-runner/service/dynamic-app.service';
import { ProCodeComponent } from './pro-code.component';
import { UI_ELEMENT_CATALOG } from './ui-element-catalog';

describe('ProCodeComponent', () => {
  let component: ProCodeComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { claims: () => null } },
        { provide: DynamicAppService, useValue: { loadApplication: () => of(null) } },
        { provide: ApiClientService, useValue: { put: () => of({ data: {} }) } },
        { provide: ELYVION_GATEWAY_URL, useValue: 'http://localhost:3000' },
      ],
    });
    component = TestBed.runInInjectionContext(() => new ProCodeComponent());
    component.saveStatus.set('saved');
  });

  it('lists every reusable shared UI component', () => {
    expect(component.elements.length).toBe(22);
    expect(component.filteredElements().map((element) => element.name)).toEqual(
      UI_ELEMENT_CATALOG.map((element) => element.name),
    );
  });

  it('adds a component at its drop location and updates the application schema', () => {
    component.handleElementDrop({ componentName: 'button', x: 143, y: 87 });

    const schema = JSON.parse(component.schemaCode());
    const added = schema.components.find((node: { id: string }) => node.id.startsWith('button-'));

    expect(added.name).toBe('button');
    expect(added.position).toEqual(jasmine.objectContaining({ x: 143, y: 87 }));
    expect(added.attributes.properties.label).toBe('Button');
    expect(schema.components[0].children).toContain(added.id);
    expect(component.previewSchema().components).toEqual(schema.components);
  });

  it('reorders a flow-positioned component when dropped before a sibling, instead of moving it by pixel', () => {
    component.handleElementDrop({ componentName: 'button', x: 0, y: 0 });
    const first = component.configuredElements().find((element) => element.name === 'button');
    if (!first) throw new Error('First button not found.');
    component.handleElementDrop({ componentName: 'card', x: 0, y: 0 });
    const second = component.configuredElements().find((element) => element.name === 'card');
    if (!second) throw new Error('Second element (card) not found.');

    // Drop the button back before the card — should reorder, not set x/y.
    component.handleElementDrop({ nodeId: first.id, x: 999, y: 999, insertBeforeNodeId: second.id });

    const root = component.previewSchema().components.find((node) => node.id === component.previewSchema().rootComponentId);
    expect(root?.children).toEqual([first.id, second.id]);
    const moved = component.previewSchema().components.find((node) => node.id === first.id);
    expect(moved?.position?.x).not.toBe(999);
  });

  it('moves an absolutely-positioned component to the drop location by pixel', () => {
    component.handleElementDrop({ componentName: 'button', x: 50, y: 60 });
    const added = component.configuredElements().find((element) => element.name === 'button');
    if (!added) {
      throw new Error('Added button not found in configured elements.');
    }
    component.selectedId.set(added.id);
    component.updateProperty('styles', {
      target: Object.assign(document.createElement('textarea'), { value: '{"position":"absolute"}' }),
    } as unknown as Event);

    component.handleElementDrop({ nodeId: added.id, x: 250, y: 180 });

    expect(component.previewSchema().components.find((node) => node.id === added.id)?.position).toEqual(
      jasmine.objectContaining({ x: 250, y: 180 }),
    );
  });

  it('removes a component from the schema and root children', () => {
    component.handleElementDrop({ componentName: 'button', x: 20, y: 30 });
    const added = component.configuredElements()[0];
    component.removeElement(added.id);

    const schema = JSON.parse(component.schemaCode());
    expect(schema.components.some((node: { id: string }) => node.id === added.id)).toBeFalse();
    expect(schema.components[0].children).not.toContain(added.id);
    expect(component.configuredElements()).toEqual([]);
  });

  it('keeps the last valid schema active when editor content is invalid', () => {
    const validSchema = component.previewSchema();
    const editor = document.createElement('textarea');
    editor.value = '{ invalid json';
    const event = new Event('input');
    Object.defineProperty(event, 'target', { value: editor });
    component.updateCode(event);

    expect(component.schemaError()).toContain('ungültig');
    expect(component.previewSchema()).toBe(validSchema);
  });

  it('supports undo and redo across schema edits', () => {
    component.handleElementDrop({ componentName: 'button', x: 20, y: 30 });
    expect(component.configuredElements()).toHaveSize(1);

    component.undo();
    expect(component.configuredElements()).toHaveSize(0);

    component.redo();
    expect(component.configuredElements()).toHaveSize(1);
  });

  it('opens the schema and history panels independently', () => {
    expect(component.activePanel()).toBeNull();

    component.togglePanel('schema');
    expect(component.activePanel()).toBe('schema');
    component.togglePanel('schema');
    component.togglePanel('history');
    expect(component.activePanel()).toBe('history');
  });
});
