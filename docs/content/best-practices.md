---
title: Best Practices
---

# Best Practices

## Naming

- Modulname (Registry) = Verzeichnisname = Routensegment hinter `/api/` am Gateway (`backend/modules/invoicing` → `GET /api/invoicing/...`)
- TypeScript-Pakete im `@elyvion/*`-Namespace, Python-Pakete als `elyvion_*`

## Fehlerbehandlung

Jedes Modul gibt Fehler im selben JSON-Format zurück (siehe `ElyvionExceptionFilter` / `install_exception_handlers`):

```json
{ "error": { "statusCode": 404, "message": "...", "path": "/tasks/123", "correlationId": "...", "timestamp": "..." } }
```

Keine modul-eigenen Fehlerformate einführen — Frontends und das Gateway verlassen sich auf diese Struktur.

## Logging

Strukturiertes JSON-Logging (pino auf TS-Seite, structlog auf Python-Seite), jede Zeile trägt ein `module`-Feld. Korrelation über den Header `x-correlation-id`, den das Gateway bei jedem proxied Request setzt (bzw. selbst generiert, falls nicht vorhanden).

## Security

- **Nie** eigene Krypto-/Token-Logik schreiben — Auth-Standard ist OIDC/OAuth 2.1 über `oidc-provider`, Validierung über JWKS (`jose` / `python-jose`)
- Redirect-URIs sind eine explizite Allowlist pro Client, keine Wildcards
- PKCE ist für alle Clients erzwungen (`pkce.required: () => true`)
- Secrets (DB-Passwörter, zukünftige Client-Secrets) nur über `.env` (nicht committed) — `.env.example` dokumentiert benötigte Variablen
- Produktiv: eigene JWKS-Keys statt des oidc-provider-Default-Dev-Keystores, Redis/Postgres-Adapter statt In-Memory für OIDC-Sessions

## Module-Lifecycle

1. Modul startet → registriert sich bei der Registry (`registerModule()` / `register_module()`)
2. Registry pingt `healthCheckUrl` alle 30s
3. Gateway liest die Modul-Liste alle 15s neu ein — ein neues Modul ist spätestens nach ~15–45s über das Gateway erreichbar, ohne Gateway-Neustart

## Frontend

- Geteilte UI/Logik → `frontend/shared-lib`, niemals in `frontend/client` duplizieren
- `frontend/client` ist eine **Vorlage** zum Klonen pro Kundenprojekt, kein gemeinsam deploytes Produkt — Breaking Changes dort sind unkritisch für andere Kundenprojekte, weil jedes seinen eigenen Klon besitzt
