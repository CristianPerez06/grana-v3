# Propuesta visual: drawers para formularios de categorias

## Contexto

Esta propuesta corrige el patron actual donde los formularios de categorias/subcategorias viven en rutas dedicadas (`/new`, `/edit`). El objetivo visual es que las listas de categorias y subcategorias conserven el contexto y abran los formularios en drawers, igual que otros flujos de alta/edicion de la app.

Esta propuesta cubre solo formularios existentes:

- Crear categoria.
- Editar categoria propia.
- Crear subcategoria.

No existe hoy una ruta de editar subcategoria en web/mobile, por lo que no se propone un drawer nuevo para editar subcategoria.

## Implementacion inspeccionada

Web:

- `apps/web/app/(app)/settings/categories/new/page.tsx`
- `apps/web/app/(app)/settings/categories/new/layout.tsx`
- `apps/web/app/(app)/settings/categories/new/_components/create-category-form.tsx`
- `apps/web/app/(app)/settings/categories/[id]/edit/page.tsx`
- `apps/web/app/(app)/settings/categories/[id]/edit/layout.tsx`
- `apps/web/app/(app)/settings/categories/[id]/edit/_components/edit-category-form.tsx`
- `apps/web/app/(app)/settings/categories/[id]/subcategories/new/page.tsx`
- `apps/web/app/(app)/settings/categories/[id]/subcategories/new/layout.tsx`
- `apps/web/app/(app)/settings/categories/[id]/subcategories/new/_components/create-subcategory-form.tsx`
- `apps/web/app/(app)/settings/categories/_components/icon-picker.tsx`
- `apps/web/app/(app)/settings/categories/_components/color-picker.tsx`

Mobile:

- `apps/mobile/app/(app)/settings/categories/new.tsx`
- `apps/mobile/app/(app)/settings/categories/[id]/edit.tsx`
- `apps/mobile/app/(app)/settings/categories/[id]/subcategories/new.tsx`
- `apps/mobile/components/categories/CreateCategoryForm.tsx`
- `apps/mobile/components/categories/EditCategoryForm.tsx`
- `apps/mobile/components/categories/CreateSubcategoryForm.tsx`

## Datos y acciones disponibles

Crear categoria:

- `name`
- `type`: `expense`, `income`, `both`
- `icon`
- `color`
- accion `createCategory`

Editar categoria:

- categoria existente, solo si es propia.
- `name`
- `icon`
- `color`
- `type` es readonly en mobile y no se edita en web.
- accion `updateCategory`

Crear subcategoria:

- `category_id`
- `name`
- accion `createSubcategory`
- permitido bajo categorias propias y categorias de sistema; no bajo categorias de otro usuario.

Estados:

- field errors.
- form error.
- submitting/loading.
- not found / readonly guards existentes.

## Direccion propuesta

- Las listas `/settings/categories` y `/settings/categories/[id]/subcategories` siguen siendo las pantallas base.
- El CTA `Agregar` abre un drawer en vez de navegar a `/new`.
- La accion `Editar` de una categoria propia abre un drawer en vez de navegar a `/edit`.
- En `/settings/categories/[id]/subcategories`, `Agregar` abre un drawer de crear subcategoria.
- Guardar cierra el drawer y refresca la lista.
- Cancelar/cerrar vuelve al estado de lista sin cambiar datos.
- Mantener los formularios y validaciones existentes; solo cambia el host visual.
- Desktop: drawer lateral derecho.
- Mobile/narrow: drawer como bottom sheet.

## Recomendaciones de producto/spec

- Esto cambia el comportamiento de navegacion: las rutas `/new` y `/edit` dejarian de ser la experiencia principal.
- Antes de implementar, conviene crear un OpenSpec proposal para definir:
  - si las rutas dedicadas se eliminan, redirigen o quedan como fallback/deep-link.
  - como se representa el estado de drawer en URL, si corresponde.
  - que pasa al cerrar drawer con cambios sin guardar, si se quiere agregar aviso.
- No agregar nuevos campos.
- No agregar edicion de subcategoria hasta que exista como requerimiento.
- No cambiar ownership rules.

## Archivos del bundle

- `shared.css`
- `web/categories-with-drawer.html`
- `web/subcategories-with-drawer.html`
- `mobile/categories-with-sheet.html`
- `mobile/subcategories-with-sheet.html`
- `components/category-create-drawer.html`
- `components/category-edit-drawer.html`
- `components/subcategory-create-drawer.html`
- `components/category-form-fields.html`
- `components/subcategory-form-fields.html`
- `components/drawer-shell.html`
