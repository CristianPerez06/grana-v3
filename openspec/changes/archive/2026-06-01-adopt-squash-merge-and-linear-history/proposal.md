# Adoptar squash-merge + linear history para el merge a main

## Why

La regla actual de merge ("la branch al merge presenta exactamente **1 commit de trabajo** + `git merge --no-ff`") exige expertise de git de quien mergea: si la branch tiene N > 1 commits, hay que squashearlos a mano con `git rebase -i` con fixups o `git reset --soft main && git commit`, y después ejecutar el merge correcto. Para un dev senior es trivial; para un colaborador no-dev o un LLM autónomo trabajando contra el repo, es exactamente el tipo de operación donde se rompen cosas (squash mal hecho, mensaje del merge commit sin identificar la unidad de trabajo, `--ff-only` accidental, etc.).

La propuesta es **dejar que GitHub haga el trabajo**: habilitar "Require linear history" + "Squash and merge" como único método permitido en la branch protection de `main`. Bajo este modelo:

- La branch puede tener cualquier cantidad de commits durante el trabajo (incluyendo WIP, fixups, "oops typo", correcciones in-flight a la change). No hace falta squashearlos manualmente.
- En el momento del merge, el botón "Squash and merge" de GitHub colapsa la branch en **un único commit linealmente apilado sobre `main`**, sin merge commit. El mensaje del squash commit lo edita quien mergea (queda en inglés, formato conventional commits, igual que hoy).
- "Require linear history" impide que un merge commit aparezca en `main`, garantizando que la historia sea estrictamente lineal.

El trade-off aceptado es **perder el merge commit como "feature boundary"** explícito en `main`. La unidad de feature pasa a estar marcada por el propio squash commit (con su mensaje conventional). `git log main --first-parent` y `git log main` colapsan a la misma cosa: una entrada por feature.

## What Changes

### A — Política de merge a main

- **MODIFIED** la regla "Merge a main con un único commit de trabajo y merge commit (--no-ff)" → reemplazar por "Merge a main vía squash-and-merge sobre historia lineal". Se elimina la obligación de squashear localmente antes del merge (lo hace GitHub) y se elimina `--no-ff` (incompatible con linear history). Se prohíbe explícitamente la creación de merge commits en `main`.
- **MODIFIED** la regla de archive ("El archive de una change ocurre en la branch antes del merge a main") → preservar el principio (el archive vive en la branch antes del merge a main), pero reescribir la sección que habla del "último commit atómico" porque ya no aplica bajo squash. Lo que importa es que **la branch como un todo** contenga el archive aplicado antes del squash-merge, para que post-merge `pnpm openspec:check` pase contra el `main` resultante.

### B — Configuración de GitHub branch protection

- **ADDED** Documentación de la configuración requerida en GitHub para la branch `main`:
  - "Require linear history" → ON.
  - "Allow merge commits" → OFF.
  - "Allow squash merging" → ON, configurar default del título como "Pull request title" y del cuerpo como "Pull request description" (para que el squash commit herede el título conventional que el colaborador escribió en el PR).
  - "Allow rebase merging" → OFF (para simplificar: hay un solo botón válido).

### C — Documentación cross-tool

- **MODIFIED** `AGENTS.md`, sección de Branching/Merging: reemplazar el happy-path actual (squash manual + `--no-ff`) por el flujo squash-and-merge vía GitHub UI, con instrucciones específicas para colaboradores no-dev y para LLMs autónomos. El mensaje del squash commit SHALL seguir cumpliendo "title only, no body, no trailers" como manda la regla de commit messages existente.

## Stakeholders

- **Producto + Tech (Cristian)**: dueño de la decisión; valida la pérdida del merge commit como boundary explícito.
- **Colaborador no-dev del equipo**: principal beneficiario — operar squash-and-merge desde la UI es accesible sin training de git avanzado.
- **LLMs colaborando autónomamente**: secundario beneficiario — no necesitan ejecutar `git rebase -i` ni componer mensajes de merge commit; basta con commitear durante el trabajo y dejar que el squash colapse.

## Out of scope

- Phase commits explore/apply/archive como rule (proposal previa descartada en favor de este enfoque más simple). El flujo OpenSpec sigue dividiendo el trabajo en explore → apply → archive lógicamente, pero ya no se enforce vía estructura de commits.
- Hooks de pre-commit, status checks de CI sobre formato de commits: fuera de scope; el gate sigue siendo `pnpm openspec:check` post-archive.
- Reescritura de historia previa de `main`: la regla aplica de aquí en adelante. Los merge commits anteriores quedan como están.

## Impact

- Affected specs: `project-conventions` (2 MODIFIED Requirements).
- Affected docs: `AGENTS.md` (sección Branching/Merging).
- Affected infra: configuración de branch protection en GitHub (manual, fuera del repo) — documentada en la spec.
- Affected code: ninguno — change documental y de proceso.
