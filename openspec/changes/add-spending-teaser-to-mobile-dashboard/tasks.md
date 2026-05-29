# Tareas — Teaser "En qué se fue" en el dashboard mobile

> Orden recomendado: después de `align-mobile-dashboard-section-loading`. Toca la capability `dashboard` en un requirement disjunto del de ese change (queries compartidas vs. pantalla mobile).

## Grupo 1 · Promover la query a `@grana/dashboard`

- [ ] 1.1. Mover `getMonthCategoryBreakdown` a `@grana/dashboard` con firma `getMonthCategoryBreakdown(supabase, month)` (cuerpo verbatim, sin `createClient` interno). Exportar `MonthCategoryBreakdown` y `UNCATEGORIZED_ID` desde el package.
- [ ] 1.2. Resolver el helper de rango de mes: reusar/mover `resolveMonthRange` a una fuente compartida (`@grana/money-logic` o junto a la query) y que la query lo tome de ahí.
- [ ] 1.3. Web delega: `apps/web/lib/transactions/queries.ts` deja de definir `getMonthCategoryBreakdown` y llama/re-exporta la del package pasando su client server. `getMonthSubcategoryBreakdown` queda donde está (fuera de alcance).
- [ ] 1.4. Confirmar que el desglose completo web (donut + ranking) sigue idéntico (typecheck + tests de agregación verdes; revisión manual del donut).

## Grupo 2 · Hook mobile

- [ ] 2.1. `useMonthCategoryBreakdown(today)` en `apps/mobile/lib/dashboard/queries.ts`: query key `['dashboard', 'category-breakdown', month]`, llama `getMonthCategoryBreakdown(supabase, month)`.
- [ ] 2.2. Derivar las top-3 slices con `buildCategorySlices(breakdown.ARS.map(rellenar uncategorized label), { topN: 3, othersLabel })` + `.slice(0, 3)`, igual que el container web. Usar `transactions.spending.uncategorized`/`.others` para los labels.

## Grupo 3 · Componente `CategoryTeaser` (RN)

- [ ] 3.1. `apps/mobile/components/dashboard/CategoryTeaser.tsx`: header (título `dashboard.spending.title` + "Ver desglose" `dashboard.spending.view_all`) y hasta 3 filas (icon + label, barra de proporción `View` con ancho `%` + color de categoría, y el `%`). Slots de ancho fijo para barra y `%`. Sin montos, sin `MaskedAmount`.
- [ ] 3.2. Estados in-card: loading (`dashboard.spending.loading`) y error (`dashboard.spending.error`) sobre alto estable; `null` si `slices.length === 0`.
- [ ] 3.3. Al tocar el teaser, `router.push('/transactions')`. Comentar en código la decisión transitoria (destino sin donut todavía).

## Grupo 4 · Wire en el dashboard

- [ ] 4.1. Renderizar `<CategoryTeaser today={today} />` al final del árbol del dashboard mobile (después de `MonthBalanceSection`).
- [ ] 4.2. Confirmar que el teaser NO entra en el `EyeMaskProvider` masking (no muestra montos; verificar que no usa `MaskedAmount`).

## Grupo 5 · Verificación

- [ ] 5.1. `pnpm --filter web typecheck` y `pnpm --filter mobile typecheck` OK tras mover la query.
- [ ] 5.2. Verificación manual mobile: el teaser muestra las 3 categorías top con barras y % correctos; netea reintegros recibidos; respeta off-ledger (consumos de tarjeta sin pagar no cuentan); tap navega a `/transactions`.
- [ ] 5.3. Caso vacío: usuario sin gastos del mes → el teaser no se renderiza.
- [ ] 5.4. Paridad: comparar contra el teaser web con los mismos datos (mismas 3 categorías, mismos %).
- [ ] 5.5. `pnpm openspec:check` OK.
