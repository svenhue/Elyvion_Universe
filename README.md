# Elyvion Universe

Architektur-Basis für KI-first generierte Individualsoftware für KMUs. Dieses Repository ist kein einzelnes Produkt, sondern ein **Fundament**, aus dem heraus neue, kundenspezifische Module und Anwendungen schnell und konsistent aufgebaut werden können.

## Struktur

| Ordner | Inhalt |
|---|---|
| [`backend/`](backend/) | Modulares Backend: Gateway, Auth (OIDC/OAuth 2.1), Registry, Modul-Vorlagen (TypeScript/Python), geteilte Pattern-Pakete |
| [`docs/`](docs/) | Nuxt-Doku-Website: Architektur, Patterns, Best Practices, verfügbare Services, Admin-Panel |
| [`frontend/`](frontend/) | Angular Shared-Library + klonbares Client-App-Skeleton |

Details zu jedem Bereich stehen im jeweiligen Unterordner-README sowie ausführlich in der [Dokumentations-Website](docs/).

## Quickstart

```bash
# Backend-Infrastruktur (Postgres) starten
cd backend && docker compose up -d

# Alle Backend-Services im Dev-Modus starten (Turborepo)
pnpm install && pnpm dev

# Doku-Website
cd ../docs && npm install && npm run dev

# Frontend
cd ../frontend/client && npm install && npm start
```

Siehe [`backend/README.md`](backend/README.md), [`docs/README.md`](docs/README.md) und [`frontend/README.md`](frontend/README.md) für Details.
