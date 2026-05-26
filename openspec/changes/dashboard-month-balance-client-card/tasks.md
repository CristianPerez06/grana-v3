## 1. Web — server action y dato inicial

- [ ] 1.1 Crear server action `fetchMonthBalanceSeries(year, month): Promise<MonthBalanceSeries>` en `apps/web/app/_actions/dashboard.ts` ('use server'), que cree el server client de Supabase y delegue en `getMonthBalanceSeries(supabase, year, month)` de `@grana/dashboard`.
- [ ] 1.2 En `apps/web/app/(app)/dashboard/page.tsx`, dejar de derivar el mes de `?month=` para esta sección; calcular el mes actual con `getTodayAR()` y pasar a la tarjeta `initialData` (serie del mes actual ya server-rendered), `initialYear` e `initialMonth`. Retirar el uso de `parseMonthParam`/`searchParams` si queda huérfano del dashboard.

## 2. Web — tarjeta como componente cliente con estado de mes

- [ ] 2.1 Convertir `apps/web/app/(app)/dashboard/_components/month-balance-section.tsx` en componente cliente (`'use client'`) que posee `{ year, month }` en estado local, inicializado con `initialYear/initialMonth`, y `data` inicial = `initialData`.
- [ ] 2.2 Implementar la máquina de estados `status: 'idle' | 'loading' | 'error'`: en prev/next computar el nuevo mes, pasar a `loading`, invocar `fetchMonthBalanceSeries`, y resolver a `idle` (con `data`) o `error`. Añadir guard de concurrencia con token monotónico (`useRef`) para descartar respuestas fuera de orden.
- [ ] 2.3 Renderizar siempre título + navegador; intercambiar solo el área gráfico+footer entre `loading` (spinner), `error` (mensaje compacto + reintentar) y `idle` (gráfico + footer). El reintento re-ejecuta el action para el mes seleccionado.
- [ ] 2.4 Conservar el tamaño de la tarjeta: el contenedor intercambiable mantiene `flex-1` dentro de la `<section> flex h-full flex-col` y centra spinner/error, sin colapsar el alto.

## 3. Web — navegador y fix de overflow

- [ ] 3.1 Cambiar el contrato de `apps/web/app/(app)/dashboard/_components/month-navigator.tsx`: reemplazar `prevHref/nextHref` (`<Link>`) por `onPrev?`/`onNext?` (botones con `onPress`-style); `undefined` ⇒ flecha deshabilitada.
- [ ] 3.2 Aplicar el fix de overflow en el header: título de la sección `min-w-0` + `truncate`, navegador `shrink-0`, reducir el `min-w` del label del mes, y `overflow-hidden` en la `<section>` como red de seguridad.
- [ ] 3.3 Verificar manualmente entre 1024–1088px de viewport que la flecha derecha queda dentro de la tarjeta y el título trunca en vez de desbordar.

## 4. Mobile — tarjeta self-contained con estado de mes

- [ ] 4.1 En `apps/mobile/components/dashboard/MonthBalanceSection.tsx`, mover el mes a estado local (`useState` inicializado al mes actual con `getTodayAR()`) y llamar internamente a `useMonthBalanceSeries(year, month)`.
- [ ] 4.2 Cambiar el contrato de `apps/mobile/components/dashboard/MonthNavigator.tsx`: reemplazar `prevHref/nextHref` (Expo Router `Link`) por `onPrev?`/`onNext?` en `Pressable`; `undefined` ⇒ flecha deshabilitada.
- [ ] 4.3 Derivar los estados in-card del resultado del hook: `isPending && !data` ⇒ loading (spinner sobre gráfico+footer); `error && !data` ⇒ error compacto con `onRetry = refetch`; con `data` ⇒ ready (no parpadear en refetch con data cacheada). Título + navegador siempre visibles.
- [ ] 4.4 Conservar el tamaño de la tarjeta: el área intercambiable usa `min-height` = (alto del gráfico + alto del footer) y centra spinner/error.

## 5. Mobile — screen

- [ ] 5.1 En `apps/mobile/app/(app)/dashboard.tsx`, dejar de derivar el mes de `useLocalSearchParams` y dejar de condicionar el render de la tarjeta a `monthSeries.data`: renderizar `<MonthBalanceSection />` siempre (autogestiona su carga/error).
- [ ] 5.2 Quitar `monthSeries` de la condición `initialLoading` (cada sección autogestiona su carga) y del tracking del `RefreshControl`; conservar `onRefresh` invalidando la raíz `['dashboard']` (refetchea la query activa de la tarjeta).

## 6. i18n y verificación

- [ ] 6.1 Asegurar claves i18n para el error/reintento de la tarjeta en `packages/i18n-messages` (reutilizar `dashboard.month.error`; añadir label de reintento si no existe) en es y en.
- [ ] 6.2 Verificación funcional web: cambiar de mes no recarga la página, spinner solo en gráfico+footer, estado de error con reintento, tamaño de tarjeta estable, flecha derecha sin overflow a 1024–1088px.
- [ ] 6.3 Verificación funcional mobile: cambiar de mes no desmonta la tarjeta, loading/error in-card, tamaño estable, mes cacheado se muestra sin spinner.
- [ ] 6.4 `pnpm lint` (web) y typecheck de ambos apps en verde; `pnpm openspec:check` en verde.
