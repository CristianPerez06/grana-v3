## Why

Las rutas bajo `/settings` están desalineadas con el patrón de chrome persistente (Variant C) que ya rige en `/dashboard`, `/transactions`, `/accounts`, `/cards` y `/shared`. Esto produce dos regresiones visuales puntuales y verificables:

1. **El header parpadea como skeleton durante el loading.** `/settings/categories` y `/settings/categories/[id]/subcategories` son pages async (`createClient`, `getCategoryById`, `getSubcategoriesByCategoryId`, `getTranslations`). Mientras Next.js resuelve esos awaits, el segmento entero suspende y cae en `(app)/settings/loading.tsx`, que renderiza `<PageHeaderSkeleton />` además del cuerpo. En cambio, las rutas alineadas a Variant C montan el header en su `layout.tsx` y nunca lo desmontan — solo el cuerpo se reemplaza por skeletons. Esto contradice el requirement existente *"Una ruta de apps/web puede optar por loading y error in-page para mantener su chrome visible"* (spec `route-loading-and-errors`).

2. **El botón "Agregar" no usa el primitivo `Button`.** Tanto `categories/page.tsx` como `subcategories/page.tsx` renderizan la acción como:

   ```tsx
   <Link className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">…</Link>
   ```

   Esto viola directamente el requirement *"Las acciones tipo botón componen el primitivo `Button`, no recrean su estilo"* (spec `project-conventions`, línea 748): re-tipea inline las clases del Button en un `<Link>`. La regla canónica para acciones que navegan es `<Button asChild><Link href=…>…</Link></Button>`.

El resto de las pages bajo `/settings/**` (root, `new`, `edit`, `subcategories/new`) también renderizan `PageHeader` inline y, aunque no muestren el síntoma de parpadeo con la misma intensidad (porque son más livianas), su header tampoco persiste entre transiciones internas y no expone la regla canónica.

Este change alinea **todo** `(app)/settings/**` al patrón Variant C (decisión A3) usando un `SettingsHeader` para `/settings` y un `CategoriesHeader` dedicado para `/settings/categories/**` (decisión B3). La migración de la acción "Agregar" a un drawer modal (paridad UX con `accounts`) queda **fuera de scope** y se trackea como exploration aparte en `explore-categories-drawer-migration`.

## What Changes

- **AGREGAR** `apps/web/app/(app)/settings/_components/settings-header.tsx`: client component que renderiza `<PageHeader title={t('settings.title')} />` SOLO si `usePathname() === '/settings'`. Retorna `null` en cualquier otra ruta bajo `(app)/settings/**` (esto evita el doble-header cuando el segmento anidado de `categories` monta su propio `CategoriesHeader`).
- **AGREGAR** `apps/web/app/(app)/settings/layout.tsx`: monta `<SettingsHeader />` + `{children}` en un flex container.
- **AGREGAR** `apps/web/app/(app)/settings/categories/_components/categories-header.tsx`: client component que conmuta por `usePathname()` y, cuando aplica, `useParams()`:
  - `/settings/categories` → `title="Categorías"`, `description`, `actions=<Button asChild><Link href="/settings/categories/new"><Plus />…</Link></Button>`
  - `/settings/categories/new` → `title="Nueva categoría"`, `description`, `backLink → /settings/categories`
  - `/settings/categories/[id]/edit` → `title="Editar categoría"`, `description = category.name || ' '`, `backLink`
  - `/settings/categories/[id]/subcategories` → `title="Subcategorías"`, `description = category.name || ' '`, `backLink`, `actions=<Button asChild><Link href={…/subcategories/new}>…</Link></Button>`
  - `/settings/categories/[id]/subcategories/new` → `title="Nueva subcategoría"`, `description = category.name || ' '`, `backLink`
- **AGREGAR** `apps/web/app/(app)/settings/categories/layout.tsx`: monta `<CategoriesHeader />` + `{children}`.
- **MODIFICAR** `apps/web/app/(app)/settings/page.tsx`: remover el `<PageHeader>` inline (lo provee el layout).
- **MODIFICAR** `apps/web/app/(app)/settings/categories/page.tsx`: remover `<PageHeader>` y `<Link "Agregar">` inline. Queda con `<CategoryList />` y los wrappers de layout que necesite.
- **MODIFICAR** `apps/web/app/(app)/settings/categories/new/page.tsx`: remover `<PageHeader>` inline.
- **MODIFICAR** `apps/web/app/(app)/settings/categories/[id]/edit/page.tsx`: remover `<PageHeader>` inline.
- **MODIFICAR** `apps/web/app/(app)/settings/categories/[id]/subcategories/page.tsx`: remover `<PageHeader>` y `<Link "Agregar">` inline.
- **MODIFICAR** `apps/web/app/(app)/settings/categories/[id]/subcategories/new/page.tsx`: remover `<PageHeader>` inline.
- **MODIFICAR** `apps/web/app/(app)/settings/loading.tsx`: eliminar `<PageHeaderSkeleton />`. El loading queda solo con los body skeletons (`SectionSkeleton` × N).
- **AGREGAR** `apps/web/app/(app)/settings/categories/loading.tsx`: skeletons shape-matched del cuerpo de la lista de categorías (sin header — lo provee el layout).
- **AGREGAR** opcionalmente `apps/web/app/(app)/settings/categories/[id]/subcategories/loading.tsx` si el body skeleton específico ayuda a la transición.
- **NO** se agregan claves i18n para el placeholder de descripción dinámica. La `description` mientras `category.name` no resuelve es un non-breaking space (`' '`) — un placeholder vacío que reserva la altura de la línea para evitar reflow del título, sin mostrar feedback textual al usuario.

## Capabilities

### New Capabilities
- _(ninguna nueva)_

### Modified Capabilities
- `route-loading-and-errors`: agregar `/settings` y `/settings/categories/**` a la lista de rutas aprobadas para Variant C, con scenarios que validen (a) el header persiste durante el loading del cuerpo, (b) el header conmuta correctamente entre sub-rutas sin remontaje del segmento de layout, (c) la descripción dinámica de las rutas con `[id]` muestra el placeholder "Cargando..." hasta resolver `category.name`.

## Impact

**Código:**
- `apps/web/app/(app)/settings/layout.tsx` (nuevo)
- `apps/web/app/(app)/settings/_components/settings-header.tsx` (nuevo)
- `apps/web/app/(app)/settings/categories/layout.tsx` (nuevo)
- `apps/web/app/(app)/settings/categories/_components/categories-header.tsx` (nuevo)
- `apps/web/app/(app)/settings/categories/loading.tsx` (nuevo)
- `apps/web/app/(app)/settings/loading.tsx` (modificado: quitar `PageHeaderSkeleton`)
- 6 pages bajo `/settings/**` (modificados: quitar `PageHeader` inline y, en dos casos, `<Link "Agregar">` inline)

**APIs / queries:** ninguno nuevo. `CategoriesHeader` consume el helper que ya usa la página (`getCategoryById` o equivalente cliente) para la descripción dinámica. Si hace falta exponer una variante cliente del helper, se hace en este change.

**i18n:** posiblemente una clave nueva `common.loading` o `settings.categories.loading` para el placeholder de descripción. Sin breaking changes en claves existentes.

**Out of scope (explícito):**
- **Migrar las acciones "Agregar categoría" / "Agregar subcategoría" a un drawer modal** (paridad UX con `accounts`/`cards`). Tracked en el change separado `explore-categories-drawer-migration`. En este change, las acciones siguen siendo links que navegan a `/new` — solo cambia el envoltorio visual a `<Button asChild>`.
- **Mobile** (`apps/mobile/app/settings/`): sin cambios. Los headers nativos ya siguen su propio patrón (PageHeader custom en cada pantalla).
- **`SettingsClient`** y otros componentes del cuerpo de `/settings`: sin cambios.
