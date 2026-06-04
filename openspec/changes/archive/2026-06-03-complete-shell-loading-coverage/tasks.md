## 0. Pre-requisitos

- [x] 0.1 Verificar que `per-route-loading-shells` ya está archivado (`openspec list` no debe mostrarlo como activo). Si no lo está, hacer `/opsx:archive per-route-loading-shells` primero o pausar este change hasta que lo esté.
- [x] 0.2 Crear branch nuevo desde main para este change (después del archive del anterior).

## 1. Primitive compartido: PageHeaderSkeleton

- [x] 1.1 Crear `apps/web/components/ui/page-header-skeleton.tsx` con props `{ withAction?: boolean; withSubtitle?: boolean }`. Debe replicar la anatomía visual de `<PageHeader />` (title bar + opcional subtitle + opcional action button) con placeholders `bg-muted animate-pulse`.
- [x] 1.2 Verificar el componente en aislamiento (storybook o página de prueba ad-hoc) — confirmar que los anchos/altos coinciden razonablemente con el render real de `<PageHeader />`. ✓ verificado por el usuario en uso real.

## 2. /accounts — Variant C

- [x] 2.1 Crear `apps/web/app/(app)/accounts/_components/active-accounts-skeleton.tsx` shape-matched con `ActiveAccountsContainer` resuelto (grupo cash + grupo bank con N filas tipo `<AccountRow>` placeholder).
- [x] 2.2 Crear `apps/web/app/(app)/accounts/_components/archived-accounts-skeleton.tsx` shape-matched con el render típico de archivadas (sección colapsable con 1-2 filas placeholder).
- [x] 2.3 Crear `apps/web/app/(app)/accounts/layout.tsx` (server component sync) que monta `<AccountsHeader />` y renderiza `{children}`. Confirmar que no necesita ningún provider o fetch — el header es self-contained.
- [x] 2.4 Crear `apps/web/app/(app)/accounts/loading.tsx` que renderiza `<ActiveAccountsSkeleton />` + `<ArchivedAccountsSkeleton />` en la misma disposición vertical (`flex flex-col gap-6`) que el cuerpo del page.
- [x] 2.5 Modificar `apps/web/app/(app)/accounts/page.tsx`: eliminar el render de `<AccountsHeader />` (ahora vive en layout) y eliminar el `await supabase.auth.getUser()` + `redirect('/login')` (lo cubre `(app)/layout.tsx`). Mantener el scaffold de Suspense + `<AccountsErrorBoundary>`. **Decisión:** `getTranslations` se elimina del page por completo. Los Suspense fallbacks usan los nuevos skeletons shape-matched (mismos componentes que `loading.tsx`), que ya hacen su propio `getTranslations` para el aria-label. Los `SectionFallback` server-rendered por los containers de error siguen haciendo su `getTranslations` localmente (sin cambios). El page queda sync — single source of truth para skeletons entre transición de segmento y re-renders in-page.
- [x] 2.6 Verificar manualmente: navegar a `/accounts`, observar header instantáneo + skeletons en el cuerpo, transición sin spinner; navegar `/dashboard → /accounts` y confirmar persistencia del header. ✓ verificado por el usuario.

## 3. /cards — Variant C

- [x] 3.1 Crear `apps/web/app/(app)/cards/_components/cards-month-hero-skeleton.tsx` shape-matched.
- [x] 3.2 Crear `apps/web/app/(app)/cards/_components/wallet-skeleton.tsx` shape-matched (lista de cards activas con avatar + monto).
- [x] 3.3 Crear `apps/web/app/(app)/cards/_components/archived-cards-skeleton.tsx` shape-matched.
- [x] 3.4 Crear `apps/web/app/(app)/cards/layout.tsx` (server component sync) que monta `<CardsHeader />` y renderiza `{children}`.
- [x] 3.5 Crear `apps/web/app/(app)/cards/loading.tsx` que renderiza los tres skeletons en la disposición del cuerpo del page (`flex flex-col gap-6`).
- [x] 3.6 Modificar `apps/web/app/(app)/cards/page.tsx`: análogo al de accounts. Eliminar header, eliminar auth duplicado, mantener scaffold + `<CardsErrorBoundary>`. Mismo criterio que en accounts: page sync, sin `getTranslations`, Suspense fallbacks usan los nuevos skeletons como single source of truth.
- [x] 3.7 Verificar manualmente: navegar a `/cards`, observar header instantáneo + skeletons, transición sin spinner; navegar `/dashboard → /cards` y confirmar persistencia del header. ✓ verificado por el usuario.

## 4. /transactions/recurring — loading.tsx simple

- [x] 4.1 Crear `apps/web/app/(app)/transactions/recurring/loading.tsx` con `<PageHeaderSkeleton withAction />` + un skeleton de tabs (dos pills placeholder) + lista shape-matched de filas de recurrencia (5-7 rows tipo "ícono + label + monto").
- [x] 4.2 Verificar manualmente: navegar a `/transactions/recurring`, observar skeleton durante la transición (esta ruta tiene fetches pesados). ✓ verificado por el usuario.

## 5. /transactions/[txId] — loading.tsx simple

- [x] 5.1 Crear `apps/web/app/(app)/transactions/[txId]/loading.tsx` con `<PageHeaderSkeleton />` + tarjeta de detalle skeleton (avatar grande + monto principal + bloque de meta fields + sección "Reembolsos pendientes" placeholder).
- [x] 5.2 Verificar manualmente: desde la lista de movimientos, abrir un detalle y observar el skeleton durante la transición. ✓ verificado por el usuario.

## 6. /settings — loading.tsx simple

- [x] 6.1 Crear `apps/web/app/(app)/settings/loading.tsx` con `<PageHeaderSkeleton />` + bloques de SettingsSection skeleton (3-4 secciones con título + 2 filas cada una).
- [x] 6.2 Verificar manualmente: navegar a `/settings` y observar el skeleton durante la transición. ✓ verificado por el usuario.

## 7. /transactions/new — loading.tsx simple

- [x] 7.1 Crear `apps/web/app/(app)/transactions/new/loading.tsx` con `<PageHeaderSkeleton />` + bloque de form skeleton (label + input rows × 5-6, botón submit placeholder). Mantener el skeleton compacto — el form real tiene muchos campos pero la mayoría son de tamaño consistente; un set de 5-6 filas placeholder representa bien la silueta.
- [x] 7.2 Verificar manualmente: clickear "Nuevo movimiento" desde dashboard/transactions, observar skeleton durante la transición a `/transactions/new`. ✓ verificado por el usuario.

## 7B. /shared y sub-rutas — Variant C via route group

**Contexto:** `/shared` y sub-rutas quedaron fuera del proposal original. En el primer pase se les agregó solo `loading.tsx` (skeleton del header + body). En la verificación manual, el contraste con /accounts/cards (donde el header real se ve desde primer paint) quedó visible: el skeleton del header se ve unas décimas antes de saltar al PageHeader real. Se rehace como Variant C completa para las 4 rutas.

**Complicación de estructura:** un `/shared/layout.tsx` global pondría header duplicado en sub-rutas (que también tienen su PageHeader propio). Solución: **route group** `/shared/(home)/` para que home y sub-rutas sean segmentos paralelos, cada uno con su layout-with-header. Ningún header se hereda.

**Implementación:**

- [x] 7B.1 Crear directorio `apps/web/app/(app)/shared/(home)/`.
- [x] 7B.2 Crear `apps/web/app/(app)/shared/(home)/layout.tsx`: server async; `await getHousehold()` + `await getTranslations('shared')`; computa título dinámico (`household?.name ?? t('title')`) y acción (SettingsLink si hay household). Monta `<PageHeader>` arriba de `{children}` con wrapper `flex flex-col gap-6 max-w-lg`.
- [x] 7B.3 Mover `apps/web/app/(app)/shared/page.tsx` → `apps/web/app/(app)/shared/(home)/page.tsx`. Quitar el render del `<PageHeader>` inline y el wrapper outer `<div className="flex flex-col gap-6 max-w-lg">` (todo eso ahora en layout). Las tres ramas condicionales (sin household, sin partner, full) devuelven sus contenidos en fragmentos (`<>...</>`) o un nodo único, sin el wrapper outer.
- [x] 7B.4 Mover `apps/web/app/(app)/shared/loading.tsx` → `apps/web/app/(app)/shared/(home)/loading.tsx`. Quitar el `<PageHeaderSkeleton withAction />` y el wrapper outer (el header vive en el layout y persiste durante la transición). Quedan: balance card placeholder + lista de expenses placeholder, envueltos en fragment.
- [x] 7B.5 Borrar `apps/web/app/(app)/shared/page.tsx` y `apps/web/app/(app)/shared/loading.tsx` (ahora viven en el route group `(home)/`).
- [x] 7B.6 Crear `apps/web/app/(app)/shared/settings/layout.tsx`: server async; `await getHousehold()`, `redirect('/shared')` si no hay household (movido del page); `await getTranslations('shared')`; monta `<PageHeader title={t('settings.title')} backLink={{ href: '/shared', label: t('title') }} />` arriba de `{children}` con wrapper `flex flex-col gap-6 max-w-lg`.
- [x] 7B.7 Editar `apps/web/app/(app)/shared/settings/page.tsx`: quita PageHeader, quita redirect (ahora en layout). Page queda como wrapper trivial del `<SettingsForm />`; obtiene household via `getHousehold()` (deduped por Next dentro del mismo request).
- [x] 7B.8 Editar `apps/web/app/(app)/shared/settings/loading.tsx`: quita `<PageHeaderSkeleton />` y el wrapper outer. Queda solo el form skeleton.
- [x] 7B.9 Crear `apps/web/app/(app)/shared/settle/layout.tsx`: análogo a settings; awaitea household + getTranslations, redirect a `/shared` si no hay household o el household no tiene 2+ miembros (movido del page). Monta `<PageHeader title={t('settle.title')} backLink={...} />`.
- [x] 7B.10 Editar `apps/web/app/(app)/shared/settle/page.tsx`: quita PageHeader inline y los guards de household/partner (movidos al layout). Mantiene el auth check + el guard de "no owed currencies → redirect a /shared" (dependen del user id + debt, no del household per se).
- [x] 7B.11 Editar `apps/web/app/(app)/shared/settle/loading.tsx`: quita `<PageHeaderSkeleton />` y wrapper outer. Queda card de contexto + form skeleton.
- [x] 7B.12 Crear `apps/web/app/(app)/shared/setup/layout.tsx`: análogo; awaitea household + getTranslations, redirect a `/shared` si household existe. Monta `<PageHeader title={t('setup.title')} backLink={...} />`.
- [x] 7B.13 Editar `apps/web/app/(app)/shared/setup/page.tsx`: quita PageHeader y redirect (en layout). Queda como wrapper trivial del `<SetupForm />`. Page pasa de async a sync (no hay awaits restantes).
- [x] 7B.14 Editar `apps/web/app/(app)/shared/setup/loading.tsx`: quita `<PageHeaderSkeleton />` y wrapper outer. Queda solo el form skeleton.
- [x] 7B.15 Verificar manualmente: navegar `/dashboard → /shared` (header de home visible desde primer paint), `/shared → /shared/settings` (header de settings visible desde primer paint, sin "Compartido" duplicado encima), idem `/shared → /shared/settle` y `/shared → /shared/setup`. Todos los pages muestran skeleton del body durante el loading. ✓ verificado por el usuario.

## 8. Spec hygiene — Variant A

- [x] 8.1 Confirmar via grep que después de migrar `/accounts` y `/cards`, ningún `page.tsx` bajo `apps/web/app/(app)/` implementa el patrón de Variant A. **Resultado:** solo `accounts/page.tsx` y `cards/page.tsx` usan `<Suspense>` en todo el subárbol; ambos ahora son Variant C (header en layout.tsx, no inline en el page) con error boundary opcional. Los demás pages con `PageHeader` inline son monolíticos (sin Suspense), patrón estándar de "page hace su fetch y devuelve todo" — no es Variant A. Cero remanentes.

## 9. Validación y archive readiness

- [x] 9.1 Correr `pnpm typecheck` y `pnpm lint` en `apps/web`. Resolver cualquier issue. **Resultado:** ambos limpios.
- [x] 9.2 Correr `openspec validate complete-shell-loading-coverage --strict`. **Resultado:** `Change 'complete-shell-loading-coverage' is valid`.
- [x] 9.3 Verificar que `RouteLoading` (`apps/web/components/ui/route-loading.tsx`) sigue siendo consumido por `(auth)/loading.tsx` y `(onboarding-wizard)/loading.tsx`. **Resultado:** sí, ambos sigue consumiéndolo.
- [x] 9.4 Limpieza final: confirmar via grep que `AccountsHeader` y `CardsHeader` solo se importan desde sus respectivos `layout.tsx`. **Resultado:** `AccountsHeader` solo desde `accounts/layout.tsx`; `CardsHeader` solo desde `cards/layout.tsx`. Cero importadores residuales.
- [x] 9.5 Verificar manualmente los scenarios nuevos del spec `route-loading-and-errors` para Variant C (accounts y cards), y los scenarios actualizados de `accounts` y `cards` (header persiste durante navegación entre rutas hermanas). ✓ verificado por el usuario.
