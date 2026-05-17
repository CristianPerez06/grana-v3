> **Convenciones aplican a todas las tareas de UI (secciones 7, 9, 11, 13):**
> - **Reusar primero**: `Button`, `Input`, `Label`, `FormField`, `Alert`, `Card`, `Spinner` de `components/ui/`. Si necesitás algo que se va a repetir, agregalo a `components/ui/` con su `.stories.tsx` (ver sección 4).
> - **Tailwind only**: nada de CSS-in-JS ni módulos CSS. Cero `<style>` tags. Solo clases utilitarias.
> - **Tokens semánticos del tema**: `bg-background`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `border-border`, `text-destructive`, `bg-secondary`, `ring-ring`. **Prohibido** usar `bg-zinc-*`, `text-gray-*`, etc. directo — rompen el dark mode.
> - **RHF + FormField**: pasar `error={errors.<field>?.message}` y spread `{...register('<field>')}`. Errores form-level con `<Alert variant="error">`.

## 1. Dependencias e infraestructura base

- [x] 1.1 Agregar dependencias: `pnpm add react-hook-form @hookform/resolvers yup next-intl`
- [x] 1.2 Configurar `next.config.ts` para envolver con `createNextIntlPlugin('./lib/i18n/request.ts')`
- [x] 1.3 Crear `lib/i18n/config.ts` con `locales = ['es','en'] as const`, `defaultLocale = 'es'`, type `Locale`
- [x] 1.4 Crear `lib/i18n/request.ts` con `getRequestConfig` que lee cookie `NEXT_LOCALE`, valida contra `locales`, cae a default si inválida, y carga messages desde `lib/i18n/messages/<locale>.json`
- [x] 1.5 Crear `lib/i18n/messages/es.json` y `lib/i18n/messages/en.json` con namespaces vacíos para `auth`, `validation`, `dashboard`, `footer`, `common`
- [x] 1.6 Crear server action `setLocaleAction(locale)` en `app/_actions/set-locale.ts` que valida locale, setea cookie `NEXT_LOCALE` (1 año, sameSite=lax) y revalida `/` con scope `layout`

## 2. Validación compartida (Yup + RHF)

- [x] 2.1 Crear `lib/validation/auth.ts` con schemas `signupSchema`, `loginSchema`, `forgotSchema`, `resetSchema` exportando también los tipos inferidos
- [x] 2.2 En `signupSchema`: `fullName` (2–60, trim no vacío), `email` (formato válido), `password` (min 8, ≥1 letra, ≥1 número), `confirmPassword` (match con `password`)
- [x] 2.3 En `loginSchema`: `email` (formato), `password` (no vacío — sin reglas de fuerza en login)
- [x] 2.4 En `forgotSchema`: `email` (formato)
- [x] 2.5 En `resetSchema`: `password` (mismas reglas que signup), `confirmPassword` (match)
- [x] 2.6 Crear `lib/validation/setup-yup-locale.tsx` (Client Component): hace `useTranslations('validation')` y llama `yup.setLocale({...})` con `mixed.required`, `string.email`, `string.min`, `string.max`, `mixed.oneOf` (para confirm match)
- [x] 2.7 Crear helper `lib/validation/validate-action-input.ts`: `(schema, input) => { ok: true, data } | { ok: false, fieldErrors }` que captura `ValidationError` con `abortEarly:false` y construye `fieldErrors` por `path`

## 3. Mapeo de errores Supabase

- [x] 3.1 Crear `lib/supabase/errors.ts` con `SUPABASE_ERROR_KEYS: Record<string, string>` cubriendo `invalid_credentials`, `email_not_confirmed`, `user_already_exists`, `weak_password`, `same_password`, `over_email_send_rate_limit`
- [x] 3.2 Exportar `mapSupabaseError(error, t)` que devuelve el string traducido, con fallback `auth.errors.generic`
- [x] 3.3 Llenar `auth.errors.*` en ambos catálogos (`es.json` y `en.json`) _(se hace en sección 14 junto con el resto del catálogo)_

## 4. Primitivos nuevos (components/ui/)

- [x] 4.1 Crear `components/ui/password-field.tsx`: wrapper sobre `FormField` que fuerza `type` entre `password`/`text` con toggle, usa íconos `Eye` / `EyeOff` de `lucide-react`. Mantiene `forwardRef`, props pasan-through, posiciona el botón toggle absoluto a la derecha del input con `relative` en el container. El botón es `<button type="button">` para no submitear el form.
- [x] 4.2 Crear `components/ui/password-field.stories.tsx`: stories `Default`, `WithError`, `WithDescription` (mismo patrón que las stories existentes en `components/ui/*.stories.tsx`)
- [x] 4.3 Crear `components/ui/submit-button.tsx`: extiende `Button` con prop `pending?: boolean`. Cuando `pending=true`: agrega `disabled`, `aria-busy="true"`, y renderiza `<Spinner />` antes del children (o reemplaza children, decidir mirando la consistencia con `Button`)
- [x] 4.4 Crear `components/ui/submit-button.stories.tsx`: stories `Default`, `Pending`, `SecondaryPending`
- [x] 4.5 Confirmar en Storybook (`pnpm storybook`) que ambos primitivos renderizan light/dark y respetan los tokens (`bg-background`, `text-destructive` para error, etc.) _(verificación manual del usuario)_

## 5. SQL de profiles (Supabase)

- [x] 5.1 Crear archivo `supabase/migrations/0001_profiles.sql` con: `create table public.profiles (...)`, `enable row level security`, políticas `users read own profile` y `users update own profile`, función `handle_new_user` (`security definer`, `search_path=public`) y trigger `on_auth_user_created`
- [x] 5.2 Ejecutar la migración manualmente en el proyecto Supabase del usuario (instrucciones documentadas en sección 15) _(usuario confirmó)_
- [x] 5.3 Verificar que insertar en `auth.users` desde el dashboard crea automáticamente fila en `public.profiles` _(se verifica en 16.12 al hacer signup end-to-end)_

## 6. Root layout y providers globales

- [x] 6.1 Modificar `app/layout.tsx`: setear `lang` del `<html>` con el locale activo (leído desde `next-intl`); título y metadata reales (`grana`). Usar tokens semánticos en `body` (`bg-background text-foreground`)
- [x] 6.2 Envolver `{children}` con `<NextIntlClientProvider messages={...} locale={...}>`
- [x] 6.3 Renderizar `<ValidationLocaleSetter />` (Client Component del paso 2.6) dentro del provider, antes de `{children}`
- [x] 6.4 Renderizar `<Footer />` global al final del body (después de `{children}`)
- [x] 6.5 Eliminar el contenido placeholder de `app/page.tsx` y reemplazar por `redirect('/dashboard')` (server component que usa `redirect` de `next/navigation`)

## 7. Footer y language switcher

- [x] 7.1 Crear `components/footer/index.tsx` (server component): `<footer className="flex justify-center items-center gap-2 py-4 border-t border-border text-sm text-muted-foreground">` con `<LanguageSwitcher />`
- [x] 7.2 Crear `components/footer/language-switcher.tsx` (client component): obtiene locale activo con `useLocale()`, renderiza dos botones (ES/EN) usando el primitivo `<Button variant="ghost" size="sm" aria-pressed={...}>`, usa `useTransition` para feedback, invoca `setLocaleAction` al click
- [x] 7.3 Agregar claves `footer.language` y los labels `footer.language.es` / `footer.language.en` en ambos catálogos

## 8. Middleware: recovery + locale bootstrap

- [x] 8.1 Modificar `lib/supabase/middleware.ts` para que `updateSession` además: lea cookie `recovery_in_progress`, decodifique el JWT (`split('.')[1]` → `JSON.parse(atob(...))`) y extraiga `amr` claim, decida `isRecoverySession = cookiePresent || amrIsOtp`, ejecute cleanup (`maxAge:0`) cuando `cookiePresent && amrIsPassword`
- [x] 8.2 Después del bloque de redirect de protected routes, agregar: `if (user && isRecoverySession && !pathname.startsWith('/reset-password') && !pathname.startsWith('/auth/'))` → redirect a `/reset-password`
- [x] 8.3 Agregar bootstrap de cookie `NEXT_LOCALE`: si no existe, setear a `defaultLocale` en la response antes de devolverla
- [x] 8.4 Actualizar `protectedPrefixes` para que cubra `/dashboard` (ya está) y mantener el matcher de `middleware.ts` sin tocar
- [x] 8.5 Cubrir con un comentario corto la lógica de cookie + AMR (porque es no-obvia)

## 9. Auth layout y form shell

- [x] 9.1 Crear `app/(auth)/layout.tsx`: container `mx-auto mt-20 w-full max-w-sm px-4` con clases Tailwind nativas; el layout no fuerza `<Card>` — cada page la renderiza con su propio título
- [x] 9.2 Si el usuario ya está autenticado en una ruta `(auth)`, redirigir a `/dashboard` (`getUser()` en el layout)

## 10. Server actions de auth

- [x] 10.1 Crear `app/_actions/types.ts` con `type ActionResult<T> = { ok: true } | { ok: false; fieldErrors?: Partial<Record<keyof T, string>>; formError?: string }`
- [x] 10.2 Crear `app/_actions/signup.ts` (`'use server'`): `signupAction(input: unknown)` → `validateOrError(signupSchema, input)` → `supabase.auth.signUp({ email, password, options: { data: { full_name } } })` → mapear errores → `{ ok: true }` (sin redirect; el form decide qué mostrar)
- [x] 10.3 Crear `app/_actions/login.ts`: `loginAction(input)` → valida → `signInWithPassword` → si ok, `revalidatePath('/', 'layout')` + `redirect('/dashboard')`; si error, retorna `{ ok: false, formError: mapSupabaseError(...) }`
- [x] 10.4 Crear `app/_actions/logout.ts`: `logoutAction()` → `signOut()` → `revalidatePath('/', 'layout')` → `redirect('/login')`
- [x] 10.5 Crear `app/_actions/request-password-reset.ts`: `requestPasswordResetAction(input)` → valida → calcula `origin` desde `headers().get('host')` y protocolo (https en prod, http en dev) → `resetPasswordForEmail(email, { redirectTo: \`${origin}/auth/callback?next=/reset-password\` })` → siempre `{ ok: true }` (no revelamos si el email existe)
- [x] 10.6 Crear `app/_actions/reset-password.ts`: `resetPasswordAction(input)` → valida → `updateUser({ password })` → mapear errores → si ok, `signOut()` y `{ ok: true }`

## 11. Páginas (auth)

> Todas las pages de esta sección son Client Components con form RHF. Componen: `<Card>` + `<CardHeader>` + `<CardTitle>` + `<CardDescription>` + `<CardContent>` con `<FormField>`/`<PasswordField>` + `<CardFooter>` con `<SubmitButton>`. Errores de campo via `error={errors.X?.message}` en cada field. Errores form-level y mensajes one-shot via `<Alert>` dentro del `<CardContent>`.

- [x] 11.1 Crear `app/(auth)/signup/page.tsx`: form con RHF + `yupResolver(signupSchema)`, campos: `<FormField label={t('auth.signup.fullName_label')} {...register('fullName')} error={errors.fullName?.message} />`, mismo patrón para `email`, luego `<PasswordField>` para `password` y `confirmPassword`, `<SubmitButton pending={isSubmitting}>`. En éxito muestra screen "Revisá tu email" reemplazando el form (usando `<Card>` con un `<Alert variant="success">` con el copy de `auth.signup.check_email`). Link al final del card: "¿Ya tenés cuenta? Iniciá sesión" → `/login` (usar `next/link` + `<Button variant="link" asChild>`)
- [x] 11.2 Crear `app/(auth)/login/page.tsx`: page server-component lee `searchParams` (`?message=account_confirmed`, `?error=auth_callback_failed`) y los pasa como props a `<LoginForm initialNotice={...} />` (client component). El form usa `loginSchema`, renderiza `<Alert>` inicial si hay notice, después el form (`FormField` email, `PasswordField` password, `<SubmitButton>`). Links: "¿Olvidaste tu password?" → `/forgot-password`, "¿No tenés cuenta? Registrate" → `/signup`
- [x] 11.3 Crear `app/(auth)/forgot-password/page.tsx`: form RHF con `forgotSchema`, `<FormField>` email, `<SubmitButton>`. En éxito reemplaza form por `<Alert variant="info">` con el copy de `auth.forgot.sent_notice`. Link "Volver a login" → `/login`
- [x] 11.4 Crear `app/(auth)/reset-password/page.tsx`: server component que en `getUser()` valida sesión + detecta recovery (cookie o AMR); si no hay recovery, renderiza `<Card>` con `<Alert variant="error">` ("Link inválido o expirado") y link a `/forgot-password`. Si sí, renderiza `<ResetPasswordForm />` (client) con `resetSchema`, dos `<PasswordField>` (password + confirm), `<SubmitButton>`. Tras submit exitoso, reemplaza form por `<Alert variant="success">` + link a `/login`
- [x] 11.5 Eliminar `app/login/page.tsx` y `app/login/actions.ts` (movidos a `(auth)/login` y `_actions/*`)

## 12. /auth/callback route handler

- [x] 12.1 Crear `app/auth/callback/route.ts` exportando `GET`
- [x] 12.2 Extraer query: `code`, `tokenHash` (alias de `token_hash`), `type`, `next`, `error`, `error_code`
- [x] 12.3 Si viene `error` o `error_code`, redirect 303 a `/login?error=auth_callback_failed`
- [x] 12.4 Si `tokenHash && type === 'signup'`: `verifyOtp({ type: 'signup', token_hash })`; si error → `/login?error=auth_callback_failed`; si ok → `signOut()` → `/login?message=account_confirmed`
- [x] 12.5 Si `code`: `exchangeCodeForSession(code)`; si error → `/login?error=auth_callback_failed`; si ok y `next === '/reset-password'` → setear cookie `recovery_in_progress=1` (httpOnly, secure, sameSite=lax, maxAge=600, path=/) → redirect a `/reset-password`
- [x] 12.6 Si `code` pero `next` distinto, redirigir a `next` (o `/dashboard` si vacío) sin cookie
- [x] 12.7 Fallback (sin `code` ni `tokenHash`): redirect a `/login?error=auth_callback_failed`

## 13. (app) layout, header con logout, dashboard placeholder

- [x] 13.1 Crear `app/(app)/layout.tsx` (server component): `getUser()`, si no hay user → `redirect('/login')`, renderiza `<Header />` + `<main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">{children}</main>` (clases Tailwind nativas)
- [x] 13.2 Crear `app/(app)/_components/header.tsx` (server component): `<header className="flex justify-between items-center px-4 py-3 border-b border-border bg-background">` con izquierda el nombre `grana` (usando `<Link>` + `text-foreground font-semibold`) y derecha `<LogoutButton />`
- [x] 13.3 Crear `app/(app)/_components/logout-button.tsx` (client component): `<form action={logoutAction}>` con `<Button type="submit" variant="ghost" size="sm">{t('common.logout')}</Button>` (reusa primitivo `Button`)
- [x] 13.4 Crear `app/(app)/dashboard/page.tsx`: server component vacío con `<h1 className="text-2xl font-semibold tracking-tight">{t('dashboard.title')}</h1>` y un párrafo `<p className="mt-2 text-muted-foreground">` de bienvenida usando el nombre del profile (`select full_name from profiles where id = auth.uid()`)

## 14. Contenido de catálogos i18n

- [x] 14.1 Llenar `auth.*` en `es.json`: `signup.{title,description,fullName_label,email_label,password_label,confirm_label,submit,check_email_title,check_email_body,have_account}`, `login.{title,description,email_label,password_label,submit,forgot,no_account,confirmed_notice,callback_error}`, `forgot.{title,description,email_label,submit,sent_notice,back_to_login}`, `reset.{title,description,password_label,confirm_label,submit,success_title,success_body,go_to_login,invalid_link}`, `errors.{invalid_credentials,email_not_confirmed,user_already_exists,weak_password,same_password,over_email_send_rate_limit,generic}`
- [x] 14.2 Replicar todas las claves en `en.json` con traducciones equivalentes
- [x] 14.3 Llenar `validation.*` en ambos catálogos: `required`, `email`, `min`, `max`, `oneOf` (formato compatible con `yup.setLocale` parametrizado por `{label, min, max}`)
- [x] 14.4 Llenar `dashboard.{title, welcome}`, `footer.{language, language.es, language.en}`, `common.{logout, app_name}` en ambos catálogos

## 15. Documentación

- [x] 15.1 Actualizar `SUPABASE_SETUP.md`: en la sección de server actions, reemplazar el patrón `redirect('/login?error=' + ...)` por un breve ejemplo del `ActionResult` + nota: "Para detalles ver `lib/validation/` y los actions bajo `app/_actions/`"
- [x] 15.2 Eliminar de `SUPABASE_SETUP.md` la sección 6.4 (OAuth callback) o marcarla como out-of-scope para grana-v3 inicial
- [x] 15.3 Agregar al `README.md` una sección **"Configuración inicial de Supabase"** con: (a) variables de entorno, (b) habilitar email provider + confirmación, (c) Site URL y Redirect URLs (`/auth/callback`), (d) templates de email — confirmación apunta a `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`, recovery apunta a `{{ .SiteURL }}/auth/callback?code={{ .Token }}&next=/reset-password`, (e) ejecutar la migración `supabase/migrations/0001_profiles.sql` en el SQL Editor
- [x] 15.4 Agregar al README una sección "Comandos" con `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm storybook` (si no está ya)
- [x] 15.5 Agregar al README una nota corta sobre i18n: "App usa next-intl con cookie `NEXT_LOCALE`; locales soportados en `lib/i18n/config.ts`"
- [x] 15.6 Agregar al README un párrafo sobre la convención de UI: "Componentes reusables viven en `components/ui/` con su Storybook story. Toda la UI usa Tailwind con los tokens semánticos definidos en `app/globals.css`"

## 16. Verificación manual end-to-end

- [x] 16.1 `pnpm dev`, abrir `/signup`, registrar usuario nuevo → verificar email recibido
- [x] 16.2 Click en link de confirmación → cae en `/login?message=account_confirmed`, sin sesión activa
- [x] 16.3 Login con email + password → llega a `/dashboard`, ve su nombre, ve botón logout en header
- [x] 16.4 Click logout → cae en `/login`
- [x] 16.5 Intentar acceso directo a `/dashboard` sin sesión → middleware redirige a `/login`
- [x] 16.6 En `/login`, ir a `/forgot-password`, ingresar email → email recibido
- [x] 16.7 Click link de recovery → cae en `/reset-password`, ver form
- [x] 16.8 Intentar navegar a `/dashboard` mientras está en recovery → middleware redirige a `/reset-password`
- [x] 16.9 Setear nuevo password → ver mensaje de éxito → click "Ir a login" → reingresar con nuevo password → éxito
- [x] 16.10 Probar errores: login con password incorrecto (mensaje en form), signup con email ya registrado (mensaje en form), reset con confirm distinto (mensaje en field)
- [x] 16.11 Cambiar idioma desde footer (ES → EN) → todas las pantallas anteriores renderizan en inglés
- [x] 16.12 Verificar en SQL Editor de Supabase que cada signup creó fila en `public.profiles` con `full_name` correcto
- [x] 16.13 Probar dark mode (`html.dark` toggle): toda la UI usa los tokens semánticos, nada se rompe visualmente
- [x] 16.14 `pnpm lint` y `pnpm build` pasan sin errores
