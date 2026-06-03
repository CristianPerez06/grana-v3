## 1. Contrato de datos — movimientos

- [x] 1.1 `lib/transactions/queries.ts`: incluir `canonical_name` y `user_id` de categoría y subcategoría en los `select` (lista, detalle, account movements, breakdowns que pasen por acá).
- [x] 1.2 `lib/transactions/types.ts`: extender el payload de categoría/subcategoría con `canonical_name` y `user_id`.
- [x] 1.3 `lib/transactions/movements.ts`: agregar a `FinancialMovement` `category_canonical_name`, `category_is_system`, `subcategory_canonical_name`, `subcategory_is_system`; en `toFinancialMovement` setear esos campos y dejar `category_name`/`subcategory_name` como el `name` crudo (fallback), sin traducir acá.
- [x] 1.4 Reflejar los cambios en los wrappers client de `app/_actions/queries.ts` si exponen el shape.

## 2. Display de movimientos (resolver con helper)

- [x] 2.1 Crear/usar un wrapper de presentación: `getCategoryName({ name, canonical_name, user_id }, t)` ya existe — usarlo en cada punto con `useTranslations()` (client) o `getTranslations()` (server).
- [x] 2.2 `lib/transactions/components/movement-row.tsx` y `movement-list.tsx`: resolver el label de categoría/subcategoría.
- [x] 2.3 `transactions/[txId]/_components/*`: detalle de movimiento.
- [x] 2.4 `lib/transactions/components/movement-filters.tsx`: opciones del dropdown de categoría/subcategoría.
- [x] 2.5 `transactions/new/_components/movement-form.tsx`: selector de categoría/subcategoría.

## 3. Breakdowns del dashboard

- [x] 3.1 `packages/dashboard/src/queries.ts`: `getMonthCategoryBreakdown` (y subcategory/income breakdown si aplica) incluyen `canonical_name` + `user_id` por categoría; al armar `CategorySliceInput` propagar `canonicalName` + `isSystem` (no solo `label`).
- [x] 3.2 `@grana/money-logic` (`CategorySliceInput` / `CategorySlice`): propagar `canonicalName` + `isSystem` a través de `buildCategorySlices` / `computeCategoryNet`.
- [x] 3.3 `dashboard/_components/category-teaser*.tsx`: resolver el label traducido por slice (sistema → i18n, propia → `label`).
- [x] 3.4 `lib/transactions/components/category-spending-overview*.tsx`: ídem en la vista completa.
- [x] 3.5 Mantener el sentinel `uncategorized` con su label i18n actual (ya resuelto fuera del helper).

## 4. Auditoría de puntos restantes

- [x] 4.1 `lib/recurrences/*` (detalle de recurrencia, upcoming): si muestran nombre de categoría, resolver.
- [x] 4.2 `lib/cards/*` (consumos): si muestran nombre de categoría, resolver.
- [x] 4.3 Grep final de `category_name` / `\.category\?\.name` / `subcategory_name` en `apps/web` para no dejar literales sin resolver.

## 5. Verificación

- [x] 5.1 `pnpm typecheck`, `pnpm lint`, `pnpm --filter web test`, `pnpm --filter @grana/dashboard test`, `pnpm --filter @grana/money-logic test`.
- [ ] 5.2 Manual: cambiar idioma a `en` y verificar que las categorías/subcategorías de **sistema** se traducen en detalle, lista, filtros, form, "En qué se fue" y spending; y que una categoría **propia** sigue mostrando su `name` literal.
- [ ] 5.3 Confirmar contra los scenarios del requirement "Nombres de categorías del sistema son traducibles" (spec `categories`).
