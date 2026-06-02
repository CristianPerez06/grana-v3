## Why

La ruta `/accounts` en `apps/web` ya fue refactorizada en `feat/accounts-route-shell` para seguir el patrón de **route shell** (header always-on + secciones aisladas con su propio loading/error), análogo al que ya se aplicó en `/cards` (ver `openspec/specs/cards/spec.md:653`). Esa implementación está mergeable, pero el spec de `accounts` no lo refleja: una IA fresca leyendo el repo creería que `/accounts` sigue siendo un único `Promise.all` server-side y podría regresarlo sin romper ningún scenario. Este change codifica el contrato para que el spec sea la memoria de la decisión.

## What Changes

- Agregar un nuevo requirement al spec `accounts` que codifique:
  - El header de `/accounts` se renderiza desde el primer paint sin esperar al fetch del cuerpo.
  - El cuerpo se divide en **dos** secciones aisladas — activas (cash + bank + hint) y archivadas — cada una con su propio container, query, `try/catch` y `SectionFallback` para loading/error.
  - Un Client Component error boundary (`AccountsErrorBoundary`) envuelve el scaffold como red de seguridad, y al activarse muestra `<RouteError>` sin tapar el header.
  - El CTA "+ Crear cuenta" del header se renderiza **disabled** mientras el catálogo de instituciones no resolvió, y se habilita cuando llega; la sección de archivadas **NO** ocupa espacio cuando resuelve con cero (sin slot fantasma).
- La semántica del estado vacío global (`EmptyAccountsState`) queda codificada dentro del nuevo requirement: se muestra cuando no hay cuentas activas, independientemente del estado de archivadas — el CTA primario para crear vive ahora siempre en el header, por lo que el CTA secundario del empty es informativo, no necesario para que el usuario avance.

Sin cambios de comportamiento adicionales: las reglas existentes de grouping, archived styling, column alignment, y per-group empty omission siguen intactas, así que el requirement "El usuario puede ver la lista de sus cuentas agrupadas por tipo" NO se modifica.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `accounts`: agrega un nuevo requirement de route shell para `/accounts` web (header always-on + secciones aisladas + error boundary + reglas del header CTA y de la sección archivadas).

## Impact

- **Specs**: `openspec/specs/accounts/spec.md` — un requirement nuevo (ADDED). El requirement existente del listado queda intacto.
- **Code**: ninguno adicional — el código ya vive en `feat/accounts-route-shell`. El change archiva la decisión que ese branch ya implementó.
- **Tests / verificación**: no se introducen scenarios nuevos que requieran tests nuevos por fuera de los que el spec mismo establece; los scenarios son contractuales y verificables manualmente (typecheck + lint + dev smoke ya pasaron en el branch).
- **APIs/Dependencies**: ninguna.
