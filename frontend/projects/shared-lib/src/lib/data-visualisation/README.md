# Data visualization UI

The standalone UI components are published as the
`@elyvion/shared-lib/data-viz` secondary entry point. Source is kept in this
directory; the secondary entry point re-exports its public API.

This package is presentation-only. It has no HTTP/API clients, backend
dependencies, or data-fetching logic. It uses native SVG for charts, so the
workspace does not gain a chart-library dependency.

## Property inputs

```ts
import { signal } from '@angular/core';
import { ElvChartSeries } from '@elyvion/shared-lib/data-viz';

readonly revenue = signal<readonly ElvChartSeries[]>([
  { name: 'Revenue', data: [{ x: 'Jan', y: 120 }, { x: 'Feb', y: 165 }] },
]);
```

```html
<elv-line-chart [series]="revenue()" ariaLabel="Monthly revenue" />
```

Signal inputs and computed view models update when the parent replaces its
series. The charts also accept `status` and `stale` inputs for loading, empty,
error, no-permission, and disconnected states.

## Existing stateful UI service

`ElvUiStateService` stores reactive signals rather than Observables. The
`ElvUiStateLineChartComponent` adapts its existing component state signal to an
Observable using Angular's `toObservable()` and then uses the generic base
class connection:

```html
<elv-ui-state-line-chart componentId="sales-chart" stateKey="series" />
```

```ts
uiState.setState('sales-chart', 'series', revenueSeries);
```

The service remains the application's existing state source. The visualization
component does not create another data store.

## External Observable (including WebSocket/SSE)

The application owns the connection and passes its Observable to the UI:

```html
<elv-observable-line-chart [source]="revenueStream$" ariaLabel="Live revenue" />
```

The component knows only `Observable<readonly ElvChartSeries[]>`; it contains
no WebSocket, SSE, or HTTP implementation. Derived state exposes `loading`,
`data`, `empty`, `error`, and `closed`. The last valid value is retained and
marked stale after stream errors or completion. Reconnecting replaces the
previous subscription; Angular destroys the active subscription with the
component.

Custom stateful visualizations can use the base-class API directly:

```ts
const state = this.connect(stream$, {
  initialValue: [],
  mapToViewState: (series) => series,
  isEmpty: (series) => series.length === 0,
});
```

## Components and transformations

- `elv-kpi-card`
- `elv-line-chart`, `elv-area-chart`, `elv-bar-chart`,
  `elv-stacked-bar-chart`, `elv-scatter-chart`
- `elv-donut-chart`, `elv-heatmap`, `elv-data-table`
- `elv-dashboard-grid`, `elv-dashboard-widget`
- `elv-viz-state` for common data states

Pure transformations are exported as `buildCartesianChartViewModel()` and
`buildHeatmapViewModel()`. The shared cartesian chart specification consists
of `ElvChartSeries`, `ElvChartPoint`, and the chart view-model types. The
current SVG renderer is an implementation detail behind
`ElvCartesianChartRendererComponent`.

## Extending the renderer

Add a geospatial, graph, Canvas 2D, or WebGL component as a standalone UI
component with typed signal inputs and computed view models. Keep coordinate
projection, graph layout, or GPU-buffer preparation in pure transformations
or renderer-specific code; do not add data fetching. Reuse
`ElvVizStateComponent` for loading/error/empty/no-permission/stale states and
provide a textual summary (`role="img"` with an accessible label) for
non-text visuals. A future renderer can consume the chart specification
without changing the data source or dashboard-widget contract.

## Theme and assumptions

Components use inherited CSS custom properties such as `--elv-viz-surface`,
`--elv-viz-border`, `--elv-viz-focus`, and `--elv-viz-series-1`. Applications
can set these on a theme container for light and dark modes. No centralized
i18n package exists in the shared library; visible labels and state messages
are configurable inputs where applicable and can be supplied by the
application's translation layer.

Open assumptions: chart series use finite numeric `y` values; date and
categorical `x` values are formatted by the active browser locale; dashboard
widgets receive `TemplateRef`s from the consuming application.
