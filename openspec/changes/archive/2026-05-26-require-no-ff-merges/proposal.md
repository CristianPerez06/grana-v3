## Why

La convención actual exige mergear a `main` con `git merge --ff-only`, produciendo una historia lineal sin merge commits. Eso borra el límite entre features: en `main` no queda registro explícito de qué commits entraron juntos como una unidad de trabajo. Queremos invertir la política a `git merge --no-ff` obligatorio, de modo que cada feature/fix/chore quede agrupado bajo un merge commit que marca dónde empezó y terminó esa unidad de trabajo.

## What Changes

- **BREAKING** (convención): el merge a `main` SHALL ejecutarse con `git merge --no-ff` (nunca `--ff-only`, nunca `--squash` como comando de merge). Se invierte la regla anterior.
- Se conserva el squash previo: la branch SHALL seguir teniendo exactamente **un commit** de trabajo por encima de `main` al momento del merge. Resultado en `main`: 1 commit de feature + 1 merge commit por unidad de trabajo.
- Se conserva el rebase: si `main` se movió mientras la branch estaba en progreso, el colaborador SHALL rebasear su branch sobre `main` antes de mergear con `--no-ff`.
- Se abandona el objetivo de "historia lineal sin merge commits"; pasa a ser una historia con un merge commit por feature.
- El mensaje del merge commit SHALL ser descriptivo (no se acepta el `Merge branch '...'` autogenerado a secas si no identifica la unidad de trabajo).
- La regla del archive-antes-del-merge no cambia su esencia (el archive sigue siendo el último commit de la branch); solo cambia el comando de merge final de `--ff-only` a `--no-ff`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `project-conventions`: se modifica el requirement de merge a `main` — de "único commit + fast-forward (`--ff-only`), historia lineal" a "único commit de trabajo + merge commit (`--no-ff`)". Se actualiza también el scenario del requirement de archive que referencia el comando `--ff-only`.

## Impact

- **`openspec/specs/project-conventions/spec.md`** — requirement "Merge a main…" reescrito vía delta; Purpose intro y scenario de archive que mencionan `--ff-only` se actualizan al integrar el delta en el archive.
- **`CLAUDE.md`** — sección "Merging to `main`" reescrita (comando, ejemplo happy-path, prohibiciones invertidas); la sección "Archive happens in the branch, before merge to main" y su checklist actualizan la referencia `--ff-only` → `--no-ff`.
- **`apps/mobile/EAS_SETUP.md`** — nota de merge `--ff-only` actualizada a `--no-ff`.
- **`.claude/skills/grana-create-pr/SKILL.md`** — la nota condicional sobre "branch protection requiring linear history" se revisa para no contradecir la nueva política.
- **Fuera de alcance**: los changes archivados bajo `openspec/changes/archive/` NO se reescriben (historia inmutable). El change activo `dashboard-desktop-layout-and-cards-relocation` referencia `--ff-only` en su `tasks.md`; seguirá la convención vigente al momento de su merge, no se edita acá.
- **Sin impacto en código de producto ni en el comportamiento contable.** Es una convención de proceso (git + docs).
