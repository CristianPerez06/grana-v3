## Why

Hoy los templates de email de Supabase que dispara nuestro flujo de auth (confirmación de signup y reset de password) viven solo en el dashboard de Supabase. Eso significa que son código no versionado, sin revisión, fácil de romper sin que nadie se entere y opaco para cualquier colaborador nuevo. Específicamente: si alguien (humano o LLM) modifica un enlace en el dashboard y deja `{{ .ConfirmationURL }}` en vez de la URL custom que necesita `/auth/callback`, el flujo de recovery se rompe silenciosamente — no hay test ni CI que lo detecte. Versionarlos en el repo cierra ese hueco y nos permite hacer review de cambios al copy o a las URLs como con cualquier otro código.

## What Changes

- Tratar a `supabase/templates/*.html` como **fuente de verdad** para los templates de email. El dashboard de Supabase queda como mirror manual hasta que adoptemos el CLI oficial.
- Sumar 2 ADDED Requirements a la capability `auth`:
  - Los templates de email usados por la app DEBEN estar versionados bajo `supabase/templates/`.
  - Cada template DEBE contener un enlace cuyo URL siga la forma exacta que `/auth/callback` espera (`token_hash`+`type=signup` para signup, `code`+`next=/reset-password` para recovery).
- Los 2 archivos HTML ya existen en `supabase/templates/` (subidos por el usuario con los defaults de Supabase en inglés, ya customizados con las URLs correctas). Solo queda validar y documentar.
- Actualizar `README.md` sección 4.3: en vez de instruir "cambiar el enlace a X en el dashboard", instruir "copiar `supabase/templates/<nombre>.html` al dashboard". La forma de la URL queda documentada como doble check.
- Actualizar `CLAUDE.md`: nota corta explicando que `supabase/templates/` es source of truth y que el sync con el dashboard es manual.

## Capabilities

### Capabilities nuevas

_Ninguna._

### Capabilities modificadas

- `auth`: se le agregan 2 requirements relacionados al origen y forma de los templates de email. No se modifica ningún requirement preexistente — todo lo nuevo va bajo `## ADDED Requirements`.

## Impact

- **Archivos nuevos** (ya creados por el usuario fuera del flujo OpenSpec):
  - `supabase/templates/confirm-signup.html`
  - `supabase/templates/reset-password.html`
- **Archivos modificados**:
  - `README.md` — sección 4.3 reescrita para apuntar al repo
  - `CLAUDE.md` — nota breve sobre el workflow de templates
  - `openspec/changes/version-email-templates/specs/auth/spec.md` — delta nuevo
- **Sin cambios en código** (`lib/`, `app/`, `components/`).
- **Sin dependencias nuevas**.
- **Workflow operativo**: cualquier cambio a un template implica (1) editar el HTML en el repo, (2) commit, (3) copiar a mano al dashboard de Supabase. Aceptamos ese paso manual hasta que adoptemos el CLI de Supabase.
- **Riesgo**: el dashboard puede divergir si alguien lo edita ahí sin actualizar el repo. Mitigación: la regla del repo como source of truth queda documentada en CLAUDE.md y en README; cualquier divergencia que se detecte se resuelve sobrescribiendo el dashboard con el contenido del repo (no al revés).
