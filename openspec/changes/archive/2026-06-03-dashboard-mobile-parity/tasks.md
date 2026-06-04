# Tasks: dashboard-mobile-parity

## 1. Estado de mes + header nativo

- [x] 1.1 Crear `DashboardMonthContext.tsx` nativo (`DashboardMonthProvider` + `useDashboardMonth`), espejo del contrato web: `selected`/`current`/`isCurrent`/`goPrev?`/`goNext?`, límite 12 meses
- [x] 1.2 Montar el provider en el shell `dashboard.tsx` (compartiendo el remount-por-key del eye-mask para resetear mes al salir del tab)
- [x] 1.3 Re-stylar `MonthNavigator` nativo como pill blanca (espejo del monthsel web: card con flechas + label bold capitalizado) y moverlo al header navy debajo del saludo, ocupando el ancho, consumiendo el context

## 2. Fila superior: Para gastar + Dónde está

- [x] 2.1 Crear `MaskedAmountDisplay` nativo (decimales en `Text` anidado a ~50% con opacidad, prefijo de signo, respeta eye-mask y show-cents)
- [x] 2.2 Reescribir `HeroSection` como card navy: eyebrow uppercase, ARS grande con `MaskedAmountDisplay`, chip USD, caption al pie con bloque de importes centrado; `Pressable` → `/accounts`
- [x] 2.3 Crear `AccountsCard` ("Dónde está"): mismas filas que web (`AccountAvatar` + nombre + ARS, cero atenuado, máx 6, fila "En dólares" emerald, "Ver todas" → `/accounts`), consumiendo `useDashboardHero()` (dedupe por queryKey con el Hero)
- [x] 2.4 Rehacer `HeroSkeleton` (bloques translúcidos sobre navy) y crear `AccountsCardSkeleton`, ambos con `SkeletonBlock` en swap region de alto estable

## 3. Balance del mes

- [x] 3.1 Reescribir `MonthBalanceSection`: header con título + "vas {neto} este mes" (mes en curso desde el cache de `useMonthBalanceSeries(current)`, color por signo, enmascarable); cuerpo eyebrow BALANCE + neto `MaskedAmountDisplay` + filas Ingresos/Gastos con barras proporcionales (mayor = 100%) + strip USD siempre visible
- [x] 3.2 Conectarla al `useDashboardMonth` (la query por mes seleccionado ya existe); recalibrar `SWAP_MIN_HEIGHT` y rehacer `MonthBalanceSkeleton` a la nueva anatomía
- [x] 3.3 Eliminar `MonthBalanceChart.tsx` y sus imports

## 4. En qué se fue

- [x] 4.1 Crear `SpendingDonut` nativo (`react-native-svg`: `Circle` strokeDasharray/strokeDashoffset derivados de `slice.percentage`; colores `slice.color` con fallback `cat-*` desde `@grana/ui-tokens/tokens`; centro overlay "GASTOS" + total enmascarable)
- [x] 4.2 Crear `SpendingSection`: `useMonthCategoryBreakdown` por mes seleccionado + `buildCategorySlices` (`topN: 5`, "Otros") con relabel de categorías sistema/uncategorized; leyenda dot + nombre + `MaskedAmount` + %; `Segmented` ARS/USD local sin refetch; filas y "Ver desglose" → `/transactions`; vacío neutral in-card
- [x] 4.3 Crear `SpendingSkeleton` (anillo + ~5 filas con `SkeletonBlock`) y eliminar `CategoryTeaser` + `CategoryTeaserSkeleton`

## 5. Shell y bajas coordinadas

- [x] 5.1 Actualizar `dashboard.tsx`: secciones Hero → Dónde está → Balance → En qué se fue; eliminar montaje de `WelcomeFirstMoveCard` y `UpcomingFortnightSection`; conservar pull-to-refresh ligado al gesto y FAB
- [x] 5.2 Eliminar `UpcomingFortnightSection`, `UpcomingFortnightSkeleton`, `WelcomeFirstMoveCard` y los hooks `useUpcomingFortnight`/`useHasMovements` de `apps/mobile/lib/dashboard/queries.ts`
- [x] 5.3 Retirar de `@grana/dashboard`: `getUpcomingFortnight`, `hasUserMovements`, `buildUpcomingFortnight`, tipos `Upcoming*` y sus tests; actualizar `src/index.ts`
- [x] 5.4 Borrar keys huérfanas `dashboard.upcoming.*` y `dashboard.welcome_card.*` de `es.json`/`en.json`; verificar que no queden referencias (`grep` en ambas apps)

## 6. Verificación y cierre

- [x] 6.1 `pnpm --filter mobile typecheck` + `pnpm --filter web typecheck` + `pnpm lint` verdes; grep de hex inline en componentes nuevos (no debe haber)
- [ ] 6.2 (DIFERIDO al tech lead, post-merge) QA visual en Expo: tres secciones, dona con tramos correctos, selector de mes en header navy, barras proporcionales, eye-mask completo, pull-to-refresh, reset de mes/ojo al cambiar de tab
- [ ] 6.3 (DIFERIDO al tech lead, post-merge) QA funcional: navegación Hero/Ver todas → cuentas, leyenda/Ver desglose → movimientos, mes no afecta "Para gastar", toggle ARS/USD sin refetch
- [x] 6.4 `pnpm openspec:check` (Git Bash) + `openspec validate` del change pasan (pre-archive)
