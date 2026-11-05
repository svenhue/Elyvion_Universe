import { buildCartesianChartViewModel } from './chart-view-model';
import { buildHeatmapViewModel } from './specialized-visualizations.component';
import { ElvChartSeries } from './data-viz.types';

describe('data visualization view models', () => {
  it('scales chart points and reacts to changed input values', () => {
    const first: ElvChartSeries[] = [
      { name: 'Revenue', data: [{ x: 'Jan', y: 10 }, { x: 'Feb', y: 20 }] },
    ];
    const second: ElvChartSeries[] = [
      { name: 'Revenue', data: [{ x: 'Jan', y: 20 }, { x: 'Feb', y: 40 }] },
    ];

    const initial = buildCartesianChartViewModel(first, 'line');
    const updated = buildCartesianChartViewModel(second, 'line');

    expect(initial.series[0].points[0].y).toBeGreaterThan(initial.series[0].points[1].y);
    expect(updated.series[0].points[0].value).toBe(20);
    expect(updated.series[0].points[1].value).toBe(40);
  });

  it('builds positive and negative stacked bars without invalid geometry', () => {
    const model = buildCartesianChartViewModel([
      { name: 'Base', data: [{ x: 'Jan', y: 2 }, { x: 'Feb', y: -3 }] },
      { name: 'Extra', data: [{ x: 'Jan', y: 4 }, { x: 'Feb', y: -2 }] },
    ], 'stacked-bar');

    expect(model.series[1].points[0].y).toBeLessThan(model.series[0].points[0].y);
    expect(model.series[1].points[1].y).toBeGreaterThan(model.series[0].points[1].y);
    expect(model.series.flatMap((series) => series.points).every((point) =>
      Number.isFinite(point.barX) &&
      Number.isFinite(point.barY) &&
      Number.isFinite(point.barHeight) &&
      point.barHeight >= 0,
    )).toBeTrue();
  });

  it('returns finite geometry for an empty chart', () => {
    const model = buildCartesianChartViewModel([], 'scatter');
    expect(model.xTicks.every((tick) => Number.isFinite(tick.x))).toBeTrue();
    expect(model.yTicks.every((tick) => Number.isFinite(tick.y))).toBeTrue();
  });

  it('normalizes heatmap intensity and handles equal values', () => {
    expect(buildHeatmapViewModel([
      { x: 'Mon', y: 'A', value: 10 },
      { x: 'Tue', y: 'A', value: 20 },
    ]).map((cell) => cell.intensity)).toEqual([0, 100]);

    expect(buildHeatmapViewModel([
      { x: 'Mon', y: 'A', value: 5 },
      { x: 'Tue', y: 'A', value: 5 },
    ]).map((cell) => cell.intensity)).toEqual([50, 50]);
  });
});
