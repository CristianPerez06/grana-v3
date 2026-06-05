## Why

El alta de movimiento en web vive en dos superficies que renderizan el mismo `MovementForm`: un drawer lateral scoped a `/transactions` y la ruta `/transactions/new`. Un usuario puede dispararlas en simultáneo (abrir el drawer y luego navegar a `/transactions/new` desde el header del dashboard, account detail o card detail), terminando con dos instancias del formulario activas al mismo tiempo, dos success paths divergentes (drawer: close + refresh; page: push returnHref) y trabajo de servidor duplicado en cada cold-load. Todos los call-sites ya prefieren el drawer y solo caen al `<Link href="/transactions/new">` cuando `useMovementDrawer()` devuelve `null` (provider scoped) — el drawer ya es de facto la UX primaria. Sin usuarios reales no hay bookmarks, deep-links ni SEO que proteger en `/transactions/new`: la ruta se elimina en vez de degradarse a fallback (mantenerla preservaría exactamente la divergencia que motiva este change).

## What Changes

- **BREAKING** Eliminar la ruta `/transactions/new` (`page.tsx`, `loading.tsx`, `_components/`); deja de existir como URL navegable.
- **BREAKING** Cambiar el contrato de "URL canónica por movimiento": el alta ya no tiene URL; el detalle (`/transactions/[txId]`) y la edición (`/transactions/[txId]/edit`) siguen siendo URLs canónicas.
- Mover el `MovementDrawerLoader` desde `apps/web/app/(app)/transactions/layout.tsx` hacia adentro de `AppShell`, envolviendo solo el slot `{children}`. La data de `accounts/categories/household` y el provider del drawer pasan a estar disponibles en todo el árbol `(app)`.
- Reubicar el componente compartido `MovementForm` desde `app/(app)/transactions/new/_components/` a `apps/web/lib/transactions/components/movement-form.tsx`, eliminar su branch `variant="page"` y la prop `createReturnHref`.
- Convertir todos los entry points de alta (FAB mobile-web, header del dashboard desktop, account detail, card header actions, card detail, transactions header, empty state) a `useMovementDrawer().openCreate(preselectedAccountId?)`. Sin `<Link>` fallback a `/transactions/new`.
- Estandarizar el visual cold-load de los CTAs (cuando `useMovementDrawer()` está brevemente `null` durante la primera hidratación): los CTAs renderizan el estado `disabled` del componente compartido `@/components/ui/button` (sin envolver `<Link>`). Como parte del cleanup, `RegisterMovementButton` y `QuickAddFab` pasan de ser `<button>` crudos a componer sobre `Button`; se agrega la size `fab` al `Button` para hospedar al FAB. La opacity literal del estado disabled la define el design system, no la spec.
- Acotar el alcance de `from=`: eliminar los generadores del lado de creación (`resolveReturnHref`, prop `createReturnHref`, y los 3 generadores `?from=account:<id>` / `?from=card:<id>` que hoy apuntan a `/transactions/new`). Los readers en `/transactions/[txId]` y `/transactions/[txId]/edit` y los 2 generadores que apuntan al detalle (list-to-detail desde account/card) **no** se tocan.
- Simplificar el success path: cerrar el drawer + `router.refresh()`; eliminar `router.push(returnHref)` y todo el plumbing de `from=` en el form.

## Capabilities

### New Capabilities

(ninguna — el alta de movimiento ya está cubierta por la spec `transactions`.)

### Modified Capabilities

- `transactions`: cambia el modelo de alta de **canonical-route + drawer optativo** a **drawer-only**; se elimina `/transactions/new` como URL navegable; el web FAB y el empty state pasan a abrir el drawer en vez de navegar; se quitan los scenarios de "guardar desde /transactions/new respeta `?from=`" y el reader de `?from=` en la ruta de alta; los readers de `?from=` en detalle y edición quedan intactos. Se agrega un requirement nuevo sobre el mount del `MovementDrawerLoader` a nivel app-shell.
- `dashboard`: el botón "Nuevo movimiento" del header desktop pasa de `<Link href="/transactions/new">` a un trigger del drawer; el estado disabled durante la carga del header se redefine en función de la disponibilidad del drawer (no de un link).

Las specs `accounts` y `cards` no tienen requirements que especifiquen la URL ni la presentación del CTA de alta (solo prosa general "accesos directos para agregar un nuevo movimiento") — el cambio de `<Link>` a opener del drawer en account detail y card detail es implementación pura, no requiere delta de spec. La spec `web-app-shell` describe el sidebar y el shell de navegación pero no la composición de providers/loaders que cuelgan de él; el nuevo requirement de mount del loader vive en `transactions` donde se especifica el drawer.

## Impact

**Código afectado** (apps/web):
- Eliminadas: `app/(app)/transactions/new/page.tsx`, `app/(app)/transactions/new/loading.tsx`, `app/(app)/transactions/new/_components/` (movement-form se reubica).
- Reubicadas: `MovementForm` → `lib/transactions/components/movement-form.tsx` (pierde `variant="page"` y `createReturnHref`).
- Modificadas: `app/(app)/_components/app-shell.tsx` (host del loader), `app/(app)/transactions/layout.tsx` (deja de hostear el loader), `app/(app)/transactions/_components/movement-drawer-loader.tsx` (sin cambios de lógica; solo se mueve su mount), `app/(app)/dashboard/_components/dashboard-header.tsx`, `app/(app)/accounts/[id]/_components/account-detail-content.tsx`, `app/(app)/cards/[id]/_components/card-header-actions.tsx`, `app/(app)/cards/[id]/page.tsx`, `app/(app)/transactions/_components/movement-list-container.tsx`, `app/(app)/transactions/_components/transactions-header.tsx`, `lib/transactions/components/register-movement-button.tsx`, `lib/transactions/components/quick-add-fab.tsx`.
- Eliminadas: `resolveReturnHref` helper, prop `createReturnHref` en `MovementForm`, prop `from` propagada por el form de alta.

**Specs**: deltas en `transactions`, `dashboard`, `accounts`, `cards`, `web-app-shell`. Los specs `route-loading-and-errors`, `overlay-primitives`, `i18n`, `mobile-app-shell` no se tocan (mobile y los primitives son ortogonales). Las menciones del native FAB a `/transactions/new` (capability `transactions`) se mantienen — la app nativa sigue marcando esa ruta como destino futuro y este change no la habilita.

**APIs / data**: ninguna. Server actions de creación de movimiento (`createIncome`, `createExpense`, `registerInstallments`, …) y orquestadores en `@grana/transactions-mutations` no cambian. El hook compartido `@grana/movement-form` no cambia.

**i18n**: ningún key se elimina. Las claves del page header de `/new` (`transactions.actions.register_movement`, `transactions.back_label`, `transactions.drawer.*`) son compartidas con el drawer.

**Dependencias / build**: ninguna.

**Tests**: no hay e2e/Playwright tocando `/transactions/new`. Tests unitarios que importan `MovementForm` desde la ruta vieja pasan a importar desde su nueva ubicación.
