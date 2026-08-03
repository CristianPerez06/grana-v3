# Diseño — enforzar los gates de OpenSpec en CI

## Context

`.github/workflows/ci.yml` ya tiene una forma establecida: cuatro jobs paralelos, cada uno con `actions/checkout@v4` + `pnpm/action-setup@v4` + `actions/setup-node@v4` (node 24, `cache: pnpm`) + `pnpm install --frozen-lockfile`, disparados por `pull_request` a `main` y `push` a `main`, con `concurrency` que cancela corridas en progreso sólo en PRs. El job nuevo no necesita inventar nada: copia esa forma.

La restricción que domina el diseño es que **este change edita la regla que lo gobierna**. El requirement que se modifica es el mismo que define cómo se archiva una change y qué gates la validan — el archive de este change va a ser validado por la regla que este change escribe. Eso obliga a que la regla nueva sea satisfacible por su propio archive, y a que el job funcione antes de que la regla lo exija.

La segunda restricción es de alcance: `openspec validate --specs --strict` corre hoy sobre 29 specs maestros y pasa. Si en algún momento no pasara, el job nuevo convertiría un problema latente en un bloqueo de merge para PRs que no lo causaron.

## Goals / Non-Goals

**Goals:**

- Que la spec no pueda romperse sin que un check del PR se ponga en rojo.
- Que el resultado del gate no dependa de la palabra de quien abrió el PR.
- Que el job sea barato: sin build, sin red más allá de `pnpm install`, sin secrets.
- Que la regla escrita describa el enforcement real, no la intención.

**Non-Goals:**

- Agregar validación de las changes activas (`openspec validate <change> --strict`) al job. Se discute abajo y se descarta por ahora.
- Cambiar la definición de qué es un archive correcto. Sólo cambia quién lo verifica.
- Configurar branch protection en GitHub para exigir el check nuevo. Es config de repo, no de código, y la decide el dueño del repo.
- Arreglar specs maestros que ya estuvieran rotos. Si el job encuentra algo, se corrige en su propia change.

## Decisions

### Decisión 1 — Un job nuevo y separado, no un step dentro de `quality`

`quality` corre lint y typecheck de dos apps y tarda ~1 minuto. Meter los gates de spec ahí los haría esperar por trabajo que no tiene relación, y un fallo de spec se leería como "lint falló".

Un job `specs` propio da un check con nombre propio en el PR ("OpenSpec validation"), corre en paralelo con los otros cuatro, y falla con un mensaje que apunta a la causa real. El costo es un runner adicional por PR, que es marginal comparado con `web-build`.

### Decisión 2 — Los dos gates en el mismo job, `validate` primero

`pnpm openspec:check` es un grep por placeholders `TBD`. `openspec validate --specs --strict` es un parseo completo de los 29 specs maestros. Cubren fallas distintas y ninguno subsume al otro: `openspec:check` no detecta un delta residual, y `validate` no detecta un `Purpose` que quedó con el texto placeholder si ese texto igual supera el mínimo de longitud.

Van en un solo job porque comparten el `pnpm install`, que es la parte cara. `validate` corre primero porque su mensaje de error es más específico: si el spec está malformado conviene saberlo antes de leer un fallo de grep.

Ambos corren siempre — el segundo NO se saltea si el primero falla, para que un PR roto muestre todos sus problemas en una corrida en vez de descubrirlos de a uno.

**Alternativa descartada:** dos jobs separados. Duplicaría el `pnpm install` (la parte lenta) para ganar granularidad que los nombres de step ya dan.

### Decisión 3 — `npx openspec` en vez de agregar la dependencia al workspace

`openspec` no está en `package.json`; el repo lo invoca vía `npx` en todos lados, incluido el script `openspec:check` que sí está en `package.json` pero sólo usa `grep`. El job mantiene esa convención en lugar de agregar una devDependency, que obligaría a tocar el lockfile y a que `monorepo-health` la validara.

**Corregido durante el PR.** La primera versión del job usaba `npx openspec`, que falló en el runner con `could not determine executable to run`. El paquete real es `@fission-ai/openspec`; el nombre `openspec` en npm es un stub v0.0.0 sin binario. Local parecía andar sólo porque el paquete scoped estaba instalado global y `npx` caía al binario del PATH — un falso positivo que sólo se ve en un entorno limpio. El job invoca ahora `npx --yes @fission-ai/openspec@1.7.0`, con versión pineada para que una release nueva no ponga en rojo un PR que no cambió nada. Esto resuelve además lo que la tarea 5.2 dejaba para más adelante.

### Decisión 4 — El job NO valida las changes activas

Se consideró agregar `openspec validate --strict` sobre cada change en `openspec/changes/` (excluyendo `archive/`). Se descarta por ahora: una change en progreso está legítimamente incompleta —tasks sin tildar, deltas a medio escribir— y bloquear el PR por eso castigaría el trabajo en curso, que es exactamente cuando más se commitea.

El gate correcto para una change es el momento del archive, y eso ya lo cubre `validate --specs --strict` sobre el resultado. Si más adelante se quiere validar changes activas, el criterio tendría que distinguir "incompleta" de "malformada", y eso es una decisión propia.

### Decisión 5 — La corrida local se conserva, degradada a feedback

Sacarla del requirement sería tentador: si CI enforza, la corrida local es redundante. Se conserva porque el ciclo de feedback importa — descubrir un `Purpose: TBD` en dos segundos localmente es mucho mejor que descubrirlo tres minutos después en el PR.

Lo que cambia es el estatus. Antes era la garantía; ahora es conveniencia. El requirement lo dice explícitamente ("NO SHALL depender de que alguien se acuerde de correrlos, ni de que reporte fielmente el resultado") porque el modo de falla observado no fue que alguien no lo corriera, sino que **reportó que lo había corrido cuando no era así**.

## Risks / Trade-offs

- **El job puede encontrar specs maestros rotos preexistentes.** Hoy `validate --specs --strict` pasa 29/29, así que el riesgo es bajo en este momento. Si aparece algo, es un hallazgo legítimo y se corrige en su propia change — no se debilita el gate para acomodarlo.
- **`npx` sin versión pinneada** puede introducir fallos por una release de OpenSpec, no por el PR. Ver Decisión 3; el arreglo es pinear una línea.
- **El check nuevo no bloquea el merge por sí solo** hasta que se agregue a las required checks de la branch protection en GitHub. Hasta entonces el PR se pone en rojo pero el botón de merge sigue disponible. Es config de repo y queda como tarea explícita, no implícita.
- **Este change edita la regla que valida su propio archive.** Se mitiga verificando el job en el PR de este mismo change: si el job corre y pasa acá, la regla es satisfacible.
