# Alinear el modelo de carga del dashboard mobile con el de web

## Why

El dashboard web evolucionó hacia un modelo de carga "shell + secciones independientes": el header (saludo + fecha) y el frame se pintan desde el primer paint, el nombre del perfil llega async con fallback anon, y **cada sección carga su propia data y muestra su propio loading/error dentro de una región de alto mínimo estable**, sin layout shift y sin un spinner global que bloquee la pantalla (commits `c8455ed` "split page into header + suspense-wrapped content" y `1c52ad4` "stream sections independently via per-section Suspense").

El dashboard mobile quedó atrás: `apps/mobile/app/(app)/dashboard.tsx` usa el patrón inverso. Un **gate de spinner a pantalla completa** (`initialLoading = hero.isPending && upcoming.isPending && movements.isPending`) oculta header y secciones hasta que resuelve la primera query; después, Hero y "Lo que viene" se renderizan condicionalmente (`data ? <Section/> : error ? <Fallback/> : null`), de modo que la sección que resuelve más tarde **aparece de golpe y empuja el contenido** (pop-in / layout shift). El header — y con él el saludo y el `eye toggle` — tampoco existe durante ese gate.

La buena noticia: el patrón objetivo **ya está probado dentro del propio repo**. `MonthBalanceSection` (mobile) ya es exactamente el modelo web: posee su query (`useMonthBalanceSeries`), su chrome (título + navegador) siempre visible, y un `SWAP_MIN_HEIGHT = 280` que mantiene el alto estable mientras intercambia spinner / error+retry / datos. Este cambio **propaga ese patrón** a las secciones que faltan; no inventa nada nuevo.

No requiere `<Suspense>` ni equivalente: en RN + TanStack Query la independencia se logra con el estado `isPending`/`isError` propio de cada componente, tal como ya lo hace `MonthBalanceSection`.

## What Changes

### A — La pantalla se vuelve un shell puro (mobile)

- **MODIFIED** "La pantalla `(app)/dashboard` mobile renderiza las secciones del dashboard con tolerancia a fallas parciales": se elimina el gate de spinner a pantalla completa. La pantalla deja de orquestar queries (Hero/Upcoming/movements) y pasa a ser un shell que monta el header y coloca las secciones, las cuales cargan de forma independiente. El header se renderiza desde el primer paint.

### B — Header desde el primer paint, nombre async (mobile)

- **MODIFIED** el header (`DashboardHeader`) absorbe `useProfileFirstName()` y deja de recibir `name` por prop. Se monta desde el primer paint con el saludo anon (`dashboard.welcome_anon`) y se actualiza al saludo personalizado cuando la query resuelve. El `eye toggle` vive en el header desde ese primer paint. La fecha sigue derivándose de `getTodayAR()`, estable.

### C — Hero y "Lo que viene" absorben su query y su loading/error in-card (mobile)

- **MODIFIED** `HeroSection` absorbe `useDashboardHero()`; `UpcomingFortnightSection` absorbe `useUpcomingFortnight(today)` (recibe `today` por prop). Cada uno mantiene su chrome (título/label) siempre visible y delega solo la región de datos a un swap spinner / error+retry / datos sobre un **alto mínimo estable**, igual que `MonthBalanceSection`. El padre deja de decidir `data ? … : null`.

### D — `WelcomeFirstMoveCard` se auto-gatea (mobile)

- **MODIFIED** `WelcomeFirstMoveCard` absorbe `useHasMovements()`: renderiza `null` mientras la query no resuelve o si el usuario ya tiene movimientos, y se materializa solo cuando `=== false`. Por ser condicional y rara vez visible, se acepta el shift breve al aparecer (misma excepción que web).

### E — Pull-to-refresh deriva su indicador de las query keys (mobile)

- **MODIFIED** como las secciones ya no exponen sus objetos de query al padre, el `RefreshControl` deriva su estado `refreshing` de `useIsFetching({ queryKey: ['dashboard'] }) > 0` en vez de agregar `*.isFetching` de hooks locales. La invalidación de `['dashboard']` al hacer pull no cambia.

## Out of scope

- **Teaser de "En qué se fue" (spending-by-category) en el dashboard mobile.** Web tiene `CategoryTeaser` en el dashboard; mobile no. Es una **feature aparte** con trabajo de data-layer propio (la query `getMonthCategoryBreakdown` vive web-only en `apps/web/lib/transactions/queries.ts` y netea reintegros con un segundo query de stitch; habría que portarla o promoverla a un package compartido) y posible pasada de diseño. Se trata en un change separado. Cuando aterrice, nacerá ya con el patrón de carga in-card de este change.
- Cambios en el layout/diseño visual de las secciones (este change es estructural: dónde vive el estado de carga, no cómo se ve cada card).
- El modelo de carga web (ya implementado con `<Suspense>` por sección; no se toca).
- Los valores concretos de `min-height` de cada sección se deciden en `design.md`/implementación; no son contrato de spec más allá de "estable, sin shift".

## Stakeholders

- **Mobile**: dueño de la implementación RN.
- **Producto** (Cristian): valida que eliminar el spinner global por un shell + skeletons in-card es la UX deseada en teléfono (vs. un único spinner, que es defendible en mobile).
