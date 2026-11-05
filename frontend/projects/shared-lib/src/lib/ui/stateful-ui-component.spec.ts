import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { ElvStatefulUiComponent } from './stateful-ui-component';

@Component({
  standalone: true,
  template: '',
})
class StatefulTestComponent extends ElvStatefulUiComponent {
  connectTo<T>(source: Observable<T>, initialValue: T) {
    return this.connect(source, {
      initialValue,
      mapToViewState: (value) => value,
      isEmpty: (value) => Array.isArray(value) && value.length === 0,
    });
  }
}

describe('ElvStatefulUiComponent observable connection', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StatefulTestComponent] });
  });

  it('moves from loading to data and preserves the last value on stream error', () => {
    const fixture = TestBed.createComponent(StatefulTestComponent);
    const stream = new Subject<readonly number[]>();
    const state = fixture.componentInstance.connectTo(stream, []);

    expect(state().status).toBe('loading');
    stream.next([2, 4]);
    expect(state()).toEqual({
      status: 'data',
      value: [2, 4],
      hasData: true,
      stale: false,
      error: null,
    });

    stream.error(new Error('temporary'));
    expect(state().status).toBe('error');
    expect(state().value).toEqual([2, 4]);
    expect(state().stale).toBeTrue();
    fixture.destroy();
  });

  it('reports empty and closed states', () => {
    const fixture = TestBed.createComponent(StatefulTestComponent);
    const stream = new Subject<readonly number[]>();
    const state = fixture.componentInstance.connectTo(stream, []);

    stream.next([]);
    expect(state().status).toBe('empty');
    stream.next([1]);
    stream.complete();
    expect(state().status).toBe('closed');
    expect(state().value).toEqual([1]);
    expect(state().stale).toBeTrue();
    fixture.destroy();
  });

  it('unsubscribes from the stream when the component is destroyed', () => {
    const fixture = TestBed.createComponent(StatefulTestComponent);
    let teardownCount = 0;
    const stream = new Observable<readonly number[]>((subscriber) => {
      subscriber.next([1]);
      return () => teardownCount++;
    });
    fixture.componentInstance.connectTo(stream, []);

    fixture.destroy();

    expect(teardownCount).toBe(1);
  });
});
