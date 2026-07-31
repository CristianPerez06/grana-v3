# Tasks: exclude-future-dated-from-balance

## 1. Corte temporal en SQL

- [x] 1.1 Crear `supabase/migrations/0052_balance_temporal_cut.sql`: `create or replace function get_account_balance_sums(p_account_ids uuid[] default null, p_today date default null)` con `v_today = coalesce(p_today, (now() at time zone 'America/Argentina/Buenos_Aires')::date)` y `and t.date <= v_today` en el CTE `tx`; conservar `SECURITY INVOKER`, `get_owned_account_ids` y la exclusión `status is null`
- [x] 1.2 Agregar self-check del migration: functiondef contiene `America/Argentina/Buenos_Aires` y `p_today`, sigue `SECURITY INVOKER`, sigue derivando el universo propio y excluyendo off-ledger
- [x] 1.3 Aplicar la migración al proyecto Supabase según el flujo habitual del repo (online-only: pegar `0052_balance_temporal_cut.sql` en el SQL Editor del dashboard — la corre el usuario)

## 2. Espejos TS y tipos

- [x] 2.1 `packages/money-logic/src/balance.ts`: agregar `date: string` a `BalanceTransactionRow` y parámetro requerido `todayISO` a `calculateTransactionSums`, filtrando `row.date <= todayISO` antes de aplicar reglas de signo; NO tocar `computeRunningBalances`
- [x] 2.2 Actualizar `packages/supabase/src/types.ts` con la nueva firma del RPC (`p_today?: string`)
- [x] 2.3 `packages/accounts/src/queries.ts` y `packages/dashboard/src/queries.ts`: pasar `p_today: formatDateISO(getTodayAR())` en las llamadas a `supabase.rpc('get_account_balance_sums', …)`
- [x] 2.4 Barrer otros call sites del RPC (grep `get_account_balance_sums`) y alinear el parámetro

## 3. Form tweak: recurrente + fecha futura sin semilla

- [x] 3.1 `packages/movement-form/src/types.ts`: agregar `createRecurrenceDirect` al contrato `MovementFormMutators` (campos: movement_type, cuenta/destino, moneda, monto, categoría/subcategoría, descripción, frequency/interval, start_date, end_date/max_occurrences, household/split según snapshot actual)
- [x] 3.2 `packages/movement-form/src/use-movement-form.ts` (`submitCreate`): si `isRecurrent && date > todayStr()` y el tab admite recurrencia, saltear la creación del movimiento e invocar `createRecurrenceDirect` con `start_date = date`; mantener el flujo actual para `date <= hoy`
- [x] 3.3 `apps/web`: wirear el mutator nuevo a la mutation de creación directa existente de `@grana/recurrences` (thin wrapper, misma revalidación que el resto del form)
- [x] 3.4 Verificar el guard existente (adjustment/exchange/installments no admiten recurrencia) y el caso tarjeta: consumo recurrente futuro no inserta fila con `card_period_id`

## 4. Tests

- [x] 4.1 Test de paridad SQL↔TS (`apps/web/lib/accounts/__tests__/balance-sums-migration.test.ts`): agregar filas con `date` futura por cada tipo y fijar `p_today`/`todayISO`; ambas implementaciones las excluyen y devuelven idéntico neto
- [x] 4.2 `packages/dashboard/__tests__/balance-read-path.test.ts`: caso con transacción futura — Hero/Disponible no la incluye
- [x] 4.3 Tests unitarios de `calculateTransactionSums` en `packages/money-logic`: corte inclusivo (`date == hoy` cuenta, `date == hoy+1` no)
- [x] 4.4 Tests del hook `use-movement-form`: fecha futura + recurrente ⇒ no llama create<Tipo> y llama `createRecurrenceDirect` con `start_date` correcto; fecha de hoy ⇒ flujo semilla intacto
- [x] 4.5 Test del generador: cobertura ya existente en `apps/web/lib/recurrences/__tests__/generator.test.ts` ("does not generate when start_date is still in the future" + "generates the first instance ON start_date") — sin cambios

## 5. Cierre

- [x] 5.1 `pnpm lint` + `pnpm typecheck` + suites afectadas en verde
- [x] 5.2 Copy del caso "regla sin semilla": queda el éxito genérico actual (default del design); toast diferenciado fuera de scope
- [x] 5.3 Actualizar los specs base desde los deltas al archivar el change (flujo `opsx:archive` habitual)
