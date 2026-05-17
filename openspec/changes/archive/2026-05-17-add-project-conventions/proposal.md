## Why

El proyecto va a ser colaborado con otra persona hispanohablante y hoy la documentación está mezclada: el README y CLAUDE.md están en inglés, los OpenSpec proposals/design/tasks que generamos están en español, pero las specs (`specs/*/spec.md`) están en inglés. Esto rompe la coherencia y crea fricción de lectura. Al mismo tiempo, no tenemos reglas explícitas que enforcen el idioma del código, los commits, ni el formato de los nombres de branches — depende de la disciplina de cada colaborador (humano o LLM), lo que ya empezó a generar inconsistencias (p. ej. branches con sufijos de IDs random generados automáticamente). Las queremos enforzadas via spec para que sean revisables y archivables en el flujo OpenSpec.

## What Changes

- Introducir la capability **`project-conventions`** con 6 requirements:
  - Toda la documentación SHALL estar en español (con dos excepciones explícitas: keywords parseados de OpenSpec y `CLAUDE.md`).
  - Todo el código SHALL estar en inglés (identifiers, archivos, comentarios, JSDoc, story names), con excepción de los valores de strings i18n.
  - Los mensajes de commit SHALL estar en inglés siguiendo conventional commits.
  - Los nombres de branches SHALL seguir el formato definido en `CLAUDE.md` y NO DEBEN incluir IDs random, hashes o sufijos numéricos arbitrarios.
  - El `README.md` SHALL incluir un paso explícito de instalación de pnpm antes de cualquier `pnpm install`.
  - El `CLAUDE.md` SHALL documentar explícitamente la prohibición de IDs random en branch names.
- Como parte del apply, traducir al español la documentación existente que hoy está en inglés:
  - `openspec/changes/add-auth-flow/specs/{auth,profiles,i18n}/spec.md` (preservando los keywords del parser OpenSpec).
  - `openspec/changes/add-auth-flow/{proposal,design,tasks}.md` (revisión de coherencia; los archivos ya están mayormente en español).
  - `SUPABASE_SETUP.md` (todo el archivo en inglés actualmente).
- Actualizar `README.md` para agregar el paso de instalación de pnpm como prerequisito.
- Actualizar `CLAUDE.md` para sumar la cláusula de branch naming (prohibición de IDs random).

## Capabilities

### Capabilities nuevas

- `project-conventions`: reglas de proceso e idioma del proyecto enforzadas vía spec — idioma de doc, idioma de código, idioma de commits, formato de branch names, prerequisitos de instalación en README, y documentación de la regla de branches en CLAUDE.md.

### Capabilities modificadas

_Ninguna — `project-conventions` es una capability nueva. Las otras capabilities existentes (`auth`, `profiles`, `i18n` del change `add-auth-flow`) no cambian en su comportamiento; solo se traducirá el lenguaje de sus archivos de spec, lo cual no altera requirements._

## Impact

- **Archivos modificados** (traducción / actualización):
  - `openspec/changes/add-auth-flow/specs/auth/spec.md` (inglés → español)
  - `openspec/changes/add-auth-flow/specs/profiles/spec.md` (inglés → español)
  - `openspec/changes/add-auth-flow/specs/i18n/spec.md` (inglés → español)
  - `openspec/changes/add-auth-flow/proposal.md` (revisión)
  - `openspec/changes/add-auth-flow/design.md` (revisión)
  - `openspec/changes/add-auth-flow/tasks.md` (revisión, preservando checkboxes y su estado actual)
  - `SUPABASE_SETUP.md` (inglés → español)
  - `README.md` (agregar paso de instalación pnpm + revisar coherencia)
  - `CLAUDE.md` (agregar cláusula de branch naming)
- **Archivos nuevos**:
  - `openspec/changes/add-project-conventions/proposal.md`, `design.md`, `tasks.md`
  - `openspec/changes/add-project-conventions/specs/project-conventions/spec.md`
- **Sin cambios en código**: cero modificaciones a `lib/`, `app/`, `components/`, `middleware.ts`, etc. El código ya cumple con la regla de inglés (verificado durante `add-auth-flow`).
- **Sin dependencias nuevas**.
- **Riesgo**: traducir las specs sin tocar los keywords del parser (`### Requirement:`, `#### Scenario:`, `**WHEN**/**THEN**/**AND**`, `## ADDED Requirements`, etc.); si se tocan, OpenSpec deja de detectar requirements. Mitigación: checklist explícito en `tasks.md` y verificación post-traducción con `openspec status` y `openspec instructions specs --change add-auth-flow --json`.
- **Enforcement**: por ahora estas reglas son manuales (revisión humana / LLM-prompted). No incluimos linters ni hooks de CI en este change — podemos agregarlos en un change futuro si la disciplina manual se vuelve insuficiente.
