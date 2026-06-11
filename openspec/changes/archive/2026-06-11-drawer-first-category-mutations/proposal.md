## Why

Hoy las altas/ediciones de categorías y subcategorías **navegan** a pages dedicadas (`/settings/categories/new`, `/settings/categories/[id]/edit`, `/settings/categories/[id]/subcategories/new`) que montan un form en pantalla completa y vuelven al listado por código tras guardar. Los módulos vecinos `accounts` y `cards` ya migraron al patrón **drawer-first**: el CTA abre un drawer modal sobre el listado sin cambiar de URL, dejando la page `/new`/`/edit` solo como fallback no-JS. `categories` quedó como la última superficie inconsistente — el usuario pierde el contexto del listado en la operación más frecuente del módulo. Esta migración cierra ese gap en web y en mobile (que ya implementa la sección de categorías).

Este change reescribe y reemplaza al change parkeado `explore-categories-drawer-migration`, cuya exploración ya se resolvió (ver memoria de exploración): su bloqueante `align-settings-headers` está en `main` y su supuesto "mobile no implementa categorías" quedó obsoleto.

## What Changes

- **MODIFICAR** `categories-header.tsx` (web): el `<Button asChild><Link href="…/new">` pasa a un `<CreateCategoryButton />` que abre un drawer con `<CreateCategoryForm variant="drawer" />` (espejo de `CreateAccountButton`).
- **MODIFICAR** `category-row.tsx` (web): la acción `Editar` (hoy `<Link href="…/edit">` / `router.push`) pasa a abrir un edit-drawer; solo en filas `!isSystem`. `Ver subcategorías`, `Archivar`, `Eliminar` y sus confirmaciones quedan **sin cambios**.
- **MODIFICAR** `subcategories-header.tsx` (web): `Agregar` abre un `<CreateSubcategoryButton />` (drawer con el `category_id` del path) en vez de navegar a `…/subcategories/new`.
- **MODIFICAR** los tres forms web (`create-category-form`, `edit-category-form`, `create-subcategory-form`): aceptan `variant: 'page' | 'drawer'` con callbacks `onClose`/`onSuccess`; en `drawer` el éxito llama `onSuccess` + `router.refresh()` (no `router.push`).
- **MANTENER** las pages `/new`, `/[id]/edit`, `/[id]/subcategories/new` (web) como fallback no-JS / deep-link, renderizando el form en `variant="page"`. No se borran ni redirigen.
- **MODIFICAR** mobile (`apps/mobile`): las listas/filas abren el form en un bottom-sheet (`components/ui/Drawer`) en vez de `router.push` a `new.tsx`/`edit.tsx`; los forms exponen `onClose`/`onSuccess` en vez de `router.back()`. Las rutas `new.tsx`/`edit.tsx` quedan como fallback de deep-link. El back físico de Android cierra el sheet.
- **SIN CAMBIOS**: campos de los forms, validaciones, field/form errors, estados de submitting, ownership rules (sistema read-only, propias editables/archivables/eliminables, subcategoría permitida bajo propias y de sistema), confirmaciones de archivar/eliminar.
- **FUERA DE ALCANCE (explícito)**: no se agrega edición de subcategoría (no existe hoy en web/mobile, no se inventa); no se agrega aviso de cambios sin guardar al cerrar un drawer dirty (paridad con accounts/cards); no se agrega estado de drawer en la URL.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities

- `categories`: se modifica `Visualización de categorías en Configuración` para fijar que crear y editar (categoría propia) ocurren en un drawer disparado desde listado/fila, con la page como fallback no-JS; se agrega el contrato análogo para crear subcategoría desde el listado de subcategorías; y se modifican los requirements mobile (`Alta de categoría propia en mobile`, `Edición de categoría propia en mobile`, `Alta de subcategoría propia en mobile`) para que el host pase de full-route a bottom-sheet. Se reafirman como invariantes: validaciones, errores, ownership y confirmaciones existentes; y que NO existe edición de subcategoría.

## Impact

- **Código web (`apps/web/app/(app)/settings/categories/`)**: AGREGA `_components/create-category-button.tsx`, `_components/create-subcategory-button.tsx`, y un edit-drawer para categoría (espejo de `accounts-edit-drawer.tsx`). MODIFICA `_components/categories-header.tsx`, `_components/category-row.tsx`, `[id]/subcategories/_components/subcategories-header.tsx`, y los tres forms bajo `new/`, `[id]/edit/`, `[id]/subcategories/new/` (agregan `variant`/`onClose`/`onSuccess`). Las pages `new/page.tsx`, `[id]/edit/page.tsx`, `[id]/subcategories/new/page.tsx` se conservan.
- **Código mobile (`apps/mobile`)**: MODIFICA `components/categories/{CategoryList,CategoryRow,SubcategoryList,CreateCategoryForm,EditCategoryForm,CreateSubcategoryForm}.tsx` y los screens `app/(app)/settings/categories/{index,new,[id]/edit,[id]/subcategories/index,[id]/subcategories/new}.tsx` para hostear los forms en `ui/Drawer`. Mismos nombres, impl idiomática por plataforma.
- **Server actions / queries / data**: ninguno nuevo. Reutiliza `createCategory`, `updateCategory`, `createSubcategory`, `archiveCategory`, `deleteCategory`.
- **i18n**: posibles claves nuevas para títulos de drawer/sheet (similar a `accounts.actions.create`); reusar las existentes de `settings.categories.*` donde aplique.
- **Primitivos**: sin primitivo nuevo. Reusa `@/components/ui/drawer` (web) y `components/ui/Drawer` (mobile). No se extrae un `<EntityCreateButton>` compartido (regla de no abstraer antes de tiempo; accounts/cards duplicaron el trigger).
- **OpenSpec**: retirar el change parkeado `explore-categories-drawer-migration` (este change lo supersede).
- **Riesgo principal**: el éxito en drawer debe llamar `router.refresh()` (web) — hoy los forms dependen de `router.push` para refrescar el árbol RSC; sin refresh el listado queda stale.
