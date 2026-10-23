---
title: Patterns
---

# Patterns

## Ein neues TypeScript-Modul anlegen

```bash
cp -r backend/templates/module-ts backend/modules/<mein-modul>
cd backend/modules/<mein-modul>
# package.json: "name" anpassen
cp .env.example .env
# MODULE_NAME, PORT, MODULE_BASE_URL in .env anpassen
pnpm install
pnpm dev
```

Das Modul registriert sich beim Start automatisch bei der Registry (`REGISTRY_URL`) und ist danach über `GET /api/<mein-modul>/...` am Gateway erreichbar.

Enthaltene Beispiele:

- `src/tasks/*` – CRUD-Resource (in-memory, als Vorlage für eine echte Persistenzschicht)
- `src/jobs/example-cron.service.ts` – `@nestjs/schedule`-Cronjob

## Ein neues Python-Modul anlegen

```bash
cp -r backend/templates/module-py backend/templates/<mein-modul>
cd backend/templates/<mein-modul>
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8100
```

Enthaltene Beispiele:

- `app/tasks/*` – CRUD-Resource (in-memory)
- `app/jobs/scheduler.py` – APScheduler-Cronjob

## Persistenz hinzufügen

Für echte Fachlogik: Prisma + Postgres (TypeScript, siehe `modules/registry/prisma/schema.prisma` als Referenz) bzw. SQLAlchemy/SQLModel + Postgres (Python). Jedes Modul bekommt sein eigenes Postgres-Schema über `DATABASE_URL=".../elyvion?schema=<mein-modul>"` auf derselben lokalen Postgres-Instanz (`backend/docker-compose.yml`).

## Einen Endpoint absichern

Standardmäßig prüft **nur das Gateway** eingehende Bearer-Token. Braucht ein Modul zusätzlich Defense-in-Depth (z. B. weil es auch direkt erreichbar ist), steht `JwtAuthGuard` / `ElyvionAuthModule.forRoot()` aus `@elyvion/shared` bzw. `make_current_user_dependency()` aus `elyvion_shared` bereit – beide validieren gegen das JWKS-Endpoint des Auth-Moduls.

```ts
// TypeScript
import { ElyvionAuthModule } from '@elyvion/shared'

@Module({
  imports: [ElyvionAuthModule.forRoot({ issuerUrl: process.env.AUTH_ISSUER_URL! })],
})
export class AppModule {}
```

```python
# Python
from elyvion_shared import make_current_user_dependency
from fastapi import Depends

CurrentUser = make_current_user_dependency(settings.auth_issuer_url)

@router.get("/me")
def me(user: dict = Depends(CurrentUser)):
    return user
```

## Einen öffentlichen Endpoint am Gateway freischalten

Ausnahme von der Regel oben: ein neuer Account hat noch kein Token (Registrierung). Dafür gibt es `PUBLIC_ROUTES` in `backend/modules/gateway/src/main.ts` — eine explizite Allowlist aus `{ moduleName: ['/exakter/pfad'] }`, nicht mehr. Alles andere bleibt per Default hinter Auth:

```ts
const PUBLIC_ROUTES: PublicRouteAllowlist = {
  users: ['/register'],
};
```

## Einen neuen OIDC-Client registrieren

Neues Frontend/App? Redirect-URI in `backend/modules/auth/src/oidc/clients.ts` eintragen (Allowlist — nicht zur Laufzeit verhandelbar). Für produktive Mandanten-Clients diese statische Liste durch eine DB-gestützte Client-Registrierung ersetzen.

## Angular-Komponenten/Services teilen

Wiederverwendbare UI-Komponenten oder Services, die mehrere Kundenprojekte brauchen, gehören in `frontend/shared-lib`, nicht direkt in `frontend/client`. Siehe [Services](/services) für die aktuell vorhandenen Bausteine.
