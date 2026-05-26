# project-conventions Specification

## Purpose

Spec meta del proyecto: agrupa las convenciones transversales que aplican a todo el repo Grana V3 y que no pertenecen a ningún módulo de negocio en particular. Incluye el principio "el repo es la memoria del producto" (la app debe poder continuarse sin contexto de chat), el bilingüismo (documentación en español, código en inglés), las reglas de branching y merge `--no-ff` a `main`, el workflow obligatorio de OpenSpec (archive en la branch antes del merge, checklist post-archivado, `pnpm openspec:check` como gate) y la política web↔mobile de implementaciones paralelas con API idéntica.
## Requirements
### Requirement: La V3 debe sostenerse desde el repo, no desde contexto de chat

Grana V3 SHALL tratar al repositorio como la memoria principal del producto. La V3 no es una reescritura por si misma: es una reconstruccion cuyo objetivo es que la app sea funcionalmente explicita, tecnicamente confiable y documentada al nivel de que una conversacion nueva con un LLM pueda continuar el trabajo sin depender de contexto oculto.

Toda decision funcional o tecnica que afecte el comportamiento contable, financiero, de UX critica, de datos o de arquitectura SHALL quedar registrada en el lugar correspondiente del repo: specs, migraciones, `CLAUDE.md`, README, codigo y/o tests. Las decisiones importantes SHALL NOT quedar solamente en una conversacion, en memoria humana o implicitas dentro de una implementacion dificil de descubrir.

#### Scenario: Una regla contable nueva queda escrita antes o junto con el codigo

- **WHEN** un colaborador define una regla que afecta saldos, fechas, tarjetas, cuotas, monedas, categorias o reportes
- **THEN** la regla queda documentada en una spec o documento rector del repo
- **AND** la implementacion referencia o sigue esa regla de forma trazable

#### Scenario: Una conversacion nueva puede retomar el proyecto

- **WHEN** un LLM nuevo lee el repo sin acceso al historial de chat anterior
- **THEN** encuentra en `CLAUDE.md`, `openspec/specs/` y las migraciones las reglas necesarias para no inventar comportamiento
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

Este principio es complementario, no reemplazo, del principio "Bimoneda" listado en la tabla de cross-cutting principles del `CLAUDE.md` (que prohíbe convertir automáticamente entre ARS y USD). "Bimoneda por defecto" agrega: ARS+USD están habilitados por defecto para todos.

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

Cuando una change implementada se considera completa, su archivado SHALL ocurrir como último commit de la branch de trabajo, **antes** del merge `--no-ff` a `main`. El archivado NO se difiere a un commit posterior ni a un PR separado.

Archivado significa: mover la carpeta de `openspec/changes/<name>/` a `openspec/changes/archive/YYYY-MM-DD-<name>/`, aplicar los deltas (`## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`) al spec maestro de cada capability tocada en `openspec/specs/<capability>/spec.md`, completar el `Purpose` real del spec maestro reemplazando cualquier placeholder `TBD - created by archiving change ...`, y actualizar `CLAUDE.md` (secciones "Modules" y "Repo Layout") cuando corresponda.

Esta regla sostiene tres invariantes del proyecto:

- El último commit de trabajo de la branch SHALL ser atómico: en una sola commit aparecen el código, los specs maestros actualizados, los `Purpose` completados y los cambios consecuentes en `CLAUDE.md`. Ese commit es el que luego entra a `main` bajo su merge commit `--no-ff`.
- El estado de `main` SHALL cumplir que cada implementación tiene su spec maestro alineado.
- Cualquier feedback de PR que requiera ajustar el spec MUST aplicarse en la misma branch sin abrir un segundo PR de "archive housekeeping".

El gate de validación SHALL ser el comando `pnpm openspec:check`, que falla si encuentra `TBD - created by archiving` o `Purpose: TBD` dentro de `openspec/specs/`. Este comando MUST correrse antes de cualquier merge a `main` y MUST pasar.

#### Scenario: Branch lista para merge tiene la change archivada

- **WHEN** un colaborador termina la implementación de una change y se prepara para mergear su branch a `main`
- **THEN** la branch tiene como último commit de trabajo el archivado de la change (mover carpeta + aplicar deltas al spec maestro + completar `Purpose` + actualizar `CLAUDE.md` Modules y Repo Layout si corresponde)
- **AND** el merge a `main` se hace `--no-ff`, generando el merge commit sobre ese único commit de trabajo

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

### Requirement: Merge a main con un único commit de trabajo y merge commit (--no-ff)

Toda branch que se mergea a `main` SHALL contener exactamente un commit de trabajo por encima de `main` al momento del merge. El merge SHALL ejecutarse con `git merge --no-ff` (nunca `--ff-only`, nunca `--squash` en el comando de merge). `--no-ff` genera siempre un merge commit que agrupa la unidad de trabajo, marcando dónde empezó y terminó. Si `main` se movió mientras la branch estaba en progreso, el colaborador SHALL primero rebasear su branch sobre `main` (`git rebase main`) y después mergear con `--no-ff`. El resultado en `main` SHALL ser, por cada feature/fix/chore, un commit de trabajo más su merge commit. El mensaje del merge commit SHALL identificar la unidad de trabajo; un `Merge branch '...'` autogenerado que no la identifique NO es aceptable.

Esta regla aplica tanto a humanos como a LLMs colaborando autónomamente. La historia previa de `main` (incluidos los merges fast-forward anteriores a la adopción de esta regla) NO se reescribe — la regla aplica de acá en adelante.

#### Scenario: Branch con un solo commit + main no se movió

- **WHEN** un colaborador termina una branch que tiene 1 commit por encima de `main` y `main` no se movió desde que la branch arrancó
- **THEN** ejecuta `git checkout main && git merge --no-ff <branch>`
- **AND** el merge genera un merge commit con mensaje que identifica la unidad de trabajo
- **AND** `main` ahora contiene el commit de la feature más el merge commit

#### Scenario: Branch con múltiples commits se squashea antes del merge

- **WHEN** un colaborador termina una branch que tiene N commits por encima de `main` (con N > 1)
- **THEN** antes de mergear, squashea los N commits en uno solo localmente (vía `git rebase -i` con fixups, o `git reset --soft main && git commit`)
- **AND** después ejecuta `git merge --no-ff <branch>` desde `main`
- **AND** `main` recibe el único commit de trabajo más un merge commit

#### Scenario: main se movió mientras la branch estaba en progreso

- **WHEN** un colaborador termina su branch y descubre que `main` avanzó mientras tanto
- **THEN** primero rebasea su branch sobre `main` (`git checkout <branch> && git rebase main`), resolviendo conflictos si los hay
- **AND** después squashea a 1 commit de trabajo (si hay más de 1)
- **AND** después ejecuta `git merge --no-ff <branch>` desde `main`

#### Scenario: Intento de merge con --ff-only o --squash es violación

- **WHEN** un colaborador intenta mergear con `git merge --ff-only <branch>` o `git merge --squash <branch>`
- **THEN** la regla está violada
- **AND** el reviewer (humano o el propio LLM al releer su comando) debe abortar y rehacer con `--no-ff`

#### Scenario: LLM colaborando autónomamente respeta la regla

- **WHEN** un LLM autónomo necesita mergear una branch que generó
- **THEN** lee `CLAUDE.md` al inicio de la sesión y sigue el flow: squash si N > 1 → rebase si main se movió → `git merge --no-ff` con mensaje descriptivo
- **AND** nunca usa `--ff-only` ni `--squash` como comando de merge

