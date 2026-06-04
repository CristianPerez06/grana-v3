# Proposal: dashboard-mobile-parity

## Why

El rediseño del dashboard (`redesign-dashboard-home`, mergeado 2026-06-03) se implementó solo en web: la app nativa (Expo) sigue mostrando el diseño anterior (Hero claro, "Lo que viene", gráfico de línea, teaser de categorías). La spec del dashboard quedó bifurcada por plataforma con la deuda explícita de paridad. Este change la salda: el dashboard nativo queda **idéntico en composición y comportamiento** al web rediseñado (decisión de producto: paridad estricta).

## What Changes

- **Solo `apps/mobile` + specs + limpieza del package compartido.** La web no se toca.
- El dashboard nativo pasa a las tres secciones del rediseño:
  1. **"Para gastar · hoy"** como card navy (eyebrow, ARS titular con decimales reducidos, chip USD, caption) + **`AccountsCard` "Dónde está"** (cuentas con `AccountAvatar` + saldo ARS, cero atenuado, máx 6, fila final "En dólares" en emerald, link "Ver todas" → cuentas). En mobile van apiladas (una columna).
  2. **"Balance del mes"**: neto grande con signo/color + filas Ingresos/Gastos con barras proporcionales + strip USD siempre visible; línea "vas {neto} este mes" (mes en curso) en el header de la card. **Se elimina `MonthBalanceChart` nativo** (el gráfico de línea deja de existir en el producto).
  3. **"En qué se fue"**: dona en `react-native-svg` (strokes circulares, colores de categoría de DB con fallback `--cat-*`) + leyenda con montos y porcentajes + `Segmented` ARS/USD; filas y "Ver desglose" navegan a Movimientos. **Reemplaza al `CategoryTeaser` nativo.**
- **Selector de mes compartido**: `MonthNavigator` se muda al header navy de la pantalla; un context nativo espejo de `DashboardMonthProvider` gobierna Balance + En qué se fue (no afecta "Para gastar"). El estado sigue siendo local (no URL/persistencia, 12 meses atrás, flecha derecha disabled en mes actual).
- **BREAKING (mobile UI):** se eliminan de la app nativa `UpcomingFortnightSection`, `WelcomeFirstMoveCard`, `CategoryTeaser` y sus skeletons (paridad estricta con web).
- **Limpieza de `@grana/dashboard`**: con ambas plataformas sin consumidores, se retiran `getUpcomingFortnight`, `hasUserMovements`, `buildUpcomingFortnight` y los tipos `Upcoming*` (+ sus tests). Las keys i18n `dashboard.upcoming.*` y `dashboard.welcome_card.*` se eliminan de los catálogos.
- **Skeletons nativos** rehechos shape-matched a la nueva anatomía componiendo `SkeletonBlock`.
- Se conservan: header navy con status bar light (identidad nativa), eye-mask con reset al salir del tab, pull-to-refresh ligado al gesto, carga independiente por sección sin layout shift (TanStack Query por sección).

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `dashboard`: des-bifurcación de la spec — los requirements del diseño viejo tagged `(mobile)` ("Lo que viene" y sus totales, gráfico de línea con navegador local) se **eliminan**; los requirements del rediseño web se reescriben plataforma-neutral (composición, Hero navy, "Dónde está", Balance neto+barras, "En qué se fue", selector de mes compartido, skeletons, eye-mask); el requirement del package compartido pierde las queries de upcoming/welcome; el naming espejo vuelve a ser un set único sin componentes single-platform.
- `spending-by-category`: el requirement del dashboard se re-unifica — ambas plataformas muestran "En qué se fue" (dona + leyenda con montos + toggle, participa del eye-mask); el teaser de proporciones deja de existir.

## Impact

- **Código**: `apps/mobile/app/(app)/dashboard.tsx` (shell), `apps/mobile/components/dashboard/*` (rediseño + bajas + skeletons), `apps/mobile/lib/dashboard/queries.ts` (hooks de upcoming/welcome fuera), `packages/dashboard/src/` (queries/aggregations/tipos retirados + tests), `packages/i18n-messages` (keys nuevas ya existen del change web; se borran las huérfanas).
- **Sin cambios de schema/DB.** El data layer compartido ya alimenta todo (`getDashboardHero` trae el desglose por cuenta; `getMonthCategoryBreakdown` ambas monedas).
- **Web**: cero cambios de código; solo specs compartidas reescritas.
- **Riesgo de regresión**: el type-check de web vigila que la limpieza del package no rompa imports (`pnpm --filter web typecheck` además del de mobile).
