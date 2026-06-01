# Subcategorías propias bajo categorías del sistema (web)

## Why

El spec de `categories` dice que un usuario puede crear subcategorías bajo cualquier categoría activa, incluidas las del sistema (escenario "Creación de subcategoría bajo categoría del sistema"). Pero la UI web lo contradecía:

- `new/page.tsx` bloqueaba con `notFound()` cualquier categoría cuyo `user_id` no fuera el del usuario → imposible agregar una subcategoría bajo una categoría del sistema.
- La pantalla de subcategorías ocultaba el botón "+ Agregar" en categorías del sistema.
- Las acciones por fila (archivar/eliminar) se mostraban según el `isSystem` de la **categoría padre**, no según el dueño de **cada** subcategoría. Una subcategoría propia bajo una categoría del sistema habría quedado sin forma de gestionarse.

## What Changes

- `new/page.tsx`: el guard permite categorías propias **y del sistema** (`user_id IS NULL`); solo bloquea categorías de otros usuarios.
- `subcategories/page.tsx`: el botón "+ Agregar subcategoría" se muestra siempre (también bajo categorías del sistema).
- `subcategory-list.tsx`: cada fila decide sus acciones según el `user_id` de **esa** subcategoría (propia → archivar/eliminar; del sistema → read-only), en vez de heredar el flag del padre.

Sin cambios de backend ni de schema: la RLS de `subcategories` (insert `WITH CHECK (user_id = auth.uid())`, select de propias + sistema) ya soporta esto; las subcategorías propias bajo una categoría del sistema son privadas del usuario.

## Capabilities

### Modified Capabilities

- `categories`: se clarifica que la gestión (editar/archivar/eliminar) de una subcategoría depende del dueño de esa subcategoría, no de la categoría padre, y que la UI web permite agregar subcategorías bajo categorías del sistema.

## Impact

- Affected specs: `categories`.
- Affected code:
  - `apps/web/app/(app)/settings/categories/[id]/subcategories/new/page.tsx`
  - `apps/web/app/(app)/settings/categories/[id]/subcategories/page.tsx`
  - `apps/web/app/(app)/settings/categories/[id]/subcategories/_components/subcategory-list.tsx`
- Paridad mobile: pendiente (mobile gestiona categorías por su cuenta; queda como follow-up).
