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

Ein Befehl, direkt nach dem Klonen — startet Infrastruktur und alle Backend-Anwendungsdienste als Docker-Container, installiert die Abhängigkeiten, wendet offene Prisma-Migrationen auf der Compose-Postgres an und startet den Angular-Client als Host-Entwicklungsserver:

```bash
./scripts/dev-up.sh
```

Voraussetzungen: Docker mit Compose, `node` (≥20), `pnpm` und `npm`. Python-Services werden ebenfalls als Container gebaut; `uv` muss nicht auf dem Host installiert sein. Fehlende lokale Runtime-Tokens werden zufällig erzeugt und mit eingeschränkten Dateirechten unter `backend/.secrets/` gespeichert.

Danach:

- Client-App: http://localhost:4200
- Gateway (API): http://localhost:3000
- Registry: http://localhost:3010/modules
- Adminer (Postgres): http://localhost:8081
- Neo4j Browser: http://localhost:7474

Der Frontend-Log liegt unter `.dev-run/logs/client.log` (gitignored); Backend-Logs lassen sich mit `cd backend && docker compose logs -f <service>` ansehen. Alles wieder stoppen (Postgres und die übrige Infrastruktur bleiben standardmäßig erhalten; die Datenbank-Volumes werden auch mit `--with-infra` nicht gelöscht):

```bash
./scripts/dev-down.sh            # stoppt alle Services, lässt die Infra-Container laufen
./scripts/dev-down.sh --with-infra  # stoppt zusätzlich alle Compose-Container, Daten bleiben erhalten
```

Das Skript ist absichtlich ein einfaches Shell-Skript und keine Infrastructure-as-Code-Lösung über die Deployment-Engine — die Deployment-Engine baut und betreibt *kompilierte* Artefakte gegen ein Ziel (lokal Docker, später Cloud-Provider); hier geht es um das Hochfahren der eigenen Entwicklungsumgebung. Backend-Code läuft in Compose-Containern, der Angular-Client lokal mit Live-Reload.

### Manueller Start

```bash
# Backend-Migrationen anwenden und alle Backend-Container sowie den Client starten
./scripts/dev-up.sh
```

Siehe [`backend/README.md`](backend/README.md), [`docs/README.md`](docs/README.md) und [`frontend/README.md`](frontend/README.md) für Details.
