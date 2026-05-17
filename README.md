# Grana V3

Aplicación de finanzas personales.

## Primeros pasos

### 1. Instalar pnpm

Si no tenés pnpm instalado todavía, elegí una de estas opciones:

- **Rápido (recomendado si tenés Node ≥ 16.13)**:
  ```bash
  corepack enable pnpm
  ```
- **Canónico**: seguir las instrucciones de [pnpm.io/installation](https://pnpm.io/installation).

Verificá que quedó disponible:

```bash
pnpm --version
```

### 2. Instalar dependencias

```bash
pnpm install
```

> **Si ves un warning tipo `[ERR_PNPM_IGNORED_BUILDS]`** mencionando paquetes como `@parcel/watcher` o `@swc/core`, no es un error: pnpm pide tu autorización explícita para correr los build scripts de esas dependencias (es una protección contra paquetes maliciosos). En este repo ya dejamos preaprobados los paquetes seguros en la sección `pnpm.onlyBuiltDependencies` de `package.json`, así que normalmente no debería aparecer. Si igual aparece (por ejemplo después de agregar una dependencia nueva), corré:
>
> ```bash
> pnpm approve-builds
> ```
>
> Te va a abrir un menú interactivo: con la barra espaciadora seleccionás los paquetes a aprobar y con Enter confirmás. Para los paquetes que ya están en el proyecto (`@parcel/watcher`, `@swc/core`) es seguro aprobarlos.

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y completa tus credenciales de Supabase:

```bash
cp apps/web/.env.example apps/web/.env
```

> Next.js carga el `.env` desde el cwd de la app, por eso vive en `apps/web/`, no en la raíz del repo.

| Variable                        | Dónde encontrarla                                              |
| ------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Panel de Supabase → Project Settings → API → Project URL       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Panel de Supabase → Project Settings → API → Publishable key   |

### 4. Configuración inicial de Supabase

Antes de levantar la app por primera vez, en el panel de Supabase:

#### 4.1 Email provider

**Authentication → Providers → Email**

- ✅ Habilitar el provider Email.
- ✅ Activar **Confirm email** (requiere confirmación antes de poder iniciar sesión).
- ✅ Activar **Secure password change** (recomendado).

#### 4.2 URLs de redirect

**Authentication → URL Configuration**

- **Site URL**: `http://localhost:3000` en desarrollo, tu dominio en producción.
- **Redirect URLs**: agregar
  - `http://localhost:3000/auth/callback`
  - `https://<tu-dominio>/auth/callback` (cuando despliegues)

#### 4.3 Templates de email

**Authentication → Email Templates**

Los templates viven versionados en el repo bajo `supabase/templates/`. **El repo es la source of truth** — el dashboard de Supabase es un mirror manual hasta que adoptemos el CLI oficial.

Para cada uno de estos dos templates, abrí el archivo del repo, copiá el contenido completo del body y pegalo en el campo correspondiente del dashboard:

| Template del dashboard | Archivo en el repo                     |
| ---------------------- | -------------------------------------- |
| **Confirm signup**     | `supabase/templates/confirm-signup.html` |
| **Reset password**     | `supabase/templates/reset-password.html` |

Como doble check, los enlaces dentro de cada template deben respetar estas formas exactas (el callback de la app las parsea con esa estructura):

```
confirm-signup  → {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup
reset-password  → {{ .SiteURL }}/auth/callback?code={{ .Token }}&next=/reset-password
```

> Si el dashboard y el repo divergen alguna vez, **sobrescribí el dashboard con el contenido del repo, nunca al revés**. Los subjects (asuntos) por ahora siguen viviendo solo en el dashboard.

#### 4.4 Schema de base de datos

Ejecutar en **SQL Editor**:

```bash
# El archivo está en supabase/migrations/0001_profiles.sql
```

Copiar y pegar el contenido del archivo; correrlo una vez. Crea la tabla `public.profiles`, su RLS y el trigger `on_auth_user_created` que la mantiene sincronizada con `auth.users`.

### 5. Ejecutar la aplicación

```bash
pnpm dev
```

La app estará disponible en [http://localhost:3000](http://localhost:3000).

### 6. (Opcional) Instalar el CLI de OpenSpec

El repo está configurado para usar [OpenSpec](https://github.com/Fission-AI/OpenSpec) como flujo de spec-driven development. Los skills y slash commands ya vienen versionados en `.claude/`, pero el CLI se instala aparte:

```bash
pnpm add -g @fission-ai/openspec
```

Una vez instalado, dentro de Claude Code podés usar:

- `/opsx:propose "<idea>"` — crear una nueva propuesta de cambio
- `/opsx:explore` — explorar / refinar una idea antes de proponerla
- `/opsx:apply` — implementar las tasks de un cambio
- `/opsx:archive` — archivar un cambio ya completado

Las propuestas viven en `openspec/changes/` y las specs en `openspec/specs/`.

## Scripts disponibles

| Script              | Descripción                                       |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Inicia el servidor de desarrollo                  |
| `pnpm build`        | Compila la app para producción                    |
| `pnpm start`        | Ejecuta la build de producción                    |
| `pnpm lint`         | Ejecuta ESLint en todo el proyecto                |
| `pnpm storybook`    | Levanta Storybook en el puerto 6006               |

## Convenciones

- **Componentes reusables** viven en `apps/web/components/ui/` con su Storybook story al lado. Antes de inventar un wrapper compuesto, ver si se puede componer con los primitivos existentes.
- **Estilos**: solo Tailwind v4, usando los tokens semánticos del tema (`bg-background`, `text-foreground`, `text-destructive`, etc.). Los tokens viven en `packages/ui-tokens/src/theme.css` y `apps/web/app/globals.css` los importa. Nada de `bg-zinc-*`/`text-gray-*` directos — rompen el dark mode.
- **i18n**: la app usa [`next-intl`](https://next-intl.dev) con cookie `NEXT_LOCALE` (sin segmento `[locale]` en la URL). Los locales soportados están en `apps/web/lib/i18n/config.ts`; los catálogos en `packages/i18n-messages/src/<locale>.json` (consumidos vía `@grana/i18n-messages`). El switcher vive en el footer.
- **Validación**: schemas Yup y helpers cross-platform viven en `packages/validation/src/` (paquete `@grana/validation`), compartidos entre los forms (`react-hook-form` + `yupResolver`) y los server actions (`validateActionInput`). El bridge React/`next-intl` (`setup-yup-locale.tsx`) se queda en `apps/web/lib/validation/` porque depende del runtime de next-intl.
- **Supabase client**: el factory cross-platform vive en `packages/supabase/` (paquete `@grana/supabase`, expone `createClient` + slot `Database`). Los wrappers Next-aware (`createBrowserClient` / `createServerClient` con cookies de `@supabase/ssr`) viven en `apps/web/lib/supabase/`.
- **Server actions de auth** devuelven `ActionResult<T> = { ok: true } | { ok: false, fieldErrors?, formError? }`. Los errores se muestran en la ruta con estado local, no por querystring.

---

## Estructura del proyecto

El repo es un **monorepo pnpm**: una app web hoy (`apps/web`), paquetes compartidos en `packages/*`, y un slot reservado para la app mobile (`apps/mobile`, todavía no creado).

```
grana-v3/
├── apps/
│   └── web/                       # Next.js App Router — la única app por ahora
│       ├── app/                   # rutas, layouts, server actions
│       ├── components/            # primitivos UI + footer
│       ├── lib/                   # código específico de web (supabase ssr, i18n runtime, etc.)
│       ├── .storybook/
│       ├── public/                # activos estáticos
│       ├── .env / .env.example    # vars de entorno (Next las lee desde el cwd de la app)
│       ├── next.config.ts         # `transpilePackages` incluye los @grana/*
│       └── tsconfig.json          # extiende `../../tsconfig.base.json`
├── packages/
│   ├── validation/                # @grana/validation — schemas Yup + helpers (cross-platform)
│   ├── i18n-messages/             # @grana/i18n-messages — catálogos JSON
│   ├── supabase/                  # @grana/supabase — slot Database + createClient factory
│   └── ui-tokens/                 # @grana/ui-tokens — design tokens (CSS, fuente única para web)
├── supabase/                      # SQL migrations + email templates (backend, no es una app)
├── openspec/                      # workflow spec-driven
├── CLAUDE.md                      # contexto para Claude Code
├── SUPABASE_SETUP.md
├── README.md
├── package.json                   # orquestador (`pnpm dev`, `build`, etc. → `pnpm --filter web …`)
├── pnpm-workspace.yaml            # declara `apps/*` y `packages/*`
├── tsconfig.base.json             # base TS con paths `@grana/*` → source directa
└── .npmrc                         # hoist patterns necesarios para eslint-config-next
```

Reglas rápidas:
- Código específico de una plataforma vive en `apps/<name>/`.
- Código reutilizable entre apps **y sin deps de plataforma** vive en `packages/<name>/`.
- La raíz **no tiene código de producto**.

## Deploy en Vercel

Por ser monorepo, Vercel necesita saber qué subdirectorio buildear. En el dashboard del proyecto → **Settings → Build & Development Settings → Root Directory**, setear `apps/web`. Las env vars del proyecto (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) no cambian. Vercel detecta el `pnpm-workspace.yaml` en la raíz y corre `pnpm install` desde ahí.

> Acción única por entorno: hay que cambiarlo **antes** del primer push post-migración para evitar un build rojo. Sin Root Directory ajustado, Vercel buildea la raíz y no encuentra Next.

## Stack tecnológico

- [Next.js 16](https://nextjs.org) (App Router)
- [React 19](https://react.dev)
- [TypeScript](https://www.typescriptlang.org) (modo estricto)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Supabase](https://supabase.com) — autenticación y base de datos (ver [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md))
- [pnpm](https://pnpm.io) — gestor de paquetes
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) — spec-driven development asistido por IA
