# Propuesta visual `/settings/categories`

## Contexto

Esta propuesta aplica `docs/design/route-ui-system.md` a la ruta `/settings/categories`. El alcance es solo la lista raiz de categorias; no incluye `/settings/categories/new`, `/settings/categories/[id]/edit` ni `/settings/categories/[id]/subcategories`.

La ruta tiene paridad web/mobile con implementaciones nativas separadas.

## Implementacion inspeccionada

- `apps/web/app/(app)/settings/categories/layout.tsx`
- `apps/web/app/(app)/settings/categories/page.tsx`
- `apps/web/app/(app)/settings/categories/loading.tsx`
- `apps/web/app/(app)/settings/categories/_components/categories-header.tsx`
- `apps/web/app/(app)/settings/categories/_components/category-list.tsx`
- `apps/web/app/(app)/settings/categories/_components/category-row.tsx`
- `apps/web/lib/categories/queries.ts`
- `apps/web/lib/categories/types.ts`
- `apps/mobile/app/(app)/settings/categories/index.tsx`
- `apps/mobile/components/categories/CategoryList.tsx`
- `apps/mobile/components/categories/CategoryRow.tsx`

## Datos disponibles

- Header con titulo, descripcion y accion `Agregar`.
- Categorias activas visibles para el usuario: sistema y propias.
- Por categoria:
  - `id`
  - `name` / `canonical_name` con traduccion via `getCategoryName`.
  - `icon`.
  - `color`.
  - `type`: `income`, `expense`, `both`.
  - ownership: sistema cuando `user_id === null`.
  - conteo de subcategorias activas.
- Acciones reales:
  - ver subcategorias, para todas las categorias.
  - editar, archivar y eliminar, solo para categorias propias.
- Error inline por fila cuando falla archivar/eliminar.
- Empty cuando no hay categorias.
- Loading por secciones.

## Direccion propuesta

- Mantener la estructura de dos grupos: sistema y propias.
- Ampliar levemente la ruta a un ancho operativo cercano a `860px`, para que las acciones de fila no aplasten el nombre.
- Usar paneles con radio 18px y borde suave, alineados con `/settings`.
- Hacer cada fila escaneable:
  - icono cuadrado redondeado.
  - nombre principal.
  - pill de tipo.
  - conteo de subcategorias como metadata.
  - acciones a la derecha en desktop.
- En mobile/narrow, reemplazar las acciones textuales visibles por un boton de menu/acciones compacto. No cambia la lista de acciones; solo evita que nombres largos se rompan.
- No agregar busqueda, filtros, conteos globales ni nuevos estados.

## Recomendaciones

- Web: actualizar `CategoryList`/`CategoryRow` para usar filas de altura estable y acciones responsivas.
- Mobile: mantener `CategoryList` y `CategoryRow` nativos, pero evitar que cuatro acciones textuales queden en la misma linea que el nombre. Usar un boton compacto o menu nativo si ya existe un primitivo adecuado.
- Si se introduce un nuevo menu/overlay compartido, usar los primitivos existentes (`Popover`/`Drawer`) y respetar contratos.
- Las confirmaciones de delete ya existen (`confirm` web, `Alert` mobile); conservarlas.
- No modificar queries ni ownership rules.

## Archivos del bundle

- `shared.css`
- `web/categories.html`
- `mobile/categories.html`
- `components/route-shell.html`
- `components/categories-header.html`
- `components/category-section.html`
- `components/category-row.html`
- `components/empty-state.html`
- `components/loading-state.html`
- `components/error-row.html`
