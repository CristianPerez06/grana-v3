## 1. Dashboard — Variant C

- [x] 1.1 Crear `apps/web/app/(app)/dashboard/layout.tsx` como Server Component async. Mover `await getEyeMasked()` desde `page.tsx` a este layout. Montar `<EyeMaskProvider initialMasked={eyeMasked}>` envolviendo `<DashboardHeader todayISO={…} />` y `{children}`. Calcular `todayISO = formatDateISO(getTodayAR())` aquí. **Nota:** el wrapper `pb-24 sm:pb-0` (bottom padding para el FAB mobile) también se movió al layout envolviendo `{children}`, así `loading.tsx` lo aprovecha y los skeletons no quedan tapados por el FAB.
- [x] 1.2 Modificar `apps/web/app/(app)/dashboard/page.tsx`: remover `async`, eliminar el `await getEyeMasked()` y el cálculo de `todayISO` (ahora viven en el layout). Eliminar el render de `<EyeMaskProvider>` y `<DashboardHeader />`. Page final: `<><DashboardContent /><QuickAddFab /></>`.
- [x] 1.3 Crear `apps/web/app/(app)/dashboard/loading.tsx`. Render los skeletons shape-matched en la misma disposición que `DashboardContent` (Hero, grid de Upcoming/MonthBalance, CategoryTeaser). **Nota:** los skeletons son async server components que solo fetch traducciones; reusables directamente sin wrapper extra.
- [x] 1.4 Verificar manualmente: navegar a `/dashboard` y observar que el header aparece desde el primer paint, los skeletons del contenido aparecen abajo, y el contenido real reemplaza a los skeletons sin reemplazar al header. ✓ confirmado por el usuario
- [x] 1.5 Verificar manualmente: navegar `/transactions → /dashboard`. El header del dashboard aparece sin parpadeo del shell `(app)`, el contenido del dashboard transiciona vía skeletons. ✓ confirmado por el usuario

## 2. Transactions — Variant C para el header del módulo

- [x] 2.1 Auditar `apps/web/app/(app)/transactions/_components/transactions-shell.tsx`. **Hallazgos:** el header (`<TransactionsHeader>`) es client component que (a) usa `useQueries` de TanStack para gating del botón "Registrar movimiento" (necesita el QueryClient mounted en `(app)/layout.tsx` — disponible cualquiera sea su ubicación), y (b) consume `useMovementDrawer()` para abrir el drawer (necesita estar dentro de `<MovementDrawerLoader>`). El `FiltersProvider` solo lo necesitan secciones del cuerpo (lista, filtros), no el header.
- [x] 2.2 Decisión: mover al layout BOTH `<MovementDrawerLoader>` AND `<TransactionsHeader />`, con el flex wrapper (`flex max-w-3xl flex-col gap-6 pb-24 sm:pb-0`) envolviendo `[header, {children}]`. El `<FiltersProvider>` se queda en `TransactionsShell` (page-level) porque el header no lo necesita. Así el header preserva el comportamiento drawer-aware y el loading.tsx (que reemplaza `{children}`) también queda dentro del flex container, alineado bajo el header.
- [x] 2.3 Crear `apps/web/app/(app)/transactions/layout.tsx` (server sync) que monta `<MovementDrawerLoader>` envolviendo el flex container con `<TransactionsHeader />` y `{children}`.
- [x] 2.4 Modificar `apps/web/app/(app)/transactions/page.tsx`: page sync, sin auth check duplicado. JSDoc actualizado.
- [x] 2.5 Crear `apps/web/app/(app)/transactions/loading.tsx`. Reusa `MovementListSkeleton` (existente en `lib/transactions/components/`) + un `FiltersBarSkeleton` local (chips placeholder). No se crearon skeletons para los banners condicionales (recurrence-suggestion, pending-recurrences, etc.) porque solo se muestran cuando hay data y agregarían ruido visual durante el loading.
- [x] 2.6 Verificar manualmente: navegar a `/transactions` y observar que el header del módulo aparece desde el primer paint y los skeletons cubren el cuerpo durante la transición. ✓ confirmado por el usuario

**Side-effect del 2.x:** `transactions-content.tsx` perdió su outer wrapper (`MovementDrawerLoader` + flex div + header) — ahora renderiza las secciones como fragment, siendo siblings directos del header bajo el flex container del layout. JSDoc actualizado.

## 3. Eliminar el fallback global de `(app)`

- [x] 3.1 Borrar `apps/web/app/(app)/loading.tsx`. Confirmado: `RouteLoading` sigue siendo consumido por `apps/web/app/(auth)/loading.tsx` y `apps/web/app/(onboarding-wizard)/loading.tsx` → se mantiene `components/ui/route-loading.tsx`.
- [x] 3.2 Verificar manualmente que navegar a rutas SIN `loading.tsx` propio (ej. `/accounts`, `/cards`, `/settings`) mantenga la ruta anterior visible durante la transición (comportamiento default de Next sin loading.tsx). Confirmar que la URL cambia inmediatamente y que el shell sigue interactivo. ✓ confirmado por el usuario
- [x] 3.3 Mantener `apps/web/app/(app)/error.tsx` intacto. Verificar que sigue capturando errores forzados (test manual: throw-ear desde un component server bajo `(app)` momentáneamente y confirmar que se renderiza `<RouteError>`). **(requiere browser check del usuario — `error.tsx` no se tocó en este change, sigue intacto)**

## 4. Verificación de specs y archive readiness

- [x] 4.1 `pnpm typecheck` y `pnpm lint` pasan limpio en `apps/web` después del refactor.
- [x] 4.2 `openspec validate per-route-loading-shells --strict` → `valid`.
- [x] 4.3 Verificar manualmente los scenarios de `specs/route-loading-and-errors/spec.md` para Variant C. ✓ confirmado por el usuario
- [x] 4.4 Verificar manualmente los scenarios nuevos del spec `dashboard`. ✓ confirmado por el usuario
- [x] 4.5 Limpieza confirmada via grep: `DashboardHeader`, `EyeMaskProvider`, `getEyeMasked` solo se importan desde `dashboard/layout.tsx` (más el storybook legítimo de `masked-amount.stories.tsx` que sigue usando `EyeMaskProvider` como decorator). `TransactionsHeader` y `MovementDrawerLoader` solo se importan desde `transactions/layout.tsx`.
