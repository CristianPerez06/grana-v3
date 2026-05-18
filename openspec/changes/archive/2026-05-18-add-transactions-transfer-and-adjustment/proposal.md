## Why

Con ingresos y gastos funcionando, faltan dos operaciones básicas para que el modelo financiero sea completo: **transferencias** (mover plata entre cuentas propias) y **ajustes** (corregir el saldo cuando lo registrado no matchea la realidad). Sin transferencias el usuario no puede modelar movimientos comunes (efectivo → banco, banco A → banco B). Sin ajustes, cualquier divergencia entre saldo real y saldo calculado queda sin remedio.

## What Changes

- **Enum extendido**: `ALTER TYPE transaction_type ADD VALUE 'transfer'` y `ADD VALUE 'adjustment'`.
- **Nueva columna**: `transactions.transfer_destination_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT`. Solo se setea para `type='transfer'`.
- **Constraint modificada**: `chk_amount_positive` se reemplaza por `chk_amount_positive_non_adjustment` (`amount > 0` excepto para `type='adjustment'`, donde `amount` puede ser negativo). Esto permite que ajustes lleven signo: positivo suma al saldo, negativo resta.
- **Nuevas constraints**: `chk_transfer_has_destination`, `chk_transfer_different_accounts`, `chk_non_transfer_no_destination`.
- **Nuevo índice**: `idx_transactions_destination` parcial sobre `transfer_destination_account_id IS NOT NULL`.
- **Balance derivado actualizado**: la fórmula en `getTransactionSums` ahora considera 4 fuentes por cuenta — ingresos (+), gastos (-), transferencias salientes (-), transferencias entrantes (+), ajustes (signed).
- **Server actions** (en `apps/web/`):
  - `createTransfer` — valida misma moneda en ambas cuentas, ambas activas; inserta una fila atómica.
  - `createAdjustment` — valida cuenta, moneda activa; permite amount negativo o positivo.
  - `updateTransfer` — edita monto, fecha, descripción. Inmutables: `type`, ambas cuentas, moneda.
  - `updateAdjustment` — edita monto (con signo), fecha, descripción.
  - `deleteTransfer`, `deleteAdjustment` — hard delete; misma lógica que `deleteTransaction`.
- **Queries**:
  - `getTransactions(accountId)` ahora incluye filas donde `transfer_destination_account_id = accountId` (transferencias entrantes), no solo `account_id = accountId`.
  - `getTransactionDetail` se mantiene sin cambios — el detalle pertenece a la fila.
- **Pantallas web**:
  - `/accounts/[id]/transactions/new` — 4 tabs: Ingreso, Gasto, Transferencia, Ajuste. Cada uno con su set de campos.
  - `/accounts/[id]` — la lista de movimientos diferencia visualmente transferencias entrantes vs salientes y muestra la cuenta contraparte. Ajustes se muestran con ícono propio.
  - `/accounts/[id]/transactions/[txId]` — detalle muestra cuenta destino (transfer) o flag "ajuste" con signo.
- **Validations** (en `@grana/validation`):
  - `createTransferSchema`: `account_id`, `transfer_destination_account_id` (uuid distinto al origen), `currency_code`, `amount > 0`, `date`, `description?`.
  - `createAdjustmentSchema`: `account_id`, `currency_code`, `amount` (no-cero; positivo o negativo), `date`, `description?`.
  - `updateTransferSchema` y `updateAdjustmentSchema`: solo campos mutables.
- **i18n**: nuevas claves bajo `transactions.types.transfer`, `transactions.types.adjustment` y labels asociados en `es.json` y `en.json`.

**Out of scope** (changes posteriores):

- Transferencias entre monedas distintas (FX) — fuera del modelo bimoneda actual.
- Pago de resumen de tarjeta (es una transferencia especial que requiere el módulo de tarjetas) → `add-accounts-credit-cards`.
- Recurrencias → `add-recurrences`.
- Cuotas → `add-accounts-credit-cards`.

## Capabilities

### New Capabilities

(ninguna — extiende la capability existente)

### Modified Capabilities

- `transactions`: agrega requirements para transferencias, ajustes, balance derivado con transferencias, lista que incluye transferencias entrantes, edición/eliminación de transfer y adjustment.

## Impact

- **Migración nueva**: `supabase/migrations/0009_transactions_transfer_adjustment.sql` con `ALTER TYPE`, columna, constraints, índice y self-check.
- **Regen de tipos**: `packages/supabase/src/types.ts` debe regenerarse después de aplicar la migración.
- **`apps/web/lib/transactions/`**:
  - `types.ts`: nuevos campos `transfer_destination_account_id`, types para `CreateTransferInput`, `CreateAdjustmentInput`.
  - `queries.ts`: `getTransactions` modifica el WHERE para incluir transferencias entrantes.
  - `balance.ts`: `getTransactionSums` actualiza la fórmula con 4 ramas (income/expense/transfer/adjustment).
- **`apps/web/app/_actions/transactions.ts`**: agrega 4 actions nuevas (createTransfer/Adjustment, updateTransfer/Adjustment) más 2 deletes (o reutiliza el existente).
- **`apps/web/app/(app)/accounts/[id]/transactions/`**: form de nueva transacción suma 2 tabs; vistas de lista/detalle/edit suman casos para transfer y adjustment.
- **`packages/validation/`**: agrega schemas para transfer y adjustment.
- **`packages/i18n-messages/`**: agrega claves bajo `transactions.types.*` y campos relacionados.
- **Próximos changes desbloqueados**: `add-accounts-credit-cards` (pago de resumen es una transferencia), `add-recurrences` (puede usar cualquier tipo).
