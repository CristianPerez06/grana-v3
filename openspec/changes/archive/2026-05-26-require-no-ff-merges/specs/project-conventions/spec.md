## RENAMED Requirements

- FROM: `### Requirement: Merge a main con un único commit y fast-forward`
- TO: `### Requirement: Merge a main con un único commit de trabajo y merge commit (--no-ff)`

## MODIFIED Requirements

### Requirement: Merge a main con un único commit de trabajo y merge commit (--no-ff)

Toda branch que se mergea a `main` SHALL contener exactamente un commit de trabajo por encima de `main` al momento del merge. El merge SHALL ejecutarse con `git merge --no-ff` (nunca `--ff-only`, nunca `--squash` en el comando de merge). `--no-ff` genera siempre un merge commit que agrupa la unidad de trabajo, marcando dónde empezó y terminó. Si `main` se movió mientras la branch estaba en progreso, el colaborador SHALL primero rebasear su branch sobre `main` (`git rebase main`) y después mergear con `--no-ff`. El resultado en `main` SHALL ser, por cada feature/fix/chore, un commit de trabajo más su merge commit. El mensaje del merge commit SHALL identificar la unidad de trabajo; un `Merge branch '...'` autogenerado que no la identifique NO es aceptable.

Esta regla aplica tanto a humanos como a LLMs colaborando autónomamente. La historia previa de `main` (incluidos los merges fast-forward anteriores a la adopción de esta regla) NO se reescribe — la regla aplica de acá en adelante.

#### Scenario: Branch con un solo commit + main no se movió

- **WHEN** un colaborador termina una branch que tiene 1 commit por encima de `main` y `main` no se movió desde que la branch arrancó
- **THEN** ejecuta `git checkout main && git merge --no-ff <branch>`
- **AND** el merge genera un merge commit con mensaje que identifica la unidad de trabajo
- **AND** `main` ahora contiene el commit de la feature más el merge commit

#### Scenario: Branch con múltiples commits se squashea antes del merge

- **WHEN** un colaborador termina una branch que tiene N commits por encima de `main` (con N > 1)
- **THEN** antes de mergear, squashea los N commits en uno solo localmente (vía `git rebase -i` con fixups, o `git reset --soft main && git commit`)
- **AND** después ejecuta `git merge --no-ff <branch>` desde `main`
- **AND** `main` recibe el único commit de trabajo más un merge commit

#### Scenario: main se movió mientras la branch estaba en progreso

- **WHEN** un colaborador termina su branch y descubre que `main` avanzó mientras tanto
- **THEN** primero rebasea su branch sobre `main` (`git checkout <branch> && git rebase main`), resolviendo conflictos si los hay
- **AND** después squashea a 1 commit de trabajo (si hay más de 1)
- **AND** después ejecuta `git merge --no-ff <branch>` desde `main`

#### Scenario: Intento de merge con --ff-only o --squash es violación

- **WHEN** un colaborador intenta mergear con `git merge --ff-only <branch>` o `git merge --squash <branch>`
- **THEN** la regla está violada
- **AND** el reviewer (humano o el propio LLM al releer su comando) debe abortar y rehacer con `--no-ff`

#### Scenario: LLM colaborando autónomamente respeta la regla

- **WHEN** un LLM autónomo necesita mergear una branch que generó
- **THEN** lee `CLAUDE.md` al inicio de la sesión y sigue el flow: squash si N > 1 → rebase si main se movió → `git merge --no-ff` con mensaje descriptivo
- **AND** nunca usa `--ff-only` ni `--squash` como comando de merge

### Requirement: El archive de una change ocurre en la branch antes del merge a main

Cuando una change implementada se considera completa, su archivado SHALL ocurrir como último commit de la branch de trabajo, **antes** del merge `--no-ff` a `main`. El archivado NO se difiere a un commit posterior ni a un PR separado.

Archivado significa: mover la carpeta de `openspec/changes/<name>/` a `openspec/changes/archive/YYYY-MM-DD-<name>/`, aplicar los deltas (`## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`) al spec maestro de cada capability tocada en `openspec/specs/<capability>/spec.md`, completar el `Purpose` real del spec maestro reemplazando cualquier placeholder `TBD - created by archiving change ...`, y actualizar `CLAUDE.md` (secciones "Modules" y "Repo Layout") cuando corresponda.

Esta regla sostiene tres invariantes del proyecto:

- El último commit de trabajo de la branch SHALL ser atómico: en una sola commit aparecen el código, los specs maestros actualizados, los `Purpose` completados y los cambios consecuentes en `CLAUDE.md`. Ese commit es el que luego entra a `main` bajo su merge commit `--no-ff`.
- El estado de `main` SHALL cumplir que cada implementación tiene su spec maestro alineado.
- Cualquier feedback de PR que requiera ajustar el spec MUST aplicarse en la misma branch sin abrir un segundo PR de "archive housekeeping".

El gate de validación SHALL ser el comando `pnpm openspec:check`, que falla si encuentra `TBD - created by archiving` o `Purpose: TBD` dentro de `openspec/specs/`. Este comando MUST correrse antes de cualquier merge a `main` y MUST pasar.

#### Scenario: Branch lista para merge tiene la change archivada

- **WHEN** un colaborador termina la implementación de una change y se prepara para mergear su branch a `main`
- **THEN** la branch tiene como último commit de trabajo el archivado de la change (mover carpeta + aplicar deltas al spec maestro + completar `Purpose` + actualizar `CLAUDE.md` Modules y Repo Layout si corresponde)
- **AND** el merge a `main` se hace `--no-ff`, generando el merge commit sobre ese único commit de trabajo

#### Scenario: Merge a main rechazado si quedan TBD residuales

- **WHEN** el colaborador corre `pnpm openspec:check` sobre una branch que dejó `Purpose: TBD - created by archiving change ...` en algún spec maestro
- **THEN** el comando falla con exit code distinto de 0
- **AND** el merge se posterga hasta completar los `Purpose` reales

#### Scenario: Una change archivada no deja deltas residuales en el spec maestro

- **WHEN** un colaborador archiva una change
- **THEN** el spec maestro de cada capability tocada NO contiene secciones `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements` ni `## RENAMED Requirements`
- **AND** los requirements modificados aparecen integrados en la sección plana `## Requirements`

#### Scenario: Antes de iniciar una change nueva se verifica el solapamiento

- **WHEN** un colaborador va a crear una nueva change que toca una capability `X`
- **THEN** verifica que no exista otra change activa en `openspec/changes/` (excluyendo `archive/`) que también toque la capability `X`
- **AND** si existe, decide el orden de merge y las dependencias antes de empezar la nueva
