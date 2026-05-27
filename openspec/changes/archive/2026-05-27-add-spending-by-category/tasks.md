## 1. Lógica pura en `@grana/money-logic`

- [x] 1.1 `computeCategoryNet` confirmado (devuelve bruto/recibido/esperado/neto por moneda, keyed por categoría).
- [x] 1.2 Helper puro `buildCategorySlices` (`category-breakdown.ts`): filtra valores > 0, ordena desc, `topN` named + "Otros" para la cola, `percentage` exacto + `offset` acumulado para los arcos. Exportado.
- [x] 1.3 Tests (`__tests__/category-breakdown.test.ts`, 6 casos): orden desc, % suman 100, offsets acumulados, "Otros", ignora ≤0, total 0 / una categoría. **6/6 verdes.**

## 2. Query (`apps/web`)

- [x] 2.1 `getMonthCategoryBreakdown(month)` (`queries.ts`): gastos del mes (excluye madre `is_parent` y pagos de resumen vía `period_payments`) + reintegros recibidos con categoría derivada → `computeCategoryNet` → `CategorySliceInput[]` por moneda (ARS/USD). Uncategorized bajo sentinel `UNCATEGORIZED_ID` (la UI le pone label).
- [x] 2.2 Navegación por mes vía `resolveMonthRange(month)` (reusa los helpers de `filters.ts`); el page resuelve el mes default con `getTodayAR`.

## 3. UI — carta de presentación de Movimientos (`apps/web`)

- [x] 3.1 `CategoryDonut` (SVG liviano, arcos `stroke-dasharray`, circunferencia 100, sin librería) dentro de `CategorySpendingOverview`.
- [x] 3.2 Ranking: punto de color · `emoji · categoría · monto · %`, orden desc, "Otros" al final.
- [x] 3.3 Overview arriba del listado en `/transactions` + navegación por mes ‹ › (comparte `?month=`). Listado accesible debajo.
- [x] 3.4 USD subordinada: ranking compacto aparte si hay gasto en USD (sin segundo donut).
- [x] 3.5 Tap en categoría → `/transactions?month=<m>&category=<id>` (filtro existente). "Otros"/uncategorized no clickeables.

## 4. Teaser en el dashboard (`apps/web`)

- [x] 4.1 `CategoryTeaser`: top-3 categorías (ARS) con barra de % (sin montos → esquiva el eye-mask), linkea a `/transactions`. Se oculta si no hay gasto.

## 5. i18n

- [x] 5.1 Claves `transactions.spending.*` (title/others/uncategorized/empty/usd_heading) y `dashboard.spending.*` (title/view_all) en es/en.

## 6. Verificación

- [x] 6.1 Verificado por el usuario en navegador: donut + ranking, mes unificado arriba (filtros sin su mes), tap filtra la lista. El toggle ARS|USD aparece sólo si hay gasto en USD (a propósito). **Refinamiento post-verificación:** mes unificado (`showMonthNav` en filtros) + toggle de moneda (una moneda por vez) en vez del ranking USD subordinado.
- [x] 6.2 `pnpm typecheck` + `pnpm lint` (0 errores) + `pnpm build` + 225 tests verdes.
- [x] 6.3 Sin regresiones (build verde; el bar de filtros conserva su mes en el detalle de cuenta vía `showMonthNav`).

## 7. Archive (pre-merge)

- [x] 7.1 Master spec `spending-by-category` creado (requisitos integrados, sin delta sections, con `Purpose`); change movido a `archive/2026-05-27-add-spending-by-category/`.
- [x] 7.2 `openspec validate --specs` en verde.
- [x] 7.3 `CLAUDE.md`: `spending-by-category` agregado a Modules.
