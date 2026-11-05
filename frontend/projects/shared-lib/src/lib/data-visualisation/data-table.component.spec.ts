import { TestBed } from '@angular/core/testing';
import { ElvDataTableComponent } from './data-table.component';
import { ElvDataTableColumn } from './data-viz.types';

interface PersonRow extends Record<string, unknown> {
  name: string;
  score: number;
}

describe('ElvDataTableComponent', () => {
  it('filters, sorts, and pages typed input rows', async () => {
    await TestBed.configureTestingModule({ imports: [ElvDataTableComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ElvDataTableComponent<PersonRow>);
    const rows: PersonRow[] = [
      { name: 'Ada', score: 9 },
      { name: 'Grace', score: 7 },
      { name: 'Linus', score: 8 },
    ];
    const columns: ElvDataTableColumn<PersonRow>[] = [
      { key: 'name', label: 'Name' },
      { key: 'score', label: 'Score' },
    ];
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('pageSize', 2);
    fixture.detectChanges();

    fixture.componentInstance.sortBy('score');
    expect(fixture.componentInstance.pageRows().map((row) => row.score)).toEqual([7, 8]);
    fixture.componentInstance.goToPage(1);
    expect(fixture.componentInstance.pageRows().map((row) => row.score)).toEqual([9]);

    fixture.componentInstance.filter.set('ada');
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredRows().map((row) => row.name)).toEqual(['Ada']);
  });
});
