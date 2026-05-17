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

