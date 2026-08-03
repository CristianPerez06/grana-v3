# project-conventions Specification

## Purpose

Spec meta del proyecto: agrupa las convenciones de **trabajo sobre el repo** Grana V3 — cómo se escribe, se nombra, se commitea, se especifica y se mergea — y nada más. Incluye el principio "el repo es la memoria del producto" (la app debe poder continuarse sin contexto de chat), el bilingüismo (documentación en español, código en inglés, incluidos commits y nombres de branch), el formato canónico de nombres de branches, el prerequisito de pnpm en el README, la convención de autoría de specs cross-platform (una capability por comportamiento de negocio con scenarios tagueados por plataforma), y el workflow obligatorio de OpenSpec: archive en la branch antes del merge, checklist post-archivado, `pnpm openspec:check` como gate y merge a `main` vía squash-and-merge sobre historia lineal.

Un colaborador nuevo la lee entera y sabe cómo trabajar en este repo, sin necesitar contabilidad ni design system. El carveado del repo vive en `repo-architecture`; el design system, en `ui-foundations`; las reglas de dominio, en la capability que gobierna cada una.
## Requirements
### Requirement: La V3 debe sostenerse desde el repo, no desde contexto de chat

Grana V3 SHALL tratar al repositorio como la memoria principal del producto. La V3 no es una reescritura por si misma: es una reconstruccion cuyo objetivo es que la app sea funcionalmente explicita, tecnicamente confiable y documentada al nivel de que una conversacion nueva con un LLM pueda continuar el trabajo sin depender de contexto oculto.

Toda decision funcional o tecnica que afecte el comportamiento contable, financiero, de UX critica, de datos o de arquitectura SHALL quedar registrada en el lugar correspondiente del repo: specs, migraciones, `AGENTS.md`, README, codigo y/o tests. Las decisiones importantes SHALL NOT quedar solamente en una conversacion, en memoria humana o implicitas dentro de una implementacion dificil de descubrir.

#### Scenario: Una regla contable nueva queda escrita antes o junto con el codigo

- **WHEN** un colaborador define una regla que afecta saldos, fechas, tarjetas, cuotas, monedas, categorias o reportes
- **THEN** la regla queda documentada en una spec o documento rector del repo
- **AND** la implementacion referencia o sigue esa regla de forma trazable

#### Scenario: Una conversacion nueva puede retomar el proyecto

- **WHEN** un LLM nuevo lee el repo sin acceso al historial de chat anterior
- **THEN** encuentra en `AGENTS.md`, `openspec/specs/` y las migraciones las reglas necesarias para no inventar comportamiento
- **AND** puede distinguir que decisiones son funcionales, cuales son tecnicas y cuales estan pendientes

#### Scenario: Una decision importante no queda solo en el chat

- **WHEN** durante una sesion se acuerda una decision de producto o arquitectura que cambia como debe funcionar Grana
- **THEN** el colaborador la registra en el repo antes de cerrar el bloque de trabajo
- **AND** si todavia no se implementa, queda claro si es regla vigente, deuda documentada o decision futura

### Requirement: La documentación del proyecto debe estar en español

Toda la documentación del proyecto SHALL estar escrita en español. Esto incluye `README.md`, `SUPABASE_SETUP.md` y todos los archivos bajo `openspec/changes/**/*.md` y `openspec/specs/**/*.md` (proposals, design, tasks, specs).

La regla tiene dos excepciones explícitas:

- **Keywords del parser de OpenSpec**: los markers estructurales SHALL permanecer en inglés porque son tokens parseados por la CLI de OpenSpec (validados en `openspec archive`). Incluye:
  - Headers de proposal: `## Why`, `## What Changes`, `## Capabilities`, `### New Capabilities`, `### Modified Capabilities`, `## Impact`.
  - Headers de design: `## Context`, `## Goals / Non-Goals`, `**Goals:**`, `**Non-Goals:**`, `## Decisions`, `## Risks / Trade-offs`.
  - Headers de delta de specs: `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`.
  - Prefijos de specs: `### Requirement:`, `#### Scenario:`.
  - Conectores de scenarios: `**WHEN**`, `**THEN**`, `**AND**`.
  - Operadores de delta: `FROM:`, `TO:`, `**Reason**:`, `**Migration**:`.
  - **Modales normativos** dentro del cuerpo de cada requirement: `SHALL`, `SHALL NOT`, `MUST`, `MUST NOT`, `SHOULD`, `MAY`. (El parser rechaza el archive si un requirement no contiene al menos un `SHALL` o `MUST`.)
- **`AGENTS.md`**: este archivo SHALL permanecer en inglés porque es una extensión del system prompt para LLMs (convención cross-tool: lo leen Claude Code, OpenAI Codex, Cursor, Aider y otros agentes). `CLAUDE.md` SHALL permanecer como un stub que apunta a `AGENTS.md` para mantener compatibilidad con tooling que carga `CLAUDE.md` automáticamente.

#### Scenario: Un nuevo proposal se escribe en español

- **WHEN** un colaborador crea un nuevo `openspec/changes/<name>/proposal.md`
- **THEN** la prosa del proposal está en español
- **AND** los headers parseados por OpenSpec (si los hay) permanecen en sus formas en inglés

#### Scenario: Una spec usa keywords en inglés pero prosa en español

- **WHEN** un colaborador crea o modifica un `openspec/changes/<name>/specs/<capability>/spec.md`
- **THEN** los markers `## ADDED Requirements`, `### Requirement:`, `#### Scenario:`, `**WHEN**`, `**THEN**`, `**AND**` están en inglés
- **AND** los nombres después de `Requirement:` y `Scenario:` están en español
- **AND** las descripciones de requirements y los pasos de scenarios están en español

#### Scenario: AGENTS.md no se traduce al español

- **WHEN** un colaborador modifica `AGENTS.md`
- **THEN** el archivo permanece en inglés
- **AND** la spec acepta esta excepción explícitamente

### Requirement: El código debe estar en inglés

Todos los identifiers del código SHALL estar en inglés. Esto cubre nombres de variables, funciones, tipos, interfaces, componentes, props, parámetros, hooks personalizados, imports y módulos. También cubre nombres de archivos y directorios bajo cualquier `apps/<name>/` o `packages/<name>/`, y cualquier código fuente nuevo. Los comentarios en el código y la documentación JSDoc/TSDoc SHALL estar en inglés. Los nombres de stories de Storybook (exports nombrados como `Default`, `WithError`, etc.) SHALL estar en inglés porque son TypeScript identifiers.

La regla cubre explícitamente los **segmentos de ruta** (archivos y directorios) bajo `apps/<name>/app/` y equivalentes (route groups, dynamic segments y archivos `page.tsx`/`layout.tsx`/`index.tsx` del file-system router). El hecho de que en Next App Router y Expo Router un archivo de ruta tenga su nombre proyectado como segmento de URL NO lo convierte en copy visible al usuario — sigue siendo código (un identifier en el filesystem) y SHALL estar en inglés. El copy que el usuario lee se sirve siempre desde `@grana/i18n-messages`, nunca desde el path.

La regla tiene una excepción explícita: los **valores** de las strings en los archivos de catálogos i18n (`packages/i18n-messages/src/*.json`) pueden estar en cualquier idioma — son copy visible al usuario final, no código. Las **claves** del JSON sí son identifiers y deben estar en inglés.

#### Scenario: Una función nueva se nombra en inglés

- **WHEN** un colaborador agrega una función al código fuente
- **THEN** el nombre de la función está en inglés (p. ej. `calculateTotal`, no `calcularTotal`)
- **AND** sus parámetros y variables internas también están en inglés

#### Scenario: Un archivo nuevo se nombra en inglés

- **WHEN** un colaborador crea un archivo nuevo bajo `apps/<name>/` o `packages/<name>/`
- **THEN** el nombre del archivo está en kebab-case en inglés (p. ej. `password-field.tsx`, no `campo-de-contrasena.tsx`)

#### Scenario: Comentarios de código en inglés

- **WHEN** un colaborador agrega un comentario o un bloque JSDoc/TSDoc al código
- **THEN** el comentario está en inglés

#### Scenario: Strings de i18n en español o inglés según el catálogo

- **WHEN** un colaborador agrega una clave al catálogo `packages/i18n-messages/src/es.json`
- **THEN** la clave (identifier) está en inglés
- **AND** el valor (copy visible al usuario) está en español
- **AND** la misma clave existe en `packages/i18n-messages/src/en.json` con su valor en inglés

#### Scenario: Un archivo de ruta nuevo se nombra en inglés

- **WHEN** un colaborador crea una nueva pantalla bajo `apps/web/app/` o `apps/mobile/app/`
- **THEN** el nombre del archivo y de los directorios intermedios están en inglés (ej. `initial-balance/page.tsx`, no `saldo-actual/page.tsx`; `cards.tsx`, no `tarjetas.tsx`)
- **AND** las referencias al path en `<Link href>`, `router.push`, `redirect()`, `<Stack.Screen name>`, `<Tabs.Screen name>` usan los nombres en inglés
- **AND** el copy visible que el usuario lee sobre esa pantalla se sirve desde `@grana/i18n-messages` (en cualquier idioma), no desde el segmento de URL

#### Scenario: Un directorio de route group se nombra en inglés

- **WHEN** un colaborador agrega un route group (carpeta entre paréntesis) en `apps/web/app/` o `apps/mobile/app/`
- **THEN** el nombre del route group está en inglés (ej. `(onboarding-wizard)`, `(auth)`, `(app)`), incluso cuando no aparece en la URL final

### Requirement: Los mensajes de commit deben estar en inglés

Todos los mensajes de commit de git SHALL estar en inglés, siguiendo el formato de conventional commits ya descrito en `AGENTS.md` (`type(scope): subject`). El cuerpo y el footer del commit, si los hay, también SHALL estar en inglés.

#### Scenario: Commit con título en inglés

- **WHEN** un colaborador crea un commit
- **THEN** el subject está en inglés (p. ej. `feat(auth): add password recovery flow`)
- **AND** el body, si existe, también está en inglés

#### Scenario: Un LLM colaborando escribe commits en inglés

- **WHEN** un LLM colaborando autónomamente crea un commit
- **THEN** el mensaje generado está en inglés
- **AND** sigue el formato de conventional commits

### Requirement: Los nombres de branches deben seguir el formato canónico sin sufijos random

Los nombres de branches SHALL tener la forma `<prefijo>/<cuerpo-kebab-case>`, donde `<prefijo>` es uno de los listados en `AGENTS.md` (`feature/`, `bugfix/`, `hotfix/`, `chore/`). El `<cuerpo-kebab-case>` SHALL ser un identificador descriptivo en inglés en formato kebab-case. El cuerpo **SHALL NOT** incluir IDs random, hashes, sufijos numéricos arbitrarios, ni prefijos similares que no aporten significado semántico.

Esta regla aplica especialmente cuando un LLM crea branches de forma autónoma — los LLMs tienden a agregar sufijos para evitar colisiones, y esa práctica está explícitamente prohibida en este proyecto. Si una branch necesita distinguirse de otra con nombre similar, debe usar un sufijo descriptivo y semántico (p. ej. `-v2`, `-rollback`, `-step-2`), no un identificador random.

#### Scenario: Branch con prefijo válido y nombre descriptivo

- **WHEN** un colaborador crea una branch para una feature nueva
- **THEN** el nombre tiene la forma `feature/<cuerpo-descriptivo>` (p. ej. `feature/add-login-form`)
- **AND** el cuerpo no contiene IDs random ni sufijos numéricos arbitrarios

#### Scenario: Branch con sufijo de ID random es inválida

- **WHEN** un colaborador (típicamente un LLM autónomo) intenta crear `feature/add-login-form-xA43I` o `chore/cleanup-7b3f9`
- **THEN** la branch viola la regla y debe renombrarse antes de pushear

#### Scenario: Sufijo semánticamente significativo está permitido

- **WHEN** un colaborador crea `feature/migration-step-2` o `bugfix/race-condition-v2`
- **THEN** el nombre es válido porque el sufijo aporta significado (no es random)

### Requirement: README incluye instalación de pnpm como prerequisito

El `README.md` SHALL incluir, antes de cualquier instrucción de `pnpm install` u otra invocación de pnpm, un paso explícito de instalación del propio pnpm. Ese paso SHALL mencionar al menos una de estas dos rutas:

- `corepack enable pnpm` (rápido, requiere Node ≥ 16.13)
- Un link a [pnpm.io/installation](https://pnpm.io/installation)

#### Scenario: README documenta cómo instalar pnpm antes del primer `pnpm install`

- **WHEN** un colaborador nuevo abre el README para levantar el proyecto por primera vez
- **THEN** el primer paso accionable es la instalación de pnpm
- **AND** sólo después aparece el paso de `pnpm install`

#### Scenario: README ofrece al menos una ruta de instalación

- **WHEN** un colaborador lee el paso de instalación de pnpm
- **THEN** encuentra `corepack enable pnpm` o un link a `https://pnpm.io/installation` (o ambos)

### Requirement: AGENTS.md documenta la regla de branch naming

El `AGENTS.md` SHALL incluir, en su sección de branching, una cláusula que documente explícitamente la prohibición de sufijos/prefijos con IDs random, hashes o números arbitrarios en los nombres de branches. La cláusula SHALL existir además de la lista actual de prefijos (`feature/*`, `bugfix/*`, `hotfix/*`, `chore/*`).

#### Scenario: AGENTS.md tiene la cláusula de no IDs random

- **WHEN** un LLM lee `AGENTS.md` al inicio de una sesión de Claude Code
- **THEN** la sección de branching menciona los prefijos válidos
- **AND** menciona explícitamente que el cuerpo del nombre no debe contener IDs random, hashes ni sufijos numéricos arbitrarios
- **AND** incluye un ejemplo positivo y uno negativo

### Requirement: Las specs cross-platform usan una capability por comportamiento de negocio con scenarios tagueados por plataforma

Cuando un comportamiento de producto existe en más de una plataforma (web y mobile), SHALL existir **una sola capability** que describa ese comportamiento, no una capability por plataforma. El nombre de la capability SHALL ser neutral respecto a la plataforma (p. ej. `auth`, `dashboard`, `transactions`), no `auth-web` ni `auth-mobile`.

Dentro de esa capability:

- Los scenarios cuyo comportamiento es idéntico en todas las plataformas SHALL escribirse sin tag de plataforma.
- Los scenarios cuyo comportamiento diverge entre plataformas SHALL llevar un tag de plataforma al final del nombre del scenario, entre paréntesis: `(web)` o `(mobile)`. P. ej. `#### Scenario: El usuario abre el link de confirmación de email (web)` y `#### Scenario: El usuario abre el deep link de confirmación de email (mobile)`.

Las capabilities **dedicadas a una plataforma** (porque la preocupación es genuinamente específica de esa plataforma, no compartida con otra) SHALL llevar un prefijo `web-` o `mobile-` en el nombre. Ejemplos: `mobile-push-notifications`, `web-middleware-routing`, `mobile-deep-links`. Esto deja claro al lector y al LLM que esa capability no tiene contraparte cross-platform.

La capability `project-conventions` y otras capabilities meta (que aplican a todo el repo, no a una plataforma) SHALL permanecer sin prefijo.

#### Scenario: Comportamiento idéntico en web y mobile va sin tag

- **WHEN** un colaborador escribe un requirement para `auth` donde la regla de negocio es la misma en web y mobile (p. ej. "el password debe tener al menos 8 caracteres")
- **THEN** los scenarios asociados no llevan tag de plataforma
- **AND** se entiende que aplican a ambas

#### Scenario: Comportamiento que diverge entre plataformas se tagea explícitamente

- **WHEN** un requirement tiene un mecanismo diferente en web vs mobile (p. ej. cookie session en web, SecureStore en mobile)
- **THEN** los scenarios afectados llevan tag de plataforma: `Scenario: El usuario cierra sesión (web)` y `Scenario: El usuario cierra sesión (mobile)`
- **AND** los scenarios platform-agnostic del mismo requirement quedan sin tag

#### Scenario: Una capability genuinamente platform-specific lleva prefijo

- **WHEN** un colaborador agrega una capability cuya preocupación solo existe en una plataforma (p. ej. push notifications nativas)
- **THEN** la capability se llama con prefijo: `mobile-push-notifications`
- **AND** no se mete dentro de una capability cross-platform existente

#### Scenario: Una capability meta no lleva prefijo de plataforma

- **WHEN** un colaborador trabaja sobre `project-conventions` u otra capability que rige al repo entero
- **THEN** la capability no lleva prefijo `web-` ni `mobile-`
- **AND** sus requirements aplican a ambas apps

#### Scenario: Un LLM lee una spec y sabe qué plataforma aplica

- **WHEN** un LLM lee `openspec/specs/auth/spec.md` para implementar un cambio
- **THEN** distingue los scenarios cross-platform de los platform-specific por la presencia/ausencia del tag `(web)` / `(mobile)` al final del nombre
- **AND** sabe que las capabilities con prefijo `web-` / `mobile-` son enteramente para esa plataforma

---

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

