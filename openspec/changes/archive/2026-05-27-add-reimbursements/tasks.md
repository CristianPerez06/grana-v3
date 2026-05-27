## 1. Migración + tipos

- [x] 1.1 Migración `0017_reimbursements_type.sql`: `ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'reimbursement'` + self-check. (Archivo aparte: Postgres no permite *usar* el valor recién agregado —p. ej. en CHECKs con literal— en la misma tx; con el workflow de pegar SQL en el dashboard, se corre primero y commitea.)
- [x] 1.2 Columnas en `transactions` (`0018_reimbursements.sql`): `linked_transaction_id` (self-FK `ON DELETE CASCADE`), `reimbursement_target`, `estimated_amount` numeric(18,2), `received_at` timestamptz, `cancelled_at` timestamptz. + índice `idx_transactions_linked`.
- [x] 1.3 CHECKs: `chk_reimbursement_target_valid` (`account|statement`), `chk_reimbursement_state` (exclusión mutua `received_at`/`cancelled_at`) y `chk_reimbursement_fields` (campos presentes sólo y obligatorios en `type='reimbursement'`, NULL en el resto).
- [x] 1.4 Trigger `trg_fn_reimbursement_invariants`: `linked_transaction_id` es un `expense` del mismo `user_id`; `reimbursement_target='statement'` sólo si el gasto origen es de tarjeta (directo o madre de cuotas vía hija); `estimated_amount` inmutable tras el alta; statement recibido exige `card_period_id`.
- [x] 1.5 ~~Ajustar el trigger de invariantes de tarjeta~~ — VERIFICADO: no hace falta. `trg_fn_credit_transaction_invariants` sólo aplica I-CRED-6 a `type='expense'`; un `reimbursement` cae en su `else` (sólo exige `fx_rate_to_ars` NULL, que cumple). La integridad del reintegro vive en el trigger nuevo (1.4). Documentado en `0018`.
- [x] 1.6 `is_active = false` en la categoría de sistema `reintegros-cashback` (no borrar: `ON DELETE RESTRICT`).
- [x] 1.7 Self-check al final de `0018` (columnas, 3 CHECKs, trigger, categoría inactiva) en el estilo de las migraciones de v3.
- [x] 1.8 Migraciones `0017` + `0018` aplicadas en el dashboard ✓. Tipos **regenerados del remoto** con `./node_modules/.bin/supabase gen types typescript --project-id exhpnnaigjfcxcvmptxa` (reemplazó el puente a mano que se usó durante el desarrollo). typecheck verde contra los tipos reales.

## 2. Lógica pura en `@grana/money-logic`

- [x] 2.1 Integrar `reimbursement` en `calculateTransactionSums` (`balance.ts`): `account` recibido suma a su cuenta; `statement` y los pendientes/cancelados no tocan saldo de cuenta. Cadena cerrada con `assertNever` exhaustivo (`reimbursementCreditsAccount` gatea por target+received+not-cancelled).
- [x] 2.2 Integrar `reimbursement` en `computeRunningBalances` igual (sólo `account` recibido afecta el running balance de su cuenta). `assertNever` exhaustivo en la cadena primaria.
- [x] 2.3 `sumReceivedStatementReimbursements` (`reimbursements.ts`): Σ reintegros `statement` **recibidos** (no cancelados) por moneda; el caller resta de los consumos. Pendientes/cancelados no reducen.
- [x] 2.4 `computeCategoryNet` (`reimbursements.ts`): bruto (Σ gastos), recibido (Σ reintegros `received` con categoría **derivada** pasada por el caller), esperado (Σ pendientes) aparte, neto = bruto − recibido; cancelados ignorados; por moneda.
- [x] 2.5 `suggestReimbursementAmount` (% + tope, `expense*percent/100` redondeo al final; UI-only, no se persiste).
- [x] 2.6 Tests (`__tests__/reimbursements.test.ts`, 10 casos): pendiente no impacta saldo/running; `account` recibido sí; `statement` recibido no toca cuenta; cancelado no impacta; suma de statement por moneda; neto por categoría con esperado aparte; % con/sin tope y fraccional. **28/28 verdes, typecheck OK.**

## 3. Server actions (`apps/web`)

- [x] 3.1 ~~Función Postgres (RPC)~~ — **DECISIÓN revisada** (design.md Decisión 9): orquestación en TS con rollback en vez de RPC (evita reimplementar los 3 caminos de gasto en PL/pgSQL = duplicar lógica). Helper `_lib/reimbursements.ts → insertDeclaredReimbursement`.
- [x] 3.2 Action "crear gasto con reintegro declarado": schema `reimbursementDeclarationSchema` (campo opcional en `createExpenseSchema` y `registerCardPurchaseSchema`); estado inicial **pendiente o "recibido ahora"** (ambos shippeados). Enganchado con rollback en `createExpense` (cash/débito) y `registerCardPurchase` (crédito 1 cuota; inyecta `card_period_id` del consumo para statement). ⬜ Diferido a V1.1: `registerInstallments` (reintegro sobre compra en cuotas — el bloque del form se oculta en cuotas).
- [x] 3.3 `confirmReimbursement` (`reimbursements.ts`): setea `received_at`, reconcilia monto/fecha; para `statement` deriva el `card_period_id` de la fecha (`getOrCreatePeriodForDate`) y rechaza un período ya pagado. Valida estado (no recibido/cancelado previo).
- [x] 3.4 `cancelReimbursement`: setea `cancelled_at`; rechaza cancelar uno ya recibido; idempotente si ya está cancelado.
- [ ] 3.5 ⬜ Diferido a V1.1: editar/eliminar un reintegro por separado (hoy se gestiona vía confirmar/cancelar; eliminar el gasto origen cascada al reintegro).
- [x] 3.6 Guardas de edición del gasto origen: **ya garantizadas por diseño** — en v3 el tipo, la moneda y la(s) cuenta(s) NO son editables post-creación (`getEditableFields` no los expone). Borrar el gasto cascada a sus reintegros (`ON DELETE CASCADE`).

## 4. Contrato de Movimiento + queries (`apps/web`)

- [x] 4.1 `FinancialMovement` extendido con `ReimbursementMovement` (signo `+`, `target`, `state` pendiente/recibido/cancelado, `linked_transaction_id`); `MovementKind += 'reimbursement'` (categorizado) en money-logic; mapper deriva categoría del `linked_expense`. `resolveMovementView` lo trata como single-legged con `baseSign='+'` (sin cambios extra).
- [x] 4.2 `TRANSACTION_SELECT` trae `linked_expense:transactions!..._fkey(category)` para la categoría derivada; el resto de campos (`reimbursement_target`, `received_at`, `cancelled_at`, `estimated_amount`) ya venían por `*`. Tipos `TransactionWithDetails` extendidos.
- [x] 4.3 `getTransactionSums` trae `reimbursement_target/received_at/cancelled_at` → un `account` recibido suma al disponible; pendientes/cancelados excluidos por la función pura (`reimbursementCreditsAccount`). Running balance: los campos fluyen vía el cast `TransactionWithDetails as RunningBalanceRow[]` (sin cambio en la página). typecheck + 219 tests verdes.

## 5. UI (`apps/web`)

- [x] 5.1 Bloque "Tiene reintegro" en `movement-form.tsx`: toggle, monto esperado, subtipo (`account` siempre; `statement` sólo si tarjeta), cuenta destino, y **"Ya me lo acreditaron" (recibido ahora)**. La cuenta destino se prerellena con la del **mismo banco/institución** que el gasto. ⬜ Diferido a V1.1: helper % + tope.
- [x] 5.2 Disponibilidad del subtipo por medio de pago ✅ (statement sólo si crédito; default account). Copy: una sola línea clara que sirve a novato y experto ("A una cuenta — el banco te deposita" / "En el resumen — se descuenta de la tarjeta"). ⬜ Copy mode-aware fino diferido.
- [x] 5.3 Fila del reintegro: badge de estado (esperado/recibido/cancelado) en `MovementRow`, signo `+` verde, categoría derivada. **Los RECIBIDOS van en el historial; los PENDIENTES no** (se separó la expectativa del hecho — `isHistoryRow` en `queries.ts`).
- [x] 5.4 **`PendingReimbursementsBlock`** (mirror de `PendingRecurrencesBlock`): bloque "Reintegros a confirmar" arriba del listado (global + detalle de cuenta vía `getPendingReimbursements`). Confirmar reconcilia monto real + fecha (statement usa su `card_period_id`). Decisión de UX del usuario: el pendiente no se mezcla en el historial, va en un bloque "A confirmar" como las recurrencias.
- [x] 5.5 Cancelar desde el mismo bloque (`cancelReimbursement`).
- [ ] 5.6 ⬜ Diferido a V1.1: **neto por categoría** (bruto / recibido / neto / esperado aparte) como vista de analytics. La lógica pura (`computeCategoryNet`) ya existe en money-logic; falta sólo dónde mostrarlo. (El neteo SÍ está vivo en el resumen de tarjeta.)
- [x] 5.7 Claves i18n `transactions.reimbursement.*` en es/en (toggle, subtipos, estados, hint, confirmar/cancelar, errores, detalle).

## 6. Verificación

- [x] 6.1 Verificado en navegador por el usuario: declarar pendiente a cuenta / en resumen; recibido ahora; default de cuenta por institución; reconciliar con monto distinto; confirmar; cancelar; bloque "A confirmar"; reintegro statement neteando el resumen de tarjeta; detalle con gasto vinculado.
- [x] 6.2 `pnpm typecheck` + `pnpm lint` (0 errores) + `pnpm build` (verde) + 219 tests verdes.
- [x] 6.3 Sin regresiones en consumos/cuotas/pago de resumen ni en los saldos existentes (verificado por el usuario + suite verde).

## 7. Refinamientos post-verificación (emergieron al probar en navegador)

- [x] 7.1 Categoría derivada vía **segunda query** (`attachLinkedExpenses`) en vez de embed self-FK de PostgREST (PGRST200 al cargar `/transactions`).
- [x] 7.2 Default de "Acreditar en" = cuenta del **mismo banco/institución** que el gasto.
- [x] 7.3 **Pendientes salen del historial** y viven en el bloque **"Reintegros a confirmar"** (decisión de UX del usuario, mirror de recurrencias).
- [x] 7.4 Confirmar statement **deriva el período de la fecha** del consumo (editable).
- [x] 7.5 **Integración con tarjetas**: el resumen de tarjeta (detalle, detalle de período y termómetro "Comprometido") netea los reintegros recibidos, los muestra como crédito verde y excluye pendientes/cancelados.
- [x] 7.6 **Detalle del reintegro enriquecido**: gasto vinculado clickeable + monto, subtipo, estado, esperado-vs-recibido.

## 8. Archive (pre-merge)

- [x] 8.1 Aplicar el delta al master spec de `transactions`; mover el change a `archive/2026-05-27-add-reimbursements/`.
- [x] 8.2 Correr el equivalente de `openspec:check` (grep de placeholders / `openspec validate`, vía Bash tool en Windows).
