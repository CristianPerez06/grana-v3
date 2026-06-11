## 1. Preparación

- [x] 1.1 Confirmar que `align-settings-headers` está archivado en `main` (ya verificado) y releer `accounts/_components/create-account-button.tsx`, `accounts/_components/accounts-edit-drawer.tsx` y `accounts/new/_components/create-account-form.tsx` como plantilla del patrón.
- [x] 1.2 Retirar el change parkeado `explore-categories-drawer-migration` (este change lo supersede): borrar su carpeta en `openspec/changes/` o moverla, y actualizar la memoria de exploración correspondiente.

## 2. Web — forms con variant

- [x] 2.1 Refactor `settings/categories/new/_components/create-category-form.tsx`: agregar props `variant?: 'page' | 'drawer'`, `onClose?`, `onSuccess?`. En `page` mantener el `router.push('/settings/categories')` actual; en `drawer` llamar `onSuccess()` + `router.refresh()` al éxito y `onClose()` al cancelar. Conservar campos, schema, field/form errors y submitting.
- [x] 2.2 Refactor `settings/categories/[id]/edit/_components/edit-category-form.tsx` con el mismo shape de `variant`/`onClose`/`onSuccess` (campos `name`, `icon`, `color`). Preservar el guard de categoría de sistema / not-found.
- [x] 2.3 Refactor `settings/categories/[id]/subcategories/new/_components/create-subcategory-form.tsx` con el mismo shape, recibiendo `category_id` (campo `name`).
- [x] 2.4 Verificar que las pages `new/page.tsx`, `[id]/edit/page.tsx`, `[id]/subcategories/new/page.tsx` montan el form con `variant="page"` y se comportan idéntico a hoy (fallback no-JS / deep-link).

## 3. Web — triggers + drawers

- [x] 3.1 Agregar `settings/categories/_components/create-category-button.tsx`: `<Button>` + `<Drawer>` con `useState` local y `key` para remontar; monta `<CreateCategoryForm variant="drawer" onClose onSuccess />`.
- [x] 3.2 Modificar `settings/categories/_components/categories-header.tsx`: reemplazar `<Button asChild><Link href="…/new">` por `<CreateCategoryButton />`.
- [x] 3.3 Agregar el edit-drawer de categoría (espejo de `accounts-edit-drawer.tsx`) y conectarlo en `settings/categories/_components/category-row.tsx`: la acción `Editar` (desktop y kebab) abre el drawer en vez de `<Link>`/`router.push`, solo dentro del bloque `!isSystem`. No tocar `Ver subcategorías`, `Archivar`, `Eliminar` ni sus confirmaciones.
- [x] 3.4 Agregar `settings/categories/[id]/subcategories/_components/create-subcategory-button.tsx` (con `categoryId`) y conectarlo en `subcategories-header.tsx`: `Agregar` abre el drawer en vez de navegar a `…/subcategories/new`.
- [x] 3.5 Agregar/reusar claves i18n para títulos de drawer (`ariaLabel`/título), bajo `settings.categories.*`.

## 4. Mobile — forms + sheets

- [x] 4.1 Refactor `components/categories/CreateCategoryForm.tsx`: exponer `onClose`/`onSuccess` y dejar de hacer `router.back()` en el éxito (el sheet gestiona el cierre y el refetch).
- [x] 4.2 Refactor `components/categories/EditCategoryForm.tsx` y `CreateSubcategoryForm.tsx` con el mismo shape; preservar guard de sistema en edición y `category_id` en subcategoría.
- [x] 4.3 Hostear los forms en `components/ui/Drawer` (bottom-sheet) disparado desde `CategoryList`/`CategoryRow` (alta + edición) y `SubcategoryList` (alta de subcategoría), sin navegar. La edición solo se ofrece en filas propias.
- [x] 4.4 Asegurar que el back físico de Android cierra el sheet abierto sin popear el screen del listado; el éxito re-dispara el fetch de la lista (refetch/estado).
- [x] 4.5 Conservar los screens `app/(app)/settings/categories/{new,[id]/edit,[id]/subcategories/new}.tsx` como fallback de deep-link montando el mismo form.

## 5. Verificación

- [x] 5.1 Web: crear/editar categoría y crear subcategoría desde el drawer cierran el drawer y refrescan el listado sin recarga; cancelar/cerrar no muta; field/form errors y submitting se ven igual que en la page.
- [x] 5.2 Web: filas de categoría de sistema no ofrecen `Editar`; deep-link directo a `/new` y `/[id]/edit` sigue funcionando (`variant="page"`).
- [x] 5.3 Mobile: alta/edición/alta-subcategoría en bottom-sheet, back de Android cierra el sheet, sistema read-only; deep-link a los screens sigue funcionando.
- [x] 5.4 Confirmar que NO se agregó edición de subcategoría en ninguna plataforma.
- [x] 5.5 `pnpm lint` y `pnpm typecheck` (o equivalentes del repo) en verde; `openspec validate drawer-first-category-mutations --strict` pasa.
