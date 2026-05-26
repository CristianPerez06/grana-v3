## Context

El repo adoptó en `2026-05-17-add-merge-conventions` una política de merge a `main` con `git merge --ff-only` e historia lineal: una branch debe tener exactamente un commit por encima de `main`, y el merge no genera merge commit. La regla vive en tres lugares que deben quedar consistentes entre sí:

1. El requirement "Merge a main…" del spec maestro `project-conventions`.
2. La sección "Merging to `main`" de `CLAUDE.md` (system-prompt de los LLMs que colaboran en el repo).
3. Referencias secundarias en docs (`apps/mobile/EAS_SETUP.md`, skill `grana-create-pr`) y en el requirement de archive que menciona el comando de merge.

El usuario decidió invertir la política a `git merge --no-ff` obligatorio, conservando el squash previo (1 commit de trabajo) y el rebase-onto-main. No hay cambio de código de producto: es una convención de proceso.

## Goals / Non-Goals

**Goals:**

- Que `main` reciba, por cada feature/fix/chore, un commit de trabajo único más un merge commit `--no-ff` que agrupe la unidad de trabajo.
- Mantener el squash a 1 commit de trabajo antes del merge.
- Mantener el rebase de la branch sobre `main` cuando `main` se movió.
- Dejar las tres fuentes de verdad (spec maestro, `CLAUDE.md`, docs secundarias) consistentes y sin referencias residuales a `--ff-only` como política vigente.

**Non-Goals:**

- Reescribir la historia previa de `main` (los merges fast-forward ya hechos quedan como están).
- Automatizar/forzar la política con hooks o branch protection (sigue siendo una convención que humanos y LLMs respetan por lectura de `CLAUDE.md`).
- Tocar changes archivados o el `tasks.md` del change activo `dashboard-desktop-layout-and-cards-relocation` (seguirá la convención vigente al momento de su merge).

## Decisions

**Decisión 1 — `--no-ff` con squash previo, no "conservar todos los commits".**
El squash a 1 commit de trabajo se mantiene; sobre ese commit se aplica el merge commit. Alternativa descartada: conservar los N commits de la branch bajo el merge commit — produciría historia más ruidosa y rompería la propiedad actual "un commit de trabajo por feature" que ya está internalizada en el workflow de archive (el archive es ese único commit). Confirmado con el usuario.

**Decisión 2 — Renombrar el requirement, no solo editar su cuerpo.**
El requirement se llama "Merge a main con un único commit y fast-forward". Mantener ese título mientras el cuerpo manda `--no-ff` sería drift documental. Se usa `## RENAMED Requirements` (FROM/TO) para el título y `## MODIFIED Requirements` para el cuerpo y scenarios. Alternativa descartada: `REMOVED` + `ADDED` — pierde la linealidad conceptual (es el mismo requirement evolucionando, no uno nuevo).

**Decisión 3 — Modificar también el requirement de archive.**
"El archive de una change ocurre en la branch antes del merge a main" menciona `--ff-only` en su descripción y en un scenario. Se incluye completo bajo `MODIFIED` con `--ff-only` → `--no-ff`, para no dejar el spec internamente contradictorio.

**Decisión 4 — Mensaje de merge commit descriptivo.**
Como `--no-ff` siempre crea un commit, se exige que su mensaje identifique la unidad de trabajo (no el `Merge branch '...'` genérico). Esto preserva el valor del merge commit como marcador legible de la feature.

## Risks / Trade-offs

- **[Inconsistencia residual entre fuentes]** → El delta cubre el spec; la checklist de tasks enumera explícitamente `CLAUDE.md`, `EAS_SETUP.md` y el skill `grana-create-pr` para que ninguna referencia `--ff-only` quede como política vigente. `grep -rn "ff-only"` (excluyendo `archive/` y este change) debe quedar limpio de menciones normativas.
- **[RENAMED + MODIFIED del mismo requirement puede fallar en el archive tooling]** → Se valida con `openspec validate require-no-ff-merges --strict` antes de cerrar la propuesta, y `pnpm openspec:check` se corre en el pre-merge. Si el tooling no resuelve bien el par, el fallback es integrar el delta a mano en el archive (la checklist de archive ya contempla aplicar deltas manualmente).
- **[Historia menos lineal]** → Trade-off aceptado y explícito: se gana el marcador por-feature, se pierde la linealidad pura. Es la intención del cambio.
- **[Change activo en paralelo toca el mismo spec]** → El check pre-change indica que `dashboard-desktop-layout-and-cards-relocation` referencia el comando viejo en su `tasks.md` pero NO modifica el requirement `project-conventions`, así que no hay colisión de capability. Se deja fuera de alcance.
