# Diseño — Squash-merge + linear history para main

## Context

Grana V3 es un proyecto de dos: un dev (Cristian) y un colaborador no-dev. Además, una porción significativa de los commits los hace un LLM autónomo. La regla de merge actual (`--no-ff` + exactamente 1 commit de trabajo squasheado a mano) fue escrita pensando en flujos donde quien mergea domina `git rebase -i`, sabe componer mensajes de merge commit que identifiquen la unidad de trabajo, y nunca cae accidentalmente en `--ff-only` o `--squash` como comando de merge.

Para un usuario no-dev esa carga es real: la diferencia entre "merge", "merge no-ff", "merge ff-only", "merge squash", y "squash + merge" es exactamente el tipo de cosa que se aprende rompiendo `main` un par de veces. Y para un LLM, cada decisión adicional sobre la forma del commit es una oportunidad de hacer algo sutilmente inconsistente.

GitHub ofrece un mecanismo más robusto: "Require linear history" + "Squash and merge". Bajo esa configuración, GitHub colapsa la branch en un único commit linealmente apilado sobre `main`, y rechaza cualquier intento de crear un merge commit. La operación se vuelve un botón.

## Goals / Non-Goals

**Goals:**

- Que el merge a `main` sea operable por alguien sin training avanzado de git, vía la UI de GitHub.
- Que los LLMs autónomos no tengan que ejecutar `git rebase -i`, componer mensajes de merge commit ni decidir entre `--no-ff` / `--ff-only` / `--squash`.
- Mantener `main` con historia lineal y un commit por unidad de trabajo, sin merge commits.
- Preservar el resto de invariantes del proyecto: archive en branch antes del merge, `pnpm openspec:check` como gate, conventional commits, sin `body`/`trailers` en el commit message.

**Non-Goals:**

- No recuperar el "feature boundary" explícito que daba el merge commit. La unidad de feature pasa a estar marcada por el squash commit y su mensaje conventional.
- No introducir phase commits ni audit trail de explore/apply/archive en `main`. La granularidad de fase se pierde al squashear; eso es un trade-off aceptado conscientemente.
- No reescribir la historia previa de `main`.
- No automatizar la configuración de branch protection (vive en GitHub fuera del repo). Se documenta como checklist en la spec.

## Decisions

### Decision 1 — Solo "Squash and merge", no "Rebase and merge"

GitHub ofrece tres botones de merge: "Create a merge commit", "Squash and merge", "Rebase and merge". Decidido habilitar **solo "Squash and merge"** y deshabilitar los otros dos.

Razón:

- "Create a merge commit" es incompatible con linear history y queda automáticamente bloqueado.
- "Rebase and merge" preserva todos los commits de la branch en `main` (linearmente). Sería el equivalente del World C descartado: `main` se llena de commits intermedios, fixups, "oops typo" — el opuesto de lo que se quiere.
- "Squash and merge" colapsa todo en un commit, que es lo que se busca.

Tener un solo botón válido también elimina la decisión: el colaborador no-dev (o el LLM) no tiene que elegir cuál usar.

### Decision 2 — La branch puede estar tan sucia como haga falta durante el trabajo

Bajo squash-merge, la calidad de los commits de la branch durante el trabajo **no importa**. Se pueden hacer commits WIP, `fixup: typo`, `wip`, `correcting proposal mid-apply`, lo que sea. Todo se colapsa.

Esto es lo que vuelve el flujo accesible para no-devs y para LLMs:

- Un humano no-dev puede commitear cada vez que termina un paso, sin pensar en estructura. Todo se aplana al final.
- Un LLM autónomo puede commitear durante el trabajo (incluso múltiples veces, incluso descubriendo a mitad de camino que la proposal estaba incompleta y commiteando la corrección) sin tener que mantener una disciplina de "buckets por fase".

La única cosa que sí importa es **que el archive esté hecho antes del merge**, porque el squash commit que termina en `main` debe contener el move + sync de specs maestros para que `pnpm openspec:check` pase. Eso se cubre con la regla preservada de "archive en branch antes del merge".

### Decision 3 — El mensaje del squash commit hereda del título del PR

GitHub permite configurar qué texto se usa por defecto para el título del squash commit. Hay tres opciones: "Default to PR title", "Default to PR title and commit details", "Default to commit messages". Decidido **"Default to PR title"** y **body vacío**.

Razón: la regla de commits del repo dice "title only, no body, no trailers". El título del PR ya está en formato conventional commits (se exige al abrir el PR). Heredar título del PR + body vacío implementa la regla de commits automáticamente. Si quien mergea quiere modificar el título del squash al apretar el botón, lo hace en el modal de "Squash and merge"; el body queda vacío.

### Decision 4 — Mantener "archive en branch antes del merge" intacto en su principio, reescrito en su forma

La regla actual de archive dice "el archivado ocurre como **último commit de trabajo de la branch**, atómico, bundleando código + specs + AGENTS.md". Bajo squash, "el último commit de la branch" deja de ser un concepto operativo porque al merge a `main` toda la branch se colapsa en un único commit.

Lo que sí sigue siendo cierto y operativo: **la branch como un todo, en el momento del squash-merge, debe contener el archive aplicado**. Si la branch no archivó, el squash commit que llega a `main` no tendrá el move ni el sync de specs maestros, y `pnpm openspec:check` post-merge fallará.

La regla se reescribe sin la palabra "atómico" (que era una propiedad del flujo `--no-ff` previo) y sin obligar al archive a ser "el último commit de la branch". Lo único que importa es:

- El archive existe en la branch antes del squash-merge.
- `pnpm openspec:check` corre antes del merge y pasa.

### Decision 5 — Configuración de GitHub fuera del repo, documentada como checklist

La configuración de branch protection vive en GitHub (Settings → Branches → main → branch protection rule), no en el repo. La regla SHALL documentar la configuración exacta requerida como un checklist en la spec, para que:

- Cualquiera (humano o LLM) pueda re-verificarla leyendo la spec.
- Si la configuración se desconfigura accidentalmente, hay una fuente de verdad para restaurarla.

No se intenta automatizar la configuración (vía Terraform, gh CLI script, etc.) en esta change; queda como follow-up potencial.

## Risks / Trade-offs

- **Trade-off: se pierde el merge commit como feature boundary explícito.** Bajo `--no-ff` el merge commit era un marcador estructural ("acá empezó y terminó esta feature") legible vía `git log --first-parent main`. Bajo squash + linear, la separación entre features pasa a estar marcada solo por el mensaje conventional del squash commit. En la práctica eso alcanza para `git log main`, `git blame` y `git bisect`; lo que se pierde es el primer-parent traversal.
- **Trade-off: granularidad de fase explore/apply/archive no sobrevive al merge.** Era el atractivo principal de la proposal previa (phase commit policy). Decidido renunciar a eso porque el costo en accesibilidad para no-devs y LLMs superaba el valor de auditoría.
- **Riesgo: si "Require linear history" se desconfigura en GitHub, alguien podría mergear con merge commit y romper el invariante.** Mitigación: la configuración queda documentada en la spec con todos los toggles exactos, y debería verificarse al menos una vez por trimestre o cuando el setup de GitHub cambie.
- **Riesgo: `git bisect` post-merge solo identifica el squash commit como culpable.** Para un proyecto con la cadencia de Grana V3 esto es manejable (el PR description del squash commit linkea al PR de GitHub, donde se ve el detalle de los commits originales si hace falta). Solo sería un problema real si el equipo escalara y necesitara bisect con granularidad sub-feature.
