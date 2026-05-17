## Why

grana-v3 hoy solo tiene los clientes Supabase cableados y un formulario de login mínimo que redirige a un `/dashboard` inexistente. No hay registro funcional con confirmación de email, no hay reset de password, no hay logout en la UI, ni soporte multi-idioma — todo eso es bloqueante para que la app pueda recibir usuarios reales. Lo construimos ahora porque el resto de los features (perfil, transacciones, etc.) presuponen un usuario autenticado y un patrón de validación + i18n establecido.

## What Changes

- Crear flujo de **registro** en `/signup` con email + password + confirmar password + nombre, exigiendo confirmación de email antes de poder iniciar sesión.
- Crear flujo de **login** en `/login` con email + password, devolviendo errores con estado en la ruta (no querystring).
- Crear flujo de **reset de password** completo: `/forgot-password` → email → `/auth/callback` → `/reset-password` → `updateUser` → `signOut` → `/login`.
- Crear endpoint `/auth/callback` que discrimina entre confirmación de signup (OTP: `token_hash` + `type=signup`) y recuperación de password (PKCE: `code` + `next=/reset-password`), seteando una cookie `recovery_in_progress` (httpOnly, 10min) cuando corresponde.
- Endurecer `middleware.ts` con detección de sesión de recovery por dos señales independientes (cookie + JWT `amr` claim) para forzar al usuario en recovery a permanecer en `/reset-password`.
- Crear tabla `public.profiles` (`id` PK→`auth.users`, `full_name`, `email`, `created_at`) con trigger `handle_new_user` que la puebla al insertar en `auth.users` y políticas RLS para que cada usuario solo lea/edite la suya.
- Introducir **validación unificada** con `react-hook-form` + `Yup`, con schemas compartidos en `lib/validation/` que se usan tanto en el cliente como en los server actions; cada action devuelve `{ ok, fieldErrors?, formError? }`.
- Mapear los códigos de error de Supabase a mensajes en español a través del sistema de i18n.
- Introducir **i18n** con `next-intl` usando **cookie** (sin segmento `[locale]` en la URL), locales `es` y `en`, default `es`, con un language switcher visible en el footer de todas las rutas.
- Reorganizar `app/` en route groups: `(auth)/` (layout compartido tipo card centrada) para login/signup/forgot/reset, y `(app)/` (layout con header + botón logout) para dashboard.
- Crear `/dashboard` como página placeholder mínima dentro de `(app)`.
- Crear UI de **logout** en el header de `(app)`.
- **BREAKING** (interno, sin usuarios todavía): mover `app/login` a `app/(auth)/login`; eliminar el patrón de errores por querystring documentado en `SUPABASE_SETUP.md`.
- Actualizar `SUPABASE_SETUP.md` para reflejar el nuevo patrón de errores (estado en ruta, no querystring).
- Actualizar `README.md` con los pasos manuales necesarios en el dashboard de Supabase (templates de email apuntando a `/auth/callback` con el `next` correcto, URL configuration, SQL para `profiles` + trigger + RLS).

## Capabilities

### Capabilities nuevas

- `auth`: Registro, login, logout, confirmación de email y reset de password sobre Supabase Auth, con server actions que devuelven errores tipados y un `/auth/callback` que arbitra los flujos OTP y PKCE.
- `profiles`: Tabla `public.profiles` con trigger automático desde `auth.users` y políticas RLS por usuario; expone el nombre del usuario al resto de la app.
- `i18n`: Internacionalización con `next-intl` basada en cookie, locales `es`/`en` (default `es`), language switcher en footer, y catálogos compartidos para validación, errores de Supabase y UI de auth.

### Capabilities modificadas

_None — todavía no hay specs publicados en `openspec/specs/`._

## Impact

- **Código nuevo**:
  - `app/(auth)/{layout,login,signup,forgot-password,reset-password}/page.tsx` + acciones server.
  - `app/(app)/{layout,dashboard/page,_components/header}.tsx` + acción `logout`.
  - `app/auth/callback/route.ts`.
  - `lib/validation/auth.ts` (schemas Yup compartidos).
  - `lib/i18n/{config,request}.ts` + `messages/{es,en}.json`.
  - `lib/supabase/errors.ts` (mapeo de códigos a claves i18n).
  - `components/footer/language-switcher.tsx`.
  - `supabase/migrations/0001_profiles.sql` (tabla + trigger + RLS).
- **Código modificado**:
  - `middleware.ts` + `lib/supabase/middleware.ts`: agregar detección de recovery (cookie + AMR), bootstrap de cookie de locale.
  - `app/layout.tsx`: envolver en `NextIntlClientProvider`, cargar fuente y footer global.
  - `app/login/*` → eliminado (se mueve a `(auth)/login`).
  - `SUPABASE_SETUP.md`: reemplazar la sección de manejo de errores por querystring por el nuevo patrón.
  - `README.md`: agregar sección "Configuración inicial de Supabase" con los pasos del dashboard y el SQL.
- **Dependencias nuevas**: `react-hook-form`, `@hookform/resolvers`, `yup`, `next-intl`.
- **Dependencias existentes que se aprovechan**: `@supabase/ssr`, `@supabase/supabase-js`, primitivos UI en `components/ui/*` (button, input, alert, form-field, card, label, spinner).
- **Acciones manuales requeridas en Supabase** (documentadas en README): habilitar email provider con confirmación, configurar Site URL y Redirect URLs, traducir/ajustar templates de email para apuntar a `/auth/callback` con los `next` correctos, ejecutar la migración SQL.
- **Riesgos**: el flujo de recovery es históricamente frágil (grana-v2 ya lo padeció). El diseño replica explícitamente los dos mecanismos de v2 (cookie + AMR) para evitar regresiones; ver `design.md` para los gotchas.
