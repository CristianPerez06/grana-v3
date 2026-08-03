## MODIFIED Requirements

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

Los gates de validación SHALL ser dos comandos complementarios, que cubren fallas distintas:

- `pnpm openspec:check`, que falla si encuentra `TBD - created by archiving` o `Purpose: TBD` dentro de `openspec/specs/`.
- `npx openspec validate --specs --strict`, que falla si algún spec maestro quedó malformado: secciones delta residuales, requirements sin `SHALL`/`MUST`, requirements sin scenarios, o un `Purpose` demasiado breve.

Ambos gates SHALL ejecutarse en CI sobre cada pull request dirigido a `main` y sobre cada push a `main`, y ambos MUST pasar. **CI es el punto de enforcement**: una branch NO SHALL poder mergear con la spec rota, aunque nadie haya corrido nada localmente.

La corrida local de ambos comandos SHALL seguir siendo parte del flujo de trabajo, pero con rol de **loop de feedback rápido**, no de garantía: el colaborador los corre para no descubrir el problema recién en el PR. El proyecto NO SHALL depender de que alguien se acuerde de correrlos, ni de que reporte fielmente el resultado.

#### Scenario: Branch lista para merge tiene la change archivada

- **WHEN** un colaborador termina la implementación de una change y se prepara para mergear
- **THEN** la branch contiene la carpeta movida a `openspec/changes/archive/YYYY-MM-DD-<name>/`, los deltas aplicados al spec maestro, `Purpose` completado y `AGENTS.md` actualizado si corresponde
- **AND** el job de specs de CI corre ambos gates sobre el PR y los dos pasan con exit code 0
- **AND** el merge a `main` (por el método elegido) produce un commit squasheado que contiene todo eso

#### Scenario: CI rechaza un PR cuyo archive quedó incompleto

- **WHEN** un PR a `main` contiene un archive que dejó `Purpose: TBD - created by archiving change ...` en un spec maestro, o secciones `## ADDED/MODIFIED/REMOVED/RENAMED Requirements` residuales
- **THEN** el job de specs de CI falla con exit code distinto de 0 y el check del PR queda en rojo
- **AND** el merge queda bloqueado hasta que se corrija en la misma branch
- **AND** el resultado NO depende de que el colaborador haya corrido los comandos localmente ni de lo que haya reportado

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
