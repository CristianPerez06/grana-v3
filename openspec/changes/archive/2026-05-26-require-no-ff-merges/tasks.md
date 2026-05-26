## 1. CLAUDE.md — política de merge

- [x] 1.1 Reescribir la sección "Merging to `main`": cambiar el objetivo de "historia lineal sin merge commits" a "un commit de trabajo + un merge commit `--no-ff` por feature/fix/chore"; conservar la regla de squash a 1 commit y la de rebase si `main` se movió.
- [x] 1.2 Invertir las prohibiciones: el comando de merge SHALL ser `git merge --no-ff`; prohibir `--ff-only` y `--squash` como comando de merge; exigir que el mensaje del merge commit identifique la unidad de trabajo.
- [x] 1.3 Actualizar el ejemplo happy-path (branch con 3 commits, `main` movió) para terminar en `git merge --no-ff my-branch`.
- [x] 1.4 En la sección "Archive happens in the branch, before merge to main" y su checklist, cambiar las referencias `--ff-only` → `--no-ff`.

## 2. Docs secundarias

- [x] 2.1 `apps/mobile/EAS_SETUP.md`: cambiar la nota de merge `--ff-only` → `--no-ff`.
- [x] 2.2 `.claude/skills/grana-create-pr/SKILL.md`: revisar la nota condicional "branch protection requiring linear history" para que no contradiga la política `--no-ff` (ajustar el texto a la convención del repo o suavizarlo a genérico).

## 3. Verificación de consistencia

- [x] 3.1 Correr `grep -rn -i "ff-only" .` excluyendo `node_modules`, `openspec/changes/archive/` y el change `dashboard-desktop-layout-and-cards-relocation`: no debe quedar ninguna mención de `--ff-only` como política vigente fuera de este change.
- [x] 3.2 Confirmar que NO se tocaron changes archivados ni el `tasks.md` de `dashboard-desktop-layout-and-cards-relocation` (fuera de alcance).

## 4. Archive (pre-merge)

- [x] 4.1 Mover `openspec/changes/require-no-ff-merges/` a `openspec/changes/archive/AAAA-MM-DD-require-no-ff-merges/`.
- [x] 4.2 Aplicar los deltas (RENAMED + MODIFIED) al spec maestro `openspec/specs/project-conventions/spec.md`: integrar el requirement renombrado con su nuevo cuerpo/scenarios y el requirement de archive modificado en la sección plana `## Requirements`, sin dejar secciones delta residuales.
- [x] 4.3 Actualizar el Purpose/intro del spec maestro `project-conventions` (línea que describe "reglas de branching y merge `--ff-only`") para reflejar `--no-ff`.
- [x] 4.4 Correr `pnpm openspec:check` — debe pasar antes del merge.
