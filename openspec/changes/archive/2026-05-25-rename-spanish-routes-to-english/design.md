## Context

La spec `project-conventions` ya define la regla "código en inglés" cubriendo `nombres de archivos y directorios bajo cualquier apps/<name>/ o packages/<name>/`. Sin embargo, en la práctica esta regla se violó en tres lugares:

1. **Wizard de onboarding (web)** — `apps/web/app/(onboarding-wizard)/onboarding/saldo-actual/` y `.../perfil/`, junto con sus componentes internos (`saldo-actual-form.tsx`, `perfil-form.tsx`).
2. **Shell mobile** — `apps/mobile/app/(app)/movimientos.tsx`, `.../tarjetas.tsx`, `(onboarding)/saldo-actual.tsx`, `(onboarding)/perfil.tsx`.
3. **Catálogos i18n** — los keys `onboarding.perfil.*` y `onboarding.saldoActual.*` en `packages/i18n-messages/src/{es,en}.json` violan la sub-regla "los keys del catálogo i18n son identifiers y deben estar en inglés".

La causa raíz, según `git log`, no es una decisión deliberada sino reflejo lingüístico: la app es para Argentina, el copy es español, y los devs nombraron los segmentos de ruta tal como aparecen en el UI. Esto sucedió antes de que la convención estuviese formalizada en `project-conventions` (commit `416bbe4` para el wizard web, `dfca3fc` y `8dd2a51` para mobile).

Investigación realizada (referencias actuales a renombrar):
- `apps/web/app/(onboarding-wizard)/onboarding/welcome/page.tsx` — `<Link href="/onboarding/perfil">`.
- `apps/web/app/(onboarding-wizard)/onboarding/perfil/_components/perfil-form.tsx` — `router.push('/onboarding/saldo-actual')`.
- `apps/web/app/(onboarding-wizard)/onboarding/done/page.tsx` — comentario "declared in /saldo-actual".
- `apps/mobile/app/(onboarding)/perfil.tsx` — `router.replace('/(onboarding)/saldo-actual')`.
- `apps/mobile/components/layout/AppMenu.tsx`, `dashboard/CardsSection.tsx`, `dashboard/CreditCardItem.tsx`, `dashboard/UpcomingFortnightSection.tsx` — `router.push('/tarjetas')` (y un type alias `'/tarjetas' | '/(app)/settings'`).
- `apps/web/lib/supabase/middleware.ts` — el gate usa el prefijo `/onboarding` (no enumera sub-rutas), no requiere cambios.

## Goals / Non-Goals

**Goals:**

- Alinear todos los nombres de archivo/directorio bajo `apps/<name>/app/` con la regla "código en inglés".
- Alinear los keys de los catálogos i18n con la misma regla (los valores se conservan tal cual — siguen en español/inglés según el archivo).
- Dejar `project-conventions` explícita sobre el caso "ruta == URL": un archivo de ruta es código, no copy, aun cuando su nombre aparezca en la URL.
- Mantener el comportamiento funcional intacto: mismos flujos, mismos textos visibles, mismo gating.

**Non-Goals:**

- Cambiar copy visible al usuario, schemas, server actions, validaciones, o cualquier lógica.
- Renombrar identifiers que ya estén en inglés (la mayoría del repo).
- Tocar archivos de `supabase/migrations/` (todos ya en inglés).
- Renombrar `apps/web/app/(onboarding-wizard)` — `onboarding-wizard` ya está en inglés (el guión es legítimo, no es un nombre español).
- Introducir un mecanismo de rewrites/i18n routing para preservar URLs en español. Es complejidad innecesaria para un app pre-launch sin deep links externos.

## Decisions

### Decisión 1 — Rename directo, no rewrites

**Decisión:** renombrar los archivos/directorios y aceptar que las URLs internas cambian.

**Alternativa considerada:** mantener URLs en español usando Next.js `rewrites` (web) y un mapa Expo Router (mobile) para que el path interno sea inglés pero el segmento visible siga en español.

**Por qué se descarta:** (a) la app es pre-launch — no hay deep links externos que romper; (b) Expo Router no tiene un rewrite trivial; sólo Next sí; (c) introduce dos capas de naming (interno vs externo) que la convención justamente quiere evitar; (d) la propia regla en `project-conventions` define "código en inglés" como naming físico de archivo/directorio.

### Decisión 2 — Nombres elegidos

| Antes | Después | Justificación |
|-------|---------|---------------|
| `(onboarding)/saldo-actual` | `(onboarding)/initial-balance` | Refleja el contenido: el step donde el usuario declara el saldo inicial de su cuenta. "current-balance" sería ambiguo (los balances de la app son derivados, no almacenados). |
| `(onboarding)/perfil` | `(onboarding)/profile` | Match 1-a-1 con el copy "tu perfil"/"your profile". |
| `(app)/movimientos.tsx` | `(app)/transactions.tsx` | Consistente con `apps/web/app/(app)/transactions/` y con la capability `transactions` (módulo 8). |
| `(app)/tarjetas.tsx` | `(app)/cards.tsx` | Consistente con `apps/web/app/(app)/cards/` y con la capability `cards` (módulo 9). |

Los keys i18n se renombran siguiendo el mismo mapeo (`perfil` → `profile`, `saldoActual` → `initialBalance`) en ambos catálogos `es.json` y `en.json`.

### Decisión 3 — Spec deltas mínimas pero específicas

**Decisión:** modificar la spec `project-conventions` agregando un scenario que aclare "los segmentos de ruta cuentan como nombres de archivo a efectos de la regla código en inglés". Y modificar las specs `onboarding` y `mobile-app-shell` reemplazando los string literales viejos por los nuevos.

**Alternativa considerada:** hacer sólo el rename físico sin tocar specs (asumiendo que `project-conventions` ya cubre el caso).

**Por qué se descarta:** el caso "ruta == URL" es exactamente donde la convención falló en la práctica. Un scenario explícito en `project-conventions` evita la próxima reincidencia y vuelve la regla auditable por LLMs. Y las specs `onboarding`/`mobile-app-shell` que enumeran nombres concretos quedarían desincronizadas con el código si no se actualizan.

### Decisión 4 — Rebuild de tipos generados

Next App Router genera `apps/web/.next/types/routes.d.ts` con strings de rutas a partir del filesystem. Tras el rename hay que regenerarlo (`pnpm build` o un `pnpm dev` que produzca los types). Los archivos bajo `.next/` son artifacts de build y no se commitean, así que esto es una nota operacional, no de spec.

## Risks / Trade-offs

- **[Riesgo] Referencias colgadas a rutas viejas en código no detectado por grep.** → Mitigación: post-rename correr `pnpm --filter web build`, `pnpm --filter mobile typecheck` (vía `tsc --noEmit` en el proyecto Expo) y `pnpm --filter web lint`. TypeScript route checking en Next captura `<Link href>` y `router.push` con typed routes.
- **[Riesgo] Onboarding "in-flight" en dev** — si un usuario en sesión está parado en `/onboarding/perfil` cuando se aplica la rename, el siguiente click rompe. → Mitigación: aceptable en dev; en prod no aplica (pre-launch).
- **[Riesgo] Tests que hard-codeen URLs viejas.** → Mitigación: revisión grep durante implementación (`grep -rn 'saldo-actual\|/onboarding/perfil\|/movimientos\|/tarjetas' apps/`).
- **[Trade-off] URLs en inglés en una app argentina.** → Aceptado: el copy visible (i18n) sigue en español; el path es un detalle de implementación. Cuando la app crezca y deep links externos importen, podemos agregar rewrites encima de un naming interno sano.

## Migration Plan

No aplica como migración formal (no hay datos persistidos a migrar). El cambio se hace en una sola branch:

1. Renombrar archivos/dirs en mobile (`git mv`).
2. Renombrar archivos/dirs en web (`git mv`).
3. Actualizar todas las referencias en código (imports, `Link`, `router.push`, type aliases, comentarios).
4. Renombrar keys i18n en `es.json` y `en.json`; actualizar consumers (`useTranslations('onboarding.perfil')` → `useTranslations('onboarding.profile')`, etc.).
5. Actualizar specs (`project-conventions`, `onboarding`, `mobile-app-shell`).
6. Smoke test: `pnpm --filter web build`, `pnpm --filter web lint`, `pnpm --filter mobile typecheck`. Wizard de onboarding completo en web (welcome → profile → initial-balance → done) y mobile.
7. Archivar el change (mover a `openspec/changes/archive/YYYY-MM-DD-rename-spanish-routes-to-english/`, integrar deltas en master specs, run `pnpm openspec:check`).

## Open Questions

Ninguna. El alcance está acotado, la causa raíz identificada, y los nombres elegidos siguen las convenciones de capability names ya existentes.
