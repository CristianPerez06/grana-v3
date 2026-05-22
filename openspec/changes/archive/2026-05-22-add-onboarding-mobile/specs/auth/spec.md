## ADDED Requirements

### Requirement: El gate de mobile redirige al wizard cuando el onboarding no fue completado

El sistema SHALL implementar en mobile (`apps/mobile/`) un mecanismo equivalente al middleware web para asegurar que un usuario autenticado con `profiles.onboarding_completed_at IS NULL` no pueda acceder a las pantallas del área protegida (grupo `(app)/`). Como Expo Router no expone middleware HTTP, el mecanismo SHALL apoyarse en dos puntos del flujo de navegación:

- **Splash gate** (`app/index.tsx`): después de resolver la sesión con `supabase.auth.getSession()` y descartar el caso de recovery session, el splash SHALL leer `profiles.onboarding_completed_at` y elegir el destino: si NULL → `(onboarding)/welcome`; si NOT NULL → `(app)/dashboard`; sin sesión → `(auth)/login`; con recovery claim → `(auth)/new-password`.
- **Layout gate** (`app/(app)/_layout.tsx`): al entrar al grupo `(app)/`, el layout SHALL re-chequear `profiles.onboarding_completed_at`; si NULL, ejecutar `router.replace('/(onboarding)/welcome')`. Esto cubre el caso post-signup donde el handler de `onAuthStateChange SIGNED_IN` empuja al usuario a `(app)/dashboard` sin pasar por el splash.

Adicionalmente, el handler de `onAuthStateChange SIGNED_IN` en `app/_layout.tsx` SHALL consultar `onboarding_completed_at` antes de elegir destino para minimizar el flash de pantalla equivocada — si NULL, redirige directamente a `(onboarding)/welcome`; si NOT NULL, a `(app)/dashboard`.

En los tres puntos, si la sesión tiene recovery claim (`hasRecoveryClaim(access_token) === true`), el sistema NO SHALL consultar `onboarding_completed_at` ni redirigir al wizard — la sesión se trata como recovery (redirect a `(auth)/new-password`).

#### Scenario: Arranque en frío con sesión y onboarding incompleto (mobile)

- **WHEN** un usuario abre la app mobile en frío con una sesión persistida en SecureStore y `profiles.onboarding_completed_at IS NULL`
- **THEN** `app/index.tsx` resuelve `getSession()` con una sesión válida
- **AND** descarta el caso de recovery (no tiene `amr=otp`)
- **AND** lee `profiles.onboarding_completed_at`, ve NULL
- **AND** emite `<Redirect href="/(onboarding)/welcome" />`

#### Scenario: Arranque en frío con sesión y onboarding completado (mobile)

- **WHEN** un usuario abre la app mobile en frío con una sesión persistida y `profiles.onboarding_completed_at` no es NULL
- **THEN** `app/index.tsx` resuelve sesión, descarta recovery, lee `onboarding_completed_at` no-NULL
- **AND** emite `<Redirect href="/(app)/dashboard" />`

#### Scenario: Signup nuevo cae en el wizard sin tocar dashboard (mobile)

- **WHEN** un usuario completa signup + verify y Supabase emite `SIGNED_IN`
- **THEN** el handler de `onAuthStateChange` en `app/_layout.tsx` consulta `onboarding_completed_at`, ve NULL
- **AND** ejecuta `router.replace('/(onboarding)/welcome')` (no `/(app)/dashboard`)
- **AND** el usuario nunca ve un frame de `(app)/dashboard`

#### Scenario: Usuario navega manualmente al área (app) sin haber completado (mobile)

- **WHEN** un usuario con `onboarding_completed_at IS NULL` llega de algún modo a una ruta bajo `(app)/` (p. ej. por un deep link futuro o un bug de navegación)
- **THEN** el layout gate en `app/(app)/_layout.tsx` detecta `onboarding_completed_at IS NULL` al montarse
- **AND** ejecuta `router.replace('/(onboarding)/welcome')`

#### Scenario: Recovery session no dispara redirect a onboarding (mobile)

- **WHEN** un usuario abre la app con una sesión de recovery (`hasRecoveryClaim(session.access_token) === true`) y `onboarding_completed_at IS NULL`
- **THEN** ningún gate (splash, handler, layout) consulta `onboarding_completed_at`
- **AND** el usuario es redirigido a `(auth)/new-password` igual que hoy
- **AND** después de completar el reset y re-login, los gates normales evalúan onboarding

#### Scenario: Usuario sin sesión accede al área (app) (mobile)

- **WHEN** un usuario sin sesión abre la app
- **THEN** `app/index.tsx` resuelve `getSession()` con `null`
- **AND** emite `<Redirect href="/(auth)/login" />` sin consultar `profiles`

## MODIFIED Requirements

### Requirement: El middleware redirige al wizard cuando el onboarding no fue completado

El sistema SHALL extender el middleware de Next.js (`apps/web/lib/supabase/middleware.ts`) para que, además de proteger rutas autenticadas, consulte `profiles.onboarding_completed_at` y redirija al wizard cuando corresponda:

- Si la request va dirigida a una ruta del grupo `(app)/` (cualquiera bajo `/dashboard`, `/accounts`, `/cards`, etc.) y el usuario está autenticado pero `onboarding_completed_at IS NULL`, el middleware SHALL emitir un redirect a `/onboarding/welcome`.
- Si la request va dirigida a `/onboarding/*` y el usuario está autenticado, el middleware SHALL dejar pasar la request independientemente del valor de `onboarding_completed_at` (un usuario que ya completó el onboarding puede revisitar `/done` o `/welcome` sin ser redirigido).
- Si la request va dirigida a `/onboarding/*` y el usuario NO está autenticado, el middleware SHALL emitir un redirect a `/login` (las rutas de onboarding requieren sesión).
- Si la request va dirigida al grupo `(auth)/` (`/login`, `/signup`, etc.), `/auth/callback`, o rutas públicas, el middleware NO SHALL aplicar el redirect de onboarding, independientemente del estado del usuario.

#### Scenario: Usuario autenticado sin onboarding accede al dashboard (web)

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NULL` navega a `/dashboard`
- **THEN** el middleware emite un redirect a `/onboarding/welcome`

#### Scenario: Usuario con onboarding completo accede a /onboarding/done (web)

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NOT NULL` navega a `/onboarding/done`
- **THEN** el middleware deja pasar la request — `/done` se renderiza normalmente

#### Scenario: Usuario sin sesión accede a /onboarding/perfil (web)

- **WHEN** un usuario sin sesión navega a `/onboarding/perfil`
- **THEN** el middleware emite un redirect a `/login`

#### Scenario: Usuario sin onboarding accede a /login (web)

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NULL` navega a `/login`
- **THEN** el middleware NO emite redirect de onboarding (la ruta `/login` queda accesible)
- **AND** la lógica de login puede operar normalmente
