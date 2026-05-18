## 1. Migración SQL

- [x] 1.1 Crear `supabase/migrations/0009_transactions_transfer_adjustment.sql` con `ALTER TYPE transaction_type ADD VALUE 'transfer'` y `ADD VALUE 'adjustment'`.
- [x] 1.2 Agregar columna `transfer_destination_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT` a `transactions`.
- [x] 1.3 Reemplazar constraint `chk_amount_positive` por `chk_amount_positive_non_adjustment` (`type = 'adjustment' OR amount > 0`). Agregar también `chk_adjustment_amount_nonzero` (`type != 'adjustment' OR amount != 0`).
- [x] 1.4 Agregar constraint `chk_transfer_has_destination` (`type != 'transfer' OR transfer_destination_account_id IS NOT NULL`), `chk_transfer_different_accounts` (`type != 'transfer' OR account_id != transfer_destination_account_id`), `chk_non_transfer_no_destination` (`type = 'transfer' OR transfer_destination_account_id IS NULL`).
- [x] 1.5 Agregar índice parcial `idx_transactions_destination` sobre `transfer_destination_account_id WHERE transfer_destination_account_id IS NOT NULL`.
- [x] 1.6 Agregar bloque self-check: verifica enum values, columna nueva, constraints, índice.
- [x] 1.7 Agregar SELECT final de resumen con flags booleanos para el SQL Editor.

## 2. Tipos y package supabase

- [x] 2.1 Aplicar `0009_transactions_transfer_adjustment.sql` contra el proyecto Supabase remoto vía SQL Editor.
- [x] 2.2 Regenerar tipos: `./node_modules/.bin/supabase gen types typescript --project-id exhpnnaigjfcxcvmptxa > packages/supabase/src/types.ts`.
- [x] 2.3 Verificar que `transfer_destination_account_id` aparece en `transactions` y que `transaction_type` incluye `'transfer'` y `'adjustment'`.

> ⚠️ Tareas 2.1–2.3 son pasos manuales. Tipos actualizados manualmente para que el build pase. Regenerar con supabase gen types después de aplicar la migración.

## 3. Validation package

- [x] 3.1 Agregar `createTransferSchema` en `packages/validation/src/transactions.ts`: `account_id` uuid requerido, `transfer_destination_account_id` uuid requerido (distinto a `account_id` via `.test()`), `currency_code` oneOf(['ARS','USD']), `amount` > 0, `date` requerida, `description` opcional.
- [x] 3.2 Agregar `createAdjustmentSchema`: `account_id` uuid requerido, `currency_code` oneOf, `amount` número distinto de cero (puede ser negativo), `date` requerida, `description` opcional.
- [x] 3.3 Agregar `updateTransferSchema`: `amount` > 0 opcional, `date` opcional, `description` opcional. Rechaza `type`, `account_id`, `transfer_destination_account_id`, `currency_code`.
- [x] 3.4 Agregar `updateAdjustmentSchema`: `amount` distinto de cero opcional, `date` opcional, `description` opcional. Rechaza `type`, `account_id`, `currency_code`.
- [x] 3.5 Re-exportar todo en `packages/validation/src/index.ts`.

## 4. i18n keys

- [x] 4.1 Agregar en `packages/i18n-messages/src/es.json` bajo `transactions.*`: `tabs.transfer`, `tabs.adjustment`, `types.transfer`, `types.adjustment`, labels (`destination_account`, `direction`), placeholders, errors (`destination_required`, `destination_same_as_source`, `currency_inactive_destination`, `amount_nonzero`), variantes de la confirmación de eliminación.
- [x] 4.2 Replicar la misma estructura en `packages/i18n-messages/src/en.json`.

## 5. Tipos de dominio y queries (apps/web)

- [x] 5.1 Actualizar `apps/web/lib/transactions/types.ts`: agregar `'transfer' | 'adjustment'` al `TransactionType`, agregar `transfer_destination_account_id: string | null` al `Transaction`, agregar `destination_account?: { id, name } | null` al `TransactionWithDetails`. Definir `CreateTransferInput`, `CreateAdjustmentInput`, `UpdateTransferInput`, `UpdateAdjustmentInput`.
- [x] 5.2 Actualizar `apps/web/lib/transactions/queries.ts` — `getTransactions(accountId)`: cambiar el WHERE a `.or('account_id.eq.{id},transfer_destination_account_id.eq.{id}')`. Agregar join con `destination_account:accounts!transfer_destination_account_id(id, name)` en el SELECT.
- [x] 5.3 Actualizar `getTransactionDetail`: agregar el mismo join `destination_account` para que el detalle muestre la cuenta destino.
- [x] 5.4 Actualizar `apps/web/lib/transactions/balance.ts` — `getTransactionSums`: la query ahora trae filas donde `account_id IN (...) OR transfer_destination_account_id IN (...)`. Iterar las filas y para cada una, aplicar la fórmula: `+amount` (income), `-amount` (expense), `+amount` o `-amount` para transferencias según qué lado matchee, `+amount` (signed) para adjustment.
- [x] 5.5 Actualizar la lógica de `deactivateCurrencyFromAccount` en `_actions/accounts.ts` para que considere también transferencias entrantes en la suma total (no solo transacciones donde `account_id = ?`).

## 6. Server actions (apps/web)

- [x] 6.1 Agregar `createTransfer` en `apps/web/app/_actions/transactions.ts`: valida con `createTransferSchema`, verifica que la moneda está activa en ambas cuentas (origen y destino), inserta una fila atómica, llama `revalidatePath` para `/accounts`, `/accounts/[origen]` y `/accounts/[destino]`.
- [x] 6.2 Agregar `createAdjustment`: valida con `createAdjustmentSchema`, verifica que la moneda está activa en la cuenta, inserta con `type='adjustment'` y `amount` con signo.
- [x] 6.3 Agregar `updateTransfer`: valida con `updateTransferSchema`, actualiza monto/fecha/descripción, rechaza cambios de cuentas o moneda. Revalidate paths de origen y destino.
- [x] 6.4 Agregar `updateAdjustment`: similar pero para tipo adjustment.
- [x] 6.5 Reusar `deleteTransaction` para transfer y adjustment, o crear `deleteTransfer`/`deleteAdjustment` específicos si necesitan revalidate paths distintos (transfer revalida ambas cuentas).

## 7. UI — Form de creación con 4 tabs

- [x] 7.1 Actualizar `apps/web/app/(app)/accounts/[id]/transactions/new/page.tsx` para cargar también la lista de cuentas activas (excluyendo la actual) para el selector de destino.
- [x] 7.2 Actualizar `transaction-form.tsx`: agregar tabs `Transferencia` y `Ajuste`.
- [x] 7.3 Implementar campos del tab Transferencia: selector de cuenta destino (combobox), selector de moneda (auto si solo una en común; selector si varias), monto > 0, fecha (default hoy AR), descripción opcional. Al cambiar la cuenta destino, recalcular monedas en común.
- [x] 7.4 Implementar campos del tab Ajuste: selector de moneda (si la cuenta tiene varias activas), radio de dirección (Suma / Resta), monto positivo en el input (el signo se aplica al submit), fecha, descripción opcional.
- [x] 7.5 Submit invoca `createTransfer` o `createAdjustment` según tab; on success navega a `/accounts/[id]`; on error muestra mensaje.

## 8. UI — Lista de movimientos con transferencias y ajustes

- [x] 8.1 Actualizar `apps/web/lib/transactions/components/transaction-list.tsx` para recibir `currentAccountId` y diferenciar el render según el tipo y el sentido (saliente vs entrante para transferencias).
- [x] 8.2 Mostrar para transferencias salientes: signo `−`, etiqueta secundaria "→ {nombre cuenta destino}".
- [x] 8.3 Mostrar para transferencias entrantes: signo `+`, etiqueta secundaria "← {nombre cuenta origen}".
- [x] 8.4 Mostrar para ajustes: signo según signo del `amount`, label "Ajuste".
- [x] 8.5 `accounts/[id]/page.tsx` ya pasaba `accountId={account.id}` — sin cambios requeridos.

## 9. UI — Detalle de transacción

- [x] 9.1 Actualizar `transaction-detail-header.tsx` para mostrar campos específicos por tipo:
  - Transfer: cuenta origen y cuenta destino (en lugar de categoría).
  - Adjustment: monto con signo claro (positivo o negativo) y label "Ajuste de saldo".
  - Income/Expense: sin cambios respecto a v1.

## 10. UI — Editar transacción

- [x] 10.1 Actualizar `edit-transaction-form.tsx` para soportar transfer y adjustment:
  - Transfer: monto, fecha, descripción editables. Mostrar cuenta destino y moneda como read-only con label "no editable".
  - Adjustment: monto (con sign UI: input positivo + radio de dirección), fecha, descripción editables.
- [x] 10.2 Submit envía el payload correcto según tipo. Para ajustes, recalcular el signo en cliente antes de enviar.

## 11. Documentación

- [x] 11.1 Actualizar `SUPABASE_SETUP.md` con instrucciones de aplicación de `0009_transactions_transfer_adjustment.sql`.

## 12. Validación final

- [x] 12.1 Correr `openspec validate add-transactions-transfer-and-adjustment` sin errores.
- [x] 12.2 Correr `pnpm build` sin errores. ✓ Build pasa limpio.
- [x] 12.3 Test manual: crear transferencia A→B → verificar saldos de ambas cuentas; crear ajuste positivo → verificar saldo; crear ajuste negativo → verificar saldo; editar monto de transferencia → verificar saldos; editar signo de ajuste → verificar saldo; eliminar transferencia → verificar saldos vuelven al estado anterior; eliminar ajuste → idem.
