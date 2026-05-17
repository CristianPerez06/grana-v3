## Context

`grana-v3` ya tiene la capability `project-conventions` con 6 requirements live (idioma de doc/código/commits, branch naming, README pnpm, CLAUDE.md branch rules). Lo que falta es decir cómo se integra una branch a `main`. Hoy en la práctica los merges se hicieron con `--no-ff` (los merge commits `Merge branch 'chore/...'` están en el log), pero el usuario quiere cambiar el patrón para que `main` tenga historia lineal: 1 commit por feature, sin merge commits intermedios.

Esto es importante porque:
- Una historia lineal hace los `git log` y `git blame` mucho más limpios.
- Los rebases futuros (cuando una branch necesita actualizarse contra `main`) son triviales: cada feature es un commit, sin marañas de merges para reaplicar.
- Cada commit en `main` corresponde 1:1 a una feature/fix/chore, lo que facilita ubicar cuándo entró cada cambio.

El trade-off es trabajo extra del colaborador: tiene que squashear local antes de mergear. Aceptado.

## Goals / Non-Goals

**Goals:**
- Spec con una regla clara sobre el flujo de merge (squash local + --ff-only).
- CLAUDE.md actualizado con la regla + un ejemplo del flow para que LLMs y humanos la sigan sin pensar.
- Cero cambios funcionales al código.

**Non-Goals:**
- Enforcement server-side (GitHub branch protection rules con "require linear history"). Vendrá en un change futuro si la disciplina manual falla.
- Hooks locales pre-merge que rechacen `--no-ff`. Mismo razonamiento.
- Reescribir la historia previa de `main` para limpiar los merge commits viejos. Esos quedan como están.
- Cambiar la convención de squash de GitHub UI. No usamos squash-merge de GitHub — todo el squash se hace local antes de pushear el merge final.

## Decisions

### 1. ADDED Requirement, no MODIFIED

**Decisión**: la regla nueva va como un ADDED Requirement bajo `project-conventions`, no como una modificación de un requirement existente.

**Por qué**: ninguno de los 6 requirements actuales cubre el flujo de merge. La regla de "branch naming sin IDs random" habla del NOMBRE, no de cómo se integra la branch. ADDED es el delta correcto.

**Alternativa descartada**: extender el requirement de branch naming. Mezclaría dos concerns (cómo se llama la branch vs cómo se mergea) en un solo requirement difícil de leer.

### 2. Sin enforcement automatizado en este change

**Decisión**: la regla queda como convención manual + nota en CLAUDE.md. Sin GitHub branch protection rules, sin hooks pre-merge.

**Por qué**:
- La disciplina manual puede ser suficiente con 2 colaboradores + 1 LLM bien briefeado (mismo razonamiento que para las otras reglas de `project-conventions`).
- Configurar GitHub branch protection con "require linear history" + "require pull request" requiere settings del repo en GitHub (no en código), lo que abre un side-track. Mejor dejarlo para un change dedicado.
- Hooks pre-merge requieren convención de instalación (husky o similar) y agregan fricción al setup local.

**Trigger para revisitar**: si vemos ≥1 merge a `main` que viola la regla, abrimos `enforce-merge-conventions-on-github`.

### 3. CLAUDE.md con un ejemplo concreto

**Decisión**: además de listar la regla en CLAUDE.md, incluir un ejemplo concreto del flow (squash → rebase si hace falta → merge --ff-only).

**Por qué**: los LLMs siguen mucho mejor las reglas con un ejemplo del happy path. Sin ejemplo, "squash local" puede interpretarse de varias formas (rebase interactivo, reset --soft, squash-merge en GitHub UI). El ejemplo desambigua.

### 4. La historia previa de `main` no se reescribe

**Decisión**: los merge commits viejos en `main` (los `Merge branch 'chore/...'`) quedan como están. La regla aplica de acá en adelante.

**Por qué**: reescribir historia compartida (`git rebase` o `git filter-branch` sobre `main`) es destructivo, requiere force-push a origin, y rompe cualquier checkout que otra persona haya hecho de esos commits viejos. El costo supera al beneficio (la historia limpia desde HOY ya es ganancia suficiente).

## Risks / Trade-offs

- **[Riesgo] Un colaborador ignora la regla por costumbre y mergea con --no-ff**. Mitigación: CLAUDE.md lo nota (los LLMs lo respetan), revisión humana en PR. Si pasa, basta con `git reset --hard <commit-anterior>` + redo del merge correcto antes de pushear; si ya se pusheó el merge incorrecto, se acepta el merge commit como excepción y se sigue (no force-push a main).
- **[Trade-off] Carga cognitiva extra para colaboradores nuevos**: aprender `git rebase -i`, fixups, y entender `--ff-only` no es trivial. Mitigado por el ejemplo en CLAUDE.md.
- **[Trade-off] Sin auto-enforcement**: depende de disciplina. Mismo razonamiento que para las otras reglas de `project-conventions`.
- **[Riesgo menor] Rebase de branches largas puede tener conflictos**: si una branch tarda mucho y `main` avanza, el rebase puede ser doloroso. Mitigación: mergear branches frecuentemente (no dejar branches abiertas días) y rebasear seguido. No es responsabilidad del spec resolverlo.
