---
title: Dynamic Rendering
---

# Dynamic Rendering (`@elyvion/shared-lib`)

Erlaubt es, eine komplette Angular-Anwendung zur Laufzeit aus einem JSON-Schema zu rendern, statt sie für jeden Kunden fest zu verdrahten — Grundlage für einen künftigen Baukasten/Editor, der Kundenanwendungen aus wiederverwendbaren Komponenten zusammensetzt.

## Das Metaschema

`frontend/projects/shared-lib/src/lib/dynamic-render/schema/dynamic-app.schema.json` (JSON Schema, Draft 2020-12). Eine `DynamicAppSchema` ist eine **flache Liste von Komponenten-Knoten**, deren Verschachtelung über `children` (Ids) ausgedrückt wird — nicht über verschachtelte Objekte:

```json
{
  "id": "customer-dashboard",
  "name": "Customer Dashboard",
  "version": "1.0.0",
  "rootComponentId": "root",
  "components": [
    {
      "id": "root",
      "name": "layout-container",
      "attributes": { "style": { "display": "flex", "flex-direction": "column", "gap": "1rem" } },
      "children": ["header", "content"]
    },
    {
      "id": "header",
      "name": "page-header",
      "attributes": { "title": "Dashboard", "style": { "background-color": "#6366f1" } }
    },
    {
      "id": "content",
      "name": "data-table",
      "attributes": { "endpoint": "/api/my-module/tasks" }
    }
  ]
}
```

Pro Komponenten-Knoten:

- `id` — eindeutig innerhalb des Schemas
- `name` — logischer Komponenten-Typ, wird zur Laufzeit gegen die Komponenten-Registry der Host-Anwendung aufgelöst
- `attributes` — beliebige Werte; der reservierte Key `style` wird als CSS auf das Host-Element angewendet, alle anderen Keys werden als `@Input()` an die Komponente durchgereicht
- `children` — Ids weiterer Knoten, die der Renderer selbst verschachtelt (die Ziel-Komponente muss dafür nichts Besonderes können)

## Komponenten-Registry: "wird dynamisch zur Laufzeit geladen"

`name` wird nicht gegen eine fest importierte Komponente aufgelöst, sondern gegen einen **Lazy-Loader** (dieselbe Mechanik wie Angulars `loadComponent` bei Routen) — der Code der Komponente landet dadurch in einem eigenen Chunk und wird erst beim ersten tatsächlichen Rendern nachgeladen:

```ts
import { provideDynamicComponents } from '@elyvion/shared-lib';

provideDynamicComponents({
  'page-header': () => import('./components/page-header.component').then((m) => m.PageHeaderComponent),
  'data-table': () => import('./components/data-table.component').then((m) => m.DataTableComponent),
});
```

## Rendern

```html
<elv-dynamic-renderer [schema]="appSchema" />
```

`DynamicRendererComponent` löst `rootComponentId` auf, lädt die zugehörige Komponente über die Registry, erzeugt sie via `ViewContainerRef.createComponent()`, wendet `attributes` an (Style direkt auf das Host-Element, alles andere über `ComponentRef.setInput()`) und erzeugt für jede `children`-Id im selben Container rekursiv eine weitere `<elv-dynamic-renderer>`-Instanz.

## Der eine Service: `DynamicAppService`

Einziger Einstiegspunkt des Moduls für Host-Anwendungen — löst ein Schema für eine konkrete Anwendung/Nutzer-Kombination auf:

```ts
import { DynamicAppService, DYNAMIC_APP_CONFIG } from '@elyvion/shared-lib';

// Provider, z. B. in app.config.ts:
{ provide: DYNAMIC_APP_CONFIG, useValue: { schemaEndpoint: 'http://localhost:3000/api/app-config/schema' } }

// Nutzung:
dynamicAppService.loadApplication({
  applicationId: 'customer-dashboard',
  userId: currentUserId,
  settings: { locale: 'de-DE' },
}).subscribe((schema) => this.schema.set(schema));
```

Das `schemaEndpoint` zeigt auf [`backend/modules/resource-layer/app-config`](/architecture) (NestJS + Mongoose/MongoDB), das Schemas pro `applicationId` ausliefert (`userId`/`settings` werden entgegengenommen, aber noch nicht für Personalisierung genutzt). `frontend/projects/client` ist bereits fertig damit verdrahtet: `client/src/app/app.config.ts` registriert `button` → `ElvButtonComponent`, `home/home.component.ts` rendert die per `applicationId: 'default'` geladene Schema.
