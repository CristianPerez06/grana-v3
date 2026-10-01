## MODIFIED Requirements

### Requirement: Login con email y password

El sistema SHALL permitir que un usuario confirmado inicie sesión ingresando email y password. Si tiene éxito el sistema SHALL redirigir a la pantalla principal autenticada (en web `/dashboard`, en mobile la ruta `(app)/dashboard`). Si falla el formulario SHALL mostrar un mensaje en el área del formulario, sin usar querystring.

La persistencia de sesión varía por plataforma: web usa cookies HTTP-only manejadas por Supabase server-side; mobile usa `expo-secure-store` como `storage` del cliente de Supabase.

En mobile la sesión SHALL renovarse sola antes de expirar, y SHALL renovarse solo mientras la app está al frente. Cuando la app vuelve al frente, la sesión SHALL renovarse en el acto si expiró o está por expirar, antes de que lo que ve la persona dependa de ella. Si una renovación no llega al servicio de autenticación, la sesión SHALL mantenerse abierta y la renovación SHALL volver a intentarse mientras la app siga al frente.

Si Supabase devuelve el código `email_not_confirmed`, el formulario SHALL mostrar un mensaje específico + una acción inline para reenviar el código de confirmación, según el requirement "Reenvío del código de confirmación desde el login".

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
- **THEN** el sistema muestra el mensaje localizado `auth.errors.email_not_confirmed_with_resend` + un botón inline de reenviar (ver requirement "Reenvío del código de confirmación desde el login")

#### Scenario: Mensaje one-shot post confirmación (web)

- **WHEN** un usuario llega a `/login` después de confirmar su cuenta vía la pantalla de verificación
- **THEN** la página muestra una notificación de éxito "tu cuenta fue confirmada, iniciá sesión"
- **AND** la notificación se descarta en la próxima navegación

#### Scenario: Login exitoso (mobile)

- **WHEN** un usuario confirmado envía el formulario de login en mobile con credenciales correctas
- **THEN** la app llama a `supabase.auth.signInWithPassword`
- **AND** Supabase persiste la sesión en `expo-secure-store` via el adapter configurado en `apps/mobile/lib/supabase.ts`
- **AND** el listener `onAuthStateChange` en el root layout recibe el evento `SIGNED_IN` y redirige a `(app)/dashboard`

#### Scenario: Credenciales inválidas (mobile)

- **WHEN** un usuario envía el formulario de login en mobile con email desconocido o password incorrecto
- **THEN** la pantalla muestra el mensaje de error mapeado en el área del formulario
- **AND** no se crea ninguna sesión
- **AND** la app permanece en `(auth)/login`

#### Scenario: Email todavía no confirmado (mobile)

- **WHEN** un usuario envía el formulario de login en mobile con credenciales de una cuenta cuyo email no está confirmado
- **THEN** la pantalla muestra el mensaje `auth.errors.email_not_confirmed_with_resend` + un botón inline de reenviar (ver requirement "Reenvío del código de confirmación desde el login")

#### Scenario: Mensaje one-shot post confirmación (mobile)

- **WHEN** un usuario llega a la pantalla de login en mobile después de confirmar su cuenta vía la pantalla de verificación
- **THEN** la pantalla muestra una notificación de éxito "tu cuenta fue confirmada, iniciá sesión"
- **AND** la notificación se descarta en la próxima navegación

#### Scenario: Persistencia de sesión entre reinicios (mobile)

- **WHEN** un usuario autenticado en mobile cierra completamente la app y la vuelve a abrir
- **THEN** `app/index.tsx` resuelve `supabase.auth.getSession()` con la sesión persistida en `expo-secure-store`
- **AND** emite `<Redirect href="/(app)/dashboard" />` sin pasar por la pantalla de login

#### Scenario: Volver a la app después de más de una hora (mobile)

- **WHEN** un usuario autenticado manda la app de mobile a segundo plano
- **AND** la vuelve a traer al frente más de una hora después
- **THEN** sigue con la sesión iniciada, sin pasar por la pantalla de login
- **AND** la pantalla en la que estaba carga sus datos sin error

#### Scenario: Volver a la app sin conexión (mobile)

- **WHEN** un usuario autenticado trae la app de mobile al frente después de que su sesión expiró
- **AND** no hay conexión
- **THEN** sigue con la sesión iniciada
- **AND** la sesión se renueva sola cuando vuelve la conexión, sin que toque nada
