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

- **WHEN** un usuario sin sesión navega a `/onboarding/initial-balance`
- **THEN** el middleware emite un redirect a `/login`

#### Scenario: Usuario sin onboarding accede a /login (web)

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NULL` navega a `/login`
- **THEN** el middleware NO emite redirect de onboarding (la ruta `/login` queda accesible)
- **AND** la lógica de login puede operar normalmente
