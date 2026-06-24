## Why

El detalle de cuenta en mobile (change `mobile-accounts-route`) necesita la **lista de movimientos por cuenta con saldo corriente** y la card de **reintegros pendientes**, exactamente como las muestra `/accounts/[id]` en web. Pero los reads que las alimentan —`getAccountMovementsAscending`, `getPendingReimbursements`— y su tipo `TransactionWithDetails` viven en `apps/web/lib/transactions/`, importables solo desde web. La única pieza ya compartida es `computeRunningBalances` (en `@grana/money-logic`); el read que le da de comer, no.

Esta change extrae **solo el read slice account-scoped de transactions** —el que el detalle de cuenta consume— a un paquete `@grana/transactions`, siguiendo el patrón ya establecido por `@grana/cards` (un slice, no el dominio completo) y `@grana/accounts` (reads client-agnósticos, primer parámetro = client Supabase). Es deliberadamente un **slice**: el feed global de movimientos (`/transactions`, filtros, breakdown, pending blocks) se queda en `apps/web/lib/transactions/` hasta que mobile construya la tab Movimientos (change posterior, aditiva).

Es la **segunda de tres** changes (`accounts-mutations-neutral-errors` → **`transactions-read-slice`** → `mobile-accounts-route`). El payoff es doble: desbloquea la lista de movimientos del detalle de cuenta en mobile **y** deja listo el slice que la futura tab Movimientos nativa va a necesitar — no es trabajo de usar-y-tirar.

## What Changes

- **Nuevo paquete `@grana/transactions`** (`packages/transactions/`), read slice client-agnóstico. Deps: `@grana/money-logic`, `@grana/supabase` (+ `@grana/ui-contracts` si los tipos lo requieren). NO depende de `@grana/transactions-mutations` (writes) — es su contraparte de lectura.
- **`src/types.ts`** — mover `Transaction`, `TransactionWithDetails` y `PendingReimbursementVM` desde `apps/web/lib/transactions/types.ts` (solo los tipos que el slice expone).
- **`src/queries.ts`** — mover `getAccountMovementsAscending(supabase, accountId)` y `getPendingReimbursements(supabase, accountId?)`, más sus helpers internos (`isHistoryRow`, `attachLinkedExpenses` / el self-join de gastos vinculados). Reciben `supabase` como primer parámetro; **no necesitan `today`** (son reads de historial, no de período).
- **`apps/web/lib/transactions/queries.ts` + `types.ts`** — re-exportan desde `@grana/transactions` para no churnar los ~N importadores web. Firma pública web sin cambios, query keys sin cambios.
- **`computeRunningBalances` se queda en `@grana/money-logic`** (ya compartido); `@grana/transactions` no lo duplica — el caller (web hoy, mobile en #3) compone reads + `computeRunningBalances`.
- **El feed global de movimientos NO se mueve** todavía (filtros, breakdown, filter options, pending blocks, sugerencia de categoría): se quedan en `apps/web/lib/transactions/` hasta la tab Movimientos mobile.
- **Sin cambios de comportamiento ni de RLS.** Relocalización mecánica de wrappers Supabase + tipos DB-row.

## Capabilities

### New Capabilities
<!-- Ninguna capability de negocio nueva. -->

### Modified Capabilities
- `web-data-access`: se agrega el contrato de que el read slice account-scoped de transactions (movimientos ascendentes por cuenta + reintegros pendientes + sus tipos) vive en `@grana/transactions`, client-agnóstico y reutilizable desde mobile, con `today` no requerido.

## Impact

- **Código (nuevo paquete):** `packages/transactions/` (`package.json`, `src/index.ts`, `src/types.ts`, `src/queries.ts`).
- **Código (web, thin):** `apps/web/lib/transactions/{queries,types}.ts` (re-exports); `apps/web/package.json` (+`@grana/transactions: workspace:*`); call sites del detalle de cuenta sin cambio de superficie.
- **Sin cambios de datos/API/RLS.** Mismos query keys (`accountMovementsAscending`, `accountPendingReimbursements`), misma frescura.
- **Prep mobile:** ES el trabajo de habilitación de la lista de movimientos del detalle de cuenta en mobile (espejo de cómo `@grana/accounts` habilitó las pantallas de cuentas). Además deja el slice listo para la tab Movimientos nativa.
- **Detalle a confirmar en apply (ver design):** nombre del paquete (`@grana/transactions` vs `@grana/transactions-reads`); alcance exacto de helpers a arrastrar (que `getAccountMovementsAscending`/`getPendingReimbursements` no traigan dependencias del feed global que amplíen el slice de más).
- **Riesgos:** medio-bajo. Las queries tocan el stitching de gastos vinculados (reimbursements) y el orden de cálculo (date/created_at/id asc) que `computeRunningBalances` asume; los tests existentes + typecheck + un pase manual de `/accounts/[id]` (saldo corriente + card de reintegros) cubren la equivalencia.
