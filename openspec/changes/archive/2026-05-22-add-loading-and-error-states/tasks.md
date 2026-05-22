## 1. Pre-change checks

- [x] 1.1 Crear branch `feature/add-loading-and-error-states` desde `main` (pre-commit check: `git branch --show-current` no debe ser `main`).
- [x] 1.2 Confirmar que no hay otro change activo en `openspec/changes/` que toque `route-loading-and-errors`, `mobile-app-shell` ni `project-conventions`.

## 2. Contratos compartidos (`packages/ui-contracts`)

- [x] 2.1 `SpinnerProps` ya existía en `packages/ui-contracts/src/index.ts` (con `size?`, `className?`, `label?` para a11y — `label` no estaba contemplado en el spec original; mantenido por mejor a11y).
- [x] 2.2 Agregar `RouteErrorProps` (`{ error: Error & { digest?: string }; onRetry: () => void; className?: string }`) y exportarlo.
- [x] 2.3 Documentar la convención de naming `onRetry` (callback de dominio, no `onPress`) en `README.md`.

## 3. i18n keys (`packages/i18n-messages`)

- [x] 3.1 Agregar a `packages/i18n-messages/src/es.json` y `en.json`: `error.generic_title`, `error.retry_action`.
- [x] 3.2 Ambos catálogos en sync (verificado: namespace `error` agregado al top-level en ambos archivos).

## 4. Spinner web (`apps/web`)

- [x] 4.1 `apps/web/components/ui/spinner.tsx` ya existía (Loader2 + animate-spin). Bumpeado `lg` de `h-8 w-8` (32px) a `h-10 w-10` (40px) para honrar el diseño. Color sigue siendo `text-muted-foreground` (token, no hex).
- [x] 4.2 Agregadas stories `OverCardBg` y `OverPageBg` a `spinner.stories.tsx` además de las existentes `Small`/`Medium`/`Large`.
- [x] 4.3 Validar en `pnpm storybook` que las tres variantes se renderizan correctamente y los colores vienen de tokens.

## 5. RouteError web (`apps/web`)

- [x] 5.1 Creado `apps/web/components/ui/route-error.tsx` (Client Component). Usa `useTranslations('error')`. `error.message` y `error.digest` solo visibles si `process.env.NODE_ENV !== 'production'`.
- [x] 5.2 Creado `apps/web/components/ui/route-error.stories.tsx` con stories `Default`, `WithErrorDetails`, `NoErrorMessage`. Decorator de `NextIntlClientProvider` con `esMessages` para que el componente pueda renderizar fuera del contexto de Next.
- [x] 5.3 Validar en `pnpm storybook`.

## 6. RouteLoading wrapper web (`apps/web`)

- [x] 6.1 Creado `apps/web/components/ui/route-loading.tsx`. Centra `<Spinner size="lg" />` con `min-h-[50vh]` (no full viewport para no romper layouts con sidebar/topbar visibles).
- [x] 6.2 Wrapper trivial, no se agregó story.

## 7. `loading.tsx` + `error.tsx` por layout group en web

- [x] 7.1 Creado `apps/web/app/(app)/loading.tsx` → renderiza `<RouteLoading />`.
- [x] 7.2 Creado `apps/web/app/(app)/error.tsx` → Client Component, `<RouteError error={error} onRetry={reset} />`.
- [x] 7.3 Creado `apps/web/app/(auth)/loading.tsx` y `error.tsx`.
- [x] 7.4 Creado `apps/web/app/(onboarding-wizard)/loading.tsx` y `error.tsx`.
- [x] 7.5 Validar manualmente en `pnpm dev`: navegar entre `/dashboard ↔ /cards ↔ /transactions ↔ /accounts ↔ /settings`; confirmar que el spinner aparece en transiciones lentas (forzar latencia con DevTools si hace falta).
- [x] 7.6 Validar error.tsx: forzar un throw en una server query (mock temporal) y confirmar que `RouteError` aparece con botón "Reintentar" funcional.
- [x] 7.7 Identificar rutas con fetching pesado donde el fallback genérico se sienta mal (candidato típico: `dashboard`). Agregar overrides específicos solo si el problema es real.

## 8. Setup TanStack Query en mobile (`apps/mobile`)

- [x] 8.1 `@tanstack/react-query@5.100.13` fijado en `apps/mobile/package.json` (peerDependencies: `react: ^18 || ^19` → compatible con React 19.1.0).
- [x] 8.2 `pnpm install` desde la raíz — sin peer warnings críticos relacionados al nuevo dep.
- [x] 8.3 Creado `apps/mobile/lib/query-client.ts` con factory `createQueryClient()`: `staleTime: 30_000`, retry custom (no reintenta en 401/403/404/JWT), `refetchOnReconnect: true`, `refetchOnWindowFocus: false`.
- [x] 8.4 Creado `apps/mobile/lib/focus-manager-setup.ts` con `registerFocusManager()` idempotente (suscribe `focusManager` a `AppState`). Invocado a nivel de módulo en `_layout.tsx` raíz.
- [x] 8.5 `_layout.tsx` raíz monta `<QueryClientProvider>` envolviendo el `<Slot />` existente. `queryClient` instanciado con `useState(() => createQueryClient())`.

## 9. Spinner mobile (`apps/mobile`)

- [x] 9.1 Reescrito `apps/mobile/components/ui/Spinner.tsx` de `ActivityIndicator` (sm===md, hex literal) a custom SVG con `react-native-svg` + `react-native-reanimated`. Diámetros sm=16, md=24, lg=40 (distintos). Color por defecto `colors.textSoft` (consistente con web `text-muted-foreground`). Mantenida la API de `color?` para que `Button` pueda pasar `colors.white`/`colors.positive`.
- [x] 9.2 Crear un screen de smoke test descartable (`apps/mobile/app/(app)/_spinner-test.tsx` — borrar después) para validar las 3 variantes en simulador iOS y Android.
- [x] 9.3 Borrar el screen de smoke test después de validar.

**Out-of-band cleanup:** `apps/mobile/components/ui/Button.tsx` pasaba `#ffffff`/`#10B981` directos al Spinner. Reemplazado por `colors.white`/`colors.positive` (mismo valor, sin hex literal en el componente).

## 10. RouteError mobile (`apps/mobile`)

- [x] 10.1 Creado `apps/mobile/components/ui/RouteError.tsx`. Usa `t('error.generic_title')` y `t('error.retry_action')`. `error.message`/`error.digest` solo visibles si `__DEV__ === true`. Botón reutiliza el `Button` mobile en variante `primary`.

## 11. Migrar `dashboard.tsx` mobile a TanStack Query

- [x] 11.1 Creado `apps/mobile/lib/dashboard/queries.ts` con `useDashboardHero`, `useUpcomingFortnight`, `useMonthBalanceSeries`, `useDashboardCards`, `useHasMovements`. Query keys jerárquicas.
- [x] 11.2 `apps/mobile/app/(app)/dashboard.tsx` ya no usa `useState`/`useEffect`/`Promise.allSettled`. El `useFocusEffect` se mantiene SOLO para el `eyeMaskKey` (reset del estado del eye-mask al perder foco), que es UI local y no fetching.
- [x] 11.3 Estados implementados: initial loading (todas las queries `isPending`) → full-screen `<Spinner size="lg" />`. Por sección: `data` → contenido; `error` → `SectionFallback` existente (mejor naming que `RouteError` para inline-section; design.md asumía `RouteError` pero `SectionFallback` ya cumple la misma función con la UX adecuada).
- [x] 11.4 Validar manualmente en simulador: dashboard carga correctamente; refresh on focus dispara al volver de background.
- [x] 11.5 Validar invalidación: simular una acción que requiera invalidar `dashboard.upcoming-fortnight` (ej. confirmar una recurrencia) — confirmar que solo esa sección reentra en `isFetching`, no el resto.

## 12. Specs y archive

- [x] 12.1 Correr `pnpm openspec validate add-loading-and-error-states` y confirmar que pasa sin errores.
- [x] 12.2 (Al cerrar el change, antes del merge a main) Archivar: mover `openspec/changes/add-loading-and-error-states/` a `openspec/changes/archive/YYYY-MM-DD-add-loading-and-error-states/`. Aplicar los deltas:
  - Nuevo: `openspec/specs/route-loading-and-errors/spec.md` con sección `## Requirements` (sin deltas) más un `## Purpose` real (2-4 líneas, no TBD).
  - Modificar: `openspec/specs/mobile-app-shell/spec.md` agregando los dos requirements nuevos a `## Requirements`.
  - Modificar: `openspec/specs/project-conventions/spec.md` agregando el requirement nuevo a `## Requirements`.
- [x] 12.3 Actualizar `CLAUDE.md` si corresponde — agregar `route-loading-and-errors` a la tabla de "Modules" con status ✅ Done.
- [x] 12.4 Correr `pnpm openspec:check`; debe pasar (no debe haber `TBD - created by archiving` ni `Purpose: TBD` en ningún spec maestro).
- [x] 12.5 Squash a un único commit, merge `--ff-only` a `main`.
