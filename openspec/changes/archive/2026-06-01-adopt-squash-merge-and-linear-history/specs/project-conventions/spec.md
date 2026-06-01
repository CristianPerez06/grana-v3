## MODIFIED Requirements

### Requirement: Merge a main produce un único commit squasheado sobre historia lineal

El estado de `main`, de aquí en adelante, SHALL cumplir dos invariantes:

- **Historia lineal**: NO SHALL existir merge commits en `main`. Cada feature/fix/chore aparece como un único commit linealmente apilado sobre el commit anterior.
- **Un commit por unidad de trabajo**: la branch de trabajo, sin importar cuántos commits internos haya acumulado durante el desarrollo (WIP, fixups, correcciones in-flight, etc.), SHALL colapsarse a un único commit al aterrizar en `main`.

El **método** para producir ese resultado queda a discreción de quien mergea. Métodos aceptables incluyen, entre otros:

- Apretar "Squash and merge" en la UI de GitHub. Recomendado para colaboradores que prefieran no operar git localmente.
- Squashear localmente y pushear el commit resultante (p. ej. `git merge --squash <branch>` desde `main`, o `git reset --soft main && git commit` en la branch + push).
- Cualquier otra secuencia que produzca el mismo outcome y pase la branch protection de GitHub.

Métodos **NO aceptables** (rechazados por la branch protection):

- Merge commits — `git merge --no-ff`, "Create a merge commit" en GitHub.
- "Rebase and merge" / `git rebase main` + push directo de N commits — preserva los commits intermedios en `main` y rompe la regla de "un commit por unidad de trabajo".

La configuración de branch protection requerida en GitHub para la branch `main` SHALL ser:

- **Require linear history** → ON.
- **Allow merge commits** → OFF.
- **Allow squash merging** → ON.
  - Default to PR title for squash commits → ON.
  - Default to blank body for squash commits → ON (alineado con la regla "title only, no body, no trailers").
- **Allow rebase merging** → OFF.

Esa configuración enforce los invariantes de forma mecánica: cualquier intento de pushear merge commits o N commits separados a `main` falla. El "método" queda libre dentro de lo que la protección acepta.

El mensaje del commit que llega a `main` SHALL cumplir la regla general de commits del repo: inglés, formato conventional commits (`type(scope): subject`), title only, sin body, sin trailers.

Esta regla aplica a humanos. Los LLMs colaborando autónomamente NO SHALL mergear a `main` — la regla existente "el merge a `main` lo hace el usuario" se preserva. Los LLMs SHALL dejar la branch en el estado correcto (commits del trabajo acumulados, archive aplicado, `pnpm openspec:check` pasando) y parar; quien mergea elige el método.

La historia previa de `main` (incluidos los merge commits y fast-forwards anteriores a la adopción de esta regla) NO se reescribe — la regla aplica de aquí en adelante.

#### Scenario: Branch con N commits aterriza como un único commit en main

- **WHEN** un colaborador termina una branch con varios commits (WIP, fixups, archive) y la mergea a `main` por el método que prefiera (botón de GitHub o squash local + push)
- **THEN** `main` recibe un único commit linealmente apilado sobre el anterior
- **AND** ese commit lleva como mensaje un título conventional commits (`type(scope): subject`) sin body ni trailers

#### Scenario: Configuración de GitHub con "Create a merge commit" habilitado es violación

- **WHEN** se inspecciona la configuración de branch protection de `main` en GitHub y se ve que "Allow merge commits" está ON o "Require linear history" está OFF
- **THEN** la configuración viola la regla y debe corregirse antes del próximo merge
- **AND** si bajo esa configuración rota se mergeó un PR y se creó un merge commit en `main`, el merge commit queda como deuda histórica (no se reescribe), pero la configuración SHALL corregirse antes del siguiente merge

#### Scenario: Configuración de GitHub con "Rebase and merge" habilitado es violación

- **WHEN** se inspecciona la configuración de branch protection de `main` y "Allow rebase merging" está ON
- **THEN** la configuración viola la regla — "Rebase and merge" preservaría todos los commits intermedios de la branch en `main`, lo opuesto a lo que se busca
- **AND** la configuración SHALL corregirse para que los métodos válidos queden restringidos a squash

#### Scenario: LLM autónomo no mergea a main

- **WHEN** un LLM autónomo termina una branch y considera que está lista para merge
- **THEN** NO SHALL ejecutar `git merge`, `git rebase main && git push`, ni cualquier otra forma de aterrizar la branch en `main` directamente
- **AND** SHALL parar después de aplicar el archive y verificar que `pnpm openspec:check` pasa
- **AND** SHALL indicarle al usuario que la branch está lista, dejando al usuario elegir el método de merge

#### Scenario: El mensaje del commit que llega a main cumple la regla de commits

- **WHEN** un colaborador mergea un PR titulado `feat(transactions): add egresos/ingresos selector to spending overview` por cualquier método aceptable
- **THEN** el commit que llega a `main` tiene como mensaje exactamente ese título (o equivalente conventional commits acordado por el colaborador)
- **AND** NO incluye body, ni trailers, ni `Co-Authored-By`, ni footer de tooling

### Requirement: El archive de una change ocurre en la branch antes del merge a main

Cuando una change implementada se considera completa, su archivado SHALL aplicarse a la branch de trabajo **antes** del merge a `main`, por cualquier método de merge aceptable. El archivado NO se difiere a un PR posterior ni a un commit post-merge sobre `main`.

Archivado significa:

- Mover la carpeta de `openspec/changes/<name>/` a `openspec/changes/archive/YYYY-MM-DD-<name>/`.
- Aplicar los deltas (`## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`) al spec maestro de cada capability tocada en `openspec/specs/<capability>/spec.md`.
- Completar el `Purpose` real del spec maestro reemplazando cualquier placeholder `TBD - created by archiving change ...`.
- Actualizar `AGENTS.md` (secciones "Modules" y "Repo Layout") cuando corresponda.

Como el merge a `main` produce un único commit squasheado (ver "Merge a main produce un único commit squasheado sobre historia lineal"), "la branch como un todo" SHALL contener estas modificaciones al momento del merge. NO importa en qué commit individual de la branch viven; el squash los colapsa. Lo que importa es que el commit que llega a `main` incluya el move + el sync de specs maestros + el `Purpose` completado + las edits a `AGENTS.md`.

Esta regla sostiene dos invariantes del proyecto:

- El estado de `main` post-merge SHALL cumplir que cada implementación tiene su spec maestro alineado.
- Cualquier feedback de PR que requiera ajustar el spec MUST aplicarse en la misma branch (commit adicional, lo colapsa el squash). NO se abre un segundo PR de "archive housekeeping".

El gate de validación SHALL ser el comando `pnpm openspec:check`, que falla si encuentra `TBD - created by archiving` o `Purpose: TBD` dentro de `openspec/specs/`. Este comando MUST correrse sobre la branch (con el archive ya aplicado) antes del merge, y MUST pasar.

#### Scenario: Branch lista para merge tiene la change archivada

- **WHEN** un colaborador termina la implementación de una change y se prepara para mergear
- **THEN** la branch contiene la carpeta movida a `openspec/changes/archive/YYYY-MM-DD-<name>/`, los deltas aplicados al spec maestro, `Purpose` completado y `AGENTS.md` actualizado si corresponde
- **AND** `pnpm openspec:check` corre localmente sobre la branch y pasa con exit code 0
- **AND** el merge a `main` (por el método elegido) produce un commit squasheado que contiene todo eso

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

#### Scenario: Feedback de PR sobre el archive se aplica en la misma branch

- **WHEN** durante el review de un PR el reviewer pide ajustar un delta de spec o un `Purpose`
- **THEN** el colaborador aplica la corrección como un commit adicional en la misma branch (el squash lo colapsará)
- **AND** NO abre un segundo PR de "archive fixup" ni difiere la corrección a un commit post-merge sobre `main`
