import { TestBed } from '@angular/core/testing';
import { ElvChartSeries } from './data-viz.types';
import { ElvLineChartComponent } from './cartesian-chart.component';

describe('ElvLineChartComponent', () => {
  it('recomputes its chart model when its series input changes', async () => {
    await TestBed.configureTestingModule({ imports: [ElvLineChartComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ElvLineChartComponent);
    const initial: ElvChartSeries[] = [
      { name: 'Visits', data: [{ x: 'Mon', y: 4 }, { x: 'Tue', y: 8 }] },
    ];
    fixture.componentRef.setInput('series', initial);
    fixture.componentRef.setInput('ariaLabel', 'Visits');
    fixture.detectChanges();
    expect(fixture.componentInstance.model().series[0].points[1].value).toBe(8);

    fixture.componentRef.setInput('series', [
      { name: 'Visits', data: [{ x: 'Mon', y: 12 }] },
    ]);
    fixture.detectChanges();
    expect(fixture.componentInstance.model().series[0].points[0].value).toBe(12);
  });
});
