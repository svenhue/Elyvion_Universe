---
title: Verfügbare Services
---

# Verfügbare Shared Services

## `@elyvion/shared` (TypeScript — `backend/packages/shared-ts`)

| Export | Zweck |
|---|---|
| `JwtAuthGuard`, `ElyvionAuthModule.forRoot()` | Bearer-JWT-Validierung gegen das Auth-JWKS, als Nest Guard/DynamicModule |
| `verifyBearerToken(header, issuerUrl, audience?)` | Framework-unabhängige Token-Validierung inkl. Audience-Check (von Gateway & Guard genutzt) |
| `baseEnvSchema`, `validateEnv()` | Zod-basierte Env-Validierung |
| `ElyvionLoggerModule.forRoot()` | Strukturiertes JSON-Logging (pino) mit `module`-Feld + Correlation-ID |
| `ElyvionExceptionFilter` | Einheitliches Fehler-JSON-Format |
| `envelope(data, meta?)` | Standard-Response-Hülle `{ data, meta? }` |
| `ElyvionHttpClient` | Konfigurierter axios-Wrapper (Timeout, Base-Headers) |
| `registerModule(options)` | Self-Registration bei der Registry inkl. Retry |
| `LogStore` | Persistiert und filtert Plattform-Logs in PostgreSQL |
| `GridFSFileStore` | Speichert, streamt und löscht Dateien in MongoDB GridFS |

## `elyvion_shared` (Python — `backend/packages/shared-py`)

| Export | Zweck |
|---|---|
| `BaseModuleSettings` | `pydantic-settings`-Basisklasse mit den Standard-Env-Feldern |
| `make_current_user_dependency(issuer_url)` | FastAPI-Dependency zur JWT-Validierung gegen das Auth-JWKS |
| `configure_logging()`, `get_logger()` | Strukturiertes Logging (structlog) mit `module`-Feld |
| `install_exception_handlers(app)` | Einheitliches Fehler-JSON-Format |
| `create_http_client(base_url?)` | Konfigurierter `httpx.AsyncClient` |
| `register_module(options)` | Self-Registration bei der Registry inkl. Retry |

## Kern-Module (als Services, nicht als Libraries)

| Modul | Port (lokal) | Zweck |
|---|---|---|
| Gateway | `3000` | Einziger öffentlicher Einstiegspunkt, Routing + Auth-Check |
| Auth | `3011` | OIDC-Provider (Discovery, JWKS, Login/Consent) |
| Registry | `3010` | Modul-Katalog + Health-Checks |
| App-Config | `3012` | Dynamic-App-Schemas (MongoDB) — `POST /schema` |
| Users | `3013` | Nutzer/Rollen/Rechte (Postgres) — `POST /register` (öffentlich), Rest intern |
| Elyvion Platform | `3030` | Gemeinsame Logging- und File-APIs (`/logs`, `/files`) |

Live-Status aller aktuell registrierten Module: siehe [Admin-Panel](/admin).
