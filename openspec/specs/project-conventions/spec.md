# project-conventions Specification

## Purpose

Spec meta del proyecto: agrupa las convenciones transversales que aplican a todo el repo Grana V3 y que no pertenecen a ningún módulo de negocio en particular. Incluye el principio "el repo es la memoria del producto" (la app debe poder continuarse sin contexto de chat), el bilingüismo (documentación en español, código en inglés), las reglas de branching y merge a `main` vía squash-and-merge con historia lineal, el workflow obligatorio de OpenSpec (archive en la branch antes del merge, checklist post-archivado, `pnpm openspec:check` como gate) y la política web↔mobile de implementaciones paralelas con API idéntica.
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

### Requirement: El repo está organizado como monorepo pnpm con apps/ y packages/

El repo SHALL estar organizado como un monorepo manejado por pnpm workspaces, con la siguiente layout:

- `apps/` SHALL contener una carpeta por aplicación desplegable. La app actual es `apps/web/` (Next.js). Apps futuras (p. ej. `apps/mobile/` cuando se haga el scaffold de la app móvil) SHALL agregarse bajo `apps/` siguiendo el mismo patrón. Cada `apps/<name>/` SHALL tener su propio `package.json`, su propio toolchain (Next config, Expo config, etc.), y SHALL ser autónomo a nivel build.
- `packages/` SHALL contener una carpeta por paquete compartido entre apps. Los paquetes actuales son `packages/validation/` (schemas Yup), `packages/i18n-messages/` (catálogos JSON), `packages/supabase/` (cliente factory + tipos de DB), y `packages/ui-tokens/` (tokens de diseño). Cada `packages/<name>/` SHALL tener su propio `package.json` con `name: "@grana/<name>"` y SHALL exportar via `main`/`exports`.
- La raíz del repo SHALL contener: `package.json` (scripts orquestadores + dev tooling compartido), `pnpm-workspace.yaml`, `tsconfig.base.json` si se usa una base compartida, `openspec/`, `supabase/` (backend, no es app), `AGENTS.md`, y los archivos meta (`.gitignore`, `.env.example`, README, etc.).
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

### Requirement: Los cálculos monetarios usan aritmética decimal

Todo cálculo monetario del producto SHALL usar aritmética decimal (`Money`/`decimal.js` o una primitiva equivalente), no aritmética binaria de JavaScript con `number`, mientras el valor esté dentro del motor contable. Esto aplica a saldos derivados, sumatorias de transacciones, pagos, límites, cuotas, ajustes y cualquier operación que combine montos.

Los campos monetarios pueden cruzar bordes de UI/API como `number` o `string` cuando sea necesario por formularios, Supabase o formateo visual, pero la conversión a `number` SHALL ocurrir únicamente en el borde de presentación o persistencia. Entre lectura, cálculo y comparación de montos, el código SHALL usar `Money`.

#### Scenario: Sumar centavos no deja residuo binario

- **WHEN** el sistema calcula `0.10 + 0.20 - 0.30` para un saldo o total monetario
- **THEN** el resultado contable es exactamente `0`
- **AND** la comparación contra cero se hace con `Money.isZero` o equivalente decimal

#### Scenario: Una query convierte a number solo al devolver datos para display

- **WHEN** una query de saldos lee `numeric(18,2)` desde Supabase
- **THEN** acumula los montos con `Money`
- **AND** convierte a `number` recién al construir el modelo de lectura que consume la UI

#### Scenario: Un cálculo contable nuevo no usa `Number(row.amount)` para sumar

- **WHEN** un colaborador agrega una sumatoria de montos de transacciones
- **THEN** convierte cada monto con `Money.from(row.amount)`
- **AND** usa `Money.add`/`Money.subtract` para acumular

#### Scenario: Un formulario monetario no usa parseFloat directo

- **WHEN** un formulario convierte un string ingresado por el usuario en un monto
- **THEN** usa un parser monetario compartido que rechaza parseos parciales como `123abc`
- **AND** recién después pasa el monto normalizado a la action o schema correspondiente

#### Scenario: Una server action normaliza antes de persistir

- **WHEN** una server action persiste `amount`, `initial_balance`, `credit_limit` o un campo monetario equivalente
- **THEN** normaliza el valor con el helper monetario compartido antes del INSERT/UPDATE
- **AND** usa la escala de DB correspondiente (`2` decimales para montos, `6` para `fx_rate_to_ars`)

#### Scenario: El baseline monetario actual queda auditado

- **WHEN** un colaborador revisa el baseline monetario de la V3
- **THEN** encuentra cubiertos con helpers decimales: cálculo de balances de cuentas, totales de tarjetas/períodos, inputs monetarios de formularios, normalización previa a persistencia, cuotas y comparación contra saldo cero
- **AND** considera aceptables los usos residuales de `number` en bordes de IO/display, formateo de una fila individual, cálculo de porcentajes visuales, y tipos generados de Supabase
- **AND** mantiene como pendiente consciente cualquier migración futura para representar `NUMERIC` como `string` o `Money` en tipos generados/curados de Supabase

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

La madre SHALL ser **off-ledger**: no impacta saldos y no aparece en queries de cálculo de total del período. La madre existe para agrupar las hijas en la UI de "detalle de la compra", soportar edición/eliminación cascadeada, y representar funcionalmente la compra original en el listado global de movimientos sin duplicar las cuotas.

Las hijas SHALL transitar `pending → paid` exclusivamente como efecto del flujo "pago de resumen" — nunca como UPDATE manual o directo.

#### Scenario: Madre con is_parent=true no aparece en queries de saldo

- **WHEN** se calcula el saldo de cualquier cuenta del usuario
- **THEN** las transacciones con `is_parent=true` se excluyen del SUM

#### Scenario: Madre con is_parent=true aparece solo como representación funcional global

- **WHEN** se renderiza una vista contable de tarjeta o período
- **THEN** las transacciones con `is_parent=true` se omiten; solo se muestran las hijas imputadas al período correspondiente
- **AND** cuando se renderiza el listado global `/transactions`, la madre MAY mostrarse como una única compra en cuotas en la fecha original de compra
- **AND** las hijas SHALL NOT aparecer en el listado global por defecto para evitar movimientos futuros que el usuario no registró en esa fecha

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

### Requirement: Bimoneda por defecto — todo usuario arranca con ARS y USD habilitados

El sistema SHALL habilitar ambas monedas (ARS y USD) para todo usuario nuevo en el momento del alta, sin pedirle al usuario que opte por la segunda moneda. La decisión de NO ver USD SHALL ser un opt-out posterior desde el módulo `settings` (próxima change), no un opt-in en el onboarding.

Esto se traduce concretamente a:

- El trigger `on_auth_user_created_default_account` SHALL crear la cuenta `Billetera` con filas en `account_currencies` para ARS y USD, ambas con `initial_balance=0` (comportamiento ya existente, que se preserva).
- Toda cuenta creada en el wizard de onboarding (cuenta bancaria) SHALL incluir filas en `account_currencies` para ARS y USD por defecto.
- La pantalla `/onboarding/saldo-actual` SHALL pedir saldos en ARS y USD para todas las cuentas relevantes, sin preguntar previamente "¿manejás dólares?".
- La UI de la app SHALL mostrar columnas y totales por separado para ARS y USD por defecto, en línea con el principio cross-cutting "Bimoneda" (ARS y USD son ledgers separados, nunca se convierten).
- Cuando la próxima change del módulo `settings` agregue un toggle "ocultar USD" en preferencias del usuario, ese toggle SHALL afectar solo la presentación visual (esconder columnas USD, no mostrar el segundo input en formularios) y NO SHALL alterar las filas de `account_currencies` ni el ledger interno.

Este principio es complementario, no reemplazo, del principio "Bimoneda" listado en la tabla de cross-cutting principles del `AGENTS.md` (que prohíbe convertir automáticamente entre ARS y USD). "Bimoneda por defecto" agrega: ARS+USD están habilitados por defecto para todos.

#### Scenario: Usuario nuevo tiene cuenta Billetera con ambas monedas tras signup

- **WHEN** un usuario completa el signup
- **THEN** existe en `accounts` una fila `Billetera` (tipo cash, propiedad del usuario)
- **AND** existen exactamente dos filas en `account_currencies` para esa cuenta: una con `currency_code='ARS', initial_balance=0` y otra con `currency_code='USD', initial_balance=0`

#### Scenario: Cuenta bancaria creada en onboarding tiene ambas monedas

- **WHEN** un usuario en `/onboarding/perfil` crea una cuenta bancaria
- **THEN** existen filas en `account_currencies` para ARS y USD asociadas a esa cuenta, ambas con `initial_balance=0`

#### Scenario: Saldo actual del onboarding pregunta ambas monedas sin precondición

- **WHEN** un usuario en `/onboarding/saldo-actual` ve el formulario
- **THEN** hay un input de monto para ARS y otro para USD (por cada cuenta visible en esa pantalla, según el modo)
- **AND** no hay pregunta previa tipo "¿manejás dólares?" que controle la visibilidad de los inputs USD

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

### Requirement: La paridad web↔mobile se sostiene por contratos de props compartidos

Grana SHALL mantener dos implementaciones nativas de cada primitivo de UI: una en `apps/web/components/ui/` y otra en `apps/mobile/components/`. NO se SHALL intentar compartir JSX entre web y React Native; ambas implementaciones permanecen independientes en su árbol de DOM/View nativo.

La paridad de API entre ambas SHALL estar garantizada por **tipos de props compartidos** vivos en el package `@grana/ui-contracts`. Cada componente equivalente en web y mobile MUST importar el mismo prop type desde `@grana/ui-contracts` y exponerlo como su prop signature pública. Las implementaciones MAY aceptar props adicionales propias de su plataforma vía intersection con el tipo del contrato, pero NO MAY divergir en los nombres, tipos ni semántica de las props comunes.

Las convenciones de naming adoptadas (las que difieren entre web y RN) SHALL quedar documentadas en `packages/ui-contracts/README.md`. Una convención fijada por esta spec: los callbacks de interacción se llaman `onPress` (no `onClick`) en ambos lados, alineado con la convención de React Native.

Esta política aplica a los primitivos de UI (`Button`, `Card`, `Input`, `Label`, `Alert`, `Spinner`, `FormField`, `PasswordField` y futuros). NO aplica a la lógica de negocio pura: para eso existe `@grana/money-logic`, donde una única implementación SHALL ser consumida por ambas plataformas.

#### Scenario: Web y mobile importan el mismo prop type

- **WHEN** un colaborador define un componente primitivo equivalente en web y mobile (por ejemplo `Button`)
- **THEN** ambos archivos importan `ButtonProps` desde `@grana/ui-contracts`
- **AND** ambos archivos exponen `Button(props: ButtonProps)` como su firma pública

#### Scenario: Una prop nueva en el contrato obliga a mobile a implementarla

- **WHEN** un colaborador agrega una nueva prop obligatoria al tipo `ButtonProps` en `@grana/ui-contracts`
- **THEN** TypeScript marca como error el archivo `apps/mobile/components/Button.tsx` hasta que mobile la implemente
- **AND** la PR NO puede mergearse mientras mobile no cumpla el contrato

#### Scenario: Una implementación necesita una prop específica de su plataforma

- **WHEN** la implementación de mobile necesita una prop extra que no aplica a web (por ejemplo, haptic feedback)
- **THEN** mobile expone su firma como `MobileButtonProps = ButtonProps & { hapticFeedback?: 'light' | 'medium' }`
- **AND** la prop extra NO se agrega al contrato compartido

#### Scenario: Lógica financiera no se duplica entre apps

- **WHEN** una función de cálculo financiero puro (balance, derivación de período, generación de fechas de recurrencia) es necesaria en web y mobile
- **THEN** la función vive en `@grana/money-logic` y ambas apps la importan desde ahí
- **AND** ninguna app reimplementa la función en su propio `lib/`

### Requirement: Capas de componentes UI y ubicación de componentes compuestos

Los componentes de UI de Grana SHALL organizarse en tres capas según su reutilización, y cada capa SHALL vivir en una ubicación canónica por plataforma:

1. **Primitivos de UI** — building blocks básicos (`Button`, `Card`, `Input`, `FormField`, `PasswordField`, `MoneyAmountInput`, `Alert`, `Spinner`, `Label`, …). SHALL vivir en `apps/web/components/ui/` y `apps/mobile/components/ui/`, una implementación nativa por plataforma, con el prop type compartido en `@grana/ui-contracts`. En web cada primitivo SHALL tener una story de Storybook; mobile no tiene Storybook y SHALL espejar los primitivos por nombre. Los primitivos de campo (`Input`, `FormField`, `PasswordField`, `MoneyAmountInput`) NO MAY incluir vertical margin propio (`mb-*`, `mt-*`, `my-*`); el ritmo vertical entre campos SHALL ser propiedad del contenedor padre (`flex-col gap-X` o equivalente).
2. **Componentes compuestos** — reutilizables entre rutas pero no lo bastante genéricos para `ui/` (sin Storybook). Se dividen en:
   - **Shells de app/route-group:** SHALL vivir en `apps/<app>/components/layout/` (`AuthShell`, `TabBar`, `AppMenu`). La ubicación coincide entre plataformas.
   - **Compartidos de feature:** compartidos entre rutas de una misma feature. En web SHALL vivir bajo el route group en `apps/web/app/(group)/_components/` (Next.js ignora los directorios con prefijo `_`). En mobile NO MAY colocarse bajo `app/` (Expo Router trata `app/` como rutas) y SHALL vivir en `apps/mobile/components/<feature>/`.
3. **Locales de ruta/pantalla** — de un solo uso, colocados junto a la ruta (`login/login-form.tsx` en web; inline en la pantalla en mobile).

La divergencia de ubicación de los compartidos de feature entre web y mobile es intencional y la fuerza el router; NO viola la política Web↔Mobile (que prohíbe compartir JSX y exige paridad de API por contratos, no rutas de carpeta idénticas).

Como regla de uso derivada: pantallas equivalentes en web y mobile SHALL usar el primitivo equivalente de su plataforma. En particular, un campo de contraseña SHALL usar el primitivo `PasswordField` (con toggle ver/ocultar) en ambas plataformas, NUNCA un input crudo con `secureTextEntry`. Un campo de dinero SHALL usar el primitivo `MoneyAmountInput` (sanitización de keystrokes + `inputMode="decimal"` / `keyboardType="decimal-pad"`) en ambas plataformas, NUNCA un `<input type="number">` (web) ni un `TextInput` crudo (mobile).

#### Scenario: Un primitivo nuevo vive en components/ui de ambas apps con story en web

- **WHEN** un colaborador agrega un primitivo de UI nuevo
- **THEN** crea la implementación en `apps/web/components/ui/` (con su `*.stories.tsx`) y en `apps/mobile/components/ui/`
- **AND** define el prop type compartido en `@grana/ui-contracts`

#### Scenario: Un componente compartido entre rutas de una feature se ubica según el router de la plataforma

- **WHEN** un colaborador necesita reutilizar un componente entre varias rutas de una misma feature (no genérico para `ui/`)
- **THEN** en web lo coloca en `apps/web/app/(group)/_components/`
- **AND** en mobile lo coloca en `apps/mobile/components/<feature>/`, no bajo `app/`

#### Scenario: Pantallas equivalentes usan el primitivo equivalente

- **WHEN** una pantalla de auth necesita un campo de contraseña en web y en mobile
- **THEN** ambas plataformas usan el primitivo `PasswordField` (con toggle ver/ocultar)
- **AND** ninguna usa un input crudo con `secureTextEntry`

#### Scenario: Un campo de dinero usa MoneyAmountInput en ambas plataformas

- **WHEN** una pantalla necesita capturar un monto de dinero (saldo, importe, límite) en web o en mobile
- **THEN** la pantalla usa el primitivo `MoneyAmountInput` de su plataforma, que sanitiza keystrokes a dígitos + un único separador decimal
- **AND** web NO usa `<input type="number">` (riesgo de spinner/wheel/arrows perdiendo centavos por aritmética float)
- **AND** mobile NO usa un `TextInput` crudo de React Native con `keyboardType="decimal-pad"` ni un primitivo de campo bespoke equivalente

#### Scenario: Un primitivo de campo no bakea margen vertical propio

- **WHEN** un colaborador agrega o modifica un primitivo de campo (`Input`, `FormField`, `PasswordField`, `MoneyAmountInput`, o un futuro primitivo equivalente)
- **THEN** el primitivo NO incluye clases `mb-*`, `mt-*`, ni `my-*` en su root
- **AND** las pantallas que componen varios campos SHALL controlar el ritmo vertical mediante un contenedor padre con `flex-col gap-X` (o equivalente nativo de la plataforma)
- **AND** las pantallas NO MAY envolver primitivos en `<View>` / `<div>` auxiliares solo para agregar margen vertical alrededor de un campo

### Requirement: Toda nueva ruta o pantalla entrega loading y error states desde su primera implementación

Cuando un colaborador agrega una ruta nueva a `apps/web` o una pantalla nueva con fetching cliente a `apps/mobile`, esa ruta/pantalla SHALL incluir loading y error states desde el commit que la introduce (no en un follow-up).

Aplicación concreta por plataforma:

- **Web** (`apps/web/app/.../page.tsx`): el segmento SHALL tener un `loading.tsx` y un `error.tsx` colocalizados, o estar cubierto por un par a nivel de layout group ancestro. La regla operativa es: si la ruta nueva queda cubierta por el `loading.tsx`/`error.tsx` del layout group superior con un fallback aceptable, no hace falta duplicar; si necesita un fallback distinto, agregar el par específico.
- **Mobile** (`apps/mobile/app/.../<screen>.tsx`): la pantalla SHALL manejar explícitamente los estados `isPending` y `error` de sus queries, usando `<Spinner size="lg" />` y `<RouteError>` (componentes provistos por la capability `route-loading-and-errors`). Pantallas placeholder (sin queries) están exentas hasta su primera implementación real.

Esta regla NO aplica retroactivamente a rutas anteriores al change que introdujo la capability `route-loading-and-errors` — aunque ese change agrega el par a las rutas existentes en un solo commit, lo que importa para esta convención es que **de aquí en adelante** ninguna ruta nueva se mergee sin loading/error.

#### Scenario: Una ruta web nueva entrega loading.tsx y error.tsx en el mismo PR

- **WHEN** un colaborador crea un nuevo `apps/web/app/<group>/<route>/page.tsx`
- **AND** el segmento NO queda cubierto por un `loading.tsx` o `error.tsx` de un layout ancestro con fallback aceptable
- **THEN** el mismo PR agrega `loading.tsx` y `error.tsx` colocalizados con el `page.tsx` nuevo
- **AND** el PR es revisado antes de merge para validar que ambos archivos están presentes o que el fallback ancestro aplica

#### Scenario: Una pantalla mobile nueva con queries entrega loading y error states en el mismo PR

- **WHEN** un colaborador crea una nueva pantalla `apps/mobile/app/(app)/<screen>.tsx` que invoca `useQuery({ ... })`
- **THEN** el componente maneja `isPending` (renderizando `<Spinner size="lg" />`) y `error` (renderizando `<RouteError>`) antes de renderizar contenido
- **AND** el PR no se mergea sin esa cobertura

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

### Requirement: Las superficies tipo tarjeta componen el primitivo `Card`, no recrean su shell

Cuando una superficie de UI necesita la apariencia de tarjeta (un contenedor con borde, fondo, radio y sombra), SHALL **componer el primitivo `Card`** (y sus sub-partes `CardHeader`/`CardContent`/`CardFooter` cuando aplique) en lugar de re-tipear las clases del shell (`rounded-* border bg-card shadow-sm …`) inline en una `section`/`div`. El shell canónico —radio, borde, fondo y sombra— SHALL vivir en una sola fuente: el primitivo `Card` en `apps/web/components/ui/card.tsx` (y su contraparte mobile en `apps/mobile/components/ui/Card.tsx`).

El `Card` SHALL seguir el **modelo composable**: el shell NO lleva padding propio; el padding interno proviene de `CardHeader`/`CardContent`/`CardFooter`. Una superficie sin header SHALL reponer el padding superior vía `CardContent` con `pt-6`. Cada superficie SHALL conservar su layout propio (`min-h-*`, dirección flex, `overflow`) vía `className` sobre `Card` o sus hijos, sin re-declarar el shell.

El `Card` web SHALL usar `rounded-2xl` (token `--radius-2xl`) como radio canónico de tarjeta. El `Card` SHALL exponer variantes de superficie vía una prop `variant`: `default` (`border-border bg-card`) y `emerald` (`border-emerald/30 bg-emerald/5`) para superficies de énfasis/promoción. La prop `variant` PUEDE vivir como extensión web-local (intersection sobre `CardProps`) mientras mobile no la necesite; cuando mobile requiera la misma variante, `variant` SHALL promoverse al contrato `@grana/ui-contracts` e implementarse en ambas plataformas.

Cuando una superficie tipo tarjeta es **clickeable** (toda la tarjeta navega o dispara una acción — p. ej. una card del wallet que es un `<Link>`, o la card "En curso" que es un `<button>`), SHALL componer `Card` con la prop **`asChild`** (`<Card asChild><Link …>…</Link></Card>` / `<Card asChild><button …>…</button></Card>`), de modo que el elemento interactivo BE el shell de tarjeta sin re-tipear `rounded-* border bg-card shadow-sm` inline. `asChild` (sobre Radix `Slot`) es extensión web-local sobre `CardProps`, igual que `variant`; se promueve al contrato cuando mobile lo requiera. Es el gemelo, para superficies, del `asChild` de `Button`.

Las cinco superficies tipo tarjeta del dashboard web (Hero, "Lo que viene", "Balance del mes", la tarjeta de bienvenida y el teaser "En qué se fue") SHALL componer `Card`; ninguna SHALL retener el shell duplicado inline.

#### Scenario: Una nueva superficie tipo tarjeta compone `Card`

- **WHEN** un colaborador necesita una superficie con apariencia de tarjeta en web
- **THEN** compone `<Card>` (con `CardHeader`/`CardContent`/`CardFooter` según corresponda)
- **AND** NO re-tipea `rounded-* border bg-card shadow-sm` inline en una `section`/`div`
- **AND** pasa su layout propio (`min-h-*`, flex, `overflow`) vía `className`

#### Scenario: La tarjeta de énfasis usa la variante `emerald`

- **WHEN** una superficie de tarjeta necesita el tratamiento de énfasis verde (p. ej. la tarjeta de bienvenida del dashboard)
- **THEN** usa `<Card variant="emerald">`
- **AND** NO re-tipea `border-emerald/30 bg-emerald/5` inline

#### Scenario: Una superficie tipo tarjeta clickeable usa `asChild`

- **WHEN** toda una superficie de tarjeta navega o dispara una acción (p. ej. una card del wallet `<Link>` o la card "En curso" `<button>`)
- **THEN** compone `<Card asChild>` envolviendo el elemento interactivo
- **AND** NO re-tipea `rounded-* border bg-card shadow-sm` inline en el `<Link>`/`<button>`

#### Scenario: El teaser del dashboard se ve como tarjeta par

- **WHEN** se renderiza el teaser "En qué se fue" en el dashboard web
- **THEN** compone `<Card>` (variante `default`) y obtiene `bg-card` y `rounded-2xl` del primitivo
- **AND** NO muestra el fondo gris de página (`--page`) por carecer de `bg-card`

#### Scenario: Agregar `variant` web-local no rompe mobile

- **WHEN** se agrega la prop `variant` al `Card` web como extensión web-local (intersection sobre `CardProps`)
- **THEN** el contrato `@grana/ui-contracts` NO cambia
- **AND** `pnpm --filter mobile typecheck` sigue verde sin que mobile implemente `variant`

---

### Requirement: Las acciones tipo botón componen el primitivo `Button`, no recrean su estilo

Cuando una superficie de UI necesita una **acción tipo botón** —un CTA primario, secundario, ghost, destructivo o un link estilizado como botón— SHALL **componer el primitivo `Button`** (`apps/web/components/ui/button.tsx`, contraparte mobile en `apps/mobile/components/ui/Button.tsx`) en lugar de re-tipear las clases de un botón (`bg-primary`/`bg-emerald`/`rounded-* px-* py-* text-… font-…`) inline en un `<button>` o un `<Link>`/`<a>`.

El estilo canónico de las acciones —color por variante, alto, padding, radio, estado de foco/disabled/loading— SHALL vivir en una sola fuente: el primitivo `Button` y sus `variant`/`size` (`primary | secondary | ghost | destructive | link` × `sm | md | lg | icon`). Las pantallas equivalentes en web y mobile SHALL usar el primitivo `Button` de su plataforma, nunca un control estilizado a mano (misma regla de uso que ya rige para `PasswordField` y `MoneyAmountInput`).

Cuando la acción navega (es un link), SHALL componerse como `<Button asChild><Link href=…>…</Link></Button>` en web, de modo que el `Link` reciba el estilo del primitivo sin duplicar clases. Esta regla es el gemelo, para acciones, de la regla de superficies tipo tarjeta (que compone `Card`).

Excepciones acotadas y legítimas (NO requieren `Button`): los links de navegación inline tratados como texto (breadcrumbs, "Ver todos →", links del footer admin) que NO pretenden la apariencia de un botón; y los controles internos de un primitivo que ya encapsula su propia interacción (`Segmented`, `Switch`, `Tabs`).

#### Scenario: Un CTA nuevo compone `Button`

- **WHEN** un colaborador agrega un CTA (p. ej. "Agregar tarjeta", "Registrar pago") en una pantalla web
- **THEN** compone `<Button variant=…>` (o `<Button asChild><Link…></Button>` si navega)
- **AND** NO re-tipea `bg-primary`/`bg-emerald rounded-* px-* py-* text-sm font-medium` inline en un `<button>` o `<Link>`

#### Scenario: Un link estilizado como botón usa `asChild`

- **WHEN** una acción que navega necesita la apariencia de botón primario
- **THEN** usa `<Button asChild><Link href=…>…</Link></Button>`
- **AND** el `Link` hereda el estilo del primitivo sin duplicar las clases del botón

#### Scenario: Un link de navegación inline no requiere `Button`

- **WHEN** una pantalla muestra un link de navegación tratado como texto (breadcrumb, "Ver todos los resúmenes →", link del footer admin)
- **THEN** PUEDE renderizarse como `<Link>` con estilo de texto (`text-… hover:…`)
- **AND** NO se exige componer `Button`, porque no pretende la apariencia de un botón

### Requirement: La lógica isomórfica vive en el package de dominio; sólo el glue acoplado a plataforma queda por app

La regla de no-duplicación de lógica pura entre apps SHALL aplicar a **toda lógica isomórfica cross-platform**, no sólo al cálculo financiero de `@grana/money-logic`. En particular, la lógica **view-model pura** de un dominio —agrupamiento, ordenamiento, urgencia/tono, porcentajes de uso, filtros, presentación y mappers de fila, sin React ni Supabase— SHALL vivir en el package de dominio correspondiente (`@grana/cards`, `@grana/accounts`, `@grana/transactions`, …) y SHALL ser consumida por ambas apps desde el nombre del package. NINGUNA app SHALL mantener una copia hand-synced de esa lógica en su propio `lib/` (el patrón "Mirror of … keep the two in sync" queda prohibido).

La frontera `apps/`↔`packages/` SHALL decidirse por **acoplamiento a plataforma**, no por la naturaleza Supabase de una query. Específicamente:

- Queda en `apps/<name>/` el glue acoplado a plataforma: `next/cache` (`revalidatePath`), `server-only` y la construcción del cliente Supabase de la app, la JSX y el ensamblado de datos del Server Component, la orquestación de contextos de UI, y los shells `'use server'` que traducen errores neutrales (web → `next-intl`, mobile → `useT`).
- Va a `@grana/<domain>` la lógica isomórfica: funciones puras, tipos de dominio, y los **reads parametrizados por el cliente** (`supabase: GranaSupabaseClient` inyectado, sin construir el cliente ni importar `server-only`/`next/*`), siguiendo el patrón de read slice ya codificado en `web-data-access`.

`AGENTS.md` SHALL describir esta frontera de forma consistente con `web-data-access` y NO SHALL afirmar que "las queries Supabase quedan en el `lib/` de cada app" — esa frase queda obsoleta porque los reads se extraen como slices parametrizados por cliente en `@grana/<domain>`.

#### Scenario: Lógica view-model pura mirroreada entre apps se consolida en el package de dominio

- **WHEN** un colaborador encuentra un módulo de lógica view-model pura (p. ej. `grouping.ts`: agrupamiento por banco, tono de urgencia, filtros) copiado en `apps/web/lib/<domain>/` y `apps/mobile/lib/<domain>/` con un comentario "Mirror of … keep in sync"
- **THEN** el módulo se mueve a `@grana/<domain>` como módulo puro único
- **AND** ambas apps lo importan desde el nombre del package
- **AND** la copia mobile se borra junto con los comentarios "keep in sync"

#### Scenario: La frontera se decide por acoplamiento a plataforma, no por "es una query Supabase"

- **WHEN** un colaborador evalúa si un read de dominio va a `apps/<name>/lib/` o a `@grana/<domain>`
- **THEN** el criterio NO es "toca Supabase" sino "está acoplado a plataforma"
- **AND** si el read puede recibir el cliente por parámetro (`supabase: GranaSupabaseClient`) sin importar `server-only`/`next/*` ni construir el cliente, vive en `@grana/<domain>` como read slice
- **AND** sólo el glue acoplado a plataforma (revalidación, construcción del cliente, JSX, shells `'use server'`) queda en la app

#### Scenario: AGENTS.md describe la frontera de forma consistente con web-data-access

- **WHEN** un colaborador lee la sección de frontera `apps/`↔`packages/` en `AGENTS.md`
- **THEN** la prosa NO afirma que las queries Supabase quedan en el `lib/` de cada app
- **AND** describe que la lógica isomórfica —funciones puras Y reads inyectados por cliente— vive en `@grana/<domain>`, y que sólo el glue acoplado a plataforma queda por app
- **AND** la descripción es consistente con los requirements de read slice de `web-data-access`

