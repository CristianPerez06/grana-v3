# Supabase Setup Guide — grana-v3

End-to-end steps to wire Supabase into this Next.js 16 App Router project for **authentication** and **database access**, using the SSR-friendly `@supabase/ssr` package.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. **New project** → pick an org, set a name (e.g. `grana-v3`), choose a strong DB password, pick the closest region.
3. Wait ~2 minutes for provisioning.
4. Open **Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (optional, server-only, never expose) → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Install packages

From the project root:

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

Optional, for typed DB access (recommended):

```bash
pnpm add -D supabase
```

---

## 3. Environment variables

Create `.env.local` at the project root (already gitignored by Next.js):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
# Optional, server-only:
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Add a `.env.example` (commit this one) with empty placeholders so collaborators know which vars are needed.

---

## 4. Create the Supabase clients

The App Router runs code in three different contexts (browser, server components/actions, middleware). Each needs its own client.

### 4.1 Browser client — `lib/supabase/client.ts`

```ts
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
```

### 4.2 Server client — `lib/supabase/server.ts`

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

### 4.3 Middleware helper — `lib/supabase/middleware.ts`

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

## 5. Add the root middleware — `middleware.ts`

Create this file at the **project root** (same level as `app/`):

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

This refreshes the auth session cookies on every navigation — required for Server Components to see a logged-in user.

---

## 6. Authentication

### 6.1 Enable providers

In the Supabase dashboard → **Authentication → Providers**:

- **Email** is on by default. Decide whether to require email confirmation.
- For OAuth (Google, GitHub, etc.), enable the provider and add the client ID/secret. The redirect URL Supabase shows you must be registered with the OAuth provider.

### 6.2 Login page — `app/login/page.tsx`

```tsx
import { login, signup } from './actions'

export default function LoginPage() {
  return (
    <form className="flex flex-col gap-2 max-w-sm mx-auto mt-20">
      <label>
        Email
        <input name="email" type="email" required className="border p-2 w-full" />
      </label>
      <label>
        Password
        <input name="password" type="password" required className="border p-2 w-full" />
      </label>
      <button formAction={login} className="bg-black text-white p-2">Log in</button>
      <button formAction={signup} className="border p-2">Sign up</button>
    </form>
  )
}
```

### 6.3 Server actions — `app/login/actions.ts`

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const login = async (formData: FormData) => {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message))
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export const signup = async (formData: FormData) => {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message))
  redirect('/login?message=Check your email to confirm your account')
}

export const logout = async () => {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
```

### 6.4 OAuth callback (only if using OAuth) — `app/auth/callback/route.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
```

Register this URL in **Authentication → URL Configuration → Redirect URLs**:
`http://localhost:3000/auth/callback` for dev, plus the production URL.

### 6.5 Reading the current user

In a Server Component:

```ts
import { createClient } from '@/lib/supabase/server'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <p>Hello {user?.email}</p>
}
```

Always use `supabase.auth.getUser()` on the server (it verifies the JWT). Don't trust `getSession()` for authorization on the server.

---

## 7. Database

### 7.1 Create tables

In the dashboard → **Table Editor** or **SQL Editor**. Example:

```sql
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
```

### 7.2 Enable Row Level Security (RLS)

**Critical.** Without RLS, the anon key can read/write everything.

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

### 7.3 Query from a Server Component

```ts
import { createClient } from '@/lib/supabase/server'

export default async function TodosPage() {
  const supabase = await createClient()
  const { data: todos, error } = await supabase.from('todos').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return <ul>{todos.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
}
```

### 7.4 Mutate via a Server Action

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

## 8. Generate TypeScript types (recommended)

```bash
pnpm dlx supabase login
pnpm dlx supabase gen types typescript --project-id <project-ref> --schema public > lib/supabase/database.types.ts
```

Then type the clients:

```ts
import type { Database } from '@/lib/supabase/database.types'
createBrowserClient<Database>(...)
createServerClient<Database>(...)
```

Re-run `gen types` whenever the schema changes (consider a `pnpm run types:db` script).

---

## 9. Verify

1. `pnpm dev`
2. Visit `/login`, sign up with a test email, confirm via the email link if required.
3. Visit a protected route (e.g. `/dashboard`) — should load when logged in, redirect to `/login` when logged out.
4. Insert a row from the UI, refresh, confirm it persists.
5. Log out and confirm the protected route redirects again.

---

## 10. Production checklist

- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the host (Vercel/etc.).
- [ ] Add the production callback URL under **Authentication → URL Configuration → Redirect URLs**.
- [ ] Set **Site URL** to the production domain.
- [ ] RLS enabled on every table that holds user data.
- [ ] Service-role key never imported by client code or any file under `app/` that could be bundled.
- [ ] Email templates customized under **Authentication → Email Templates**.

---

## File summary

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
    ├── login/
    │   ├── page.tsx
    │   └── actions.ts
    └── auth/callback/route.ts          # only if using OAuth
```
