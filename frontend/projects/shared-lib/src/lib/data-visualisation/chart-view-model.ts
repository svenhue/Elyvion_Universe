import {
  ElvCartesianChartViewModel,
  ElvChartKind,
  ElvChartSeries,
  ElvChartSeriesViewModel,
} from './data-viz.types';

const WIDTH = 640;
const HEIGHT = 320;
const MARGIN = { top: 16, right: 16, bottom: 42, left: 52 };
const TICK_COUNT = 5;

export function buildCartesianChartViewModel(
  input: readonly ElvChartSeries[],
  kind: ElvChartKind,
): ElvCartesianChartViewModel {
  const series = input.map((item) => ({
    ...item,
    data: item.data.filter((point) => Number.isFinite(point.y)),
  }));
  const allPoints = series.flatMap((item) => item.data);
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const isNumericAxis =
    kind !== 'bar' &&
    kind !== 'stacked-bar' &&
    allPoints.every((point) => typeof point.x === 'number' || point.x instanceof Date);
  const categoryLabels = unique(series.flatMap((item) => item.data.map((point) => formatX(point.x))));
  const categoryIndex = new Map(categoryLabels.map((label, index) => [label, index]));
  const xOf = (value: string | number | Date): number =>
    isNumericAxis ? numericX(value) : (categoryIndex.get(formatX(value)) ?? 0);
  const xValues = allPoints.map((point) => xOf(point.x));
  const stackedValues = categoryLabels.flatMap((_, pointIndex) => {
    let positive = 0;
    let negative = 0;
    for (const item of series) {
      const value = item.data[pointIndex]?.y ?? 0;
      if (value >= 0) positive += value;
      else negative += value;
    }
    return [positive, negative];
  });
  const yValues = kind === 'stacked-bar' ? stackedValues : allPoints.map((point) => point.y);
  let minX = isNumericAxis && xValues.length ? Math.min(...xValues) : 0;
  let maxX = isNumericAxis && xValues.length
    ? Math.max(...xValues)
    : Math.max(0, categoryLabels.length - 1);
  if (minX === maxX) {
    minX -= 0.5;
    maxX += 0.5;
  }
  const minY = Math.min(0, ...yValues);
  const maxY = Math.max(1, ...yValues);

  const scaleX = (value: number): number =>
    MARGIN.left + ((value - minX) / (maxX - minX || 1)) * plotWidth;
  const scaleY = (value: number): number =>
    MARGIN.top + plotHeight - ((value - minY) / (maxY - minY || 1)) * plotHeight;

  const slotCount = Math.max(1, categoryLabels.length);
  const barSlotWidth = plotWidth / slotCount;
  const barWidth = (barSlotWidth / Math.max(1, series.length)) * 0.72;
  const viewSeries: ElvChartSeriesViewModel[] = series.map((item, seriesIndex) => {
    const points = item.data.map((point, index) => {
      const categoryIndexValue = categoryIndex.get(formatX(point.x)) ?? 0;
      const categoryX = MARGIN.left + ((categoryIndexValue + 0.5) / slotCount) * plotWidth;
      const previousStackValue =
        kind === 'stacked-bar'
          ? series.slice(0, seriesIndex).reduce((sum, entry) => {
              const prior = entry.data[index]?.y ?? 0;
              return Math.sign(prior) === Math.sign(point.y) ? sum + prior : sum;
            }, 0)
          : 0;
      const value = point.y + previousStackValue;
      const x = isNumericAxis ? scaleX(xOf(point.x)) : categoryX;
      const barX =
        kind === 'stacked-bar'
          ? categoryX - barSlotWidth * 0.36
          : categoryX - (series.length * barWidth) / 2 + seriesIndex * barWidth;
      return {
        x,
        y: scaleY(value),
        barX,
        barY: Math.min(scaleY(value), scaleY(previousStackValue)),
        barWidth,
        barHeight: Math.abs(scaleY(previousStackValue) - scaleY(value)),
        value: point.y,
        label: point.label ?? formatX(point.x),
      };
    });
    const linePath = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
    const baseline = scaleY(0);
    const areaPath = points.length
      ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
      : '';
    return { name: item.name, color: item.color, points, linePath, areaPath };
  });

  const yTicks = Array.from({ length: TICK_COUNT }, (_, index) => {
    const value = minY + ((maxY - minY) * index) / (TICK_COUNT - 1);
    return { y: scaleY(value), label: formatNumber(value) };
  });
  const labels = categoryLabels;
  const xTicks = isNumericAxis && xValues.length
    ? Array.from({ length: 6 }, (_, index) => {
        const value = minX + ((maxX - minX) * index) / 5;
        return {
          x: scaleX(value),
          label: allPoints[0]?.x instanceof Date ? formatX(new Date(value)) : formatNumber(value),
        };
      })
    : labels.slice(0, 6).map((label, index) => ({
        x: MARGIN.left + ((index + 0.5) / Math.max(1, labels.length)) * plotWidth,
        label,
      }));
  const summary = series
    .map((item) => `${item.name}: ${item.data.length} points`)
    .join('; ');

  return {
    width: WIDTH,
    height: HEIGHT,
    plotLeft: MARGIN.left,
    plotTop: MARGIN.top,
    plotWidth,
    plotHeight,
    yTicks,
    xTicks,
    series: viewSeries,
    summary: summary || 'No chart data',
  };
}

function numericX(value: string | number | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatX(value: string | number | Date): string {
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
