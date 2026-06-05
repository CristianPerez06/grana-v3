## MODIFIED Requirements

### Requirement: El usuario tiene un acceso rápido flotante para registrar un movimiento

En **web**, el sistema SHALL ofrecer un **acceso rápido flotante** (FAB) para registrar un movimiento, **visible solo en viewport `<sm` (mobile-web)** en el listado global de Movimientos y en el dashboard, de modo que el usuario pueda iniciar un alta sin scrollear de vuelta al header. El FAB SHALL **abrir el drawer de creación de movimiento** (mismo provider que el resto de entry points), sin navegación. En mobile-web el FAB **reemplaza** al botón "Nuevo movimiento" del header del dashboard (el botón no se renderiza en ese viewport, ver spec de `dashboard`); el FAB es el único acceso primario para registrar desde esas pantallas. En desktop-web (viewport `≥sm`) el FAB NO SHALL renderizarse: el acceso primario lo cumple el botón "Nuevo movimiento" del header del dashboard y los accesos propios de la pantalla `/transactions`.

El FAB web SHALL ser un cuadrado de 64×64 px con esquinas ligeramente redondeadas (`rounded-2xl`, ≈16 px), fondo verde semántico (`bg-success` / `text-success-foreground`, mapeado al token `--success` = emerald), anclado en `bottom-10 right-10` (40 px de cada borde) con `z-index` por encima del contenido scrolleable. El label accesible SHALL leerse del catálogo i18n (`transactions.actions.register_movement`), nunca hardcodeado.

Las pantallas que renderizan el FAB en mobile-web SHALL reservar padding inferior suficiente para que el FAB no tape la última fila de contenido al scrollear hasta el final (`pb-24 sm:pb-0` o equivalente).

Mientras el `MovementDrawerProvider` no esté disponible (las queries `accounts/categories/household` aún cargando o falladas), el FAB SHALL renderizarse en estado **disabled** (sin handler de click) usando el estado disabled estándar del componente `@/components/ui/button`, no SHALL navegar a ninguna ruta de fallback, y SHALL pasar a habilitado cuando el provider resuelve. El visual del estado disabled lo define el design system del `Button` (no se especifica una opacity literal a nivel spec).

#### Scenario: FAB visible en Movimientos y dashboard (mobile-web)

- **WHEN** el usuario autenticado abre `/transactions` o `/dashboard` en viewport `<sm`
- **THEN** ve un FAB cuadrado verde anclado en la esquina inferior derecha, visible aunque haya scrolleado la pantalla
- **AND** al activarlo se abre el drawer de creación de movimiento sobre la pantalla actual, sin navegación

#### Scenario: FAB no visible en desktop-web

- **WHEN** el usuario abre `/transactions` o `/dashboard` en viewport `≥sm`
- **THEN** el FAB NO se renderiza
- **AND** el acceso primario para registrar lo cumple el botón "Nuevo movimiento" del header del dashboard (en `/dashboard`) y los accesos propios de la pantalla en `/transactions`

#### Scenario: El FAB no aparece en otras pantallas web

- **WHEN** el usuario está en una pantalla web que no es Movimientos ni el dashboard (cualquier viewport)
- **THEN** el FAB no se muestra (los accesos de esa pantalla son los suyos propios)

#### Scenario: El contenido scrolleable reserva padding inferior para el FAB en mobile-web

- **WHEN** el usuario en viewport `<sm` scrollea hasta el final del contenido de `/dashboard` o `/transactions`
- **THEN** la última fila de contenido NO queda tapada por el FAB
- **AND** el padding inferior solo se aplica en mobile-web (en desktop el FAB no existe y el padding NO SHALL inflar la página innecesariamente)

#### Scenario: El FAB está disabled mientras el provider del drawer no está listo

- **WHEN** el usuario abre `/transactions` o `/dashboard` en viewport `<sm` durante el primer paint y `useMovementDrawer()` aún devuelve `null` porque las queries `accounts/categories/household` no resolvieron
- **THEN** el FAB se renderiza con el estado disabled estándar del componente `Button` (sin handler activo, visual atenuado por el design system)
- **AND** un tap sobre el FAB NO produce navegación ni abre el drawer
- **AND** cuando las queries resuelven y `useMovementDrawer()` retorna el opener, el FAB pasa a su rendering normal

### Requirement: El usuario puede registrar un movimiento desde el módulo global

El módulo global de Movimientos (`/transactions`) SHALL ofrecer el **punto de entrada único** para registrar un nuevo movimiento, de modo que el usuario no esté obligado a entrar primero a una cuenta para cargar un ingreso, gasto, transferencia, ajuste o cambio. El alta SHALL ocurrir **dentro del drawer de creación**, abierto vía `useMovementDrawer().openCreate(preselectedAccountId?)` desde cualquier entry point. **No existe una URL navegable para el alta** (no hay `/transactions/new` ni equivalente). La cuenta puede venir **pre-seleccionada** vía el argumento `preselectedAccountId` cuando el alta se lanza desde el detalle de una cuenta o de una tarjeta.

#### Scenario: Punto de entrada visible en el módulo global

- **WHEN** el usuario autenticado abre `/transactions`
- **THEN** ve una acción para registrar un nuevo movimiento (botón "Registrar movimiento" del header en desktop-web, FAB en mobile-web)
- **AND** al activarla se abre el drawer de creación sobre `/transactions` sin navegación

#### Scenario: La cuenta se elige dentro del formulario, después del tipo

- **WHEN** el usuario abre el drawer de creación desde el módulo global sin cuenta pre-seleccionada
- **THEN** el formulario muestra primero el selector de tipo (ingreso/gasto/transferencia/ajuste/cambio) y, debajo, la cuenta como un campo que se elige mientras se carga el movimiento (sin un paso previo de selección de cuenta)
- **AND** para gasto, el selector de cuenta incluye tarjetas de crédito; al elegir una, aparecen las cuotas (ARS) o la cotización (USD) inline
- **AND** para ingreso/transferencia/ajuste el selector ofrece solo cuentas de efectivo/banco

#### Scenario: Alta con cuenta pre-seleccionada

- **WHEN** el usuario activa un entry point desde el detalle de una cuenta o de una tarjeta
- **THEN** el call-site invoca `openCreate(<accountId>)` y el drawer se abre con el selector arrancando en esa cuenta
- **AND** si es una tarjeta de crédito, el formulario arranca en el tipo Gasto

#### Scenario: Al guardar se cierra el drawer y se refresca la ruta

- **WHEN** el usuario guarda un movimiento desde el drawer
- **THEN** el drawer se cierra
- **AND** el sistema dispara `router.refresh()` sobre la ruta actual (donde el usuario estaba antes de abrir el drawer)
- **AND** el nuevo movimiento aparece en el listado embedded de esa ruta (sea `/transactions`, `/accounts/[id]`, `/cards/[id]` o `/dashboard`)
- **AND** NO se navega a una ruta de destino derivada de `?from=` (el plumbing del lado de creación fue eliminado)

#### Scenario: El registro respeta las reglas de creación existentes

- **WHEN** el usuario registra un movimiento desde el drawer
- **THEN** se aplican las mismas validaciones de creación vigentes (moneda activa en la cuenta, monto válido, categoría obligatoria para ingreso/gasto, fecha contable)
- **AND** el movimiento creado aparece en el listado global

### Requirement: Las rutas de movimiento son canónicas bajo `/transactions`

Cada movimiento SHALL tener URLs canónicas bajo `/transactions` para su **detalle** y su **edición**: el detalle en `/transactions/<id>` y la edición en `/transactions/<id>/edit`. **El alta NO tiene URL canónica** — vive exclusivamente en el drawer (ver requirement "El usuario puede registrar un movimiento desde el módulo global"). El árbol scoped por cuenta `/accounts/<id>/transactions/*` (alta, detalle, edición) NO SHALL existir.

El contexto de cuenta SHALL transmitirse, para el detalle y la edición, por query param: `?from=<origen>` determina la navegación de retorno y la perspectiva de la pantalla. Los accesos desde el listado de cuenta y de tarjeta al detalle (filas) SHALL apuntar a la ruta canónica con ese param. Los CTAs de alta desde detalle de cuenta o tarjeta SHALL invocar el drawer con la cuenta pre-seleccionada (`openCreate(<accountId>)`); NO SHALL navegar a una URL.

#### Scenario: Una sola URL por movimiento

- **WHEN** el usuario abre un movimiento desde el listado global o desde la lista de una cuenta
- **THEN** llega a `/transactions/<id>`, la misma URL en ambos casos
- **AND** el `?from=` ajusta sólo el back-nav del detalle (al listado global, a la cuenta o a la tarjeta de origen)

#### Scenario: Alta pre-seleccionando una cuenta desde el detalle de una cuenta o tarjeta

- **WHEN** el usuario toca "registrar" desde el detalle de una cuenta o "registrar consumo" desde una tarjeta
- **THEN** el call-site llama `useMovementDrawer().openCreate(<accountId>)`
- **AND** el drawer se abre sobre la pantalla actual con esa cuenta ya elegida en el selector
- **AND** si la cuenta es una tarjeta de crédito, el formulario arranca en el tipo Gasto
- **AND** al guardar se cierra el drawer y la pantalla actual (cuenta o tarjeta) refresca con el nuevo movimiento

#### Scenario: Las rutas scoped ya no existen

- **WHEN** se intenta acceder a `/accounts/<id>/transactions/...`
- **THEN** la ruta no existe (404); el árbol fue eliminado y los enlaces internos apuntan a las rutas canónicas

#### Scenario: La URL `/transactions/new` no existe

- **WHEN** se intenta acceder a `/transactions/new` (con o sin query params)
- **THEN** la ruta no existe (404)
- **AND** ningún enlace interno del producto la genera

### Requirement: El encabezado de Movimientos es minimalista y pelado

El sistema SHALL renderizar el encabezado de `/transactions` como un `PageHeader` clásico **completamente pelado**: SOLO un título corto "Movimientos" (h1, 24px font-semibold). Sin subtítulo, sin actions slot, sin display de mes, sin links contextuales.

El encabezado **NO SHALL** llevar:
- Display tipográfico grande del mes activo.
- Botones de navegación `‹ ›` para el mes.
- Subtítulo informativo con conteo y monedas.
- Botones primary CTA "Recurrencias" o "Registrar movimiento" a la derecha.
- Link contextual a Recurrencias en el slot de actions o el subtítulo.

Razón: las acciones del listado (buscar, ver recurrencias, filtrar) viven en una **micro-toolbar pegada al listado** especificada en el próximo requirement, donde tienen contexto inmediato con la lista sobre la que operan. El único selector de mes vive dentro del card del `CategorySpendingOverview`. El acceso para registrar **en mobile-web** pasa por el FAB definido más abajo en esta spec. **En desktop-web** el FAB NO se renderiza y el encabezado pelado tampoco ofrece CTA: el acceso primario para registrar desde desktop-web se cumple desde el header del dashboard (botón "Nuevo movimiento", spec de `dashboard`) o desde el `RegisterMovementButton` que vive en el `TransactionsHeader` propio de la pantalla; restaurar un CTA en este encabezado pelado para desktop-web es follow-up explícito fuera de alcance de esta spec.

#### Scenario: El encabezado muestra solo el título

- **WHEN** el usuario abre `/transactions`
- **THEN** el encabezado muestra "Movimientos" como h1 (~24px font-semibold)
- **AND** NO aparece debajo ningún subtítulo, link, ni botón

#### Scenario: El encabezado no duplica la navegación por mes

- **WHEN** el sistema renderiza el encabezado de `/transactions`
- **THEN** no aparece ningún display grande del mes ni botones `‹ ›` para navegar mes
- **AND** la navegación por mes única vive dentro del card del breakdown

#### Scenario: En desktop-web el encabezado pelado no ofrece acceso para registrar (gap conocido)

- **WHEN** un usuario web en viewport `≥sm` abre `/transactions`
- **THEN** el encabezado pelado NO contiene CTA de registrar
- **AND** el FAB tampoco se renderiza en ese viewport
- **AND** el acceso para registrar en ese viewport se cumple desde el header del dashboard o desde el `RegisterMovementButton` propio de la pantalla
- **AND** restaurar un CTA en este encabezado pelado para desktop-web es follow-up explícito fuera de alcance

### Requirement: El header de /transactions permanece visible durante carga y error del contenido

`apps/web` SHALL renderizar el header de `/transactions` (título + acceso primario para registrar un movimiento) desde el primer paint, sin estar tapado por un fallback de pantalla completa del layout group. Mientras las queries de la ruta están resolviendo o fallan, el chrome (header + estructura general) SHALL permanecer visible y operable.

La acción primaria del header (`RegisterMovementButton`) SHALL estar deshabilitada (botón disabled, no clickeable, sin envolver `<Link>` ni equivalente navegable) hasta que el `MovementDrawerProvider` esté disponible — i.e. hasta que las queries `accounts`, `categories` y `household` cargadas por `MovementDrawerLoader` resuelvan. Cuando el provider está listo, el botón SHALL habilitarse y al click SHALL invocar `useMovementDrawer().openCreate()`.

Si alguna de esas tres queries falla (no resuelve), el botón MAY habilitarse igual con un modo degradado: el click SHALL mostrar feedback al usuario indicando que el formulario no se pudo cargar y SHALL ofrecer una acción de reintentar. NO SHALL quedar el botón disabled indefinidamente impidiendo al usuario reintentar.

#### Scenario: Header visible mientras el contenido carga

- **WHEN** el usuario navega a `/transactions` y las queries de las secciones aún están pendientes
- **THEN** el header con el título "Movimientos" y el botón "Registrar movimiento" ya está visible
- **AND** el botón "Registrar movimiento" está visualmente disabled (no clickeable)
- **AND** cada sección debajo del header muestra su propio estado de carga in-place (no un fallback de pantalla completa)

#### Scenario: El botón se habilita cuando el drawer está listo

- **WHEN** las queries de `accounts`, `categories` y `household` resolvieron correctamente
- **THEN** el botón "Registrar movimiento" se habilita
- **AND** clickearlo abre el drawer de creación de movimiento

#### Scenario: El botón no cae a un link mientras está disabled

- **WHEN** el botón "Registrar movimiento" está en su estado disabled (provider no disponible)
- **THEN** el botón se renderiza sin envolver un `<Link>` ni redirigir a ninguna URL al click
- **AND** un click sobre el botón disabled no produce navegación

### Requirement: El alta y edición de movimientos se presenta como drawer lateral en desktop

El sistema SHALL presentar el formulario de **alta y edición** de movimientos en un drawer lateral derecho que se desliza sobre el contenido actual, sin perder el contexto. El drawer SHALL abrirse en modo **creación** desde todos los entry points del producto (FAB mobile-web, `RegisterMovementButton` del header de `/transactions`, botón "Nuevo movimiento" del header del dashboard en desktop-web, CTA "+ Agregar transacción" del detalle de cuenta, CTA equivalente del detalle de tarjeta y del header de tarjeta, empty state del listado global). El modo edición NO SHALL abrirse desde la fila del listado: el click en una fila navega a la página de **detalle** del movimiento (donde viven reintegros/cuotas), y es el botón "Editar" de ese detalle el que abre el drawer en modo edición. La ruta `/transactions/[txId]/edit` SHALL seguir resolviendo y renderizando el mismo formulario para deep-link y clientes sin JS. **No existe equivalente para el alta** — el alta solo vive en el drawer.

El drawer SHALL tener header fijo, body scrolleable y footer fijo. Al abrir en modo creación, el campo de monto SHALL recibir el foco automáticamente una vez completada la animación de entrada.

La lógica del formulario (estado, validaciones, mutators) SHALL ser la misma para creación y edición — el drawer es una capa de presentación, no una reimplementación. **Solo** la ruta `/transactions/[txId]/edit` (edición) resuelve y renderiza el formulario fuera del drawer; el alta no tiene equivalente.

#### Scenario: Abrir el drawer de alta desde el listado

- **WHEN** el usuario, en `/transactions`, activa el FAB de alta o el botón "Registrar movimiento"
- **THEN** el drawer entra desde la derecha sobre el listado
- **AND** el listado permanece visible detrás del scrim
- **AND** el campo de monto toma el foco al terminar la animación

#### Scenario: Abrir el drawer de alta desde otras pantallas

- **WHEN** el usuario activa el botón "Nuevo movimiento" del header del dashboard, el CTA "+ Agregar transacción" del detalle de cuenta, o el CTA equivalente del detalle/header de tarjeta
- **THEN** el drawer entra desde la derecha sobre la pantalla actual, sin navegación
- **AND** la pantalla actual permanece visible detrás del scrim
- **AND** cuando el call-site lo invoca con una cuenta pre-seleccionada, el drawer arranca con esa cuenta elegida

#### Scenario: Abrir el drawer de edición desde el detalle

- **WHEN** el usuario hace click en una fila del listado de movimientos
- **THEN** navega a la página de detalle de ese movimiento (no al drawer de edición)
- **WHEN** en el detalle activa el botón "Editar"
- **THEN** el drawer abre en modo edición precargado con los datos reales de ese movimiento

#### Scenario: La ruta de edición sigue funcionando

- **WHEN** el usuario navega directamente a `/transactions/[txId]/edit`
- **THEN** el formulario se renderiza (en página) con la misma lógica que el drawer

## ADDED Requirements

### Requirement: El loader del drawer de movimiento se monta a nivel app-shell

El sistema SHALL montar `<MovementDrawerLoader>` adentro del `<AppShell>` envolviendo el slot `{children}` de las rutas autenticadas `(app)`. El loader SHALL cargar `accounts`, `categories` y `household` vía TanStack Query, deduplicadas con los demás consumers vía `QUERY_KEYS`, y SHALL montar `<MovementDrawerProvider>` cuando las tres queries resuelven; mientras tanto SHALL renderizar `children` sin el provider (los consumers de `useMovementDrawer()` reciben `null` y los CTAs aplican su convención de cold-load).

Mountar el loader a este nivel SHALL hacer al drawer accesible desde cualquier ruta `(app)` (dashboard, accounts, cards, transactions, settings, shared, etc.), no solo desde `/transactions/*`. Sidebar, top-bar mobile y el menú-drawer mobile SHALL permanecer como peers del slot `{children}` dentro de `AppShell`, **fuera** del wrap del `MovementDrawerLoader`: la chrome no SHALL consumir el provider y NO SHALL ofrecer CTAs de alta de movimiento.

El loader NO SHALL re-mountar al cambiar de ruta dentro de `(app)`: como vive en `AppShell` (un componente client persistente del layout group), las queries cargadas se mantienen en cache de TanStack entre navegaciones.

#### Scenario: El drawer está disponible desde el dashboard

- **WHEN** el usuario autenticado abre `/dashboard` y clickea "Nuevo movimiento" en el header desktop una vez habilitado
- **THEN** el drawer de creación se abre sobre el dashboard sin navegación
- **AND** las queries `accounts/categories/household` ya están en cache de TanStack (cargadas por el loader al primer paint)

#### Scenario: El drawer está disponible desde account detail

- **WHEN** el usuario abre `/accounts/<id>` y activa el CTA "+ Agregar transacción"
- **THEN** el call-site invoca `openCreate(<id>)` y el drawer se abre sobre el detalle de la cuenta con esa cuenta pre-seleccionada
- **AND** no se navega a otra ruta

#### Scenario: El drawer está disponible desde card detail

- **WHEN** el usuario abre `/cards/<cardId>` y activa el CTA de alta del header de la tarjeta o del detalle
- **THEN** el call-site invoca `openCreate(<cardId>)` y el drawer se abre sobre el detalle de la tarjeta con esa tarjeta pre-seleccionada y el tipo Gasto activo
- **AND** no se navega a otra ruta

#### Scenario: La chrome no tiene acceso al drawer

- **WHEN** el sistema renderiza `AppShell` en cualquier ruta `(app)`
- **THEN** Sidebar, TopBarMobile y el menú-drawer mobile NO SHALL renderizar CTAs de alta de movimiento ni invocar `useMovementDrawer()`
- **AND** consumir `useMovementDrawer()` desde un componente de chrome retornaría `null` (la chrome está fuera del wrap del provider)

#### Scenario: Las queries del loader se disparan en cualquier ruta autenticada

- **WHEN** el usuario hace un cold-load de cualquier ruta `(app)` (ej. `/settings`)
- **THEN** las queries `accounts`, `categories` y `household` se disparan al primer paint del layout
- **AND** se deduplican con cualquier otro consumer de los mismos `QUERY_KEYS` (ej. `TransactionsHeader` en `/transactions`)

#### Scenario: El loader no re-monta al cambiar de ruta

- **WHEN** el usuario navega entre `/dashboard`, `/accounts`, `/transactions` y otras rutas `(app)` dentro de la misma sesión
- **THEN** `MovementDrawerLoader` no se re-monta (vive en `AppShell`, persistente en el layout group)
- **AND** las queries `accounts/categories/household` no se re-disparan (cache de TanStack las sirve)

#### Scenario: Modo degradado cuando las queries del loader fallan

- **WHEN** alguna de las queries `accounts`, `categories` o `household` falla y no resuelve
- **THEN** `MovementDrawerProvider` no se monta y `useMovementDrawer()` retorna `null`
- **AND** los CTAs de alta a lo largo del producto SHALL mostrar feedback de error con acción de reintentar (no quedar disabled indefinidamente)
