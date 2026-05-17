## Context

grana-v3 es un Next.js 16 App Router con `@supabase/ssr` ya cableado (clients de browser, server y middleware), middleware activo en `middleware.ts`, primitivos shadcn-style (`button`, `input`, `alert`, `form-field`, `card`, `label`, `spinner`) y dark mode tokens. Solo existe un `/login` rudimentario con server actions que pasan errores por querystring; no hay `/dashboard`, no hay signup separado, no hay reset, no hay logout en UI, no hay i18n y no hay tabla de perfil.

Sí existe un proyecto hermano **grana-v2** del que tomamos como referencia el flujo de reset password — fue históricamente frágil y v2 terminó con dos mecanismos belt-and-suspenders para no romperse. Replicamos ese diseño explícitamente.

Restricciones:
- **Next.js 16 App Router** con Server Components por defecto (`'use client'` solo cuando hace falta).
- **React 19**: tenemos `useActionState`, `useFormStatus`, async forms.
- **TypeScript strict**.
- **Tailwind v4** + tokens de tema ya definidos en `globals.css`.
- Supabase emite emails desde su propia infra; los templates se editan en el dashboard, no en código.
- `@supabase/ssr` ya está en uso — no cambiamos el patrón de creación de clients.

## Goals / Non-Goals

**Goals:**
- Flujos completos y funcionales de signup (con confirmación), login, logout y reset de password.
- Validación unificada (mismo schema en cliente y servidor) con mensajes en español.
- i18n desde el día 1 (`es` + `en`, default `es`, switcher en footer) sin meter `[locale]` en la URL.
- Tabla `profiles` con creación automática vía trigger y RLS por usuario.
- Manejo de errores en la ruta vía estado (no querystring), patrón consistente para todos los forms de auth.
- Reproducir los gotchas resueltos en grana-v2 (signOut post-confirm, signOut post-reset, cookie + AMR check) sin volver a tropezarlos.
- Documentación de configuración Supabase migrada del setup doc al README.

**Non-Goals:**
- OAuth (Google, GitHub, etc.) — vendrá después.
- Onboarding multi-step — vendrá en otro change.
- Edición de perfil (cambiar nombre/email/avatar) — fuera de alcance.
- Cambio de password con sesión activa (desde settings) — fuera de alcance.
- 2FA, magic links, passwordless — fuera de alcance.
- Cambio de idioma desde una pantalla de settings (solo desde footer por ahora; settings vendrá luego).
- Catálogos de i18n exhaustivos — solo cubrimos auth, footer, dashboard placeholder, errores Supabase y mensajes de validación.

## Decisions

### 1. Estructura de rutas: route groups `(auth)` y `(app)`

```
app/
├── layout.tsx                       ← root: html/body, fonts, NextIntlClientProvider, footer
├── (auth)/
│   ├── layout.tsx                   ← card centrada (la "auth shell")
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
├── (app)/
│   ├── layout.tsx                   ← header con logout, gate de auth
│   └── dashboard/page.tsx           ← placeholder vacío
├── auth/
│   └── callback/route.ts
└── _actions/                        ← server actions de auth
    ├── login.ts
    ├── signup.ts
    ├── logout.ts
    ├── request-password-reset.ts
    └── reset-password.ts
```

**Por qué grupos y no carpetas planas:** queremos dos layouts radicalmente distintos (card centrada vs app shell con header) sin tener que renderizarlos condicionalmente. Los grupos no afectan la URL.

**Alternativa descartada:** dejar todo en `app/` con un `if (pathname.startsWith('/login'))` en el root layout — agrega lógica condicional y mezcla concerns.

### 2. Manejo del flujo `/auth/callback`

Una sola ruta `GET /auth/callback` discrimina por la forma del query string:

```
┌──────────────────────────────────────────────────────────────┐
│              GET /auth/callback                              │
└──────────────────────────────────────────────────────────────┘
   │
   ├─ ?code=…&next=/reset-password    ← recovery (PKCE)
   │    1. exchangeCodeForSession(code)
   │    2. set cookie recovery_in_progress=1
   │       (httpOnly, secure, sameSite=lax, maxAge=600, path=/)
   │    3. redirect 303 → /reset-password
   │
   ├─ ?token_hash=…&type=signup       ← confirmación email (OTP)
   │    1. verifyOtp({ type: 'signup', token_hash })
   │    2. signOut()  ← IMPORTANTE
   │    3. redirect 303 → /login?message=account_confirmed
   │
   ├─ ?error=…                         ← error de Supabase
   │    redirect 303 → /login?error=auth_callback_failed
   │
   └─ default                          ← shape no esperado
        redirect 303 → /login?error=auth_callback_failed
```

**Querystring en `/login` solo para mensajes one-shot post-callback** (`message=account_confirmed`, `error=auth_callback_failed`). El form en sí maneja errores en estado. Esta excepción está limitada al cruce desde un GET externo (email).

**Por qué una sola ruta:** mantiene la configuración en Supabase simple (una sola Redirect URL: `/auth/callback`). Distinguir por shape es robusto: cada flujo emite query distintos.

**Alternativa descartada:** rutas separadas `/auth/callback/signup` y `/auth/callback/recovery`. Más explícito pero obliga a registrar dos Redirect URLs y a customizar dos templates de email con paths diferentes.

### 3. Belt-and-suspenders para sesión de recovery (replicado de v2)

El middleware necesita saber si el usuario está en una "sesión de recovery" para empujarlo a `/reset-password` y no dejarlo deambular. Usamos **dos señales independientes**:

```
SEÑAL A: cookie recovery_in_progress=1
  + Set por /auth/callback cuando next=/reset-password
  + TTL 10min, httpOnly, secure, sameSite=lax
  + Auto-cleanup cuando AMR=password (login fresco con sesión vieja stale)

SEÑAL B: JWT amr claim
  + verifyOtp y exchangeCodeForSession marcan el token con amr[].method
  + Si method === 'otp' → es sesión post-recovery
  + Si method === 'password' → es login normal

DECISIÓN: isRecoverySession = cookieAPresent || amrIsOtp
ENFORCEMENT: si isRecoverySession && pathname no empieza con /reset-password ni /auth/
            → redirect a /reset-password
CLEANUP:    si cookie presente && amr=password → borrar cookie (sesión stale)
```

**Por qué dos señales:** la cookie por sí sola se puede borrar (privacy mode, expiración). El AMR por sí solo no distingue una sesión OTP de signup (también marca `otp`) de una de recovery. Combinarlas hace robustísimo el gate.

**Por qué no solo AMR:** justamente porque también signup marca AMR=otp tras verifyOtp. La cookie nos da la señal "next era /reset-password", que es lo único que distingue ambos casos.

**Por qué no solo cookie:** la cookie es opcional y puede no llegar (navegador sin cookies, expiró). El AMR vive en el JWT y siempre está.

### 4. Forzar relogin post-confirm y post-reset

**Post-confirm de signup** (`/auth/callback` rama OTP): `signOut()` inmediato → `/login?message=account_confirmed`.
- *Por qué*: alguien podría confirmar el email sin recordar su password (link guardado en favoritos, otra sesión). Forzar relogin valida que conoce la credencial.
- *Costo*: una fricción menor (volver a tipear). Aceptable.

**Post-reset** (`/reset-password` submit): `updateUser({password})` → `signOut()` → mostrar mensaje → usuario va manualmente a `/login`.
- *Por qué*: el usuario decidió cambiar su password. Forzar relogin con el nuevo password es la confirmación natural de que la operación funcionó.
- *Costo*: igual, fricción menor.

Las dos decisiones son explícitas del usuario (siguiendo v2). No las cambiamos.

### 5. Validación: `react-hook-form` + `Yup`, schemas compartidos

```
lib/validation/
├── auth.ts                          ← schemas exportados
└── messages.ts                      ← claves i18n para errores Yup

Schemas:
  signupSchema     { fullName, email, password, confirmPassword }
  loginSchema      { email, password }
  forgotSchema     { email }
  resetSchema      { password, confirmPassword }

Patrón en cada form (Client Component):
  const form = useForm({ resolver: yupResolver(loginSchema) })
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await loginAction(values)
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, msg] of Object.entries(result.fieldErrors)) {
          form.setError(field, { message: msg })
        }
      }
      if (result.formError) setFormError(result.formError)
      return
    }
    // success path
  })

Patrón en cada server action:
  export async function loginAction(input: unknown): Promise<ActionResult<LoginInput>> {
    const parsed = await loginSchema.validate(input, { abortEarly: false }).catch(...)
    // …Supabase calls
    // map Supabase errors → t('auth.errors.invalid_credentials')
    return { ok: false, formError: '…' }
  }
```

**Por qué Yup y no Zod:** el usuario pidió explícitamente Yup. (Zod sería igual de válido — no peleamos por eso.)

**Por qué passar `unknown` y revalidar en server:** la primera regla de validación con server actions es nunca confiar en lo que llega; el cliente puede saltarse RHF. La revalidación con el mismo schema cierra el círculo sin duplicar reglas.

**Mensajes de validación:** Yup permite localizar sus mensajes globalmente con `yup.setLocale(...)`. Lo seteamos al inicializar i18n, leyendo las claves de los catálogos. Cada `t('validation.required')` etc.

### 6. ActionResult — contrato del retorno de server actions

```ts
type ActionResult<T> =
  | { ok: true }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof T, string>>
      formError?: string  // error global (credenciales inválidas, etc.)
    }
```

Sin redirects desde el action (excepto post-éxito). Los errores se renderizan en la ruta. Esto elimina el patrón antiguo `?error=…` del setup doc y unifica el handling.

**Excepción:** `loginAction` y `signupAction` sí hacen `redirect()` en el path de éxito (a `/dashboard` y a una mini-pantalla "revisá tu email" respectivamente) — eso lo permite el harness de Next y es el patrón estándar.

### 7. i18n: `next-intl` con estrategia cookie

```
lib/i18n/
├── config.ts                        ← locales = ['es','en'] as const, defaultLocale = 'es'
├── request.ts                       ← getRequestConfig — lee cookie 'NEXT_LOCALE', cae a defaultLocale
└── messages/
    ├── es.json
    └── en.json

next.config.ts:
  const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts')
  export default withNextIntl(nextConfig)

middleware.ts:
  - si no hay cookie NEXT_LOCALE → setearla con defaultLocale ('es')
  - resto del flujo (sesión + recovery gate)

components/footer/language-switcher.tsx:
  - usa server action que setea cookie NEXT_LOCALE y llama revalidatePath('/', 'layout')
```

**Por qué cookie y no URL routing:**
- La app es post-login mayormente, SEO no importa.
- Evita migrar todas las rutas a `app/[locale]/...`.
- El switcher es un componente del footer, no parte de la URL.
- Default `es` con switch a `en` cubre el caso simple sin overhead.

**Trade-off aceptado:** los URLs no llevan el idioma, así que un link compartido en español, al abrirlo otro usuario en otra máquina, se renderiza en SU idioma (cookie default). Para esta app es lo deseable.

**Cómo se conecta con Yup:** al inicializar el provider en el root layout, llamamos `yup.setLocale({ mixed: { required: ({label}) => t('validation.required', {field: label}) }, … })`. Cada schema usa `.label('email')` para que el mensaje sea contextual.

### 8. Mapeo de errores Supabase → mensajes i18n

`lib/supabase/errors.ts`:

```ts
const SUPABASE_ERROR_KEYS: Record<string, string> = {
  invalid_credentials:        'auth.errors.invalid_credentials',
  email_not_confirmed:        'auth.errors.email_not_confirmed',
  user_already_exists:        'auth.errors.user_already_exists',
  weak_password:              'auth.errors.weak_password',
  same_password:              'auth.errors.same_password',
  over_email_send_rate_limit: 'auth.errors.over_email_send_rate_limit',
  // fallback: 'auth.errors.generic'
}

export const mapSupabaseError = (error: AuthError, t: (k: string) => string) =>
  t(SUPABASE_ERROR_KEYS[error.code ?? ''] ?? 'auth.errors.generic')
```

**Por qué no usar `error.message` directo:** los mensajes de Supabase están en inglés y son genéricos. Mapear por `error.code` (que Supabase expone con códigos estables desde `@supabase/supabase-js` v2.46+) nos da control sobre el mensaje y nos permite i18n.

### 9. Tabla `profiles` + trigger + RLS

```sql
-- supabase/migrations/0001_profiles.sql

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: cuando auth crea el usuario, creamos la fila en profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Sin política de insert:** el trigger inserta como `security definer` (con permisos del owner del schema, no del usuario). El usuario nunca inserta directo en `profiles` — siempre vía signup.

**Sin política de delete:** queremos que la eliminación de cuenta cascadee desde `auth.users` (ya cubierto por `on delete cascade`). No se borra desde la app.

**`full_name` viene de `raw_user_meta_data`**: en `signUp` pasamos `options: { data: { full_name: '...' } }`, que Supabase guarda en ese JSONB. El trigger lo lee de ahí.

### 10. Header con logout y dashboard placeholder

`app/(app)/layout.tsx`:
- Server Component.
- `getUser()` → si no hay user, `redirect('/login')`.
- Renderiza `<Header />` (server) + `{children}`.

`app/(app)/_components/header.tsx`:
- Server Component.
- Layout: `flex justify-between items-center px-4 py-3 border-b`.
- Izquierda: logo / nombre app.
- Derecha: `<LogoutButton />` (form que invoca server action `logoutAction`).

`app/(app)/dashboard/page.tsx`:
- Placeholder mínimo: `<h1>{t('dashboard.title')}</h1>` y nada más.

### 11. Footer global con language switcher

`app/layout.tsx` envuelve `{children}` con `<NextIntlClientProvider>` y agrega `<Footer />` al final del body. El footer es global (presente en `(auth)` y `(app)`).

`components/footer/index.tsx`:
- Server Component.
- `flex justify-center items-center py-4 border-t text-sm text-muted-foreground`.
- Contiene `<LanguageSwitcher />`.

`components/footer/language-switcher.tsx`:
- Client Component (necesita `useTransition` para feedback durante la mutación de cookie).
- Renderiza dos botones (ES/EN) o un dropdown simple.
- onClick → server action `setLocaleAction(locale)` que setea cookie + `revalidatePath('/', 'layout')`.

### 12. Convenciones de UI: primitivos + Tailwind con tokens semánticos

**Regla general — orden de preferencia para construir UI:**

```
1. REUSAR  → primitivos existentes en components/ui/*
              (button, input, label, form-field, alert, card, spinner)
2. CREAR   → si una pieza se va a repetir en >1 pantalla,
              vive en components/ui/ con su .stories.tsx
3. INLINE  → si es one-off cosmético, JSX directo en la página
              con clases Tailwind
```

**Tailwind v4 con tokens semánticos**:
- Toda la UI usa clases Tailwind. **Cero CSS-in-JS, cero `<style>` tags, cero módulos CSS** (excepto `globals.css` que ya define los tokens).
- Colores: usar siempre los tokens semánticos definidos en `app/globals.css` — `bg-background`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `border-border`, `text-destructive`, `bg-secondary`, `ring-ring`, etc. **No usar `bg-zinc-100`, `text-gray-500`, etc. directamente** — esos rompen dark mode y debilitan la coherencia del tema.
- Layout/spacing/typography: clases Tailwind nativas (`flex`, `gap-4`, `text-sm`, `mx-auto`, etc.) son libres.

**Integración primitivos ↔ react-hook-form**:
El `FormField` existente acepta `error?: string` y renderiza el mensaje bajo el input con `text-destructive`. El patrón es:

```tsx
<FormField
  label={t('auth.login.email_label')}
  type="email"
  error={errors.email?.message}
  {...register('email')}
/>
```

Los mensajes que entren ahí ya vienen traducidos (Yup con `setLocale` + i18n + server action map). RHF maneja `setError(field, { message })` para errores que vienen del server action.

Para errores **a nivel form** (no atribuibles a un campo, p.ej. credenciales inválidas), usar `<Alert variant="error">{formError}</Alert>` arriba del primer campo o entre el último campo y el botón submit.

### 13. Primitivos nuevos requeridos por el flujo

Dos componentes nuevos que viven en `components/ui/` (con su Storybook story), porque se van a usar en múltiples pantallas de auth y previsiblemente fuera de auth también:

**`<PasswordField />`** — extiende `FormField` para inputs de contraseña con toggle de visibilidad.
- Props: las mismas que `FormField` excepto `type` (fuerza `password`/`text` internamente).
- Estado interno: `visible: boolean`, alterna con un botón eye/eye-off (lucide-react).
- Mantiene `error`, `aria-describedby` y `forwardRef` igual que `FormField`.
- Se usa en signup (password + confirm), reset (password + confirm), y a futuro en settings/change-password.

**`<SubmitButton />`** — extiende `Button` con estado de loading.
- Props: las mismas que `Button` + `pending?: boolean`.
- Cuando `pending`: deshabilita el botón, renderiza `<Spinner />` en lugar del texto (o al lado), y setea `aria-busy`.
- Se conecta naturalmente con `form.formState.isSubmitting` de RHF.

**Por qué solo estos dos:** todo lo demás del flujo se cubre componiendo primitivos existentes. No creamos `<LoginCard />`, `<AuthForm />` ni wrappers de mayor nivel **proactivamente** — el form de cada pantalla es lo bastante distinto como para justificar JSX por página.

**Cuándo sí extraer un wrapper compuesto** (regla a futuro, no aplica a este change): si una misma pieza de UI (form, sección compuesta) termina usándose tal cual en **2 o más rutas**, proponer un wrapper reusable y **pedir confirmación al usuario antes de extraerlo**. No extraer en silencio — el costo de una abstracción mal pensada supera al de un copy/paste honesto.

## Risks / Trade-offs

- **[Riesgo] Sesión de recovery se cruza con sesión normal**: si el usuario ya estaba logueado y clickea un link de recovery, el callback hace `exchangeCodeForSession` y reemplaza la sesión. La cookie + AMR check lo empuja a `/reset-password`. Si cambia el password, el `signOut` lo limpia. **Mitigación**: cleanup de cookie cuando AMR=password en el middleware (señal de login fresco con cookie stale).
- **[Riesgo] Templates de email mal configurados**: si el template apunta a `/auth/callback` sin `next=/reset-password`, el reset rompe (sin la cookie, el middleware no detecta recovery → AMR=otp pero el usuario va a `/dashboard`). **Mitigación**: documentar paso a paso los templates en README. Posible mejora futura: validar al deploy con un smoke test.
- **[Riesgo] Cookie `recovery_in_progress` expira en 10min**: si el usuario abre el link y tarda más de 10min en setear el nuevo password, la cookie se va. El AMR sigue, así que sigue funcionando, pero si también la sesión expiró (Supabase default ~1h), el reset falla con "enlace expirado". **Mitigación**: aceptable — 10min es generoso para tipear un password; expiración total queda en manos de Supabase.
- **[Riesgo] `next-intl` cookie strategy es menos estándar que URL routing**: si más adelante necesitamos SEO o URLs por idioma (improbable post-login, posible si agregamos landing pública), habrá que migrar. **Mitigación**: aislar la decisión en `lib/i18n/request.ts`; la migración tocaría rutas pero no schemas/forms/actions.
- **[Riesgo] Yup `setLocale` con `t()` requiere i18n inicializado antes**: si llamamos `setLocale` fuera del provider, `t()` no existe. **Mitigación**: encapsular en un Client Component `<ValidationLocaleSetter />` que corre dentro del `NextIntlClientProvider` y llama `setLocale` una sola vez al montar.
- **[Riesgo] Server actions con `unknown` input + Yup**: si el cliente manda un body raro (ataque), Yup lo rechaza con `ValidationError`. Hay que capturarlo y devolver `{ ok: false, fieldErrors: ... }`. **Mitigación**: helper `validateOrError(schema, input)` reutilizable.
- **[Trade-off] Schema `profiles` mínimo**: solo `id`, `full_name`, `email`, `created_at`. No metemos `updated_at`, `avatar_url`, `language_preference` ahora. Cuando lleguen settings y avatares, agregamos columnas con nuevas migrations. Es preferible a sobre-diseñar.
- **[Trade-off] Sin tests automatizados en este change**: el alcance ya es grande. La verificación es manual contra Supabase real, siguiendo el flujo end-to-end del `tasks.md`. Tests vendrán cuando armemos el setup de Playwright/Vitest.
