## 1. Tipos y agregación (package compartido)

- [x] 1.1 Agregar `totalAdjustment: number` a `MonthBalanceSeries` y `dailyAdjustment: number` a `MonthBalanceDay` en `packages/dashboard/src/types.ts` (con comentario de la convención de signo neto).
- [x] 1.2 En `buildMonthBalanceSeries` (`packages/dashboard/src/aggregations.ts`): rutear `type='adjustment'` a un acumulador `dailyAdjustment[day]` (firmado), eliminar la rama que lo mandaba a income/expense, y exponer `totalAdjustment`.
- [x] 1.3 Mantener la acumulación correcta: `acc += dailyIncome[d] − dailyExpense[d] + dailyAdjustment[d]`; verificar invariante `finalBalance === totalIncome − totalExpense + totalAdjustment`.
- [x] 1.4 Actualizar `emptyMonthSeries` para incluir `totalAdjustment: 0` y `dailyAdjustment: 0` en cada día.

## 2. Tests de agregación

- [x] 2.1 Actualizar `packages/dashboard/__tests__/aggregations.test.ts`: los casos con ajustes esperan `totalAdjustment` (no income/expense inflados).
- [x] 2.2 Agregar caso que reproduce el escenario QA (gasto real + ingreso real + ajustes +/−) y verifica que Gastos = solo gasto real, Ingresos = solo ingreso real, `totalAdjustment` neto, y `finalBalance` reconciliado.
- [x] 2.3 Agregar caso "mes sin ajustes" → `totalAdjustment === 0`.

## 3. i18n

- [x] 3.1 Agregar la key `dashboard.month.adjustment` ("Ajustes") en `packages/i18n-messages/src/es.json` junto a `income`/`expense`.
- [x] 3.2 Agregar la key `dashboard.month.adjustment_note` con el aviso educativo (voz Grana): "¿En qué se fue esta grana? Los ajustes son plata que se movió sin registrar — registrá esos movimientos y hacelos desaparecer."

## 4. UI web

- [x] 4.1 En `apps/web/app/(app)/dashboard/_components/month-balance-section.tsx`: renderizar una fila "Ajustes" (fila simple sin barra) con `ars.totalAdjustment`, solo cuando `totalAdjustment !== 0`, con color por signo y enmascarable por el eye-mask.
- [x] 4.2 Confirmar que la fila no afecta `maxFlow`/anchos de barras de Ingresos/Gastos.
- [x] 4.3 Debajo de la fila "Ajustes", renderizar el aviso educativo `dashboard.month.adjustment_note` (texto atenuado, voz Grana), también solo cuando hay ajustes.

## 5. UI mobile (paridad)

- [x] 5.1 En `apps/mobile/components/dashboard/MonthBalanceSection.tsx`: renderizar la fila "Ajustes" equivalente con `ars.totalAdjustment`, condicional a `!== 0`, color por signo, dentro del eye-mask, con el aviso `dashboard.month.adjustment_note` debajo.

## 6. Verificación

- [x] 6.1 `pnpm --filter @grana/dashboard test` (o el runner del package) verde.
- [x] 6.2 `pnpm --filter web typecheck` y `pnpm --filter mobile typecheck` verdes.
- [ ] 6.3 Smoke manual web (pendiente, lo valida el usuario con datos reales): mes con ajustes muestra la fila "Ajustes", "Gastos" coincide con "En qué se fue", neto sin cambios; mes sin ajustes no muestra la fila.
- [x] 6.4 Validar la propuesta: `openspec validate month-balance-adjustments-bucket --strict`.
