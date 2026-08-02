# Proposal: fix-archived-categories-in-selectors

## Why

El spec ya dice, en tres lugares, que una categoría archivada no se ofrece al cargar un movimiento nuevo (`categories` 125: "Una categoría archivada no aparece en selectores de nuevas transacciones"; `categories` 137: "ya no aparece en selectores de registro de movimientos"; `transactions` 2117: "Los selectores de categoría NO SHALL ofrecer categorías inactivas en cargas nuevas"). El formulario de movimientos las ofrece igual. No es una regla que falte escribir: es código que no la cumple.

Son dos defectos independientes que se ven como uno solo:

1. **Subcategorías archivadas.** `getAllCategories` filtra `is_active` sobre la categoría padre, pero el embed `subcategories(*)` va sin filtro. Toda subcategoría archivada del usuario vuelve en el árbol y el picker la lista. Dos señales confirman que es un olvido y no una decisión: la query hermana `getSubcategoriesByCategoryId` **sí** filtra `is_active` (por eso los filtros de la lista de movimientos se comportan bien y el formulario no), y `category-list.tsx:31` re-filtra `.filter((s) => s.is_active)` en el consumer — alguien ya chocó con la fuga y la parchó localmente en vez de en el read.

2. **Categorías eliminadas que siguen apareciendo.** El árbol se cachea con `staleTime` de 15 minutos (`query-client.ts:22`) y **nadie invalida nunca** la key `['categories','tree']`: las mutaciones de categoría son server actions que llaman `revalidatePath('/settings/categories')`, lo cual no toca el cache de TanStack en el cliente. Archivás o eliminás una categoría en Configuración y el drawer de movimientos la sigue ofreciendo. Como `categories` no tiene columna de soft-delete (0005), una categoría *eliminada* que aparece solo puede venir de cache viejo — que es exactamente lo que reportó el usuario.

## What Changes

- **El filtro vive en el read, no en cada consumer.** `getAllCategories` (web y mobile) pasa a filtrar el embed: `subcategories(*)` → subcategorías con `is_active = true`. Con eso el árbol queda limpio en su origen y todos los consumers lo heredan: formulario de alta y edición de movimientos, formulario de recurrencias, y las dos apps. El re-filtro defensivo de `category-list.tsx:31` deja de ser necesario y se saca (si el read miente, queremos que se note, no que un consumer lo tape).
- **Las mutaciones de categoría invalidan el árbol.** Archivar, eliminar, crear y editar (categoría o subcategoría) SHALL invalidar la key del árbol de categorías en el cliente: `['categories','tree']` en web, `['categories','all']` en mobile. Hoy web depende de `revalidatePath` (que no alcanza) y mobile no invalida nada porque sus pantallas de Configuración no usan react-query.
- **El ítem seleccionado sobrevive al filtro en modo edición.** Filtrar el árbol tiene un efecto colateral: un movimiento viejo que referencia una categoría o subcategoría ya archivada abriría el formulario de edición sin poder mostrar su propia clasificación, y un guardado la perdería en silencio. El spec exige lo contrario (`categories` 125: "permanece visible en transacciones históricas que la referencian"). El formulario SHALL conservar visible el ítem actualmente asignado aunque esté archivado, marcado como archivado, y NO SHALL ofrecerlo para elegir en un movimiento nuevo.
- **Sin migración ni cambio de esquema.** El corte es un predicado de query (PostgREST) y una regla de invalidación de cache. Las filas archivadas siguen existiendo y siguen siendo visibles donde el spec dice que deben serlo: Configuración y movimientos históricos.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `categories`: el requirement "El usuario puede archivar sus categorías propias" hace explícito que el ocultamiento aplica **igual a subcategorías archivadas** (hoy solo se lee como regla de categoría, y el código cumplió la mitad literal), y que la desaparición del selector es **inmediata** tras archivar/eliminar, no eventual cuando venza un cache.
- `transactions`: el requirement "El selector de categoría del drawer permite drill a subcategorías" incorpora que ambos niveles del picker ofrecen únicamente ítems activos, y la excepción de edición (el ítem archivado ya asignado se muestra marcado y no se pierde al guardar).
- `web-data-access`: nuevo requirement que hace explícita la obligación de invalidar la key de un catálogo cacheado desde toda mutación de ese catálogo. Hoy el spec pide conservar "`revalidatePath` + invalidación TanStack" existente, pero no exige que exista: un catálogo con `staleTime` largo y cero invalidación cumple la letra y sirve datos borrados.

## Impact

- `apps/web/lib/categories/queries.ts` (`getAllCategories`: filtrar el embed de subcategorías).
- `apps/mobile/lib/categories.ts` (`getAllCategories`: mismo filtro).
- `apps/web/app/(app)/settings/categories/_components/category-list.tsx` (sacar el re-filtro defensivo, ahora redundante).
- Invalidación web: `category-row.tsx` (archivar/eliminar), `subcategory-list.tsx` (archivar/eliminar) y los forms de alta/edición en drawer.
- Invalidación mobile: `components/categories/CategoryRow.tsx`, `components/categories/SubcategoryList.tsx` y los sheets de alta/edición.
- Modo edición: `packages/movement-form/src/use-movement-form.ts` (`transactionCategories` / `selectedCategory`, líneas 170-173) más el render de los pickers en `apps/web/lib/transactions/components/movement-form.tsx` y `apps/mobile/components/transactions/form-pickers.tsx`.
- Consumers que heredan el fix sin cambios propios: drawer de alta/edición de movimientos (web y mobile), `create-recurrence-modal.tsx`, `apps/mobile/app/(app)/transactions/recurring/new.tsx`, `edit-context.ts`.
- Tests nuevos sobre el read (el embed filtrado), la invalidación tras mutación y el caso de edición con categoría archivada.
- UX: una categoría archivada desaparece del selector en el acto; un movimiento viejo que la usa sigue mostrándola al editarlo.
