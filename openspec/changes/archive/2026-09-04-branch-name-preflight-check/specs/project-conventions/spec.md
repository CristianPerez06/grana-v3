## ADDED Requirements

### Requirement: El nombre de la branch se valida antes del primer commit

Antes del primer `git commit` de una unidad de trabajo, el colaborador SHALL correr `git branch --show-current` y validar el nombre obtenido contra el formato canónico definido en el requirement "Los nombres de branches deben seguir el formato canónico sin sufijos random". Si el nombre no valida, la branch SHALL renombrarse antes de commitear.

Este chequeo SHALL aplicarse también cuando la branch **no fue elegida por el colaborador**. Una branch provista por un harness de agente — Claude Code on the web la deriva del primer prompt y produce nombres como `claude/iol-financial-entities-table-q2wflp` — NO satisface la convención por el solo hecho de venir dada: tiene prefijo fuera de la lista permitida y sufijo random, y viola la regla igual que si la hubiera tipeado el colaborador.

Cuando el agente tiene instrucciones de sesión que lo fijan a una branch asignada y no puede renombrarla por su cuenta, SHALL marcárselo al usuario antes del primer commit y pedir confirmación. Lo que NO SHALL hacer es commitear y pushear en silencio sobre un nombre que viola la convención.

#### Scenario: Branch asignada por el harness con prefijo y sufijo inválidos

- **WHEN** un agente arranca una sesión sobre una branch preexistente llamada `claude/iol-financial-entities-table-q2wflp`
- **THEN** antes del primer commit detecta que el prefijo `claude/` no está en la lista permitida y que `q2wflp` es un sufijo random
- **AND** renombra la branch a una que valide (p. ej. `feature/institutions-catalog-and-search`), o se lo plantea al usuario si sus instrucciones de sesión le prohíben cambiarla
- **AND** no commitea sobre el nombre inválido sin haberlo marcado

#### Scenario: Branch creada por el colaborador con nombre válido

- **WHEN** un colaborador corre `git branch --show-current` antes de su primer commit y obtiene `feature/institutions-catalog-and-search`
- **THEN** el nombre valida: prefijo permitido, cuerpo kebab-case descriptivo en inglés, sin ID random
- **AND** procede a commitear sin más pasos

#### Scenario: El chequeo pre-branch y el pre-commit son el mismo momento

- **WHEN** un colaborador corre `git branch --show-current` antes de commitear
- **THEN** el mismo output responde las dos preguntas: si dice `main`, no se commitea (chequeo pre-commit existente)
- **AND** si dice cualquier otra cosa, ese nombre se valida contra el formato canónico antes de seguir

## MODIFIED Requirements

### Requirement: AGENTS.md documenta la regla de branch naming

El `AGENTS.md` SHALL incluir, en su sección de branching, una cláusula que documente explícitamente la prohibición de sufijos/prefijos con IDs random, hashes o números arbitrarios en los nombres de branches. La cláusula SHALL existir además de la lista actual de prefijos (`feature/*`, `bugfix/*`, `hotfix/*`, `chore/*`).

El `AGENTS.md` SHALL además abrir con un bloque de chequeos obligatorios previos a la primera acción de git, ubicado antes de cualquier otra sección del documento. Ese bloque SHALL nombrar el chequeo del nombre de la branch y enlazar a la sección canónica que lo define, sin reproducir la regla completa — la regla vive en un solo lugar. El `CLAUDE.md`, que es un pointer file y no duplica reglas, SHALL apuntar a ese bloque.

#### Scenario: AGENTS.md tiene la cláusula de no IDs random

- **WHEN** un LLM lee `AGENTS.md` al inicio de una sesión de Claude Code
- **THEN** la sección de branching menciona los prefijos válidos
- **AND** menciona explícitamente que el cuerpo del nombre no debe contener IDs random, hashes ni sufijos numéricos arbitrarios
- **AND** incluye un ejemplo positivo y uno negativo

#### Scenario: El chequeo de branch se lee antes de llegar a la sección Branching

- **WHEN** un LLM abre `AGENTS.md` y lee solo el principio antes de arrancar una tarea concreta
- **THEN** encuentra el bloque de chequeos obligatorios antes de cualquier sección temática
- **AND** el bloque le dice que valide el nombre de la branch antes del primer commit y dónde está la regla completa
