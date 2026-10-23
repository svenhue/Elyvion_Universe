import { ElvUiStateService } from './ui-state.service';

describe('ElvUiStateService', () => {
  let service: ElvUiStateService;

  beforeEach(() => {
    service = new ElvUiStateService();
  });

  it('isolates state between components', () => {
    service.setState('first', 'class', 'bg-indigo-600 text-white');

    expect(service.stateSignal('first', 'class')()).toBe('bg-indigo-600 text-white');
    expect(service.stateSignal('second', 'class')()).toBeUndefined();
  });

  it('holds the latest value per key', () => {
    service.setState('first', 'value', 'Ada');
    service.setState('first', 'class', 'font-bold');
    service.setState('first', 'value', 'Grace');

    expect(service.stateSignal('first', 'value')()).toBe('Grace');
    expect(service.stateSignal('first', 'class')()).toBe('font-bold');
  });

  it('publishes every change on the lastChange signal', () => {
    service.setState('first', 'class', 'rounded-lg');

    expect(service.lastChange()).toEqual({ componentId: 'first', key: 'class', value: 'rounded-lg' });
  });

  it('frees a component state slot on removeComponent, starting it fresh', () => {
    service.setState('first', 'value', 'Ada');
    service.removeComponent('first');

    expect(service.stateSignal('first', 'value')()).toBeUndefined();
  });

  it('rejects an empty componentId or key', () => {
    expect(() => service.setState('', 'value', 'x')).toThrow();
    expect(() => service.setState('first', '', 'x')).toThrow();
  });
});
