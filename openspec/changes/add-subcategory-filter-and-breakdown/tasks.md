# Tareas — Filtro y breakdown por subcategoría

## Grupo 1 · Lógica pura en money-logic

- [ ] 1.1. Crear `packages/money-logic/src/build-subcategory-slices.ts` con `buildSubcategorySlices(input: SubcategorySliceInput[])` y exportar el type `SubcategorySliceInput`. Mismo shape de output que `buildCategorySlices` (`{ total, slices }`).
- [ ] 1.2. Re-exportar desde `packages/money-logic/src/index.ts`.
- [ ] 1.3. Tests en `packages/money-logic/src/__tests__/build-subcategory-slices.test.ts`: sort por value desc, percentages suman 100, slice "Sin subcategoría" (id=null) se incluye normal, input vacío, todo en una sola subcat, todo en "Sin subcategoría".

## Grupo 2 · Filter shape y URL parsing

- [ ] 2.1. Agregar `subcategoryId?: string` al type `MovementFilters` en `apps/web/lib/transactions/filters.ts`.
- [ ] 2.2. Extender `parseMovementFilters` para leer `subcategory` del URL. Si llega sin `category`, descartar silenciosamente. Aceptar el marker literal `__none__`.
- [ ] 2.3. Extender `hasContentFilters` para incluir `subcategoryId`.
- [ ] 2.4. Extender `buildMovementLimitHref` para preservar `subcategory`.
- [ ] 2.5. Tests en `apps/web/lib/transactions/__tests__/filters.test.ts`: parsing válido, `subcategory` sin `category` se descarta, marker `__none__` se preserva, `hasContentFilters` true cuando hay `subcategoryId`, `buildMovementLimitHref` preserva el param.

## Grupo 3 · Server query

- [ ] 3.1. En `apps/web/lib/transactions/queries.ts`, dentro del builder de filtros del query, aplicar `.eq('subcategory_id', ...)` cuando hay `subcategoryId` válido (uuid) y `.is('subcategory_id', null)` cuando es `'__none__'`. Aplica EN ADICIÓN al filtro de categoría.
- [ ] 3.2. Agregar fetch de subcategorías filtradas por la categoría activa en `apps/web/app/(app)/transactions/page.tsx` (o en el helper de carga del page). Solo cuando hay `categoryId` activo.

## Grupo 4 · UI del filtro

- [ ] 4.1. Aceptar prop `subcategories` (lista filtrada por categoría activa) en `movement-filters.tsx`.
- [ ] 4.2. Renderear un select de subcategoría debajo del de categoría. Visible SOLO cuando `filters.categoryId` está seteado.
- [ ] 4.3. Al cambiar `category`, llamar `setParams({ category: nextId, subcategory: null })`.
- [ ] 4.4. Agregar chip activo "Subcategoría: <nombre>" (o "Subcategoría: Sin subcategoría" para el marker) con `clear: () => setParams({ subcategory: null })`.
- [ ] 4.5. i18n keys: `transactions.filters.subcategory`, `transactions.filters.no_subcategory`, `transactions.filters.active_chip_subcategory` en `packages/i18n-messages/src/{es,en}.json`.

## Grupo 5 · Resolución del mode en page.tsx

- [ ] 5.1. En `apps/web/app/(app)/transactions/page.tsx`, calcular `breakdownMode = filters.categoryId && !filters.subcategoryId ? 'subcategory' : 'category'`.
- [ ] 5.2. Cuando `breakdownMode === 'subcategory'`, resolver `categoryContext = categories.find(c => c.id === filters.categoryId)` y agregar input por `subcategory_id` (incluyendo `null` como bucket), heredando color de la categoría madre.
- [ ] 5.3. Pasar `mode`, `categoryContext` y `slicesInput` al `CategorySpendingOverview`.

## Grupo 6 · `CategorySpendingOverview`

- [ ] 6.1. Aceptar nuevos props: `mode: 'category' | 'subcategory'`, `categoryContext?: { id, name } | null`, `slicesInput: CategorySliceInput[] | SubcategorySliceInput[]`.
- [ ] 6.2. Internamente, cuando `mode='subcategory'`, llamar `buildSubcategorySlices`; cuando `mode='category'`, `buildCategorySlices`. (Aceptable un narrow por mode para tipar bien.)
- [ ] 6.3. Título dinámico: `mode='subcategory'` → "En qué se fue dentro de **<categoryContext.name>**" (negrita en la categoría). i18n key `transactions.breakdown.title_with_category`.
- [ ] 6.4. Slice "Sin subcategoría" (id=null) renderea con label de `transactions.breakdown.no_subcategory_slice` y color neutral gris.
- [ ] 6.5. Helper nuevo `subcategoryHref(month, currency, categoryId, subcategoryId)` que arma el URL drill-down con el marker `__none__` para id=null.
- [ ] 6.6. Cuando `mode='subcategory'`, los `<Link>` de cada slice (y de cada fila del ranking) usan `subcategoryHref` en vez de `categoryHref`. Cuando `mode='category'`, sigue usando `categoryHref` como hoy.

## Grupo 7 · i18n

- [ ] 7.1. Agregar en `packages/i18n-messages/src/es.json` y `en.json` las claves:
  - `transactions.filters.subcategory`
  - `transactions.filters.no_subcategory`
  - `transactions.filters.active_chip_subcategory` (con interpolación `{name}`)
  - `transactions.breakdown.title_with_category` (con interpolación `{category}`)
  - `transactions.breakdown.no_subcategory_slice`
- [ ] 7.2. Revisar que no se rompan claves existentes.

## Grupo 8 · Verificación

- [ ] 8.1. `pnpm --filter web typecheck` verde.
- [ ] 8.2. `pnpm --filter web lint` sin errores nuevos (warnings pre-existentes permitidos).
- [ ] 8.3. `pnpm --filter web test` verde (tests nuevos de filters + buildSubcategorySlices incluidos).
- [ ] 8.4. `pnpm --filter @grana/money-logic test` verde.
- [ ] 8.5. `pnpm --filter web build` verde.
- [ ] 8.6. Verificación visual en navegador (`pnpm dev`):
  - Sin filtros → donut por categoría (mode='category'), filtros muestran solo categoría sin subcat.
  - Filtrar por categoría "Comida" → donut switchea a "En qué se fue dentro de Comida" con slices por subcategoría. Aparece el select de subcategoría en filtros.
  - Cambiar la categoría a "Transporte" → el filtro de subcategoría se limpia automáticamente.
  - Click en un slice del donut (mode='subcategory') → URL agrega `&subcategory=<id>`, chip activo aparece, donut vuelve a `mode='category'`.
  - Click en slice "Sin subcategoría" → URL agrega `&subcategory=__none__`, lista filtra a tx sin subcategoría.
  - Filtrar manualmente desde el select → mismo comportamiento que el drill-down.
  - Limpiar el chip de subcategoría → vuelve al breakdown por subcategoría dentro de la categoría.
  - Verificar que el footer "Sin contar consumos en tarjeta sin pagar" sigue ahí en ambos modes.

## Grupo 9 · Archive

- [ ] 9.1. Mover el change a `openspec/changes/archive/YYYY-MM-DD-add-subcategory-filter-and-breakdown/`.
- [ ] 9.2. Aplicar deltas a `openspec/specs/transactions/spec.md` (integrar ADDED y MODIFIED a la sección flat).
- [ ] 9.3. Verificar que el master spec no contiene delta sections (`## ADDED Requirements`, etc.).
- [ ] 9.4. Actualizar `AGENTS.md` si aplica (probablemente no — el módulo `transactions` ya está ✅ Done).
