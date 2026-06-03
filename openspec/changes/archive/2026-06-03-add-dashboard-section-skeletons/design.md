## Context

El dashboard hoy tiene dos modelos de loading state, ambos pre-skeleton:

**Web** (`apps/web/app/(app)/dashboard/_components/dashboard-content.tsx`):
- Server containers (RSC) suscritos a Suspense.
- 4 boundaries con `fallback={<SectionFallback message={t(...)} className="min-h-[…]"/>}`.
- `SectionFallback` (`apps/web/components/ui/section-fallback.tsx`) es una dashed-box con un mensaje de texto centrado y `min-h-[…]` por sección para evitar layout shift cuando aterriza la data.
- Streaming independiente: cada sección hidrata cuando su query del server resuelve.

**Mobile** (`apps/mobile/app/(app)/dashboard.tsx`):
- Client containers que usan TanStack Query (`useDashboardHero`, `useUpcomingFortnight`, `useMonthBalanceSeries`, `useMonthCategoryBreakdown`).
- Cada sección expone un patrón **chrome fijo + swap interno**: la card (border + padding + label/título + min-height) se renderiza siempre; dentro hay una región con `style={{ minHeight: SWAP_MIN_HEIGHT }}` que intercambia entre `data` / `query.isError` / `<Spinner size="lg"/>`.
- `SectionFallback` existe en mobile pero no se importa en ningún consumer (es código muerto desde la migración a chrome-fijo + spinner interno).

Referencia del lenguaje skeleton al que queremos converger: `apps/web/lib/transactions/components/movement-list-skeleton.tsx`. Patrón concreto: composición de `<div className="bg-muted animate-pulse rounded-…"/>` con tamaños shape-matched a la fila real (`size-10 rounded-md` para el icon, `h-3.5 w-2/3` para la línea principal, `h-2.5 w-1/3` para la secundaria, etc.), agrupados por bloques que reproducen la jerarquía visual (`SkeletonRow`, `SkeletonDayGroup`), con `aria-busy="true"` y `aria-label` en el wrapper.

Constraint clave: **la arquitectura de carga no se toca**. Web sigue siendo Suspense-per-section, mobile sigue siendo chrome-fijo + swap interno. La change solo intercambia el visual del estado pending.

Stack disponible (sin deps nuevas):
- Web: Tailwind v4 ya provee `animate-pulse` y `bg-muted` en el theme (`@grana/ui-tokens` ships CSS via `theme.css`, memory `project_ui_tokens_tailwind_v4`).
- Mobile: `react-native-reanimated@~4.1.7` ya está en `apps/mobile/package.json`.

## Goals / Non-Goals

**Goals:**
- Reemplazar el visual de loading de 4 secciones del dashboard (Hero, Upcoming, MonthBalance, CategoryTeaser) por skeleton shells shape-matched, en web y mobile.
- Derivar la forma del DOM real de cada sección (no de Paper).
- Mantener `aria-busy` + `aria-label` traducible en cada skeleton.
- Mantener parity cross-platform: mismo nombre de componente, misma anatomía, distinta implementación idiomática (memory `feedback_cross_platform_components`).
- Eliminar los `SectionFallback` (web y mobile) una vez que dejan de tener consumers.

**Non-Goals:**
- Cambiar la arquitectura de streaming/Suspense en web.
- Cambiar el patrón chrome-fijo + swap interno en mobile.
- Skeletonizar `WelcomeFirstMoveCard` (su Suspense `fallback={null}` es deliberado: streamea tarde y es opcional).
- Skeletonizar `DashboardHeader` (su loading state ya vive en la spec del dashboard, con greeting anon + controles disabled, no se toca).
- Introducir una librería de skeletons (ej. `react-loading-skeleton`, `moti/skeleton`).
- Resolver el branding de animación (timing, easing, color del shimmer) más allá de "mismo `animate-pulse` que ya usa `movement-list-skeleton.tsx`".

## Decisions

### D1. Web: skeletons como Suspense fallback, sin primitivo

Cada uno de los 4 skeletons (`HeroSkeleton`, `UpcomingFortnightSkeleton`, `MonthBalanceSkeleton`, `CategoryTeaserSkeleton`) se implementa como **server component** en `apps/web/app/(app)/dashboard/_components/`, compuesto por `<div className="bg-muted animate-pulse rounded-…"/>` inline. Se usan como `fallback` de los `<Suspense>` existentes en `dashboard-content.tsx`, reemplazando 1:1 a los 4 `<SectionFallback…/>` actuales.

**Por qué sin primitivo (`<Skeleton/>` wrapper):**
- `animate-pulse` es **una clase Tailwind**. Wrappearla en un componente solo agrega indirección.
- Es exactamente el patrón que ya usa `movement-list-skeleton.tsx`, que es nuestra referencia.

**Alternativas consideradas:**
- `<Skeleton className="…"/>` wrapper como en shadcn/ui. Rechazado: agrega un archivo extra sin valor; la convención del repo es inline.
- Conservar `<SectionFallback>` con un prop `variant="skeleton"`. Rechazado: el componente actual asume texto centrado en dashed-box; un skeleton no comparte ese esqueleto.

### D2. Mobile: primitivo `SkeletonBlock` + 4 skeletons que lo componen

En `apps/mobile/components/ui/SkeletonBlock.tsx` se crea un componente único que envuelve un `Animated.View` de Reanimated con un `useSharedValue` pulsante (opacity ~0.5 → ~1, loop, ~1.2s). Acepta `className` (NativeWind) para sizing y border-radius.

Los 4 skeletons (`HeroSkeleton`, `UpcomingFortnightSkeleton`, `MonthBalanceSkeleton`, `CategoryTeaserSkeleton`) se ubican en `apps/mobile/components/dashboard/` y componen `<SkeletonBlock className="…"/>` con shape derivado del DOM real de la sección correspondiente.

**Por qué SÍ primitivo en mobile (a diferencia de web):**
- NativeWind no anima `bg-muted` con keyframes CSS — la animación necesita `Animated.View` con `useSharedValue` + `useAnimatedStyle`.
- Repetir ese setup por cada rectángulo (Hero solo ya tiene 2 bloques; MonthBalance tiene chart + footer multi-bloque) genera mucho boilerplate y diluye la intención.
- Un primitivo chiquito que solo encapsula la animación deja los call-sites legibles: `<SkeletonBlock className="h-9 w-40 rounded"/>`.

**Color del bloque:**
- Web usa `bg-muted` (token Tailwind del theme).
- Mobile usa el equivalente en tokens: probablemente `bg-border-soft` o un token específico de skeleton. Decisión final se toma al implementar leyendo `theme.css` en `@grana/ui-tokens`; si no existe un token "skeleton" SHALL reusarse el más cercano (probable `bg-border-soft`) sin introducir un token nuevo.

**Alternativas consideradas:**
- `moti/skeleton` o `react-content-loader`. Rechazadas: dep nueva, opaca al theme, no respeta los tokens del design system.
- `Animated` de RN core en vez de Reanimated. Rechazado: Reanimated ya está en deps, performance en hilo de UI es mejor, código más declarativo (`useAnimatedStyle`).
- Skeleton estático (sin animación) en mobile. Rechazado: el patrón establecido en `/transactions` web es pulse; queremos parity perceptual.

### D3. Mobile: shape adentro del swap region, no envolviendo el card

Cada sección mantiene su chrome (card border, padding, label/título, min-height del swap region). El skeleton **vive dentro** del `<View style={{ minHeight: SWAP_MIN_HEIGHT }}…>` actual, en la misma posición del `<Spinner/>`. La card NO se reemplaza por un skeleton-card-entero.

**Por qué:**
- Es lo que pidió el usuario explícitamente: "el funcionamiento de carga de la página tiene que ser el mismo que ya tiene, solo es un tema de reemplazar los loading states por sus correspondientes skeleton shells".
- Mantiene los labels/títulos visibles desde el primer paint (ej. "Para gastar" en Hero, "Lo que viene" en Upcoming), mejorando perceived speed.
- Cero cambios al `SWAP_MIN_HEIGHT` ni a la arquitectura del swap region.

**Implicancia para mobile:** los skeletons mobile son **menos extensos** que sus pares web. En web, el skeleton ocupa toda la card (porque el Suspense fallback se renderiza en lugar de la card entera). En mobile, el skeleton solo ocupa la región swappable. Esto no rompe parity visual: el chrome (label, padding) lo aporta el wrapper.

### D4. Shape source: derivado del DOM real, 1:1

Para cada sección, el skeleton se construye leyendo el JSX del componente data-state real y mapeando cada elemento visible a un bloque pulsante con tamaño equivalente:

| Elemento real                              | Bloque skeleton                        |
|--------------------------------------------|----------------------------------------|
| `<p className="text-4xl font-bold">…</p>`  | `h-10 w-44 rounded`                    |
| `<p className="text-sm text-text-muted">`  | `h-3.5 w-24 rounded`                   |
| `<AccountAvatar size="sm"/>`               | `size-6 rounded-md`                    |
| `<MonthBalanceChart days=…/>` (200px tall) | `h-[200px] w-full rounded-md`          |
| `<div className="h-1.5 w-20 rounded-full"/>` (bar) | `h-1.5 w-20 rounded-full`      |

Las dimensiones exactas se fijan al implementar leyendo cada `*-section.tsx` (web) y `*Section.tsx` (mobile). Web y mobile usan la **misma anatomía y proporciones**; sólo cambia la sintaxis (Tailwind vs NativeWind + `<SkeletonBlock>`).

**Por qué no Paper:**
- Está disponible la fuente de verdad (el JSX real ya renderizado).
- La quota de Paper podría no estar disponible y el costo de coordinar el design ref vs la verdad del DOM no se justifica para skeletons (su trabajo es **anticipar** el shape, no establecer canon visual nuevo).

### D5. Accessibility: `aria-busy` + `aria-label`

Cada skeleton SHALL declarar el rol/atributos correctos para que un lector de pantalla anuncie "Cargando \<sección\>" en vez de leer fragmentos de los bloques pulsantes:

- **Web**: en el wrapper raíz del skeleton, `aria-busy="true"` y `aria-label={t('dashboard.hero_loading')}` (etc.). Los bloques internos quedan `aria-hidden` o sin role.
- **Mobile**: `accessibilityRole="progressbar"` (o `"none"` con `accessibilityLiveRegion="polite"`) + `accessibilityLabel={t('dashboard.hero_loading')}` en el wrapper. Los `<SkeletonBlock>` internos NO declaran accessibility props (heredan ignore).

**Reuso de i18n keys existentes:**
- `dashboard.hero_loading`, `dashboard.upcoming.loading`, `dashboard.month.loading`, `dashboard.spending.loading` ya existen como mensajes textuales de `SectionFallback`. Cambian de rol (texto visible → label invisible), no de existencia. Si el wording actual ("Cargando hero…") suena raro como aria-label, se ajusta inline durante la implementación, sin renombrar la key.

### D6. Cleanup: borrar ambos `SectionFallback`

Tras el refactor:
- `apps/web/components/ui/section-fallback.tsx`: el único consumer (los 4 fallbacks del dashboard) deja de importarlo. Se borra.
- `apps/mobile/components/dashboard/SectionFallback.tsx`: ya hoy no tiene consumers. Se borra en la misma change para mantener el repo coherente.

Si una verificación con grep en CI muestra otro consumer no detectado, la decisión se reevalúa (queda como Risk R1).

## Risks / Trade-offs

**R1. `SectionFallback` (web) tiene un consumer oculto.** → Mitigación: antes de borrar, `grep -r SectionFallback apps/web` y validar que el único caller es `dashboard-content.tsx`. Si aparece otro, evaluar caso por caso (mantener el archivo si lo justifica, sino reemplazar también).

**R2. Animación `animate-pulse` mobile no respeta `prefers-reduced-motion`.** → Mitigación: `SkeletonBlock` SHALL consultar `useReducedMotion()` de Reanimated y desactivar el pulse (mantener opacity estática en ~0.7) cuando el OS lo pide. Web ya hereda este respeto desde Tailwind v4 (CSS `@media (prefers-reduced-motion)` está en el preset oficial).

**R3. Tokens de color del skeleton divergen entre plataformas.** → Mitigación: usar el token `bg-muted` (web) y su equivalente exacto en NativeWind/`theme.css` (mobile). Si no hay equivalente directo, usar `bg-border-soft` y documentar la decisión en código (one-liner). NO introducir un token "skeleton" nuevo en este change — eso ampliaría el scope.

**R4. El skeleton de `MonthBalanceSection` mobile es estructuralmente complejo (chart 200px + footer multi-bloque) y puede sentirse "ruidoso".** → Mitigación: simplificar a 1 bloque grande (`h-[200px] w-full rounded-md`) + 2 mini-bloques en el footer, en vez de intentar reproducir el polyline. Sigue siendo shape-matched a 1ª aproximación.

**R5. Web Suspense fallback es server component; usar Tailwind dentro funciona, pero `aria-label` traducido necesita `await getTranslations(...)`.** → Mitigación: ya es el patrón vigente en `dashboard-content.tsx` (que es `async`), no introduce complejidad nueva.
