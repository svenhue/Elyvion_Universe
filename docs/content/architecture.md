---
title: Architektur
---

# Architektur

## Überblick

```
                      ┌─────────────┐
   Browser / Client ─▶│   Gateway   │──▶ validiert JWT gegen Auth (JWKS)
                      └──────┬──────┘
                             │  /api/{modulName}/*
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
        ┌─────────┐   ┌────────────┐   ┌───────────┐
        │  Auth   │   │  Registry  │   │ Business- │
        │ (OIDC)  │   │            │   │  Module   │
        └─────────┘   └────────────┘   └───────────┘
                             ▲               │
                             └── Self-Registration beim Boot
```

## Die drei Kern-Module

### Gateway (`backend/modules/gateway`)

Einziger öffentlicher Einstiegspunkt. Validiert jeden eingehenden Request unter `/api/*` gegen das JWKS-Endpoint des Auth-Moduls (`verifyBearerToken` aus `@elyvion/shared`) und leitet ihn danach an das passende Business-Modul weiter – ermittelt über die Routing-Tabelle, die periodisch von der Registry geladen wird.

Pfadschema: `GET /api/{moduleName}/{restlicher-pfad}` → `{module.baseUrl}{module.routePrefix}{restlicher-pfad}`.

### Auth (`backend/modules/auth`)

Vollständiger OpenID-Connect-Provider (`oidc-provider`), kein Eigenbau von Krypto-Logik. Bietet:

- Discovery: `/.well-known/openid-configuration`
- JWKS: `/jwks`
- Authorization Code Flow **mit erzwungenem PKCE** (`pkce.required`)
- Refresh Token Rotation, Token Revocation, Introspection
- Redirect-URIs sind pro Client explizit als Allowlist registriert (`src/oidc/clients.ts`) – nicht verhandelbar zur Laufzeit
- Access Tokens sind **selbstständige JWTs** (RFC 9068, `at+jwt`) statt opaker Referenz-Tokens – über ein Resource Indicator (RFC 8707) mit fester Audience `API_AUDIENCE` (Default `elyvion:api`), die Gateway und Module beim Verifizieren prüfen (`verifyBearerToken(..., audience)`)

Login/Consent laufen über einfache, serverseitig gerenderte Interaction-Routen (`/interaction/:uid`).

### Registry (`backend/modules/registry`)

Persistenter Modul-Katalog (Postgres via Prisma). Jedes Modul registriert sich beim Start selbst (`POST /modules/register`); ein Cronjob pingt alle `healthCheckUrl`s alle 30 Sekunden und aktualisiert den Status (`healthy` / `unhealthy`).

## Business-Module

Jedes neue Fachmodul ist entweder ein Klon von `templates/module-ts` (NestJS) oder `templates/module-py` (FastAPI). Beide:

1. registrieren sich beim Start bei der Registry,
2. exponieren `/health`,
3. nutzen die jeweilige Shared-Library (`@elyvion/shared` bzw. `elyvion_shared`) für Config, Logging, Error-Handling,
4. können eigene Cronjobs betreiben, unabhängig von Gateway/Registry.

Siehe [Patterns](/patterns) für die Details beim Anlegen eines neuen Moduls.

## Warum diese Trennung?

- **Ein Gateway** heißt: Auth-Logik existiert genau einmal, nicht in jedem Modul neu.
- **Registry statt statischer Config** heißt: Module können unabhängig deployed, skaliert und ausgetauscht werden, ohne das Gateway anzufassen.
- **Sprachunabhängige Module** (TS oder Python) heißt: Jedes Team/Kundenprojekt nutzt das Framework, das zur Aufgabe passt (z. B. Python für Datenverarbeitung, TypeScript für klassische CRUD-APIs) — solange es sich an das Registrierungs- und Health-Contract hält.
