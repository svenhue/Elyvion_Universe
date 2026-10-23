# Elyvion Frontend

Ein Angular-Workspace mit zwei Projekten. Details & Diagramme: [Doku-Website](../docs).

| Projekt | Zweck |
|---|---|
| `projects/shared-lib` (`@elyvion/shared-lib`) | Geteilte Services (Auth/OIDC, API-Client, dynamisches Rendering) + UI-Komponenten für SPA/SSR/Hybrid |
| `projects/client` | Klon-Vorlage für Kundenprojekte, nutzt `shared-lib`, Angular SSR |

## Setup

```bash
npm install
npm start                        # baut shared-lib, dann http://localhost:4200
```

`shared-lib` ist über `tsconfig.json`-Pfadmapping (`@elyvion/shared-lib` → `dist/shared-lib`) eingebunden, nicht über den Dev-Server live verlinkt. `npm start`/`npm run build` bauen `shared-lib` deshalb automatisch zuerst (`npm run build:lib`) — nach Änderungen an der Lib bei laufendem `ng serve` trotzdem manuell `npm run build:lib` erneut ausführen, der Dev-Server beobachtet `dist/` nicht.

## shared-lib — Bausteine

- **Auth** (`auth/*`): OAuth 2.1 Authorization-Code-Flow mit PKCE gegen `backend/modules/auth`, `AuthService`, `createAuthInterceptor()`
- **API** (`api/*`): `ApiClientService` gegen das Gateway (`/api/{modul}/...`)
- **UI** (`ui/*`): `ElvButtonComponent`, `ElvCardComponent`
- **Dynamic Rendering** (`dynamic-render/*`): JSON-Schema-getriebenes Rendering kompletter Angular-Anwendungen zur Laufzeit — siehe [Doku](../docs/content/dynamic-rendering.md)
- **Auth-Pages** (`auth-pages/*`): fertige Login-/Registrierungsseiten + `elyvionAuthGuard` + `withElyvionAuthShell(routes)` — ein Aufruf richtet `/login`, `/register`, Guard und Catch-all ein. Login startet den OIDC-Flow (`AuthService.login()`); Registrierung postet direkt gegen `modules/users` (`POST /api/users/register`, am Gateway öffentlich freigeschaltet)

## client

Vorlage zum Klonen pro Kundenprojekt (siehe [Best Practices](../docs/content/best-practices.md)). `app.routes.ts` nutzt `withElyvionAuthShell([...])` — alles hinter `/` ist eingeloggt-only, `home/home.component.ts` lädt die `default`-App-Config über `DynamicAppService` und rendert sie mit `<elv-dynamic-renderer>`.
