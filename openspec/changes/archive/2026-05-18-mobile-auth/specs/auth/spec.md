## MODIFIED Requirements

### Requirement: Login con email y password

El sistema SHALL permitir que un usuario confirmado inicie sesión ingresando email y password. Si tiene éxito el sistema SHALL redirigir a la pantalla principal autenticada (en web `/dashboard`, en mobile la ruta `(app)/dashboard`). Si falla el formulario SHALL mostrar un mensaje en el área del formulario, sin usar querystring.

La persistencia de sesión varía por plataforma: web usa cookies HTTP-only manejadas por Supabase server-side; mobile usa `expo-secure-store` como `storage` del cliente de Supabase.

#### Scenario: Login exitoso (web)

- **WHEN** un usuario confirmado envía `/login` con credenciales correctas
- **THEN** el sistema llama a `supabase.auth.signInWithPassword`
- **AND** se setea una cookie de sesión
- **AND** el usuario es redirigido a `/dashboard`

#### Scenario: Credenciales inválidas (web)

- **WHEN** un usuario envía `/login` con un email desconocido o un password incorrecto
- **THEN** el sistema muestra un único mensaje genérico localizado ("credenciales inválidas") en el área del formulario
- **AND** no se crea ninguna sesión
- **AND** la URL NO incluye `?error=...`

#### Scenario: Email todavía no confirmado (web)

- **WHEN** un usuario envía `/login` con credenciales de una cuenta cuyo email no está confirmado
- **THEN** el sistema muestra el mensaje localizado mapeado desde el código de Supabase `email_not_confirmed`

#### Scenario: Mensaje one-shot desde el callback (web)

- **WHEN** un usuario llega a `/login?message=account_confirmed` (después de confirmar vía email)
- **THEN** la página muestra una notificación de éxito "Tu cuenta fue confirmada, iniciá sesión"
- **AND** la notificación se descarta en la próxima navegación

#### Scenario: Login exitoso (mobile)

- **WHEN** un usuario confirmado envía el formulario de login en mobile con credenciales correctas
- **THEN** la app llama a `supabase.auth.signInWithPassword`
- **AND** Supabase persiste la sesión en `expo-secure-store` via el adapter configurado en `apps/mobile/lib/supabase.ts`
- **AND** el listener `onAuthStateChange` en el root layout recibe el evento `SIGNED_IN` y redirige a `(app)/dashboard`

#### Scenario: Credenciales inválidas (mobile)

- **WHEN** un usuario envía el formulario de login en mobile con email desconocido o password incorrecto
- **THEN** la pantalla muestra el mensaje de error devuelto por Supabase en el área del formulario (componente `<FormError />`)
- **AND** no se crea ninguna sesión
- **AND** la app permanece en `(auth)/login`

Nota: el mensaje se muestra raw (en inglés) en este change. La localización via `mapSupabaseError(error, t)` aterriza con el change de i18n en mobile.

#### Scenario: Persistencia de sesión entre reinicios (mobile)

- **WHEN** un usuario autenticado en mobile cierra completamente la app y la vuelve a abrir
- **THEN** `app/index.tsx` resuelve `supabase.auth.getSession()` con la sesión persistida en `expo-secure-store`
- **AND** emite `<Redirect href="/(app)/dashboard" />` sin pasar por la pantalla de login

### Requirement: Logout desde el área autenticada

El sistema SHALL ofrecer una forma de cerrar sesión desde el área autenticada. Al activarla el sistema SHALL invalidar la sesión de Supabase y redirigir al área no autenticada.

En web, el control vive como botón en el header de toda ruta bajo `(app)/`. En mobile, el control vive como botón dentro de la pantalla de dashboard (no hay header global por ahora).

#### Scenario: Logout desde el dashboard (web)

- **WHEN** un usuario autenticado clickea el botón de logout en el header
- **THEN** el sistema llama a `supabase.auth.signOut()`
- **AND** el usuario es redirigido a `/login`
- **AND** la navegación posterior a `/dashboard` redirige de vuelta a `/login`

#### Scenario: Logout desde el dashboard (mobile)

- **WHEN** un usuario autenticado en mobile toca el botón "Cerrar sesión" dentro de `(app)/dashboard`
- **THEN** la app llama a `supabase.auth.signOut()`
- **AND** el listener `onAuthStateChange` en el root layout recibe `SIGNED_OUT` y redirige a `(auth)/login`
- **AND** `expo-secure-store` queda sin tokens persistidos para el próximo arranque
