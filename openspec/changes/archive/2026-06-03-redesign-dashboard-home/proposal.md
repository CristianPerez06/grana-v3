# Proposal: redesign-dashboard-home

## Why

El dashboard web actual creció por acumulación de secciones (Hero, Lo que viene, Balance con gráfico de línea, teaser de categorías) y no responde con jerarquía clara las tres preguntas centrales del usuario: ¿cuánto tengo para gastar hoy y dónde está?, ¿cómo vengo este mes?, ¿en qué se me fue? Existe un handoff de diseño hi-fi (`docs/design/design_handoff_dashboard_inicio/`) que reorganiza la pantalla alrededor de esas tres preguntas, con identidad visual más fuerte (card oscura "Para gastar", dona de categorías) y el selector de mes promovido al header.

## What Changes

- **Web only.** El dashboard mobile no se toca en este change (queda con sus secciones actuales; la paridad es trabajo futuro).
- La pantalla `/dashboard` web pasa a **tres secciones en orden fijo**:
  1. **Fila superior**: card oscura navy "Para gastar · hoy" (ARS titular + USD como chip secundario) junto a la card "Dónde está" (todas las cuentas cash/bank ordenadas por saldo ARS desc, con la tenencia USD como fila final destacada y link "Ver todas" → `/accounts`).
  2. **"Balance del mes"** rediseñado: neto grande del mes + filas Ingresos/Gastos con barras proporcionales calculadas de los datos + strip USD con el neto e ingresos/gastos USD del mes. **Reemplaza el gráfico de línea acumulada en web** (el chart y su spec quedan solo mobile).
  3. **"En qué se fue"**: dona (`conic-gradient` calculado de los datos) + leyenda con monto y porcentaje por categoría + toggle ARS/USD (`Segmented`). **Reemplaza al teaser de 3 categorías en web**; muestra montos, por lo que participa del eye-mask.
- **El selector de mes se muda al header** del dashboard (web): un único navegador `‹ Mes Año ›` que afecta "Balance del mes" y "En qué se fue" en simultáneo y **no** afecta "Para gastar" (que siempre es hoy). Estado client-side compartido, no URL.
- El subtítulo del header incorpora el neto del mes en curso ("… · vas **+$X** este mes").
- **BREAKING (web UI):** se desconectan del dashboard web la sección "Lo que viene" y la `WelcomeFirstMoveCard` (fidelidad estricta al handoff). Las queries (`getUpcomingFortnight`, `hasUserMovements`) permanecen en `@grana/dashboard` porque mobile las sigue consumiendo.
- Tokens: se agregan a `@grana/ui-tokens` los matices faltantes de la paleta de categorías del handoff (ámbar, rosa). Se mapean los hex del handoff a los tokens existentes (el código manda sobre el handoff).
- Shell intacto: sidebar, topbar mobile, drawer y FAB quedan como están. Sin bottom-nav.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `dashboard`: composición de secciones web (sale "Lo que viene" y la welcome card, entra "Dónde está" y "En qué se fue"), nuevo layout desktop (fila superior 2 columnas + 2 cards full-width), header con selector de mes compartido y neto del mes en el subtítulo, Hero web como card oscura "Para gastar · hoy" con desglose movido a card propia, "Balance del mes" web sin gráfico de línea (neto + barras + strip USD), skeletons web actualizados a la nueva anatomía. Los requirements de chart/navegador local y "Lo que viene" quedan tagged `(mobile)`.
- `spending-by-category`: el requirement del teaser del dashboard se bifurca por plataforma — en web el dashboard pasa a mostrar el desglose como dona + leyenda con **montos** y toggle ARS/USD (participa del eye-mask); en mobile sigue el teaser de proporciones sin montos.

## Impact

- **Código**: `apps/web/app/(app)/dashboard/_components/*` (rediseño de secciones, nuevos componentes, eliminación de containers de upcoming/welcome del árbol web), `apps/web/app/(app)/dashboard/page.tsx`, `packages/ui-tokens/src/theme.css` (tokens nuevos), `packages/i18n-messages` (keys nuevas/ajustadas).
- **Sin cambios de schema/DB** ni de queries en `@grana/dashboard` (se reusa `getDashboardHero`, `getMonthBalanceSeries`, `getMonthCategoryBreakdown`; el fetch por mes reusa el patrón server-action existente).
- **Mobile**: sin cambios de código; sus scenarios en specs se preservan re-tagged donde web diverge.
- **Storybook**: stories de los componentes rediseñados que ya tenían story (`month-balance-chart` sale del lado web, `month-navigator`, `masked-amount` se mantienen).
