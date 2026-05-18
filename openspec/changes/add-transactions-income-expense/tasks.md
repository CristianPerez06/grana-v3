## 1. Migración SQL

- [x] 1.1 Crear `supabase/migrations/0008_transactions.sql` con: `CREATE TYPE transaction_type AS ENUM ('income', 'expense')`, tabla `transactions(id, user_id, account_id, category_id, subcategory_id, type, amount, currency_code, date, description, is_verified, created_at)`.
- [x] 1.2 Agregar constraints: `chk_amount_positive` (`amount > 0`), FK `account_id REFERENCES accounts(id) ON DELETE CASCADE`, FK `category_id REFERENCES categories(id) ON DELETE RESTRICT`, FK `subcategory_id REFERENCES subcategories(id) ON DELETE SET NULL`, FK `currency_code REFERENCES currencies(code)`.
- [x] 1.3 Agregar índices: `idx_transactions_account_currency` (`account_id, currency_code`), `idx_transactions_user_date` (`user_id, date DESC`), `idx_transactions_account_date` (`account_id, date DESC, created_at DESC`).
- [x] 1.4 Habilitar RLS en `transactions` y crear policies SELECT/INSERT/UPDATE/DELETE filtradas por `user_id = auth.uid()`.
- [x] 1.5 Actualizar la action `deactivateCurrencyFromAccount` en `apps/web/app/_actions/accounts.ts` para que el chequeo de saldo cero incluya la suma de transacciones además de `initial_balance`.
- [x] 1.6 Agregar bloque self-check (estilo `0001_profiles.sql`): valida tabla, enum, RLS, policies, FK, índices. `RAISE EXCEPTION` ante cualquier ausencia.
- [x] 1.7 Agregar SELECT final de resumen con flags booleanos para el SQL Editor.

## 2. Tipos y package supabase

- [x] 2.1 Aplicar `0008_transactions.sql` contra el proyecto Supabase remoto vía SQL Editor.
- [x] 2.2 Regenerar tipos: `./node_modules/.bin/supabase gen types typescript --project-id exhpnnaigjfcxcvmptxa > packages/supabase/src/types.ts`.
- [x] 2.3 Verificar que `transactions` y `transaction_type` aparecen en `packages/supabase/src/types.ts`.

## 3. Validation package

- [x] 3.1 Crear `packages/validation/src/transactions.ts` con `createIncomeSchema`: `account_id` uuid requerido, `currency_code` oneOf(['ARS','USD']), `amount` número > 0, `date` string fecha requerida, `category_id` uuid opcional, `subcategory_id` uuid opcional, `description` string opcional.
- [x] 3.2 Agregar `createExpenseSchema`: igual que ingreso pero `category_id` requerido.
- [x] 3.3 Agregar `updateTransactionSchema`: `amount` > 0 opcional, `date` opcional, `description` opcional, `category_id` opcional, `subcategory_id` opcional. Rechaza `type`, `account_id`, `currency_code`.
- [x] 3.4 Re-exportar todo en `packages/validation/src/index.ts`.

## 4. i18n keys

- [x] 4.1 Agregar bloque `transactions.*` en `packages/i18n-messages/src/es.json`: títulos, labels (Monto, Fecha, Categoría, Descripción, Tipo), tipos (Ingreso, Gasto), placeholders, errores, estado vacío, confirmación de eliminación.
- [x] 4.2 Replicar misma estructura en `packages/i18n-messages/src/en.json`.

## 5. Tipos de dominio y queries (apps/web)

- [x] 5.1 Crear `apps/web/lib/transactions/types.ts` con `Transaction`, `TransactionType`, `CreateIncomeInput`, `CreateExpenseInput`, `UpdateTransactionInput`, `TransactionWithDetails`.
- [x] 5.2 Crear `apps/web/lib/transactions/queries.ts` con `getTransactions(accountId, options: { limit?, offset?, currencyCode? })`: SELECT con JOIN a `categories` y `subcategories`, ORDER BY `date DESC, created_at DESC`.
- [x] 5.3 Agregar `getTransactionDetail(id)`: SELECT con JOINs, retorna `TransactionWithDetails | null`.
- [x] 5.4 Crear `apps/web/lib/transactions/balance.ts` con `getTransactionSums(accountIds)`: SELECT `account_id, currency_code, SUM(CASE WHEN type='income' THEN amount ELSE -amount END) as net` GROUP BY `(account_id, currency_code)`. Retorna `Map<accountId, Record<currency, number>>`.
- [x] 5.5 Actualizar `apps/web/lib/accounts/utils.ts` — `computeBalance` pasa a aceptar `txSums: Record<'ARS'|'USD', number>` como segundo argumento y lo suma al `initial_balance`. Signature: `computeBalance(account, txSums?)`.
- [x] 5.6 Actualizar `apps/web/lib/accounts/queries.ts` — `getAccounts` y `getAccountDetail` llaman a `getTransactionSums` y pasan el resultado a los componentes.

## 6. Server actions (apps/web)

- [x] 6.1 Crear `apps/web/app/_actions/transactions.ts` con `createIncome`: valida con `createIncomeSchema`, verifica que `currency_code` tiene una `account_currencies` activa en la cuenta, inserta en `transactions` con `type='income'`, llama `revalidatePath`.
- [x] 6.2 Agregar `createExpense`: igual que `createIncome` pero valida con `createExpenseSchema` y `type='expense'`.
- [x] 6.3 Agregar `updateTransaction`: valida con `updateTransactionSchema`, actualiza solo los campos mutables (rechaza `type`, `account_id`, `currency_code`), verifica ownership vía RLS.
- [x] 6.4 Agregar `deleteTransaction`: verifica ownership vía RLS, ejecuta DELETE, llama `revalidatePath`.
- [x] 6.5 Cada action llama a `revalidatePath('/accounts')` y `revalidatePath(`/accounts/${accountId}`)`.

## 7. UI — Lista de movimientos en detalle de cuenta (`/accounts/[id]`)

- [x] 7.1 Crear `apps/web/lib/transactions/components/transaction-list.tsx` (Server Component): recibe lista de transacciones y las renderiza agrupadas por fecha.
- [x] 7.2 Crear `apps/web/app/(app)/accounts/[id]/_components/transaction-row.tsx` (Client Component): muestra fecha, monto con signo visual, categoría, descripción; click → navega a detalle.
- [x] 7.3 Actualizar `apps/web/app/(app)/accounts/[id]/page.tsx`: reemplaza el placeholder de movimientos por `TransactionList`; pasa el saldo real calculado con `getTransactionSums`.
- [x] 7.4 Actualizar `AccountDetailHeader` para recibir y mostrar el saldo real (balance = initial_balance + txSums) en lugar del placeholder.
- [x] 7.5 Botón/FAB "+ Agregar" en la pantalla de detalle que navega a `/accounts/[id]/transactions/new`.

## 8. UI — Crear transacción (`/accounts/[id]/transactions/new`)

- [x] 8.1 Crear `apps/web/app/(app)/accounts/[id]/transactions/new/page.tsx` (Server Component): carga cuenta, monedas activas y categorías; pasa al form.
- [x] 8.2 Crear `apps/web/app/(app)/accounts/[id]/transactions/new/_components/transaction-form.tsx` (Client Component): tabs Ingreso / Gasto; campos: moneda (selector si hay más de una activa), monto, fecha (default hoy AR), categoría (solo en gasto), subcategoría (opcional), descripción (opcional).
- [x] 8.3 Submit invoca `createIncome` o `createExpense` según tab; on success navega a `/accounts/[id]`; on error muestra mensaje.

## 9. UI — Detalle de transacción (`/accounts/[id]/transactions/[txId]`)

- [x] 9.1 Crear `apps/web/app/(app)/accounts/[id]/transactions/[txId]/page.tsx` (Server Component): carga `getTransactionDetail`, renderiza detalle completo.
- [x] 9.2 Crear `_components/transaction-detail-header.tsx`: tipo, monto, moneda, fecha, cuenta.
- [x] 9.3 Acciones: Editar → `/accounts/[id]/transactions/[txId]/edit`; Eliminar → dialog de confirmación + `deleteTransaction`.

## 10. UI — Editar transacción (`/accounts/[id]/transactions/[txId]/edit`)

- [x] 10.1 Crear `apps/web/app/(app)/accounts/[id]/transactions/[txId]/edit/page.tsx` con form pre-llenado.
- [x] 10.2 Campos editables: monto, fecha, categoría, subcategoría, descripción. `type`, cuenta y moneda son read-only con label "no editable".
- [x] 10.3 Submit invoca `updateTransaction`; on success navega a `/accounts/[id]/transactions/[txId]`.

## 11. Documentación

- [x] 11.1 Actualizar `SUPABASE_SETUP.md` con instrucciones de aplicación de `0008_transactions.sql`.
- [ ] 11.2 Actualizar módulo #5 en `CLAUDE.md` de `🔲 Planned` a `✅ Done` post-merge.

## 12. Validación final

- [x] 12.1 Correr `openspec validate add-transactions-income-expense` sin errores.
- [x] 12.2 Correr `pnpm build` sin errores.
- [ ] 12.3 Test manual: crear ingreso → verificar saldo; crear gasto con categoría → verificar saldo; editar monto → verificar saldo; eliminar → verificar saldo vuelve al estado anterior.
