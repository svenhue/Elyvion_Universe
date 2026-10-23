---
title: Elyvion Universe
---

# Elyvion Universe

**Elyvion Universe** ist die Architektur-Basis für KI-first generierte Individualsoftware für KMUs. Statt für jedes Kundenprojekt (Logistiker, Handwerksbetriebe, Dienstleister, …) von null zu starten, liefert dieses Repository ein modulares Fundament, das sich schnell um kundenspezifische Geschäftslogik erweitern lässt.

## Die drei Bausteine

- **[Architektur](/architecture)** – wie Gateway, Auth, Registry und Business-Module zusammenspielen
- **[Patterns](/patterns)** – wiederverwendbare Muster für neue Module (TypeScript & Python)
- **[Best Practices](/best-practices)** – Konventionen für Namensgebung, Fehlerbehandlung, Logging, Security
- **[Services](/services)** – Referenz aller Shared Services (`@elyvion/shared`, `elyvion_shared`)
- **[Dynamic Rendering](/dynamic-rendering)** – komplette Angular-Anwendungen zur Laufzeit aus einem JSON-Schema rendern

Das laufende System (registrierte Module, Health-Status) siehst du im **[Admin-Panel](/admin)**.

## Repository-Layout

```
Elyvion_Universe/
├── backend/
│   ├── modules/{gateway,auth,registry}/
│   ├── templates/{module-ts,module-py}/
│   └── packages/{shared-ts,shared-py}/
├── docs/              ← diese Website
└── frontend/
    ├── shared-lib/
    └── client/
```
