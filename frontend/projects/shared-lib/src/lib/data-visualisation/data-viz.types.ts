import { TemplateRef } from '@angular/core';

export type ElvVizStatus =
  | 'loading'
  | 'empty'
  | 'error'
  | 'no-permission'
  | 'data'
  | 'closed';

export interface ElvChartPoint {
  x: string | number | Date;
  y: number;
  label?: string;
}

export interface ElvChartSeries {
  name: string;
  data: readonly ElvChartPoint[];
  color?: string;
}

export type ElvChartKind = 'line' | 'area' | 'bar' | 'stacked-bar' | 'scatter';

export interface ElvChartCoordinate {
  x: number;
  y: number;
  barX: number;
  barY: number;
  barWidth: number;
  barHeight: number;
  value: number;
  label: string;
}

export interface ElvChartSeriesViewModel {
  name: string;
  color?: string;
  points: readonly ElvChartCoordinate[];
  linePath: string;
  areaPath: string;
}

export interface ElvCartesianChartViewModel {
  width: number;
  height: number;
  plotLeft: number;
  plotTop: number;
  plotWidth: number;
  plotHeight: number;
  yTicks: readonly { y: number; label: string }[];
  xTicks: readonly { x: number; label: string }[];
  series: readonly ElvChartSeriesViewModel[];
  summary: string;
}

export interface ElvDataTableColumn<T> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
}

export interface ElvDashboardFilter {
  key: string;
  label: string;
  options: readonly { label: string; value: string }[];
  value?: string;
}

export interface ElvDashboardWidgetConfig {
  id: string;
  title: string;
  description?: string;
  template: TemplateRef<unknown>;
  columns?: 1 | 2 | 3 | 4;
  status?: ElvVizStatus;
  live?: boolean;
}

export interface ElvHeatmapCell {
  x: string;
  y: string;
  value: number;
}

export interface ElvHeatmapCellViewModel extends ElvHeatmapCell {
  intensity: number;
}

export interface ElvDonutSlice {
  label: string;
  value: number;
  color?: string;
}

export interface ElvDonutSliceViewModel extends ElvDonutSlice {
  percentage: number;
  dashArray: string;
  dashOffset: number;
}
