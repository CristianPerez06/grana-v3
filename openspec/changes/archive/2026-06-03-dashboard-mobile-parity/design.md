# Design: dashboard-mobile-parity

## Context

El dashboard nativo (`apps/mobile/app/(app)/dashboard.tsx`) es un shell: header navy (`DashboardHeader` con saludo + eye toggle, `SafeAreaView`), `ScrollView` con pull-to-refresh ligado al gesto, y secciones que poseen su propia query TanStack (`apps/mobile/lib/dashboard/queries.ts`: `useDashboardHero`, `useMonthBalanceSeries`, `useMonthCategoryBreakdown`, `useUpcomingFortnight`, `useHasMovements`, `useProfileFirstName`) con swap region de alto estable (skeleton / error / data). El eye-mask se resetea al salir del tab vía remount por key.

El rediseño web ya mergeado define la composición objetivo y dejó listo lo reutilizable: data layer en `@grana/dashboard`, keys i18n nuevas (`dashboard.hero.eyebrow/caption`, `dashboard.accounts.*`, `dashboard.net_this_month`, `dashboard.spending.*`), tokens `--cat-6`/`--cat-7` ya presentes en `tokens.cjs` (el mirror que consume NativeWind vía `tailwind.config.js`). Primitivas nativas disponibles: `Card`, `Segmented`, `AccountAvatar`, `SkeletonBlock`, `Button`. `react-native-svg` 15.x ya es dependencia.

Restricciones: paridad estricta con web (decisión de producto); no tocar `apps/web`; el header navy + status bar light es identidad nativa y se conserva; NativeWind para clases, `lib/colors.ts` / `@grana/ui-tokens/tokens` para valores JS (props de SVG) — sin hex inline.

## Goals / Non-Goals

**Goals:**

- Dashboard nativo con la misma composición, datos y comportamiento que el web rediseñado.
- Eliminar del producto entero (y del package y los catálogos) lo que la paridad deja sin consumidores: upcoming, welcome card, chart de línea, teaser.
- Specs des-bifurcadas: una sola descripción plataforma-neutral con scenarios tagged solo donde el stack difiere.

**Non-Goals:**

- Tocar código web o el shell de navegación nativo (tabs, AppMenu).
- Storybook mobile (no existe).
- Cambiar el patrón de fetching nativo (TanStack por sección queda como está).

## Decisions

### D1 — Estado de mes: context nativo espejo (`DashboardMonthContext`)

Espejo de `dashboard-month-context.tsx` web: `DashboardMonthProvider` + `useDashboardMonth` en `apps/mobile/components/dashboard/`, mismo contrato (`selected`, `current`, `isCurrent`, `goPrev?`/`goNext?`, límite 12 meses). Se monta en el shell de la pantalla (junto a `EyeMaskProvider`, compartiendo el remount por key — el mes también resetea al salir del tab, igual que web al desmontar). `MonthBalanceSection` deja de poseer el mes en estado local y pasa a `useMonthBalanceSeries(selected.year, selected.month)` — el hook TanStack existente ya cachea por mes, no hace falta plumbing nuevo.

### D2 — Header: navy se conserva; `MonthNavigator` entra al header

El header navy con status bar light es requirement de identidad nativa y NO cambia. El `MonthNavigator` nativo se muda adentro del header (debajo del saludo, ocupando el ancho, como el layout mobile del handoff), re-stylado como pill blanca sobre navy (espejo del `monthsel` web: contenedor `bg-card` con flechas y label bold capitalizado). El eye toggle queda donde está. El subtítulo sigue siendo solo la fecha (el neto vive en la card Balance, igual que web).

### D3 — Fila superior: dos cards apiladas, una sola query

`HeroSection` se reescribe como card navy (`bg-navy` NativeWind; en el dashboard nativo la card navy convive con el header navy separada por el fondo de página, igual que el handoff mobile) con eyebrow/ARS/chip USD/caption. `AccountsCard` nueva consume **el mismo** `useDashboardHero()` — TanStack dedupe por queryKey garantiza un solo fetch (equivalente al "un container, una llamada" web). Para los decimales reducidos del titular se crea `MaskedAmountDisplay` nativo (espejo del web: parte decimal en `Text` anidado más chico con opacidad; RN soporta `Text` anidado). Hero navega a cuentas (`router.push('/accounts')`); "Ver todas" ídem.

### D4 — "Balance del mes": cuerpo nuevo, chart eliminado

Misma anatomía que web: eyebrow BALANCE + neto (`MaskedAmountDisplay` con signo/color) + filas Ingresos/Gastos con barra proporcional (`View` con `width: '<pct>%'`, mayor = 100%) + strip USD siempre visible. La línea "vas {neto} este mes" va en el header de la card, anclada al mes en curso: con D1, el dato del mes actual está en el cache de TanStack desde el primer load (`useMonthBalanceSeries(current...)` con los valores de `current` — un segundo hook sobre la misma key cacheada, sin red extra cuando se está en el mes actual). `MonthBalanceChart.tsx` se elimina. `SWAP_MIN_HEIGHT` se recalibra a la nueva anatomía.

### D5 — "En qué se fue": dona en `react-native-svg`, misma matemática

`SpendingSection` + `SpendingDonut` nativos espejo de web: `useMonthCategoryBreakdown` (hook existente; pasa a depender del mes seleccionado de D1) → `buildCategorySlices` (`topN: 5` + "Otros") con relabel vía el helper de categorías mobile. La dona se dibuja con `<Svg viewBox="0 0 36 36">` + `<Circle strokeDasharray strokeDashoffset>` — misma técnica de strokes que la dona web y el SVG de cards mobile. Colores: `slice.color` de DB con fallback posicional a la paleta `cat-*` leída de `@grana/ui-tokens/tokens` (valores JS para props `stroke`; nada de hex inline). Centro con label "GASTOS" + total enmascarable (overlay `View` absoluto). `Segmented` nativo existente para ARS/USD (estado local, sin refetch). Filas y "Ver desglose" → `router.push('/transactions')` (Movimientos abre con el desglose; sin deep-link de filtros, igual que web). Estado vacío neutral in-card. `CategoryTeaser` se elimina.

### D6 — Bajas coordinadas: componentes → hooks → package → i18n

Orden de limpieza para que cada paso compile: (1) shell deja de montar upcoming/welcome/teaser; (2) se borran los componentes + skeletons nativos; (3) se borran `useUpcomingFortnight`/`useHasMovements` de `lib/dashboard/queries.ts`; (4) se retiran de `@grana/dashboard` `getUpcomingFortnight`, `hasUserMovements`, `buildUpcomingFortnight`, tipos `Upcoming*` y sus tests; (5) se borran las keys `dashboard.upcoming.*` y `dashboard.welcome_card.*` de ambos catálogos. Gate: `pnpm --filter web typecheck` además del de mobile (web no debe importar nada de lo retirado — ya no lo hace desde el change web).

### D7 — Skeletons: `SkeletonBlock`, shape nuevo

`HeroSkeleton` (card navy: bloques blancos translúcidos), `AccountsCardSkeleton` (filas avatar+nombre+monto), `MonthBalanceSkeleton` (neto + 2 filas con barra + strip), `SpendingSkeleton` (anillo + ~5 filas) — todos componen `SkeletonBlock` (pulse + reduced-motion ya encapsulados) dentro del swap region de alto estable de cada card, sin mover el chrome. `UpcomingFortnightSkeleton` y `CategoryTeaserSkeleton` se eliminan.

## Risks / Trade-offs

- **[El chart de línea desaparece del producto]** Era la única visualización temporal del mes. → Decisión de producto explícita (paridad estricta); el dato queda en `getMonthBalanceSeries` (la serie diaria sigue disponible) por si una vista futura lo retoma; solo muere la UI.
- **[Retirar queries del package]** Si un trabajo futuro quiere "Lo que viene", habrá que recuperarlas de git. → Aceptado: el repo es la memoria; mantener código muerto exportado contradice la convención. El archive de este change documenta dónde estaba.
- **[Dona SVG en RN]** `strokeDasharray` porcentual sobre `viewBox 36` se comporta igual que en web (pathLength implícito de la circunferencia ~100 con r=15.915). → Misma técnica ya probada en la dona web; verificación visual en Expo Go como parte del QA.
- **[Dos hooks sobre `balance-series`]** (D4) El del mes en curso y el del seleccionado son el mismo cuando no se navegó. → TanStack dedupea por key; costo cero en el caso común.

## Open Questions

(ninguna — paridad estricta confirmada por producto)
