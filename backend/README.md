# Elyvion Backend

Modulares Backend: ein Gateway, ein Auth-Provider (OIDC/OAuth 2.1), eine Registry, eine Users- und Rechteverwaltung, eine App-Config-Verwaltung (MongoDB) und beliebig viele Business-Module (TypeScript oder Python), die sich selbst bei der Registry registrieren. Details & Diagramme: [Doku-Website](../docs).

## Setup

```bash
docker compose up -d        # Postgres + Adminer (localhost:8081) + MongoDB
# lokal läuft bereits Postgres/MongoDB? docker-compose ist optional — Module lesen nur DATABASE_URL/MONGODB_URI.

# jedes Modul braucht eine .env (einmalig, pro Modul):
for m in modules/registry modules/security-layer/auth modules/gateway modules/security-layer/users modules/resource-layer/app-config templates/module-ts; do
  cp "$m/.env.example" "$m/.env"
done

pnpm install
pnpm --filter registry prisma:generate && pnpm --filter registry prisma:migrate
pnpm --filter users prisma:generate && pnpm --filter users prisma:migrate
pnpm --filter app-config run seed    # legt die "default" App-Config an (ein Button)

pnpm dev                          # startet alle Module parallel (Turborepo)
```

Reihenfolge beim ersten Start egal — jedes Modul versucht mehrfach, sich bei der Registry zu registrieren (Retry mit Backoff), falls diese noch hochfährt. Es gibt keinen Seed-User mehr — Accounts werden über `POST /api/users/register` (bzw. die Angular-Registrierungsseite) angelegt; Auth validiert Logins gegen den `users`-Service.

## Ports (lokal)

| Modul | Port |
|---|---|
| Gateway | 3000 |
| Registry | 3010 |
| Auth | 3011 |
| App-Config (MongoDB) | 3012 |
| Users (Postgres) | 3013 |
| module-ts Template | 3100 |
| module-py Template | 8100 |

## Ein neues Modul

Siehe [Patterns](../docs/content/patterns.md) — kurz: `templates/module-ts` oder `templates/module-py` klonen, `.env` anpassen, starten.
