# Tasks: fix-archived-categories-in-selectors

## 1. El catálogo sale limpio del read

- [x] 1.1 `apps/web/lib/categories/queries.ts` — `getAllCategories`: agregar `.eq('subcategories.is_active', true)` al embed, con un comentario de por qué el filtro va acá y no en cada consumer
- [x] 1.2 `apps/mobile/lib/categories.ts` — `getAllCategories`: mismo filtro (la función está duplicada por plataforma; arreglar una sola deja media app rota)
- [x] 1.3 Verificar que una categoría activa sin subcategorías activas sigue viniendo con `subcategories: []` y no desaparece (esto es lo que rompería un `!inner`) — cubierto por los tests de 4.1/4.2
- [x] 1.4 `apps/web/app/(app)/settings/categories/_components/category-list.tsx:31` — sacar el `.filter((s) => s.is_active)` defensivo, ahora redundante: si el read vuelve a mentir, queremos que se vea

## 2. Las mutaciones invalidan el catálogo

- [x] 2.1 Web: invalidar el prefijo `['categories']` tras un resultado `ok` en `category-row.tsx` (archivar y eliminar) — reusando el `invalidateAfterCategoryMutation` que ya existía en `lib/transactions/invalidation.ts` (tenía un solo caller), en vez de crear un helper nuevo
- [x] 2.2 Web: ídem en `settings/categories/[id]/subcategories/_components/subcategory-list.tsx` (archivar y eliminar)
- [x] 2.3 Web: ídem en los forms de alta y edición de categoría y subcategoría en drawer (una categoría nueva que tarda 15 minutos en aparecer es el mismo bug con el signo cambiado) — `create-category-form.tsx` ya lo hacía; se suman `create-subcategory-form.tsx` y `edit-category-form.tsx`
- [x] 2.4 Mobile: invalidar el mismo prefijo en `components/categories/CategoryRow.tsx` y `components/categories/SubcategoryList.tsx` vía `useQueryClient()` del provider raíz (`app/_layout.tsx:82`) — sin migrar esas pantallas a react-query; helper nuevo en `lib/categories-invalidate.ts` (sibling y no `lib/categories/invalidate.ts`, que shadowearía `lib/categories.ts`)
- [x] 2.5 Mobile: ídem en los sheets de alta y edición de categoría y subcategoría
- [x] 2.6 Confirmar que el prefijo `['categories']` alcanza a `['categories','tree']` (web) y `['categories','all']` (mobile), y que no queda ningún call site de mutación de categoría sin invalidar — 5 archivos por plataforma; `updateSubcategory` no tiene UI todavía en ninguna de las dos

## 3. El ítem archivado ya asignado sobrevive en edición

- [x] 3.1 Agregar al embed del read de detalle las columnas que faltan para poder injertar — el read real es `TRANSACTION_SELECT` en `packages/transactions/src/queries.ts` (no `packages/shared`), y ya traía `id`/`category_id`: se suman `is_active` (ambos) y `type` (categoría, para que el nodo injertado sobreviva al filtro income/expense)
- [x] 3.2 `packages/movement-form/src/types.ts` — extender `MovementEditContext` con el nodo archivado asignado (categoría y/o subcategoría), opcional y nulo cuando el ítem está activo
- [x] 3.3 `apps/web/lib/transactions/edit-context.ts` y `apps/mobile/lib/transactions/edit-context.ts` — poblarlo desde el movimiento ya leído, solo cuando `is_active === false` (sin read adicional)
- [x] 3.4 Injertar el nodo archivado **solo si** su id coincide con la selección actual del form y no está ya en el árbol; al elegir otra categoría el injerto desaparece. Helper puro `graftArchivedTaxonomy` en `packages/movement-form/src/archived-taxonomy.ts`, llamado desde el hook **y** desde `movement-form.tsx` de web (que reproyecta el árbol por su cuenta para conservar el tipo rico, así que el injerto del hook no le llega)
- [x] 3.5 Excluir el nodo injertado del cálculo de `drillable` (`movement-form.tsx:690`, `form-pickers.tsx:153`): una categoría cuyo único hijo es la subcategoría archivada del movimiento no debe abrir un nivel 1 de una sola opción archivada
- [x] 3.6 Render del ítem archivado en los dos pickers (`apps/web/lib/transactions/components/movement-form.tsx`, `apps/mobile/components/transactions/form-pickers.tsx`): marca de archivado derivada de `is_active`, sin heurísticas de nombre — en las filas del picker y también en el trigger, que es lo que ve quien abre la edición sin desplegar el selector
- [x] 3.7 Copy i18n de la marca de archivado en `es` (y `en` si la key lo requiere)

## 4. Tests

- [x] 4.1 Read web: fake de PostgREST que verifica el **string exacto** del predicado del embed y falla ante un predicado desconocido; casos subcategoría archivada excluida, categoría activa con `subcategories: []` preservada, categoría archivada excluida — `apps/web/lib/categories/__tests__/archived-catalog.test.ts`
- [x] 4.2 Read mobile — **hecho distinto de lo planeado**: `apps/mobile` no tiene test runner (ni vitest ni script `test`), así que no hay dónde correr el mismo set. En su lugar, un guard de paridad dentro del suite de web que lee el **source** de `apps/mobile/lib/categories.ts` y exige el predicado del embed. Prueba que el filtro está escrito, no que corre — coarse, pero es lo que hace fallar en CI arreglar una sola plataforma. Se borra el día que los dos reads se unifiquen en un package
- [x] 4.3 Invalidación: `apps/web/lib/categories/__tests__/category-invalidation.test.ts` — el prefijo `['categories']` alcanza `['categories','tree']` y `['categories','all']` con un `QueryClient` real, más un guard de call sites (los 10 archivos) porque el bug nunca fue el helper sino que archivar/eliminar no lo llamaban
- [x] 4.4 Hook de formulario: `packages/movement-form/__tests__/edit-archived-taxonomy.test.tsx` (los 4 casos, incluido el payload de `updateTransaction`) + `archived-taxonomy.test.ts` para los helpers puros
- [x] 4.5 Verificado revirtiendo cada pieza: sin el filtro del read fallan 4 de 6 (los 2 que pasan son guards de "esto no cambió": categoría sin subcategorías, categoría archivada excluida — ya funcionaban); sin el invalidate de `category-row.tsx` fallan 2; sin el injerto en el hook falla 1

## 5. Cierre

- [x] 5.1 `pnpm typecheck` + `pnpm typecheck:mobile` + `pnpm lint` + `pnpm lint:mobile` + `pnpm test` (528 tests) + `pnpm --filter movement-form test` (32) + `pnpm openspec:check` en verde. `lint:mobile` deja 1 warning preexistente en `scripts/gen-icons.mjs`, ajeno a este change
- [x] 5.2 Verificación manual en web y mobile: archivar una subcategoría en Configuración y confirmar que desaparece del selector del drawer **sin recargar**; abrir en edición un movimiento que la usaba y confirmar que conserva su clasificación — validado por el autor
- [x] 5.3 Actualizar los specs base desde los deltas al archivar el change (flujo `opsx:archive` habitual) — `categories` y `transactions` con 1 requirement modificado cada uno, `web-data-access` con 1 agregado; sin secciones de delta remanentes en los specs base
