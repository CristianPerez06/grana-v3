## Why

El wizard de onboarding post-signup ya existe en web (`add-onboarding-post-signup`), pero la app mobile actualmente despacha al usuario directamente a `(app)/dashboard` después del signup, sin pasar por ningún flujo de configuración. La capability `onboarding` fue diseñada plataforma-neutral, pero sus scenarios están escritos con verbos web (URLs, Server Components, middleware) — son implícitamente `(web)`. La app mobile ya tiene auth funcional (login, signup, recovery) y dashboard placeholder, así que el seam para meter el wizard está listo.

Esta change espeja el flujo en `apps/mobile/`, alineado palabra por palabra con la spec existente, agregando los scenarios `(mobile)` que faltan en `onboarding` y `auth`. La DB ya está migrada (la change web aplicó el ALTER de `profiles` y el rename de la cuenta default a `Billetera`), así que no hay trabajo de schema. Es exclusivamente código mobile + actualización de specs.

## What Changes

- **NEW** `apps/mobile/app/(onboarding)/` route group con cuatro pantallas: `welcome.tsx`, `perfil.tsx`, `saldo-actual.tsx`, `done.tsx`, más su `_layout.tsx` (Stack, headerShown: false, valida sesión). Mismo comportamiento que el wizard web: persistencia por paso, bloqueante, sin "Saltar", ARS del primary obligatorio (0 es válido).
- **NEW** Componentes UI mobile reutilizables:
  - `apps/mobile/components/ui/SelectableCard.tsx` — Pressable estilo card con estado `selected` (usado para las dos cards de modo en `perfil`).
  - `apps/mobile/components/ui/InstitutionPickerModal.tsx` — Modal RN con `TextInput` de búsqueda + `FlatList` de instituciones (reemplaza el `<select>` nativo del web).
- **NEW** Helper i18n mobile: `apps/mobile/lib/i18n.ts` con `t(key: string, params?: Record<string, string>): string` que importa `@grana/i18n-messages/src/es.json` y resuelve paths con notación dot + interpolación `{name}`. El wizard consume las claves `onboarding.*` ya existentes en el catalog (las mismas que usa web). NO se migra el resto de mobile (auth screens) en esta change — esa deuda se aborda en una change separada.
- **NEW** Gate mobile dual que reemplaza la lógica del middleware web:
  - **Splash gate** en `apps/mobile/app/index.tsx`: después de resolver sesión y descartar recovery, lee `profiles.onboarding_completed_at`. Si NULL, redirige a `(onboarding)/welcome`; sino a `(app)/dashboard`.
  - **Layout gate** en `apps/mobile/app/(app)/_layout.tsx`: re-chequea al entrar al grupo `(app)`; si NULL, `router.replace('/(onboarding)/welcome')`. Cubre el caso post-signup donde `onAuthStateChange SIGNED_IN` empuja a dashboard sin pasar por el splash.
  - En ambos lugares, una sesión con `hasRecoveryClaim()=true` NO dispara redirect a onboarding (idéntico al web middleware).
- **MODIFIED** `apps/mobile/app/_layout.tsx`: el handler de `onAuthStateChange SIGNED_IN` ahora consulta `profiles.onboarding_completed_at` antes de elegir destino; si NULL → `(onboarding)/welcome`, sino → `(app)/dashboard`. Recovery sigue cortando antes (sin cambios).
- **MODIFIED** capability `onboarding`: re-taggear los scenarios existentes (web-implícitos) como `(web)` y agregar scenarios `(mobile)` paralelos para cada requirement. Los requirements (las reglas SHALL) son plataforma-neutrales y NO cambian — solo divergen los scenarios concretos (gates en lugar de middleware, pantallas `expo-router` en lugar de App Router, sin server actions, etc.).
- **MODIFIED** capability `auth`: re-taggear el requirement del middleware como `(web)` y agregar un requirement `(mobile)` equivalente sobre el gate dual de mobile.

Mismo comportamiento de negocio en ambas plataformas:
- Bimoneda por defecto (ARS+USD habilitados sin preguntar).
- Cuenta bancaria solo si modo='experto' + respondió sí — atomicidad por rollback manual.
- Tarjeta de crédito NO se pregunta ni se crea en onboarding.
- `/saldo-actual` impacta `account_currencies.initial_balance`, NO crea `transactions`.
- Form handling: `useState` manual + `schema.validate({abortEarly:false})` (mismo patrón que `signup.tsx`), NO se introduce react-hook-form solo para esta change.

## Capabilities

### New Capabilities

(ninguna — esta change reutiliza las capabilities `onboarding` y `auth` definidas por la change web `add-onboarding-post-signup`.)

### Modified Capabilities

- `onboarding`: agrega scenarios `(mobile)` paralelos a cada requirement existente; los scenarios actuales se re-taggean `(web)`. Sin cambios de requirements ni reglas SHALL.
- `auth`: el requirement del middleware se taggea `(web)`; se agrega un requirement `(mobile)` nuevo sobre el gate dual (splash + layout) con sus scenarios.

## Impact

**Código (apps/mobile)**:

- Crear `app/(onboarding)/{_layout,welcome,perfil,saldo-actual,done}.tsx`.
- Crear `components/ui/{SelectableCard,InstitutionPickerModal}.tsx`.
- Crear `lib/i18n.ts`.
- Modificar `app/_layout.tsx`, `app/index.tsx`, `app/(app)/_layout.tsx` para implementar el gate dual.

**Código (apps/web)**: ninguno (esta change no toca web).

**Packages**:

- `@grana/i18n-messages`: sin cambios — el catalog ya tiene todas las claves `onboarding.*` que el wizard mobile va a consumir.
- `@grana/validation`: sin cambios — `perfilSchema`, `saldoActualSchema` y `parseMoneyInput` ya son consumibles desde mobile (cross-platform, sin deps de plataforma).
- `@grana/supabase`: sin cambios.

**Base de datos**: ningún cambio — la migración 0012 ya fue aplicada por la change web. `profiles.mode/financial_timezone/onboarding_completed_at` existen; el trigger `on_auth_user_created_default_account` ya crea `Billetera`.

**Documentación**:

- `CLAUDE.md`: sin cambios — "Bimoneda por defecto" ya está documentado por la change web.
- `apps/mobile/README.md`: actualizar el listado de pantallas para mencionar el wizard si corresponde (verificar al implementar).
- `apps/mobile/PROXIMAS_FASES.md`: no aplica directamente — ese archivo trackea trabajo de builds/distribución, no features.

**Fuera de alcance (futuras changes)**:

- Migrar auth screens (`signup.tsx`, `login.tsx`, etc.) a consumir `@grana/i18n-messages` — deuda preexistente.
- RPC atómico `create_bank_account_with_currencies` que reemplace el rollback manual en ambas plataformas.
- Cache del flag `onboarding_completed_at` en mobile (hoy se consulta dos veces por arranque: splash + layout). Diferido a medición real.
- Tests E2E mobile del wizard (no hay infra E2E mobile en repo).
- Selector de cuenta de pago del módulo `cards` en mobile (el módulo cards mobile no existe todavía).
