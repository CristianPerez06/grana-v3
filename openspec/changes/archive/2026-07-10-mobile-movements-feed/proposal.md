## Why

La tab **Movimientos** es una de las cuatro pestañas primarias *locked* de mobile (Inicio / Movimientos / Hogar / Menú), pero hoy es un **placeholder vacío**: `apps/mobile/app/(app)/transactions.tsx` renderiza sólo el `PageHeader` + un `QuickAddFab` deshabilitado. Es el hueco de paridad más visible — una pestaña primaria en blanco.

El feed global que la alimentaría vive en `apps/web/lib/transactions/` (`getGlobalMovementsPage` sobre el RPC `get_movements_page`, el mapper `toFinancialMovement` de 8 kinds, y el contrato `MovementFilters`). Ese read ya es **isomórfico** —no importa `next/*` ni `server-only`, recibe el client Supabase como parámetro— pero todavía no está en el paquete compartido.

`web-data-access` ya nombró este momento: su requirement del slice de `@grana/transactions` dice que el feed global "PUEDE permanecer en `apps/web/lib/transactions/` **hasta que un segundo consumer (la tab Movimientos de mobile) lo requiera**". Este change **es** ese segundo consumer. Mueve el read del feed global al package y construye la pantalla nativa como thin consumer, reusando los primitivos `MovementList`/`MovementRow` (shipeados en `cards-mobile-movements-pane`) y el `MonthNavigator` (hoy en el dashboard mobile).

Es deliberadamente el **slice A-minimal**: feed navegable por mes + lista + "cargar más". **NO** incluye la barra de filtros, el breakdown por categoría, los bloques de pendientes (recurrencias/reintegros), el alta de movimiento (write) ni el detalle. Cada uno es un change posterior, aditivo (ver [Fuera de scope](#fuera-de-scope)).

## What Changes

- **Extraer a `@grana/transactions`** el read del feed global (relocalización mecánica, web behavior-preserving):
  - `toFinancialMovement` (mapper `TransactionWithDetails` → `FinancialMovement` de 8 kinds) — puro; `toInitialBalanceMovement` lo acompaña (co-locado, mismo dominio).
  - El contrato de filtros de `filters.ts`: el tipo `MovementFilters`, las constantes de límite (`DEFAULT_MOVEMENTS_LIMIT`/`MAX`/`STEP`), `monthOf`, `shiftMonth`, `movementMatchesText`, y el re-export de `resolveMonthRange`.
  - `getGlobalMovementsPage` / `getGlobalMovements` (ya isomórficos: `supabase.rpc('get_movements_page', …)`).
- **`apps/web/lib/transactions/{movements,filters,queries}.ts`** re-exportan desde `@grana/transactions` para no churnar los importadores web. Firma pública web sin cambios, query keys sin cambios, comportamiento de `/transactions` idéntico.
- **Consumer mobile (thin):**
  - `apps/mobile/lib/transactions/queries.ts` — wrapper `getGlobalMovementsPage(supabase, { month, offset })` + hook TanStack Query keyed por `(month, offset)`.
  - **Pantalla Movimientos** — `PageHeader` + selector de mes + `MovementList` nativo (reusado) + "cargar más"; empty-state por mes-vacío vs. sin-historial.
  - **Estado de mes propio** del feed (mirror de `DashboardMonthContext`), **independiente** del mes del dashboard.
  - **`MonthNavigator`** — se levanta de `components/dashboard/` a una ubicación compartida (segundo consumer real); presentacional, prop-driven, sin cambio de comportamiento en el dashboard.
- **El FAB sigue deshabilitado** (`QuickAddFab` con `DISABLED=true`) — el alta es el change B (write).
- **Las filas son no navegables** — la ruta de detalle de movimiento mobile es el change C.

## Capabilities

### New Capabilities
<!-- Ninguna capability de negocio nueva. -->

### Modified Capabilities
- `web-data-access`: el requirement del slice de `@grana/transactions` se amplía de "slice + display-VM" a **incluir el read del feed global** (`getGlobalMovementsPage`/`getGlobalMovements`, `toFinancialMovement`/`toInitialBalanceMovement`, el contrato `MovementFilters` y sus helpers) porque el segundo consumer nombrado —la tab Movimientos de mobile— ya existe. El scenario "el feed global no se mueve todavía" se invierte: ahora se mueve. Lo que queda web-only se acota a las superficies **aún** sin segundo consumer (filtros UI/estado, breakdown, filter options, pending blocks, sugerencia de categoría).
- `transactions`: nuevo requirement — la **tab Movimientos de mobile** renderiza el feed global navegable por mes (lista + cargar más), como thin consumer del read compartido, reusando `MovementList`/`MovementRow` nativos. El FAB sigue deshabilitado y las filas no navegables (write y detalle fuera de scope).

## Impact

- **Packages**: `@grana/transactions` gana el read del feed global + el contrato de filtros + `toFinancialMovement`. Sin deps nuevas (`resolveMonthRange` viene de `@grana/dashboard`, ya dep del package vía re-export; `@grana/dashboard` es isomórfico).
- **Web**: `apps/web/lib/transactions/{movements,filters,queries}.ts` pasan a re-exports thin; `/transactions` sin cambio de comportamiento. Cubierto por los 449 tests web + typecheck.
- **Mobile**: nueva pantalla Movimientos (feed + mes + cargar más) + wrapper de read + hook; `MonthNavigator` levantado a ubicación compartida. `@grana/transactions` y `@grana/dashboard` **ya** son deps de mobile.
- **Sin cambios de datos/API/RLS**: mismo RPC `get_movements_page`, misma política de frescura, mismo anon-key/RLS path que web.
- **Dependencias entre changes**: depende de `transactions-read-slice` + `cards-mobile-movements-pane` (existen `@grana/transactions`, `FinancialMovement`, `MovementList`/`MovementRow` nativos). Independiente de los write flows.

### Fuera de scope

- **Barra de filtros** (búsqueda / tipo / categoría / moneda / rango de montos) y su máquina de estado (`filters-state.ts`, acoplada a React web) → change posterior (A.2). El feed A-minimal sólo navega por mes.
- **Breakdown por categoría** (overview chart), **bloques de pendientes** (recurrencias / reintegros), **banner de sugerencia de recurrencia** → changes posteriores.
- **Alta de movimiento** (FAB + drawer + `/transactions/new`) → change B (write). El FAB sigue `DISABLED`.
- **Detalle / edición** (`/transactions/[txId]`) → change C. Las filas quedan no navegables.
- **Dedup de `apps/mobile/lib/accounts/movement-filters.ts`** (filtrado client-side del detalle de cuenta) hacia la capa compartida → va con la barra de filtros (A.2), no acá.
