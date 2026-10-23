import { ElvUiStateService } from './ui-state.service';

describe('ElvUiStateService', () => {
  let service: ElvUiStateService;

  beforeEach(() => {
    service = new ElvUiStateService();
  });

  it('publishes keyed state only to subscribers for the matching component id', () => {
    const firstComponent: unknown[] = [];
    const secondComponent: unknown[] = [];

    service.stateChangesFor('first').subscribe((state) => firstComponent.push(state));
    service.stateChangesFor('second').subscribe((state) => secondComponent.push(state));

    service.setState('first', { key: 'class', value: 'bg-indigo-600 text-white' });

    expect(firstComponent).toEqual([{ key: 'class', value: 'bg-indigo-600 text-white' }]);
    expect(secondComponent).toEqual([]);
  });

  it('replays the latest value for each state key to late subscribers', () => {
    service.setState('first', { key: 'value', value: 'Ada' });
    service.setState('first', { key: 'class', value: 'font-bold' });
    service.setState('first', { key: 'value', value: 'Grace' });

    const states: unknown[] = [];
    service.stateChangesFor('first').subscribe((state) => states.push(state));

    expect(states).toEqual([
      { key: 'value', value: 'Grace' },
      { key: 'class', value: 'font-bold' },
    ]);
  });

  it('publishes the component id and keyed state on the global stream', () => {
    const changes: unknown[] = [];
    service.stateChanges$.subscribe((change) => changes.push(change));

    service.setState('first', { key: 'class', value: 'rounded-lg' });

    expect(changes).toEqual([
      { componentId: 'first', state: { key: 'class', value: 'rounded-lg' } },
    ]);
  });
});
