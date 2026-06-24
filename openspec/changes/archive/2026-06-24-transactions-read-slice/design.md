## Contexto

Segunda de tres changes hacia el espejo de cuentas en mobile. Extrae el read slice account-scoped de transactions a `@grana/transactions`, para que el detalle de cuenta nativo (change #3) pueda mostrar la lista de movimientos con saldo corriente y los reintegros pendientes. Mirror estructural de `extract-cards-read-slice`.

## El boundary (precedente del repo)

```
┌──────────── apps/web (platform shell) ───────────────┐
│  lib/transactions/queries.ts  → re-export thin       │
│  query keys (accountMovementsAscending, …)           │
│        │ pasa supabase                                │
│        ▼                                              │
│  ┌────────── @grana/transactions (read slice) ─────┐ │
│  │ fns async puras. 1er arg = SupabaseClient.      │ │
│  │ sin today (reads de historial). caller compone  │ │
│  │ con computeRunningBalances.                      │ │
│  │ NO 'use server' / createClient / revalidate / next/* │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
        │ depende de
        ▼
  @grana/money-logic (computeRunningBalances, calculateTransactionSums)  ·  @grana/supabase
```

## Mapa de extracción

| Origen (apps/web) | Destino (@grana/transactions) | Notas |
|---|---|---|
| `lib/transactions/types.ts` (`Transaction`, `TransactionWithDetails`, `PendingReimbursementVM`) | `src/types.ts` | Solo los tipos que el slice expone. El resto de tipos del feed global se quedan. |
| `lib/transactions/queries.ts` (`getAccountMovementsAscending`) | `src/queries.ts` | `(supabase, accountId)`. Orden de cálculo date/created_at/id asc. |
| `lib/transactions/queries.ts` (`getPendingReimbursements`) | `src/queries.ts` | `(supabase, accountId?)`. Stitch de gasto vinculado. |
| helpers internos (`isHistoryRow`, `attachLinkedExpenses`) | `src/queries.ts` (privados) | Mueven con sus consumidores; no se exportan si solo los usan los dos reads. |

## Decisión: es un slice, no el dominio transactions completo

Igual que `@grana/cards` extrajo solo lo que cuentas consume, `@grana/transactions` extrae solo lo que el **detalle de cuenta** consume: los dos reads account-scoped + sus tipos. El feed global (`getTransactions`, filtros, breakdown, filter options, pending blocks, sugerencia de categoría) **no se mueve** — se queda en `apps/web/lib/transactions/` hasta que mobile construya la tab Movimientos. El costo aceptado es un split temporal (algunos reads en el paquete, el resto en web), idéntico al smell de tidiness aceptado en el slice de cards. Sin bloqueo: la lógica pesada (`computeRunningBalances`, aritmética monetaria, fecha) ya vive en `@grana/money-logic`.

## Decisión: `computeRunningBalances` se queda en money-logic; el caller compone

El saldo corriente por fila no se calcula en la query — es client-side. Web hoy hace: `getAccountMovementsAscending` (orden de cálculo) + `getAccountDetail` (saldos iniciales por moneda) → `computeRunningBalances(rows, accountId, initial)` → `Map<txId, {ARS,USD}>`. `@grana/transactions` provee solo el read; `computeRunningBalances` sigue en `@grana/money-logic` (ya compartido, pure fn sobre rows anónimas, sin acoplar al tipo de dominio). En #3 el detalle mobile compone exactamente igual: read del paquete + `computeRunningBalances` de money-logic.

## Decisión: sin `today` en este slice

A diferencia de `@grana/cards` (cuyos reads necesitan `today` para derivar estado de período), estos dos reads son de **historial**: `getAccountMovementsAscending` trae todo el historial ascendente, `getPendingReimbursements` filtra por `received_at IS NULL`. Ninguno depende de "hoy". Así que la firma es `(supabase, accountId)` / `(supabase, accountId?)`, sin el parámetro `today` inyectado. (Si en apply aparece una dependencia de fecha oculta, se inyecta como en cards; no se asume.)

## Decisión: nombre del paquete — `@grana/transactions` (reads), a confirmar

Ya existe `@grana/transactions-mutations` (writes). El read slice es su contraparte natural: `@grana/transactions` (reads). Alternativa: `@grana/transactions-reads` para simetría explícita con el sufijo `-mutations`. Recomendación: `@grana/transactions` (más corto, y "transactions" sin sufijo lee como el read path, igual que `@grana/dashboard`/`@grana/cards` son reads). A confirmar en apply al crear el `package.json`.

## Verificación

`pnpm --filter web typecheck` + `lint` + `test` pasan; `pnpm openspec:check`. Paridad validada porque los re-exports web preservan firma y query keys. Pase manual de `/accounts/[id]`: la lista de movimientos muestra el saldo corriente correcto por fila (el orden de cálculo se preservó) y la card "A confirmar" lista los reintegros pendientes de esa cuenta.
