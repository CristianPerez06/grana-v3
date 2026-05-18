## Why

El módulo `accounts` es la pieza fundacional del dominio: sin cuentas no hay transacciones, sin transacciones no hay app. La hoja de ruta en `CLAUDE.md` lo marca como el próximo módulo (#4, post schema-base y categorías), y todo lo que viene después (`transactions`, `shared`, `savings`) lo necesita en pie.

Este change entrega una primera rebanada deliberadamente acotada: solo cuentas de **Efectivo** y **Bancarias/débito**, con soporte multi-divisa (ARS + USD). Las **tarjetas de crédito** quedan para un change posterior (`add-accounts-credit-cards`), una vez que esta base esté probada en producto. Esto evita arrastrar la complejidad de períodos, off-ledger y cuotas hijas en el mismo paso.

## What Changes

- **Tablas nuevas**: `accounts` y `account_currencies`.
  - `accounts(id, user_id, name, type, institution_id, is_active, created_at)` — `type IN ('cash', 'bank')` por ahora; el enum se extenderá en changes futuros.
  - `account_currencies(id, account_id, currency_code, initial_balance, initial_balance_date, is_active, created_at)` — una fila por (cuenta × moneda) habilitada. UNIQUE(account_id, currency_code).
- **Trigger de DB** sobre `auth.users` que, al primer signup, crea una cuenta `Efectivo` (`type='cash'`, `institution_id=NULL`) con dos filas en `account_currencies` (ARS y USD, ambos `initial_balance = 0`).
- **RLS**: cada usuario lee/modifica solo sus propias cuentas y sus `account_currencies`. Ningún acceso cross-user.
- **Server actions** (en `apps/web/`):
  - `createAccount` (cash o bank, con set de currencies habilitadas y saldo inicial por moneda)
  - `updateAccount` (renombrar; cambiar `institution_id` en bank; `type` inmutable post-creación)
  - `archiveAccount` (`is_active = false`; bloqueado si saldo ≠ 0 en alguna moneda)
  - `reactivateAccount`
  - `deleteAccount` (hard delete; bloqueado si la cuenta tiene cualquier referencia futura — placeholder hasta que exista `transactions`)
  - `addCurrencyToAccount` / `deactivateCurrencyFromAccount`
- **Queries**:
  - `getAccounts()` — lista agrupada por tipo (Efectivo / Bancarias), incluyendo `account_currencies` activas e institución.
  - `getAccountDetail(id)` — cuenta + currencies + institución.
- **Pantallas web** (`apps/web/`):
  - `/accounts` — lista agrupada con FAB de crear, estado vacío con CTA.
  - `/accounts/new` — formulario unificado con segmented control de tipo y campos dinámicos.
  - `/accounts/[id]` — detalle con saldo placeholder (cero hasta que exista `transactions`), header con institución, acciones de editar/archivar/eliminar.
- **Validaciones** (en `@grana/validation`):
  - `name`: 1–50 caracteres, requerido.
  - `institution_id`: requerido si `type='bank'`, prohibido si `type='cash'`.
  - `initial_balance`: ≥ 0, NUMERIC(18,2).
  - Al menos una moneda activa por cuenta.
- **Reglas de negocio**:
  - `type` inmutable post-creación.
  - `initial_balance` y `initial_balance_date` inmutables post-creación; correcciones futuras se harán como transacciones `adjustment` cuando exista el módulo.
  - Archivar (`is_active=false`) en lugar de borrar cuando la cuenta tenga referencias.
  - No se permite archivar una cuenta con saldo derivado ≠ 0 en cualquier moneda (placeholder: en v1 el saldo derivado es `initial_balance` porque `transactions` no existe; la regla se aplica desde el inicio para no requerir migración después).
- **i18n**: nuevas claves `accounts.*` en `packages/i18n-messages/src/{es,en}.json` (títulos, labels, mensajes de error, secciones de la lista).
- **Modo novato**: el módulo `/accounts` no se renderiza para usuarios en modo `novato`; la cuenta `Efectivo` default existe pero está oculta. El switch a `experto` no requiere acción adicional — las cuentas ya están creadas.

**Out of scope** (changes posteriores explícitos):

- Tarjetas de crédito (`type='credit'`, `credit_card_configs`, `card_periods`, `period_payments`, off-ledger, cuotas hijas).
- Cuentas de inversión (`type='investment'`).
- **Chanchito** (`is_savings`) y función D13 (`funcion: operativa | mixta | ahorro`).
- Instituciones custom creadas por el usuario — el catálogo `institutions` sigue inmutable.
- Configuración global `user_currencies` — toda cuenta v1 puede operar en ARS y USD sin toggle global.
- Tabla `transactions` y derivación real de saldos — esa lógica entra en el módulo siguiente (#5).

## Capabilities

### New Capabilities

- `accounts`: ABM de cuentas multi-divisa para Efectivo y Bancarias, con saldo inicial inmutable por moneda, archivado/eliminación con reglas de integridad, default `Efectivo` auto-creada al signup, y enforcement de bimoneda (ARS y USD como únicas monedas habilitables en v1).

### Modified Capabilities

<!-- ninguna: el trigger de signup vive en una función nueva separada de handle_new_user, así que profiles no cambia. schema-base no se modifica (solo se referencian currencies e institutions, que ya están). -->

## Impact

- **Migration nueva**: `supabase/migrations/0007_accounts.sql` con las tablas, RLS, trigger, índices y self-check post-migración (mismo patrón que `0001_profiles.sql`).
- **Regen de tipos**: `pnpm --filter @grana/supabase types:gen` para regenerar `packages/supabase/src/types.ts` desde la DB online.
- **`apps/web/`**: rutas y componentes nuevos bajo `app/(authenticated)/accounts/`; nada existente cambia de comportamiento.
- **`packages/validation/`**: agrega `accounts.ts` con `createAccountSchema`, `updateAccountSchema`, etc.
- **`packages/i18n-messages/`**: agrega bloque `accounts.*` en `es.json` y `en.json`.
- **No afecta**: `auth`, `categories`, `profiles`, `schema-base`, `ui-tokens`. Solo agrega; cero cambios en código existente fuera de los puntos enumerados.
- **Próximos changes que se desbloquean**:
  - `add-accounts-credit-cards` — agrega `type='credit'`, `credit_card_configs`, `card_periods`, `period_payments`.
  - `add-transactions-module` — agrega la tabla `transactions` y reemplaza el saldo derivado placeholder por la suma real.
