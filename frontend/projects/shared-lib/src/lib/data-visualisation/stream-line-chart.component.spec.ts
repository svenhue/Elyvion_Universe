import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ElvChartSeries } from './data-viz.types';
import { ElvObservableLineChartComponent } from './stream-line-chart.component';

describe('ElvObservableLineChartComponent', () => {
  it('renders stream values and disposes the stream subscription on destroy', async () => {
    await TestBed.configureTestingModule({ imports: [ElvObservableLineChartComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ElvObservableLineChartComponent);
    const source = new Subject<readonly ElvChartSeries[]>();
    fixture.componentRef.setInput('source', source);
    fixture.componentRef.setInput('ariaLabel', 'Streamed readings');
    fixture.detectChanges();

    source.next([{ name: 'Reading', data: [{ x: 'Now', y: 7 }] }]);
    fixture.detectChanges();
    expect(fixture.componentInstance.state().value[0].data[0].y).toBe(7);
    expect(fixture.nativeElement.textContent).toContain('Reading');

    fixture.destroy();
    expect(source.observed).toBeFalse();
  });
});
