# Tareas — Squash-merge + linear history

## Grupo 1 · Spec de project-conventions

- [ ] 1.1. Agregar el delta `## MODIFIED Requirements` que reemplaza "Merge a main con un único commit de trabajo y merge commit (--no-ff)" por la nueva regla de squash-merge + linear history. Incluir scenarios para:
  - Branch trivial (1 commit) → squash-merge desde GitHub UI.
  - Branch con N > 1 commits (WIP, fixups, correcciones in-flight) → squash colapsa todo, sin operación manual.
  - Intento de habilitar "Create a merge commit" o "Rebase and merge" es violación de la configuración esperada.
  - LLM autónomo no necesita ejecutar `git rebase -i` ni componer merge commit messages.
- [ ] 1.2. Agregar el delta `## MODIFIED Requirements` que reescribe "El archive de una change ocurre en la branch antes del merge a main" sin la palabra "atómico" ni el framing de "último commit". El principio se preserva: la branch SHALL contener el archive aplicado antes del squash-merge, y `pnpm openspec:check` SHALL correr y pasar antes de apretar "Squash and merge".
- [ ] 1.3. Agregar (dentro de la regla de merge o como sub-sección) la configuración exacta requerida de GitHub branch protection: "Require linear history" ON, "Allow merge commits" OFF, "Allow squash merging" ON con default de título "Pull request title" y body vacío, "Allow rebase merging" OFF.

## Grupo 2 · AGENTS.md

- [ ] 2.1. Reescribir la sub-sección de Branching/Merging en `AGENTS.md`:
  - Reemplazar el happy-path actual (squash manual + `git merge --no-ff`) por el flujo squash-and-merge vía GitHub UI.
  - Aclarar que la branch puede tener N commits durante el trabajo (no hace falta squashear a mano).
  - Mantener intacta la regla de "commit messages: title only, no body, no trailers, conventional commits" — aplica al squash commit message editado en el botón.
  - Mantener intacta la prohibición de mergear a `main` desde local (el merge a `main` ocurre vía GitHub UI).
- [ ] 2.2. Eliminar las referencias a `git merge --no-ff`, `git rebase -i main`, `git reset --soft main && git commit` y `--ff-only` del happy-path. Pueden quedar como "no aplica" si es importante explicar por qué.
- [ ] 2.3. Agregar una nota corta en la sección de OpenSpec workflow aclarando que el flujo lógico sigue siendo explore → apply → archive, pero los commits intermedios de la branch ya no se estructuran por fase (se aplanan al squash).

## Grupo 3 · GitHub branch protection (manual, fuera del repo)

- [ ] 3.1. Aplicar la configuración documentada en la spec a la branch `main` del repo en GitHub:
  - Settings → Branches → Branch protection rules → `main`.
  - "Require linear history" → ON.
  - "Allow merge commits" → OFF.
  - "Allow squash merging" → ON; default commit title: "Pull request title"; default commit body: vacío.
  - "Allow rebase merging" → OFF.
- [ ] 3.2. (Opcional pero recomendado) Probar el flujo con un PR trivial (p. ej. un typo doc) antes del primer PR real bajo el nuevo régimen, para verificar que el botón "Squash and merge" aparece y que los otros métodos están ocultos.

## Grupo 4 · Archive (fase final)

- [ ] 4.1. Mover `openspec/changes/adopt-squash-merge-and-linear-history/` → `openspec/changes/archive/YYYY-MM-DD-adopt-squash-merge-and-linear-history/`.
- [ ] 4.2. Aplicar los deltas al `openspec/specs/project-conventions/spec.md`: las dos MODIFIED requirements en su forma final integrada (sin marcadores de delta), y `Purpose` actualizado si corresponde.
- [ ] 4.3. Correr `pnpm openspec:check` y verificar exit code 0.

## Notas

- Esta change es la **primera** bajo el nuevo régimen. La branch `feature/adopt-squash-merge-and-linear-history` se mergea vía el flujo viejo (`--no-ff`) si la configuración de GitHub todavía no fue aplicada al momento del merge, o vía el flujo nuevo (squash-and-merge) si la 3.1 ya fue aplicada. Cualquiera de los dos es válido para esta change específica; las siguientes ya SHALL ir por squash-and-merge.
