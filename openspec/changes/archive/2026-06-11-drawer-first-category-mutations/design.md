## Context

`categories` es el último módulo de Configuración cuyas mutaciones (crear categoría, editar categoría propia, crear subcategoría) viven en pages dedicadas en vez de drawers. El patrón drawer-first ya está consolidado y verificado en `accounts` y `cards`:

- `apps/web/app/(app)/accounts/_components/create-account-button.tsx`: trigger + `<Drawer>` con estado `useState` local; el form remonta vía `key` para resetear.
- `apps/web/app/(app)/accounts/new/_components/create-account-form.tsx`: `variant?: 'drawer' | 'page'`, `onClose`, `onSuccess`.
- `apps/web/app/(app)/accounts/_components/accounts-edit-drawer.tsx`: gemelo para edición.
- Las pages `/accounts/new` y `/accounts/[id]/edit` se conservan renderizando el form en `variant="page"` (fallback no-JS / deep-link).

El predecesor `align-settings-headers` (ya en `main`) dejó `categories-header.tsx` con la action en `<Button asChild>` y `category-row.tsx` ya tiene gating por `!isSystem` y un kebab mobile-web. La sección de categorías de mobile ya existe (`apps/mobile/app/(app)/settings/categories/**`) y dispone de un primitivo `components/ui/Drawer`.

Este change reemplaza al parkeado `explore-categories-drawer-migration`.

## Goals / Non-Goals

**Goals:**
- Crear categoría, editar categoría propia y crear subcategoría se abren en un drawer (web) / bottom-sheet (mobile) sobre el listado, sin cambiar de URL.
- Paridad estructural con `accounts`/`cards`: mismo shape de form (`variant`/`onClose`/`onSuccess`), estado local, page como fallback.
- Conservar 1:1 campos, validaciones, errores, estados de submitting, ownership y confirmaciones existentes.
- Paridad cross-platform por nombre/estructura, con impl idiomática por plataforma.

**Non-Goals:**
- Edición de subcategoría (no existe; no se crea).
- Aviso de cambios sin guardar al cerrar un drawer dirty.
- Estado del drawer en la URL / interceptación de rutas.
- Borrar o redirigir las pages `/new`, `/[id]/edit`, `/[id]/subcategories/new`.
- Cambios en server actions, queries, RLS, o el primitivo `Drawer`.
- Cambiar el `confirm()` nativo de archivar/eliminar (queda como está).

## Decisions

### 1. Drawer hosteado con estado local, NO en la URL
Se sigue el patrón de `CreateAccountButton`: el trigger y el `<Drawer>` están colocados, el `open` es `useState` local, y el form remonta con `key` al abrir para resetear a estado limpio.
- **Por qué**: es el patrón ya validado en el repo; evita la complejidad de intercepting routes / `?drawer=` y mantiene el back-button con semántica normal (el drawer no es una entrada de historia).
- **Deep-link / reload / no-JS**: lo sirven las pages `/new` y `/edit` conservadas. Un link directo a `…/new` abre la page con `variant="page"`; el flujo principal usa el drawer.
- **Alternativa descartada**: estado en URL (`?create=1` o parallel/intercepting routes). Da reload/back "gratis" pero diverge de accounts/cards, agrega superficie y no lo pide el diseño.

### 2. Refetch del listado vía `router.refresh()` en éxito de drawer
Los forms hoy hacen `router.push('/settings/categories')` al éxito, lo que refresca el árbol RSC como efecto colateral de navegar. En `variant="drawer"` no hay navegación, así que el handler de éxito SHALL llamar `router.refresh()` (web) antes/después de `onSuccess()` para que el server component del listado re-fetchee.
- **Por qué**: sin esto, el listado queda stale tras crear/editar — el bug más fácil de introducir en esta migración.
- **Mobile**: las queries van directo a Supabase desde el cliente; el éxito SHALL re-disparar el fetch de la lista (refetch/estado) en vez de `router.back()`.

### 3. Forms con `variant: 'page' | 'drawer'`, un solo origen
Cada form (`create-category-form`, `edit-category-form`, `create-subcategory-form`) acepta `variant` + callbacks, igual que `CreateAccountForm`. La page los monta en `variant="page"` (comportamiento idéntico al actual: `router.push` al éxito). El drawer los monta en `variant="drawer"` con `onClose`/`onSuccess`.
- **Por qué**: un único componente de form evita drift entre la versión page y la drawer; es exactamente lo que hizo accounts.

### 4. Subcategoría: botón propio, no abstracción compartida
`CreateSubcategoryButton` es un trigger separado de `CreateCategoryButton` porque necesita el `category_id` del path. No se extrae un `<EntityCreateButton>` genérico.
- **Por qué**: regla `feedback_reusable_components` (no abstraer antes de tiempo); accounts/cards/categories duplican el pequeño trigger en vez de abstraerlo. La duplicación real es baja y la divergencia (categoryId, labels) la haría una abstracción con fugas.

### 5. Edit-drawer solo en filas propias
El trigger de `Editar` en `category-row.tsx` ya está dentro del bloque `!isSystem`; solo se cambia el `<Link href="…/edit">`/`router.push` por la apertura del edit-drawer. Las categorías de sistema siguen sin acción de editar. Ownership no se reimplementa: es estructural en el row + enforced por RLS/server action.

### 6. Mobile: bottom-sheet con `components/ui/Drawer`, rutas como fallback
Las listas/filas mobile abren el form en `ui/Drawer` (sheet) en vez de `router.push`. Los screens `new.tsx`/`edit.tsx`/`subcategories/new.tsx` se conservan para deep-link. El back físico de Android SHALL cerrar el sheet (no popear el screen del listado). Mismos nombres de componente que web, impl RN idiomática (`feedback_cross_platform_components`).

## Risks / Trade-offs

- **Listado stale tras mutar (web)** → Mitigación: `router.refresh()` obligatorio en el `onSuccess` del drawer; cubierto por un scenario de spec ("Guardar cierra el drawer y refresca el listado").
- **Drift entre page y drawer** → Mitigación: un solo componente de form con `variant`; la page reusa el mismo origen.
- **Android back popea el screen en vez de cerrar el sheet (mobile)** → Mitigación: el sheet intercepta el back físico mientras está abierto; scenario de spec mobile lo fija.
- **Reintroducir edición de subcategoría por inercia del patrón** → Mitigación: Non-Goal explícito + ausencia de form de edit-subcategoría; el drawer de subcategoría es create-only.
- **Romper el fallback no-JS** → Mitigación: las pages mantienen `variant="page"` con su `router.push` actual; no se tocan sus handlers.
- **Cerrar un drawer dirty descarta cambios sin avisar** → Aceptado (paridad con accounts/cards); es un Non-Goal documentado.
