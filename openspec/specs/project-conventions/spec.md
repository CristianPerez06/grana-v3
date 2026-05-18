# project-conventions Specification

## Purpose
TBD - created by archiving change add-project-conventions. Update Purpose after archive.
## Requirements
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
- **`CLAUDE.md`**: este archivo SHALL permanecer en inglés porque es una extensión del system prompt para LLMs (convención del ecosistema Claude Code).

#### Scenario: Un nuevo proposal se escribe en español

- **WHEN** un colaborador crea un nuevo `openspec/changes/<name>/proposal.md`
- **THEN** la prosa del proposal está en español
- **AND** los headers parseados por OpenSpec (si los hay) permanecen en sus formas en inglés

#### Scenario: Una spec usa keywords en inglés pero prosa en español

- **WHEN** un colaborador crea o modifica un `openspec/changes/<name>/specs/<capability>/spec.md`
- **THEN** los markers `## ADDED Requirements`, `### Requirement:`, `#### Scenario:`, `**WHEN**`, `**THEN**`, `**AND**` están en inglés
- **AND** los nombres después de `Requirement:` y `Scenario:` están en español
- **AND** las descripciones de requirements y los pasos de scenarios están en español

#### Scenario: CLAUDE.md no se traduce al español

- **WHEN** un colaborador modifica `CLAUDE.md`
- **THEN** el archivo permanece en inglés
- **AND** la spec acepta esta excepción explícitamente

### Requirement: El código debe estar en inglés

Todos los identifiers del código SHALL estar en inglés. Esto cubre nombres de variables, funciones, tipos, interfaces, componentes, props, parámetros, hooks personalizados, imports y módulos. También cubre nombres de archivos y directorios bajo cualquier `apps/<name>/` o `packages/<name>/`, y cualquier código fuente nuevo. Los comentarios en el código y la documentación JSDoc/TSDoc SHALL estar en inglés. Los nombres de stories de Storybook (exports nombrados como `Default`, `WithError`, etc.) SHALL estar en inglés porque son TypeScript identifiers.

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

### Requirement: Los mensajes de commit deben estar en inglés

Todos los mensajes de commit de git SHALL estar en inglés, siguiendo el formato de conventional commits ya descrito en `CLAUDE.md` (`type(scope): subject`). El cuerpo y el footer del commit, si los hay, también SHALL estar en inglés.

#### Scenario: Commit con título en inglés

- **WHEN** un colaborador crea un commit
- **THEN** el subject está en inglés (p. ej. `feat(auth): add password recovery flow`)
- **AND** el body, si existe, también está en inglés

#### Scenario: Un LLM colaborando escribe commits en inglés

- **WHEN** un LLM colaborando autónomamente crea un commit
- **THEN** el mensaje generado está en inglés
- **AND** sigue el formato de conventional commits

### Requirement: Los nombres de branches deben seguir el formato canónico sin sufijos random

Los nombres de branches SHALL tener la forma `<prefijo>/<cuerpo-kebab-case>`, donde `<prefijo>` es uno de los listados en `CLAUDE.md` (`feature/`, `bugfix/`, `hotfix/`, `chore/`). El `<cuerpo-kebab-case>` SHALL ser un identificador descriptivo en inglés en formato kebab-case. El cuerpo **SHALL NOT** incluir IDs random, hashes, sufijos numéricos arbitrarios, ni prefijos similares que no aporten significado semántico.

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

### Requirement: CLAUDE.md documenta la regla de branch naming

El `CLAUDE.md` SHALL incluir, en su sección de branching, una cláusula que documente explícitamente la prohibición de sufijos/prefijos con IDs random, hashes o números arbitrarios en los nombres de branches. La cláusula SHALL existir además de la lista actual de prefijos (`feature/*`, `bugfix/*`, `hotfix/*`, `chore/*`).

#### Scenario: CLAUDE.md tiene la cláusula de no IDs random

- **WHEN** un LLM lee `CLAUDE.md` al inicio de una sesión de Claude Code
- **THEN** la sección de branching menciona los prefijos válidos
- **AND** menciona explícitamente que el cuerpo del nombre no debe contener IDs random, hashes ni sufijos numéricos arbitrarios
- **AND** incluye un ejemplo positivo y uno negativo

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

### Requirement: El repo está organizado como monorepo pnpm con apps/ y packages/

El repo SHALL estar organizado como un monorepo manejado por pnpm workspaces, con la siguiente layout:

- `apps/` SHALL contener una carpeta por aplicación desplegable. La app actual es `apps/web/` (Next.js). Apps futuras (p. ej. `apps/mobile/` cuando se haga el scaffold de la app móvil) SHALL agregarse bajo `apps/` siguiendo el mismo patrón. Cada `apps/<name>/` SHALL tener su propio `package.json`, su propio toolchain (Next config, Expo config, etc.), y SHALL ser autónomo a nivel build.
- `packages/` SHALL contener una carpeta por paquete compartido entre apps. Los paquetes actuales son `packages/validation/` (schemas Yup), `packages/i18n-messages/` (catálogos JSON), `packages/supabase/` (cliente factory + tipos de DB), y `packages/ui-tokens/` (tokens de diseño). Cada `packages/<name>/` SHALL tener su propio `package.json` con `name: "@grana/<name>"` y SHALL exportar via `main`/`exports`.
- La raíz del repo SHALL contener: `package.json` (scripts orquestadores + dev tooling compartido), `pnpm-workspace.yaml`, `tsconfig.base.json` si se usa una base compartida, `openspec/`, `supabase/` (backend, no es app), `CLAUDE.md`, y los archivos meta (`.gitignore`, `.env.example`, README, etc.).
- Código de producto SHALL NOT vivir en la raíz. Todo `app/`, `components/`, `lib/` y similares SHALL vivir dentro de un `apps/<name>/` o `packages/<name>/`.

La regla de qué va en `apps/` vs `packages/`:

- Va en `apps/<name>/` el código específico de una plataforma o deployment (rutas Next, pantallas Expo, middleware, server actions, components).
- Va en `packages/<name>/` el código que es reutilizable entre apps **y** no tiene dependencias de plataforma. Si un módulo se usa solo en una app, vive en esa app.

#### Scenario: Una feature nueva de web se agrega bajo apps/web

- **WHEN** un colaborador implementa una ruta o componente nuevo solo para la app web
- **THEN** el archivo se crea bajo `apps/web/app/` o `apps/web/components/`
- **AND** no se crea en la raíz ni en `packages/`

#### Scenario: Lógica compartida nueva se agrega como paquete

- **WHEN** un colaborador identifica lógica que va a usarse en web y mobile (p. ej. un nuevo grupo de schemas de validación para una entidad)
- **THEN** se agrega al paquete compartido que corresponda (p. ej. `packages/validation/src/<entity>.ts`)
- **AND** se importa desde ambas apps vía el nombre del paquete (p. ej. `import { ... } from '@grana/validation'`)

#### Scenario: Lógica que se usaba solo en web pero ahora también se necesita en mobile

- **WHEN** un colaborador descubre que un módulo que vivía en `apps/web/lib/` ahora también lo necesita mobile
- **THEN** el módulo se promueve a un paquete bajo `packages/` con un `package.json` propio
- **AND** ambas apps lo consumen vía el nombre del paquete
- **AND** se evita duplicar el código copiándolo a `apps/mobile/lib/`

#### Scenario: Un colaborador intenta agregar código de producto en la raíz

- **WHEN** un colaborador crea un archivo de código de producto directamente en la raíz del repo (p. ej. en una nueva carpeta `lib/` o `components/` raíz)
- **THEN** el archivo viola la convención
- **AND** debe moverse a la app o paquete apropiado

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

### Requirement: El ordenamiento de transacciones en queries distingue uso de cálculo y uso de display

El sistema SHALL usar dos criterios de ordenamiento distintos para transacciones según el propósito de la query:

**Para cálculo de saldos y balances** (running totals, balance history, sumarización):
- `ORDER BY date ASC, created_at ASC, id ASC`
- Razón: los saldos se computan cronológicamente; el orden determinístico garantiza resultados consistentes ante transacciones del mismo día.

**Para display al usuario** (listas de movimientos en pantalla, cualquier UI que muestre transacciones):
- `ORDER BY date DESC, created_at DESC, id DESC`
- Razón: el usuario espera ver primero el movimiento más reciente. Para transacciones del mismo día, el último ingresado debe aparecer primero.

Esta regla aplica en todos los módulos: `transactions`, `cards`, `accounts`, y cualquier módulo futuro que muestre listas de movimientos.

#### Scenario: Lista de movimientos de una cuenta muestra el más reciente primero

- **WHEN** el usuario abre el listado de movimientos de cualquier cuenta o resumen
- **THEN** la transacción con la fecha más reciente aparece en la primera posición
- **AND** si dos transacciones tienen la misma fecha, la ingresada más tarde aparece primero

#### Scenario: Query de cálculo de saldo no se ve afectada por la regla de display

- **WHEN** el sistema calcula el saldo disponible de una cuenta sumando transacciones
- **THEN** la query interna usa `ORDER BY date ASC, created_at ASC, id ASC` para consistencia determinística
- **AND** el resultado no varía si se invierte el orden (la suma es conmutativa, pero el orden explícito evita bugs sutiles en running totals)

### Requirement: Las tarjetas no descuentan disponible hasta el pago del resumen

El sistema SHALL respetar el invariante `I-CRED-1` en todo el motor contable: las cuentas `accounts.type='credit'` tienen siempre `initial_balance=0` en todas sus monedas, y las transacciones `type='expense'` con `account.type='credit'` SHALL ser excluidas del cálculo del saldo de cualquier cuenta. El único efecto contable de una transacción de tarjeta sobre el saldo disponible del usuario SHALL ser indirecto, vía el `expense` que genera el flujo "pago de resumen" en una cuenta `cash`/`bank`.

Este invariante SHALL ser enforced en:

- Constraint `CHECK` que rechaza `initial_balance != 0` para cualquier `account_currencies` cuya cuenta padre tenga `type='credit'`.
- Todas las queries del motor contable (función helper centralizada) que computen saldos.
- Tests unitarios y de integración que validen el invariante.

#### Scenario: Inserción de transacción `pending` en tarjeta no cambia saldo

- **WHEN** se inserta una transacción `expense` con `status='pending'` en una cuenta `credit`
- **THEN** el saldo derivado de cualquier cuenta `cash`/`bank` propia no cambia

#### Scenario: initial_balance distinto de cero en cuenta credit es rechazado por DB

- **WHEN** se intenta insertar `account_currencies` con `initial_balance=100` para una cuenta `type='credit'`
- **THEN** la DB rechaza por la constraint `chk_credit_initial_balance`

---

### Requirement: Las cuotas N>1 usan el patrón madre/hija con la madre off-ledger

El sistema SHALL respetar el invariante `I-CRED-7`: una compra en N cuotas (N ≥ 2) en tarjeta SHALL generar una transacción "madre" (`is_parent=true`, `account_id=NULL`, `status=NULL`, `card_period_id=NULL`) y N transacciones "hijas" (`is_parent=false`, `parent_id=<madre.id>`, `account_id=<tarjeta>`, `status='pending'`, `installment_n=i`, `installments_total=N`).

La madre SHALL ser **off-ledger**: no impacta saldos, no aparece en listas de movimientos del listado general, no aparece en queries de cálculo de total del período. La madre existe únicamente para agrupar las hijas en la UI de "detalle de la compra" y para soportar edición/eliminación cascadeada.

Las hijas SHALL transitar `pending → paid` exclusivamente como efecto del flujo "pago de resumen" — nunca como UPDATE manual o directo.

#### Scenario: Madre con is_parent=true no aparece en queries de saldo

- **WHEN** se calcula el saldo de cualquier cuenta del usuario
- **THEN** las transacciones con `is_parent=true` se excluyen del SUM

#### Scenario: Madre con is_parent=true no aparece en lista de movimientos

- **WHEN** se renderiza la lista de movimientos de una tarjeta o del listado general
- **THEN** las transacciones con `is_parent=true` se omiten; solo se muestran las hijas

#### Scenario: UPDATE manual de status pending → paid en una hija es rechazado

- **WHEN** se intenta UPDATE directo (fuera del flujo `payCardPeriod`) que cambia `status` de una cuota
- **THEN** el sistema rechaza (vía trigger, RLS policy específica, o convención de código + revisión)

---

### Requirement: Toda transacción en tarjeta tiene un período asignado

El sistema SHALL respetar el invariante `I-CRED-6`: toda transacción con `type='expense'`, `is_parent=false` y `account.type='credit'` SHALL tener `card_period_id NOT NULL` apuntando a un `card_periods` existente, y `status` en `{ 'pending', 'paid' }`. El sistema SHALL enforce esto vía:

- Constraint NOT NULL en `transactions.card_period_id` condicional al `account.type` (vía trigger o constraint check con subquery).
- Validación en las actions de inserción (`registerCardPurchase`, `registerInstallments`).

#### Scenario: Inserción de consumo sin card_period_id es rechazada

- **WHEN** se intenta INSERT de un `expense` en tarjeta con `card_period_id=NULL`
- **THEN** la DB o action rechaza la operación

#### Scenario: Inserción de consumo con status inválido es rechazada

- **WHEN** se intenta INSERT de un `expense` en tarjeta con `status='posted'`
- **THEN** la DB o action rechaza (status válidos son `'pending'` y `'paid'`)

---

### Requirement: Toda tarjeta activa tiene siempre al menos un período abierto por delante de hoy

El sistema SHALL respetar el invariante `I-CRED-12`: para toda cuenta `accounts.type='credit'` con `is_active=true`, SHALL existir al menos un `card_periods` cuyo estado derivado sea `open` (`today ≤ end_date`) o, alternativamente, SHALL existir un período "actual" cuyo `start_date ≤ today` y la app SHALL haber generado el siguiente bajo demanda.

El invariante SHALL mantenerse vía el rolling automático (lazy on-demand): si una operación necesita un período cubriendo una fecha futura y no existe, el sistema lo genera al vuelo usando el algoritmo de sugerencia.

#### Scenario: Tarjeta sin períodos open dispara rolling al primer consumo

- **WHEN** una tarjeta tiene solamente un período `paid` y se intenta registrar un consumo con `date` después del `end_date` de ese período
- **THEN** el sistema genera un nuevo `card_periods` con fechas estimadas antes de insertar el consumo
- **AND** el consumo se asigna al nuevo período

#### Scenario: Tarjeta archivada (inactiva) no requiere períodos open

- **WHEN** una tarjeta tiene `is_active=false`
- **THEN** el invariante no exige períodos open (la tarjeta no acepta consumos nuevos)

---

### Requirement: Las cuotas N>1 solo aplican a transacciones en ARS

El sistema SHALL respetar el invariante `I-CRED-9`: una compra en N cuotas (N ≥ 2) en tarjeta SHALL tener `currency_code='ARS'`. El sistema SHALL rechazar cualquier intento de crear una compra en cuotas con moneda distinta a ARS.

#### Scenario: Cuotas en USD es rechazada

- **WHEN** un usuario intenta registrar una compra de US$500 en 3 cuotas
- **THEN** la action `registerInstallments` retorna error de validación
- **AND** no inserta ni la madre ni las hijas

---

### Requirement: La columna `fx_rate_to_ars` se popula solo en consumos de tarjeta no-ARS

El sistema SHALL respetar el invariante `I-CRED-11`: `transactions.fx_rate_to_ars` SHALL ser NOT NULL y mayor a cero si y solo si `account.type='credit'`, `currency_code != 'ARS'`, `type='expense'` y `is_parent=false`. En cualquier otra combinación, SHALL ser `NULL`.

El sistema SHALL enforce esto vía constraint `CHECK` con subquery sobre `accounts.type` (o trigger equivalente) y vía validación en las actions de inserción.

#### Scenario: Consumo ARS con fx_rate_to_ars no nulo es rechazado

- **WHEN** se intenta INSERT con `currency_code='ARS'` y `fx_rate_to_ars=1400`
- **THEN** la DB rechaza por el constraint

#### Scenario: Consumo USD sin fx_rate_to_ars es rechazado

- **WHEN** se intenta INSERT con `currency_code='USD'` en tarjeta y `fx_rate_to_ars=NULL`
- **THEN** la DB rechaza por el constraint

#### Scenario: Income en cuenta cash con fx_rate_to_ars no nulo es rechazado

- **WHEN** se intenta INSERT con `type='income'`, `account.type='cash'`, y `fx_rate_to_ars=1400`
- **THEN** la DB rechaza

