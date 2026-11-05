import { TestBed } from '@angular/core/testing';
import { ElvUiStateService } from '../ui/ui-state.service';
import { ElvUiStateLineChartComponent } from './stream-line-chart.component';

describe('ElvUiStateLineChartComponent', () => {
  it('renders data from the existing shared UI state service', async () => {
    await TestBed.configureTestingModule({ imports: [ElvUiStateLineChartComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ElvUiStateLineChartComponent);
    const uiState = TestBed.inject(ElvUiStateService);
    fixture.componentRef.setInput('componentId', 'dashboard-sales');
    fixture.detectChanges();

    uiState.setState('dashboard-sales', 'series', [
      { name: 'Orders', data: [{ x: 'Today', y: 3 }] },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Orders');
    expect(fixture.componentInstance.state().value[0].data[0].y).toBe(3);
    fixture.destroy();
  });
});
