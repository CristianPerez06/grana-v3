## 1. Shared foundations

- [x] 1.1 Agregar `otpCodeSchema` (Yup, exactamente 8 dígitos numéricos) en `packages/validation/src/` y exportarlo desde el barrel del package
- [x] 1.2 Agregar las keys i18n nuevas en `packages/i18n-messages/src/*.json` (todas las locales): `auth.verify.*`, `auth.resend.*`, `auth.login.resend_confirmation_code`, `auth.errors.email_not_confirmed_with_resend`, `auth.errors.invalid_otp`, `auth.errors.otp_expired`, y asegurarse de que `auth.errors.over_email_send_rate_limit` exista
- [x] 1.3 Verificar que el mapeo de errores de Supabase a keys i18n (en web: `apps/web/lib/supabase/errors.ts`, y su equivalente en mobile) incluya los códigos `invalid_otp`, `otp_expired` y `over_email_send_rate_limit`

## 2. Email templates

- [x] 2.1 Reescribir `supabase/templates/confirm-signup.html` para mostrar `{{ .Token }}` de forma destacada y eliminar todos los `<a href>`
- [x] 2.2 Reescribir `supabase/templates/reset-password.html` para mostrar `{{ .Token }}` de forma destacada y eliminar todos los `<a href>`
- [x] 2.3 Documentar en el cuerpo del PR (no en código) que al mergear este change hay que pegar los dos templates actualizados en el dashboard de Supabase

## 3. Web — eliminar el callback y la cookie

- [x] 3.1 Borrar `apps/web/app/auth/callback/route.ts` y la carpeta vacía resultante
- [x] 3.2 Eliminar de `apps/web/middleware.ts` (o equivalente) la rama que setea/limpia la cookie `recovery_in_progress`; mantener solamente la detección por claim `amr=otp`
- [x] 3.3 Hacer un grep del repo por `recovery_in_progress` y por `auth/callback` y limpiar cualquier referencia residual (incluyendo i18n keys huérfanas asociadas al callback, si las hubiera)

## 4. Web — pantallas de verificación de código (signup y recovery)

- [x] 4.1 Crear el componente `<OtpVerifyForm />` en `apps/web/app/(auth)/_components/` (o ubicación equivalente) parametrizado por `type: 'signup' | 'recovery'`: input de código (un solo text input), botón submit, botón resend con cooldown, manejo de errores. Reusa `otpCodeSchema` y los componentes UI existentes (`FormField`, `SubmitButton`, `Alert`)
- [x] 4.2 Crear `apps/web/app/(auth)/signup/verify/page.tsx` + `verify-form.tsx`: monta `<OtpVerifyForm type="signup" />`, espera email en estado (`useSearchParams` o store local); en éxito, llama a `signOut` y `router.replace('/login?message=account_confirmed')`
- [x] 4.3 Crear `apps/web/app/(auth)/forgot-password/verify/page.tsx` + `verify-form.tsx`: monta `<OtpVerifyForm type="recovery" />`; en éxito, `router.replace('/reset-password')`
- [x] 4.4 Implementar el cooldown del resend en `<OtpVerifyForm />` con `useEffect` + `setInterval`, default 60s, contador visible en el label del botón

## 5. Web — actualizar pantallas existentes

- [x] 5.1 Modificar `apps/web/app/(auth)/signup/signup-form.tsx`: tras submit exitoso, navegar a `/signup/verify` con el email en estado (en lugar del Alert "revisá tu email"). El server action `signupAction` ya no necesita devolver el "submitted" flag de la misma manera — ajustar el contrato si conviene
- [x] 5.2 Modificar el server action de signup (`apps/web/app/_actions/signup.ts`) para llamar a `signUp` sin `emailRedirectTo`; mantener la detección de `identities: []` (email ya registrado)
- [x] 5.3 Modificar `apps/web/app/(auth)/forgot-password/forgot-password-form.tsx`: tras submit exitoso, navegar a `/forgot-password/verify` con el email en estado; ajustar el server action correspondiente para llamar a `resetPasswordForEmail(email)` sin `redirectTo`
- [x] 5.4 Modificar `apps/web/app/(auth)/login/login-form.tsx`: cuando la respuesta del server action tenga `formError === auth.errors.email_not_confirmed`, renderizar la variante con CTA inline ("reenviar código"); al click, llamar a `supabase.auth.resend({ email, type: 'signup' })` y `router.push('/signup/verify')` con el email en estado
- [x] 5.5 Modificar `apps/web/app/(auth)/reset-password/page.tsx` para gatear solo por sesión con claim `amr=otp` (eliminar cualquier lectura/dependencia de la cookie `recovery_in_progress`)

## 6. Mobile — pantallas nuevas

- [x] 6.1 Crear `apps/mobile/app/(auth)/signup.tsx` con el form de signup (nombre, email, password, confirm), reusa `signupSchema` de `@grana/validation`; al submit, llama a `supabase.auth.signUp` (sin `emailRedirectTo`) y navega a `signup-verify`
- [x] 6.2 Crear el componente `<OtpVerifyForm />` en `apps/mobile/components/` parametrizado por `type`, equivalente al de web pero con UI de NativeWind. Reusa `otpCodeSchema`
- [x] 6.3 Crear `apps/mobile/app/(auth)/signup-verify.tsx`: monta `<OtpVerifyForm type="signup" />`, recibe email por estado/params; en éxito, `signOut` y `router.replace('/(auth)/login')` con un toast/state one-shot "tu cuenta fue confirmada, iniciá sesión"
- [x] 6.4 Crear `apps/mobile/app/(auth)/forgot-password.tsx`: form de email; al submit, llama a `resetPasswordForEmail(email)` y navega a `recovery-verify`
- [x] 6.5 Crear `apps/mobile/app/(auth)/recovery-verify.tsx`: monta `<OtpVerifyForm type="recovery" />`; en éxito, navega a `new-password`
- [x] 6.6 Crear `apps/mobile/app/(auth)/new-password.tsx`: gateada por sesión con `amr=otp`, form de password nuevo + confirmación; al submit, `updateUser({ password })` → `signOut()` → navegar a login con mensaje de éxito

## 7. Mobile — actualizar login

- [x] 7.1 Modificar `apps/mobile/app/(auth)/login.tsx` para detectar `error.code === 'email_not_confirmed'` y renderizar la variante con CTA inline ("reenviar código")
- [x] 7.2 Implementar el handler del CTA en mobile login: `supabase.auth.resend({ email, type: 'signup' })` y `router.push('/(auth)/signup-verify')` con el email en estado

## 8. Mobile — wiring de navegación y mensaje one-shot

- [x] 8.1 Definir la estrategia para pasar el email entre pantallas (params de `expo-router` vs. store local — preferir params para evitar global state). Aplicar uniformemente
- [x] 8.2 Implementar el mecanismo de mensaje one-shot "tu cuenta fue confirmada" en la pantalla de login mobile (puede ser via params descartables, una flag en local state, o un componente de toast)
- [x] 8.3 Verificar que el `onAuthStateChange` del root layout (`apps/mobile/app/_layout.tsx`) NO redirija fuera de las pantallas de auth durante el flujo de recovery (sesión con `amr=otp` debe quedar en `(auth)/new-password`, no saltar a `(app)/dashboard`)

## 9. QA manual end-to-end

- [x] 9.1 Web — signup happy path: `/signup` → recibo email con código → ingreso código en `/signup/verify` → login redirige a `/dashboard`
- [x] 9.2 Web — signup con código inválido: muestra error sin navegar
- [x] 9.3 Web — login con cuenta no confirmada: CTA inline → resend → `/signup/verify` con email cargado y cooldown corriendo
- [x] 9.4 Web — forgot-password happy path: `/forgot-password` → recibo email con código → `/forgot-password/verify` → `/reset-password` → password actualizado → re-login
- [x] 9.5 Web — reset-password sin sesión `amr=otp` muestra "link inválido"
- [x] 9.6 Web — middleware: con sesión `amr=otp`, navegar a `/dashboard` redirige a `/reset-password`; con sesión normal `amr=password` no redirige
- [x] 9.7 Mobile — signup happy path: signup → signup-verify → login con mensaje one-shot → dashboard
- [x] 9.8 Mobile — login con cuenta no confirmada: CTA inline → resend → signup-verify con cooldown
- [x] 9.9 Mobile — forgot-password happy path: forgot-password → recovery-verify → new-password → login → dashboard
- [x] 9.10 Cooldown: tras un resend exitoso, el botón muestra contador y se reactiva a los 60s; un resend forzado server-side gatilla `over_email_send_rate_limit` con copy correcto

## 10. Deploy

- [x] 10.1 Pegar `supabase/templates/confirm-signup.html` actualizado en el template "Confirm signup" del dashboard de Supabase
- [x] 10.2 Pegar `supabase/templates/reset-password.html` actualizado en el template "Reset password" del dashboard de Supabase
- [x] 10.3 Confirmar que "Confirm email" sigue habilitado en el panel de Auth Providers / Settings del dashboard
- [x] 10.4 Después del deploy: documentar (en el PR o en una nota) que los emails con links viejos quedan inertes durante la ventana de cutover — el path de recuperación es pedir un email nuevo
