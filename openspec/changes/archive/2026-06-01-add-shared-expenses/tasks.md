## 1. Esquema de datos y RLS (migraciones 0022 + 0023)

- [x] 1.0 Migración `0022_settlement_type.sql`: `ALTER TYPE transaction_type ADD VALUE 'settlement'` en su propia migración (Postgres no permite usar el valor nuevo en la misma transacción; precedente `0017`). No hace falta tocar `category_id` (ya nullable en DB; la obligación vive en el Yup de income/expense)
- [x] 1.1 Crear tabla `household` (`id`, `name`, `is_active`, `default_split jsonb`, `created_by`, `created_at`)
- [x] 1.2 Crear tabla `household_member` (junction: `household_id`, `user_id`, `joined_at`; unique por par) con constraint/validación de máximo 2 miembros por hogar
- [x] 1.3 Crear tabla `household_invite` (`id`, `household_id`, `code` unique, `invited_by`, `expires_at`, `used_by`, `used_at`)
- [x] 1.4 Crear tabla `shared_expense_split` (`id`, `transaction_id`, `household_id`, `user_id`, `percentage`, `amount_assigned`; unique por `transaction_id`+`user_id`)
- [x] 1.5 Crear tabla `settlement` (`id`, `household_id`, `payer_id`, `payer_movement_id`, `receiver_id`, `receiver_movement_id` nullable, `amount`, `currency_code`, `status`); ambas patas referencian movimientos `type='settlement'`
- [x] 1.6 (Migración `0023_shared.sql`) Agregar a `transactions` las columnas `is_shared boolean not null default false`, `household_id uuid references household(id)` (aplica también a filas `type='reimbursement'` sobre gastos compartidos) y `settlement_direction text CHECK (settlement_direction IN ('out','in'))` (solo en filas `type='settlement'`; ver D11)
- [x] 1.7 Crear helper SQL `is_household_member(uuid)` `SECURITY DEFINER` (patrón nuevo en v3) e índice parcial `transactions(household_id) where is_shared = true`
- [x] 1.8 Definir RLS de las tablas nuevas (lectura por pertenencia al hogar; escritura por dueño/miembro según corresponda)
- [x] 1.9 Modificar la policy SELECT de `transactions` para permitir leer compartidas del propio hogar, manteniendo INSERT/UPDATE/DELETE solo del dueño
- [x] 1.10 Crear función `SECURITY DEFINER` para revertir una liquidación completada (ambas patas, atómica, acotada al hogar; ver D10)
- [x] 1.11 Aplicar las migraciones en Supabase, regenerar tipos (`supabase gen types`, proyecto `exhpnnaigjfcxcvmptxa`) y correr `supabase/validate_schema.sql` — **paso a cargo del usuario** (requiere credenciales/CLI)

## 2. Lógica pura de deuda y splits (`packages/money-logic`)

- [x] 2.1 Implementar reparto de split por porcentajes con `Money.split` (suma exacta, sin centavos perdidos)
- [x] 2.2 Implementar `computeHouseholdDebt(splits, settlements, currency)` como sumatorio firmado: splits de `expense` en positivo, splits de `reimbursement` **recibido** en negativo, menos liquidaciones
- [x] 2.3 Implementar la exclusión de cuotas futuras (cuotas con `due_date` posterior al cierre del mes corriente) dentro del cálculo de deuda, y alinear el efecto del reintegro "en resumen" con el período de la cuota/consumo que reduce
- [x] 2.4 Actualizar los guards exhaustivos de `packages/money-logic/src/balance.ts` para el tipo `settlement`: impacta `disponible`, pero se excluye de sumas de gasto/ingreso y de desgloses por categoría (precedente: `reimbursement`)
- [x] 2.5 Tests: reparto 50·50 de monto impar, deuda de un único gasto, deuda separada por moneda, deudas < $0,01 → al día, exclusión de cuotas futuras, reintegro recibido baja la deuda por la parte del otro, reintegro pendiente no afecta, reconciliación por monto menor, combo en-resumen + cuotas + split, y que `settlement` no contamina gasto/ingreso/analytics

## 3. Validación (`packages/validation`)

- [x] 3.1 Schema Yup `createHouseholdSchema` (nombre no vacío, ≤ 50)
- [x] 3.2 Schema Yup `joinHouseholdSchema` (código)
- [x] 3.3 Schema Yup de gasto compartido: splits suman exactamente 100, cada porcentaje ≥ 1
- [x] 3.4 Schema Yup `settlementSchema` (moneda, monto > 0, cuenta de origen)
- [x] 3.5 Tests de los schemas (casos válidos e inválidos)

## 4. i18n (`packages/i18n-messages`)

- [x] 4.1 Agregar catálogo `shared` en `es.json` (dashboard, splits, invitación, liquidación, settings)
- [x] 4.2 Agregar las mismas claves en `en.json`

## 5. Server actions (`apps/web/app/_actions/shared.ts`)

- [x] 5.1 `createHousehold(name)` — crea hogar + primer miembro + split por defecto 50·50
- [x] 5.2 `createInvite()` — genera código único válido 48 h (reintento en colisión)
- [x] 5.3 `joinHousehold(code)` — valida vigencia/uso/cupo, agrega segundo miembro, reconfigura split, marca invitación usada
- [x] 5.4 `updateHouseholdConfig({ name?, defaultSplit? })` — edita nombre y/o split por defecto (valida suma 100, mín 1%)
- [x] 5.5 `leaveHousehold()` — bloquea si hay deuda viva o settlement pendiente; desvincula; marca inactivo si queda vacío
- [x] 5.6 Extender la creación de gasto para aceptar `shared` (insertar `is_shared`/`household_id` + filas `shared_expense_split`); para cuotas, asociar splits a las hijas
- [x] 5.7 Extender la creación/confirmación de reintegro: si el gasto origen es compartido, marcar el reintegro `is_shared`/`household_id` y heredar splits (de la cuota correspondiente en cuotas); solo el recibido afecta la deuda
- [x] 5.8 `registerSettlement(amount, currency, accountId)` — valida monto ≤ deuda; crea el movimiento `settlement` del pagador + fila `settlement` pendiente, orquestado en el action con rollback manual (no RPC; ver D12)
- [x] 5.9 `assignSettlementAccount(settlementId, accountId)` — crea el movimiento `settlement` del receptor, setea `receiver_movement_id`, marca completada, con rollback manual
- [x] 5.10 `editSettlement` / `deleteSettlement` — libre mientras está pendiente (solo pata del pagador); revertir una liquidación completada usa la función `SECURITY DEFINER` (D10), no escritura cross-user desde el cliente

## 6. Queries (`apps/web/lib/shared/`)

- [x] 6.1 `types.ts` — `Household`, `HouseholdMember`, `SharedExpense`, `Split`, `DebtByCurrency`, `Settlement`
- [x] 6.2 `getHousehold()` — hogar + miembros + split por defecto del usuario actual
- [x] 6.3 `getHouseholdDebt()` — lee splits + settlements y deriva deuda por moneda (vía money-logic)
- [x] 6.4 `getSharedExpenses(filters)` — gastos compartidos recientes con la porción propia; agrupa cuotas bajo su madre
- [x] 6.5 `getPendingSettlements()` — liquidaciones pendientes de asignar cuenta para el receptor
- [x] 6.6 ~~`getPartnerAccounts()`~~ — NO necesario: en el handshake liviano cada miembro elige su propia cuenta, no hace falta leer las del otro (evita RLS cross-user de accounts)
- [x] 6.7 La lógica core de deuda/split está testeada en `money-logic` (15 tests); el wiring de las queries se cubrió con la verificación E2E con dos usuarios (9.3). Tests unitarios de queries con mock de Supabase: pulido futuro
- [x] 6.8 Migración `0024_household_profile_read.sql`: helper `shares_household_with` + policy para que un miembro lea el `full_name` del co-miembro (profiles RLS era solo `auth.uid()=id`)

## 7. UI web (`apps/web/app/(app)/shared/`)

- [x] 7.1 Setup/onboarding del hogar: crear o unirse con código (`/shared/setup`)
- [x] 7.2 Dashboard del hogar (`/shared`): balance por moneda en lenguaje claro + gastos recientes + acceso a saldar
- [x] 7.3 Settings del hogar (`/shared/settings`): nombre, split por defecto, invitar miembro, salir
- [x] 7.4 Pantalla saldar deuda (`/shared/settle`): selección de moneda/monto/cuenta y registro
- [x] 7.5 Vista del receptor: liquidaciones pendientes + selección de cuenta de recepción
- [x] 7.6 Toggle "Compartir" + panel de split en el form de gasto existente (visible solo con hogar de 2 miembros)
- [x] 7.7 Marcadores de "compartido" y "tu parte" en el **detalle** del movimiento (bloque "Gasto compartido" con tu parte + split). El chip por fila en el listado global queda como pulido futuro
- [x] 7.8 Reflejar el reintegro compartido en el detalle del gasto y en el dashboard (cómo bajó la deuda al recibirse), incluyendo el caso "en resumen"

## 8. Paridad mobile (`apps/mobile`) — DIFERIDO

- [ ] 8.1 ~~Pantallas de hogar en mobile~~ — DIFERIDO: mobile no tiene form de gastos ni pantalla de cuentas (paridad ~60%); el módulo compartido mobile depende de esa infra foundational. Fase aparte (ver [[cards-mobile-parity-gap]]).
- [ ] 8.2 ~~Toggle de split en el form de gasto nativo~~ — DIFERIDO: no existe form de gasto nativo en mobile donde colgar el toggle.

## 9. Cierre

- [x] 9.1 `pnpm typecheck` y suite de tests en verde (326 tests)
- [x] 9.2 `lint` en verde (el script `openspec:check` es bash y no corre bajo el shell de Windows; el gate equivalente — sin `Purpose: TBD` en specs maestros — se verifica manualmente al archivar)
- [x] 9.3 Verificación manual end-to-end con dos usuarios (crear hogar, invitar/unir, gasto compartido cash y en cuotas, saldar deuda, recepción)
- [ ] 9.4 Archivar el change e integrar deltas en los specs maestros (`shared`, `transactions`), completar `Purpose` de `shared`, actualizar `AGENTS.md` (sección Modules), todo en la branch antes del merge
