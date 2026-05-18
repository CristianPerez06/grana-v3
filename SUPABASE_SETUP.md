# Guía de setup de Supabase — grana-v3

Pasos punta a punta para integrar Supabase en este proyecto Next.js 16 App Router, tanto para **autenticación** como para **acceso a base de datos**, usando el paquete `@supabase/ssr` (que tiene buen soporte para SSR).

---

## 1. Crear el proyecto en Supabase

1. Andá a [supabase.com](https://supabase.com) e iniciá sesión.
2. **New project** → elegí una organización, ponele un nombre (por ejemplo `grana-v3`), elegí un password fuerte para la base y la región más cercana.
3. Esperá ~2 minutos a que se aprovisione.
4. Abrí **Settings → API** y copiá:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (opcional, solo server, nunca exponer) → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Instalar paquetes

Desde la raíz del proyecto:

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

Opcional, para acceso tipado a la base (recomendado):

```bash
pnpm add -D supabase
```

---

## 3. Variables de entorno

Creá `.env.local` en la raíz del proyecto (ya viene ignorado por Next.js):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
# Opcional, solo server:
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Mantené además un `.env.example` (este sí versionado) con los placeholders vacíos para que tus colaboradores sepan qué variables necesitan.

---

## 4. Crear los clientes de Supabase

App Router corre código en tres contextos distintos (browser, server components/actions y middleware). Cada uno necesita su propio cliente.

### 4.1 Cliente de browser — `lib/supabase/client.ts`

```ts
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
```

### 4.2 Cliente de server — `lib/supabase/server.ts`

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — middleware will refresh the session.
          }
        },
      },
    },
  )
}
```

### 4.3 Helper para el middleware — `lib/supabase/middleware.ts`

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const updateSession = async (request: NextRequest) => {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: do not run any other code between createServerClient and getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected routes.
  const protectedPrefixes = ['/dashboard', '/account']
  const isProtected = protectedPrefixes.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  )
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}
```

---

## 5. Agregar el middleware raíz — `middleware.ts`

Creá este archivo en la **raíz del proyecto** (al mismo nivel que `app/`):

```ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export const middleware = (request: NextRequest) => updateSession(request)

export const config = {
  matcher: [
    // Run on every request except static files and images.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

Esto refresca las cookies de sesión en cada navegación — es necesario para que los Server Components puedan ver un usuario logueado.

---

## 6. Autenticación

### 6.1 Habilitar providers

En el dashboard de Supabase → **Authentication → Providers**:

- **Email** viene habilitado por default. Decidí si querés requerir confirmación de email (en grana-v3 sí, está activado).
- Para OAuth (Google, GitHub, etc.), habilitá el provider y agregá el client ID/secret. La redirect URL que Supabase te muestra hay que registrarla en el provider OAuth correspondiente.

### 6.2 Páginas de auth — `app/(auth)/`

El flujo de auth vive bajo el route group `(auth)` y comparte un layout tipo card centrada. Las páginas son: `login`, `signup`, `forgot-password`, `reset-password`. Cada page renderiza un `<Card>` + un Client Component de formulario que integra `react-hook-form` con los schemas de Yup en `lib/validation/auth.ts`.

Ver `app/(auth)/*/page.tsx` y `*-form.tsx` para los patrones canónicos.

### 6.3 Server actions — `ActionResult` tipado

Usamos un shape de retorno tipado para que los forms puedan renderizar errores localmente (sin querystrings `?error=...`).

```ts
// app/_actions/types.ts
export type ActionResult<T> =
  | { ok: true }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof T, string>>
      formError?: string
    }
```

Cada action valida con un schema Yup compartido (`lib/validation/`) y retorna este shape. El form levanta `fieldErrors` (por campo) y `formError` (global) vía `react-hook-form.setError` + un estado local. Los paths de éxito sí pueden hacer `redirect()` directamente (p. ej. `loginAction` → `/dashboard`).

Para detalles de implementación ver:

- `lib/validation/auth.ts` — schemas + tipos
- `lib/validation/validate-action-input.ts` — helper de validación del lado server
- `app/_actions/*.ts` — `loginAction`, `signupAction`, `logoutAction`, `requestPasswordResetAction`, `resetPasswordAction`
- `app/auth/callback/route.ts` — maneja tanto confirmación de signup (OTP) como password recovery (PKCE)

### 6.4 Leer el usuario actual

En un Server Component:

```ts
import { createClient } from '@/lib/supabase/server'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <p>Hello {user?.email}</p>
}
```

Siempre usá `supabase.auth.getUser()` en el server (verifica el JWT). Para autorización en el server, no confíes en `getSession()`.

> **Nota**: los OAuth providers (Google, GitHub, etc.) están intencionalmente fuera de alcance para el setup inicial de grana-v3. La ruta `/auth/callback` hoy maneja confirmación de signup (OTP) y password recovery (PKCE); un OAuth callback la extendería.

---

## 7. Base de datos

### 7.1 Crear tablas

En el dashboard → **Table Editor** o **SQL Editor**. Ejemplo:

```sql
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
```

### 7.2 Habilitar Row Level Security (RLS)

**Crítico.** Sin RLS la anon key puede leer y escribir todo.

```sql
alter table public.todos enable row level security;

create policy "users read own todos"
  on public.todos for select
  using (auth.uid() = user_id);

create policy "users insert own todos"
  on public.todos for insert
  with check (auth.uid() = user_id);

create policy "users update own todos"
  on public.todos for update
  using (auth.uid() = user_id);

create policy "users delete own todos"
  on public.todos for delete
  using (auth.uid() = user_id);
```

### 7.3 Hacer un query desde un Server Component

```ts
import { createClient } from '@/lib/supabase/server'

export default async function TodosPage() {
  const supabase = await createClient()
  const { data: todos, error } = await supabase.from('todos').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return <ul>{todos.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
}
```

### 7.4 Mutar vía un Server Action

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export const addTodo = async (formData: FormData) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  await supabase.from('todos').insert({ title: formData.get('title') as string, user_id: user.id })
  revalidatePath('/todos')
}
```

---

## 8. Generar tipos de TypeScript (recomendado)

```bash
pnpm dlx supabase login
pnpm dlx supabase gen types typescript --project-id <project-ref> --schema public > lib/supabase/database.types.ts
```

Y después tipá los clientes:

```ts
import type { Database } from '@/lib/supabase/database.types'
createBrowserClient<Database>(...)
createServerClient<Database>(...)
```

Regenerá los tipos cada vez que cambie el schema (vale la pena agregar un script `pnpm run types:db`).

---

## 9. Verificar

1. `pnpm dev`
2. Visitar `/login`, registrarse con un email de prueba y confirmar desde el email si está activada la confirmación.
3. Visitar una ruta protegida (por ejemplo `/dashboard`) — debería cargar cuando hay sesión y redirigir a `/login` cuando no.
4. Insertar una fila desde la UI, refrescar y confirmar que persiste.
5. Hacer logout y confirmar que la ruta protegida vuelve a redirigir.

---

## 10. Migración 0007 — módulo de cuentas (accounts)

### 10.1 Aplicar la migración

La migración vive en `supabase/migrations/0007_accounts.sql`. Para aplicarla:

1. Abrí el **SQL Editor** en el dashboard de Supabase de este proyecto.
2. Pegá el contenido completo de `supabase/migrations/0007_accounts.sql`.
3. Ejecutá. Al final deberías ver una fila de resumen con todos los flags en `true`:
   - `accounts_table_exists`: `true`
   - `account_currencies_table_exists`: `true`
   - `accounts_rls_enabled`: `true`
   - `account_currencies_rls_enabled`: `true`
   - `policy_count`: `8`
   - `trigger_installed`: `true`
   - `function_installed`: `true`
   - `default_accounts_count`: (número de usuarios existentes — ≥ 0)

Si algún flag es `false` o el bloque `DO $$ ... $$` de self-check lanzó una excepción, revisá la consola de errores del SQL Editor.

### 10.2 Regenerar tipos TypeScript

Después de aplicar la migración, regenerá los tipos:

```bash
pnpm --filter @grana/supabase types:gen
```

O bien, si no tenés el script configurado:

```bash
supabase gen types typescript --project-id <project-id> > packages/supabase/src/types.ts
```

Verificá que `packages/supabase/src/types.ts` incluye ahora las tablas `accounts` y `account_currencies` y el enum `account_type`.

### 10.3 Verificar el trigger (test manual)

Para confirmar que el trigger `on_auth_user_created_default_account` funciona:

1. Creá un nuevo usuario de prueba desde `/signup` en la app.
2. En el dashboard de Supabase → **Table Editor → accounts**, verificá que se creó una fila con:
   - `name`: `Efectivo`
   - `type`: `cash`
   - `institution_id`: `null`
3. En **Table Editor → account_currencies**, verificá que hay dos filas para ese account: una en `ARS` y otra en `USD`, ambas con `initial_balance = 0`.

---

## 11. Checklist de producción

- [ ] Agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` al host (Vercel u otro).
- [ ] Agregar la callback URL de producción en **Authentication → URL Configuration → Redirect URLs**.
- [ ] Setear el **Site URL** al dominio de producción.
- [ ] RLS habilitado en toda tabla que guarde datos de usuario.
- [ ] La service-role key nunca se importa desde código de cliente ni desde archivos en `app/` que puedan terminar en el bundle.
- [ ] Templates de email customizados en **Authentication → Email Templates**.

---

## 12. Resumen de archivos

```
grana-v3/
├── middleware.ts                       # session refresh + route protection
├── .env.local                          # secrets (gitignored)
├── .env.example                        # placeholders (committed)
├── lib/supabase/
│   ├── client.ts                       # browser client
│   ├── server.ts                       # server client
│   ├── middleware.ts                   # middleware helper
│   └── database.types.ts               # generated types
└── app/
    ├── (auth)/
    │   ├── login/
    │   ├── signup/
    │   ├── forgot-password/
    │   └── reset-password/
    ├── _actions/                       # signup/login/logout/reset server actions
    └── auth/callback/route.ts          # OTP + PKCE callback
```
