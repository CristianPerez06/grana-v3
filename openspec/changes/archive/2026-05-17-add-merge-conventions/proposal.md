## Why

La historia de `main` hoy tiene merge commits (`Merge branch 'chore/...'`) porque los merges previos se hicieron sin `--ff-only`. Eso ensucia el log, complica los rebases futuros y hace más difícil ubicar features sueltos. El usuario quiere que de acá en adelante `main` tenga **historia lineal**: una branch = un commit en `main`, sin merge commits. La capability `project-conventions` ya cubre branch naming y otros aspectos del proceso, pero no dice nada sobre cómo se integra una branch a `main`. Esta laguna es la que cerramos.

## What Changes

- Sumar a la capability `project-conventions` un ADDED Requirement nuevo que enforce:
  - Toda branch que se mergea a `main` SHALL tener exactamente 1 commit por encima de `main` al momento del merge.
  - El merge SHALL ejecutarse con `git merge --ff-only` (jamás `--no-ff`, jamás `--squash` en el comando de merge).
  - Si `main` se movió mientras la branch estaba en progreso, el colaborador SHALL primero rebasear su branch sobre `main` y después mergear con `--ff-only`.
- Actualizar `CLAUDE.md` sección `## Branching` para documentar la regla nueva con un ejemplo concreto del flow (squash local → rebase si hace falta → merge --ff-only).

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `project-conventions`: se le suma un requirement sobre el flujo de merge. Ningún requirement existente cambia su comportamiento — solo se agrega uno nuevo bajo `## ADDED Requirements`.

## Impact

- **Archivos modificados**:
  - `CLAUDE.md` — nueva regla + ejemplo en sección `## Branching`
  - `openspec/changes/add-merge-conventions/specs/project-conventions/spec.md` — delta nuevo
- **Sin cambios en código** (`lib/`, `app/`, `components/`, etc.)
- **Sin dependencias nuevas**
- **Sin enforcement automatizado**: la regla queda como convención manual (revisión humana + CLAUDE.md como prompt para LLMs). Si vemos que se viola repetidamente, abriremos un change futuro con GitHub branch protection rules o hooks pre-merge locales.
- **La historia previa de `main` no se reescribe**. La regla aplica de acá en adelante; los merge commits viejos quedan como evidencia histórica del proceso anterior.
- **Riesgo**: un colaborador (humano o LLM) puede ignorar la regla y mergear con `--no-ff` por costumbre. **Mitigación**: la nota en CLAUDE.md la leen los LLMs en cada sesión; la review humana en PR es la última línea.
