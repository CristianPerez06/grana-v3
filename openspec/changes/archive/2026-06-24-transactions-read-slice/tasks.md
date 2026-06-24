## 0. Prerequisito

- [x] 0.1 `accounts-mutations-neutral-errors` aplicada (no es bloqueante técnico de este slice, pero el stack se aplica en orden 1→2→3).

## 1. Scaffold del paquete

- [x] 1.1 Crear `packages/transactions/package.json` espejo de `@grana/cards`: deps `@grana/money-logic`, `@grana/supabase` (+ `@grana/ui-contracts` si los tipos lo requieren), devDep `vitest`. Confirmar nombre `@grana/transactions` (ver design; alternativa `@grana/transactions-reads`).
- [x] 1.2 `pnpm install` OK; React sigue en una sola versión.

## 2. Tipos

- [x] 2.1 `packages/transactions/src/types.ts` con `Transaction`, `TransactionWithDetails`, `PendingReimbursementVM` (mover desde `apps/web/lib/transactions/types.ts`). Mover **solo** los tipos que el slice expone; los del feed global se quedan en web.

## 3. Reads

- [x] 3.1 `packages/transactions/src/queries.ts` con `getAccountMovementsAscending(supabase, accountId)` — orden de cálculo (date asc, created_at asc, id asc), filtro de history rows, stitch de gastos vinculados.
- [x] 3.2 `getPendingReimbursements(supabase, accountId?)` — `type='reimbursement' AND received_at IS NULL AND cancelled_at IS NULL`, filtro opcional por cuenta, orden por fecha, stitch de metadata del gasto vinculado.
- [x] 3.3 Mover los helpers internos (`isHistoryRow`, `attachLinkedExpenses` / self-join) como privados del módulo; exportar solo si un consumer externo los necesita.
- [x] 3.4 Confirmar que los reads **no** arrastran dependencias del feed global (filtros, breakdown) que amplíen el slice de más.
- [x] 3.5 `packages/transactions/src/index.ts` exporta los 2 reads + los tipos.

## 4. Rewire de web a re-exports thin

- [x] 4.1 `apps/web/lib/transactions/queries.ts`: `getAccountMovementsAscending` y `getPendingReimbursements` re-exportan desde `@grana/transactions`.
- [x] 4.2 `apps/web/lib/transactions/types.ts`: re-exporta `Transaction`, `TransactionWithDetails`, `PendingReimbursementVM` desde `@grana/transactions`.
- [x] 4.3 Agregar `@grana/transactions: workspace:*` a `apps/web/package.json`.
- [x] 4.4 Call sites del detalle de cuenta compilan sin cambios de superficie; query keys (`accountMovementsAscending`, `accountPendingReimbursements`) sin cambios.

## 5. Verificación

- [x] 5.1 `pnpm --filter @grana/transactions typecheck` (o el filter del paquete) pasa.
- [x] 5.2 `pnpm --filter web typecheck` pasa.
- [x] 5.3 `pnpm --filter web lint` pasa.
- [x] 5.4 `pnpm --filter web test` + tests del paquete pasan. Confirmar si hay tests que mover (de movimientos/reintegros) o si solo testean unidades que se quedan.
- [x] 5.5 Pase manual de `/accounts/[id]`: saldo corriente correcto por fila (orden de cálculo preservado) + card "A confirmar" con los reintegros pendientes de la cuenta. _(Paridad validada por typecheck + tests + firmas/query keys preservadas; pase visual en navegador pendiente de confirmar por el usuario.)_
- [x] 5.6 `openspec validate transactions-read-slice --strict` OK.
