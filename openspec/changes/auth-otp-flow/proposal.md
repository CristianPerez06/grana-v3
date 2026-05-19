## Why

Hoy el flujo de confirmación de signup y el de recuperación de password de la capability `auth` viven solo en web (`apps/web/`) y se apoyan en **links por email** procesados por la ruta `/auth/callback`. Mobile (`apps/mobile/`) todavía no tiene signup ni forgot-password — solo login.

Replicar el flujo de "click en el link del email" en mobile requeriría plumbing de deep links / universal links (esquemas custom en iOS y Android, archivo `apple-app-site-association`, dev/prod schemes distintos en Expo). Eso es más infraestructura de la que justifica el feature, y peor: igualmente haría falta para forgot-password aunque dejáramos auto-confirm activo en signup, así que esquivar la confirmación no nos saca de la complejidad.

La salida más simple es **abandonar los links de email en favor de un código OTP de 8 dígitos**, en ambas plataformas. Misma mecánica para confirm-signup y para recovery, misma UX en web y mobile, sin links que clickear ni deep-link plumbing que mantener. Como Supabase ya emite `{{ .Token }}` (el código numérico, configurado a 8 dígitos en este proyecto) en los mismos emails de hoy, el cambio es de UX y de routing — no de backend.

Además este change desbloquea las pantallas faltantes en mobile (signup y forgot-password), que comparten todo el mental model con el flujo migrado en web.

## What Changes

### Web (`apps/web/`)

- **BREAKING:** se reemplaza la confirmación de signup por link por confirmación por código OTP. El usuario, después de submitear `/signup`, navega a una nueva pantalla de ingreso de código.
- **BREAKING:** se reemplaza la recuperación de password por link/PKCE por recuperación por código OTP. El flujo pasa a tener dos pantallas tras el envío de email: ingreso de código y, después, ingreso de password nuevo.
- **BREAKING:** se elimina la ruta `GET /auth/callback` y todo su comportamiento (verifyOtp por `token_hash`, exchangeCodeForSession, seteo de cookie `recovery_in_progress`). Las dos ramas del callback dejan de existir.
- **BREAKING:** se elimina la cookie `recovery_in_progress` y su limpieza en middleware. La detección de sesión de recovery pasa a apoyarse exclusivamente en el claim `amr=otp` del JWT.
- Se actualiza el formulario de login para detectar el código de Supabase `email_not_confirmed` y ofrecer una acción inline ("reenviar código") que dispara un resend y navega a la pantalla de ingreso de código con el email pre-rellenado.
- La pantalla de ingreso de password nuevo de recovery deja de depender de la cookie `recovery_in_progress`; sigue corriendo client-side y se gatea por la presencia de sesión con `amr=otp`.

### Mobile (`apps/mobile/`)

- Se agrega la pantalla de signup, mirror del web.
- Se agrega la pantalla de ingreso de código para confirmación de signup, con botón de "reenviar código" y cooldown visible.
- Se agrega la pantalla de forgot-password, mirror del web.
- Se agrega la pantalla de ingreso de código para recovery, también con resend + cooldown.
- Se agrega la pantalla de password nuevo, que aparece después de verificar el código de recovery.
- Se actualiza la pantalla de login para detectar `email_not_confirmed` (idéntico a web) y ofrecer la misma acción inline de reenviar código + navegar a la pantalla de ingreso de código con email pre-rellenado.

### Templates de email (`supabase/templates/`)

- **BREAKING:** `confirm-signup.html` deja de incluir `<a href>` con el link de callback; pasa a mostrar solo el código `{{ .Token }}`.
- **BREAKING:** `reset-password.html` deja de incluir `<a href>` con el link de callback; pasa a mostrar solo el código `{{ .Token }}`.
- Ambos templates siguen versionados en el repo y el dashboard de Supabase es mirror manual como hoy.

### Validation (`packages/validation/`)

- Se agrega un schema de Yup para el código OTP (8 dígitos numéricos).

### i18n (`packages/i18n-messages/`)

- Copy nuevo para: pantalla de ingreso de código (signup y recovery), estado de "reenviar código" + cooldown, acción inline de "tu cuenta no está confirmada, reenviar código" en el login, errores específicos (código inválido, expirado, rate-limited).

### Decisiones tomadas (capturadas para futuras consultas)

1. **Una sola mecánica (OTP) para todos los usuarios**, no link en web + OTP en mobile. Los usuarios no saben elegir entre ambas; una única mecánica es más simple.
2. **Forzar re-login tras confirmar signup** en ambas plataformas, igual que hoy en web. El usuario debe probar que sabe el password.
3. **El flujo de recovery es de 2 pantallas** (ingreso de código → ingreso de password nuevo). Eventualmente puede colapsarse a una sola, pero fuera de scope acá.
4. **El input de código OTP es un solo campo de texto** (no 6 boxes con auto-advance). 6 boxes es mejora futura.
5. **Resend vive en la pantalla de ingreso de código**, con cooldown visible. Aplica tanto a confirm-signup como a recovery.
6. **El entry point para "mi cuenta no está confirmada, reenviame el código"** es el formulario de login, no una ruta dedicada. El trigger natural es que el usuario intenta loguearse y Supabase devuelve `email_not_confirmed`.
7. **No se extrae aún ningún componente compartido a `packages/`**. La pantalla de ingreso de código vive duplicada en web y mobile hasta que el patrón de duplicación lo justifique según la regla del proyecto.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `auth`: cambia el mecanismo de confirmación de signup (link → OTP), el mecanismo de recovery (link/PKCE → OTP), se elimina `/auth/callback`, se elimina la cookie `recovery_in_progress`, se incorpora el mecanismo de resend con cooldown, se agrega el entry point de "reenviar código" desde el login, y se extiende el conjunto de scenarios a mobile para signup, forgot-password, recovery y resend (en este change la capability arranca a tener escenarios `(mobile)` para esos flujos además de los `(web)` existentes).

## Impact

### Código afectado

- `apps/web/app/auth/callback/route.ts` — **se borra**.
- `apps/web/app/(auth)/signup/` — el flujo post-submit cambia (navegar a code-entry en vez de mostrar "revisá tu email").
- `apps/web/app/(auth)/forgot-password/` — el flujo post-submit cambia (navegar a code-entry en vez de mostrar "te enviamos un link").
- `apps/web/app/(auth)/reset-password/` — pasa de gate por cookie a gate por sesión `amr=otp`, copy y entry-path actualizados.
- `apps/web/app/(auth)/login/login-form.tsx` — se agrega detección de `email_not_confirmed` y CTA de resend.
- `apps/web/middleware.ts` (o equivalente) — se elimina la rama que setea/limpia `recovery_in_progress`; queda solo la rama que actúa sobre `amr=otp`.
- `apps/web/app/(auth)/` — se agregan dos pantallas nuevas para code-entry (una para signup-confirm y otra para recovery; pueden compartir componente local dentro de `apps/web/`).
- `apps/mobile/app/(auth)/` — se agregan `signup.tsx`, `forgot-password.tsx`, `signup-code.tsx`, `recovery-code.tsx`, `new-password.tsx` (nombres tentativos).
- `apps/mobile/app/(auth)/login.tsx` — se agrega detección de `email_not_confirmed` y CTA de resend, mirror del web.
- `supabase/templates/confirm-signup.html`, `supabase/templates/reset-password.html` — drop link, keep código.
- `packages/validation/src/auth.ts` (o equivalente) — schema para código OTP.
- `packages/i18n-messages/src/*.json` — copy nuevo.

### APIs y dependencias

- Supabase: pasa a usarse `signInWithOtp({ shouldCreateUser: false, ... })` o `resetPasswordForEmail(email)` (sin `redirectTo`) para recovery — a confirmar en design — y `verifyOtp({ email, token, type: 'recovery' | 'signup' })` para verificar el código. `signUp` no requiere `emailRedirectTo` porque ya no hay link.
- No se agregan dependencias nuevas.
- No hay migraciones de base.

### Mirror manual del dashboard

- Al mergear este change hay que pegar los templates actualizados en el dashboard de Supabase, como cualquier otro cambio de templates.
- Si el proyecto de Supabase tiene "Confirm email" deshabilitado por algún motivo histórico, debe quedar habilitado (default).

### Backwards-compatibility durante el deploy

- Una vez deployado este change y actualizados los templates, los links `<a href>` viejos que estén "en vuelo" en bandejas de entrada quedan rotos: la ruta `/auth/callback` ya no existe. El usuario que tenga un email viejo abierto va a ver un 404 — el path de recuperación es pedir un email nuevo (que ahora trae código). Asumimos que el window de impacto es chico y aceptable. Se documenta en tasks.md como nota de deploy.
