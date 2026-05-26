## Why

La spec `project-conventions` exige que **todos los nombres de archivos y directorios bajo `apps/<name>/` y `packages/<name>/` estén en inglés** (ver `### Requirement: El código debe estar en inglés`). Sin embargo, varios archivos de rutas — heredados del armado inicial de `onboarding` (web) y del primer shell de `mobile` — quedaron con nombres en español (`saldo-actual`, `perfil`, `movimientos`, `tarjetas`). Esto rompe la convención y, dado que los nombres de archivos de rutas en Next App Router y Expo Router son también los segmentos de URL, perpetúa la inconsistencia hacia los deep links.

La causa raíz, verificada en `git log`, no es una decisión deliberada: los archivos se nombraron en español por reflejo (la app es para usuarios argentinos, el copy es en español) cuando aún no existía la convención explícita codificada en `project-conventions`. Ahora que la regla está documentada y bloqueada por `pnpm openspec:check`, el repo debería alinearse.

Grana V3 está pre-release: ningún deep link está publicado ni indexado. Renombrar ahora es barato y no rompe usuarios reales.

## What Changes

- **BREAKING (interno, sin usuarios reales)** — Renombrar archivos y directorios de rutas en español a sus equivalentes en inglés:
  - `apps/mobile/app/(app)/movimientos.tsx` → `transactions.tsx`
  - `apps/mobile/app/(app)/tarjetas.tsx` → `cards.tsx`
  - `apps/mobile/app/(onboarding)/saldo-actual.tsx` → `initial-balance.tsx`
  - `apps/mobile/app/(onboarding)/perfil.tsx` → `profile.tsx`
  - `apps/web/app/(onboarding-wizard)/onboarding/saldo-actual/` → `initial-balance/`
  - `apps/web/app/(onboarding-wizard)/onboarding/perfil/` → `profile/`
  - `apps/web/app/(onboarding-wizard)/onboarding/saldo-actual/_components/saldo-actual-form.tsx` → `.../initial-balance/_components/initial-balance-form.tsx`
  - `apps/web/app/(onboarding-wizard)/onboarding/perfil/_components/perfil-form.tsx` → `.../profile/_components/profile-form.tsx`
- Actualizar todos los `Link`/`href`, `router.push`, `redirect`, `<Tabs.Screen name="...">`, `<Stack.Screen name="...">` y cualquier string que referencie esas rutas viejas.
- Actualizar los gates de onboarding (`apps/web/middleware.ts` y similares) que comparen contra `/onboarding/saldo-actual` o `/onboarding/perfil`.
- Verificar que ningún test, story o helper de E2E quede colgado con los nombres viejos.
- **Aclarar** en `project-conventions` que la regla "código en inglés" cubre también segmentos de ruta (archivos/directorios bajo `app/` de Next y Expo Router) — el copy visible al usuario sigue viviendo en `@grana/i18n-messages`, no en el path.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `project-conventions`: aclarar que la regla "código en inglés" aplica explícitamente a segmentos de ruta (archivos y directorios bajo `apps/<name>/app/` y equivalentes), no solo a identificadores TypeScript. Esto es una clarificación, no un cambio de scope — la regla actual ya cubre "nombres de archivos y directorios bajo cualquier `apps/<name>/`", pero la práctica demostró que el caso "ruta == URL" necesita ser explícito.
- `onboarding`: renombrar los segmentos de ruta del wizard web de `/onboarding/saldo-actual` y `/onboarding/perfil` a `/onboarding/initial-balance` y `/onboarding/profile`. Los scenarios que mencionan esas URLs SHALL actualizarse.
- `mobile-app-shell`: renombrar las pantallas mobile `movimientos` → `transactions`, `tarjetas` → `cards`, `(onboarding)/saldo-actual` → `(onboarding)/initial-balance`, `(onboarding)/perfil` → `(onboarding)/profile`. Los scenarios que mencionan estos nombres SHALL actualizarse.

## Impact

- **Código afectado**:
  - `apps/mobile/app/(app)/_layout.tsx` (tabs config) y cualquier `router.push('/movimientos'|'/tarjetas')`.
  - `apps/mobile/app/(onboarding)/_layout.tsx` y `apps/mobile/app/(onboarding)/welcome.tsx`/`done.tsx` (transiciones del wizard).
  - `apps/web/middleware.ts` (gating de onboarding).
  - `apps/web/app/_actions/onboarding.ts` (`redirect()` calls).
  - Cualquier `<Link href="/onboarding/saldo-actual">` o `<Link href="/onboarding/perfil">` en el wizard web.
- **APIs y datos**: ninguno. No hay cambios de schema, server actions ni server-side routing. Solo nombres de archivos y los strings que los referencian.
- **Deep links / URLs**: cambian las URLs internas del wizard de onboarding y de las tabs mobile. Como la app no está publicada, no hay deep links externos que romper.
- **i18n**: las claves del catálogo (`@grana/i18n-messages`) ya están en inglés; no se tocan. El copy en español (valores) sigue siendo el mismo y se sirve desde i18n, no desde el path.
- **Specs**: deltas para `project-conventions`, `onboarding`, `mobile-app-shell`.
- **`CLAUDE.md`**: no requiere edición — la regla ya está expresada de forma genérica ("código en inglés" en la sección "Language conventions"). El refuerzo va en `project-conventions`.
