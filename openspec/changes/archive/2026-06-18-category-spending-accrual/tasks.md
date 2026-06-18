## 1. Data layer — getMonthCategoryBreakdown (devengado)

- [x] 1.1 En `packages/dashboard/src/queries.ts`: quitado el filtro `.is('card_period_id', null)` → incluye consumos y cuotas. El loop sigue excluyendo `is_parent` y `period_payments`.
- [x] 1.2 Reemplazado el comentario/TODO obsoleto por la explicación devengado (off-ledger aplica a disponible, no a la categorización).
- [x] 1.3 Reintegros: agnósticos al `reimbursement_target` (la query no lo filtra), netean por categoría derivada, por `date`.

## 2. Tipos + split de créditos

- [x] 2.1 `MonthCategoryBreakdown` ganó `credits: { ARS, USD }` (con doc del significado).
- [x] 2.2 El `build()` ya no descarta `value <= 0`: separa positivos (→ dona) de negativos (→ `credits`, magnitud positiva vía `Math.abs`).
- [x] 2.3 Split inline; la lógica base (neto negativo) se cubre con test puro de `computeCategoryNet` (7.1).

## 3. Consistencia con el drill de subcategorías

- [x] 3.1 `getMonthSubcategoryBreakdown` (web `lib/transactions/queries.ts`) tenía `.is('card_period_id', null)` → quitado para alinear a devengado. **Diferido**: créditos a nivel subcategoría (su tipo `MonthSubcategoryBreakdown` no tiene `credits`; edge raro).

## 4. i18n

- [x] 4.1 `dashboard.spending.credits_label` ("Te devolvieron" / "Refunded to you") en es+en.
- [x] 4.2 Corregido el note falso `transactions.spending.off_ledger_note` ("Sin contar consumos…" → "Incluye consumos y cuotas de tarjeta"), ahora que devengado SÍ los cuenta.

## 5. UI web (reusa la card actual, sin rediseño)

- [x] 5.1 `spending-section.tsx`: fila(s) "Te devolvieron · {cat} +{monto}" en verde fuera de la dona, condicional a créditos, con eye-mask; `relabel` extraído a `useCallback`.
- [x] 5.2 La dona y su total siguen usando solo netos positivos (sin tocar `buildCategorySlices`).

## 6. UI mobile (paridad)

- [x] 6.1 `SpendingSection.tsx` (mobile): misma fila de créditos con primitivas RN + `text-emerald`, dentro del eye-mask.

## 7. Tests

- [x] 7.1 `reimbursements.test.ts`: caso "neto NEGATIVO (crédito) cuando los reintegros superan el gasto" → `neto === -10000`, no capeado.
- [ ] 7.2 (Diferido) `getMonthCategoryBreakdown` es función de integración (Supabase, sin harness de mock hoy); el devengado de consumo/cuota se valida en el smoke manual (8.4).

## 8. Verificación

- [x] 8.1 `@grana/dashboard` test 16/16; suite web 390/390 (incluye el caso de crédito).
- [x] 8.2 `pnpm --filter web typecheck` y `pnpm --filter mobile typecheck` verdes.
- [x] 8.3 `eslint` de `spending-section.tsx` (web) y `SpendingSection.tsx` (mobile) limpios.
- [x] 8.4 Smoke con datos reales: "En qué se fue" ahora incluye los consumos de tarjeta por categoría (verificado en Transporte, cruzado con SQL). Sin categorías en crédito en el mes (netean positivo, correcto). El total cambió respecto a antes (esperado).
- [x] 8.5 `openspec validate category-spending-accrual --strict` ✓.

## 9. Desglose completo de Movimientos + diferidos

- [x] 9.1 **Desglose completo de Movimientos** (`category-spending-overview.tsx` + su container): fila "Te devolvieron" en egresos, fuera de la dona, reusando `tRoot('dashboard.spending.credits_label')`. Dashboard ↔ Movimientos consistentes.
- [ ] 9.2 (Diferido) Créditos a nivel **subcategoría** en el drill (requiere `credits` en `MonthSubcategoryBreakdown`).
