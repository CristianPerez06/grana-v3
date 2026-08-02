# Tasks: cut-month-lenses-at-today

## 1. La regla, una sola vez

- [x] 1.1 Crear `packages/money-logic/src/temporal-cut.ts` con `financialTodayISO`, `earlierISO`, `isCardAccrualRow`, `countsUnderTemporalCut` y `cajaCutOrFilter`, documentando por qué el corte es CAJA y no universal
- [x] 1.2 Exportarlo desde `packages/money-logic/src/index.ts`

## 2. Balance del mes (CAJA — corte completo)

- [x] 2.1 `getMonthBalanceSeries`: parámetro `todayISO` con default AR; el `.lte('date', …)` pasa a `earlierISO(finDeMes, hoy)`
- [x] 2.2 Short-circuit para un mes que todavía no empezó (serie vacía, sin ir a la DB)
- [x] 2.3 `buildMonthBalanceSeries`: parámetro `cutoffDay` clampeado a `[0, díasDelMes]`; emite días solo hasta él y descarta filas posteriores
- [x] 2.4 Pasar `cutoffDay` en los tres call sites de `getMonthBalanceSeries`

## 3. ¿En qué gasté? / De dónde vino (corte CAJA, devengado intacto)

- [x] 3.1 `getMonthCategoryBreakdown` (`@grana/dashboard`): parámetro `todayISO` + `.or(cajaCutOrFilter(…))` en gastos y reintegros
- [x] 3.2 `getMonthCategoryLines` (drill list): mismo corte, para que la lista siga sumando el peso de la categoría
- [x] 3.3 `getMonthSubcategoryBreakdown`: mismo corte, para que las porciones sumen la categoría padre
- [x] 3.4 `getMonthIncomeBreakdown`: corte CAJA (un ingreso siempre es on-ledger)
- [x] 3.5 Wrapper web de `getMonthCategoryBreakdown`: reenviar `todayISO`

## 4. Tests

- [x] 4.1 `packages/dashboard/__tests__/month-lens-temporal-cut.test.ts`: fake que honra `gte`/`lte`/`or` (y **falla** ante un predicado desconocido); casos futuro excluido, borde hoy/hoy+1, mes pasado intacto, mes que no empezó, días truncados
- [x] 4.2 Caso dona: gasto cash futuro fuera, cuota de tarjeta fechada más adelante en el mes dentro
- [x] 4.3 `apps/web/lib/transactions/__tests__/temporal-cut.test.ts`: helpers puros, incluido el string exacto del predicado PostgREST
- [x] 4.4 Verificar que los tests nuevos fallan sin el fix (6 de 9 fallan; los 3 que pasan son los guards de "esto no cambió")

## 5. Cierre

- [x] 5.1 `pnpm typecheck` + `pnpm typecheck:mobile` + `pnpm lint` + `pnpm test` + `pnpm --filter dashboard test` en verde
- [x] 5.2 Verificación contra datos reales: en el proyecto Supabase del autor, "Balance del mes" de agosto pasa de −$1.992.744 a $0 y el Disponible no cambia
- [x] 5.3 Actualizar los specs base desde los deltas al archivar el change (flujo `opsx:archive` habitual)
