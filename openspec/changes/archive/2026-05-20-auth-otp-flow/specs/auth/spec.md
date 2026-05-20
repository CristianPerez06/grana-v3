## ADDED Requirements

### Requirement: Los templates de email muestran el código OTP de 8 dígitos sin links

Cada template versionado en `supabase/templates/` SHALL mostrar el código OTP de Supabase (`{{ .Token }}`) de forma visible y NO SHALL incluir ningún `<a href>` que apunte al sitio. La autenticación post-email se hace exclusivamente ingresando el código en la app (web o mobile), nunca por click en un link.

Aplica a:

- `supabase/templates/confirm-signup.html` (confirmación de signup)
- `supabase/templates/reset-password.html` (recuperación de password)

#### Scenario: Template de signup muestra el código

- **WHEN** un colaborador abre `supabase/templates/confirm-signup.html`
- **THEN** el HTML contiene la expresión `{{ .Token }}` renderizada de manera destacada (por ejemplo dentro de un bloque con tipografía grande)
- **AND** NO contiene ningún `<a href="...">` apuntando a `{{ .SiteURL }}` ni a una ruta de la app

#### Scenario: Template de recovery muestra el código

- **WHEN** un colaborador abre `supabase/templates/reset-password.html`
- **THEN** el HTML contiene la expresión `{{ .Token }}` renderizada de manera destacada
- **AND** NO contiene ningún `<a href="...">` apuntando a `{{ .SiteURL }}` ni a una ruta de la app

#### Scenario: Un template que vuelve a incluir un link viola la regla

- **WHEN** un colaborador agrega un `<a href="{{ .SiteURL }}/...">` a cualquiera de los templates de auth
- **THEN** la regla está violada (la app ya no procesa esos links — la ruta `/auth/callback` no existe)
- **AND** el reviewer debe rechazar el cambio

### Requirement: Verificación del código OTP de signup

El sistema SHALL ofrecer una pantalla dedicada de verificación donde el usuario ingresa el código de 8 dígitos recibido por email. Al ingresarlo y enviar el form, el sistema SHALL llamar a `supabase.auth.verifyOtp({ email, token, type: 'signup' })`. Si la verificación es exitosa, el sistema SHALL deslogear al usuario inmediatamente y SHALL navegar al login mostrando un mensaje one-shot de "tu cuenta fue confirmada, iniciá sesión".

La pantalla recibe el email del usuario por estado in-app (no por query string sensible). Si por algún motivo el email no está disponible, la pantalla SHALL ofrecer un input de email antes del input de código.

#### Scenario: Verificación exitosa (web)

- **WHEN** un usuario ingresa un código de 8 dígitos válido en la pantalla `/signup/verify`
- **THEN** el sistema llama a `supabase.auth.verifyOtp({ email, token, type: 'signup' })`
- **AND** llama a `supabase.auth.signOut()` después de un verify exitoso
- **AND** navega a `/login` mostrando "tu cuenta fue confirmada, iniciá sesión"

#### Scenario: Verificación exitosa (mobile)

- **WHEN** un usuario ingresa un código de 8 dígitos válido en la pantalla `signup-verify` de la app mobile
- **THEN** la app llama a `supabase.auth.verifyOtp({ email, token, type: 'signup' })`
- **AND** llama a `supabase.auth.signOut()` después de un verify exitoso
- **AND** navega a `(auth)/login` con un mensaje one-shot "tu cuenta fue confirmada, iniciá sesión"

#### Scenario: Código inválido o expirado

- **WHEN** la llamada a `verifyOtp` devuelve un error con código `invalid_otp` u `otp_expired`
- **THEN** la pantalla muestra el mensaje localizado correspondiente en el área del formulario
- **AND** no se navega fuera de la pantalla
- **AND** no se crea sesión

#### Scenario: Falla de validación de formato del código

- **WHEN** un usuario envía la pantalla de verify con un código que no es exactamente 8 dígitos numéricos
- **THEN** el formulario muestra un error de validación localizado en el campo del código
- **AND** NO llama a Supabase

### Requirement: Verificación del código OTP de recovery

El sistema SHALL ofrecer una pantalla dedicada de verificación de código para el flujo de recovery. Al enviarla, SHALL llamar a `supabase.auth.verifyOtp({ email, token, type: 'recovery' })`. Si la verificación es exitosa, la sesión creada tiene `amr=otp` y el sistema SHALL navegar a la pantalla de ingreso de password nuevo.

#### Scenario: Verificación exitosa de recovery (web)

- **WHEN** un usuario ingresa un código de 8 dígitos válido en la pantalla `/forgot-password/verify`
- **THEN** el sistema llama a `supabase.auth.verifyOtp({ email, token, type: 'recovery' })`
- **AND** Supabase crea una sesión con claim `amr=otp`
- **AND** el sistema navega a `/reset-password`

#### Scenario: Verificación exitosa de recovery (mobile)

- **WHEN** un usuario ingresa un código de 8 dígitos válido en la pantalla `recovery-verify` de la app mobile
- **THEN** la app llama a `supabase.auth.verifyOtp({ email, token, type: 'recovery' })`
- **AND** Supabase crea una sesión con claim `amr=otp`
- **AND** la app navega a `new-password`

#### Scenario: Código de recovery inválido o expirado

- **WHEN** la llamada a `verifyOtp` para recovery devuelve un error con código `invalid_otp` u `otp_expired`
- **THEN** la pantalla muestra el mensaje localizado correspondiente
- **AND** no se navega fuera de la pantalla
- **AND** no se crea sesión

### Requirement: Reenvío del código OTP con cooldown

Las pantallas de verificación de código (tanto signup como recovery, en web y mobile) SHALL ofrecer un botón de "reenviar código". El botón SHALL estar deshabilitado durante un cooldown de 60 segundos contados desde el último envío (que incluye la llamada que disparó la navegación a la pantalla). Durante el cooldown el botón SHALL mostrar los segundos restantes en su label. Tras finalizar el cooldown, el botón se reactiva.

El cooldown lo lleva el cliente. Si Supabase responde con `over_email_send_rate_limit` (porque el cliente perdió el estado y reintentó antes), el sistema SHALL mostrar el mensaje localizado de rate limit y NO SHALL navegar.

El método de reenvío depende del tipo:

- **Signup:** `supabase.auth.resend({ email, type: 'signup' })`.
- **Recovery:** `supabase.auth.resetPasswordForEmail(email)` — idempotente, re-emite el OTP.

#### Scenario: Cooldown visible al aterrizar en la pantalla de verificación

- **WHEN** un usuario aterriza en una pantalla de verificación (signup o recovery) tras un envío exitoso
- **THEN** el botón "reenviar código" aparece deshabilitado
- **AND** su label muestra los segundos restantes hasta el siguiente envío permitido

#### Scenario: Reenvío exitoso tras finalizar el cooldown

- **WHEN** el cooldown llega a cero y el usuario hace click/tap en "reenviar código"
- **THEN** el sistema llama a `supabase.auth.resend` o `supabase.auth.resetPasswordForEmail` según el tipo
- **AND** si Supabase responde OK, el cooldown se reinicia y el botón vuelve a quedar deshabilitado por 60 segundos

#### Scenario: Reenvío rechazado por rate limit del server

- **WHEN** el usuario fuerza un reenvío y Supabase responde con `over_email_send_rate_limit`
- **THEN** la pantalla muestra el mensaje localizado mapeado a esa key
- **AND** no se reinicia el cooldown (el usuario igual ve el contador del intento anterior)
- **AND** no se navega fuera de la pantalla

### Requirement: Reenvío del código de confirmación desde el login

El formulario de login SHALL detectar el error de Supabase con código `email_not_confirmed` y SHALL renderizar, en lugar del mensaje genérico, una acción inline ("reenviar código de confirmación") en el área del formulario. Al activarla, el sistema SHALL llamar a `supabase.auth.resend({ email, type: 'signup' })` y SHALL navegar a la pantalla de verificación de signup con el email pre-rellenado.

Esto aplica en ambas plataformas. No SHALL existir una ruta dedicada de re-confirmación; el login es el único entry point para este flujo.

#### Scenario: Login con cuenta no confirmada ofrece resend (web)

- **WHEN** un usuario envía `/login` con credenciales de una cuenta cuyo email no está confirmado
- **THEN** el formulario muestra un mensaje + un botón "reenviar código de confirmación"
- **AND** el botón usa la key localizada `auth.login.resend_confirmation_code`

#### Scenario: Login con cuenta no confirmada ofrece resend (mobile)

- **WHEN** un usuario envía el form de login en mobile con credenciales de una cuenta cuyo email no está confirmado
- **THEN** la pantalla muestra un mensaje + un botón "reenviar código de confirmación"

#### Scenario: Click en "reenviar" dispara resend y navega (web)

- **WHEN** un usuario clickea el botón "reenviar código de confirmación" tras un login fallido por `email_not_confirmed`
- **THEN** el sistema llama a `supabase.auth.resend({ email, type: 'signup' })` con el email que el usuario acababa de ingresar
- **AND** navega a `/signup/verify?email=<email>` (o el equivalente con estado in-app)
- **AND** el cooldown de 60 segundos arranca al aterrizar en la pantalla

#### Scenario: Tap en "reenviar" dispara resend y navega (mobile)

- **WHEN** un usuario tapea el botón "reenviar código de confirmación" tras un login fallido por `email_not_confirmed`
- **THEN** la app llama a `supabase.auth.resend({ email, type: 'signup' })`
- **AND** navega a la pantalla `signup-verify` con el email cargado en estado
- **AND** el cooldown arranca

### Requirement: Schema de validación del código OTP

`packages/validation` SHALL exportar un schema de Yup que valida que un código OTP es un string de exactamente 8 caracteres, todos dígitos numéricos. La longitud refleja la configuración del proyecto de Grana en el dashboard de Supabase (que setea OTPs de 8 dígitos en lugar del default de 6). El schema SHALL ser reutilizable y SHALL ser usado por todas las pantallas de verificación (signup y recovery, web y mobile) tanto en el cliente como — donde aplique — en server actions.

#### Scenario: Código válido

- **WHEN** el schema recibe el string `"48219347"`
- **THEN** la validación pasa

#### Scenario: Código con letras es rechazado

- **WHEN** el schema recibe el string `"482a9347"`
- **THEN** la validación falla con un error localizable

#### Scenario: Código de longitud incorrecta es rechazado

- **WHEN** el schema recibe un string de 7 o 9 dígitos
- **THEN** la validación falla con un error localizable

## MODIFIED Requirements

### Requirement: Registro de usuario con confirmación de email

El sistema SHALL permitir que un visitante anónimo cree una cuenta ingresando nombre completo, email, password y confirmación de password. Al enviar el formulario con éxito el sistema SHALL crear el usuario en Supabase Auth llamando a `supabase.auth.signUp({ email, password, options: { data: { full_name } } })` (sin `emailRedirectTo`, porque ya no se usan links), SHALL gatillar el email de confirmación con código OTP, y SHALL navegar a la pantalla de verificación de código con el email cargado. El usuario SHALL NOT poder iniciar sesión hasta confirmar el email (estado preservado de la implementación anterior).

#### Scenario: Signup exitoso (web)

- **WHEN** un usuario anónimo envía `/signup` con un nombre completo válido (2–60 caracteres), un email válido, un password de al menos 8 caracteres con al menos una letra y un número, y una confirmación que coincide
- **THEN** el sistema llama a `supabase.auth.signUp` con `options.data.full_name` seteado, sin `emailRedirectTo`
- **AND** Supabase envía el email de confirmación con código OTP
- **AND** el sistema navega a `/signup/verify` con el email en estado
- **AND** no se crea ninguna sesión

#### Scenario: Signup exitoso (mobile)

- **WHEN** un usuario anónimo envía el formulario de signup en mobile con campos válidos
- **THEN** la app llama a `supabase.auth.signUp` con `options.data.full_name` seteado, sin `emailRedirectTo`
- **AND** Supabase envía el email de confirmación con código OTP
- **AND** la app navega a la pantalla `signup-verify` con el email en estado
- **AND** no se crea ninguna sesión

#### Scenario: Email ya registrado

- **WHEN** un usuario anónimo envía el signup con un email que ya existe en `auth.users` (con "Confirm email" activado en Supabase)
- **THEN** el sistema detecta el caso inspeccionando el response — Supabase NO devuelve error en este escenario (es enumeration protection por diseño), pero devuelve un user con el array `identities` vacío
- **AND** el sistema muestra el mensaje localizado bajo la clave `auth.errors.user_already_exists` en el área del formulario
- **AND** no se envía ningún email
- **AND** no se navega a la pantalla de verificación (sería engañosa)

#### Scenario: Falla de validación en signup

- **WHEN** un usuario anónimo envía el signup con al menos un campo inválido (p. ej. password menor a 8 caracteres, confirmación que no coincide)
- **THEN** el formulario muestra mensajes de error localizados por campo
- **AND** el server action (web) o el handler del cliente (mobile) NO llama a Supabase
- **AND** no se envía ningún email

### Requirement: Login con email y password

El sistema SHALL permitir que un usuario confirmado inicie sesión ingresando email y password. Si tiene éxito el sistema SHALL redirigir a la pantalla principal autenticada (en web `/dashboard`, en mobile la ruta `(app)/dashboard`). Si falla el formulario SHALL mostrar un mensaje en el área del formulario, sin usar querystring.

La persistencia de sesión varía por plataforma: web usa cookies HTTP-only manejadas por Supabase server-side; mobile usa `expo-secure-store` como `storage` del cliente de Supabase.

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

### Requirement: Solicitar reset de password

El sistema SHALL permitir que cualquier visitante en la pantalla de forgot-password solicite un reset de password ingresando un email. El sistema SHALL llamar a `supabase.auth.resetPasswordForEmail(email)` SIN parámetro `redirectTo` (ya no se usan links). Supabase responde con un email que contiene el código OTP renderizado por el template `reset-password.html`.

Si la llamada tiene éxito, el sistema SHALL navegar a la pantalla de verificación de código de recovery con el email cargado, sin importar si el email existe o no en `auth.users` (Supabase no distingue ambos casos en su success path, así que la protección contra enumeration es automática).

Si la llamada devuelve un error de plataforma (por ejemplo `over_email_send_rate_limit`), el sistema SHALL surfacear ese error en el formulario usando el mensaje localizado correspondiente y NO SHALL navegar a la pantalla de verificación.

#### Scenario: Solicitud aceptada por Supabase (web)

- **WHEN** un visitante envía `/forgot-password` con un email sintácticamente válido y Supabase acepta la solicitud sin error
- **THEN** el sistema llama a `supabase.auth.resetPasswordForEmail(email)` (sin `redirectTo`)
- **AND** navega a `/forgot-password/verify` con el email en estado
- **AND** el cooldown de 60 segundos arranca al aterrizar

#### Scenario: Solicitud aceptada por Supabase (mobile)

- **WHEN** un visitante envía el form de forgot-password en mobile con un email sintácticamente válido y Supabase acepta la solicitud sin error
- **THEN** la app llama a `supabase.auth.resetPasswordForEmail(email)` (sin `redirectTo`)
- **AND** navega a la pantalla `recovery-verify` con el email en estado
- **AND** el cooldown arranca

#### Scenario: Formato de email inválido

- **WHEN** un visitante envía forgot-password con un email inválido
- **THEN** el formulario muestra un error de validación localizado
- **AND** no se llama a Supabase
- **AND** no se navega

#### Scenario: Rate limit del SMTP de Supabase

- **WHEN** un visitante envía forgot-password y Supabase responde con código `over_email_send_rate_limit`
- **THEN** el formulario muestra el mensaje localizado mapeado para `over_email_send_rate_limit`
- **AND** NO se navega a la pantalla de verificación (sería engañoso porque no se envió ningún email)

### Requirement: Setear password nuevo durante recovery

El sistema SHALL renderizar la pantalla de password nuevo (`/reset-password` en web, `new-password` en mobile) gated por la existencia de una sesión con claim `amr=otp`. Web la renderiza como Client Component (`"use client"`) y verifica del lado del cliente vía `supabase.auth.getUser()` en `useEffect`. Mientras verifica, SHALL mostrar loading. Si NO hay sesión o la sesión no tiene `amr=otp`, SHALL mostrar una card de "este link no es válido o expiró" con un link a `/forgot-password` (web) o navegación equivalente (mobile). Si SÍ hay sesión de recovery, SHALL renderizar un form con dos campos de password (nuevo + confirmar), SHALL llamar a `supabase.auth.updateUser({ password })` y luego a `supabase.auth.signOut()` directamente desde el browser/cliente, y al finalizar SHALL mostrar una card de éxito con un link/botón al login para que el usuario reingrese con el nuevo password.

NOTA: este flujo corre 100% client-side a propósito en web (sin server action). La razón: cuando un server action muta cookies o llama a `signOut`, Next.js invalida y re-renderiza automáticamente la ruta — si esa ruta verificara la sesión server-side, el re-render encontraría que ya no hay sesión y mostraría "enlace inválido" antes de que el éxito pueda renderizarse, desmontando el form en el medio. Hacer todo desde el browser elide ese race entirely. Mobile aplica el mismo principio: el flujo es client-side dentro de la pantalla.

#### Scenario: Actualización exitosa de password (web)

- **WHEN** un usuario en una sesión de recovery (claim `amr=otp`) envía `/reset-password` con un password nuevo (≥8 caracteres, ≥1 letra, ≥1 número) y una confirmación que coincide
- **THEN** la página llama a `supabase.auth.updateUser({ password })` desde el browser
- **AND** si tiene éxito llama a `supabase.auth.signOut()` desde el browser
- **AND** muestra una card de éxito con el copy de `auth.reset.success_title` + `auth.reset.success_body` y un link a `/login`
- **AND** el form de password se desmonta (no es accesible volver a él sin nueva sesión de recovery)

#### Scenario: Actualización exitosa de password (mobile)

- **WHEN** un usuario en una sesión de recovery envía la pantalla `new-password` en mobile con un password nuevo válido y confirmación que coincide
- **THEN** la app llama a `supabase.auth.updateUser({ password })`
- **AND** si tiene éxito llama a `supabase.auth.signOut()`
- **AND** muestra un mensaje de éxito y navega a `(auth)/login`

#### Scenario: Acceso a la pantalla de reset sin sesión de recovery

- **WHEN** un usuario abre la pantalla de password nuevo sin sesión activa de recovery (sin claim `amr=otp`)
- **THEN** la pantalla muestra "este link es inválido o expiró" con un link/CTA a forgot-password
- **AND** no se muestra el form de actualización de password

#### Scenario: Password nuevo no coincide con la confirmación

- **WHEN** un usuario envía la pantalla de password nuevo con `password !== confirmPassword`
- **THEN** el formulario muestra un error de validación localizado en el campo de confirmación
- **AND** no se hace ninguna llamada a Supabase

#### Scenario: Password nuevo igual al actual

- **WHEN** la llamada a `updateUser` devuelve el código de Supabase `same_password`
- **THEN** el formulario muestra el mensaje localizado para `same_password`
- **AND** no se hace signOut

### Requirement: Enforcement de sesión de recovery en el middleware

El sistema SHALL detectar una sesión de recovery vía el claim `amr` del JWT con `method=otp` y SHALL redirigir cualquier request desde una sesión de recovery a `/reset-password` salvo que el request ya esté apuntando a `/reset-password`.

Esta detección NO SHALL usar cookies — el callback `/auth/callback` y la cookie `recovery_in_progress` ya no existen. La única señal autoritativa es el claim del JWT.

#### Scenario: Sesión de recovery intenta llegar al dashboard

- **WHEN** un usuario con claim `amr=otp` en su JWT navega a `/dashboard`
- **THEN** el middleware emite un redirect a `/reset-password`

#### Scenario: Sesión normal navega sin redirección

- **WHEN** un usuario con claim `amr=password` (login normal) navega a `/dashboard`
- **THEN** el middleware NO redirige

#### Scenario: La sesión de recovery puede acceder a su pantalla de destino

- **WHEN** un usuario en sesión de recovery navega a `/reset-password`
- **THEN** el middleware NO redirige fuera

## REMOVED Requirements

### Requirement: Las URLs dentro de los templates coinciden con lo que espera el callback

**Reason:** El callback `/auth/callback` se elimina con este change. Los templates dejan de incluir links — pasan a mostrar solo el código OTP. El nuevo contrato sobre templates está descrito en el requirement "Los templates de email muestran el código OTP de 8 dígitos sin links".

**Migration:** Actualizar `supabase/templates/confirm-signup.html` y `supabase/templates/reset-password.html` para que muestren `{{ .Token }}` en lugar de un `<a href>`. Pegar los nuevos templates en el dashboard de Supabase como mirror manual (regla existente del repo-como-source-of-truth).

### Requirement: Callback de confirmación de email

**Reason:** La confirmación de signup se hace ahora ingresando el código OTP en una pantalla dedicada, no clickeando un link que aterrice en `/auth/callback`. El nuevo contrato está en el requirement "Verificación del código OTP de signup".

**Migration:** Borrar el archivo `apps/web/app/auth/callback/route.ts` (la rama de signup junto con la de recovery — ambas desaparecen en este change). Los emails viejos "en vuelo" con links viejos quedan inertes; el usuario afectado debe pedir un nuevo email.

### Requirement: Callback de recuperación de password

**Reason:** El recovery se hace ahora ingresando el código OTP en una pantalla dedicada y verificando con `verifyOtp({ type: 'recovery' })`. El nuevo contrato está en el requirement "Verificación del código OTP de recovery". La sesión de recovery se crea directamente por `verifyOtp` (con claim `amr=otp`), sin pasar por un `exchangeCodeForSession` ni por una cookie.

**Migration:** Borrar `apps/web/app/auth/callback/route.ts` (la rama de recovery junto con la de signup). Borrar también todo el código que setea la cookie `recovery_in_progress` (en el callback) y que la limpia (en middleware). Los emails viejos con links de recovery "en vuelo" quedan inertes; el usuario afectado debe pedir un nuevo email.
