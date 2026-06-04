# Tasks: redesign-dashboard-home

## 1. Tokens e i18n

- [x] 1.1 Agregar `--cat-6` (ámbar) y `--cat-7` (rosa) a `packages/ui-tokens/src/theme.css` (`:root` + `@theme inline`), tonalmente alineados a la familia `--cat-*` existente
- [x] 1.2 Agregar keys nuevas en `packages/i18n-messages` (es + en): eyebrow/caption del Hero "Para gastar · hoy", título y fila USD de "Dónde está", "vas {amount} este mes", título/centro/vacío de "En qué se fue" (`dashboard.spending.*`), aria-label `dashboard.spending.loading` si cambia el texto

## 2. Estado de mes compartido + header

- [x] 2.1 Crear `dashboard-month-context.tsx` (`DashboardMonthProvider` + `useDashboardMonth`): `{year, month}` inicial del server (`getTodayAR()`), límite 12 meses atrás, helpers prev/next/isCurrent
- [x] 2.2 Montar el provider en `page.tsx` (dentro de `EyeMaskProvider`) pasando el mes actual server-derived
- [x] 2.3 Mover `MonthNavigator` al `DashboardHeader` consumiendo el context; disabled durante el loading-state del header; flecha derecha disabled en mes actual
- [x] 2.4 Subtítulo del header: "{fecha} · vas {neto} este mes" con neto ARS del mes en curso vía `fetchMonthBalanceSeries` client-side, color por signo, `MaskedAmount`, fallback a solo-fecha mientras carga o si falla

## 3. Fila superior: Para gastar + Dónde está

- [x] 3.1 Rediseñar `HeroSection` como card navy (`bg-surface-dark`): eyebrow uppercase, monto ARS grande con decimales reducidos, chip "USD" + monto, caption `mt-auto`; sigue linkeando a `/accounts`; sin desglose de cuentas
- [x] 3.2 Crear `AccountsCard` ("Dónde está"): filas `AccountAvatar` + nombre + monto ARS (cero atenuado), máx 6 cuentas, fila final "En dólares" emerald con el total USD, link "Ver todas" → `/accounts`
- [x] 3.3 Reescribir `hero-section-container.tsx` para renderizar el grid `lg:grid-cols-[1.15fr_1fr]` con ambas cards desde una sola llamada a `getDashboardHero`
- [x] 3.4 Actualizar `HeroSkeleton` a la nueva anatomía (dos cards lado a lado, min-height matcheado)

## 4. Balance del mes

- [x] 4.1 Reescribir `MonthBalanceSection`: eyebrow BALANCE + neto ARS grande (signo/color), filas Ingresos/Gastos con dot + monto + barra proporcional (mayor = 100%, otra escala; cero = vacías), strip USD siempre visible (chip + neto + detalle)
- [x] 4.2 Conectar la sección al `useDashboardMonth`: mes actual server-rendered (`initialData`), mes no-actual vía `fetchMonthBalanceSeries` con skeleton/error in-card (adaptar el patrón existente)
- [x] 4.3 Actualizar `MonthBalanceSkeleton` a la nueva anatomía (neto + 2 filas con barra + strip)
- [x] 4.4 Eliminar `month-balance-chart.tsx` + su story de `apps/web` y limpiar imports

## 5. En qué se fue

- [x] 5.1 Crear `spending-donut.tsx`: dona SVG (strokes circulares, técnica de `AnimatedDonut`) con tramos derivados de `slice.percentage`, colores `slice.color` con fallback `--cat-*`, centro "GASTOS" + total enmascarable
- [x] 5.2 Crear `SpendingSection` (client) + `spending-section-container.tsx`: `buildCategorySlices` con `topN: 5` + "Otros", labels vía `translateCategoryLabel`, leyenda con dot + nombre + `MaskedAmount` + %, filas linkean al desglose de Movimientos por categoría/moneda, `Segmented` ARS/USD local sin refetch, estado vacío neutral in-card
- [x] 5.3 Conectar al `useDashboardMonth` (mes no-actual vía `getMonthCategoryBreakdownAction` con skeleton/error in-card)
- [x] 5.4 Crear `SpendingSkeleton` (bloque circular + ~5 filas) y eliminar `category-teaser*.tsx` de web

## 6. Composición de página y bajas

- [x] 6.1 Reescribir `dashboard-content.tsx`: fila superior → Balance → En qué se fue, cada una en su `<Suspense>` con su skeleton; gap 4 (16px)
- [x] 6.2 Eliminar de web `upcoming-fortnight-*` y `welcome-first-move-card*` (componentes + containers + skeleton) y sus imports; verificar que `@grana/dashboard` siga exportando las queries para mobile
- [x] 6.3 Revisar layout responsive completo (1440px / 820px / 375px): apilado bajo `lg`, dona centrada en mobile, sin overflow del navegador de mes en el header

## 7. Verificación y cierre

- [x] 7.1 `pnpm lint` + `pnpm build` (web) verdes; grep de hex inline nuevos en componentes (no debe haber)
- [x] 7.2 Storybook: stories de `MonthNavigator`/`MaskedAmount` siguen pasando; eliminar story del chart; agregar story de `SpendingDonut` si aporta
- [x] 7.3 Verificación visual contra el handoff (`docs/design/design_handoff_dashboard_inicio/dashboard-inicio.html`) con datos reales: jerarquía, espaciados, tabular-nums, formato AR
- [x] 7.4 QA funcional de interacciones: selector de mes (no toca "Para gastar"), toggle ARS/USD, eye-mask completo (incl. subtítulo y centro de la dona), links (Ver todas, leyenda, Nuevo movimiento/FAB)
- [x] 7.5 `pnpm openspec:check` pasa (pre-archive)
