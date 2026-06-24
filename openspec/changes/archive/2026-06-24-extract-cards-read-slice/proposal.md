## Why

`@grana/accounts` (la próxima extracción de la capa de datos de cuentas, change `extract-accounts-data-layer`) no puede ser un paquete autocontenido sin las cuentas `credit`: `getAccounts` —el catálogo de cuentas más consumido del repo (8+ call sites: `shared/(home)`, `shared/settle`, `cards/[id]/periods/[periodId]/pay`, drawer/header/pending de `transactions`, botón de `transactions/recurring`)— **embebe los resúmenes de tarjeta** (`credit: CreditCardSummary[]`), y `archiveAccount` consulta deuda pendiente vía `getCreditCardDebtCheck`. Hoy esas funciones viven en `apps/web/lib/cards/queries.ts` y solo pueden importarse desde web.

Esta change extrae **solo el read slice de cards que cuentas consume** a un paquete `@grana/cards`, siguiendo el patrón ya establecido por `@grana/transactions-mutations` (la lógica pura vive abajo; el wrapper Supabase es client-agnóstico; web/mobile inyectan client + `today`). Es deliberadamente un **slice**, no el dominio cards completo: el resto de la lectura de tarjetas (detalle de período, wallet hero, pagos, cuotas en curso) se queda en `apps/web/lib/cards/` hasta que mobile construya pantallas de tarjetas (change posterior, aditivo).

El costo aceptado es un **split temporal**: tres funciones de lectura quedan en `@grana/cards` mientras el resto del read layer de cards sigue en `apps/web/lib/cards/`. Es un smell de tidiness en web, no un bloqueo: la lógica pesada (`derivePeriodStatus`, variantes, aritmética monetaria, `getTodayAR`) **ya está compartida** en `@grana/money-logic` / `@grana/transactions-mutations`, así que el slice es una **relocalización mecánica** de wrappers Supabase + tipos DB-row, sin reescribir lógica.

## What Changes

- **Nuevo paquete `@grana/cards`** (`packages/cards/`), shape espejo de `@grana/transactions-mutations`: `main`/`types` → `src/index.ts`, deps `@grana/money-logic` + `@grana/supabase` (+ `@grana/transactions-mutations` para los period helpers).
- **Mover al paquete el closure de lectura que cuentas necesita:**
  - `getCreditCards(supabase, { today, includeArchived?, archivedOnly? })` — el agregador de resúmenes de tarjeta (períodos, status, cuotas activas, montos pendientes, en-curso).
  - `getCreditCardDebtCheck(supabase, accountId, today)` — guard de deuda para archive/delete.
  - Tipos: `CreditCardSummary`, `CardPeriodWithPayment`, `PeriodVariant`, `CardPeriodAlert` (y el closure de `month-summary.ts` que `getCreditCards` consume transitivamente).
- **Inyección de `today`**: las funciones del paquete reciben `today: Date` como parámetro (precedente `@grana/transactions-mutations`), en vez de llamar `getTodayAR()` internamente. El wrapper web pasa `getTodayAR()`.
- **`apps/web/lib/cards/queries.ts` re-exporta desde `@grana/cards`** los tres símbolos movidos (wrappers thin que inyectan `getTodayAR()`), para no churnar los imports del resto de cards. El comportamiento web no cambia.
- **Sin cambios de comportamiento**: misma data, mismos query keys, misma RLS. Es una refactorización estructural.

## Capabilities

### New Capabilities
<!-- Ninguna capability de negocio nueva. -->

### Modified Capabilities
- `web-data-access`: se agrega el contrato de que el read slice cross-dominio de cards (el que `@grana/accounts` consume) vive en `@grana/cards`, client-agnóstico y reutilizable desde mobile, con `today` inyectado por el caller.

## Impact

- **Código (nuevo paquete):** `packages/cards/` (`package.json`, `src/index.ts`, `src/queries.ts`, `src/month-summary.ts`, `src/types.ts`).
- **Código (web, thin wrappers):** `apps/web/lib/cards/queries.ts` pasa a re-exportar `getCreditCards`/`getCreditCardDebtCheck`/`CreditCardSummary` desde `@grana/cards` inyectando `getTodayAR()`; `apps/web/lib/cards/types.ts` re-exporta los tipos movidos.
- **Sin cambios de datos/API/RLS.** Mismos query keys (`accountsList`, etc.), misma frescura.
- **Dependencia que habilita:** desbloquea `extract-accounts-data-layer` (`@grana/accounts → @grana/cards → @grana/money-logic`).
- **Fuera de alcance (se queda en `apps/web/lib/cards/`):** detalle de período, wallet hero mensual, pagos/reversión, cuotas en curso, vistas de `/cards`. Split temporal documentado; se completa cuando mobile construya pantallas de tarjetas.
- **Riesgos:** bajo. La lógica pesada ya está en packages; el slice relocaliza wrappers Supabase + tipos DB-row. Riesgo principal: que el closure transitivo de `getCreditCards` arrastre más de lo previsto (mitigado: `lib/cards/utils.ts` es un re-export de `@grana/money-logic`, no lógica propia).
