## Why

La tab **Movimientos** de mobile ya muestra el feed y el alta está completa, pero las filas son **no navegables**: no hay pantalla de detalle nativa (`/transactions/[txId]`). Web tiene un detalle rico (hero tonal + tiles "de un vistazo" por tipo). Este change trae ese detalle a mobile en modo **read-only** y hace navegables las filas del feed — el primer paso del gap "Detalle/edit" (la edición + borrado son el change siguiente, C.2).

El bloqueo real: el read del detalle es **web-only**. La página web dispara `getTransactionDetail` / `getInstallmentFamily` / `getReimbursementsForExpense` desde `apps/web/lib/transactions/queries.ts` (RSC-only, tipadas con `DbClient`). Para que mobile sea thin consumer, esos reads del **grafo de la transacción** se extraen a `@grana/transactions` como isomórficos (`GranaSupabaseClient`), igual que el feed extrajo `getGlobalMovementsPage`. Los helpers de display ya están shared (`toFinancialMovement`, `resolveMovementView`, tono, `TRANSACTION_SELECT`, `attachLinkedExpenses`) y **las keys `transactions.detail.*` ya viven en `@grana/i18n-messages`** → cero i18n nuevo.

## What Changes

- **Extracción de reads a `@grana/transactions`** (isomórficos, `GranaSupabaseClient`): `getTransactionDetail`, `getInstallmentFamily`, `getReimbursementsForExpense` (+ sus tipos de retorno). Web pasa a consumirlos desde el package (sus reads locales se vuelven thin re-exports o se borran); los 466 tests web siguen verdes.
- **Split de movimiento compartido**: `getMovementSharedInfo` se **espeja thin** en `apps/mobile/lib/shared/queries.ts` (mismo patrón que el household read del form; el trigger de extracción al package sigue siendo "cuando aterrice el módulo Hogar"), para alimentar el tile de reparto.
- **Pantalla de detalle mobile** `/transactions/[txId]` (read-only): topbar con back que resuelve `?from=account:<id>` / `?from=card:<id>`, **hero tonal** (ícono de categoría + monto con signo/tono + línea de contexto + chips fecha·medio·categoría·subcategoría), y los **tiles core por tipo** (medio de pago, progreso de cuotas, flujo de transferencia/cambio + callout, reintegro-neto con el gasto vinculado tappable, reparto compartido, descripción). RN-idiomática sobre los VMs/tono compartidos y las keys `transactions.detail.*`.
- **Filas navegables**: se enhebra un handler de navegación por `MovementList` → `MovementRow` (nativos); la tab Movimientos empuja `/transactions/[txId]?from=…` al tocar una fila.

## Capabilities

### Modified Capabilities

- `transactions`: el requirement **"La tab Movimientos de mobile muestra el feed global navegable por mes"** se ajusta — las filas del feed YA NO son no-navegables; SHALL navegar al detalle `/transactions/[txId]`.

### Added Capabilities

- `transactions`: nuevo requirement **"La app nativa expone el detalle de movimiento `/transactions/[txId]`"** — pantalla read-only que refleja la anatomía web (topbar + hero tonal + tiles core por tipo) como thin consumer de los reads extraídos.

## Impact

- **Packages**: `@grana/transactions` gana los reads de detalle isomórficos (nuevo I/O, mismo select/enrich ya shared). Sin cambios de datos/API/RLS (mismo RLS path que web).
- **Web**: refactor a consumir los reads desde el package (sin cambio de comportamiento; tests verdes).
- **Mobile**: `apps/mobile/app/(app)/transactions/[txId].tsx` (nuevo) + tiles nativos en `apps/mobile/components/transactions/detail/`; `MovementList`/`MovementRow` ganan un prop de navegación; `apps/mobile/lib/shared/queries.ts` gana el mirror de `getMovementSharedInfo`. Sin deps nuevas.
- **i18n**: cero keys nuevas (`transactions.detail.*` ya está en `@grana/i18n-messages`).
- **Dependencias entre changes**: independiente de C.2 (edit). Requiere el feed + form ya mergeados.

### Fuera de scope

- **Edición + borrado** del movimiento (reuso de `useMovementForm` edit mode, gating editable-fields, read-only-si-lo-pagó-el-otro-miembro) → **C.2 `mobile-movement-edit`**.
- **Tiles de contexto** que requieren reads extra: **"Peso en el mes"** (`getMonthCategoryBreakdown/IncomeBreakdown`), **recurrencia** (tile + historial + banner, `getRecurrenceLink/Detail`) y **composición de pago de resumen** (`getCardPeriodDetail`). Se difieren a una slice posterior — la pantalla los omite sin romper.
- **Navegación de filas fuera del feed global** (panes de account-detail y card-period usan el mismo `MovementRow`; adoptarán el prop en un follow-up, no acá).
