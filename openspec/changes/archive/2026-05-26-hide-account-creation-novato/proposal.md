## Why

Decisión de producto (2026-05-25): en modo **novato** la app responde "cuánto tengo / en qué se fue", no "dónde está". Si el novato puede gestionar cuentas, el modo deja de distinguirse del experto y se pierde al usuario que solo quiere esas dos respuestas. Hoy crear una cuenta **no está gateado por modo**: el botón "Crear cuenta" y la ruta `/accounts/new` están disponibles para todos. Querer una cuenta adicional es intención de experto.

## What Changes

- Ocultar el punto de entrada "Crear cuenta" en modo novato (en el listado de cuentas y en el estado vacío).
- Redirigir `/accounts/new` a `/accounts` si el usuario es novato (defensa ante URL directa).
- El server action de creación **NO** se modifica ni se gatea por modo (el modo es solo-UI, per `CLAUDE.md`).
- **Fuera de alcance** (pieza futura, a diseñar): un nudge para sugerir pasar a experto y dónde exponer el cambio de modo en el menú.

## Capabilities

### Modified Capabilities
- `accounts`: agrega un requirement que en modo novato la creación de cuentas no está disponible en la UI.

## Impact

- UI web: `apps/web/app/(app)/accounts/page.tsx`, `accounts/_components/empty-accounts-state.tsx`, `accounts/new/page.tsx`.
- Reusa el patrón de lectura de modo de `apps/web/app/(app)/cards/new/page.tsx` (`profiles.select('mode')` → `isNovato`).
- Sin migraciones, sin cambios de server action, sin cambios en mobile.
