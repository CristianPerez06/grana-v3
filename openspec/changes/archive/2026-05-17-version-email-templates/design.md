## Context

El flujo de auth de grana-v3 depende de que Supabase mande emails con URLs muy específicas: la confirmación de signup necesita `?token_hash=...&type=signup` para que `/auth/callback` haga `verifyOtp`, y el reset de password necesita `?code=...&next=/reset-password` para que el callback intercambie el código por sesión y setee la cookie `recovery_in_progress`. Los defaults de Supabase usan `{{ .ConfirmationURL }}`, que genera URLs automáticas SIN el `next=/reset-password` que el flujo de recovery necesita — por eso desde el día 1 había que customizarlos en el dashboard.

Hoy esa customización vive solo en el dashboard: no la ve `git`, no la ve un PR review, y un cambio accidental (revertir a `{{ .ConfirmationURL }}`, por ejemplo) rompe el reset password sin que ningún test ni CI lo detecte. El usuario subió los dos templates al repo bajo `supabase/templates/` con las URLs ya custom. Este change formaliza que el repo es la fuente de verdad y documenta el workflow.

Restricciones:
- Todavía no usamos el CLI oficial de Supabase (`supabase init`, `config.toml`). Adoptarlo permitiría auto-deploy de templates desde el repo, pero está fuera de alcance de este change.
- Los subjects de los emails (no el body HTML) siguen viviendo solo en el dashboard. Versionarlos requiere o el CLI de Supabase o un formato propio (frontmatter / archivo `subject.txt` por template). Out of scope por ahora.

## Goals / Non-Goals

**Goals:**
- Formalizar `supabase/templates/` como source of truth via 2 ADDED Requirements en `auth`.
- Documentar el workflow manual de sync repo → dashboard en CLAUDE.md y README.
- Validar (a nivel spec, no de tooling) que los templates contienen las URLs correctas.
- Cero cambios funcionales al código.

**Non-Goals:**
- Adoptar el CLI oficial de Supabase o `config.toml` (vendrá en `adopt-supabase-cli`).
- Versionar los otros 4 templates default de Supabase (Magic Link, Invite User, Change Email Address, Reauthentication) — no los usa la app hoy.
- Traducir los templates al español o agregar branding visual — el usuario explicitó "vamos con los defaults" hasta tener design system.
- Versionar los subjects de los emails.
- Linter / hook de CI que valide que el dashboard refleja el contenido del repo. Si la disciplina manual falla, abrimos un change futuro.

## Decisions

### 1. Modificar `auth` en vez de crear una capability `email-templates`

**Decisión:** sumar las 2 requirements bajo la capability `auth` existente (que ya define el callback de Supabase), no crear una capability nueva `email-templates`.

**Por qué:** los templates son una pieza inseparable del flujo de auth — sus URLs determinan qué procesa el callback. Una capability separada los desconectaría artificialmente. Además, los requirements se leen como "el callback espera X" + "los templates generan X" — viven juntos naturalmente.

**Alternativa descartada:** capability `email-templates` separada. Sobre-diseño: una capability para 2 requirements ligados a auth no aporta sobre tenerlos en `auth`.

### 2. ADDED Requirements, no MODIFIED

**Decisión:** los 2 requirements nuevos van bajo `## ADDED Requirements`, no `## MODIFIED Requirements`.

**Por qué:** ningún requirement preexistente en la capability `auth` cambia su comportamiento — los del callback siguen haciendo lo mismo. Estamos sumando dos requirements nuevos sobre el origen y la forma de los templates. ADDED es el delta correcto. MODIFIED requeriría copiar el bloque completo del requirement original (con sus scenarios) y editarlo, lo que no aplica acá.

### 3. Repo es source of truth, dashboard es mirror

**Decisión:** la regla la fija el spec en una sola dirección. Si el dashboard y el repo divergen, gana el repo. La resolución es copiar del repo al dashboard, nunca al revés.

**Por qué:** el repo es revisable (PRs, blame, history). El dashboard no. Si dejáramos al dashboard como source of truth, perderíamos esa visibilidad y el repo dejaría de tener sentido como check.

**Trade-off:** un colaborador puede editar el dashboard sin actualizar el repo y silenciosamente romper la consistencia. La spec lo documenta; cualquier divergencia detectada al revisar emails se arregla sobrescribiendo el dashboard.

### 4. Sin tooling automatizado

**Decisión:** no agregamos hooks, CI, ni linters para validar que el dashboard refleja el repo. El sync es 100% manual.

**Por qué:** validar el contenido del dashboard requeriría usar la API de Supabase con la service_role key en CI, agregando complejidad y un secreto. A esta escala (2 templates, 2 colaboradores) no se justifica. Si vemos drift repetido, abrimos un change futuro que adopte el CLI de Supabase (que sí permite deploy automatizado desde el repo).

### 5. README mantiene la forma de la URL documentada (no solo "copiar del archivo")

**Decisión:** en README sección 4.3, además de instruir "copiar el contenido de `supabase/templates/<nombre>.html`", mantener la forma esperada de cada URL documentada en texto plano.

**Por qué:** la documentación de la URL sirve como doble check para el reviewer. Si alguien abre el HTML del repo y no encuentra la URL documentada en el README, hay algo mal. La redundancia es deliberada.

## Risks / Trade-offs

- **[Riesgo] Drift dashboard vs repo**: alguien edita el dashboard sin tocar el repo. **Mitigación**: regla explícita en spec + nota en CLAUDE.md + README. Detección reactiva al revisar emails recibidos en pruebas.
- **[Riesgo] Subjects siguen sin versionar**: si alguien edita el subject en el dashboard, no queda traza. Aceptado por ahora; lo cerramos cuando adoptemos el CLI.
- **[Trade-off] Manual sync genera fricción**: cada cambio implica copiar y pegar al dashboard. Aceptable a esta escala (templates rara vez cambian); insuficiente cuando la app tenga 5–10 templates.
- **[Riesgo menor] Templates con URLs hardcoded a `localhost`**: si un colaborador olvida usar `{{ .SiteURL }}` y mete `http://localhost:3000` directamente, prod se rompe. **Mitigación**: el requirement explicita que los templates usan `{{ .SiteURL }}`; un grep rápido en CI futuro lo podría chequear, pero por ahora queda como cuidado de review.
