## 1. Extraer las reads a `@grana/dashboard`

- [x] 1.1 Mover `getMonthIncomeBreakdown` (`apps/web/lib/transactions/queries.ts:298`) a `packages/dashboard/src/queries.ts`, cambiando `DbClient` → `GranaSupabaseClient` y `resolveMonthRange` al del propio package.
- [x] 1.2 Mover `getMonthSubcategoryBreakdown` (:404), su tipo `MonthSubcategoryBreakdown` y la constante `SUBCATEGORY_UNCATEGORIZED_ID` (:397) al mismo archivo.
- [x] 1.3 Mover `hasUsdAccount` (:279) al mismo archivo.
- [x] 1.4 Exportar las tres funciones, el tipo y la constante desde `packages/dashboard/src/index.ts`.
- [x] 1.5 Dejar re-exports en `apps/web/lib/transactions/queries.ts` (mismo patrón que `getGlobalMovements` en :80), conservando el wrapper que inyecta `financialTodayISO()` por default donde web lo usa hoy.
- [x] 1.6 Verificar que ningún archivo web fuera de `queries.ts` cambió: `git diff --name-only apps/web` sólo lista ese archivo.

## 2. Extraer `getMonthCategoryLines` a `@grana/transactions`

- [x] 2.1 Mover `getMonthCategoryLines` (:139) y su tipo `MonthCategoryLines` (:133) a `packages/transactions/src/queries.ts`; sus dependencias (`TRANSACTION_SELECT`, `attachLinkedExpenses`, `toFinancialMovement`, `SUBCATEGORY_NONE_MARKER`, `TransactionWithDetails`) pasan a ser imports locales del package.
- [x] 2.2 Importar `UNCATEGORIZED_ID` desde `@grana/dashboard` (la arista ya existe en `packages/transactions/package.json:16`). `resolveMonthRange` sale del `./filters` local del propio package (misma implementación) en vez de cruzar la arista sin necesidad.
- [x] 2.3 Exportar ambas desde `packages/transactions/src/index.ts` y dejar el re-export en web.
- [x] 2.4 Confirmar que no se introdujo ningún import de `@grana/transactions` dentro de `packages/dashboard/` (el ciclo que el diseño prohíbe).

## 3. Consolidar helpers puros del donut

- [x] 3.1 Subir `groupForDonut` (hoy en `category-spending-overview-container.tsx:47`) y las constantes `DONUT_TOP` / `NO_OTHERS_CAP` a `@grana/money-logic`, junto a `buildCategorySlices`.
- [x] 3.2 `generateSubTints` + `hexToHSL` suben a `packages/money-logic/src/donut-palette.ts` (son puros sobre hex). Cambio de formato: emiten `hsl(h, s%, l%)` con comas en vez de la forma CSS Color 4 con espacios, porque el parser de color de React Native sólo maneja la primera de forma confiable. Mismo color en web.
- [x] 3.3 `INCOME_PALETTE` (:29) sube como constante compartida para que las dos plataformas pinten Ingresos igual.
- [x] 3.4 Web pasa a importar lo que se subió; borrar las definiciones locales.

## 4. Tests

- [x] 4.1 **No se movieron, a propósito.** `@grana/money-logic` no tiene runner de tests propio y sus ~13 tests ya viven en `apps/web/lib/**/__tests__/` — mover sólo estos dos crearía la inconsistencia en vez de arreglarla. Era la open question del diseño; se resuelve dejándolos donde están (no dependen del package del read).
- [x] 4.2 NO tocar `packages/dashboard/__tests__/category-lines-reconcile.test.ts` — ya está en el package y no depende de dónde vive la read.
- [x] 4.3 Cobertura nueva en `apps/web/lib/transactions/__tests__/category-breakdown.test.ts` (donde ya vive la de `buildCategorySlices`): 5 casos de `groupForDonut` —incluido que coincide con lo que `buildCategorySlices` habría producido con el mismo cap— y 4 de `generateSubTints`, uno de ellos fijando la forma con comas de `hsl()` que RN necesita.
- [x] 4.4 `pnpm test` verde (564 tests) y `pnpm --filter @grana/dashboard test` verde (154, con `category-lines-reconcile` intacto). `@grana/transactions` declara script de test pero no tiene archivos — preexistente, no lo introduce este change.

## 5. Capa de datos nativa

- [x] 5.1 En `apps/mobile/lib/dashboard/queries.ts`: sumar `useMonthIncomeBreakdown`, `useMonthSubcategoryBreakdown` (gateado por `categoryId`) y `useHasUsdAccount` (`staleTime` 30 min, month-independent), siguiendo el molde de `useMonthCategoryBreakdown` (:60), que gana acá su primer consumidor.
- [x] 5.2 En `apps/mobile/lib/transactions/queries.ts`: wrapper `getMonthCategoryLinesFeed(month, categoryId, currency, subcategoryId?)` que inyecta el cliente nativo.
- [x] 5.3 Query keys alineadas con web. Incluye realinear la de `useMonthCategoryBreakdown`, que estaba bajo `['dashboard','category-breakdown',…]`: pasa a `['transactions','breakdown','expense',…]`. Seguro — el hook no tenía consumidor y nada invalidaba la key vieja.

## 6. Estado de filtros nativo

- [x] 6.1 Agregar `overviewMode: 'egresos' | 'ingresos'` a `MovementFiltersState` (`apps/mobile/lib/transactions/feed-filters.ts`) y a `emptyFilters` (default `'egresos'`).
- [x] 6.2 Dejarlo FUERA de `activeFilterCount` y `hasActiveContentFilters` (como `month` y `query`).
- [x] 6.3 Corregir el comentario `- no \`overviewMode\`: the category breakdown is a web-only surface.` que este change invalida.
- [x] 6.4 Agregar el predicado `isPureCategoryDrill(filters)`: true sólo si `categoryId` está seteado y no hay `accountId`, `type`, `amountMin`, `amountMax` ni `query`.

## 7. Card nativa

- [x] 7.1 `apps/mobile/components/transactions/CategorySpendingOverview.tsx`: donut con `react-native-svg` (`<Circle r="15.915">` en `viewBox="0 0 36 36"`, `strokeDasharray`/`strokeDashoffset` como web), sobre `Card` con borde + sombra del design system.
- [x] 7.2 Ranking: filas con punto de color, label, %, monto y barra escalada contra `maxPercentage`; hasta 10 visibles y cola expandible ("+ N categorías más" / "Ver menos").
- [x] 7.3 Tabs Egresos / Ingresos escribiendo `overviewMode`; Ingresos usa `INCOME_PALETTE` por posición, Egresos el color propio de cada categoría.
- [x] 7.4 Pills ARS/USD escribiendo `filters.currency`, renderizadas sólo si `useHasUsdAccount()` es true.
- [x] 7.5 Sección de créditos ("te devolvieron") desde `breakdown.credits[currency]`, fuera del donut.
- [x] 7.6 Nota off-ledger y breadcrumb "dentro de X" con vuelta a todas las categorías.
- [x] 7.7 Labels vía `apps/mobile/lib/categories.ts:361,371` + `useT()`; uncategorized y "sin subcategoría" desde el catálogo i18n.
- [x] 7.8 Verificar que NO renderiza selector de mes propio (lee `filters.month`, no lo escribe).

## 8. Skeleton y estados

- [x] 8.1 `CategorySpendingOverviewSkeleton.tsx` con `SkeletonBlock`: círculo del donut + 5 filas de ranking. Sin spinner.
- [x] 8.2 Chrome de la card (eyebrow, tabs, pills) visible desde el primer paint, con los controles deshabilitados hasta que llega la data — regla de `route-loading-and-errors`.
- [x] 8.3 Estado vacío por modo (`spending.empty` / `spending.income_empty`) y estado de error inline, en el idioma de la card no en un `Alert`.

## 9. Montaje y drill

- [x] 9.1 Montar la card en `apps/mobile/app/(app)/transactions/index.tsx`, entre `MonthNavigator` y los chips de acción.
- [x] 9.2 Tap en categoría → `patchFilters({ categoryId })`; tap en la categoría activa la limpia; en modo subcategoría el tap escribe `subcategoryId` y el re-tap lo limpia sin salir del drill.
- [x] 9.3 Modo Ingresos: el tap despacha además `type: 'income'` y fija la moneda visualizada (como web, porque ese drill usa la lente CAJA general).
- [x] 9.4 Rama de drill puro del feed: si `isPureCategoryDrill(filters)`, la lista viene de `getMonthCategoryLinesFeed`; si no, de `getMovementsFeedPage`.
- [x] 9.5 Pasar `installmentChips` a `MovementList` derivado del `installments: Map<id,{n,total}>` que devuelve la read (el prop ya existe).
- [x] 9.6 En la rama drilleada no renderizar "Cargar más" (no pagina).

## 10. i18n

- [x] 10.1 **Cero keys nuevas.** Las 25 de `transactions.spending.*` ya existen en `packages/i18n-messages` (es/en) y mobile lee ese mismo catálogo vía `apps/mobile/lib/i18n.ts`. El chip de cuota reusa `cards.detail.installment_chip`, como los otros dos consumidores nativos.
- [x] 10.2 Ninguna cadena usada por la card lleva ICU plural: `others_label` y `categories_caption` son interpolación simple (`{count}`), así que el translator nativo las resuelve sin tocar `Intl.PluralRules`.

## 11. Verificación

- [x] 11.1 `pnpm typecheck` y `pnpm lint` verdes en todo el monorepo.
- [x] 11.2 `pnpm test` verde, con `category-lines-reconcile.test.ts` intacto.
- [x] 11.3 Validado por el usuario. Comparar a mano los totales web vs nativo para el mismo mes y moneda: total del donut, top-3 del ranking, y la suma de la lista drilleada de una categoría con cuota + compartido + reintegro.
- [x] 11.4 Verificado por construcción: `useHasUsdAccount` no lleva mes en su query key y `hasUsdAccount` consulta `account_currencies`, no `transactions` — navegar de mes no puede hacer desaparecer el toggle.
- [x] 11.5 Verificado por construcción: `isPureCategoryDrill` devuelve false apenas `accountId`/`type`/`amountMin`/`amountMax`/`query` están activos, y `drilling` gatea cuál de las dos queries corre.
- [x] 11.6 Actualizar `openspec/specs/spending-by-category/spec.md` y `repo-architecture/spec.md` con los deltas al archivar.
