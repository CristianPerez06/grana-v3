## Why

La regla de branch naming ya existe y es explícita: `AGENTS.md` § Branching lista los prefijos válidos y prohíbe los sufijos random "even when an LLM creates the branch autonomously", y el spec `project-conventions` la tiene como requirement con scenarios. Aun así se violó.

El agujero no es la regla, es **cuándo se la lee**. La sección Branching vive en la línea 123 de un `AGENTS.md` de ~300 líneas, y un agente que arranca una tarea concreta ("agregá IOL a la tabla de entidades") llega a `git commit` sin haber pasado por ahí. El chequeo pre-commit que sí existe y sí se respeta (`git branch --show-current`, "si dice `main`, STOP") funciona justamente porque está enunciado como un paso obligatorio antes de una acción, no como prosa descriptiva en el medio del documento.

Hay además un caso que la regla no contempla y que es hoy el más frecuente: **la branch no siempre la elige quien trabaja**. Claude Code on the web provisiona la branch de la sesión derivándola del primer prompt, con prefijo `claude/` y sufijo random — `claude/iol-financial-entities-table-q2wflp`. Viola los dos puntos de la convención (prefijo fuera de la lista, sufijo random) y llega ya creada, así que "no la crees así" no aplica: hay que detectarla y renombrarla. El caso real que motiva esta change terminó con un commit y dos pushes a esa branch antes de que el owner lo marcara.

## What Changes

- **`AGENTS.md` abre con un bloque "Pre-flight — MANDATORY"**, antes de cualquier otra sección, con los chequeos que hay que hacer *antes* de la primera acción de git y un link a la sección canónica de cada uno. No duplica las reglas: las nombra y apunta. Las reglas siguen viviendo donde ya viven.
- **El chequeo de nombre de branch se enuncia como paso accionable**, en el mismo registro que el chequeo pre-commit existente: correr `git branch --show-current` **antes del primer commit**, comparar contra el formato canónico, y si no valida, renombrar antes de commitear.
- **Se cubre explícitamente la branch provista por un harness.** Una branch que ya venía creada (`claude/*`, `codex/*`, cualquier prefijo fuera de la lista, cualquier sufijo random) NO satisface la convención por el hecho de no haberla elegido el colaborador. Se renombra antes del primer commit, o se pide confirmación si el agente tiene instrucciones de sesión que lo fijan a esa branch — pero se marca, nunca se commitea en silencio.
- **`CLAUDE.md` gana un puntero al bloque pre-flight.** Sigue siendo un pointer file: no copia reglas, solo dice qué leer primero.

### Alternativas descartadas

- **Un hook `PreToolUse` en `.claude/settings.json` que intercepte `git checkout -b`.** Es enforcement real, pero solo cubre Claude Code (no otros agentes ni humanos), solo cubre la *creación* — que es justo lo que no pasa cuando el harness provisiona la branch — y el repo hoy no usa hooks: `.claude/settings.json` tiene únicamente `permissions`. Queda como opción futura si el bloque pre-flight no alcanza.
- **Validar el nombre de branch en CI.** El repo dice que "CI es el punto de enforcement", así que es tentador. Pero el costo llega tarde: el trabajo ya está commiteado y pusheado, y renombrar entonces cuesta más que renombrar antes del primer commit. Además `main` recibe squash, así que el nombre de la branch no sobrevive al merge — el daño real es de legibilidad mientras el PR está abierto, no de historia.
- **Mover la sección Branching al principio de `AGENTS.md`.** Resuelve este caso y rompe el orden temático del documento; el próximo chequeo olvidado pediría lo mismo. Un bloque pre-flight corto que apunta a las secciones escala mejor.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `project-conventions`: se agrega un requirement de chequeo pre-branch (validación del nombre antes del primer commit, incluida la branch provista por un harness) y se extiende el requirement existente sobre qué documenta `AGENTS.md`.

## Impact

- `AGENTS.md` — bloque nuevo al inicio.
- `CLAUDE.md` — una línea de puntero.
- `openspec/specs/project-conventions/spec.md` — un requirement nuevo, uno modificado.

Sin impacto en código de producto, migraciones ni tests.
