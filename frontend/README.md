# Elyvion Frontend

Ein Angular-Workspace mit zwei Projekten. Details & Diagramme: [Doku-Website](../docs).

| Projekt | Zweck |
|---|---|
| `projects/shared-lib` (`@elyvion/shared-lib`) | Geteilte Services (Auth/OIDC, API-Client, dynamisches Rendering) + UI-Komponenten für SPA/SSR/Hybrid |
| `projects/client` | Klon-Vorlage für Kundenprojekte, nutzt `shared-lib`, Angular SSR |

## Setup

```bash
npm install
npx ng build shared-lib          # einmalig / nach jeder shared-lib-Änderung — client importiert aus dist/
npx ng serve client              # http://localhost:4200
```

`shared-lib` ist über `tsconfig.json`-Pfadmapping (`@elyvion/shared-lib` → `dist/shared-lib`) eingebunden, nicht über den Dev-Server live verlinkt — nach Änderungen an der Lib muss sie neu gebaut werden.

## shared-lib — Bausteine

- **Auth** (`auth/*`): OAuth 2.1 Authorization-Code-Flow mit PKCE gegen `backend/modules/auth`, `AuthService`, `createAuthInterceptor()`
- **API** (`api/*`): `ApiClientService` gegen das Gateway (`/api/{modul}/...`)
- **UI** (`ui/*`): `ElvButtonComponent`, `ElvCardComponent`
- **Dynamic Rendering** (`dynamic-render/*`): JSON-Schema-getriebenes Rendering kompletter Angular-Anwendungen zur Laufzeit — siehe [Doku](../docs/content/dynamic-rendering.md)

## client

Vorlage zum Klonen pro Kundenprojekt (siehe [Best Practices](../docs/content/best-practices.md)). Enthält ein Beispiel für Login/Logout + einen Gateway-Request.
