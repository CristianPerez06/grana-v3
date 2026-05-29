## Why

El change [`2026-05-28-dashboard-header-loading-state`](../archive/2026-05-28-dashboard-header-loading-state/) dejó el header del dashboard renderizándose desde el primer paint y movió el contenido a un `DashboardContent` envuelto en **un único** `<Suspense>` con `RouteLoading` global. El contenido se fetcheaba server-side con `Promise.allSettled` agrupando cuatro queries (`getDashboardHero`, `getUpcomingFortnight`, `getMonthBalanceSeries`, `hasUserMovements`), seguido por una quinta query **secuencial** (`getMonthCategoryBreakdown` para el teaser de "En qué se fue"). Esto tenía dos consecuencias visibles:

1. El usuario veía un único spinner hasta que terminaba la query **más lenta**: el Hero (fetch barato) quedaba bloqueado por "Lo que viene" (que abre 3 sub-queries) o por el balance del mes.
2. El teaser de categorías corría detrás del batch, sumando latencia que no necesitaba.

El spec de dashboard ya decía "Cada sección SHALL renderizarse de forma independiente: una falla en la query de 'Lo que viene' NO SHALL impedir que se rendericen Hero o Balance del mes" — pero la implementación cumplía esa propiedad sólo para **errores**, no para **loading**. Este change cierra esa brecha.

## What Changes

- `DashboardContentBody` (single async server component) se reemplaza por `DashboardContent`, que monta **un `<Suspense>` por sección**. Cada sección tiene su propio container async (`HeroSectionContainer`, `UpcomingFortnightSectionContainer`, `MonthBalanceSectionContainer`, `CategoryTeaserContainer`, `WelcomeFirstMoveCardContainer`) que ejecuta su fetch y degrada a `SectionFallback` si la query falla.
- Los cinco fetches arrancan en paralelo (vs. 4 paralelo + 1 secuencial antes). Cada sección stream-ea independiente: el Hero pinta apenas resuelve su query sin esperar al resto.
- Cada sección define un `min-h-[…]` (Hero 10rem, "Lo que viene" 20rem, Balance del mes 26rem, teaser 8rem) sobre el root del componente real **y** sobre el `SectionFallback` que ocupa su lugar durante el loading. El alto y el ancho de la tarjeta no cambian entre el fallback y el contenido — sin layout shift.
- `WelcomeFirstMoveCard` (condicional) usa `<Suspense fallback={null}>` deliberadamente: cuando aparece, empuja al resto del contenido hacia abajo, pero `hasUserMovements` es un head-count barato y la mayoría de los usuarios no la ven nunca. Reservar espacio fijo para una card que no se va a mostrar sería peor.
- `SectionFallback` ahora acepta `className` para que la página le pase el `min-h-[…]` adecuado a cada hueco, y centra su mensaje vertical y horizontalmente.
- `getMonthCategoryBreakdown` antes fallaba sin red de contención (el error rompía toda la página); ahora degrada a `SectionFallback` con el mismo patrón que el resto. Se agregan keys i18n nuevas (`dashboard.hero_loading`, `dashboard.upcoming.loading`, `dashboard.month.loading`, `dashboard.spending.loading`, `dashboard.spending.error`) en `packages/i18n-messages/src/{es,en}.json`.
- Patrón de error de servidor: los containers usan `try { data = await query() } catch { return <SectionFallback /> }` separando el `await` de la construcción de JSX — required por `react-hooks/error-boundaries` porque la construcción de JSX async no es alcanzable desde un `try/catch`. Los errores de **rendering** dentro de cada sección siguen burbujeando al `DashboardErrorBoundary` exterior.

No es un cambio breaking visible: el dashboard se ve igual al final, sólo cambia cómo y cuándo aparece cada parte.

## Capabilities

### New Capabilities
<!-- No nuevas capabilities; el cambio modifica la existente. -->

### Modified Capabilities
- `dashboard`: la tolerancia a datos parciales pasa de "independencia frente a fallas" a "independencia también frente a loading", con un mecanismo explícito (per-section `<Suspense>` + min-height) que evita layout shift durante el streaming.

## Impact

- **Código afectado (web)**:
  - `apps/web/app/(app)/dashboard/_components/dashboard-content.tsx` (reescrito)
  - `apps/web/app/(app)/dashboard/_components/section-fallback.tsx` (acepta `className`, centra contenido)
  - `apps/web/app/(app)/dashboard/_components/{hero,upcoming-fortnight,month-balance,category-teaser}-section.tsx` (cada root suma `min-h-[…]`)
  - `apps/web/app/(app)/dashboard/_components/{hero-section,upcoming-fortnight-section,month-balance-section,category-teaser,welcome-first-move-card}-container.tsx` (nuevos)
- **i18n**:
  - `packages/i18n-messages/src/{es,en}.json`: nuevas keys `dashboard.hero_loading`, `dashboard.upcoming.loading`, `dashboard.month.loading`, `dashboard.spending.loading`, `dashboard.spending.error`.
- **Sin cambios**: `@grana/dashboard` queries, schema, agregaciones, contratos del Button, page header. La superficie pública del módulo dashboard hacia el resto de la app es idéntica.
- **No afecta mobile**: el spec mobile ("La pantalla `(app)/dashboard` mobile renderiza las secciones del dashboard con tolerancia a fallas parciales") ya describe el patrón de cargas paralelas con fallback por sección; la implementación mobile no se toca en este change.
