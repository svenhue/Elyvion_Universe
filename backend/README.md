# Elyvion Backend

Modulares Backend mit Gateway, Auth (OIDC/OAuth 2.1), Registry und Security für Benutzer, Mandanten, Rollen und Berechtigungen. Die übrigen TypeScript- und Python-Anwendungsdienste laufen ebenfalls als Docker-Compose-Container. Details & Diagramme: [Doku-Website](../docs).

## Setup

Vom Repository-Root aus starten:

```bash
./scripts/dev-up.sh
```

Das Skript startet die Infrastruktur, installiert den Backend-Workspace, wendet Prisma-Migrationen auf der Compose-Postgres an, erzeugt fehlende lokale Runtime-Secrets und baut/startet alle Backend-Container. Nur der Angular-Client läuft als Host-Entwicklungsserver. Host-seitiges `uv` ist nicht erforderlich.

Stoppen:

```bash
./scripts/dev-down.sh              # stoppt Frontend und Backend, Infrastruktur bleibt aktiv
./scripts/dev-down.sh --with-infra # stoppt zusätzlich die Infrastruktur; Daten-Volumes bleiben erhalten
```

`docker compose up -d --build` aus diesem Ordner startet alle Compose-Dienste direkt. Für den vollständigen Entwicklungsstart empfiehlt sich `dev-up.sh`, da das Skript zusätzlich Migrationen und lokale Laufzeit-Secrets vorbereitet.

## Lokal veröffentlichte Ports

| Dienst | Port |
|---|---:|
| Gateway (API) | 3000 |
| Registry | 3010 |
| Auth | 3011 |
| Security | 3022 |
| Elyvion Platform | 3030 |
| PostgreSQL | 5433 |
| Adminer | 8081 |
| MongoDB | 27017 |
| Redis | 6379 |
| Neo4j Browser / Bolt | 7474 / 7687 |

Die übrigen Backend-Dienste sind innerhalb des Compose-Netzwerks erreichbar und werden über das Gateway angesprochen. `users`, Rollen und Berechtigungen werden ausschließlich durch den Security-Service verwaltet; es gibt keinen separaten Users-Service.

Der Compose-Dev-Stack verwendet für Data Adapters die Umgebung `local-development`. Die Auflösung gespeicherter Adapter-Secrets bleibt fail-closed, bis dafür eine passend eingeschränkte Workload-Identität in Security eingerichtet und deren Credential-Datei bereitgestellt ist.

## Ein neues Modul

Siehe [Patterns](../docs/content/patterns.md) — kurz: `templates/module-ts` oder `templates/module-py` als Ausgangspunkt verwenden und die neue Anwendung in `docker-compose.yml` sowie in den Start-/Stop-Ablauf integrieren.
