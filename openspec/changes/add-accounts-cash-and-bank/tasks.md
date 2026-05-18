## 1. Migración SQL

- [x] 1.1 Crear `supabase/migrations/0007_accounts.sql` con: `CREATE TYPE account_type AS ENUM ('cash', 'bank')`, tabla `accounts`, tabla `account_currencies`, índices (`idx_accounts_user`, `idx_account_currencies_account`).
- [x] 1.2 Agregar check constraint `chk_cash_no_institution` (`type != 'cash' OR institution_id IS NULL`) y `chk_bank_has_institution` (`type != 'bank' OR institution_id IS NOT NULL`) en `accounts`.
- [x] 1.3 Agregar check constraint `chk_account_currencies_supported` (`currency_code IN ('ARS', 'USD')`) y `chk_initial_balance_non_negative` (`initial_balance >= 0`) en `account_currencies`.
- [x] 1.4 Agregar FK `account_currencies.currency_code REFERENCES currencies(code)` y `accounts.institution_id REFERENCES institutions(id) ON DELETE RESTRICT`.
- [x] 1.5 Habilitar RLS en `accounts` y crear policies SELECT/INSERT/UPDATE/DELETE filtradas por `user_id = auth.uid()`.
- [x] 1.6 Habilitar RLS en `account_currencies` y crear policies que verifican ownership vía EXISTS contra `accounts`.
- [x] 1.7 Crear función `public.handle_new_user_default_account()` (`SECURITY DEFINER`) que inserta `accounts` (Efectivo, cash) + dos filas `account_currencies` (ARS, USD, balance 0) para el nuevo `auth.users`.
- [x] 1.8 Crear trigger `on_auth_user_created_default_account AFTER INSERT ON auth.users` que dispara la función anterior.
- [x] 1.9 Agregar bloque `DO $$ … $$` de backfill que itera `auth.users` y crea la Efectivo default a usuarios sin ninguna cuenta `cash`. Idempotente.
- [x] 1.10 Agregar bloque self-check final (estilo `0001_profiles.sql`): valida tablas, enum, RLS, policies, función, trigger, índices. `RAISE EXCEPTION` ante cualquier ausencia.
- [x] 1.11 Agregar SELECT final de resumen con flags booleanos (table_exists, rls_enabled, policy_count, trigger_installed, function_installed, default_accounts_count) para que el SQL Editor muestre estado verde.

## 2. Tipos y package supabase

- [x] 2.1 Aplicar la migración `0007_accounts.sql` contra el proyecto Supabase remoto vía SQL Editor.
- [x] 2.2 Regenerar tipos: `supabase gen types typescript --project-id <id> > packages/supabase/src/types.ts`.
- [x] 2.3 Verificar que los nuevos types `accounts` y `account_currencies` aparecen en `packages/supabase/src/types.ts`.

## 3. Validation package

- [x] 3.1 Crear `packages/validation/src/accounts.ts` con `createAccountSchema` (Yup): `name` 1–50, `type` enum, `institution_id` condicional según `type`, `currencies` array de `{ currency_code in ('ARS','USD'), initial_balance >= 0 }` con `min(1)`.
- [x] 3.2 Agregar `updateAccountSchema` (`name` y `institution_id` opcionales; rechaza `type`, `initial_balance`).
- [x] 3.3 Agregar `addCurrencySchema` (`currency_code in ('ARS','USD')`, `initial_balance >= 0`).
- [x] 3.4 Re-exportar todo en `packages/validation/src/index.ts`.

## 4. i18n keys

- [x] 4.1 Agregar bloque `accounts.*` en `packages/i18n-messages/src/es.json`: títulos de pantalla, secciones (Efectivo, Cuentas bancarias), labels (Nombre, Institución, Saldo inicial), placeholders, mensajes de error, estado vacío, `defaultCashName='Efectivo'`.
- [x] 4.2 Replicar misma estructura en `packages/i18n-messages/src/en.json` con traducciones inglesas (`defaultCashName='Cash'`).
- [x] 4.3 Confirmar que ambos JSON tienen las mismas claves (validación que ya está en CI o test unit).

## 5. Server actions (apps/web)

- [x] 5.1 Crear `apps/web/lib/accounts/types.ts` con `CreateAccountInput`, `UpdateAccountInput`, `AddCurrencyInput`, `AccountWithDetails`, `AccountWithBalances`, `GroupedAccounts`.
- [x] 5.2 Implementar `apps/web/app/_actions/accounts.ts` — `createAccount`: valida con `createAccountSchema`, inserta `accounts` + `account_currencies` en transacción con rollback manual ante fallo.
- [x] 5.3 `updateAccount`: valida payload, ejecuta UPDATE solo si la cuenta pertenece al usuario (RLS). Bloquea cambio de `type` y de `initial_balance`.
- [x] 5.4 `archiveAccount`: chequea saldo derivado por moneda (en v1, solo `initial_balance`); bloquea si ≠ 0; setea `is_active = false`.
- [x] 5.5 `reactivateAccount`: setea `is_active = true`.
- [x] 5.6 `deleteAccount`: chequea referencias (envuelto en try/catch sobre EXISTS contra `transactions` para futuro-proof); ejecuta DELETE.
- [x] 5.7 `addCurrencyToAccount` y `deactivateCurrencyFromAccount`: con las reglas de "al menos una activa" y "saldo ≠ 0 bloquea desactivar".
- [x] 5.8 Cada action llama a `revalidatePath('/accounts')` al final para refrescar la lista.

## 6. Queries (apps/web)

- [x] 6.1 Implementar `apps/web/lib/accounts/queries.ts` — `getAccounts`: SELECT con LEFT JOIN sobre `institutions` y `account_currencies`. Retorna `GroupedAccounts` con secciones `cash` y `bank`. Soporta filtro `includeArchived: boolean` (default false).
- [x] 6.2 `getAccountDetail(id)`: SELECT joinado, retorna `AccountWithDetails` o null.
- [x] 6.3 `computeBalance`: en v1 retorna `initial_balance` por moneda. Placeholder documentado para cuando exista `transactions`.

## 7. UI — Lista (`/accounts`)

- [x] 7.1 Crear `apps/web/app/(app)/accounts/page.tsx` (Server Component) que llama a `getAccounts()` y renderiza las secciones.
- [x] 7.2 Componente `AccountSection.tsx` (título + contador + lista de rows).
- [x] 7.3 Componente `AccountRow.tsx` (nombre, institución chip si bank, saldos por moneda, click → navega a detalle).
- [x] 7.4 Componente `EmptyAccountsState.tsx` para el estado vacío con CTA.
- [x] 7.5 FAB / botón "Crear cuenta" que navega a `/accounts/new`.
- [ ] 7.6 Redirect server-side a `/` si el usuario está en modo `novato` — diferido: la columna `mode` no existe en `profiles` todavía; se implementará cuando se añada el modo usuario.

## 8. UI — Crear (`/accounts/new`)

- [x] 8.1 Crear `apps/web/app/(app)/accounts/new/page.tsx` con form client-component.
- [x] 8.2 Componente `CreateAccountForm.tsx`: segmented control de `type` (Efectivo / Bancaria); campos dinámicos.
- [x] 8.3 Selector de institución (combobox con search) que muestra solo `institutions` activas; se renderiza solo cuando `type='bank'`.
- [x] 8.4 Checkbox group de monedas (ARS / USD) con input numérico de saldo inicial por moneda elegida. ARS marcado por default.
- [x] 8.5 Submit invoca `createAccount` action; on success navega a `/accounts/[id]`; on error muestra mensaje.

## 9. UI — Detalle (`/accounts/[id]`)

- [x] 9.1 Crear `apps/web/app/(app)/accounts/[id]/page.tsx` (Server Component).
- [x] 9.2 Componente `AccountDetailHeader.tsx`: nombre, chip institución (si bank), saldos por moneda (ARS grande, USD más chico — bimoneda jerarquía).
- [x] 9.3 Acciones: Editar, Archivar/Reactivar, Eliminar. Cada uno con confirm dialog de confirmación.
- [x] 9.4 Zona de movimientos: placeholder "Todavía no hay movimientos en esta cuenta" hasta que exista `transactions`.
- [x] 9.5 Botón "Agregar moneda" si la cuenta no tiene todas las monedas activas (ej. solo ARS → ofrece habilitar USD).

## 10. UI — Editar

- [x] 10.1 Crear `apps/web/app/(app)/accounts/[id]/edit/page.tsx` con form pre-llenado.
- [x] 10.2 Permitir editar `name` y `institution_id` (solo bank). Tipo y saldo inicial son read-only con label "no editable".

## 11. Tests

- [ ] 11.1 Test de Yup schemas — diferido: no hay test runner configurado en el repo. Requiere agregar vitest (o similar) a `packages/validation` primero.
- [ ] 11.2 Tests de actions — diferido: mismo bloqueador que 11.1. Además necesita mock de Supabase client.
- [ ] 11.3 Tests de queries — diferido: mismo bloqueador que 11.1.
- [ ] 11.4 Storybook stories para `AccountRow`, `AccountDetailHeader`, `CreateAccountForm`, `EmptyAccountsState` — diferido: se hace cuando el DB esté aplicado y los componentes sean verificables en browser.

## 12. Documentación

- [x] 12.1 Actualizar `SUPABASE_SETUP.md` con instrucciones de aplicación de `0007_accounts.sql` y procedimiento manual de verificación del trigger (crear user de prueba, verificar Efectivo).
- [x] 12.2 Actualizar el módulo #4 en `CLAUDE.md` de `🔲 Next` a `✅ Done`.

## 13. Validación final

- [x] 13.1 Correr `openspec validate add-accounts-cash-and-bank` sin errores. ✓
- [x] 13.2 Correr `pnpm build` sin errores. ✓
- [ ] 13.3 Correr todos los tests — bloqueado: no hay test runner configurado en el repo.
- [x] 13.4 Test manual end-to-end: aplicar `0007_accounts.sql`, regenerar types, luego registrar user nuevo en /signup → verificar que Efectivo aparece en `/accounts`. Crear cuenta bank → editar → archivar → reactivar → eliminar. ✓
