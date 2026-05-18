## Why

El módulo `accounts` está funcionando pero los saldos son solo el `initial_balance` estático — sin transacciones reales el producto no tiene valor. Este change introduce la capacidad de registrar ingresos y gastos en cuentas de efectivo y bancarias, completando el ciclo mínimo para que Grana sea utilizable en el día a día.

## What Changes

- **Tabla nueva**: `transactions` con soporte para `income` y `expense` en cuentas `cash` y `bank`.
  - `transactions(id, user_id, account_id, category_id, subcategory_id, type, amount, currency_code, date, description, notes, is_verified, created_at)`
  - `type IN ('income', 'expense')` — enum extensible; `transfer` y `adjustment` entran en changes posteriores.
  - `amount NUMERIC(18,2) NOT NULL CHECK (amount > 0)` — siempre positivo; el tipo determina la dirección.
  - `currency_code` debe coincidir con una `account_currencies` activa de la cuenta.
- **RLS**: cada usuario lee/modifica solo sus propias transacciones.
- **Balance derivado real**: `getAccounts` y `getAccountDetail` calculan `balance = initial_balance + Σ transactions.amount` (ingresos suman, gastos restan) en lugar del placeholder estático.
- **Server actions** (en `apps/web/`):
  - `createIncome` — registra un ingreso en una cuenta y moneda específica.
  - `createExpense` — registra un gasto con categoría requerida.
  - `updateTransaction` — edita monto, fecha, descripción, categoría. Inmutable: `type`, `account_id`, `currency_code`.
  - `deleteTransaction` — hard delete; sin soft-delete en v1 (no hay restricciones referenciales en este slice).
- **Queries**:
  - `getTransactions(accountId, options)` — lista paginada con filtros por tipo, moneda y rango de fechas.
  - `getTransactionDetail(id)` — detalle completo con categoría e institución.
- **Pantallas web**:
  - `/accounts/[id]` — la sección de movimientos (actualmente placeholder) pasa a mostrar la lista real de transacciones con balance derivado actualizado.
  - `/accounts/[id]/transactions/new` — formulario unificado con tabs Ingreso / Gasto.
  - `/accounts/[id]/transactions/[txId]` — detalle con acciones Editar / Eliminar.
- **Validaciones** (en `@grana/validation`):
  - `createIncomeSchema` y `createExpenseSchema`: `amount > 0`, `currency_code` requerido, `date` requerida, `category_id` requerido solo en gastos.
  - `updateTransactionSchema`: `amount`, `date`, `description`, `category_id` opcionales; rechaza `type`, `account_id`, `currency_code`.
- **i18n**: nuevas claves `transactions.*` en `es.json` y `en.json`.
- **`computeBalance` real**: reemplaza el placeholder en `apps/web/lib/accounts/utils.ts`.

**Out of scope** (changes posteriores explícitos):

- Transferencias entre cuentas (`type='transfer'`, par de transacciones vinculadas) → `add-transactions-transfer`.
- Ajustes de saldo (`type='adjustment'`) → `add-transactions-adjustment`.
- Recurrencias → `add-recurrences`.
- Cuotas de tarjeta de crédito → `add-accounts-credit-cards`.
- Pago de resumen de tarjeta.
- Autocategorizador por historial/keywords.
- Filtros avanzados, búsqueda y exportación.

## Capabilities

### New Capabilities

- `transactions`: Registro de ingresos y gastos en cuentas cash y bank; lista paginada por cuenta; balance derivado real; detalle y edición de transacciones individuales.

### Modified Capabilities

- `accounts`: el cálculo de saldo pasa de `initial_balance` estático a `initial_balance + Σ transactions` (la query y `computeBalance` cambian, no el schema ni el spec de la capability en sí).

## Impact

- **Migración nueva**: `supabase/migrations/0008_transactions.sql` con tabla, enum, RLS, índices y self-check.
- **Regen de tipos**: `packages/supabase/src/types.ts` debe regenerarse después de aplicar la migración.
- **`apps/web/`**: nuevas rutas bajo `app/(app)/accounts/[id]/transactions/`; `AccountDetailHeader` muestra balance real; lista de movimientos en `accounts/[id]/page.tsx` reemplaza el placeholder.
- **`packages/validation/`**: agrega `transactions.ts`.
- **`packages/i18n-messages/`**: agrega bloque `transactions.*`.
- **`apps/web/lib/accounts/utils.ts`**: `computeBalance` pasa a incluir la suma de transacciones.
- **Próximos changes que se desbloquean**: `add-transactions-transfer`, `add-transactions-adjustment`, `add-recurrences`.
