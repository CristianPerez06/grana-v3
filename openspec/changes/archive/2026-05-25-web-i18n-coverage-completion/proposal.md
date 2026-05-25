## Why

El switcher de idioma de web ya funciona (la cookie `NEXT_LOCALE` resuelve el locale activo) y `apps/web/app/(app)/settings/**` está 100% traducido tras `mobile-settings-parity`. Pero el resto de las rutas autenticadas todavía tiene **strings hardcoded en español** que no responden al cambio de locale. El resultado: un usuario que pasa a `en` ve un dashboard parcialmente bilingüe — header en inglés, lista de cuentas y tarjetas en español, formularios con labels mezclados, y server actions devolviendo `error.message` raw de Postgres ("duplicate key value violates unique constraint...") como `formError`.

Esto rompe el principio implícito del módulo `i18n`: si el switcher se muestra al usuario, toda ruta visible debe responder al cambio. La cobertura parcial es peor que no tener switcher — confunde más de lo que aporta.

## What Changes

- **Cobertura i18n completa en rutas autenticadas web** para:
  - `apps/web/app/(app)/accounts/**` — `page.tsx`, `new/page.tsx`, `[id]/page.tsx` y todos los componentes en `_components/` (account-section, account-row, account-detail-header, empty-accounts-state, etc.).
  - `apps/web/app/(app)/cards/**` — `page.tsx`, `new/page.tsx`, `[id]/page.tsx` y los ~15 componentes en `_components/` (card-hero, limit-summary, card-dates-footer, payment-cta-block, periods-section, estimated-date-badge, inactive-card-banner, etc.).
  - `apps/web/app/(app)/transactions/**` — auditar y traducir lo que aún tenga strings hardcoded (la ruta se llama `transactions/` en el código, no `movimientos/`; el slug en la UI puede seguir siendo "Movimientos" como string traducido).
- **Server actions con error handling localizado**. Toda función en `apps/web/app/_actions/` que hoy devuelve `formError: error.message` (raw Postgres) SHALL mapear el error a un mensaje i18n antes de retornar. Patrón canónico: el helper `translatePostgresError` ya implementado en `apps/web/app/_actions/categories.ts`. Archivos afectados: `accounts.ts`, `credit-cards.ts`, `recurrences.ts`, `transactions.ts` (y cualquier otro que el inventario revele).
- **Nuevas claves en `packages/i18n-messages/src/{es,en}.json`** para todos los strings introducidos. Reusar namespaces existentes (`accounts.*`, `transactions.*`) donde apliquen; crear namespace `cards.*` (no existe hoy). Toda clave SHALL existir en los dos catálogos — la paridad la enforce el type `Messages = typeof es`.
- **Patrón uniforme**:
  - Server Components (`async function`, sin `'use client'`) → `const t = await getTranslations('namespace')`.
  - Client Components (`'use client'`) → `const t = useTranslations('namespace')`.
  - Server actions → `const t = await getTranslations('namespace.errors')` + map de códigos Postgres antes del `return`.
- **No** se renombra la ruta `/transactions` a `/movimientos` (eso sería otro change). El slug visible "Movimientos" se traduce vía clave `nav.transactions` o similar.
- **No** se cambia el motor de i18n ni la estrategia de resolución de locale (cookie `NEXT_LOCALE`). Solo se completa el coverage.

## Capabilities

### New Capabilities

(ninguna — todo el alcance extiende capabilities existentes)

### Modified Capabilities

- `i18n`: nuevo requirement de **cobertura completa en web** que obliga a que toda ruta bajo `apps/web/app/(app)/**` responda al cambio de locale, incluyendo los errores devueltos por server actions. Endurece el contrato actual ("Mensajes localizados para auth, validación, errores, dashboard placeholder y footer") extendiéndolo a las rutas funcionales (accounts, cards, transactions) y a los errores de server actions.

## Impact

**Web — código modificado:**
- `apps/web/app/(app)/accounts/**` — ~9 archivos, ~15-20 strings hardcoded migrados a `getTranslations`/`useTranslations`.
- `apps/web/app/(app)/cards/**` — ~32 archivos, ~25-35 strings hardcoded migrados; nuevo namespace `cards.*` en catálogos.
- `apps/web/app/(app)/transactions/**` — auditar; lo que esté hardcoded se migra (estimado bajo, namespace `transactions.*` ya existe).
- `apps/web/app/_actions/accounts.ts`, `credit-cards.ts`, `recurrences.ts`, `transactions.ts` — error handling localizado vía helper análogo a `translatePostgresError`. ~100+ líneas de `formError: '...'` raw reemplazadas por lookups i18n.

**Shared packages:**
- `packages/i18n-messages/src/es.json` y `en.json` — nuevas claves bajo `accounts.*`, `cards.*` (namespace nuevo), `transactions.*`. Paridad de claves enforced por TypeScript (`type Messages = typeof es`).

**Mobile:** ninguno. Esta change es web-only. Mobile ya consume los catálogos compartidos vía `useT()`; las claves nuevas quedan disponibles para mobile sin tocar código mobile.

**DB / Backend:** ninguno. No hay cambios de schema, RLS ni triggers. El mapeo Postgres → i18n vive en TS, no en SQL.

**Dependencias nuevas:** ninguna.

**Merge gate:** `pnpm openspec:check` debe quedar verde (sin `Purpose: TBD` ni placeholders) antes del `--ff-only` a `main`. Adicionalmente, el build de TS (`pnpm --filter web build` o equivalente) valida que toda clave referenciada por `useTranslations`/`getTranslations` exista en ambos catálogos.
