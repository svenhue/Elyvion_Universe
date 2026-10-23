# Elyvion Universe — Dokumentation

Nuxt 3 + `@nuxt/content` + `@nuxt/ui`. Enthält die komplette Architektur-Doku (`content/`) sowie ein Live-Admin-Panel (`/admin`) gegen Registry & Auth.

## Entwicklung

```bash
cp .env.example .env
npm install
npm run dev
```

Für funktionierende Live-Daten im Admin-Panel müssen `backend/modules/registry` und `backend/modules/auth` laufen (siehe [`backend/README.md`](../backend/README.md)).

## Struktur

- `content/*.md` — Architektur, Patterns, Best Practices, Services (jede Datei = eine Route über `app/pages/[...slug].vue`)
- `app/pages/admin/index.vue` — Admin-Panel, fragt live `registryUrl`/`authIssuerUrl` aus `nuxt.config.ts` → `runtimeConfig.public` ab
