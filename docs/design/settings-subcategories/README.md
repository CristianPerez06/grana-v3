# Propuesta visual `/settings/categories/[id]/subcategories`

## Contexto

Esta propuesta aplica `docs/design/route-ui-system.md` a la ruta `/settings/categories/[id]/subcategories`. El alcance es solo la lista de subcategorias de una categoria; no incluye crear subcategoria ni editar categoria.

La ruta tiene paridad web/mobile con implementaciones nativas separadas.

Para corregir el patron de formularios en rutas dedicadas, ver tambien `docs/design/settings-category-drawers/`. Ese bundle propone que crear subcategoria se abra en drawer desde esta lista.

## Implementacion inspeccionada

- `apps/web/app/(app)/settings/categories/[id]/subcategories/layout.tsx`
- `apps/web/app/(app)/settings/categories/[id]/subcategories/page.tsx`
- `apps/web/app/(app)/settings/categories/[id]/subcategories/loading.tsx`
- `apps/web/app/(app)/settings/categories/[id]/subcategories/_components/subcategories-header.tsx`
- `apps/web/app/(app)/settings/categories/[id]/subcategories/_components/subcategory-list.tsx`
- `apps/web/lib/categories/queries.ts`
- `apps/web/lib/categories/types.ts`
- `apps/mobile/app/(app)/settings/categories/[id]/subcategories/index.tsx`
- `apps/mobile/components/categories/SubcategoryList.tsx`

## Datos disponibles

- Back link a `/settings/categories`.
- Header con titulo de subcategorias.
- En mobile nativo, el titulo puede incluir nombre de categoria.
- Accion `Agregar` a `/settings/categories/[id]/subcategories/new`, deshabilitada en web hasta resolver categoria.
- Categoria por `id`, con `notFound` si no existe.
- Subcategorias activas de la categoria.
- Por subcategoria:
  - `id`
  - `displayName`
  - ownership: sistema cuando `user_id === null`.
- Acciones reales:
  - archivar y eliminar solo para subcategorias propias.
- Confirmacion de delete existente.
- Error inline por fila cuando falla archivar/eliminar.
- Empty cuando no hay subcategorias.
- Loading list skeleton.

## Direccion propuesta

- Mantener la ruta como lista simple y enfocada.
- Subir de `max-w-md` a un ancho moderado cercano a `680px`, para que nombres y acciones respiren.
- Mantener back link y `PageHeader`, sin hero ni resumenes.
- Usar un panel unico con filas estables.
- En desktop, acciones textuales a la derecha para subcategorias propias.
- En mobile/narrow, usar boton compacto de acciones para evitar que los nombres largos colisionen.
- Para subcategorias de sistema, no mostrar acciones.

## Recomendaciones

- Web: evitar que la fila dependa de un layout horizontal estrecho con acciones visibles en mobile.
- Mobile: conservar `Alert` para confirmar delete y `onChanged` para refetch.
- No cambiar queries, ownership rules ni rutas de navegacion.
- No agregar conteos, filtros, busqueda ni descripcion nueva de producto.

## Archivos del bundle

- `shared.css`
- `web/subcategories.html`
- `mobile/subcategories.html`
- `components/route-shell.html`
- `components/subcategories-header.html`
- `components/subcategory-list.html`
- `components/subcategory-row.html`
- `components/empty-state.html`
- `components/loading-state.html`
- `components/error-state.html`
