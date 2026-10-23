---
title: Admin-Modul (Frontend)
---

# Admin-Modul (`@elyvion/shared-lib`)

Nicht zu verwechseln mit dem [Live-Admin-Panel](/admin) dieser Doku-Seite (read-only, zeigt Registry-Status) — hier geht es um ein generisches, konfigurationsgetriebenes CRUD-UI für **jede** REST-Ressource hinter dem Gateway, Teil von `frontend/projects/client` — eine Tabelle/Collection in irgendeiner Backend-Datenbank wird durch einen einzigen `AdminResourceConfig`-Eintrag angebunden, nicht durch eigenen Komponenten-Code pro Tabelle.

## Ein Resource-Eintrag

```ts
import { AdminResourceConfig } from '@elyvion/shared-lib';

const roles: AdminResourceConfig = {
  id: 'roles',                 // Routensegment: /admin/roles
  label: 'Users: Rollen',      // Sidebar-Label
  moduleName: 'users',         // Gateway-Modulname → /api/users/...
  listPath: '/roles',          // GET /api/users/roles
  idField: 'id',
  fields: [
    { key: 'id', label: 'ID', type: 'text', editable: false },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'permissions', label: 'Permissions', type: 'json', editable: false },
  ],
};
```

Standardmäßig: Create = `POST {listPath}`, Update = `PATCH {listPath}/{id}`, Delete = `DELETE {listPath}/{id}`. Jedes davon ist override-bar (`createMethod`, `createPath`, `updateMethod`, `updatePath`, `deletePath`) — nötig z. B. wenn der Endpoint anders heißt als die Liste (Users: `by-id/:id`) oder ein Upsert über `PUT` auf einen vom Nutzer eingegebenen Id-Pfad läuft (App-Config: `PUT /configs/:applicationId`, auch beim Anlegen).

## Einbinden

```ts
// app.config.ts
import { provideAdminResources } from '@elyvion/shared-lib';
providers: [provideAdminResources(ADMIN_RESOURCE_CONFIGS), ...]

// app.routes.ts
import { elvAdminRoutes, withElyvionAuthShell } from '@elyvion/shared-lib';
...withElyvionAuthShell([
  { path: '', component: HomeComponent },
  { path: 'admin', children: elvAdminRoutes },
])
```

`/admin` liegt damit automatisch hinter `elyvionAuthGuard` wie jede andere geschützte Route. `frontend/projects/client/src/app/admin/admin-resources.ts` ist die konkrete Liste für dieses Repository — ein Eintrag pro Tabelle/Collection über alle Module:

| Resource | Modul | DB |
|---|---|---|
| `registry-modules` | `registry` | Postgres (nur Edit/Delete — Module registrieren sich selbst) |
| `users` | `users` | Postgres (nur Edit/Delete — Registrierung hat eigenen Flow) |
| `roles`, `permissions` | `users` | Postgres (volles CRUD) |
| `app-configs` | `app-config` | MongoDB (volles CRUD, Upsert über `PUT`) |

## Grenzen (bewusst, für diesen ersten Durchlauf)

- Keine Rollen-/Rechte-Prüfung auf den Admin-Endpoints — jeder eingeloggte Account kann sie aufrufen, nicht nur ein "Admin"-Account. Für produktiven Einsatz: Rolle aus dem ID-Token (`roles`-Claim, siehe [Architektur](/architecture)) prüfen, z. B. als zusätzlicher Guard auf `{ path: 'admin', ... }`.
- `roles`/`permissions` beim Editieren eines Users sind read-only — Zuweisen/Entziehen läuft über eigene Endpoints (`POST/DELETE /api/users/users/:userId/roles/:roleId` usw., siehe [Patterns](/patterns)), nicht über das generische Formular.
- Felder vom Typ `json` erwarten gültiges JSON im Textfeld; ungültige Eingaben zeigen einen Fehler statt zu speichern.
