## ADDED Requirements

### Requirement: El middleware redirige al wizard cuando el onboarding no fue completado

El sistema SHALL extender el middleware de Next.js (`apps/web/lib/supabase/middleware.ts`) para que, además de proteger rutas autenticadas, consulte `profiles.onboarding_completed_at` y redirija al wizard cuando corresponda:

- Si la request va dirigida a una ruta del grupo `(app)/` (cualquiera bajo `/dashboard`, `/accounts`, `/cards`, etc.) y el usuario está autenticado pero `onboarding_completed_at IS NULL`, el middleware SHALL emitir un redirect a `/onboarding/welcome`.
- Si la request va dirigida a `/onboarding/*` y el usuario está autenticado, el middleware SHALL dejar pasar la request independientemente del valor de `onboarding_completed_at` (un usuario que ya completó el onboarding puede revisitar `/done` o `/welcome` sin ser redirigido).
- Si la request va dirigida a `/onboarding/*` y el usuario NO está autenticado, el middleware SHALL emitir un redirect a `/login` (las rutas de onboarding requieren sesión).
- Si la request va dirigida al grupo `(auth)/` (`/login`, `/signup`, etc.), `/auth/callback`, o rutas públicas, el middleware NO SHALL aplicar el redirect de onboarding, independientemente del estado del usuario.

#### Scenario: Usuario autenticado sin onboarding accede al dashboard

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NULL` navega a `/dashboard`
- **THEN** el middleware emite un redirect a `/onboarding/welcome`

#### Scenario: Usuario con onboarding completo accede a /onboarding/done

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NOT NULL` navega a `/onboarding/done`
- **THEN** el middleware deja pasar la request — `/done` se renderiza normalmente

#### Scenario: Usuario sin sesión accede a /onboarding/perfil

- **WHEN** un usuario sin sesión navega a `/onboarding/perfil`
- **THEN** el middleware emite un redirect a `/login`

#### Scenario: Usuario sin onboarding accede a /login

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NULL` navega a `/login`
- **THEN** el middleware NO emite redirect de onboarding (la ruta `/login` queda accesible)
- **AND** la lógica de login puede operar normalmente

## MODIFIED Requirements

### Requirement: Las rutas protegidas redirigen a usuarios no autenticados

El sistema SHALL redirigir cualquier request no autenticado que apunte a una ruta bajo `/dashboard`, a cualquier ruta futura bajo el grupo `(app)/`, o a cualquier ruta bajo `/onboarding/` hacia `/login`. La lista de prefijos protegidos SHALL incluir `/onboarding` además de los del grupo `(app)/`.

#### Scenario: Acceso anónimo al dashboard

- **WHEN** un usuario sin sesión navega a `/dashboard`
- **THEN** el middleware emite un redirect a `/login`

#### Scenario: Acceso anónimo al onboarding

- **WHEN** un usuario sin sesión navega a `/onboarding/welcome`
- **THEN** el middleware emite un redirect a `/login`

### Requirement: El selector de "cuenta de pago" en el flujo de pago de resumen filtra según modo de usuario

El sistema SHALL adaptar el selector de "cuenta de pago" en el formulario de pago de resumen según el modo del usuario:

- **Modo novato**: el selector SHALL fijarse a la cuenta `Billetera` (creada por el trigger `on_auth_user_created_default_account` al alta del usuario) sin permitir cambio, ya que en modo novato la UI no expone otras cuentas cash/bank al usuario.
- **Modo experto**: el selector SHALL mostrar todas las cuentas `cash` y `bank` activas del usuario que tengan ARS habilitada.

En ambos modos, el sistema SHALL excluir las cuentas `credit` y las cuentas `bank` con función `ahorro` (cuando ese flag exista).

#### Scenario: Novato paga resumen desde Billetera fija

- **WHEN** un usuario novato abre el flujo de pago de resumen
- **THEN** el campo "Cuenta de pago" muestra "Billetera" en estado read-only

#### Scenario: Experto elige entre todas sus cash/bank

- **WHEN** un usuario experto con 3 cuentas (1 cash, 2 bank) abre el flujo de pago
- **THEN** el campo "Cuenta de pago" muestra un selector con las 3 cuentas como opciones

## REMOVED Requirements

### Requirement: El onboarding en modo novato auto-crea una cuenta cash y una tarjeta default

**Reason**: El flujo de onboarding novato hardcodeado que creaba "Mi plata" (cash) y "Mi tarjeta" (credit) se reemplaza por el nuevo wizard descripto en la capability `onboarding`. El nuevo wizard NO crea tarjeta en onboarding (ver `design.md` Decisión 3 de la change `add-onboarding-post-signup`). La cuenta `Billetera` ya la crea el trigger `on_auth_user_created_default_account` — no se necesita una segunda cuenta cash hardcodeada.

**Migration**: Los requirements equivalentes del nuevo flujo están en `openspec/specs/onboarding/spec.md`. El código viejo (`NovatoOnboardingForm`, `completeNovatoOnboarding`) se elimina como parte de la implementación de la change. Las pocas tarjetas/cuentas hardcodeadas que existen en el ambiente de desarrollo del owner se pueden migrar manualmente o regenerar tras eliminarlas — la migración SQL no requiere DML adicional.

### Requirement: El onboarding novato pide una única fecha para configurar el ciclo de tarjeta

**Reason**: La tarjeta de crédito ya no se crea durante el onboarding y `/onboarding/perfil` ya no contiene una pregunta sobre tarjeta (ver `design.md` Decisión 3 de la change `add-onboarding-post-signup`). La configuración completa de la tarjeta (red, nombre, fechas de cierre/vencimiento, límite) ocurre cuando el usuario navega al módulo `cards` y completa el wizard de creación existente.

**Migration**: El paso `/onboarding/tarjeta` y todos los componentes/actions asociados se eliminan. El cálculo de las cuatro fechas a partir de una sola fecha cargada sigue vigente en el módulo `cards` para casos posteriores (no se elimina esa lógica, solo el paso del onboarding).
