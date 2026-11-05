import { TestBed } from '@angular/core/testing';
import { ElvKpiCardComponent } from './kpi-card.component';

describe('ElvKpiCardComponent', () => {
  it('renders required inputs and recalculates the sparkline after input changes', async () => {
    await TestBed.configureTestingModule({ imports: [ElvKpiCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ElvKpiCardComponent);
    fixture.componentRef.setInput('label', 'Requests');
    fixture.componentRef.setInput('value', 12);
    fixture.componentRef.setInput('sparkline', [1, 2, 3]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Requests');
    expect(fixture.nativeElement.textContent).toContain('12');
    expect(fixture.componentInstance.sparklinePoints().length).toBe(3);

    fixture.componentRef.setInput('sparkline', [3, 1]);
    fixture.detectChanges();
    expect(fixture.componentInstance.sparklinePoints().length).toBe(2);
  });
});
