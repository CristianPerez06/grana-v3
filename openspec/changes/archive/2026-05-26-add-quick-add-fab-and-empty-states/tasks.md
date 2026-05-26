## 1. Motivo del vacío (`filters.ts`)

- [x] 1.1 `hasSearch(filters)` (= `!!filters.query`) y `hasOtherContentFilters(filters)` (tipo, categoría, cuenta, moneda, rango de monto — sin `query`, sin mes; **incluye moneda**, a diferencia de `hasContentFilters`). `resolveEmptyVariant(filters)` → `'none' | 'search' | 'filter'` con precedencia `filter > search > none`.
- [x] 1.2 `buildFiltersClearedHref(basePath, params)` (quita tipo/categoría/cuenta/moneda/monto + siempre `limit`, conserva mes y `q`) y `buildSearchClearedHref(basePath, params)` (quita `q`). Parametrizados por base path (sirven en `/transactions` y `/accounts/[id]`).
- [x] 1.3 Tests de los helpers (variante por combinación; precedencia filter>search; moneda cuenta acá pero no en `hasContentFilters`; URLs saneadas; base path; bare path). 9 tests, suite verde (192).

## 2. Empty states en `MovementList`

- [x] 2.1 `MovementList` acepta `emptyState?: { variant; addHref?; clearHref?; query? }` (tipo `MovementEmptyState`). Sin el prop → variante `none` (comportamiento actual).
- [x] 2.2 Render de las 3 variantes: `none` (título + descripción + CTA `empty.cta` → `addHref`), `search` (mensaje con el término + acción limpiar búsqueda `clearHref`), `filter` (mensaje + acción limpiar filtros `clearHref`).
- [x] 2.3 Claves i18n nuevas (`empty.search_title/search_description/clear_search/filter_title/filter_description/clear_filters`) en es/en; el CTA de `none` reusa `empty.cta`.

## 3. Integración en las páginas

- [x] 3.1 `/transactions/page.tsx`: `emptyVariant = resolveEmptyVariant(filters)`; pasa `emptyState` (variante + `query` + `addHref=/transactions/new` + `clearHref` saneado según variante) a `MovementList`.
- [x] 3.2 `/accounts/[id]/page.tsx`: pasa `emptyState` con `addHref=/transactions/new?account=<id>&from=account:<id>` y `clearHref` con base `/accounts/<id>`; variante derivada de los filtros.

## 4. Quick-add FAB

- [x] 4.1 Nuevo `QuickAddFab` (`apps/web/lib/transactions/components/quick-add-fab.tsx`): `Link` fijo (esquina inferior, `z-40`, `size-14`) a `/transactions/new`, ícono `Plus`, `aria-label` vía `actions.register_movement` (clave existente, sin duplicar).
- [x] 4.2 Montado en `/transactions/page.tsx` y `/dashboard/page.tsx`.
- [x] 4.3 Sin clave i18n nueva: el aria-label reusa `actions.register_movement`.

## 5. Verificación

- [x] 5.1 `pnpm build` (web) verde (lint + type-check); typecheck limpio; 192 tests verdes (incluye los 9 nuevos de `filters`).
- [x] 5.2 Verificación en navegador (por el usuario): todo OK.

## 6. Archive (último commit de la rama, antes del merge)

- [x] 6.1 Deltas (2 ADDED) integrados al master `openspec/specs/transactions/spec.md` (sin secciones delta), change movido a `openspec/changes/archive/2026-05-26-add-quick-add-fab-and-empty-states/`, merge-gate OK. CLAUDE.md sin cambios.
