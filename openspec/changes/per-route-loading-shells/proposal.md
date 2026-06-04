## Why

Hoy, al navegar a `/dashboard` o `/transactions` (incluido el redirect desde `/login`), el usuario ve un spinner full-screen en vez del header + skeletons que la spec `route-loading-and-errors` ya promete. Tanto la regla del header del dashboard ("el header SHALL renderizarse desde el primer paint sin esperar al fetch del contenido", `dashboard` spec) como el requirement de in-page chrome (`route-loading-and-errors`) están violadas por la implementación actual:

1. `apps/web/app/(app)/loading.tsx` es un `<RouteLoading />` (spinner `size=lg` centrado) que actúa como fallback para CUALQUIER segmento del shell que suspenda. Tapa el header antes de que el page llegue a renderizar.
2. `apps/web/app/(app)/dashboard/page.tsx` es `async` y awaitea `getEyeMasked()` antes de devolver JSX → suspende el segmento entero. El header (que vive DENTRO del page) nunca llega a pintar antes del fallback.
3. `apps/web/app/(app)/transactions/page.tsx` también es `async` por su auth check defensivo, suspendiendo el segmento por el mismo motivo aunque el shell de transactions sea client.

Las dos variantes de in-page chrome ya specceadas (Variant A: server components + Suspense en page; Variant B: shell cliente + TanStack Query) son válidas, pero requieren que el `page.tsx` sea sync para no caer en el segment-level loading. El refactor introduce y aplica una **Variant C** más idiomática de Next: chrome en `layout.tsx` por ruta + skeletons en `loading.tsx` por ruta.

## What Changes

- **AGREGAR** `apps/web/app/(app)/dashboard/layout.tsx` (server component async) que aloja `EyeMaskProvider` + `DashboardHeader` y renderiza `{children}` debajo. Aquí se mueve el `await getEyeMasked()`.
- **AGREGAR** `apps/web/app/(app)/dashboard/loading.tsx` que renderiza los skeletons shape-matched del contenido (`HeroSkeleton`, `UpcomingFortnightSkeleton`, `MonthBalanceSkeleton`, `CategoryTeaserSkeleton`) en la misma disposición que `DashboardContent`. Reemplaza el spinner full-screen para esta ruta.
- **MODIFICAR** `apps/web/app/(app)/dashboard/page.tsx` para que sea un Server Component **sync** que solo retorna `<DashboardContent />` (más el FAB cuando aplica). Sin `async`, sin awaits top-level. El `EyeMaskProvider` ya no vive aquí.
- **AGREGAR** `apps/web/app/(app)/transactions/layout.tsx` (server component, sync o async según el header que se monte) que aloja el header de transactions (el que hoy es parte de `TransactionsShell`) y renderiza `{children}`.
- **AGREGAR** `apps/web/app/(app)/transactions/loading.tsx` con skeletons del contenido de transactions (filtros + lista).
- **MODIFICAR** `apps/web/app/(app)/transactions/page.tsx` para que sea sync. Eliminar el auth check duplicado (el `(app)/layout.tsx` ya lo cubre). El page queda como wrapper trivial del shell client.
- **BORRAR** `apps/web/app/(app)/loading.tsx`. El fallback global de shell deja de existir; cada ruta provee su propio `loading.tsx` (las que aún no lo hagan caerán en el comportamiento default de Next, que mantiene visible la ruta anterior durante la transición — aceptable para rutas placeholder).
- **MANTENER** `apps/web/app/(app)/error.tsx` sin cambios (sigue cubriendo errores que ocurran fuera del wrapper de cada ruta).
- **MANTENER** los skeletons internos de las secciones del dashboard (`<Suspense>` por sección con su skeleton shape-matched) — ya están bien y siguen siendo el mecanismo principal de loading **dentro** del page una vez que el segmento renderiza.
- **MANTENER** el comportamiento del header del dashboard descripto en la spec `dashboard`: header sync desde el primer paint, profile name fetched client-side con disabled controls hasta resolver. Lo único que cambia es la **ubicación del provider**: pasa de `page.tsx` a `layout.tsx`.

## Capabilities

### New Capabilities
- _(ninguna nueva)_

### Modified Capabilities
- `route-loading-and-errors`: agregar **Variant C** ("chrome en layout segregado por ruta + loading.tsx por ruta") al requirement de in-page chrome, y suavizar la regla de `(app)/loading.tsx` para permitir su ausencia cuando todas las rutas del grupo adoptan in-page chrome. Actualizar la lista de casos aprobados para `/dashboard` (pasa de Variant A a Variant C) y para `/transactions` (sigue como Variant B en cuanto a la composición de secciones, pero el chrome del header pasa a Variant C — un layout.tsx por ruta que aloja el header del shell). Mantener los casos `/accounts` y `/accounts/[id]` sin cambios.
- `dashboard`: actualizar el requirement del header para reflejar que `EyeMaskProvider` y `DashboardHeader` se montan desde `dashboard/layout.tsx` (no desde `page.tsx`). Mantener inalterado el contrato de UX (header sincrónico desde el primer paint, estado de carga del nombre, controles disabled durante loading). Agregar un scenario que verifique que el header sigue visible cuando se navega entre rutas hermanas del shell.

## Impact

**Código:**
- `apps/web/app/(app)/loading.tsx` (borrado)
- `apps/web/app/(app)/dashboard/layout.tsx` (nuevo)
- `apps/web/app/(app)/dashboard/loading.tsx` (nuevo)
- `apps/web/app/(app)/dashboard/page.tsx` (sync, sin awaits top-level)
- `apps/web/app/(app)/transactions/layout.tsx` (nuevo)
- `apps/web/app/(app)/transactions/loading.tsx` (nuevo)
- `apps/web/app/(app)/transactions/page.tsx` (sync, sin auth duplicado)
- Posiblemente `apps/web/app/(app)/transactions/_components/transactions-shell.tsx` para extraer su header (si hoy lo monta el shell client) y reubicarlo en el layout.

**APIs/dependencias:** Ninguna. Solo refactor de la jerarquía de archivos del App Router.

**Out of scope (explícito):**
- El cuello de botella real del redirect `/login → /dashboard`: el `await supabase.auth.getUser()` del `(app)/layout.tsx` bloquea ANTES de cualquier loading.tsx del shell. Ese costo es independiente del refactor; no se ataca acá.
- Rutas `/accounts`, `/accounts/[id]`, `/cards`, `/settings`: mantienen su comportamiento actual. Pueden migrarse a Variant C en cambios posteriores si aporta.
- Mobile (`apps/mobile`): sin cambios.
