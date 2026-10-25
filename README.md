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

Ein Befehl, direkt nach dem Klonen — startet Infra-Container, installiert alle Abhängigkeiten (Backend-Workspace + beide Python-Module), wendet offene Prisma-Migrationen an und startet jedes Backend-Modul sowie das Frontend im Hintergrund:

```bash
./scripts/dev-up.sh
```

Voraussetzungen: `docker`, `node` (≥20), `pnpm`, `npm`, `uv`. Das Skript prüft diese selbst und bricht mit einer klaren Meldung ab, falls etwas fehlt.

Danach:

- Client-App: http://localhost:4200
- Gateway (API): http://localhost:3000
- Registry: http://localhost:3010/modules
- Adminer (Postgres): http://localhost:8081
- Neo4j Browser: http://localhost:7474

Logs liegen unter `.dev-run/logs/<service>.log` (gitignored). Alles wieder stoppen:

```bash
./scripts/dev-down.sh            # stoppt alle Services, lässt die Infra-Container laufen
./scripts/dev-down.sh --with-infra  # stoppt zusätzlich Postgres/Mongo/Redis/Neo4j
```

Das Skript ist absichtlich ein einfaches Shell-Skript und keine Infrastructure-as-Code-Lösung über die Deployment-Engine — die Deployment-Engine baut und betreibt *kompilierte* Artefakte gegen ein Ziel (lokal Docker, später Cloud-Provider); hier geht es um das Hochfahren der eigenen, Quellcode-basierten Dev-Services mit Hot-Reload, nicht um ein Deployment.

### Manuell, Modul für Modul

```bash
# Backend-Infrastruktur starten
cd backend && docker compose up -d

# Alle TypeScript-Backend-Services im Dev-Modus starten (Turborepo)
pnpm install && pnpm dev

# Python-Module (agent-engine, ontology-engine) einzeln, z. B.
cd modules/ontology-engine && uv sync && uv run uvicorn app.main:app --reload

# Doku-Website
cd ../../docs && npm install && npm run dev

# Frontend
cd ../frontend && npm install && npm run build:lib && npm start
```

Siehe [`backend/README.md`](backend/README.md), [`docs/README.md`](docs/README.md) und [`frontend/README.md`](frontend/README.md) für Details.
