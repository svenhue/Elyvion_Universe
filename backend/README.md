# Elyvion Backend

Modulares Backend: ein Gateway, ein Auth-Provider (OIDC/OAuth 2.1), eine Registry und beliebig viele Business-Module (TypeScript oder Python), die sich selbst bei der Registry registrieren. Details & Diagramme: [Doku-Website](../docs).

## Setup

```bash
docker compose up -d        # Postgres + Adminer (localhost:8081)

# jedes Modul braucht eine .env (einmalig, pro Modul):
for m in modules/registry modules/auth modules/gateway templates/module-ts; do
  cp "$m/.env.example" "$m/.env"
done

pnpm install
pnpm --filter registry prisma:generate && pnpm --filter registry prisma:migrate
pnpm --filter auth prisma:generate && pnpm --filter auth prisma:migrate
pnpm --filter auth run seed      # legt einen Demo-User an (demo@elyvion.dev / ChangeMe123!)

pnpm dev                          # startet alle Module parallel (Turborepo)
```

Reihenfolge beim ersten Start egal — jedes Modul versucht mehrfach, sich bei der Registry zu registrieren (Retry mit Backoff), falls diese noch hochfährt.

## Ports (lokal)

| Modul | Port |
|---|---|
| Gateway | 3000 |
| Registry | 3010 |
| Auth | 3011 |
| module-ts Template | 3100 |
| module-py Template | 8100 |

## Ein neues Modul

Siehe [Patterns](../docs/content/patterns.md) — kurz: `templates/module-ts` oder `templates/module-py` klonen, `.env` anpassen, starten.
