## 1. Web — skeletons + wiring

- [x] 1.1 Crear `apps/web/app/(app)/dashboard/_components/hero-skeleton.tsx` derivando shape de `hero-section.tsx` (bloque headline ARS + bloque sub-line USD; en `lg`, opcional el rail con avatar+label+amount × `MAX_BREAKDOWN_ACCOUNTS`). Wrapper con `aria-busy="true"` + `aria-label` desde `dashboard.hero_loading`. Usar `bg-muted animate-pulse rounded-…` inline, sin componente wrapper. `min-h-[10rem]` matcheado al real (`hero-section.tsx`).
- [x] 1.2 Crear `apps/web/app/(app)/dashboard/_components/upcoming-fortnight-skeleton.tsx`. Shape: título + N filas (date+label+amount) en dos grupos ("a pagar" / "a cobrar") + barra total. `min-h-[20rem]` matcheado al fallback actual. `aria-label` desde `dashboard.upcoming.loading`.
- [x] 1.3 Crear `apps/web/app/(app)/dashboard/_components/month-balance-skeleton.tsx`. Shape: header (título + nav stub) + bloque chart 200px + footer multi-bloque (balance + ingresos + gastos). `min-h-[26rem]`. `aria-label` desde `dashboard.month.loading`.
- [x] 1.4 Crear `apps/web/app/(app)/dashboard/_components/category-teaser-skeleton.tsx`. Shape: título + "ver desglose" link stub + ~3 filas con label+bar+%. `min-h-[8rem]`. `aria-label` desde `dashboard.spending.loading`.
- [x] 1.5 Editar `apps/web/app/(app)/dashboard/_components/dashboard-content.tsx`: reemplazar los 4 `<SectionFallback message=… className=…/>` por los 4 nuevos skeletons como `fallback` de cada `<Suspense>`. No tocar el `<Suspense fallback={null}>` del `WelcomeFirstMoveCardContainer`. **Adicionalmente** se reemplazaron los usos de `SectionFallback` en los 4 containers (rama de error) por inline divs equivalentes, y se cableó `MonthBalanceBodySkeleton` en el branch `status==='loading'` de `MonthBalanceSection`.
- [x] 1.6 Verificar con `grep -rn "SectionFallback" apps/web/` que dashboard ya no lo importa. **Hallazgo durante implementación:** `accounts/` y `cards/` también lo usan; `SectionFallback` queda como utility compartida fuera del dashboard.
- [~] 1.7 ~~Borrar `apps/web/components/ui/section-fallback.tsx`.~~ **No aplica** — el archivo permanece (consumers fuera del dashboard).

## 2. Mobile — primitivo `SkeletonBlock`

- [x] 2.1 Crear `apps/mobile/components/ui/SkeletonBlock.tsx`. Envuelve un `Animated.View` de `react-native-reanimated` con `useSharedValue` + `useAnimatedStyle` loop de opacidad (~0.5 → ~1, ~1200 ms, ease-in-out). Acepta `className` (NativeWind). Base color: token del theme equivalente a `bg-muted` (leer `@grana/ui-tokens/theme.css` y elegir el más cercano; probable `bg-border-soft`). Consulta `useReducedMotion()` de Reanimated y mantiene opacidad estática ~0.7 cuando está activado.
- [~] 2.2 ~~Sanity-check del primitivo en device~~ — diferido a 7.4 (verificación end-to-end en la app real).

## 3. Mobile — skeletons por sección

- [x] 3.1 Crear `apps/mobile/components/dashboard/HeroSkeleton.tsx`. Shape derivado de `HeroSection.tsx`: 1 bloque headline (~`h-9 w-44`) + 1 bloque sub-line (~`h-3.5 w-24 mt-1`). El wrapper compone dentro del swap region (no incluye el chrome de card). `accessibilityState={{ busy: true }}` + `accessibilityLabel` desde `dashboard.hero_loading`.
- [x] 3.2 Crear `apps/mobile/components/dashboard/UpcomingFortnightSkeleton.tsx`. Shape derivado del `UpcomingBody` real: 2 mini-headers ("a pagar"/"a cobrar") + ~2 filas por grupo (date stub + label + amount) + barra total. `accessibilityLabel` desde `dashboard.upcoming.loading`.
- [x] 3.3 Crear `apps/mobile/components/dashboard/MonthBalanceSkeleton.tsx`. Shape: 1 bloque chart (`h-[200px] w-full rounded-md`) + 2–3 mini-bloques en footer (balance final, ingresos, gastos). Sin reproducir el polyline. `accessibilityLabel` desde `dashboard.month.loading`.
- [x] 3.4 Crear `apps/mobile/components/dashboard/CategoryTeaserSkeleton.tsx`. Shape: ~3 filas (label + barrita progresiva + `%`). `accessibilityLabel` desde `dashboard.spending.loading`.

## 4. Mobile — cablear skeletons en cada sección

- [x] 4.1 `apps/mobile/components/dashboard/HeroSection.tsx`: reemplazar el `<View><Spinner size="lg"/></View>` del branch pending por `<HeroSkeleton/>`. Mantener intactos el chrome de card, el `SWAP_MIN_HEIGHT`, los branches `data` y `query.isError`.
- [x] 4.2 `apps/mobile/components/dashboard/UpcomingFortnightSection.tsx`: misma operación con `<UpcomingFortnightSkeleton/>`.
- [x] 4.3 `apps/mobile/components/dashboard/MonthBalanceSection.tsx`: misma operación con `<MonthBalanceSkeleton/>`.
- [x] 4.4 `apps/mobile/components/dashboard/CategoryTeaser.tsx`: misma operación con `<CategoryTeaserSkeleton/>`.
- [x] 4.5 Verificar que `Spinner` ya no se importa en ninguna de las 4 secciones. Si queda huérfano en `components/ui/`, dejarlo (puede tener otros consumers fuera del dashboard).

## 5. Mobile — cleanup

- [x] 5.1 Verificar con `grep -rn "SectionFallback" apps/mobile/` que dashboard mobile ya no lo importa. **Hallazgo durante implementación:** `mobile/app/(app)/cards.tsx` lo usa; el archivo permanece como utility compartida fuera del dashboard.
- [~] 5.2 ~~Borrar `apps/mobile/components/dashboard/SectionFallback.tsx`.~~ **No aplica** — el archivo permanece (consumers fuera del dashboard).

## 6. i18n

- [x] 6.1 Revisar las 4 keys (`dashboard.hero_loading`, `dashboard.upcoming.loading`, `dashboard.month.loading`, `dashboard.spending.loading`) en `packages/i18n-messages/`. Si el wording actual ("Cargando tu disponible…") no funciona bien como `aria-label`, ajustar el texto sin renombrar la key. No agregar keys nuevas.

## 7. Verificación

- [x] 7.1 `pnpm typecheck` desde la raíz limpia.
- [x] 7.2 `pnpm lint` desde la raíz limpia.
- [x] 7.3 Correr el dev server web (`pnpm --filter @grana/web dev`) y throttlear network a "Slow 3G" en DevTools para ver los 4 skeletons en `/dashboard`. Verificar: shape-match, animate-pulse, `min-h` matcheado al real, label en el inspector de accesibilidad, streaming independiente por sección.
- [x] 7.4 Correr la app mobile (`pnpm --filter @grana/mobile start`) en un device/simulador. Verificar los 4 skeletons en `/dashboard` durante el cold start. Validar `prefers-reduced-motion` activando "Reduce Motion" en el OS.
- [x] 7.5 Correr el scenario "Navegar de mes en Balance del mes" en mobile: el `MonthBalanceSkeleton` aparece en swap region sin disparar el `RefreshControl` superior.
- [x] 7.6 `openspec validate add-dashboard-section-skeletons --strict` desde la raíz.

## 8. Cierre

- [x] 8.1 Squashear los commits de la rama feature con un único commit `type(scope): subject` (sin body, sin trailer — convención del repo).
- [x] 8.2 Dejar la rama lista para que el usuario haga el merge a `main` (NO mergear).
