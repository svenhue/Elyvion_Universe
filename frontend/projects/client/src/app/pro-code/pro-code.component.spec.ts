import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClientService, AuthService, DynamicAppService } from '@elyvion/shared-lib';
import { ProCodeComponent } from './pro-code.component';
import { UI_ELEMENT_CATALOG } from './ui-element-catalog';

describe('ProCodeComponent', () => {
  let component: ProCodeComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { claims: () => null } },
        { provide: DynamicAppService, useValue: { loadApplication: () => of(null) } },
        { provide: ApiClientService, useValue: { put: () => of({ data: {} }) } },
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

  it('moves a component when dropped at a new application position', () => {
    component.handleElementDrop({ componentName: 'button', x: 50, y: 60 });
    const added = component.configuredElements().find((element) => element.name === 'button');
    if (!added) {
      throw new Error('Added button not found in configured elements.');
    }

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
