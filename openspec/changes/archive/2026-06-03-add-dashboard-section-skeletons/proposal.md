## Why

El loading state de las secciones del dashboard se ve hoy como "feedback de espera" (dashed-box con texto "Cargando…" en web, spinner centrado en mobile) en vez de anticipar la forma del contenido. En `/transactions` ya migramos a skeleton shells shape-matched (`bg-muted animate-pulse` blocks que reproducen la anatomía de la fila real) y el resultado es claramente superior: la página no se siente "vacía" mientras carga y el shift visual cuando la data aterriza es mínimo. Queremos llevar el mismo lenguaje visual al dashboard (web y mobile).

## What Changes

- Cada sección del dashboard (Hero, Lo que viene, Balance del mes, Spending teaser) SHALL renderizar un **skeleton shape-matched** durante su estado de carga, en lugar del placeholder textual / spinner actual.
- **Web** (server containers + Suspense): los 4 `<Suspense fallback={<SectionFallback…/>}>` en `dashboard-content.tsx` se reemplazan por 4 fallbacks específicos (`<HeroSkeleton/>`, `<UpcomingFortnightSkeleton/>`, `<MonthBalanceSkeleton/>`, `<CategoryTeaserSkeleton/>`). La arquitectura de streaming Suspense por sección NO cambia.
- **Mobile** (client containers + TanStack): el branch `query.isPending` dentro de cada sección (que hoy renderiza un `<Spinner/>` en una swap-region con `min-height` fijo) se reemplaza por el skeleton de esa sección. El chrome existente (label de card, padding, min-height de swap) se mantiene tal cual. La arquitectura "chrome fijo + swap interno" NO cambia.
- **Mobile primitive**: se introduce un componente `<SkeletonBlock>` en `apps/mobile/components/ui/` (basado en `react-native-reanimated`, ya presente en deps) que encapsula la animación pulse. Los 4 skeletons mobile lo componen con `className` para sizing. Web no necesita primitivo (la clase `animate-pulse` de Tailwind ya alcanza, mismo patrón que `movement-list-skeleton.tsx`).
- **Shape parity**: cada skeleton se deriva visualmente del DOM real de la sección renderizada (no de Paper), 1:1 entre web y mobile.
- **Accessibility**: cada skeleton SHALL declarar `aria-busy="true"` y un label traducible ("Cargando hero", "Cargando lo que viene", etc.); en mobile equivalente con `accessibilityState`.
- **Cleanup**: el dashboard (web y mobile) deja de importar `SectionFallback` en sus containers, secciones y `dashboard-content.tsx`. Los archivos `apps/web/components/ui/section-fallback.tsx` y `apps/mobile/components/dashboard/SectionFallback.tsx` **permanecen** porque otras rutas (`accounts`, `cards`) los consumen — su migración eventual a skeletons queda fuera del scope de este change. Las i18n keys `dashboard.hero_loading`, `dashboard.upcoming.loading`, `dashboard.month.loading`, `dashboard.spending.loading` se reusan como labels de accesibilidad de los skeletons (no se borran).

**Fuera de scope**:
- `WelcomeFirstMoveCard` (su Suspense fallback es `null` por diseño — streamea tarde y opcional; un skeleton ahí sería ruido).
- `DashboardHeader` (su loading state ya está specado con greeting anon + controles disabled).
- La sección Tarjetas (no vive en el dashboard).

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities

- `dashboard`: el comportamiento de loading de las 4 secciones cambia de "placeholder textual / spinner" a "skeleton shape-matched". Los scenarios actuales que asumen Spinner / dashed-fallback se modifican o reemplazan.

## Impact

**Código (web)**
- `apps/web/app/(app)/dashboard/_components/dashboard-content.tsx`: cambia los 4 Suspense fallbacks.
- Nuevos archivos: `hero-skeleton.tsx`, `upcoming-fortnight-skeleton.tsx`, `month-balance-skeleton.tsx`, `category-teaser-skeleton.tsx` en `_components/`.
- Sin eliminaciones: `apps/web/components/ui/section-fallback.tsx` permanece (lo usan `accounts/`, `cards/`).

**Código (mobile)**
- `apps/mobile/components/dashboard/HeroSection.tsx`, `UpcomingFortnightSection.tsx`, `MonthBalanceSection.tsx`, `CategoryTeaser.tsx`: reemplazan el branch `<Spinner/>` por el skeleton respectivo.
- Nuevos archivos: `HeroSkeleton.tsx`, `UpcomingFortnightSkeleton.tsx`, `MonthBalanceSkeleton.tsx`, `CategoryTeaserSkeleton.tsx` en `components/dashboard/`.
- Nuevo primitivo: `apps/mobile/components/ui/SkeletonBlock.tsx`.
- Sin eliminaciones: `apps/mobile/components/dashboard/SectionFallback.tsx` permanece (lo usa `mobile/app/(app)/cards.tsx`).

**Specs**
- `openspec/specs/dashboard/spec.md`: requirements/scenarios de loading de las 4 secciones se actualizan vía delta.

**i18n**
- Sin keys nuevas. Las existentes `dashboard.hero_loading`, `dashboard.upcoming.loading`, `dashboard.month.loading`, `dashboard.spending.loading` cambian de "mensaje visible" a "aria-label invisible para lectores de pantalla". Los strings pueden ajustarse si el wording actual no funciona como label de accesibilidad.

**Deps**
- Sin deps nuevas. `react-native-reanimated@~4.1.7` ya está en `apps/mobile/package.json`. Tailwind v4 ya provee `animate-pulse` y `bg-muted` en el theme web.

**Riesgos**
- Bajos. La arquitectura de streaming/Suspense/swap no cambia, solo el visual del estado pending. La layout stability ya está cubierta por min-heights existentes y se mantiene.
