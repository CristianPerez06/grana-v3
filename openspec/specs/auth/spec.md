# auth Specification

## Purpose
TBD - created by archiving change version-email-templates. Update Purpose after archive.
## Requirements
### Requirement: Los templates de email viven versionados en el repo

Los templates de email que dispara Supabase para los flujos de auth de esta app SHALL estar versionados bajo `supabase/templates/<nombre>.html`. Esa carpeta es la **fuente de verdad**; el dashboard de Supabase es un mirror manual hasta que se adopte el CLI oficial. Cualquier cambio a un template SHALL hacerse primero en el repo y luego copiarse al dashboard. Si el dashboard y el repo divergen, el contenido del repo gana — la resolución es sobrescribir el dashboard, nunca al revés.

La regla aplica como mínimo a los templates que la app usa hoy:

- `supabase/templates/confirm-signup.html` (template "Confirm signup" del dashboard)
- `supabase/templates/reset-password.html` (template "Reset password" del dashboard)

Los otros templates default de Supabase (Magic Link, Invite User, Change Email Address, Reauthentication) NO están bajo esta regla mientras la app no los use.

#### Scenario: Existe un archivo en el repo por cada template usado por la app

- **WHEN** un colaborador inspecciona `supabase/templates/`
- **THEN** encuentra al menos `confirm-signup.html` y `reset-password.html`
- **AND** ambos archivos contienen el HTML completo del body del template correspondiente en el dashboard

#### Scenario: Un cambio a un template se origina en el repo

- **WHEN** un colaborador (humano o LLM) necesita modificar el copy o el HTML de un template
- **THEN** edita el archivo bajo `supabase/templates/`
- **AND** hace commit
- **AND** copia el contenido actualizado al dashboard de Supabase manualmente

#### Scenario: Divergencia entre repo y dashboard se resuelve a favor del repo

- **WHEN** se detecta que el contenido del dashboard difiere del archivo correspondiente en el repo
- **THEN** la resolución es pegar el contenido del repo en el dashboard
- **AND** nunca al revés (el repo no se actualiza desde el dashboard)

### Requirement: Las URLs dentro de los templates coinciden con lo que espera el callback

Cada template versionado en `supabase/templates/` SHALL contener al menos un enlace `<a href="...">` cuyo URL tenga la forma exacta que `/auth/callback` puede procesar correctamente. En particular:

- `confirm-signup.html` SHALL contener un enlace con shape `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`.
- `reset-password.html` SHALL contener un enlace con shape `{{ .SiteURL }}/auth/callback?code={{ .Token }}&next=/reset-password`.

Los templates SHALL NOT usar el helper `{{ .ConfirmationURL }}` de Supabase para el flujo de recovery, porque esa URL no incluye `next=/reset-password` y rompe la detección de sesión de recovery en `/auth/callback` y en el middleware.

#### Scenario: Template de signup usa token_hash y type=signup

- **WHEN** un colaborador abre `supabase/templates/confirm-signup.html`
- **THEN** encuentra al menos un enlace cuyo `href` matchea `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`

#### Scenario: Template de recovery usa code y next=/reset-password

- **WHEN** un colaborador abre `supabase/templates/reset-password.html`
- **THEN** encuentra al menos un enlace cuyo `href` matchea `{{ .SiteURL }}/auth/callback?code={{ .Token }}&next=/reset-password`

#### Scenario: Un template que vuelve al default de Supabase viola la regla

- **WHEN** un colaborador revierte el template de recovery a usar `{{ .ConfirmationURL }}`
- **THEN** la regla está violada porque esa URL no incluye `next=/reset-password`
- **AND** el flujo de recovery se rompe (el callback no setea la cookie `recovery_in_progress` y el usuario termina en `/dashboard` en vez de `/reset-password`)
- **AND** el reviewer debe rechazar el cambio

### Requirement: Registro de usuario con confirmación de email

El sistema SHALL permitir que un visitante anónimo cree una cuenta en `/signup` ingresando nombre completo, email, password y confirmación de password. Al enviar el formulario con éxito el sistema SHALL crear el usuario en Supabase Auth, enviar un email de confirmación y mostrar una pantalla de "revisá tu email". El usuario SHALL NOT poder iniciar sesión hasta confirmar el email.

#### Scenario: Signup exitoso

- **WHEN** un usuario anónimo envía `/signup` con un nombre completo válido (2–60 caracteres), un email válido, un password de al menos 8 caracteres con al menos una letra y un número, y una confirmación que coincide
- **THEN** el sistema llama a `supabase.auth.signUp` con `options.data.full_name` seteado
- **AND** Supabase envía el email de confirmación
- **AND** se le muestra al usuario una pantalla de confirmación indicándole que revise su bandeja de entrada
- **AND** no se crea ninguna sesión

#### Scenario: Email ya registrado

- **WHEN** un usuario anónimo envía `/signup` con un email que ya existe en `auth.users` (con "Confirm email" activado en Supabase)
- **THEN** el sistema detecta el caso inspeccionando el response — Supabase NO devuelve error en este escenario (es enumeration protection por diseño), pero devuelve un user con el array `identities` vacío
- **AND** el sistema muestra el mensaje localizado bajo la clave `auth.errors.user_already_exists` en el área del formulario
- **AND** no se envía ningún email
- **AND** la pantalla "revisá tu email" NO se muestra (sería engañosa)

#### Scenario: Falla de validación en signup

- **WHEN** un usuario anónimo envía `/signup` con al menos un campo inválido (p. ej. password menor a 8 caracteres, confirmación que no coincide)
- **THEN** el formulario muestra mensajes de error localizados por campo
- **AND** el server action NO llama a Supabase
- **AND** no se envía ningún email

### Requirement: Callback de confirmación de email

El sistema SHALL exponer `GET /auth/callback` que maneje la confirmación de signup extrayendo `token_hash` y `type=signup` del query string, llamando a `supabase.auth.verifyOtp`, deslogueando al usuario inmediatamente y redirigiendo a `/login?message=account_confirmed`.

#### Scenario: Confirmación exitosa

- **WHEN** un usuario abre un link de confirmación con shape `/auth/callback?token_hash=<hash>&type=signup`
- **THEN** el sistema llama a `supabase.auth.verifyOtp({ type: 'signup', token_hash })`
- **AND** llama a `supabase.auth.signOut()` después de un verify exitoso
- **AND** redirige a `/login?message=account_confirmed`

#### Scenario: Token de confirmación inválido o expirado

- **WHEN** la llamada a `verifyOtp` devuelve un error (token expirado o adulterado)
- **THEN** el sistema redirige a `/login?error=auth_callback_failed`
- **AND** no se crea ninguna sesión

### Requirement: Login con email y password

El sistema SHALL permitir que un usuario confirmado inicie sesión en `/login` ingresando email y password. Si tiene éxito el sistema SHALL redirigir a `/dashboard`. Si falla el formulario SHALL mostrar un mensaje localizado en el área del formulario, sin usar querystring.

#### Scenario: Login exitoso

- **WHEN** un usuario confirmado envía `/login` con credenciales correctas
- **THEN** el sistema llama a `supabase.auth.signInWithPassword`
- **AND** se setea una cookie de sesión
- **AND** el usuario es redirigido a `/dashboard`

#### Scenario: Credenciales inválidas

- **WHEN** un usuario envía `/login` con un email desconocido o un password incorrecto
- **THEN** el sistema muestra un único mensaje genérico localizado ("credenciales inválidas") en el área del formulario
- **AND** no se crea ninguna sesión
- **AND** la URL NO incluye `?error=...`

#### Scenario: Email todavía no confirmado

- **WHEN** un usuario envía `/login` con credenciales de una cuenta cuyo email no está confirmado
- **THEN** el sistema muestra el mensaje localizado mapeado desde el código de Supabase `email_not_confirmed`

#### Scenario: Mensaje one-shot desde el callback

- **WHEN** un usuario llega a `/login?message=account_confirmed` (después de confirmar vía email)
- **THEN** la página muestra una notificación de éxito "Tu cuenta fue confirmada, iniciá sesión"
- **AND** la notificación se descarta en la próxima navegación

### Requirement: Logout desde el área autenticada

El sistema SHALL renderizar un botón de logout en el header de toda ruta bajo `(app)/`. Al activarlo el sistema SHALL invalidar la sesión de Supabase y redirigir a `/login`.

#### Scenario: Logout desde el dashboard

- **WHEN** un usuario autenticado clickea el botón de logout en el header
- **THEN** el sistema llama a `supabase.auth.signOut()`
- **AND** el usuario es redirigido a `/login`
- **AND** la navegación posterior a `/dashboard` redirige de vuelta a `/login`

### Requirement: Solicitar reset de password

El sistema SHALL permitir que cualquier visitante en `/forgot-password` solicite un reset de password ingresando un email. El sistema SHALL llamar a `supabase.auth.resetPasswordForEmail` con `redirectTo` hardcodeado a `${origin}/auth/callback?next=/reset-password`.

Si la llamada a Supabase tiene éxito, el sistema SHALL renderizar la misma pantalla de confirmación sin importar si el email existe o no (Supabase no distingue entre ambos casos en su success path, así que esta protección contra enumeration es automática).

Si la llamada a Supabase devuelve un error de plataforma (por ejemplo rate limit del SMTP, problemas de envío, código `over_email_send_rate_limit`), el sistema SHALL surfacear ese error en el formulario usando el mensaje localizado correspondiente. Estos errores son seguros de mostrar — no leakean información sobre la existencia de la cuenta, son condiciones globales del proyecto.

#### Scenario: Solicitud aceptada por Supabase

- **WHEN** un visitante envía `/forgot-password` con un email sintácticamente válido y Supabase acepta la solicitud sin error
- **THEN** el sistema llama a `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<origin>/auth/callback?next=/reset-password' })`
- **AND** la página muestra "Si el email está registrado, te enviamos un link"
- **AND** el mensaje es idéntico exista o no el email en `auth.users`

#### Scenario: Formato de email inválido

- **WHEN** un visitante envía `/forgot-password` con un email inválido
- **THEN** el formulario muestra un error de validación localizado
- **AND** no se envía ningún email

#### Scenario: Rate limit del SMTP de Supabase

- **WHEN** un visitante envía `/forgot-password` y Supabase responde con código `over_email_send_rate_limit` (o equivalente)
- **THEN** el formulario muestra el mensaje localizado mapeado para `over_email_send_rate_limit`
- **AND** la pantalla de "te enviamos un link" NO se muestra (sería engañoso porque no se envió ningún email)

### Requirement: Callback de recuperación de password

El sistema SHALL exponer `GET /auth/callback` que, cuando se lo llama con `code` y `next=/reset-password`, intercambie el código por una sesión vía `supabase.auth.exchangeCodeForSession`, setee una cookie httpOnly `recovery_in_progress=1` con TTL de 10 minutos y redirija a `/reset-password`.

#### Scenario: Intercambio de recovery exitoso

- **WHEN** un usuario abre un link de recovery con shape `/auth/callback?code=<code>&next=/reset-password`
- **THEN** el sistema llama a `supabase.auth.exchangeCodeForSession(code)`
- **AND** si tiene éxito setea la cookie `recovery_in_progress=1` con atributos: `httpOnly=true`, `secure=true`, `sameSite=lax`, `maxAge=600`, `path=/`
- **AND** redirige a `/reset-password`

#### Scenario: Code de recovery expirado o inválido

- **WHEN** la llamada a `exchangeCodeForSession` devuelve un error
- **THEN** el sistema redirige a `/login?error=auth_callback_failed`
- **AND** no se setea la cookie de recovery

### Requirement: Setear password nuevo durante recovery

El sistema SHALL renderizar `/reset-password` como un Client Component (`"use client"`). La página SHALL verificar del lado del cliente, en `useEffect`, si hay una sesión activa (vía `supabase.auth.getUser()` con el browser client). Mientras verifica, SHALL mostrar un estado de loading. Si NO hay sesión, SHALL mostrar una card de "enlace inválido o expirado" con un link a `/forgot-password`. Si SÍ hay sesión, SHALL renderizar un form con dos campos de password (nuevo + confirmar), llamar a `supabase.auth.updateUser({ password })` y luego a `supabase.auth.signOut()` directamente desde el browser, y al finalizar mostrar una card de éxito con un link/botón a `/login` para que el usuario reingrese con el nuevo password.

NOTA importante: este flujo se hace 100% client-side a propósito. No usa server action. La razón: cuando un server action muta cookies o llama a `signOut`, Next.js invalida y re-renderiza automáticamente la ruta — si esa ruta es un Server Component que verifica `isRecovery`, el re-render encuentra que ya no hay sesión y muestra "enlace inválido" antes de que el éxito pueda renderizarse, desmontando el form en el medio. Hacer todo desde el browser elide ese race entirely. La cookie `recovery_in_progress` no se limpia explícitamente acá — el middleware la limpia en el próximo request donde detecte `amr=password` (login fresco).

#### Scenario: Actualización exitosa de password

- **WHEN** un usuario autenticado en una sesión de recovery envía `/reset-password` con un password nuevo (≥8 caracteres, ≥1 letra, ≥1 número) y una confirmación que coincide
- **THEN** la página llama a `supabase.auth.updateUser({ password })` desde el browser
- **AND** si tiene éxito llama a `supabase.auth.signOut()` desde el browser
- **AND** muestra una card de éxito con el copy de `auth.reset.success_title` + `auth.reset.success_body` y un link a `/login`
- **AND** el form de password se desmonta (no es accesible volver a él sin nueva sesión de recovery)
- **AND** la cookie `recovery_in_progress` se limpia más tarde por el middleware al detectar un login fresco con `amr=password`

#### Scenario: Acceso a la página de reset sin sesión de recovery

- **WHEN** un usuario abre `/reset-password` sin sesión activa de recovery (sin cookie y sin claim `amr=otp`)
- **THEN** la página muestra "Este link es inválido o expiró" con un link a `/forgot-password`
- **AND** no se muestra el form de actualización de password

#### Scenario: Password nuevo no coincide con la confirmación

- **WHEN** un usuario envía `/reset-password` con `password !== confirmPassword`
- **THEN** el formulario muestra un error de validación localizado en el campo de confirmación
- **AND** no se hace ninguna llamada a Supabase

#### Scenario: Password nuevo igual al actual

- **WHEN** la llamada a `updateUser` devuelve el código de Supabase `same_password`
- **THEN** el formulario muestra el mensaje localizado para `same_password`
- **AND** no se hace signOut

### Requirement: Enforcement de sesión de recovery en el middleware

El sistema SHALL detectar una sesión de recovery vía dos señales independientes — la cookie `recovery_in_progress` y el claim `amr` del JWT con `method=otp` — y SHALL redirigir cualquier request desde una sesión de recovery a `/reset-password` salvo que el request ya esté apuntando a `/reset-password` o `/auth/`.

#### Scenario: Sesión de recovery intenta llegar al dashboard

- **WHEN** un usuario con cookie `recovery_in_progress=1` o claim `amr=otp` navega a `/dashboard`
- **THEN** el middleware emite un redirect a `/reset-password`

#### Scenario: Cookie stale limpiada en un login fresco con password

- **WHEN** un usuario inicia sesión con email + password y el JWT resultante tiene `amr=password` pero el request todavía trae una cookie stale `recovery_in_progress=1`
- **THEN** el middleware limpia la cookie (la setea con `maxAge=0`)
- **AND** NO redirige al usuario a `/reset-password`

#### Scenario: La sesión de recovery puede acceder a /auth/

- **WHEN** un usuario en sesión de recovery navega a `/auth/callback`
- **THEN** el middleware NO redirige fuera (el callback está permitido)

### Requirement: Las rutas protegidas redirigen a usuarios no autenticados

El sistema SHALL redirigir cualquier request no autenticado que apunte a una ruta bajo `/dashboard` o a cualquier ruta futura bajo el grupo `(app)/` hacia `/login`.

#### Scenario: Acceso anónimo al dashboard

- **WHEN** un usuario sin sesión navega a `/dashboard`
- **THEN** el middleware emite un redirect a `/login`

### Requirement: Los server actions devuelven un resultado tipado, nunca querystrings de error

Cada server action de auth (`loginAction`, `signupAction`, `requestPasswordResetAction`) SHALL devolver un objeto con shape `{ ok: true } | { ok: false, fieldErrors?, formError? }`. Los actions SHALL NOT redirigir a `/login?error=...` para reportar fallas. Los paths de éxito PUEDEN redirigir (p. ej. `loginAction` → `/dashboard`).

NOTA: el flujo de `/reset-password` NO usa server action — corre 100% client-side desde el browser por las razones explicadas en el requirement de "Setear password nuevo durante recovery".

#### Scenario: loginAction devuelve formError ante credenciales inválidas

- **WHEN** se invoca `loginAction` con credenciales que Supabase rechaza
- **THEN** devuelve `{ ok: false, formError: '<mensaje localizado de invalid_credentials>' }`
- **AND** NO llama a `redirect('/login?error=...')`

#### Scenario: signupAction devuelve fieldErrors ante falla de validación

- **WHEN** se invoca `signupAction` con input que falla la validación de Yup en el server
- **THEN** devuelve `{ ok: false, fieldErrors: { email?: '...', password?: '...', ... } }`
- **AND** NO llama a Supabase

### Requirement: Schemas de validación unificados compartidos entre cliente y server

El sistema SHALL definir los schemas de Yup en `lib/validation/auth.ts` y usarlos tanto en el formulario del cliente (`react-hook-form` + `yupResolver`) como en el server action correspondiente (revalidando el input). Las reglas de validación SHALL NOT estar duplicadas.

#### Scenario: La validación del cliente coincide con la del server

- **WHEN** un desarrollador cambia el mínimo de password en `lib/validation/auth.ts` de 8 a 10
- **THEN** tanto el envío del form del cliente como la validación del server action rechazan passwords menores a 10 caracteres
- **AND** no hace falta tocar ningún otro archivo para mantenerlos alineados

### Requirement: Mensajes de error de Supabase localizados

El sistema SHALL mapear los códigos de error de auth de Supabase a claves del catálogo i18n a través de `lib/supabase/errors.ts`. Los códigos desconocidos SHALL caer a un mensaje genérico.

#### Scenario: Un código conocido de Supabase se mapea

- **WHEN** Supabase devuelve un error de auth con `code='invalid_credentials'`
- **THEN** el action muestra el mensaje localizado bajo la clave `auth.errors.invalid_credentials`

#### Scenario: Un código desconocido de Supabase cae al fallback

- **WHEN** Supabase devuelve un error de auth con un código que no está en el mapeo
- **THEN** el action muestra el mensaje localizado bajo la clave `auth.errors.generic`

### Requirement: El route group de auth tiene un layout dedicado

Las rutas `/login`, `/signup`, `/forgot-password` y `/reset-password` SHALL compartir un único layout (en `app/(auth)/layout.tsx`) que renderiza el shell de auth (card centrada sobre un fondo limpio). El layout del dashboard SHALL NOT renderizarse para estas rutas.

#### Scenario: Login usa el shell de auth

- **WHEN** un usuario navega a `/login`
- **THEN** la página se renderiza dentro del layout `(auth)` (card centrada, sin header de logout)

#### Scenario: Dashboard usa el shell de app

- **WHEN** un usuario autenticado navega a `/dashboard`
- **THEN** la página se renderiza dentro del layout `(app)` (header con logout, sin card centrada)

