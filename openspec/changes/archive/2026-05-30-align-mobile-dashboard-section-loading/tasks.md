# Tareas — Alinear el modelo de carga del dashboard mobile con el de web

> Refactor estructural sobre `apps/mobile`. El patrón de referencia es `MonthBalanceSection` (ya implementado): cada sección posee su query y su loading/error in-card sobre un alto estable. No toca web ni el data-layer.

## Grupo 1 · Header desde el primer paint

- [x] 1.1. `DashboardHeader` absorbe `useProfileFirstName()`; se elimina la prop `name` (queda `todayISO`). Saludo anon por defecto, se actualiza al resolver la query; la fecha sigue de `getTodayAR()`.
- [x] 1.2. Verificar que el `eye toggle` queda montado en el header desde el primer paint (sin gate previo).

## Grupo 2 · Hero y "Lo que viene" absorben su query

- [x] 2.1. `HeroSection` absorbe `useDashboardHero()`; chrome (label) siempre visible; región de importes en un swap spinner / error+retry / datos sobre `minHeight` estable (modelo `MonthBalanceSection`). Quita la prop `data`.
- [x] 2.2. `UpcomingFortnightSection` absorbe `useUpcomingFortnight(today)` (recibe `today` por prop); mismo swap in-card sobre `minHeight`. Quita la prop `data`.
- [x] 2.3. Reusar las keys i18n existentes para loading/error (`dashboard.hero_loading`/`hero_error`, `dashboard.upcoming.loading`/`.error`) y `error.retry_action` para el botón de reintento.

## Grupo 3 · WelcomeFirstMoveCard auto-gateada

- [x] 3.1. `WelcomeFirstMoveCard` absorbe `useHasMovements()`: renderiza `null` mientras pending o si hay movimientos; se materializa solo con `=== false`. Acepta el shift breve al aparecer.

## Grupo 4 · Shell puro

- [x] 4.1. Eliminar el gate de spinner a pantalla completa (`initialLoading` + el `return` con `<Spinner/>`).
- [x] 4.2. Eliminar del shell los hooks `useDashboardHero`/`useUpcomingFortnight`/`useHasMovements`/`useProfileFirstName` y el render condicional `data ? … : null`; dejar el shell colocando `<WelcomeFirstMoveCard/>`, `<HeroSection/>`, `<UpcomingFortnightSection today/>`, `<MonthBalanceSection/>`.
- [x] 4.3. `RefreshControl.refreshing` ligado al gesto: estado local seteado en `onRefresh`, liberado cuando `invalidateQueries({ queryKey: ['dashboard'] })` resuelve. NO usar `useIsFetching(['dashboard'])` (cuenta fetches section-local como `balance-series` y enciende el refresh al navegar de mes).
- [x] 4.4. Confirmar que la lógica `useFocusEffect` + `eyeMaskKey` queda intacta envolviendo el árbol.

## Grupo 5 · Verificación

- [x] 5.1. `pnpm --filter mobile typecheck` y lint OK (firmas de props nuevas propagadas).
- [x] 5.2. Verificación manual en device/simulator: shell + header visibles desde el primer paint; cada sección muestra su spinner in-card y luego sus datos sin layout shift; una query lenta no bloquea a las demás; pull-to-refresh muestra el indicador; salir del tab y volver resetea el eye toggle.
- [x] 5.3. Caso fallo parcial: forzar error en una query (p. ej. Upcoming) y confirmar que solo esa sección muestra error+retry mientras las demás funcionan.
- [x] 5.4. `pnpm openspec:check` OK.
