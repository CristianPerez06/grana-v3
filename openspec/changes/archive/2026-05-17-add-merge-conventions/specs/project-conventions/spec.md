## ADDED Requirements

### Requirement: Merge a main con un único commit y fast-forward

Toda branch que se mergea a `main` SHALL contener exactamente un commit por encima de `main` al momento del merge. El merge SHALL ejecutarse con `git merge --ff-only` (nunca `--no-ff` ni `--squash` en el comando de merge). Si `main` se movió mientras la branch estaba en progreso, el colaborador SHALL primero rebasear su branch sobre `main` (`git rebase main`) y después mergear con `--ff-only`. El resultado en `main` SHALL ser una historia lineal sin merge commits — un commit por feature/fix/chore.

Esta regla aplica tanto a humanos como a LLMs colaborando autónomamente. La historia previa de `main` (los merge commits anteriores a la adopción de esta regla) NO se reescribe — la regla aplica de acá en adelante.

#### Scenario: Branch con un solo commit + main no se movió

- **WHEN** un colaborador termina una branch que tiene 1 commit por encima de `main` y `main` no se movió desde que la branch arrancó
- **THEN** ejecuta `git checkout main && git merge --ff-only <branch>`
- **AND** el merge se aplica como fast-forward sin generar merge commit
- **AND** `main` ahora apunta al commit de la feature

#### Scenario: Branch con múltiples commits se squashea antes del merge

- **WHEN** un colaborador termina una branch que tiene N commits por encima de `main` (con N > 1)
- **THEN** antes de mergear, squashea los N commits en uno solo localmente (vía `git rebase -i` con fixups, o `git reset --soft main && git commit`)
- **AND** después ejecuta `git merge --ff-only <branch>` desde `main`
- **AND** `main` recibe un único commit nuevo, sin merge commit

#### Scenario: main se movió mientras la branch estaba en progreso

- **WHEN** un colaborador termina su branch y descubre que `main` avanzó mientras tanto (la branch ya no está fast-forwardable directamente)
- **THEN** primero rebasea su branch sobre `main` (`git checkout <branch> && git rebase main`), resolviendo conflictos si los hay
- **AND** después squashea a 1 commit (si hay más de 1)
- **AND** después ejecuta `git merge --ff-only <branch>` desde `main`

#### Scenario: Intento de merge sin --ff-only es violación

- **WHEN** un colaborador intenta mergear con `git merge <branch>` (sin `--ff-only`) o `git merge --no-ff <branch>`
- **THEN** la regla está violada
- **AND** el reviewer (humano o el propio LLM al releer su comando) debe abortar y rehacer con `--ff-only`

#### Scenario: LLM colaborando autónomamente respeta la regla

- **WHEN** un LLM autónomo necesita mergear una branch que generó
- **THEN** lee `CLAUDE.md` al inicio de la sesión y sigue el flow: squash si N > 1 → rebase si main se movió → `git merge --ff-only`
- **AND** nunca usa `--no-ff` ni acepta merge commits automáticos
