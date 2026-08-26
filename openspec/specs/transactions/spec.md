# transactions Specification

## Purpose

Define el módulo de movimientos de Grana: registro de ingresos y gastos en cuentas `cash` y `bank`, transferencias entre cuentas, cambios de moneda (exchange), ajustes manuales, y manejo de recurrencias (plantillas e instancias generadas) bajo un contrato funcional unificado de Movimiento. Deriva el saldo disponible respetando los invariantes contables del proyecto (saldo negativo permitido con aviso no bloqueante, off-ledger credit cards, deterministic ordering ASC para cálculo / DESC para display, `Money` + `decimal.js`). Expone también el módulo global de Movimientos con búsqueda, filtros y destacado de ítems que requieren revisión. Los consumos y cuotas de tarjeta de crédito viven en `cards`.
## Requirements
### Requirement: El usuario puede registrar un ingreso en una cuenta

El sistema SHALL permitir registrar un ingreso (plata que entra) en una cuenta de tipo `cash` o `bank`. El ingreso requiere: cuenta, moneda activa en esa cuenta, monto mayor a cero, fecha y categoría. La descripción y subcategoría son opcionales.

#### Scenario: Ingreso creado correctamente

- **WHEN** el usuario completa el formulario con cuenta, moneda, monto > 0 y fecha válida y confirma
- **THEN** el sistema inserta una fila en `transactions` con `type='income'`, `amount > 0`, y el saldo de la cuenta aumenta en ese monto para la moneda indicada

#### Scenario: Monto cero o negativo es rechazado

- **WHEN** el usuario ingresa un monto ≤ 0
- **THEN** el sistema muestra un error de validación y no inserta la transacción

#### Scenario: Moneda no habilitada en la cuenta es rechazada

- **WHEN** el usuario intenta registrar un ingreso en una moneda que no tiene una `account_currencies` activa en la cuenta seleccionada
- **THEN** el sistema retorna un error y no inserta la transacción

#### Scenario: Ingreso sin categoría es rechazado

- **WHEN** el usuario intenta crear un ingreso sin seleccionar categoría
- **THEN** el sistema muestra un error de validación y no inserta la transacción

#### Scenario: Ingreso con fecha en el pasado

- **WHEN** el usuario ingresa una fecha anterior a hoy
- **THEN** el sistema acepta la transacción con esa fecha histórica (el backdating es válido)

---

### Requirement: El usuario puede registrar un gasto en una cuenta

El sistema SHALL permitir registrar un gasto (plata que sale) en una cuenta. Para `type='cash'` o `type='bank'`, el gasto requiere: cuenta, moneda activa, monto mayor a cero, fecha y categoría; la subcategoría y descripción son opcionales; el sistema persiste con `status=NULL` (no aplica) e impacta saldo según el corte temporal del requirement "El saldo de la cuenta refleja las transacciones en tiempo real": inmediatamente si `date <= hoy_AR`, y recién cuando la fecha llegue si `date > hoy_AR`. Para `type='credit'` (tarjeta), el gasto sigue el requirement específico de consumos en tarjeta (con `status='pending'`, `card_period_id`, eventualmente cuotas, y SIN impacto al saldo disponible) — ver requirement separado.

#### Scenario: Gasto en cash creado correctamente

- **WHEN** el usuario completa el formulario con cuenta cash, moneda, monto > 0, fecha de hoy y categoría válidos y confirma
- **THEN** el sistema inserta una fila en `transactions` con `type='expense'`, `status=NULL`, `amount > 0`, y el saldo de la cuenta disminuye en ese monto para la moneda indicada

#### Scenario: Gasto con fecha futura se persiste pero no descuenta saldo todavía

- **WHEN** el usuario registra un gasto con `date` posterior a la fecha financiera AR de hoy
- **THEN** el sistema inserta la fila en `transactions` con `type='expense'`, `status=NULL`
- **AND** el saldo de la cuenta no cambia hasta que `date` llegue

#### Scenario: Gasto sin categoría es rechazado

- **WHEN** el usuario intenta crear un gasto sin seleccionar categoría
- **THEN** el sistema muestra un error de validación y no inserta la transacción

#### Scenario: Subcategoría pertenece a la categoría seleccionada

- **WHEN** el usuario selecciona una subcategoría que no pertenece a la categoría elegida
- **THEN** el sistema rechaza el input con error de validación

#### Scenario: Gasto en cuenta credit (tarjeta) se dispatcha al requirement específico

- **WHEN** el usuario selecciona una cuenta `type='credit'` al registrar un gasto
- **THEN** la operación se rige por el requirement "El usuario puede registrar un consumo en una tarjeta de crédito"
- **AND** el saldo de la tarjeta y de cuentas cash/bank no cambia
---

### Requirement: El saldo de la cuenta refleja las transacciones en tiempo real

El sistema SHALL calcular el saldo de cada cuenta como `initial_balance + Σ income − Σ expense − Σ transfer saliente + Σ transfer entrante + Σ adjustment` en la moneda correspondiente, considerando únicamente transacciones con `date <= hoy_AR` (la fecha calendario en `America/Argentina/Buenos_Aires`, el mismo "hoy" que `getTodayAR()`). Una transacción con fecha futura NO SHALL aportar al saldo hasta que su fecha llegue; ese día entra automáticamente. No existe columna de saldo cacheada.

El **saldo corriente** por fila del listado de movimientos (running balance) NO cambia con este corte: sigue siendo la proyección cronológica "saldo después de este movimiento" en orden `date ASC, created_at ASC, id ASC`, de modo que una fila futura muestra el saldo proyectado a su fecha. Por construcción, cuando existen movimientos futuros el saldo del header de la cuenta (corte a hoy) puede diferir del saldo corriente de la fila más reciente (proyección).

#### Scenario: Saldo después de crear un ingreso

- **WHEN** el usuario crea un ingreso de $100 ARS con fecha de hoy en una cuenta con `initial_balance_ars = 500`
- **THEN** la pantalla de detalle de esa cuenta muestra saldo ARS = $600

#### Scenario: Saldo después de crear un gasto

- **WHEN** el usuario crea un gasto de $200 ARS con fecha de hoy en una cuenta con `initial_balance_ars = 500` y sin transacciones previas
- **THEN** la pantalla de detalle muestra saldo ARS = $300

#### Scenario: Saldo después de crear una transferencia saliente

- **WHEN** el usuario crea una transferencia de `$150 ARS` con fecha de hoy desde la cuenta A (saldo $500) hacia la cuenta B (saldo $0)
- **THEN** la pantalla de detalle de A muestra saldo ARS = `$350` y la de B muestra saldo ARS = `$150`

#### Scenario: Saldo después de crear un ajuste

- **WHEN** el usuario crea un ajuste de `+$30 ARS` con fecha de hoy en una cuenta con saldo de `$500`
- **THEN** la pantalla de detalle muestra saldo ARS = `$530`

#### Scenario: Saldo puede ser negativo

- **WHEN** los gastos acumulados superan el `initial_balance` de una moneda
- **THEN** el sistema muestra el saldo negativo (no lo clampea a cero)

#### Scenario: ARS y USD se calculan por separado

- **WHEN** la cuenta tiene transacciones en ARS y en USD
- **THEN** el sistema muestra saldos independientes por moneda; nunca los convierte ni combina

#### Scenario: Un movimiento futuro no altera el saldo de hoy

- **WHEN** hoy es `2026-07-31` y existe un gasto de `$200 ARS` con `date = 2026-08-05` en una cuenta con saldo `$500`
- **THEN** el saldo mostrado (header de cuenta, Hero/Disponible, "Dónde está") sigue siendo `$500`
- **AND** la fila futura del listado muestra su saldo corriente proyectado (`$300`)
---

### Requirement: El usuario puede ver la lista de transacciones de una cuenta

El sistema SHALL mostrar la lista de transacciones de una cuenta ordenada por fecha descendente (más reciente primero), luego por `created_at` descendente. La lista es parte de la pantalla de detalle de la cuenta. La lista incluye las transacciones donde `account_id = currentAccount` así como las transferencias entrantes donde `transfer_destination_account_id = currentAccount`.

#### Scenario: Lista muestra ingresos, gastos, transferencias y ajustes

- **WHEN** el usuario abre el detalle de una cuenta con transacciones de los cuatro tipos
- **THEN** el sistema muestra todas las transacciones con fecha, descripción, monto y tipo diferenciado visualmente (ingreso, gasto, transferencia con flecha, ajuste con ícono propio)

#### Scenario: Estado vacío

- **WHEN** la cuenta no tiene transacciones
- **THEN** el sistema muestra el mensaje vacío con CTA para agregar la primera transacción

#### Scenario: La lista está paginada

- **WHEN** la cuenta tiene más de 20 transacciones
- **THEN** el sistema muestra las 20 más recientes con opción de cargar más

#### Scenario: La lista incluye transferencias entrantes

- **WHEN** la cuenta B es destino de una transferencia desde A
- **THEN** la lista de movimientos de B incluye esa transferencia con signo positivo y la etiqueta "← A"

---

### Requirement: El usuario puede ver un módulo global de movimientos

El sistema SHALL renderizar una pantalla global `/transactions` accesible desde la navegación principal bajo el nombre "Movimientos". Esta pantalla SHALL mostrar todos los movimientos financieros del usuario en un único listado cronológico, independientemente de la cuenta, tarjeta o flujo que los haya originado.

Un "movimiento" no es solamente una fila técnica de `transactions`: es la representación funcional de un hecho financiero visible para el usuario. El sistema SHALL mapear las filas técnicas necesarias a una variante funcional de movimiento antes de renderizarlas.

#### Scenario: El usuario accede al módulo desde la navegación

- **WHEN** el usuario autenticado abre la navegación principal
- **THEN** ve una opción "Movimientos"
- **AND** al seleccionarla navega a `/transactions`

#### Scenario: Volver desde un detalle respeta el origen global

- **WHEN** el usuario abre un movimiento desde `/transactions`
- **THEN** el detalle conserva ese origen de navegación
- **AND** la acción de volver lo devuelve a `/transactions`, no al detalle de la cuenta ni al resumen de tarjeta

#### Scenario: El listado global abre detalles globales

- **WHEN** el usuario toca un ingreso, gasto, transferencia, ajuste, pago de resumen o compra en cuotas desde `/transactions`
- **THEN** el sistema navega a `/transactions/<transaction_id>`
- **AND** el detalle muestra el hecho financiero con lenguaje funcional según el tipo de movimiento
- **AND** no redirige automáticamente al detalle técnico de una cuenta o resumen

#### Scenario: La pantalla muestra movimientos de todas las cuentas

- **WHEN** el usuario abre `/transactions`
- **THEN** el sistema muestra movimientos de cuentas cash, bank y credit según las reglas funcionales vigentes
- **AND** no limita el listado a una cuenta específica

#### Scenario: El listado está ordenado para lectura del usuario

- **WHEN** el sistema renderiza el listado global de movimientos
- **THEN** muestra primero el movimiento con fecha más reciente
- **AND** si dos movimientos tienen la misma fecha, muestra primero el creado más tarde

---

### Requirement: El listado global está paginado

El sistema SHALL paginar el listado global con un tamaño inicial de página y una acción para cargar más movimientos. El estado de paginación (`limit`) vive en React state, no en la URL.

#### Scenario: El usuario carga más movimientos

- **WHEN** el usuario abre `/transactions` y existen más movimientos que el tamaño inicial de página
- **THEN** el sistema muestra los movimientos más recientes primero
- **AND** ofrece una acción para cargar más movimientos
- **AND** los movimientos adicionales respetan el mismo orden funcional del listado global
- **AND** la acción "cargar más" incrementa el `limit` en el estado interno y reconsulta la sección de movimientos sin afectar otros filtros activos

---

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

### Requirement: El listado global distingue el motivo de un resultado vacío

Cuando el listado global de Movimientos no tiene resultados, el sistema SHALL mostrar un estado vacío acorde al **motivo**, no un único mensaje genérico. SHALL distinguir tres variantes:

- **Sin movimientos** (no hay búsqueda ni filtros de contenido activos): el contenido del estado SHALL ser **contextual al estado del usuario**:
  - Si el usuario nunca registró movimientos en ningún mes (primera vez) → mensaje de bienvenida ("Acá va a aparecer cada peso que se mueva") y acción para registrar el primer movimiento.
  - Si el usuario tiene movimientos en otros meses pero solo navegó a un mes vacío → mensaje contextual al mes ("No registraste nada en {mes} todavía") y la misma acción de registrar, sin el tono de bienvenida.
- **Sin resultados de búsqueda** (hay un término de búsqueda activo): un mensaje que indica que no se encontraron coincidencias y una acción para **limpiar la búsqueda**.
- **Sin resultados de filtro** (hay filtros de contenido activos — tipo, categoría, cuenta, moneda o rango de monto): un mensaje que indica que ningún movimiento cumple los filtros y una acción para **limpiar los filtros**.

La **navegación por mes** NO cuenta como filtro de contenido para esta clasificación (es una ventana temporal, no un filtro): un mes sin movimientos y sin otros filtros SHALL mostrar la variante "sin movimientos" en la sub-variante contextual del mes. El resto —tipo, categoría, cuenta, moneda y rango de monto— SÍ cuenta como filtro. Cuando coexisten búsqueda y filtros, prevalece la variante de **filtro**. Las acciones de limpiar SHALL operar sobre el **estado interno de filtros** (React state, no URL), coherente con la barra de filtros.

#### Scenario: Primera vez del usuario muestra bienvenida

- **WHEN** el usuario abre `/transactions` por primera vez (sin ningún movimiento registrado en ningún mes) sin búsqueda ni filtros activos
- **THEN** el sistema muestra un estado de bienvenida con copy "Acá va a aparecer cada peso que se mueva"
- **AND** la acción abre el drawer de alta de movimiento (o `/transactions/new` como fallback)

#### Scenario: Mes vacío con historial previo muestra copy contextual

- **WHEN** el usuario tiene movimientos registrados en otros meses pero navegó a un mes vacío y no tiene filtros activos
- **THEN** el sistema muestra copy contextual "No registraste nada en {mes} todavía"
- **AND** la acción abre el drawer de alta de movimiento
- **AND** la copy NO tiene tono de bienvenida (no es la primera vez)

#### Scenario: Búsqueda sin resultados ofrece limpiar la búsqueda

- **WHEN** el usuario tiene un término de búsqueda activo y ninguno de sus movimientos coincide
- **THEN** el sistema indica que no se encontraron resultados para ese término
- **AND** ofrece una acción para limpiar la búsqueda
- **AND** la acción de limpiar opera sobre el estado interno

#### Scenario: Filtros sin resultados ofrecen limpiar los filtros

- **WHEN** el usuario tiene filtros de contenido activos (tipo, categoría, cuenta, moneda o rango de monto) y ningún movimiento los cumple
- **THEN** el sistema indica que ningún movimiento cumple los filtros
- **AND** ofrece una acción para limpiar los filtros
- **AND** la acción de limpiar opera sobre el estado interno

#### Scenario: Un mes vacío no se confunde con un filtro sin resultados

- **WHEN** el usuario navega a un mes sin movimientos y no tiene filtros de contenido activos
- **THEN** el sistema muestra la variante "sin movimientos" en su sub-variante contextual del mes (no la de filtros)

---

### Requirement: El listado global usa un contrato funcional de Movimiento

El sistema SHALL definir un contrato funcional `Movimiento` para la UI global de movimientos. Este contrato SHALL ser una unión discriminada de variantes funcionales, no una exposición directa de la tabla `transactions`.

El contrato inicial SHALL cubrir al menos estas variantes: ingreso, gasto, transferencia, ajuste, cuota de tarjeta y pago de resumen. Cada variante SHALL declarar explícitamente los campos que la UI necesita para mostrar fecha, monto, moneda, descripción, cuenta relacionada, categoría cuando aplique, y datos específicos del tipo.

#### Scenario: Una fila técnica se transforma antes de llegar a la UI

- **WHEN** la query global obtiene filas desde `transactions`
- **THEN** el sistema las transforma a `Movimiento[]` mediante un mapper puro
- **AND** la UI renderiza sobre `Movimiento`, no sobre filas crudas de base de datos

#### Scenario: Una transferencia se muestra como hecho financiero único

- **WHEN** existe una transacción `type='transfer'`
- **THEN** el listado global muestra un solo movimiento de tipo transferencia
- **AND** muestra cuenta origen, cuenta destino, monto y moneda

#### Scenario: Un pago de resumen no se muestra como gasto común

- **WHEN** existe una transacción `type='expense'` asociada a `period_payments.transaction_id`
- **THEN** el listado global la muestra como movimiento funcional "Pago de resumen"
- **AND** no la titula como "Gasto"
- **AND** no la marca como "Sin categoría" aunque `category_id` sea `NULL`

#### Scenario: Un ajuste conserva su signo funcional

- **WHEN** existe una transacción `type='adjustment'` con monto positivo o negativo
- **THEN** el movimiento de tipo ajuste muestra si suma o resta saldo
- **AND** no se normaliza visualmente como monto siempre positivo

#### Scenario: Una compra en cuotas no duplica información en el listado global

- **WHEN** existe una compra en cuotas con transacción madre e hijas
- **THEN** el listado global SHALL mostrar una única representación funcional de la compra en la fecha de la transacción madre
- **AND** las cuotas hijas SHALL NOT aparecer como movimientos independientes en el listado global por defecto
- **AND** las cuotas hijas MAY aparecer solamente en vistas específicas de período/resumen o cuando el usuario filtre explícitamente por cuotas

#### Scenario: Una compra en cuotas del listado global abre su detalle

- **WHEN** el usuario toca una compra en cuotas desde `/transactions`
- **THEN** el sistema navega al detalle global `/transactions/<parent_id>`
- **AND** el detalle muestra la compra madre y sus cuotas hijas
- **AND** la acción de volver regresa a `/transactions`

---

### Requirement: El módulo global de movimientos permite búsqueda y filtros

El sistema SHALL permitir filtrar el listado global de movimientos por texto, tipo de movimiento, categoría, cuenta, **moneda** y **rango de monto**, y navegar el período **por mes**. Los filtros SHALL vivir en el state interno del cliente (React state via context), no en la URL.

La URL canónica de `/transactions` SHALL ser `/transactions` sin query params. La ruta NO SHALL ser deep-linkeable con un filtro pre-aplicado en esta iteración (ver requirement separado sobre estado en React state). Recargar la página resetea los filtros al default.

La UI de filtros SHALL ser una **barra compacta** (búsqueda + navegación por mes + botón "Filtros" con un contador de filtros activos); los filtros detallados (tipo, categoría, cuenta, moneda, rango de monto) SHALL vivir en un **panel desplegable**, y los filtros activos SHALL mostrarse como **chips removibles** bajo la barra, junto con una acción "Limpiar todo". La búsqueda SHALL ser **instantánea** (sin botón de aplicar, con un breve debounce) y SHALL buscar en **todo el historial** del usuario, no solo en los movimientos ya paginados.

El período SHALL navegarse **por mes** (mes anterior / mes siguiente) como control primario; por defecto SHALL mostrarse el **mes actual** (computado en la zona horaria financiera con `getTodayAR()`), conservando una opción de rango personalizado que tiene prioridad sobre el mes. El filtro por cuenta SHALL mostrarse únicamente cuando el usuario tiene **dos o más cuentas**; con una sola cuenta no se ofrece.

#### Scenario: Buscar por descripción de forma instantánea

- **WHEN** el usuario tipea en la búsqueda
- **THEN** el sistema filtra (con un breve debounce) los movimientos cuya descripción o texto visible coincida, sin requerir un botón de aplicar
- **AND** la coincidencia se busca en todo el historial, no solo en la página actual
- **AND** el término de búsqueda vive en React state (el componente lo lee del context de filtros)

#### Scenario: Navegación por mes como período por defecto

- **WHEN** el usuario abre `/transactions`
- **THEN** el sistema muestra los movimientos del mes actual (según `getTodayAR()`)
- **AND** el usuario puede navegar al mes anterior o siguiente con las flechas
- **AND** interpreta las fechas como fecha contable, no como timestamp UTC
- **AND** el cambio de mes muta el estado interno; la URL no cambia

#### Scenario: Rango personalizado

- **WHEN** el usuario define un rango de fechas personalizado
- **THEN** el sistema muestra los movimientos de ese rango
- **AND** el rango personalizado tiene prioridad sobre el mes seleccionado

#### Scenario: Filtrar por moneda

- **WHEN** el usuario filtra por ARS o por USD
- **THEN** el sistema muestra solo los movimientos de esa moneda
- **AND** nunca combina ni convierte montos de monedas distintas

#### Scenario: Filtrar por cuenta cuando hay dos o más cuentas

- **WHEN** un usuario con dos o más cuentas filtra por una cuenta específica
- **THEN** el sistema muestra movimientos donde esa cuenta participa como origen, destino, cuenta de pago o tarjeta relacionada según el tipo funcional del movimiento
- **AND** un usuario con una sola cuenta no ve el filtro por cuenta

#### Scenario: Filtros activos como chips removibles

- **WHEN** hay uno o más filtros aplicados
- **THEN** el sistema los muestra como chips removibles bajo la barra y un contador en el botón "Filtros"
- **AND** quitar un chip elimina ese filtro del estado interno y reconsulta la sección de movimientos
- **AND** la URL no se modifica

---

### Requirement: El módulo global de movimientos destaca movimientos que requieren revisión

El sistema SHALL poder marcar movimientos con estados de revisión funcionales cuando detecta que podrían requerir atención del usuario. Estos estados no cambian el impacto contable del movimiento: solamente ayudan a priorizar revisión, corrección o categorización.

Un movimiento MAY requerir revisión por motivos como: falta de categoría, monto inusualmente alto, posible duplicado, datos incompletos, ajuste frecuente o inconsistencia funcional detectada. La **cotización faltante NO es un motivo de revisión**: un consumo USD en tarjeta sin cotización es el estado normal (la conversión ocurre al pagar el resumen, con la cotización del día de pago — ver capability `cards`).

#### Scenario: Movimiento sin categoría requiere revisión

- **WHEN** existe un movimiento de tipo gasto o ingreso que debería tener categoría pero no la tiene
- **THEN** el listado global puede mostrarlo como "Sin categoría"
- **AND** puede incluirlo en un filtro de revisión

#### Scenario: Posible duplicado requiere revisión

- **WHEN** existen dos movimientos del mismo usuario con fecha, monto, moneda, cuenta y descripción muy similares
- **THEN** el sistema puede marcarlos como posibles duplicados
- **AND** no los elimina ni los fusiona automáticamente

#### Scenario: Consumo USD en tarjeta sin cotización NO requiere revisión

- **WHEN** existe un consumo USD en tarjeta sin `fx_rate_to_ars`
- **THEN** el sistema no lo marca como movimiento a revisar
- **AND** la conversión se resuelve al pagar el resumen con la cotización del día

#### Scenario: Revisión no altera saldos

- **WHEN** un movimiento es marcado como requiere revisión
- **THEN** el saldo de las cuentas no cambia
- **AND** la marca funciona únicamente como ayuda operativa para el usuario

---

### Requirement: El usuario puede ver el detalle de una transacción

El sistema SHALL exponer una pantalla de detalle `/transactions/[txId]` para cada movimiento, que muestre toda la información asociada al movimiento (campos según su `kind`), las cuotas hermanas cuando es una compra en cuotas (madre o hija), los reintegros vinculados cuando corresponde, y la regla recurrente que lo generó cuando aplica. La pantalla SHALL respetar el origen de navegación (`?from=account:<id>` o `?from=card:<id>`) para resolver el destino del "Volver".

La **presentación visual** SHALL seguir una **anatomía fija** que se adapta al tipo, con tres bloques:

- **TOPBAR**: a la izquierda un botón "Volver" (ícono `←` + label "Movimientos") que resuelve al destino del back; a la derecha las acciones disponibles. En este alcance las acciones son **Editar** (botón sólido navy) y **Eliminar** (icon button, hover en tono peligro), reusando los handlers existentes (`TxActionsMenu`: Editar abre el drawer de edición en contexto cuando está disponible, o navega a `[txId]/edit`; Eliminar abre el `AlertDialog` con copy contextual). En **mobile** la topbar es sticky, las acciones secundarias colapsan en un menú "···" y **Editar** pasa a una **barra fija inferior** full-width (thumb-reach).
- **HERO**: una tarjeta con banda superior tintada por el tono del tipo (`radial-gradient` con `--tone-soft`). Contiene el **ícono de categoría** en un cuadro redondeado tintado (88px desktop / 72px mobile), un **título** (descripción o categoría del movimiento), el **monto grande** tonal (60px desktop / 46px mobile) con el currency symbol más chico y opaco y los decimales según `showCents`, una **línea de contexto** (ej. "Gasto · pago único en efectivo"), y una fila de **chips**: `fecha` · `medio de pago` · `categoría` · `subcategoría`. Para transferencias el hero lleva además un eyebrow "Transferencia interna" sobre el título.
- **GRILLA "de un vistazo"**: tiles en cards blancos (radius ~20px) en **2 columnas desktop / 1 columna mobile** que **cambian por tipo**. El tile **"Peso en el mes"** SHALL ir **siempre al final** (primero el detalle del movimiento, después el contexto del mes).

El color del monto/hero (tone) lo define el **tipo**, seteado con una clase en el contenedor raíz:

- gasto → terracotta (`--terracota`), signo `−` (U+2212).
- ingreso → emerald-deep (`--emerald-deep`), signo `+`.
- transferencia → slate (`--slate`), **sin signo**.

Los **tiles por tipo** SHALL ser:

- **gasto simple**: Pagado con · Detalle (fecha) · Descripción · Peso en el mes.
- **cuotas**: En cuotas (barra de pagadas/restantes + próxima + fin) · Pagado con · Detalle (total + valor cuota) · Descripción · Peso en el mes.
- **compartido**: Te toca pagar (tu parte) · Pagado con · Dividido entre (personas con su parte, **sin** badge de estado de liquidación) · Detalle · Descripción.
- **reintegro**: Resultado neto (pagaste + reintegro = costo neto, con el movimiento vinculado clickeable) · Pagado con · Detalle · Descripción.
- **recurrencia**: Recurrencia (próximo cobro · activa desde · nº de cobros) · Pagado con (acumulado) · Historial de cobros (barras de los últimos 6 meses) · Descripción.
- **ingreso**: Acreditado en · Detalle (origen) · Descripción · Peso del mes (% de ingresos).
- **transferencia**: Movimiento (origen → destino) · callout "no cuenta como gasto ni ingreso" · Detalle · Descripción.

**Reglas de negocio** que la presentación SHALL respetar:

- App de gestión, **NO** opera pagos: NUNCA mostrar número de tarjeta; solo **nombre + tipo** del medio de pago.
- Los movimientos guardan **solo fecha** (sin hora).
- No existe estado "confirmado": el detalle SHALL mostrar un estado **solo cuando informa algo real** — *Reintegrado* (reintegro recibido), *Completada* (transferencia), *Acreditado* (ingreso).
- Las **transferencias no afectan el balance del mes** (no son gasto ni ingreso); el callout lo explicita.
- El campo de texto libre se rotula **"Descripción"** (no "Nota").

La lógica de qué campos mostrar por kind, el manejo de cuotas hermanas, los reembolsos vinculados y el back navigation NO cambia — preserva el comportamiento de datos del componente actual. El **banner de recurrencia** (link a la regla) se mantiene en el layout de la página (`page.tsx`), arriba del hero.

#### Scenario: El detalle se abre y muestra los campos correctos según el kind

- **WHEN** el usuario abre `/transactions/[txId]` de un gasto categorizado en una cuenta cash
- **THEN** el detalle muestra el hero con tone gasto (terracotta), monto con signo `−`, ícono de la categoría con bg tintado, título y línea de contexto, y los chips fecha · medio de pago · categoría · subcategoría
- **AND** la grilla muestra los tiles "Pagado con", "Detalle", "Descripción" (si la tiene) y "Peso en el mes" al final
- **AND** el botón "Volver" resuelve al destino que indica `?from=` o, por defecto, a `/transactions`

#### Scenario: Compra en cuotas muestra el tile de progreso de cuotas

- **WHEN** el usuario abre el detalle de una compra en cuotas (madre o hija)
- **THEN** el hero muestra la descripción de la compra y el monto total
- **AND** un tile "En cuotas" muestra la barra de cuotas pagadas/restantes, el valor por cuota, la próxima fecha y la fecha de fin
- **AND** un tile "Detalle" muestra el total de la compra y el desglose `n × valor cuota`

#### Scenario: Gasto con reintegro muestra el resultado neto

- **WHEN** el usuario abre el detalle de un gasto con uno o más reintegros recibidos
- **THEN** un tile "Resultado neto" muestra `pagaste` + `reintegro` = `costo neto`
- **AND** lista el/los movimiento(s) de reintegro vinculado(s), clickeable(s) hacia su propio detalle

#### Scenario: Gasto compartido muestra las partes sin estado por persona

- **WHEN** el usuario abre el detalle de un gasto compartido de un hogar de varias personas
- **THEN** un tile "Te toca pagar" muestra la parte propia del usuario
- **AND** un tile "Dividido entre" lista a cada persona con su parte, **sin** badge "Te debe"/"Saldado" (el modelo no guarda el estado de liquidación por transacción)

#### Scenario: La transferencia explicita que no afecta el balance

- **WHEN** el usuario abre el detalle de una transferencia entre cuentas propias
- **THEN** el hero usa tone transferencia (slate) y el monto se muestra **sin signo**
- **AND** un tile "Movimiento" muestra origen → destino y un callout aclara que no cuenta como gasto ni ingreso

#### Scenario: El back navigation respeta el origen

- **WHEN** el usuario abre `/transactions/[txId]?from=account:abc-123` y hace click en "Volver"
- **THEN** el sistema navega a `/accounts/abc-123`

#### Scenario: El AlertDialog de eliminar tiene copy contextual

- **WHEN** el usuario elige "Eliminar" en el detalle de una compra en cuotas madre
- **THEN** el AlertDialog muestra el warning de eliminar la compra y todas sus cuotas
- **AND** cuando el movimiento es un pago de resumen, el warning explica que las cuotas del período volverán a pendientes
- **AND** en todos los otros casos, el warning genérico

#### Scenario: Transacción de otro usuario no es accesible

- **WHEN** el usuario intenta acceder directamente a la URL de una transacción que no le pertenece
- **THEN** el sistema retorna `notFound()` (la RLS filtra la fila; la página renderiza 404)

### Requirement: El detalle del movimiento usa un hero editorial centrado con el monto como protagonista

El sistema SHALL renderizar el hero del detalle de un movimiento como una **tarjeta con banda tintada por tono**, centrada, con la siguiente anatomía:

- Una **banda superior** con `radial-gradient` derivado del tono del tipo (gasto/ingreso/transferencia) sobre fondo blanco.
- Un **ícono de categoría** en un cuadro redondeado tintado (`--tone-soft`) de 88×88 px (desktop) / 72×72 px (mobile), con sombra suave. Para movimientos categorizables usa el emoji de la categoría; para movimientos de estructura (transfer, exchange, adjustment, card_payment) usa un ícono lucide acorde al kind.
- El **monto display** debajo del ícono, tipografía editorial 60px (desktop) / 46px (mobile) font-bold, en el color del tono (`--tone`):
  - terracotta (gasto) con signo `−`.
  - emerald-deep (ingreso) con signo `+`.
  - slate (transferencia) **sin signo**.
- El **currency symbol** SHALL renderearse a la izquierda del entero, más chico (~50% del display) y opaco (~0.6). Los **decimales** SHALL respetar la preferencia `showCents` del usuario.
- Para transferencias, un **eyebrow** uppercase ("Transferencia interna") SHALL ir sobre el título.
- Debajo del monto, una **línea de contexto** (`hero-flow`) que describe el tipo en lenguaje funcional (ej. "Gasto · pago único en efectivo", "Ingreso de ACME S.A.", "Movimiento entre tus cuentas").
- Una fila de **chips** (`hero-chips`) separada por un borde superior: `fecha`, `medio de pago` (chip tonal), `categoría`, `subcategoría`. Estados reales (Reintegro acreditado, etc.) pueden aparecer como un chip de color cuando informan algo.

A diferencia del hero anterior, el nuevo hero **SÍ** lleva chips de contexto (fecha · medio · categoría · subcategoría) debajo del monto; el tipo se comunica con el tono, el ícono y la línea de contexto, no con pills de "tipo" sobre el monto.

#### Scenario: El hero usa el tono y signo correctos por tipo

- **WHEN** el sistema renderiza el detalle de un gasto cash de $4.200,50 en ARS
- **THEN** el hero muestra el monto como `−$ 4.200,50` en color terracotta, con el símbolo de moneda más chico y opaco
- **AND** debajo aparecen la línea de contexto y los chips de fecha · medio de pago · categoría · subcategoría

#### Scenario: El hero de una transferencia no muestra signo

- **WHEN** el sistema renderiza el detalle de una transferencia interna
- **THEN** el monto se muestra en slate **sin** signo `+` ni `−`
- **AND** un eyebrow "Transferencia interna" aparece sobre el título

#### Scenario: El hero muestra los chips de contexto

- **WHEN** el sistema renderiza el detalle de un gasto categorizado con subcategoría
- **THEN** la fila de chips incluye la fecha, el medio de pago, la categoría y la subcategoría
- **AND** el chip del medio de pago NO muestra ningún número de tarjeta, solo el nombre del medio

### Requirement: Las acciones del detalle viven en la topbar

El sistema SHALL exponer las acciones del detalle en la **topbar** de la pantalla, no en un kebab, no en un menú "···" y no como botones al pie. **Eliminar** y **Editar** SHALL ser dos icon buttons contiguos a la derecha de la topbar —Eliminar con hover en tono peligro, Editar en sólido navy—, **con la misma disposición en todos los viewports y en las tres superficies** (web escritorio, web en viewport angosto y app nativa). En viewport angosto la topbar es sticky, de modo que las dos acciones quedan a la vista durante todo el scroll. Cada plataforma SHALL adaptar el tratamiento visual a su propio header (la app nativa dibuja los iconos en blanco sobre el `PageHeader` navy); lo que NO SHALL divergir es la disposición: dos iconos, juntos, en la topbar.

Las acciones disponibles dependen de los permisos del usuario y del editable-state del movimiento (igual que hoy): **Editar** abre el drawer de edición en contexto cuando está disponible, o navega a `[txId]/edit`; **Eliminar** abre el `AlertDialog` con copy contextual (parent / card payment / default). Cuando el movimiento no permite ninguna acción, la topbar deja el slot de acciones vacío.

#### Scenario: Editar y Eliminar están en la topbar, en cualquier viewport

- **WHEN** el sistema renderiza el detalle de un gasto editable y eliminable, en viewport ancho o angosto
- **THEN** la topbar muestra a la derecha dos icon buttons contiguos: "Eliminar" y "Editar"
- **AND** no se renderea ningún menú kebab `⋯` ni menú "···"
- **AND** no se renderea ninguna barra inferior fija con la acción de editar

#### Scenario: En viewport angosto la topbar acompaña el scroll

- **WHEN** el usuario baja por el detalle en viewport angosto (≤600px)
- **THEN** la topbar queda sticky y las dos acciones siguen accesibles sin volver al principio
- **AND** el final de la página no queda tapado por ninguna barra fija

#### Scenario: Editar abre el drawer de edición en contexto

- **WHEN** el usuario toca "Editar" en un movimiento con drawer de edición disponible
- **THEN** se abre el drawer de edición en contexto (sin navegar a `[txId]/edit`)

### Requirement: Una cuota individual es inmutable; el monto de una compra en cuotas se edita solo desde la madre

Una compra en cuotas se modela como una transacción **madre** (`is_parent=true`, off-ledger, `account_id=NULL`) y N **cuotas hijas** (`parent_id` apuntando a la madre). El monto, la fecha y la categoría de la compra son propiedad de la madre: editar una cuota hija en forma aislada descuadraría la familia (las N cuotas + la madre dejarían de sumar el total). Por eso el sistema SHALL tratar a cada cuota hija como **inmutable** y canalizar toda edición a través de la madre.

- El detalle de una **cuota hija** SHALL NOT ofrecer las acciones "Editar" ni "Eliminar". En su lugar SHALL mostrar una nota que indique que es una cuota y que el monto se edita desde la compra original, con un link al detalle de la madre (`/transactions/[parentId]`).
- El form de edición SHALL marcar todos los campos de una cuota hija como no editables (`getEditableFields` con `isInstallmentChild`).
- El server action de actualización de un movimiento (`updateTransaction`) SHALL rechazar cualquier cambio de monto o fecha sobre una fila con `parent_id` no nulo (defensa en profundidad, en paralelo al guard que ya impide eliminar una cuota suelta).
- La edición del **total** se hace desde la madre (`updateInstallmentParent`): cambiar el monto SHALL re-repartir el nuevo total entre las cuotas (residuo en la primera). Si **alguna** cuota ya está pagada (`status='paid'`), el sistema SHALL rechazar el cambio de monto (categoría y descripción siguen editables y se propagan a las cuotas).

#### Scenario: El detalle de una cuota no ofrece editar ni eliminar

- **WHEN** el usuario abre el detalle de una cuota hija (`parent_id` no nulo) desde un resumen o el listado
- **THEN** la topbar no muestra "Editar" ni "Eliminar"
- **AND** aparece una nota "Esta es una cuota. El monto se edita desde la compra original" con un link "Ir a la compra original" hacia el detalle de la madre

#### Scenario: Intentar editar el monto de una cuota vía API es rechazado

- **WHEN** una llamada a `updateTransaction` envía un nuevo `amount` o `date` para una fila con `parent_id` no nulo
- **THEN** la action retorna un error indicando que el monto de una compra en cuotas se edita desde la compra original, no desde cada cuota
- **AND** no se persiste ningún cambio

#### Scenario: Editar el total desde la madre re-reparte las cuotas

- **WHEN** el usuario edita el monto total en el detalle de la madre y ninguna cuota está pagada
- **THEN** el nuevo total se re-reparte entre las N cuotas (con el residuo en la primera)

#### Scenario: La madre con una cuota pagada bloquea el cambio de monto

- **WHEN** el usuario intenta cambiar el monto total de una compra en cuotas que tiene al menos una cuota en estado `paid`
- **THEN** el sistema rechaza el cambio de monto (la categoría y la descripción sí se pueden editar y se propagan a las cuotas)

### Requirement: Los metadatos del detalle se agrupan en DetailGroups con eyebrow caps y filas

El sistema SHALL agrupar los metadatos del detalle en componentes `TxDetailGroup`: cards blancos con border de 1px y border-radius ~18px, opcionalmente precedidos por un **eyebrow caps uppercase** de 10.5px font-bold tracked (~0.6px) y color text-soft, que actúa como header del group (ej. "DETALLES", "TARJETA", "CUOTAS", "REINTEGROS").

Dentro del group, cada fila SHALL ser un `TxDetailRow`:

- A la izquierda, un **ícono cuadrado redondeado** de 32×32 px con `border-radius: 10px`, fondo `bg-muted`, ícono lucide pequeño en `text-text-soft`.
- En el centro, un bloque vertical: el **label** uppercase 10.5px font-bold con tracking abierto + el **value** 13.5px font-semibold navy debajo (o un `valueNode` custom cuando el value es más complejo: un Link, un chip, etc.).
- Las filas se separan por **border-bottom 1px** color border-soft. La última fila NO SHALL tener border-bottom.

#### Scenario: El detalle muestra un DetailGroup "Detalles" con las filas correctas

- **WHEN** el sistema renderiza el detalle de un gasto cash
- **THEN** un `TxDetailGroup` con eyebrow "DETALLES" aparece debajo del hero
- **AND** contiene filas para fecha (ícono Calendar), cuenta (ícono Wallet), categoría (ícono Tag), y subcategoría si la tiene

#### Scenario: Cada fila tiene su ícono, label y value

- **WHEN** el sistema renderiza una fila para "Fecha"
- **THEN** la fila muestra un ícono Calendar 32×32 con bg-muted a la izquierda
- **AND** label "FECHA" en uppercase caps + value "Martes, 27 de mayo" debajo

### Requirement: Las cuotas hermanas se renderean con numeración circular y chip de estado por cuota

Cuando el movimiento del detalle es una compra en cuotas (madre o hija de cuotas), el sistema SHALL renderizar un `TxDetailGroup` con la lista de todas las cuotas hermanas usando un layout variant del `TxDetailRow`:

- A la izquierda, un **número circular** 28×28 px con `border-radius: 9999px`, color de fondo según el estado de la cuota:
  - `pending` (próxima a vencer del período activo) → `bg-warning-soft text-warning-deep`.
  - `paid` (ya pagada) → `bg-income/14 text-income`.
  - Otra (futura lejana) → `bg-muted text-text-muted`.
- En el centro, **descripción de la cuota** ("Cuota 1 de 3", "Cuota 2 de 3", etc.) en 14px font-semibold navy + **caption** del período al que pertenece la cuota debajo (12px text-soft).
- A la derecha, un **chip de estado** ("Pendiente" / "Pagada") seguido del **monto** de la cuota.

Una hija navegable: al hacer click en una fila de cuota (que no es la actual), el sistema navega al detalle de esa cuota.

#### Scenario: La tabla de cuotas usa numeración circular según estado

- **WHEN** el sistema renderiza el detalle de la madre de una compra en 3 cuotas, donde la primera está pendiente y las otras dos en estado neutro
- **THEN** la primera fila tiene un círculo "1" con bg warning-soft y text warning-deep
- **AND** las filas 2 y 3 tienen círculos con bg muted

#### Scenario: Una cuota hija click navega a su detalle

- **WHEN** el usuario está en el detalle de la madre y hace click en la fila de la cuota 2
- **THEN** el sistema navega a `/transactions/[txId-de-la-cuota-2]` preservando el `from` si corresponde

### Requirement: El back del detalle se renderea como ícono solo, sin label de texto

El sistema SHALL renderizar el back del `TxHeader` del detalle como un **ícono `←` (`ArrowLeft` 20px de lucide) en un botón cuadrado 36×36**, sin label de texto al lado. El destino del back se sigue resolviendo por `?from=` query param (account:<id>, card:<id>, o `/transactions` por defecto).

Razón: el label de texto ("← Visa Galicia", "← Movimientos", "← Cuenta") consume real estate sin agregar info crítica — el back del browser cumple el mismo rol semántico, y el ícono solo es el patrón estándar de banking/finance apps (v2, Mobills, Splid).

#### Scenario: El back muestra solo el ícono

- **WHEN** el sistema renderiza el `TxHeader` del detalle
- **THEN** a la izquierda aparece un botón con `ArrowLeft` y `aria-label="Volver"`
- **AND** NO aparece texto al lado del ícono

#### Scenario: El back lleva al destino del `from` query param

- **WHEN** la URL es `/transactions/[txId]?from=account:abc` y el usuario hace click en el `←`
- **THEN** el sistema navega a `/accounts/abc`
- **AND** cuando `?from=card:xyz`, navega a `/cards/xyz`
- **AND** cuando no hay `?from=`, navega a `/transactions`

### Requirement: El detalle ofrece pedagogía in-context sobre off-ledger y reintegros pendientes

El detalle del movimiento SHALL renderizar **copy contextual corto** debajo del hero, según el `kind` y el estado del movimiento, explicando al usuario qué pasa con el impacto contable. La copy SHALL ser editorial cálida y breve (máximo 2-3 líneas), reusable del namespace i18n. NO SHALL ser un formulario, banner accionable, ni alerta intrusiva — es texto explicativo, en color muted o slate suave, ubicado entre el `TxHero` y el primer `TxDetailGroup`.

Variantes obligatorias:

- **Consumo o cuota de tarjeta no pagada** (`account.type='credit'` y el período aún no fue pagado): texto similar a "Este consumo no afecta tu disponible hasta que pagues el resumen del `{período}`." donde `{período}` se reemplaza con el rango del período del consumo.
- **Cuota hija ya pagada** (status=`paid`): texto similar a "Esta cuota ya está incluida en el resumen del `{período}` que pagaste." Se omite cuando la cuota es la primera o única.
- **Pago de resumen de tarjeta** (`card_payment`): texto similar a "Con este pago, las cuotas del período `{período}` quedaron en estado pagado." Aclara la conexión entre el pago cash y las cuotas tarjeta.
- **Reintegro pendiente** (`type='reimbursement'` con `received_at IS NULL` y `cancelled_at IS NULL`): texto similar a "Esperás que te lo devuelvan. Cuando llegue, marcalo como recibido y se va a sumar a tu disponible." Aclara que el monto no entra a balance hasta confirmar.
- **Reintegro cancelado** (`cancelled_at IS NOT NULL`): texto similar a "Marcaste este reintegro como cancelado. Si finalmente lo recibís, podés reabrirlo." Aclara que el estado es revertible.

Los otros kinds (income cash, expense cash, transfer, exchange, adjustment, reimbursement recibido) NO requieren copy in-context — su impacto contable es directo y no necesita explicación.

Las copys SHALL vivir bajo `transactions.detail.context.*` para que se traduzcan al inglés y futuro mobile las reuse.

Razón: ninguna de las apps relevadas (YNAB, Mobills, Mint, Spendee, Copilot Money, Monarch Money) modela explícitamente el off-ledger ni el estado "esperado vs hecho" de los reintegros. Es un diferenciador propio de grana, que encaja con el tono editorial ("sugiere y enseña, no condena") sin agregar features funcionales nuevas — solo presentación + copy. La fricción común en otras apps ("¿por qué este consumo de tarjeta no bajó mi saldo?") se preempts directamente desde el detalle.

#### Scenario: Un consumo de tarjeta no pagado muestra copy off-ledger

- **WHEN** el usuario abre el detalle de un consumo o cuota hija con `account.type='credit'` y `status='pending'`
- **THEN** debajo del `TxHero`, antes del primer `TxDetailGroup`, aparece un párrafo corto en color muted con copy "Este consumo no afecta tu disponible hasta que pagues el resumen del `{período}`."
- **AND** la copy NO es un banner accionable ni una alerta — es texto explicativo

#### Scenario: Un reintegro pendiente muestra copy editorial

- **WHEN** el usuario abre el detalle de un reintegro con `received_at IS NULL`
- **THEN** debajo del `TxHero` aparece un párrafo corto editorial: "Esperás que te lo devuelvan. Cuando llegue, marcalo como recibido y se va a sumar a tu disponible."

#### Scenario: Un income cash no muestra copy contextual

- **WHEN** el usuario abre el detalle de un income cargado en una cuenta cash
- **THEN** NO aparece párrafo contextual debajo del hero
- **AND** el detalle pasa directamente al primer `TxDetailGroup`

#### Scenario: Las copys son i18n-enabled

- **WHEN** el sistema renderiza una de las variantes de copy contextual
- **THEN** el texto proviene del namespace `transactions.detail.context.*`
- **AND** acepta el placeholder `{período}` cuando aplica

### Requirement: El usuario puede editar una transacción

El sistema SHALL permitir editar los campos mutables de una transacción según su tipo:

- **Ingresos y gastos en cash/bank**: monto, fecha, descripción, categoría y subcategoría. Los campos `type`, `account_id` y `currency_code` son inmutables.
- **Transferencias**: ver requirement específico.
- **Ajustes**: ver requirement específico.
- **Consumos en tarjeta (1 cuota, `status='pending'`)**: monto, fecha, descripción, categoría, subcategoría. NO editable: cuenta, moneda, cuotas. Si `status='paid'`, sólo editables descripción y categoría — el consumo **sigue siendo editable, no se congela**: el detalle SHALL ofrecer la acción Editar y el formulario SHALL mostrar monto y fecha como contexto read-only. Recategorizar un gasto ya pagado es una corrección corriente. **Borrarlo** sí SHALL quedar bloqueado: deshacer un resumen liquidado se hace desde el período, y `period_payments` lo impide con una FK `RESTRICT`.
- **Compras en cuotas (madre)**: ver requirement específico "Editar una compra en cuotas".

Los campos `type`, `account_id`, `currency_code`, `is_parent` y `parent_id` SHALL ser siempre inmutables post-creación.

#### Scenario: Edición de monto actualiza el saldo

- **WHEN** el usuario cambia el monto de un gasto cash/bank de $100 a $150
- **THEN** el saldo de la cuenta disminuye $50 adicionales respecto al saldo previo

#### Scenario: Cambio de tipo es rechazado

- **WHEN** el usuario intenta cambiar un ingreso a gasto mediante la acción de edición
- **THEN** el sistema rechaza el input; el tipo es inmutable

#### Scenario: Cambio de cuenta es rechazado

- **WHEN** el usuario intenta mover la transacción a otra cuenta mediante la acción de edición
- **THEN** el sistema rechaza el input; la cuenta es inmutable

#### Scenario: Edición de consumo en tarjeta pending

- **WHEN** el usuario edita el monto de un consumo de tarjeta con `status='pending'`
- **THEN** la action acepta el cambio
- **AND** se recalcula el período asignado si la fecha cambió (con potencial reubicación al período correspondiente)

#### Scenario: Edición de consumo en tarjeta paid solo permite descripción y categoría

- **WHEN** el usuario intenta editar el monto de un consumo con `status='paid'`
- **THEN** el sistema rechaza el cambio de monto (campo inmutable post-pago)
- **AND** acepta cambios de descripción o categoría

#### Scenario: Un consumo pagado se puede recategorizar

- **WHEN** el dueño abre el detalle de un consumo de tarjeta cuyo resumen ya se pagó (`status='paid'`)
- **THEN** el detalle ofrece la acción Editar
- **AND** NO ofrece la acción Borrar
- **AND** el formulario de edición muestra monto y fecha como contexto read-only, y permite cambiar categoría, subcategoría y descripción

### Requirement: El usuario puede eliminar una transacción

El sistema SHALL permitir eliminar permanentemente una transacción. El sistema solicita confirmación antes de ejecutar. El saldo de la cuenta se recalcula automáticamente tras la eliminación.

El sistema NO SHALL permitir eliminar desde el detalle del movimiento aquellas transacciones cuyo borrado aislado rompería una operación mayor de la que forman parte. En esos casos SHALL rechazar la operación con un mensaje que indique **dónde** se resuelve, sin exponer detalles técnicos:

- una **cuota hija** de una compra en cuotas se elimina desde el movimiento padre;
- un **consumo ya pagado** en un resumen no se elimina;
- una **pata de liquidación** del hogar se revierte desde la cuenta corriente;
- un **pago de resumen de tarjeta** se deshace desde el detalle del período de la tarjeta.

El pago de un resumen NO SHALL eliminarse desde el detalle del movimiento: es la contrapartida de una operación que también dejó movimientos del resumen en `paid`, un registro en el pago del período y, eventualmente, un impuesto de sellos. Deshacerlo es la operación de la capability `cards`.

Un movimiento que **sembró una regla recurrente** (existe una regla con `created_from_transaction_id` apuntándolo) NO SHALL borrarse en silencio dejando la regla huérfana. La garantía SHALL vivir en la base: `recurrences.created_from_transaction_id` es `ON DELETE RESTRICT`, de modo que el bloqueo aplica a todos los clientes (web, mobile, SQL manual) y no depende de que cada frontend lo recuerde. Antes de intentar el borrado, el sistema SHALL detectar la regla sembrada y ofrecer al usuario dos salidas explícitas:

- **eliminar también la regla** — se elimina la regla (con sus instancias pendientes) y luego el movimiento;
- **conservar la regla, desvincularla** — se pone `created_from_transaction_id = NULL` deliberadamente y luego se borra el movimiento.

Al desvincular, si la regla queda con `last_generated_date` igual a su `start_date` y esa fecha es **futura**, el sistema SHALL además poner `last_generated_date = NULL`: la ocurrencia que ese cursor decía cubrir es justamente el movimiento que se está borrando, y sin la corrección la regla perdería ese período. Sin una de las dos confirmaciones, ni el movimiento ni la regla SHALL modificarse.

#### Scenario: Eliminar transacción actualiza el saldo

- **WHEN** el usuario confirma la eliminación de un gasto de $200 ARS
- **THEN** el sistema borra la fila y el saldo ARS de la cuenta aumenta $200

#### Scenario: Eliminación requiere confirmación

- **WHEN** el usuario toca "Eliminar" en el detalle de la transacción
- **THEN** el sistema muestra un diálogo de confirmación antes de ejecutar el borrado

#### Scenario: Eliminar un pago de resumen redirige a la tarjeta

- **WHEN** el usuario toca "Eliminar" en el detalle de un movimiento que es el pago de un resumen de tarjeta
- **THEN** el sistema rechaza la eliminación
- **AND** informa que se trata del pago de un resumen y que debe deshacerse desde el detalle del período de la tarjeta

#### Scenario: La confirmación no promete una reversión que no ocurre

- **WHEN** el usuario abre el diálogo de eliminación de un pago de resumen
- **THEN** el sistema NO afirma que las cuotas del período volverán a pendientes

#### Scenario: Borrar un movimiento semilla pide resolver la regla primero

- **WHEN** el usuario elimina un movimiento que tiene una regla recurrente apuntándolo por `created_from_transaction_id`
- **THEN** el sistema informa que ese movimiento creó una recurrencia, nombrándola
- **AND** ofrece eliminar también la regla o conservarla desvinculándola
- **AND** no borra nada hasta que el usuario elija

#### Scenario: Eliminar también la regla

- **WHEN** el usuario elige "eliminar también la regla"
- **THEN** el sistema elimina la regla y sus instancias pendientes, y luego borra el movimiento
- **AND** las transacciones reales ya confirmadas por esa regla se conservan

#### Scenario: Conservar la regla desvinculándola

- **WHEN** el usuario elige "conservar la regla" sobre una regla con `start_date = 2026-05-10` y `last_generated_date = 2026-06-10`
- **THEN** el sistema pone `created_from_transaction_id = NULL`, deja `last_generated_date` intacto y borra el movimiento
- **AND** la regla sigue generando en su próxima fecha normal

#### Scenario: Desvincular una semilla futura repara el cursor

- **WHEN** hoy es `2026-08-04` y el usuario elige "conservar la regla" sobre una regla con `start_date = 2026-08-07` y `last_generated_date = 2026-08-07`
- **THEN** el sistema pone `created_from_transaction_id = NULL` **y** `last_generated_date = NULL`, y borra el movimiento
- **AND** el generador produce una instancia pendiente el `2026-08-07` que pasa por el gate de confirmación

#### Scenario: La base rechaza el borrado aunque el cliente no lo verifique

- **WHEN** un cliente cualquiera (mobile, SQL manual) intenta borrar directamente un movimiento apuntado por `created_from_transaction_id` de una regla existente
- **THEN** la base rechaza el DELETE por violación de la foreign key
- **AND** la regla no queda huérfana

---

### Requirement: Solo el dueño de la transacción puede leerla y modificarla

El sistema SHALL aplicar Row Level Security sobre `transactions` de forma que `user_id = auth.uid()` para toda operación INSERT, UPDATE y DELETE. Para SELECT, un usuario SHALL poder leer sus propias transacciones (`user_id = auth.uid()`) y, adicionalmente, las transacciones compartidas (`is_shared = true`) cuyo `household_id` corresponda a un hogar del que el usuario es miembro. La escritura (INSERT/UPDATE/DELETE) sigue restringida al dueño: ningún miembro puede crear, editar ni eliminar una transacción de otro miembro, aunque sea compartida.

#### Scenario: RLS bloquea acceso cross-user a transacciones no compartidas

- **WHEN** un usuario autenticado realiza una query directa contra `transactions` sin filtro de `user_id`
- **THEN** Supabase retorna las filas donde `user_id = auth.uid()` más las filas compartidas (`is_shared = true`) de su hogar, y ninguna otra

#### Scenario: Un miembro lee el gasto compartido del otro

- **WHEN** A registró un gasto con `is_shared = true` y `household_id` del hogar de A y B, y B consulta sus transacciones
- **THEN** B puede leer ese gasto compartido aunque su `user_id` sea el de A

#### Scenario: Un miembro no puede modificar el gasto del otro

- **WHEN** B intenta editar o eliminar un gasto compartido cuyo `user_id` es el de A
- **THEN** Supabase rechaza la operación de escritura

#### Scenario: Un miembro lee el reintegro compartido del otro

- **WHEN** A tiene un `reimbursement` (`type='reimbursement'`, `is_shared = true`, `household_id` del hogar) sobre un gasto compartido, y B consulta sus transacciones
- **THEN** B puede leer ese reintegro para que la deuda se derive correctamente, sin poder modificarlo

### Requirement: El usuario puede registrar una transferencia entre dos cuentas propias

El sistema SHALL permitir registrar una transferencia (movimiento de plata entre dos cuentas del usuario, sin cambio de patrimonio total). Una transferencia requiere: cuenta origen, cuenta destino distinta a la origen, una moneda activa en **ambas** cuentas, monto mayor a cero, y fecha. La descripción es opcional. No tiene categoría.

#### Scenario: Transferencia creada correctamente

- **WHEN** el usuario completa el formulario con cuenta origen, cuenta destino distinta, moneda activa en ambas, monto > 0, fecha y confirma
- **THEN** el sistema inserta una fila en `transactions` con `type='transfer'`, `account_id=origen`, `transfer_destination_account_id=destino`, `amount > 0`; el saldo de la cuenta origen disminuye en ese monto y el de la cuenta destino aumenta en el mismo monto, en la moneda indicada

#### Scenario: Cuenta destino igual a cuenta origen es rechazada

- **WHEN** el usuario intenta crear una transferencia con la misma cuenta como origen y destino
- **THEN** el sistema muestra un error de validación y no inserta la transacción

#### Scenario: Moneda no activa en la cuenta destino es rechazada

- **WHEN** el usuario intenta transferir ARS desde una cuenta con ARS activo hacia una cuenta que solo tiene USD activo
- **THEN** el sistema retorna un error de validación y no inserta la transacción

#### Scenario: Transferencia con monedas distintas es rechazada

- **WHEN** el usuario intenta especificar una "moneda destino" distinta a la "moneda origen"
- **THEN** la UI no permite el caso (selector único de moneda) y la action enforza `currency_code` único — no existe conversión automática

---

### Requirement: El usuario puede registrar un ajuste de saldo en una cuenta

El sistema SHALL permitir registrar un ajuste (reconciliación entre saldo registrado y saldo real). El ajuste requiere: cuenta, moneda activa, monto distinto de cero (positivo o negativo), y fecha. La descripción es opcional. No tiene categoría. Un ajuste positivo suma al saldo; un ajuste negativo resta.

#### Scenario: Ajuste positivo aumenta el saldo

- **WHEN** el usuario registra un ajuste de `+$50 ARS` en una cuenta con saldo derivado de `$500 ARS`
- **THEN** la pantalla de detalle de la cuenta muestra saldo ARS = `$550` y la transacción aparece con `type='adjustment'` y `amount=50`

#### Scenario: Ajuste negativo disminuye el saldo

- **WHEN** el usuario registra un ajuste de `-$50 ARS` en una cuenta con saldo derivado de `$500 ARS`
- **THEN** la pantalla de detalle muestra saldo ARS = `$450` y la transacción aparece con `type='adjustment'` y `amount=-50`

#### Scenario: Ajuste con monto cero es rechazado

- **WHEN** el usuario intenta registrar un ajuste con monto igual a cero
- **THEN** el sistema muestra un error de validación

#### Scenario: Ajuste con moneda inactiva es rechazado

- **WHEN** el usuario intenta registrar un ajuste en una moneda que no tiene `account_currencies` activa en la cuenta
- **THEN** el sistema retorna un error y no inserta la transacción

---

### Requirement: La lista de movimientos de una cuenta incluye las transferencias entrantes

El sistema SHALL mostrar en la lista de movimientos del detalle de una cuenta tanto las transacciones donde `account_id = currentAccount` como aquellas donde `transfer_destination_account_id = currentAccount`. Cada transferencia se visualiza desde la perspectiva de la cuenta actual: saliente con signo `−` cuando la cuenta es origen, entrante con signo `+` cuando la cuenta es destino.

#### Scenario: Transferencia saliente aparece con signo negativo

- **WHEN** el usuario abre el detalle de la cuenta A donde existe una transferencia de A → B por `$100 ARS`
- **THEN** la lista de movimientos de A muestra esa transferencia con monto `−$100 ARS` y texto secundario indicando "→ B"

#### Scenario: Transferencia entrante aparece con signo positivo

- **WHEN** el usuario abre el detalle de la cuenta B donde existe una transferencia A → B por `$100 ARS`
- **THEN** la lista de movimientos de B muestra esa transferencia con monto `+$100 ARS` y texto secundario indicando "← A"

#### Scenario: Ajustes se diferencian visualmente

- **WHEN** el usuario abre el detalle de una cuenta con un ajuste positivo y otro negativo
- **THEN** ambos aparecen marcados como "Ajuste" con el signo correspondiente a su `amount`

---

### Requirement: El usuario puede editar una transferencia

El sistema SHALL permitir editar los campos mutables de una transferencia: monto (> 0), fecha y descripción. Los campos `type`, `account_id`, `transfer_destination_account_id` y `currency_code` son inmutables post-creación. Si el usuario quiere cambiar la cuenta o moneda, debe eliminar y crear de nuevo.

#### Scenario: Edición de monto actualiza ambos saldos

- **WHEN** el usuario cambia el monto de una transferencia A → B de `$100` a `$150`
- **THEN** el saldo de A disminuye `$50` adicionales y el de B aumenta `$50` adicionales

#### Scenario: Intento de cambiar cuenta destino es rechazado

- **WHEN** el usuario intenta cambiar `transfer_destination_account_id` mediante el form de edición
- **THEN** el campo está deshabilitado en la UI y la action lo rechaza si se envía vía API directa

---

### Requirement: El usuario puede editar un ajuste

El sistema SHALL permitir editar los campos mutables de un ajuste: monto (distinto de cero, con signo), fecha y descripción. Los campos `type`, `account_id` y `currency_code` son inmutables post-creación.

#### Scenario: Edición de monto actualiza el saldo

- **WHEN** el usuario cambia el monto de un ajuste de `+$50` a `+$80`
- **THEN** el saldo de la cuenta aumenta `$30` adicionales respecto al saldo previo

#### Scenario: Cambio de signo es válido

- **WHEN** el usuario cambia un ajuste de `+$50` a `-$50`
- **THEN** el sistema acepta el cambio; el saldo de la cuenta se ajusta en `-$100` respecto al saldo previo

---

### Requirement: El usuario puede eliminar una transferencia o un ajuste

El sistema SHALL permitir eliminar permanentemente una transferencia o un ajuste. El sistema solicita confirmación antes de ejecutar. Los saldos de las cuentas afectadas se recalculan automáticamente tras la eliminación.

#### Scenario: Eliminar transferencia recalcula ambos saldos

- **WHEN** el usuario confirma la eliminación de una transferencia A → B por `$200`
- **THEN** el sistema borra la fila, el saldo de A aumenta `$200` y el de B disminuye `$200`

#### Scenario: Eliminar ajuste positivo disminuye el saldo

- **WHEN** el usuario confirma la eliminación de un ajuste de `+$50`
- **THEN** el sistema borra la fila y el saldo de la cuenta disminuye `$50`

#### Scenario: Eliminar ajuste negativo aumenta el saldo

- **WHEN** el usuario confirma la eliminación de un ajuste de `-$50`
- **THEN** el sistema borra la fila y el saldo de la cuenta aumenta `$50`

### Requirement: El usuario puede registrar un consumo en una tarjeta de crédito

El sistema SHALL permitir registrar un consumo (`type='expense'`) en una cuenta `accounts.type='credit'`. El consumo requiere: cuenta (tarjeta), moneda activa en esa tarjeta, monto mayor a cero, fecha, y categoría. La descripción y subcategoría son opcionales. El consumo SHALL persistirse con `status='pending'`, `due_date` igual a la `due_date` del `card_periods` al que se asigna, `card_period_id` apuntando a ese período, y `fx_rate_to_ars` populado si la moneda del consumo no es ARS.

#### Scenario: Consumo en pesos en tarjeta

- **WHEN** el usuario registra un gasto de `$50.000 ARS` en su tarjeta de crédito con fecha `2026-05-20`
- **THEN** se inserta una fila en `transactions` con `type='expense'`, `status='pending'`, `account_id=<tarjeta>`, `currency_code='ARS'`, `card_period_id=<período cuyo rango contiene 2026-05-20>`, `fx_rate_to_ars=NULL`
- **AND** ningún saldo de cuentas cash/bank cambia

#### Scenario: Consumo en dólares en tarjeta

- **WHEN** el usuario registra un gasto de `US$100` en tarjeta con cotización del día `1400` ARS/USD
- **THEN** se inserta `transactions` con `currency_code='USD'`, `amount=100`, `fx_rate_to_ars=1400`
- **AND** el cálculo de "% límite disponible" usa `100 * 1400 = $140.000` ARS imputado al límite

#### Scenario: Consumo en moneda no activa en la tarjeta es rechazado

- **WHEN** el usuario intenta registrar un consumo USD en una tarjeta que solo tiene ARS activa
- **THEN** la action retorna error y no inserta

---

### Requirement: El usuario puede registrar un consumo en cuotas en una tarjeta de crédito

El sistema SHALL permitir registrar un consumo en N cuotas (N ≥ 2) en una tarjeta. El consumo en cuotas SHALL aplicar únicamente a `currency_code='ARS'` (las tarjetas argentinas no operan cuotas en monedas extranjeras). El sistema SHALL crear una transacción "madre" (`is_parent=true`, `account_id=NULL`, `status=NULL`, `card_period_id=NULL`, sin `due_date`) y N transacciones "hijas" (`is_parent=false`, `parent_id=<madre.id>`, `account_id=<tarjeta>`, `status='pending'`, `installment_n=i`, `installments_total=N`).

La distribución de montos SHALL ser: `cuota_base = floor(amount_total * 100 / N) / 100` (en centavos), `residuo = amount_total − cuota_base * N`, `cuota_1 = cuota_base + residuo`, cuotas 2..N = `cuota_base`. La cuota `i` SHALL tener `date = madre.date + (i-1) meses` (date virtual de imputación al resumen) y `card_period_id` del período cuyo rango contenga esa fecha. El período SHALL auto-generarse por rolling **solo cuando la fecha de la cuota supera el `end_date` del último resumen conocido**; si la fecha de una cuota cae dentro de un resumen **pagado**, la operación completa SHALL rechazarse con `period_already_paid` (ver "El sistema rechaza registrar un consumo con fecha dentro de un período pagado") sin insertar nada.

#### Scenario: Compra en 3 cuotas de $1000

- **WHEN** el usuario registra una compra en 3 cuotas de `$1000` con fecha `2026-05-30`
- **THEN** se crea una madre con `is_parent=true`, `amount=1000`, `account_id=NULL`, `status=NULL`
- **AND** se crean tres hijas con `amount=333.34, 333.33, 333.33` (residuo a la primera)
- **AND** cada hija tiene `date='2026-05-30'`, `2026-06-30'`, `2026-07-30'` respectivamente
- **AND** cada hija tiene `installment_n=1, 2, 3` y `installments_total=3`

#### Scenario: Compra en cuotas en USD es rechazada

- **WHEN** el usuario intenta registrar una compra en USD en 3 cuotas
- **THEN** la action retorna error de validación con copy "Las cuotas solo están disponibles en pesos"
- **AND** no se inserta nada

#### Scenario: Compra en cuotas que sobrepasa el último período conocido dispara rolling

- **WHEN** el usuario registra una compra en 6 cuotas el `2026-05-30` y solo existen períodos hasta `2026-07-15`
- **THEN** el sistema auto-genera los períodos que falten (con `is_estimated=true`) para imputar todas las cuotas
- **AND** la transacción completa se inserta atómicamente

#### Scenario: Compra en cuotas cuya primera cuota cae en un resumen pagado es rechazada

- **WHEN** el usuario registra una compra en cuotas con fecha `2026-06-25` y esa fecha cae en un `card_periods` en estado `paid`
- **THEN** la operación se rechaza con `period_already_paid`
- **AND** no se inserta ni la madre ni ninguna hija
- **AND** no se crea ningún `card_periods` nuevo

---

### Requirement: El usuario paga un resumen de tarjeta como operación atómica

El sistema SHALL exponer una operación `payCardPeriod(periodId, data)` que ejecute, en una única transacción DB, los siguientes cinco efectos:

1. INSERT de una transacción `expense` en la cuenta de pago (cash o bank) con `amount`, `payment_date`, sin categoría, sin `card_period_id`.
2. INSERT de una fila en `period_payments` vinculando el período con la transacción.
3. UPDATE `status='paid'` de todas las transacciones con `card_period_id=periodId` y `status='pending'`.
4. INSERT de un nuevo `card_periods` con `start_date = current.end_date + 1 día`, `end_date = next_end_date` (input), `due_date = next_due_date` (input), `is_estimated=false`.

El pago SHALL ejecutarse sobre un período cuyo estado derivado sea `closed` u `overdue`. Si cualquier paso falla, SHALL hacerse rollback completo y el sistema SHALL devolver error.

El operacion `payCardPeriod` SHALL retornar `{ paymentId, newPeriodId, expenseId }`.

#### Scenario: Pago exitoso de resumen cerrado

- **WHEN** el usuario paga un resumen `closed` por `$150.000` desde su cuenta "Galicia" en fecha `2026-06-25`, cargando `next_end_date='2026-07-20'` y `next_due_date='2026-08-05'`
- **THEN** se inserta el expense en "Galicia" (que baja su saldo en `$150.000`)
- **AND** se inserta `period_payments`
- **AND** todas las cuotas del período pagado pasan a `status='paid'`
- **AND** se inserta un nuevo `card_periods` para el siguiente resumen

#### Scenario: Pago bloqueado en período open o paid

- **WHEN** el usuario intenta pagar un período cuyo estado derivado es `open` o `paid`
- **THEN** la action retorna error `invalid_period_state`
- **AND** no modifica nada

#### Scenario: Cuotas de períodos posteriores no se marcan paid

- **WHEN** se paga el período P1 que contiene la cuota 1 de una compra en 6 cuotas; las cuotas 2..6 están imputadas a P2..P6
- **THEN** sólo la cuota 1 pasa a `paid`
- **AND** las cuotas 2..6 siguen `pending` en sus períodos respectivos

#### Scenario: Falla en cualquier paso hace rollback

- **WHEN** durante la operación atómica falla el INSERT del nuevo `card_periods` (ej.: violación de UNIQUE)
- **THEN** se hace rollback de todos los pasos anteriores
- **AND** el resumen queda sin pago registrado

---

### Requirement: El sistema rechaza registrar un consumo con fecha dentro de un período pagado

El sistema SHALL rechazar la inserción de cualquier transacción de tarjeta cuya `date` caiga dentro del rango (`start_date`, `end_date`) de un `card_periods` cuyo estado derivado sea `paid`. El sistema SHALL devolver un error tipado (`period_already_paid`) explicativo y ofrecer al usuario alternativas (elegir otra fecha, registrar como ajuste manual, o consultar un flujo futuro de corrección).

Este rechazo SHALL aplicarse en el **punto de asignación de período** (`getOrCreatePeriodForDate`), compartido por el consumo simple, las cuotas y la confirmación de instancias recurrentes. La asignación SHALL clasificar la fecha así:

- existe un `card_periods` **no pagado** cuyo rango contiene la fecha (día de cierre incluido) → se imputa a ese período;
- existe un `card_periods` **pagado** cuyo rango contiene la fecha → se **rechaza** con `period_already_paid`;
- la fecha es **anterior** al primer resumen conocido → se rechaza como fecha previa al historial de la tarjeta;
- la fecha es **estrictamente posterior** al `end_date` del último resumen conocido → se crea un período nuevo por rolling (`is_estimated=true`) y se imputa ahí;
- cualquier otra fecha no cubierta (un hueco entre resúmenes) → se rechaza.

El sistema NO SHALL crear un `card_periods` nuevo para una fecha que no sea estrictamente posterior al último resumen conocido. En particular, una fecha cubierta por un resumen pagado NO SHALL provocar la creación de un resumen en la frontera: eso imputaría el consumo a un resumen que no contiene su fecha.

#### Scenario: Backdating en período paid es rechazado

- **WHEN** el usuario intenta registrar un consumo con `date='2026-04-20'` y existe un `card_periods` con rango `2026-04-01` a `2026-04-30` en estado `paid`
- **THEN** la action retorna error tipado `period_already_paid`
- **AND** no inserta la transacción
- **AND** no crea ningún `card_periods` nuevo

#### Scenario: Backdating en período no-paid es aceptado

- **WHEN** el usuario registra un consumo con `date='2026-05-05'` y el período de mayo está en estado `open`
- **THEN** la transacción se inserta normalmente

#### Scenario: Consumo en el día de cierre de un resumen pagado es rechazado, no imputado a futuro

- **WHEN** el usuario registra un consumo con `date='2026-06-25'`, existe un `card_periods` `2026-05-26 → 2026-06-25` en estado `paid`, y el último resumen conocido termina el `2026-10-23`
- **THEN** la action retorna error tipado `period_already_paid`
- **AND** no se crea ningún `card_periods` nuevo (ni en la frontera `2026-10-24 →` ni en ningún otro lado)
- **AND** el consumo no se inserta

#### Scenario: Consumo en el día de cierre de un resumen abierto entra en ese resumen

- **WHEN** el usuario registra un consumo con `date='2026-06-25'` y existe un `card_periods` `2026-05-26 → 2026-06-25` en estado `open` o `closed` (no pagado)
- **THEN** el consumo se imputa a ese período (`card_period_id` = ese resumen)
- **AND** no se crea ningún `card_periods` nuevo

#### Scenario: Consumo posterior al último resumen dispara rolling legítimo

- **WHEN** el usuario registra un consumo con `date='2026-08-01'` y el último `card_periods` conocido termina el `2026-07-16`
- **THEN** el sistema crea un `card_periods` nuevo (`is_estimated=true`) contiguo a partir del `2026-07-17`
- **AND** el consumo se imputa a ese período

#### Scenario: Confirmar una instancia recurrente con fecha en un resumen pagado es rechazado

- **WHEN** el usuario confirma una instancia recurrente cuya fecha (`2026-06-25`) cae en un `card_periods` en estado `paid`
- **THEN** la confirmación falla con un mensaje que indica que la fecha cae en un resumen ya pagado
- **AND** no se crea ninguna transacción ni ningún `card_periods` nuevo
- **AND** la instancia sigue `pending`, y el usuario puede editar su fecha antes de confirmarla

---

### Requirement: Las transacciones de tarjeta NO impactan el saldo disponible del usuario

La regla normativa completa del off-ledger de tarjetas es el invariante `I-CRED-1`, y vive en la capability `cards` (requirement "Las tarjetas no descuentan disponible hasta el pago del resumen"). Este requirement NO la redefine: fija su consecuencia sobre el motor de saldos de esta capability y remite a la fuente para el enunciado completo.

El sistema SHALL excluir del cálculo de saldo de cualquier cuenta a las transacciones de `type='expense'` con `account.type='credit'`, **en cualquier status** (`pending` y `paid` por igual). El saldo de las cuentas `cash`/`bank` SHALL afectarse únicamente por:

- Sus propias transacciones `income` y `expense` (no de tarjeta).
- Transferencias entrantes/salientes con esa cuenta.
- Ajustes con esa cuenta.
- El `expense` generado por el flujo de "pago de resumen" (que vive en cash/bank, no en credit).

#### Scenario: 100 consumos en tarjeta no cambian el saldo de "Galicia"

- **WHEN** el usuario tiene `$500.000` en "Galicia" y registra 100 consumos por un total de `$2.000.000` en su tarjeta
- **THEN** "Galicia" sigue mostrando `$500.000`

#### Scenario: Pago de resumen por `$300.000` desde "Galicia" baja el saldo

- **WHEN** el usuario paga el resumen por `$300.000` desde "Galicia"
- **THEN** "Galicia" baja a `$200.000`

#### Scenario: Un consumo de tarjeta ya pagado tampoco vuelve al saldo

- **WHEN** un consumo de tarjeta pasa de `status='pending'` a `status='paid'` al pagarse el resumen
- **THEN** ese `expense` sigue excluido del cálculo de saldo de toda cuenta
- **AND** el único movimiento que afecta el saldo es el `expense` de pago en la cuenta `cash`/`bank`

### Requirement: Editar una compra en cuotas propaga campos no monetarios y bloquea cambios monetarios si hay cuotas paid

El sistema SHALL permitir editar la transacción madre de una compra en cuotas. Los campos `category_id`, `subcategory_id` y `description` SHALL propagarse automáticamente a todas las hijas. Los campos `amount`, `date` y la cantidad de cuotas (`installments_total`) SHALL ser editables únicamente si TODAS las hijas están en estado `pending` (ninguna `paid`); si alguna cuota ya pasó a `paid`, esos campos SHALL ser rechazados por la action.

#### Scenario: Edición de categoría propaga a hijas

- **WHEN** el usuario cambia la categoría de una compra en 6 cuotas
- **THEN** las 6 cuotas hijas reflejan la nueva categoría

#### Scenario: Edición de monto rechazada si alguna cuota está paid

- **WHEN** el usuario intenta cambiar el monto de una compra cuya cuota 1 ya está `paid`
- **THEN** la action retorna error
- **AND** el resto de los campos editables (categoría, descripción) sí se aceptan

---

### Requirement: Eliminar una compra en cuotas sólo es posible si todas las hijas están pending

El sistema SHALL permitir eliminar una transacción madre con `is_parent=true` únicamente si TODAS sus hijas están en estado `pending`. La eliminación SHALL cascadear: borra la madre y todas las hijas en una sola operación (vía `ON DELETE CASCADE` del FK `parent_id`).

#### Scenario: Eliminación válida con todas las cuotas pendientes

- **WHEN** el usuario elimina una compra en 6 cuotas donde todas las cuotas están `pending`
- **THEN** la madre y las 6 hijas se borran permanentemente
- **AND** ningún saldo cambia (las cuotas pending no afectaban al disponible)

#### Scenario: Eliminación rechazada si hay cuota paid

- **WHEN** el usuario intenta eliminar una compra en cuotas donde al menos una cuota está `paid`
- **THEN** la action retorna error con copy "No se puede eliminar — al menos una cuota ya fue pagada"

#### Scenario: Eliminar cuota individual no es posible

- **WHEN** un usuario o API intenta eliminar directamente una cuota hija (no la madre)
- **THEN** la action retorna error con copy "Para eliminar esta compra, eliminá la operación completa desde el detalle de la compra"

---

### Requirement: El sistema enforza que `fx_rate_to_ars` se popule solo y solamente en consumos de tarjeta no-ARS

El sistema SHALL respetar el invariante `I-CRED-11`: `transactions.fx_rate_to_ars` SHALL estar populado (NOT NULL, > 0) si y solo si `account.type='credit'` AND `currency_code != 'ARS'` AND `type='expense'` AND `is_parent=false`. En cualquier otro caso, `fx_rate_to_ars` SHALL ser `NULL`.

El sistema SHALL enforzar esto vía constraint `CHECK` con subquery sobre `accounts.type` (o trigger equivalente) y vía validación en las actions de inserción.

#### Scenario: Consumo USD en tarjeta exige fx_rate_to_ars

- **WHEN** se intenta insertar `expense` en tarjeta con `currency_code='USD'` y `fx_rate_to_ars=NULL`
- **THEN** la DB o action rechaza con error

#### Scenario: Consumo ARS en tarjeta no debe tener fx_rate_to_ars

- **WHEN** se intenta insertar `expense` en tarjeta con `currency_code='ARS'` y `fx_rate_to_ars=1400`
- **THEN** la DB o action rechaza con error

#### Scenario: Income en cuenta cash no debe tener fx_rate_to_ars

- **WHEN** se intenta insertar `income` con `fx_rate_to_ars` no nulo
- **THEN** la DB o action rechaza

### Requirement: Las transacciones de pago de resumen y reversión preservan el orden determinístico

El sistema SHALL preservar el ordering determinístico de los movimientos generados por el pago de resumen y por la reversión, según la regla general del proyecto (ver el requirement "El ordenamiento de transacciones en queries distingue uso de cálculo y uso de display" de esta misma capability): las queries de **cálculo** (saldos, totales corrientes) usan `date ASC, created_at ASC, id ASC` y las queries de **display** (listados mostrados al usuario) usan `date DESC, created_at DESC, id DESC`. Los `expense` de pago SHALL aparecer en la cuenta de pago con la fecha del pago.

#### Scenario: Lista de movimientos de "Galicia" muestra el pago como expense ordinario

- **WHEN** el usuario abre el detalle de "Galicia" después de pagar un resumen
- **THEN** la lista muestra ese `expense` en la posición correspondiente a su `date` (no agrupado aparte)
- **AND** el ordering del listado (display) respeta `date DESC, created_at DESC, id DESC`

### Requirement: El usuario puede crear una regla recurrente directamente, sin movimiento de origen

El sistema SHALL permitir crear una regla recurrente desde cero, sin partir de un movimiento ya registrado ni de una sugerencia. La regla SHALL persistirse en `recurrences` con `created_from_transaction_id = NULL` y `last_generated_date = NULL`, y NO SHALL crear ninguna transacción real ni ninguna instancia en el momento de la creación: la primera instancia la produce el generador de instancias.

La entrada SHALL validarse con el mismo modelo de datos que el resto del módulo (tipo funcional, cuenta o tarjeta, cuenta destino cuando aplique, moneda, monto, categoría cuando aplique, descripción, frecuencia como par `interval_count`+`interval_unit` con etiqueta preset o `custom`, `start_date`, y condición de fin opcional `end_date` y/o `max_occurrences`).

El server action SHALL rechazar entradas que violen los invariantes contables:
- `movement_type` SHALL ser uno de `income`, `expense`, `transfer` (los ajustes y las compras en cuotas NO admiten recurrencia).
- `income` y `expense` SHALL requerir `category_id`; `transfer` SHALL requerir `transfer_destination_account_id` distinto de `account_id` y NO SHALL llevar categoría.
- `amount` SHALL ser positivo.
- `currency_code` SHALL ser `ARS` o `USD` y SHALL ser una moneda activa de la cuenta (la bimoneda nunca se mezcla).
- `end_date`, si está presente, SHALL ser ≥ `start_date`.
- `account_id` y la cuenta destino, si aplica, SHALL pertenecer al usuario y estar activas.

Las reglas en tarjeta de crédito en moneda no-ARS NO SHALL capturar tipo de cambio al crearse: el `fx_rate` se solicita al confirmar cada instancia.

El sistema SHALL ofrecer un punto de entrada para este flujo desde la pantalla de recurrencias (`/transactions/recurring`).

#### Scenario: Crear un gasto recurrente desde cero

- **WHEN** el usuario abre el flujo de creación directa en `/transactions/recurring` y completa un gasto mensual de `$10.000` en una cuenta cash con categoría, `start_date = 2026-06-01`
- **THEN** el sistema crea una regla recurrente de tipo `expense` con `created_from_transaction_id = NULL` y `last_generated_date = NULL`
- **AND** no crea ninguna transacción real en `transactions`
- **AND** no crea ninguna instancia en `recurrence_instances` en ese momento

#### Scenario: Crear una transferencia recurrente desde cero

- **WHEN** el usuario crea una transferencia recurrente con cuenta origen y cuenta destino distintas y sin categoría
- **THEN** el sistema crea una regla `transfer` con `transfer_destination_account_id` poblado y `category_id = NULL`

#### Scenario: Rechazo de ajuste como recurrencia

- **WHEN** el usuario o una API intenta crear una regla directa con `movement_type = adjustment`
- **THEN** la action retorna error y no crea la regla

#### Scenario: Rechazo de categoría faltante en gasto

- **WHEN** el usuario intenta crear un gasto recurrente sin `category_id`
- **THEN** la action retorna error y no crea la regla

#### Scenario: Rechazo de fecha de fin anterior al inicio

- **WHEN** el usuario intenta crear una regla con `end_date` anterior a `start_date`
- **THEN** la action retorna error y no crea la regla

#### Scenario: Regla en tarjeta de crédito USD no captura fx_rate al crearse

- **WHEN** el usuario crea una regla recurrente `expense` en una tarjeta de crédito con `currency_code = USD`
- **THEN** la regla se crea sin tipo de cambio almacenado
- **AND** el tipo de cambio se solicitará al confirmar cada instancia

### Requirement: El detalle de una regla recurrente muestra el historial de sus instancias

El sistema SHALL mostrar, en la pantalla de detalle de una regla recurrente (`/transactions/recurring/<id>`), el historial de todas las instancias que la regla generó, cualquiera sea su estado (`pending`, `confirmed`, `skipped`). Cada instancia SHALL mostrar al menos su fecha programada, su monto y su estado. Una instancia omitida (`skipped`) SHALL seguir siendo visible en este historial (no se borra de la base al omitirla).

#### Scenario: Instancia omitida queda visible en el historial

- **WHEN** el usuario omite una instancia pendiente de una regla y luego abre el detalle de esa regla
- **THEN** el historial lista esa instancia con estado "Omitida", con su fecha y monto

#### Scenario: Regla sin instancias generadas

- **WHEN** el usuario abre el detalle de una regla recién creada que aún no generó ninguna instancia
- **THEN** el historial muestra un estado vacío en lugar de una lista

### Requirement: El usuario puede crear una regla recurrente al registrar un movimiento

El sistema SHALL permitir que el usuario marque como recurrente un movimiento al registrarlo. La recurrencia SHALL ser una regla separada del movimiento real y SHALL conservar los datos necesarios para generar futuras instancias: tipo funcional, cuenta o tarjeta, cuenta destino cuando aplique, moneda, monto, categoria cuando aplique, descripcion, frecuencia, fecha de inicio y condicion de fin opcional.

La frecuencia SHALL modelarse como un par `interval_count` (entero ≥ 1) e `interval_unit` (`day | week | month | year`). El campo `frequency` SHALL persistir la etiqueta de la regla: uno de los presets (`weekly`, `biweekly`, `monthly`, `annual`) o `custom`. Los presets SHALL resolver a un par intervalo+unidad fijo: `weekly`⇒`(1, week)`, `biweekly`⇒`(2, week)`, `monthly`⇒`(1, month)`, `annual`⇒`(1, year)`. `custom` SHALL usar el par elegido por el usuario.

La condicion de fin SHALL ser opcional y poder expresarse como `end_date` (fecha límite) y/o `max_occurrences` (entero ≥ 1, cantidad máxima de ocurrencias). Ambas pueden coexistir.

El movimiento semilla SHALL depender de la fecha elegida:

- **`date <= hoy_AR`**: el movimiento registrado SHALL crearse como transaccion real normal usando el flujo existente, y la regla SHALL apuntar a ese movimiento mediante `created_from_transaction_id` (comportamiento actual, sin cambios).
- **`date > hoy_AR`**: el sistema NO SHALL crear ninguna transaccion real ni ninguna instancia en ese momento. SHALL crear únicamente la regla, con la semántica de la creación directa: `created_from_transaction_id = NULL`, `last_generated_date = NULL` y `start_date =` la fecha elegida, de modo que la primera instancia pendiente la produzca el generador **exactamente en esa fecha** y pase por el gate de confirmación de instancias ("Las instancias recurrentes pendientes no son transacciones reales"). El saldo NO SHALL cambiar hasta que el usuario confirme esa instancia.

#### Scenario: Ingreso recurrente creado desde registro

- **WHEN** el usuario registra un ingreso con fecha de hoy y activa "Recurrente"
- **THEN** el sistema crea el ingreso real en `transactions` con `status=NULL`
- **AND** crea una regla recurrente de tipo `income`
- **AND** no crea una segunda transaccion para la primera recurrencia

#### Scenario: Gasto de tarjeta recurrente creado desde registro

- **WHEN** el usuario registra un consumo simple en tarjeta con fecha de hoy y activa "Recurrente"
- **THEN** el sistema crea el consumo real de tarjeta con `status='pending'` y `card_period_id`
- **AND** crea una regla recurrente de tipo `expense` asociada a esa tarjeta
- **AND** la regla no modifica el estado del resumen

#### Scenario: Transferencia recurrente creada desde registro

- **WHEN** el usuario registra una transferencia con fecha de hoy y activa "Recurrente"
- **THEN** el sistema crea la transferencia real
- **AND** crea una regla recurrente con cuenta origen y cuenta destino

#### Scenario: Movimiento recurrente con fecha futura no crea semilla

- **WHEN** hoy es `2026-07-31` y el usuario registra un gasto en cuenta cash con `date = 2026-08-10` y activa "Recurrente"
- **THEN** el sistema NO inserta ninguna fila en `transactions`
- **AND** crea una regla recurrente con `created_from_transaction_id = NULL`, `last_generated_date = NULL` y `start_date = 2026-08-10`
- **AND** el saldo de la cuenta no cambia

#### Scenario: La primera instancia de una regla sembrada a futuro cae en la fecha elegida

- **WHEN** existe una regla creada desde el form con `start_date = 2026-08-10` (fecha futura, sin semilla) y la fecha financiera AR llega a `2026-08-10`
- **THEN** el generador produce una única instancia pendiente con `scheduled_date = 2026-08-10`
- **AND** el saldo cambia recién cuando el usuario confirma esa instancia

#### Scenario: Consumo recurrente de tarjeta con fecha futura tampoco crea semilla

- **WHEN** el usuario registra un consumo simple en tarjeta con `date` futura y activa "Recurrente"
- **THEN** el sistema NO inserta ningún consumo con `card_period_id`
- **AND** crea la regla `expense` asociada a la tarjeta con `start_date =` la fecha elegida
- **AND** el resumen de la tarjeta no cambia hasta que el usuario confirme la instancia cuando llegue la fecha

### Requirement: La generación de instancias recurrentes usa intervalo+unidad y corta por la primera condición de fin

El sistema SHALL calcular la fecha de la siguiente instancia recurrente aplicando `interval_count` veces la `interval_unit`. La fecha base SHALL determinarse así:

- Si `last_generated_date` es NULL (regla creada directamente, sin ocurrencia semilla): la **primera** instancia se programa **exactamente en `start_date`** (no se suma intervalo).
- Si `last_generated_date` NO es NULL (reglas creadas desde un movimiento o desde una sugerencia, donde `start_date` ya está cubierto por una transacción real): la siguiente instancia se programa aplicando el intervalo sobre `last_generated_date`.

El cálculo SHALL aplicar clamping de fin de mes: avanzar por `month` o `year` desde un día que no existe en el mes destino SHALL caer al último día válido de ese mes (p. ej. 31-ene + 1 mes ⇒ 28/29-feb).

La generación SHALL cortar por la primera condición de fin que se cumpla (`end_date` o `max_occurrences`). Una sola instancia pendiente SHALL existir por regla a la vez; un `start_date` pasado en una regla directa NO SHALL generar instancias retroactivas por cada período vencido, sino una única instancia pendiente fechada en `start_date`.

`interval_count` + `interval_unit` son la **fuente de verdad** del cronograma; `frequency` es solo la etiqueta de presentación. Para los cuatro presets, la etiqueta y el intervalo SHALL ser coherentes (`weekly` ⇒ 1 `week`, `biweekly` ⇒ 2 `week`, `monthly` ⇒ 1 `month`, `annual` ⇒ 1 `year`); `custom` admite cualquier intervalo válido. Esa coherencia SHALL estar enforced por un `CHECK` en la base, de modo que ninguna escritura —de cualquier cliente— pueda dejar una regla cuya etiqueta contradiga su cronograma real.

#### Scenario: Primera instancia de una regla con semilla (last_generated_date no nulo)

- **WHEN** una regla tiene `start_date = 2026-01-15`, `last_generated_date = 2026-01-15` (creada desde un movimiento) y aún no generó instancias nuevas
- **THEN** la primera instancia generada se programa para `2026-02-15`

#### Scenario: Primera instancia de una regla directa (last_generated_date nulo)

- **WHEN** una regla mensual tiene `start_date = 2026-01-15`, `last_generated_date = NULL` (creada directamente) y hoy es ≥ `2026-01-15`
- **THEN** la primera instancia generada se programa **para `2026-01-15`**
- **AND** no se generan instancias adicionales mientras esa siga pendiente

#### Scenario: Regla directa con start_date futuro no genera todavía

- **WHEN** una regla directa tiene `start_date = 2026-12-01`, `last_generated_date = NULL` y hoy es anterior a esa fecha
- **THEN** no se genera ninguna instancia hasta que la fecha llegue

#### Scenario: Clamping de fin de mes en febrero

- **WHEN** una regla mensual tiene `start_date = 2026-01-31` y `last_generated_date = 2026-01-31`
- **THEN** la siguiente instancia after enero se programa para `2026-02-28`

#### Scenario: Corte por end_date

- **WHEN** una regla tiene `end_date = 2026-03-01` y la siguiente instancia caería el `2026-03-15`
- **THEN** no se genera ninguna instancia nueva

#### Scenario: La generación corta cuando alcanza max_occurrences

- **WHEN** una regla con `max_occurrences = 3` ya tiene 3 instancias materializadas
- **THEN** no se generan más instancias

#### Scenario: La base rechaza un preset incoherente con su intervalo

- **WHEN** cualquier cliente intenta insertar o actualizar una regla con `frequency = 'weekly'` e `interval_count = 1`, `interval_unit = 'month'`
- **THEN** la base rechaza la escritura por violación del `CHECK`

#### Scenario: Una frecuencia custom admite cualquier intervalo

- **WHEN** un cliente crea una regla con `frequency = 'custom'`, `interval_count = 3` e `interval_unit = 'day'`
- **THEN** la base acepta la escritura y el generador programa cada 3 días

---

### Requirement: Las instancias recurrentes pendientes no son transacciones reales

El sistema SHALL representar las ocurrencias pendientes de una regla recurrente en una entidad separada de `transactions`. Una instancia pendiente SHALL ser una propuesta editable y revisable por el usuario. Mientras este pendiente, SHALL NOT impactar saldos, resumenes de tarjeta, listados contables de cuenta ni `period_payments`.

El sistema SHALL NOT usar `transactions.status` para expresar pendiente/confirmado/omitido de recurrencias. `transactions.status` SHALL permanecer reservado para el estado de consumos de tarjeta frente al resumen (`pending`/`paid`).

#### Scenario: Instancia pendiente no impacta saldo

- **WHEN** se genera una instancia pendiente de gasto cash/bank por `$10.000 ARS`
- **THEN** no se inserta ninguna fila en `transactions`
- **AND** el saldo de la cuenta no cambia

#### Scenario: Instancia pendiente de tarjeta no aparece en resumen

- **WHEN** se genera una instancia pendiente de consumo recurrente de tarjeta
- **THEN** no se inserta ninguna fila con `card_period_id`
- **AND** el resumen de la tarjeta no cambia hasta que el usuario confirme

#### Scenario: Estado de recurrencia no usa `transactions.status`

- **WHEN** una instancia recurrente esta pendiente, confirmada u omitida
- **THEN** ese estado vive en la entidad de instancia recurrente
- **AND** ninguna migracion agrega valores como `posted` o `recurrence_pending` a `transactions.status`

---

### Requirement: El usuario puede confirmar una instancia recurrente

El sistema SHALL permitir confirmar una instancia recurrente pendiente. Al confirmar, el sistema SHALL crear una transaccion real usando el mismo contrato de creacion que usa un movimiento manual del mismo tipo. La instancia SHALL quedar vinculada a la transaccion creada mediante `confirmed_transaction_id`.

#### Scenario: Confirmar gasto cash/bank recurrente

- **WHEN** el usuario confirma una instancia de gasto recurrente en cuenta cash o bank
- **THEN** el sistema crea una transaccion `type='expense'` con `status=NULL`
- **AND** el saldo de esa cuenta baja segun las reglas existentes

#### Scenario: Confirmar consumo recurrente de tarjeta

- **WHEN** el usuario confirma una instancia de gasto recurrente en tarjeta de credito
- **THEN** el sistema crea un consumo de tarjeta con `status='pending'`, `card_period_id` y `due_date`
- **AND** si la moneda no es ARS, exige `fx_rate_to_ars`
- **AND** el saldo cash/bank no cambia

#### Scenario: Confirmar transferencia recurrente

- **WHEN** el usuario confirma una instancia de transferencia recurrente
- **THEN** el sistema crea una transaccion `type='transfer'`
- **AND** el saldo de la cuenta origen baja y el de la cuenta destino sube

#### Scenario: Confirmar consumo de tarjeta en periodo pagado falla

- **WHEN** una instancia recurrente de tarjeta tiene fecha dentro de un periodo ya pagado
- **THEN** la confirmacion falla con error explicativo
- **AND** no se crea ninguna transaccion
- **AND** la instancia permanece pendiente para que el usuario edite la fecha u omita

---

### Requirement: El usuario puede omitir una instancia recurrente

El sistema SHALL permitir omitir una instancia recurrente pendiente. Omitir SHALL resolver la instancia sin crear transaccion real y sin modificar saldos ni resumenes.

#### Scenario: Omitir gasto recurrente

- **WHEN** el usuario omite una instancia pendiente
- **THEN** la instancia queda marcada como omitida o se elimina segun la implementacion elegida
- **AND** no se inserta ninguna fila en `transactions`

---

### Requirement: El sistema genera instancias recurrentes de forma secuencial

El sistema SHALL generar como maximo una instancia pendiente por regla activa. La siguiente instancia SHALL generarse solamente despues de que la instancia actual haya sido confirmada u omitida. La fecha de la instancia SHALL ser la fecha que corresponde por frecuencia, no la fecha actual.

#### Scenario: Una sola instancia pendiente por regla

- **WHEN** una regla mensual ya tiene una instancia pendiente
- **THEN** abrir `/transactions` nuevamente no genera otra instancia para esa regla

#### Scenario: Usuario vuelve despues de varios meses

- **WHEN** el usuario abre la app despues de varios periodos sin resolver una regla
- **THEN** el sistema muestra solo la instancia pendiente mas antigua que corresponda
- **AND** no genera automaticamente todas las ocurrencias atrasadas

#### Scenario: Regla con fecha final

- **WHEN** la proxima fecha calculada supera `end_date`
- **THEN** el sistema no genera una nueva instancia
- **AND** desactiva la regla o la marca como finalizada

---

### Requirement: El usuario puede editar una instancia antes de confirmarla

El sistema SHALL permitir editar los campos mutables de una instancia recurrente pendiente antes de confirmarla. Los cambios de fecha, descripcion, categoria, subcategoria y **cuenta** SHALL aplicar a la instancia puntual. Si el usuario modifica el monto, el sistema SHALL actualizar tambien el monto de la regla recurrente.

El cambio de **cuenta** SHALL ser un override de la instancia puntual y NO SHALL propagarse a la regla recurrente: las instancias futuras se siguen generando con la cuenta de la regla. Es la diferencia deliberada con el monto — usar otro medio de pago una vez no redefine el medio por defecto.

La confirmación SHALL registrar la transacción real en la cuenta efectiva de la instancia, y SHALL derivar el tipo de movimiento resultante del tipo de esa cuenta: una cuenta de crédito produce un consumo de tarjeta (con su asignación de período), una cuenta cash/bank produce un movimiento on-ledger. La instancia confirmada SHALL conservar la cuenta con la que se confirmó, no la de la regla.

Una cuenta SHALL ser elegible para una instancia solo si pertenece al usuario, está activa, tiene **activa la moneda de la instancia** y es compatible con el tipo funcional de la regla: los ingresos y el origen de una transferencia NO SHALL admitir cuentas de crédito, y el origen de una transferencia NO SHALL ser su cuenta destino. El sistema SHALL revalidar la elegibilidad al confirmar, no solo al ofrecer las opciones.

Cuando la cuenta de la regla está archivada, el sistema SHALL permitir resolver la instancia eligiendo otra cuenta elegible, sin exigir editar la regla previamente.

#### Scenario: Editar fecha de consumo recurrente de tarjeta

- **WHEN** el usuario cambia la fecha de una instancia pendiente de tarjeta
- **THEN** la confirmacion usa la nueva fecha para asignar el `card_period_id`

#### Scenario: Editar monto y actualizar regla

- **WHEN** el usuario cambia el monto de una instancia pendiente
- **THEN** la instancia se confirma con el nuevo monto
- **AND** las futuras instancias de la regla se generan con ese nuevo monto

#### Scenario: Editar la cuenta no cambia la regla

- **WHEN** el usuario confirma una instancia de una regla de gasto en la cuenta "Santander" eligiendo la cuenta "Efectivo"
- **THEN** el movimiento real se registra en "Efectivo"
- **AND** la regla recurrente sigue teniendo "Santander" como cuenta
- **AND** la próxima instancia generada se propone en "Santander"

#### Scenario: Cambiar de cuenta a tarjeta convierte la confirmación en consumo de tarjeta

- **WHEN** el usuario confirma una instancia de gasto de una regla en cuenta bancaria eligiendo una tarjeta de crédito
- **THEN** el movimiento se registra como consumo de esa tarjeta, con `card_period_id` asignado por la fecha de la instancia
- **AND** el `disponible` de las cuentas no cambia (la tarjeta es off-ledger)

#### Scenario: Solo se ofrecen cuentas con la moneda de la instancia activa

- **WHEN** el usuario abre el selector de cuenta de una instancia en USD
- **THEN** el selector lista únicamente cuentas activas con USD activo
- **AND** confirmar con una cuenta sin esa moneda activa es rechazado con un mensaje explicativo

#### Scenario: Una instancia de ingreso no admite tarjeta de crédito

- **WHEN** el usuario abre el selector de cuenta de una instancia de ingreso
- **THEN** el selector no ofrece cuentas de crédito

#### Scenario: Confirmar una instancia cuya regla apunta a una cuenta archivada

- **WHEN** la cuenta de la regla está archivada y el usuario elige otra cuenta elegible en la instancia pendiente
- **THEN** la confirmación se registra en la cuenta elegida
- **AND** no se le exige editar la regla antes de confirmar

#### Scenario: La instancia confirmada conserva la cuenta usada

- **WHEN** el usuario confirma una instancia eligiendo una cuenta distinta a la de la regla
- **THEN** el historial de instancias de la regla muestra esa instancia con la cuenta con la que se confirmó

---

### Requirement: El modulo Movimientos muestra pendientes recurrentes separados del historial

El sistema SHALL mostrar las instancias recurrentes pendientes en `/transactions` en un bloque separado del historial cronologico normal. El historial normal SHALL contener solo movimientos reales derivados de `transactions`.

#### Scenario: Pendiente recurrente visible sobre el historial

- **WHEN** existen instancias recurrentes pendientes
- **THEN** `/transactions` muestra un bloque de pendientes con acciones de confirmar, editar y omitir
- **AND** debajo muestra el historial real de movimientos

#### Scenario: Movimiento confirmado aparece en historial

- **WHEN** el usuario confirma una instancia recurrente
- **THEN** se crea una transaccion real
- **AND** el movimiento aparece en el historial global segun su fecha contable

---

### Requirement: El usuario puede gestionar, pausar y eliminar reglas recurrentes

El sistema SHALL exponer una pantalla `/transactions/recurring` para ver y gestionar reglas recurrentes. La pantalla SHALL listar reglas activas y pausadas con tipo, descripcion, monto, cuenta o tarjeta, frecuencia, proxima fecha e indicador de instancia pendiente cuando exista. El sistema SHALL permitir pausar, reactivar y eliminar/desactivar reglas.

La **próxima fecha** mostrada SHALL derivarse del mismo caminante de calendario que la proyección de próximas ocurrencias y que el generador, honrando `last_generated_date`: nunca SHALL anunciarse como próxima una ocurrencia ya cubierta por un movimiento real.

#### Scenario: Acceso desde Movimientos

- **WHEN** el usuario abre `/transactions`
- **THEN** puede navegar a `/transactions/recurring`

#### Scenario: Regla eliminada no borra historial

- **WHEN** el usuario desactiva o elimina una regla recurrente
- **THEN** las transacciones reales ya confirmadas se conservan
- **AND** conservan su trazabilidad hacia la regla

#### Scenario: Regla pausada no genera instancias

- **WHEN** el usuario pausa una regla recurrente
- **THEN** el sistema no genera nuevas instancias pendientes para esa regla
- **AND** las transacciones ya confirmadas se conservan

#### Scenario: Regla pausada puede reactivarse

- **WHEN** el usuario reactiva una regla pausada
- **THEN** el sistema vuelve a considerarla para generar la proxima instancia pendiente segun su frecuencia

#### Scenario: La próxima fecha no repite una ocurrencia ya cubierta

- **WHEN** una regla mensual tiene `start_date = 2026-08-07` y `last_generated_date = 2026-08-07`, y hoy es `2026-08-04`
- **THEN** el hub muestra `2026-09-07` como próxima fecha, no `2026-08-07`

---

### Requirement: El hub de recurrencias proyecta las próximas ocurrencias sin repetir lo ya materializado

El hub de recurrencias **web** (`/transactions/recurring`) SHALL mostrar una proyección informativa de las próximas ocurrencias de las reglas **activas**, en dos ventanas disjuntas: **"Próximos 7 días"** (`[hoy, hoy+7]`) y **"Más adelante este mes"** (`[hoy+8, fin de mes]`), ambas computadas con la fecha financiera AR (`getTodayAR()`). La proyección SHALL ser pura: NO SHALL leer ni escribir instancias, NO SHALL generar nada y NO SHALL sumar montos entre monedas (invariante bimoneda — cada ocurrencia muestra el suyo).

Toda proyección de ocurrencias futuras —esta y cualquier otra superficie que anuncie "lo que viene", en web o en mobile— SHALL descartar las ocurrencias **en o antes de `last_generated_date`**, con el mismo criterio que el cálculo de la próxima fecha esperada: una ocurrencia ya cubierta por un movimiento real (la semilla de la regla) o por una instancia ya confirmada NO SHALL dibujarse como próxima. La proyección y el generador SHALL derivar de un único caminante de calendario, de modo que no puedan divergir: toda fila proyectada corresponde a una ocurrencia que el generador todavía puede producir.

Una instancia **pendiente** NO SHALL avanzar el cursor: su fecha sigue proyectándose, coherente con que vive en las superficies de "por confirmar" hasta que el usuario la resuelva.

#### Scenario: Una regla creada desde un movimiento no proyecta su propia semilla

- **WHEN** hoy es `2026-08-04` y existe una regla mensual con `start_date = 2026-08-04` y `last_generated_date = 2026-08-04` (creada desde un movimiento registrado hoy)
- **THEN** "Próximos 7 días" NO muestra una ocurrencia el `2026-08-04`
- **AND** la próxima ocurrencia proyectada de esa regla es el `2026-09-04`

#### Scenario: Una regla directa sin ocurrencias proyecta su start_date

- **WHEN** hoy es `2026-08-04` y existe una regla mensual con `start_date = 2026-08-07` y `last_generated_date = NULL`
- **THEN** "Próximos 7 días" muestra una ocurrencia el `2026-08-07`

#### Scenario: Una regla cuyo cursor quedó en el futuro no proyecta esa ocurrencia

- **WHEN** hoy es `2026-08-04` y existe una regla mensual con `start_date = 2026-08-07` y `last_generated_date = 2026-08-07`
- **THEN** ninguna de las dos cards muestra una ocurrencia el `2026-08-07`
- **AND** la próxima ocurrencia proyectada es el `2026-09-07`

#### Scenario: Las dos ventanas son disjuntas

- **WHEN** hoy es `2026-08-04` y una regla proyecta ocurrencias el `2026-08-07` y el `2026-08-21`
- **THEN** la del `2026-08-07` aparece solo en "Próximos 7 días" y la del `2026-08-21` solo en "Más adelante este mes"

#### Scenario: Una instancia pendiente sigue proyectándose

- **WHEN** una regla tiene una instancia pendiente sin confirmar fechada dentro de la ventana proyectada
- **THEN** esa ocurrencia sigue apareciendo en la card correspondiente
- **AND** el bloque de pendientes por confirmar la sigue mostrando con sus acciones

#### Scenario: La proyección no suma montos entre monedas

- **WHEN** las ocurrencias proyectadas incluyen reglas en ARS y en USD
- **THEN** cada fila muestra su propio monto en su moneda y el sistema no muestra ningún total combinado

---

### Requirement: El sistema avisa cuando una regla recurrente duplica una existente

Al crear una regla recurrente —desde cero o desde un movimiento— el sistema SHALL detectar si el usuario ya tiene una regla **activa** con la misma `(account_id, currency_code, movement_type, amount)` y SHALL avisarlo antes de confirmar, identificando la regla existente por su título visible y su próxima fecha.

El aviso SHALL ser **no bloqueante**: dos reglas con esos mismos campos pueden ser legítimamente distintas (dos suscripciones del mismo precio en la misma tarjeta), y la clave de detección deliberadamente ignora categoría y descripción porque en los duplicados reales esos campos difieren. El usuario SHALL poder confirmar la creación de todos modos.

El hub de recurrencias SHALL además señalar las reglas activas que colisionan con otra bajo esa misma clave, para que el usuario pueda resolverlas. La señalización SHALL ser informativa: el sistema NO SHALL eliminar, pausar ni fusionar reglas automáticamente.

#### Scenario: Aviso al crear una regla que colisiona

- **WHEN** el usuario crea una regla de gasto de `$450.000 ARS` en la cuenta "MP" y ya tiene una regla activa de gasto de `$450.000 ARS` en esa misma cuenta
- **THEN** el sistema avisa que ya existe una regla equivalente, mostrando su título y su próxima fecha
- **AND** permite confirmar la creación de todos modos

#### Scenario: El aviso no bloquea un duplicado legítimo

- **WHEN** el usuario ya tiene una regla "chat gpt" de `USD 20` en la tarjeta "Visa BBVA" y crea otra de `USD 20` en la misma tarjeta para "claude"
- **THEN** el sistema avisa, el usuario confirma y ambas reglas quedan activas

#### Scenario: Monto o cuenta distintos no disparan el aviso

- **WHEN** el usuario crea una regla de `$450.000 ARS` en una cuenta donde no tiene ninguna regla activa por ese monto
- **THEN** el sistema no muestra ningún aviso de duplicado

#### Scenario: El hub señala las reglas que colisionan

- **WHEN** el usuario tiene dos reglas activas con la misma cuenta, moneda, tipo y monto
- **THEN** el hub las señala como posibles duplicadas
- **AND** no las elimina, pausa ni fusiona por su cuenta

---

### Requirement: El sistema puede sugerir recurrencias por patrones repetidos

El sistema MAY detectar movimientos similares repetidos y sugerir al usuario crear una regla recurrente. Una sugerencia SHALL NOT crear reglas ni instancias por si sola. El usuario SHALL poder aceptar, editar antes de crear, o descartar la sugerencia. El sistema SHOULD calcular sugerencias on-the-fly a partir del historial y SHALL persistir los descartes por patron para no insistir.

#### Scenario: Sugerencia por movimientos repetidos

- **WHEN** el sistema detecta varios movimientos con descripcion normalizada, cuenta o tarjeta, categoria, moneda, monto similar y periodicidad compatibles
- **THEN** puede mostrar una sugerencia de recurrencia
- **AND** la sugerencia requiere confirmacion del usuario antes de crear la regla

#### Scenario: Sugerencia descartada

- **WHEN** el usuario descarta una sugerencia
- **THEN** el sistema recuerda el descarte para no insistir con el mismo patron

---

### Requirement: Las recurrencias iniciales excluyen ajustes y compras en cuotas

El sistema SHALL NOT ofrecer recurrencias para ajustes ni compras en cuotas en el alcance inicial.

#### Scenario: Compra en cuotas no ofrece recurrencia

- **WHEN** el usuario registra una compra en cuotas
- **THEN** el sistema no muestra el toggle de recurrencia para esa operacion

#### Scenario: Ajuste no ofrece recurrencia

- **WHEN** el usuario registra un ajuste de saldo
- **THEN** el sistema no muestra el toggle de recurrencia

### Requirement: El usuario puede editar y eliminar un movimiento desde el módulo global

El detalle global de un movimiento (`/transactions/<id>`) SHALL ofrecer las acciones de Editar y Eliminar, sin obligar al usuario a navegar primero al detalle en contexto de cuenta. La edición SHALL abrir la ruta canónica `/transactions/<id>/edit`, renderizada por el **formulario único** en modo edición. Estas acciones SHALL respetar exactamente las mismas reglas de edición y eliminación ya definidas (campos mutables por tipo, propagación en compras en cuotas, bloqueos por estado `paid`, y el guard de movimiento semilla de una regla recurrente), ahora gobernadas por la función pura `getEditableFields`. Ningún movimiento accesible desde el listado global SHALL quedar sin camino para editarse o eliminarse.

#### Scenario: Editar desde el detalle global

- **WHEN** el usuario abre un ingreso, gasto, transferencia, ajuste o cambio desde `/transactions` y elige "Editar"
- **THEN** el sistema navega a `/transactions/<id>/edit` y abre el formulario único con los campos editables según el tipo del movimiento (resueltos por `getEditableFields`)
- **AND** al guardar, recalcula los saldos afectados y vuelve al origen indicado por `?from=`

#### Scenario: Eliminar desde el detalle global

- **WHEN** el usuario elige "Eliminar" en el detalle global de un movimiento
- **THEN** el sistema pide confirmación antes de borrar
- **AND** al confirmar, elimina el movimiento, recalcula los saldos afectados y vuelve a `/transactions`

#### Scenario: Una compra en cuotas es accionable desde el detalle global

- **WHEN** el usuario abre una compra en cuotas (la madre, `is_parent=true`, `account_id=NULL`) desde `/transactions`
- **THEN** el detalle global ofrece Editar y Eliminar sin quedar en un callejón sin salida
- **AND** la eliminación solo procede si todas las hijas están `pending`, según las reglas existentes de compras en cuotas

#### Scenario: El monto es editable salvo en compras/consumos de tarjeta ya pagados

- **WHEN** el usuario edita un movimiento
- **THEN** el monto es editable para movimientos normales (efectivo/banco) y para consumos o compras de tarjeta **no pagados**
- **AND** al editar el monto de una compra en cuotas no pagada, el sistema re-divide el total entre las N cuotas (el residuo en la primera)
- **AND** si es un consumo simple de tarjeta `paid` o una compra en cuotas con alguna cuota `paid`, el monto y la fecha quedan bloqueados y solo se permite editar categoría/descripción

#### Scenario: Las acciones globales respetan los bloqueos existentes

- **WHEN** el usuario intenta editar un campo bloqueado o eliminar un movimiento no eliminable (p. ej. un consumo de tarjeta `paid` o una cuota individual)
- **THEN** el sistema rechaza la operación con el mismo criterio de siempre
- **AND** no se produce ningún cambio de estado ni de saldo

#### Scenario: Borrar un movimiento semilla desde el listado global pide resolver la regla

- **WHEN** el usuario elimina desde `/transactions/<id>` un movimiento que sembró una regla recurrente
- **THEN** el sistema aplica el mismo guard que en el detalle en contexto de cuenta, ofreciendo eliminar la regla o desvincularla
- **AND** no borra nada hasta que el usuario elija

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

### Requirement: El sistema usa un formulario único para crear y editar movimientos

El sistema SHALL usar **un único formulario** para crear y editar todo tipo de movimiento (ingreso, gasto, transferencia, ajuste, cambio de moneda, consumo de tarjeta y compra en cuotas). En **modo creación** el usuario elige el tipo y la cuenta dentro del formulario; en **modo edición** el tipo, la moneda y la(s) cuenta(s) se muestran como contexto inmutable y sólo se ofrecen los campos editables.

Un campo bloqueado NO SHALL desaparecer de la pantalla: cuando `getEditableFields` bloquea el **monto** o la **fecha** —un consumo de tarjeta ya pagado, una compra en cuotas madre con alguna cuota paga—, el formulario SHALL mostrar ese valor como contexto read-only. Bloquear un campo significa impedir su edición, nunca ocultar el dato: sin el monto y la fecha a la vista, el usuario estaría editando un movimiento cuyos dos hechos identificatorios no aparecen en ninguna parte.

**El contexto inmutable enuncia sólo lo que no está a la vista en otro lado.** En edición, el formulario SHALL mostrar como filas read-only —etiqueta, valor y caption de "no editable"— únicamente: la **cuenta** (o las dos puntas de una transferencia o cambio), la **cantidad de cuotas** de una compra en cuotas madre, y la **fecha** cuando `getEditableFields` la bloquea. NO SHALL enunciar el **tipo** ni la **moneda**: el tipo se lee del signo y el color del monto, y la moneda es el indicador del propio bloque del monto. Restar esas dos filas importa: son datos sobre los que el usuario no puede actuar y empujaban hacia abajo los campos que vino a editar.

**El monto conserva siempre su bloque de héroe.** Es el número que identifica al movimiento, así que NO SHALL degradarse a una fila ni omitirse. Cuando `getEditableFields` lo bloquea, el héroe SHALL renderizarse **read-only** —mismo bloque y mismo cuerpo tipográfico, sin campo de entrada, sin calculadora, con la moneda como indicador estático y el caption de "no editable"—.

Ambas reglas valen para las tres superficies (web escritorio, web en viewport angosto y app nativa).

Qué campos son editables y cuáles visibles según el tipo y el estado del movimiento SHALL derivarse de una **función pura** (`getEditableFields`) en `@grana/money-logic`, única fuente de verdad de esas reglas, reutilizable por web y mobile. Esta función NO cambia las reglas de editabilidad ya especificadas (ingreso/gasto, transferencia, ajuste, consumo `pending`/`paid`, madre de cuotas con o sin cuota pagada, pago de resumen sin categoría); las centraliza.

En **modo creación**, el selector de cuenta SHALL mostrar el **saldo disponible actual de cada cuenta por moneda** (bimoneda). Las tarjetas de crédito NO muestran saldo (son off-ledger).

**Cambios sin guardar.** El formulario SHALL exponer si algún campo que el usuario puede cambiar difiere de lo que el formulario abrió (estado *dirty*), derivado en el hook compartido y no en cada plataforma. Sobre eso:

- En **modo edición**, el CTA de guardar SHALL estar deshabilitado mientras no haya ningún cambio. Guardar sin cambios dispararía igual la mutation, invalidaría el cache y cerraría como si hubiera pasado algo.
- Cuando el formulario vive en un **overlay** (el drawer de alta y el de edición en web), cerrarlo con cambios sin guardar SHALL pedir confirmación antes de descartarlos, y SHALL hacerlo por **todos** los caminos de cierre —la ✕ del propio formulario, `Esc` y el click en el scrim—, no sólo por el botón. La confirmación ofrece descartar o seguir editando; descartar cierra y pierde los cambios, seguir editando deja el formulario intacto.
- Un submit exitoso NO SHALL pedir confirmación: ya no hay nada que perder.

#### Scenario: El mismo formulario crea y edita

- **WHEN** el usuario crea un movimiento nuevo y, en otro momento, edita uno existente
- **THEN** ambas pantallas usan el mismo formulario
- **AND** en edición el tipo, la moneda y la cuenta se muestran como contexto no editable

#### Scenario: La editabilidad la decide una función pura

- **WHEN** el formulario renderiza un movimiento en modo edición
- **THEN** los campos editables y visibles se determinan por `getEditableFields` según el tipo y estado del movimiento
- **AND** un consumo de tarjeta `paid` o una compra en cuotas con alguna cuota `paid` sólo permite editar categoría/descripción (monto y fecha bloqueados)

#### Scenario: Un monto bloqueado se muestra igual, como contexto

- **WHEN** el usuario abre en edición un consumo de tarjeta ya pagado, o la madre de una compra en cuotas con alguna cuota paga
- **THEN** el formulario NO ofrece el campo de monto ni el de fecha para editarlos
- **AND** muestra el monto en el héroe read-only, con su signo y su símbolo de moneda, de modo que se lee igual que en el detalle
- **AND** muestra la fecha como fila read-only, con caption de "no editable"

#### Scenario: El contexto inmutable no repite lo que ya está a la vista

- **WHEN** el usuario abre en edición un gasto con todos sus campos editables
- **THEN** el contexto read-only muestra la cuenta y nada más
- **AND** NO muestra una fila de tipo ni una de moneda: el tipo se lee del signo y el color del monto, y la moneda es el indicador del bloque del monto
- **AND** el monto conserva su bloque de héroe, read-only si está bloqueado

#### Scenario: Guardar está deshabilitado mientras no haya cambios

- **WHEN** el usuario abre un movimiento en modo edición y no toca ningún campo
- **THEN** el CTA de guardar está deshabilitado
- **AND** en cuanto cambia un campo, se habilita
- **AND** si deshace el cambio y vuelve al valor original, se deshabilita de nuevo

#### Scenario: Cerrar el overlay con cambios pide confirmación

- **WHEN** el usuario editó algún campo en el drawer y lo cierra —con la ✕, con `Esc` o clickeando el scrim—
- **THEN** el sistema pide confirmación antes de descartar
- **AND** "seguir editando" deja el formulario como estaba, con los cambios intactos
- **AND** "descartar" cierra el drawer y pierde los cambios

#### Scenario: Cerrar sin cambios no molesta

- **WHEN** el usuario abre el drawer, no cambia nada y lo cierra
- **THEN** el drawer se cierra directamente, sin confirmación

#### Scenario: El selector de cuenta muestra el saldo por moneda

- **WHEN** el usuario abre el formulario de alta y despliega el selector de cuenta
- **THEN** cada cuenta de efectivo/banco muestra su saldo disponible actual por moneda
- **AND** las tarjetas de crédito no muestran saldo

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

### Requirement: El sistema avisa sin bloquear cuando una operación dejaría el disponible de la cuenta en negativo

Cuando una operación reduciría el `disponible` de la cuenta origen por debajo de 0, el sistema SHALL mostrar un aviso no bloqueante antes de confirmar. El aviso informa al usuario; NO impide registrar la operación (el saldo negativo está permitido). La comparación SHALL hacerse contra el `disponible` actual de **esa cuenta puntual** (la cuenta origen del movimiento) y **por moneda** (ARS y USD se evalúan por separado, nunca combinados), NO contra un total agregado entre cuentas. Las operaciones cubiertas son: gasto, transferencia saliente, ajuste negativo, confirmación de instancia recurrente y pago de resumen de tarjeta. Las transacciones de tarjeta de crédito son off-ledger y NO disparan el aviso.

#### Scenario: Gasto que supera el disponible de la cuenta muestra aviso

- **WHEN** la cuenta "Galicia" tiene `disponible` ARS = `$8.000` y el usuario está por registrar un gasto de `$10.000 ARS`
- **THEN** el sistema muestra un aviso de que la operación deja el saldo de esa cuenta en negativo antes de confirmar

#### Scenario: El aviso no impide registrar

- **WHEN** el usuario confirma la operación a pesar del aviso
- **THEN** el sistema registra el movimiento normalmente
- **AND** el `disponible` de la cuenta queda en negativo (`-$2.000 ARS`), mostrado tal cual

#### Scenario: La comparación es por cuenta y por moneda, no por total

- **WHEN** el usuario tiene `disponible` ARS = `$8.000` en "Galicia" y `$50.000` en "Efectivo", y registra un gasto de `$10.000 ARS` en "Galicia"
- **THEN** el aviso se dispara porque la cuenta origen "Galicia" queda en negativo
- **AND** el saldo de otras cuentas o el total entre cuentas no se usa para decidir si avisar
- **AND** el `disponible` en USD de la misma cuenta no interviene en la evaluación

#### Scenario: Operación que no deja la cuenta en negativo no muestra aviso

- **WHEN** la cuenta tiene `disponible` ARS = `$50.000` y el usuario registra un gasto de `$10.000 ARS`
- **THEN** el sistema no muestra el aviso de saldo negativo

#### Scenario: El aviso cubre transferencia saliente, ajuste negativo, confirmar recurrencia y pago de resumen

- **WHEN** una transferencia saliente, un ajuste negativo, la confirmación de una instancia recurrente o un pago de resumen dejarían el `disponible` de la cuenta origen por debajo de 0
- **THEN** el sistema muestra el aviso no bloqueante antes de confirmar
- **AND** permite completar la operación si el usuario insiste

#### Scenario: Los consumos de tarjeta de crédito no disparan el aviso

- **WHEN** el usuario registra un consumo (simple o en cuotas) en una cuenta `type='credit'`
- **THEN** el sistema no muestra el aviso de saldo negativo
- **AND** el consumo no afecta el `disponible` de ninguna cuenta cash/bank (off-ledger)

### Requirement: El usuario puede registrar un cambio de moneda (exchange)

El sistema SHALL permitir registrar un movimiento `type='exchange'` (en la UI: "Cambio") que representa una conversión entre monedas: sale un monto en una moneda de una cuenta y entra otro monto en otra moneda. Un exchange requiere: cuenta origen (`account_id`), monto origen (`amount` > 0) y moneda origen (`currency_code`); cuenta destino (`transfer_destination_account_id`), monto destino (`destination_amount` > 0) y moneda destino (`destination_currency`); y fecha. La descripción es opcional. Las monedas origen y destino MUST ser distintas. La cuenta destino MAY ser la misma que la origen (cambio intra-cuenta) o distinta. Solo cuentas `cash`/`bank` son elegibles (las tarjetas de crédito no aplican). Un exchange no tiene categoría, no es ingreso ni gasto, y no admite recurrencia.

#### Scenario: Comprar dólares entre dos cuentas

- **WHEN** el usuario registra un exchange con origen "Galicia" `$150.000 ARS` y destino "Caja USD" `US$100`
- **THEN** el sistema persiste un movimiento `type='exchange'` con `amount=150000`, `currency_code='ARS'`, `destination_amount=100`, `destination_currency='USD'`

#### Scenario: Comprar dólares dentro de la misma cuenta

- **WHEN** el usuario registra un exchange con origen y destino en la misma cuenta "Billetera" (`$150.000 ARS` → `US$100`)
- **THEN** el sistema lo acepta (la cuenta origen y destino pueden coincidir si las monedas difieren)

#### Scenario: Vender dólares

- **WHEN** el usuario registra un exchange con origen `US$100` y destino `$160.000 ARS`
- **THEN** el sistema persiste el movimiento con las monedas invertidas respecto a una compra

#### Scenario: Monedas iguales es rechazado

- **WHEN** el usuario intenta registrar un exchange con `currency_code = destination_currency`
- **THEN** la operación es rechazada (un cambio requiere monedas distintas)

#### Scenario: La cotización se deriva y no se persiste

- **WHEN** se muestra un exchange de `$150.000 ARS` por `US$100`
- **THEN** la cotización mostrada es `1.500` (`150000 / 100`), calculada al vuelo
- **AND** no existe ninguna columna persistida con la cotización del exchange

#### Scenario: Una cuenta de crédito no es elegible

- **WHEN** el usuario intenta usar una cuenta `type='credit'` como origen o destino de un exchange
- **THEN** el sistema no la ofrece como opción (las tarjetas son off-ledger)

### Requirement: El cambio de moneda impacta los saldos por moneda y no cuenta como ingreso ni gasto

El cálculo de saldos SHALL tratar un `exchange` restando `amount` del ledger de `currency_code` de la cuenta origen y sumando `destination_amount` al ledger de `destination_currency` de la cuenta destino. ARS y USD se calculan por separado y nunca se combinan. Un exchange NO SHALL contar como ingreso ni como gasto en ninguna métrica (no infla gasto/ingreso del mes).

#### Scenario: La pata de origen resta y la de destino suma

- **WHEN** existe un exchange origen "Galicia" `$150.000 ARS` → destino "Caja USD" `US$100`
- **THEN** el `disponible` ARS de "Galicia" baja `$150.000` y el `disponible` USD de "Caja USD" sube `US$100`

#### Scenario: Intra-cuenta mueve entre los dos buckets de la misma cuenta

- **WHEN** existe un exchange dentro de "Billetera" (`$150.000 ARS` → `US$100`)
- **THEN** el `disponible` ARS de "Billetera" baja `$150.000` y su `disponible` USD sube `US$100`
- **AND** ninguna otra cuenta cambia

#### Scenario: No aparece como gasto ni ingreso del mes

- **WHEN** el usuario revisa sus métricas de gasto e ingreso del mes
- **THEN** el exchange no figura en ninguna de las dos (no es plata que se gastó ni que entró)

### Requirement: El cambio de moneda dispara el aviso de saldo negativo en la pata de origen

Cuando un exchange dejaría el `disponible` de la cuenta origen (en la moneda origen) por debajo de 0, el sistema SHALL mostrar el aviso no bloqueante de saldo negativo antes de confirmar, igual que las demás salidas cash/bank. El aviso informa; no impide registrar.

#### Scenario: Comprar más de lo disponible avisa pero no bloquea

- **WHEN** "Galicia" tiene `disponible` ARS = `$100.000` y el usuario registra un exchange que saca `$150.000 ARS`
- **THEN** el sistema muestra el aviso de que "Galicia" queda en negativo
- **AND** permite registrar igual; el `disponible` ARS de "Galicia" queda en `-$50.000`

### Requirement: El usuario puede editar y eliminar un cambio de moneda

El sistema SHALL permitir editar los montos (origen y destino), la fecha y la descripción de un exchange; las cuentas y las monedas son inmutables vía edición (como en transferencias). El sistema SHALL permitir eliminar un exchange. Editar o eliminar recalcula los saldos de ambos ledgers afectados.

#### Scenario: Editar los montos recalcula ambos ledgers

- **WHEN** el usuario edita un exchange y cambia el monto origen y/o destino
- **THEN** los `disponible` de la moneda origen y de la moneda destino se recalculan según los nuevos montos

#### Scenario: Eliminar un cambio recalcula ambos ledgers

- **WHEN** el usuario elimina un exchange
- **THEN** el `disponible` de la moneda origen vuelve a subir `amount` y el de la moneda destino vuelve a bajar `destination_amount`

### Requirement: El sistema sugiere una categoría según el historial del usuario

Al registrar un ingreso o un gasto, cuando el usuario ingresa una descripción que coincide (exacta, normalizada a minúsculas y sin espacios extremos) con la de una transacción anterior suya, el sistema SHALL ofrecer la categoría (y subcategoría, si la había) usada en esa transacción anterior como una **sugerencia no bloqueante** (un chip que el usuario puede tocar para aplicar). El sistema NO SHALL autocompletar la categoría: la sugerencia se aplica solo si el usuario la acepta. La sugerencia se muestra únicamente cuando existe una coincidencia **y** el usuario todavía no eligió categoría. La categoría sugerida SHALL ser compatible con el tipo del movimiento (un gasto no sugiere una categoría de ingreso). Aplica solo a ingreso y gasto.

#### Scenario: Sugiere la categoría usada la última vez para esa descripción

- **WHEN** el usuario escribe la descripción "Coto" en un gasto, y su última transacción con descripción "coto" estaba categorizada como "Supermercado"
- **THEN** el sistema muestra un chip que sugiere "Supermercado" (con el porqué: la última vez se usó esa categoría)
- **AND** al tocar el chip, la categoría del formulario queda en "Supermercado"

#### Scenario: La sugerencia incluye la subcategoría si la había

- **WHEN** la transacción anterior coincidente tenía categoría y subcategoría
- **THEN** tocar el chip aplica tanto la categoría como la subcategoría

#### Scenario: Sin historial coincidente no hay sugerencia

- **WHEN** el usuario escribe una descripción que nunca usó antes (o no usó con una categoría)
- **THEN** el sistema no muestra ninguna sugerencia (la Capa de keywords es otra capacidad futura)

#### Scenario: El tipo de la categoría debe coincidir con el del movimiento

- **WHEN** una descripción coincide con una transacción anterior, pero su categoría es de tipo ingreso y el movimiento actual es un gasto
- **THEN** el sistema no sugiere esa categoría

#### Scenario: La sugerencia no se impone

- **WHEN** hay una sugerencia disponible y el usuario la ignora
- **THEN** el formulario queda sin categoría (la sugerencia nunca se aplica sola)

#### Scenario: No aplica a transferencias, ajustes ni cambios

- **WHEN** el usuario registra una transferencia, un ajuste o un cambio de moneda
- **THEN** el sistema no ofrece sugerencia de categoría (esos movimientos no tienen categoría)

### Requirement: El sistema anticipa que recordará la categoría para la próxima vez

Al registrar un ingreso o un gasto, cuando el usuario ingresa una descripción que **no coincide** con ninguna transacción anterior suya (es decir, la sugerencia por historial no encontró nada) y luego elige una categoría, el sistema SHALL mostrar un **aviso informativo y no bloqueante** indicando que la próxima vez que cargue esa misma descripción se le va a sugerir esa categoría. El aviso es puramente informativo: NO es accionable, NO cambia el guardado, NO autocompleta ni persiste nada. Aplica solo a ingreso y gasto.

Este aviso SHALL ser mutuamente excluyente con la sugerencia por historial: el chip de sugerencia aparece cuando hay coincidencia; el aviso aparece cuando NO la hay. Nunca se muestran simultáneamente.

#### Scenario: Avisa al categorizar una descripción nueva

- **WHEN** el usuario escribe la descripción "Verdulería del barrio" (que nunca usó antes) en un gasto y elige la categoría "Comida"
- **THEN** el sistema muestra un aviso informativo de que la próxima vez que cargue "Verdulería del barrio" se le va a sugerir "Comida"
- **AND** el aviso no bloquea ni modifica el guardado del gasto

#### Scenario: No avisa si la descripción ya tenía historial

- **WHEN** la descripción que el usuario escribe SÍ coincide con una transacción anterior (por lo que ya apareció el chip de sugerencia)
- **THEN** el sistema NO muestra el aviso (mostrar la promesa sería redundante con el chip que ya cumplió)

#### Scenario: No avisa sin categoría elegida

- **WHEN** el usuario escribe una descripción nueva pero todavía no eligió ninguna categoría
- **THEN** el sistema NO muestra el aviso (no hay categoría futura que prometer)

#### Scenario: No avisa sin descripción

- **WHEN** el usuario elige una categoría pero no escribió descripción (o es demasiado corta para normalizar)
- **THEN** el sistema NO muestra el aviso (no hay descripción que recordar)

#### Scenario: No aplica a transferencias, ajustes ni cambios

- **WHEN** el usuario registra una transferencia, un ajuste o un cambio de moneda
- **THEN** el sistema no muestra el aviso (esos movimientos no tienen categoría)

---

### Requirement: El listado de movimientos usa una fila única resuelta por perspectiva

El sistema SHALL renderizar todas las filas de movimiento —tanto en el módulo global `/transactions` como en la lista del detalle de una cuenta— con un **único componente de fila**. La presentación de cada movimiento (signo, monto relevante, moneda mostrada y contraparte) SHALL resolverse mediante una función pura `resolveMovementView(movimiento, perspectiva)` que vive en `@grana/money-logic`, parametrizada por una **perspectiva**:

- Perspectiva `global`: punto de vista neutral; un movimiento con dos cuentas (transferencia, cambio de moneda) muestra ambas puntas y la cuenta participante en el subtítulo.
- Perspectiva de cuenta: punto de vista egocéntrico desde una cuenta; el movimiento se reinterpreta por cómo afecta a esa cuenta (signo entrante/saliente, qué pata del cambio de moneda, contraparte) y se omite la propia cuenta del subtítulo por redundante.

No SHALL existir lógica de presentación de fila duplicada entre las dos vistas: ambas consumen el mismo resolver y el mismo componente.

#### Scenario: La misma fila sirve a la vista global y a la de cuenta

- **WHEN** el sistema renderiza un gasto en `/transactions` y luego el mismo gasto en el detalle de su cuenta
- **THEN** ambas filas se renderizan con el mismo componente y el mismo resolver
- **AND** los marcadores de estado del movimiento (recurrencia, revisión) aparecen en las dos vistas por igual

#### Scenario: La perspectiva global muestra ambas puntas de una transferencia

- **WHEN** el sistema renderiza una transferencia A → B en `/transactions`
- **THEN** la fila muestra origen y destino ("A → B") sin signo de entrada ni de salida atado a una cuenta

#### Scenario: La perspectiva de cuenta reinterpreta la transferencia

- **WHEN** el sistema renderiza la transferencia A → B en el detalle de la cuenta A y luego en el de la cuenta B
- **THEN** en A la fila muestra signo `−` y contraparte "→ B"
- **AND** en B la fila muestra signo `+` y contraparte "← A"

#### Scenario: La perspectiva de cuenta elige la pata del cambio de moneda

- **WHEN** existe un cambio de moneda con pata origen en la cuenta A (ARS) y pata destino en la cuenta B (USD), y el sistema lo renderiza en el detalle de A
- **THEN** la fila muestra el monto y la moneda de la pata que afecta a A (salida en ARS)
- **AND** al renderizarlo en el detalle de B muestra el monto y la moneda de la pata destino (entrada en USD)

---

### Requirement: La fila de movimiento muestra ícono de categoría, jerarquía y color semántico

El sistema SHALL renderizar cada fila de movimiento con la siguiente anatomía visual:

- **Ícono** según dos familias: los movimientos categorizables (ingreso, gasto, compra en cuotas) SHALL mostrar el emoji y color de su categoría; los movimientos de estructura (transferencia, cambio de moneda, ajuste, pago de resumen) SHALL mostrar un ícono neutro propio de su tipo.
- **Jerarquía** de texto invertida: el título primario SHALL ser la descripción que escribió el usuario; el subtítulo secundario SHALL ser la categoría y, cuando el usuario tiene dos o más cuentas, la cuenta (`categoría · cuenta`). Si el movimiento no tiene descripción, el título primario SHALL caer a la categoría o al nombre funcional del tipo.
- **Color del monto** semántico, expresado mediante tokens editoriales y no colores Tailwind crudos:
  - **Income** (ingreso, reintegro recibido, ajuste positivo) → `text-income` (alias de la paleta emerald del repo).
  - **Expense** (gasto en cash/bank, consumo de tarjeta, cuota de tarjeta, pago de resumen, ajuste negativo) → `text-expense` (terracota editorial, token `#B56A5A`). NO usar `text-red-*` crudo.
  - **Neutro** (transferencia, cambio de moneda) → `text-neutral-amount` (alias del color de texto primario navy).
  - **Pendiente** (reintegro esperado, no recibido) → `text-pending` (alias del muted), distinguible visualmente del income real para no transmitir confianza que el ingreso aún no ocurrió.
- **Etiqueta de moneda** fiel al principio bimoneda: ARS no SHALL llevar etiqueta de moneda (es la primaria); USD SHALL mostrarse etiquetada.

La cuenta en el subtítulo SHALL mostrarse únicamente cuando el usuario tiene dos o más cuentas; con una sola cuenta se omite.

#### Scenario: Un gasto muestra el color de expense terracota

- **WHEN** el sistema renderiza un gasto categorizado como "Comida"
- **THEN** la fila muestra el emoji y color de esa categoría como ícono
- **AND** el monto se muestra con el token `text-expense` (terracota, no rojo Tailwind crudo)

#### Scenario: Un reintegro pendiente se distingue del income real

- **WHEN** el sistema renderiza un reintegro con `received_at IS NULL` (esperado, no recibido)
- **THEN** el monto se muestra con `text-pending` (gris muted)
- **AND** la fila incluye la etiqueta "esperado" debajo del monto

#### Scenario: Una transferencia muestra ícono neutro y monto en color neutro

- **WHEN** el sistema renderiza una transferencia
- **THEN** la fila muestra un ícono de estructura neutro (no un emoji de categoría)
- **AND** el monto se muestra con `text-neutral-amount` (no income ni expense)

#### Scenario: La descripción es el título primario

- **WHEN** el usuario registró un gasto "Coto" categorizado como "Comida"
- **THEN** la fila muestra "Coto" como título primario y "Comida" como subtítulo

#### Scenario: Sin descripción el título cae a la categoría

- **WHEN** el sistema renderiza un gasto sin descripción categorizado como "Transporte"
- **THEN** la fila muestra "Transporte" como título primario

#### Scenario: La cuenta en el subtítulo depende de la cantidad de cuentas

- **WHEN** un usuario con dos o más cuentas ve un gasto en el listado global
- **THEN** el subtítulo incluye la cuenta (`categoría · cuenta`)
- **AND** el mismo gasto para un usuario con una sola cuenta muestra solo la categoría

#### Scenario: La etiqueta de moneda respeta bimoneda

- **WHEN** el sistema renderiza un movimiento en ARS y otro en USD
- **THEN** el de ARS no muestra etiqueta de moneda y el de USD se muestra etiquetado como USD

---

### Requirement: La fila de movimiento muestra marcadores de estado

El sistema SHALL mostrar en la fila los marcadores de estado aplicables al movimiento, sin alterar su impacto contable:

- **Recurrencia**: chip con label "Recurrente" e ícono `Repeat` integrado, en color slate (token `--slate`, fondo soft `rgba(58,107,138,0.12)`). El chip se ubica al lado del título primario. Aplica tanto a movimientos generados por una regla recurrente como a movimientos cuya descripción coincide con un patrón recurrente detectado y confirmado.
- **Revisión**: chip con label corto ("Revisar") e ícono triangular de alerta, en color warning (amber soft).
- **Cuota**: para una cuota de tarjeta, la posición de la cuota (`3/6`) en un chip neutro.
- **Pendiente**: para un consumo de tarjeta cuyo período aún no fue pagado, etiqueta "pendiente" en un chip neutro.

Los marcadores de recurrencia y revisión SHALL aparecer tanto en el listado global como en el de cuenta. Los grupos de fecha del listado SHALL usar etiquetas relativas ("Hoy", "Ayer") y fecha para días anteriores.

#### Scenario: El marcador de recurrencia es un chip con label

- **WHEN** el sistema renderiza un movimiento generado por una regla recurrente
- **THEN** la fila muestra un chip slate con ícono `Repeat` y el texto "Recurrente" al lado del título
- **AND** el chip es claramente reconocible sin tener que pasar el cursor

#### Scenario: Movimiento recurrente y a revisar conservan sus marcadores en ambas vistas

- **WHEN** un gasto generado por una recurrencia y sin categoría se muestra en `/transactions` y en el detalle de su cuenta
- **THEN** en ambas vistas la fila muestra el chip de recurrencia y el chip de revisión

#### Scenario: Una cuota muestra su posición

- **WHEN** el sistema renderiza la tercera cuota de una compra en 6 cuotas
- **THEN** la fila muestra el marcador "3/6"

#### Scenario: Un consumo de tarjeta no pagado se marca pendiente

- **WHEN** el sistema renderiza un consumo de tarjeta cuyo período no fue pagado
- **THEN** la fila muestra el marcador "pendiente"

#### Scenario: Los grupos de fecha usan etiquetas relativas

- **WHEN** el listado agrupa movimientos del día actual, del día anterior y de días previos
- **THEN** los encabezados muestran "Hoy", "Ayer" y la fecha respectivamente

---

### Requirement: El listado de movimientos no muestra totales agregados

El listado de movimientos NO SHALL mostrar totales por día en los encabezados de fecha. El resumen del período (lo que entró y salió por moneda, y lo comprometido en tarjetas) es responsabilidad del **dashboard**, no del listado, para no duplicar el panorama mensual. La lógica pura de ese resumen (`summarizePeriod`, por moneda, regla del dashboard, comprometido = cuotas devengadas) vive en `@grana/money-logic` lista para que el dashboard la consuma.

#### Scenario: Los encabezados de fecha no muestran totales

- **WHEN** el sistema agrupa los movimientos por fecha
- **THEN** cada encabezado muestra solo la fecha (relativa), sin un total del día

---

### Requirement: El listado de una cuenta muestra el saldo corriente por fila

En la perspectiva de cuenta, el sistema SHALL mostrar junto a cada fila el saldo corriente (running balance) de la cuenta resultante después de ese movimiento, calculado por moneda. El saldo corriente SHALL derivarse del historial de transacciones; NO SHALL persistirse en ninguna columna.

El saldo corriente SHALL mostrarse cuando se ven los movimientos de la cuenta en orden, **incluida la navegación por mes**: navegar de mes es navegación temporal, no un filtro de contenido, y el saldo se recalcula sobre el historial previo al mes visible. Los **filtros de contenido** (búsqueda de texto, tipo, categoría, subcategoría, rango de monto) SÍ ocultan el saldo corriente, porque saltean filas y un acumulado parcial sería incorrecto. En la perspectiva global el saldo corriente NO SHALL mostrarse (mezclaría cuentas y monedas).

Esta regla es independiente del modelo de estado de los filtros (URL, React state, etc.) — depende exclusivamente de qué filtros están activos al momento de renderizar la lista. Cuando `/accounts/[id]` está implementado como shell client con TanStack Query, el cómputo del running balance SHALL ejecutarse client-side a partir del historial ascendente completo de la cuenta (obtenido como query separada o como parte de la página de movimientos), aplicando `computeRunningBalances` del paquete `@grana/money-logic`.

#### Scenario: Cada fila muestra el saldo resultante por moneda

- **WHEN** el usuario abre el detalle de una cuenta sin filtros de contenido
- **THEN** cada fila muestra el saldo de la cuenta en la moneda del movimiento, resultante después de ese movimiento

#### Scenario: Navegar por mes no oculta el saldo corriente

- **WHEN** el usuario navega a otro mes en el detalle de la cuenta (sin filtros de contenido)
- **THEN** el saldo corriente se sigue mostrando, recalculado con el historial previo al mes visible

#### Scenario: Los filtros de contenido ocultan el saldo corriente

- **WHEN** el usuario aplica un filtro de tipo, categoría, subcategoría, búsqueda de texto o rango de monto en el detalle de la cuenta
- **THEN** el saldo corriente por fila se oculta

#### Scenario: El listado global no muestra saldo corriente

- **WHEN** el usuario abre `/transactions`
- **THEN** las filas no muestran saldo corriente

#### Scenario: Cómputo client-side preserva el resultado

- **WHEN** el shell client de `/accounts/[id]` calcula el running balance con `computeRunningBalances` sobre el historial ascendente devuelto por la query
- **THEN** los saldos por fila coinciden numéricamente con los que producía el cálculo server-side previo (mismas reglas: incluye ingresos, gastos, transferencias salientes/entrantes, ajustes; excluye `is_parent=true` y transacciones de tarjeta `expense` con `status='pending'`)

### Requirement: El usuario puede declarar un reintegro al registrar un gasto

Al registrar un gasto, el usuario SHALL poder declarar opcionalmente que ese gasto tiene un reintegro asociado, mediante un bloque "Tiene reintegro". Al activarlo, el usuario SHALL indicar el **monto esperado**, el **subtipo** (a cuenta / en resumen) y si el reintegro **ya fue recibido** o queda pendiente. El sistema SHALL crear el gasto y el reintegro en una **operación atómica**: si la creación del reintegro falla, el gasto tampoco se crea.

El subtipo "en resumen" SHALL ofrecerse únicamente cuando el gasto es sobre una tarjeta de crédito; "a cuenta" SHALL estar disponible para cualquier medio de pago, y SHALL ser el default.

Para el subtipo "a cuenta", la cuenta de acreditación SHALL prerellenarse con una cuenta del **mismo banco/institución** que la cuenta del gasto, cuando exista (refleja el comportamiento real); el usuario puede cambiarla.

El bloque "Tiene reintegro" SHALL estar disponible tanto en una compra de un solo pago como en una compra **en cuotas**. En una compra en cuotas, el reintegro SHALL vincularse a la **madre** de la compra (`linked_transaction_id = id de la madre`, un `expense` off-ledger con `is_parent = true`), no a una cuota hija; la atomicidad SHALL abarcar madre, cuotas y reintegro (si el reintegro falla, no se crea nada). Para el subtipo "en resumen" sobre una compra en cuotas, el reintegro SHALL imputarse al período de la **primera cuota** (el período de la fecha de compra), sin ofrecer un selector de período; el usuario reconcilia el período real al confirmarlo. Cuando la compra en cuotas es **compartida**, el reintegro SHALL heredar el mismo split del hogar en una única fila, de modo que la deuda derivada lo netee correctamente.

**Fecha contable del reintegro.** La fecha del reintegro declarado SHALL tomar por default la **fecha del gasto que le dio origen**, nunca el día de carga. Un reintegro pendiente reconcilia su fecha real al confirmarlo; uno recibido queda con la fecha del gasto salvo que el usuario indique otra. Si más tarde se edita la fecha del gasto, el sistema SHALL propagar la nueva fecha a los reintegros vinculados **cuya fecha todavía coincidía con la fecha anterior del gasto** (los que la venían siguiendo por default), dejando intactos los que tienen una fecha de acreditación distinta puesta a mano. No propagar esto dejaba al reintegro varado en el día de carga, desalineado del gasto.

#### Scenario: Declarar un reintegro pendiente a cuenta

- **WHEN** el usuario registra un gasto y activa "Tiene reintegro" con un monto, subtipo "a cuenta", sin marcarlo como recibido
- **THEN** el sistema crea el gasto y un reintegro pendiente vinculado al gasto, en una sola operación atómica
- **AND** si la creación del reintegro falla, el gasto tampoco se crea

#### Scenario: "En resumen" sólo está disponible en gastos de tarjeta

- **WHEN** el gasto es sobre una cuenta cash o débito
- **THEN** sólo está disponible el subtipo "a cuenta"
- **AND** cuando el gasto es sobre una tarjeta de crédito, se ofrecen ambos subtipos

#### Scenario: La cuenta de acreditación se prerellena por institución

- **WHEN** el usuario activa el reintegro "a cuenta" sobre un gasto pagado con una tarjeta del banco X
- **THEN** la cuenta de acreditación se prerellena con una cuenta del banco X, si existe

#### Scenario: Declarar un reintegro ya recibido en el mismo alta

- **WHEN** el usuario registra el gasto y marca "Ya me lo acreditaron"
- **THEN** el reintegro se crea con `received_at` seteado y entra en los cálculos como un hecho real, sin pasar por el estado pendiente

#### Scenario: Editar la fecha del gasto arrastra la del reintegro que la seguía

- **WHEN** el usuario cambia la fecha de un gasto de `2026-08-03` a `2026-07-15`, y el gasto tiene un reintegro vinculado cuya fecha era `2026-08-03` (la que venía siguiendo del gasto)
- **THEN** el reintegro pasa a fecha `2026-07-15`
- **AND** un reintegro del mismo gasto con una fecha de acreditación distinta puesta a mano NO se modifica

#### Scenario: Declarar un reintegro a cuenta en una compra en cuotas

- **WHEN** el usuario registra una compra en cuotas y activa "Tiene reintegro" con subtipo "a cuenta"
- **THEN** el sistema crea la madre, las N cuotas y un reintegro vinculado a la **madre**, en una sola operación atómica
- **AND** si la creación del reintegro falla, no se crea ni la madre ni ninguna cuota

#### Scenario: Reintegro en resumen sobre una compra en cuotas cae en el período de la primera cuota

- **WHEN** el usuario registra una compra en cuotas sobre una tarjeta y declara un reintegro "en resumen"
- **THEN** el reintegro se imputa al período de la **primera cuota** (el período de la fecha de compra), sin pedirle al usuario que elija un período
- **AND** al confirmarlo el usuario puede reconciliar el período real donde efectivamente se acreditó

#### Scenario: El reintegro de una compra en cuotas compartida hereda el split

- **WHEN** el usuario registra una compra en cuotas **compartida** (split 50/50) por $60.000 y declara un reintegro recibido de $12.000
- **THEN** el reintegro se crea con el mismo split del hogar en una única fila
- **AND** la deuda derivada del otro miembro refleja su parte del gasto menos su parte del reintegro (p. ej. +$30.000 de las cuotas − $6.000 del reintegro = $24.000)

### Requirement: El reintegro es un tipo de movimiento propio vinculado al gasto

El sistema SHALL modelar el reintegro como un movimiento de tipo propio `reimbursement` —NO como `income` ni como `adjustment`— vinculado al gasto origen mediante `linked_transaction_id`. El gasto origen NO SHALL modificarse al crear el reintegro.

El reintegro SHALL heredar la categoría del gasto origen: el sistema deriva la categoría desde el gasto vinculado en lectura y NO SHALL almacenar una categoría propia. El reintegro NO SHALL contarse como ingreso genérico en ningún total de "lo que entró".

El `linked_transaction_id` SHALL apuntar a un gasto (`type='expense'`) del mismo usuario; el sistema SHALL rechazar vincular un reintegro a un movimiento de otro usuario o que no sea un gasto. Un mismo gasto SHALL poder tener **N reintegros** asociados; el sistema NO SHALL imponer unicidad sobre `linked_transaction_id`.

#### Scenario: El reintegro hereda la categoría del gasto

- **WHEN** un gasto categorizado como "Supermercado" tiene un reintegro asociado
- **THEN** el reintegro se muestra con la categoría "Supermercado" derivada del gasto

#### Scenario: El reintegro no es ingreso genérico

- **WHEN** el sistema calcula "lo que entró" del mes
- **THEN** los reintegros no se cuentan como ingreso

#### Scenario: El vínculo respeta el dueño y el tipo

- **WHEN** se intenta vincular un reintegro a una transacción de otro usuario o a un movimiento que no es un gasto
- **THEN** el sistema rechaza la operación

### Requirement: Un reintegro pendiente no impacta saldos y se muestra separado del historial

En un reintegro pendiente (`received_at` sin setear), el campo `amount` representa el **monto estimado vigente** y NO SHALL impactar ningún cálculo (saldo, saldo corriente, total de resumen ni neto). Recién cuando `received_at` está seteado, `amount` representa el **monto real reconciliado** y entra en saldos, resumen de tarjeta o analytics.

Los reintegros pendientes NO SHALL aparecer en el historial cronológico de movimientos: SHALL listarse en un bloque **"Reintegros a confirmar"** arriba del listado (en el módulo global y en el detalle de la cuenta de acreditación), separando la expectativa del hecho. Sólo los reintegros **recibidos** SHALL aparecer en el historial; los cancelados no aparecen en ninguno.

El sistema SHALL conservar un `estimated_amount` **inmutable** con lo que el usuario esperaba, para auditar la diferencia entre lo esperado y lo recibido.

#### Scenario: Un reintegro pendiente no suma al saldo ni aparece en el historial

- **WHEN** existe un reintegro pendiente "a cuenta" de $20.000
- **THEN** el saldo de la cuenta no incluye los $20.000
- **AND** el reintegro no aparece en el historial cronológico, sino en el bloque "Reintegros a confirmar"

#### Scenario: El monto estimado se conserva al reconciliar

- **WHEN** un reintegro se declaró con $20.000 esperados y se confirma con $18.000 reales
- **THEN** `amount` pasa a $18.000 y `estimated_amount` sigue siendo $20.000

### Requirement: El usuario confirma un reintegro reconciliando monto, fecha y destino

Confirmar un reintegro SHALL ser una **reconciliación**: al recibirlo, el usuario SHALL poder ajustar el **monto real** y la **fecha**. El sistema setea `received_at` al confirmar y NO SHALL alterar `estimated_amount`.

Para el subtipo "en resumen", el sistema SHALL determinar el **período de tarjeta** a partir de la fecha (que por defecto es la del consumo y el usuario puede cambiar), y NO SHALL permitir confirmarlo contra un período **ya pagado**.

#### Scenario: Reconciliar con un monto distinto al esperado

- **WHEN** el usuario confirma un reintegro esperado de $20.000 indicando que recibió $18.000
- **THEN** el reintegro queda recibido con `amount` $18.000 y entra en los cálculos por ese valor

#### Scenario: El período "en resumen" se deriva de la fecha

- **WHEN** el usuario confirma un reintegro "en resumen"
- **THEN** el sistema lo asigna al período de tarjeta que cubre la fecha indicada
- **AND** si ese período ya fue pagado, la confirmación se rechaza

### Requirement: El reintegro "a cuenta" recibido impacta el saldo de la cuenta

Un reintegro de subtipo "a cuenta" recibido SHALL sumar al saldo (y al saldo corriente) de la cuenta cash/bank donde se acreditó, como un movimiento entrante, manteniendo la categoría derivada del gasto. La cuenta de acreditación SHALL poder ser distinta de la cuenta del gasto (p. ej. una compra con tarjeta cuyo reintegro entra a una caja de ahorro).

#### Scenario: El reintegro recibido aumenta el saldo de la cuenta

- **WHEN** un reintegro "a cuenta" de $20.000 sobre la caja de ahorro pasa a recibido
- **THEN** el saldo de la caja de ahorro aumenta en $20.000

### Requirement: El reintegro "en resumen" recibido reduce el total del período de tarjeta

Un reintegro de subtipo "en resumen" recibido SHALL reducir el total a pagar del período de tarjeta donde aparece, restándose de la suma de consumos del período, y SHALL mostrarse en el resumen como un crédito. Mientras la tarjeta no se pague, el reintegro NO SHALL impactar el `disponible` (sigue off-ledger); sólo el pago del resumen —ya reducido— lo hace. Los reintegros pendientes o cancelados NO SHALL reducir el período ni aparecer en el resumen.

#### Scenario: El reintegro en resumen reduce lo que se paga

- **WHEN** un período tiene $100.000 de consumos y un reintegro "en resumen" recibido de $20.000
- **THEN** el total a pagar del período es $80.000
- **AND** el `disponible` no cambia hasta que el usuario paga el resumen

### Requirement: El usuario puede cancelar un reintegro que nunca llegó

El usuario SHALL poder cancelar un reintegro pendiente que nunca se recibió, seteando `cancelled_at`, para no dejar pendientes eternos. Un reintegro NO SHALL estar recibido y cancelado a la vez. Un reintegro cancelado NO SHALL impactar saldos, resumen ni neto, ni aparecer en el historial.

#### Scenario: Cancelar un pendiente que no se acreditó

- **WHEN** el usuario cancela un reintegro pendiente desde el bloque "Reintegros a confirmar"
- **THEN** el reintegro queda cancelado y no impacta ningún cálculo

#### Scenario: Recibido y cancelado son mutuamente excluyentes

- **WHEN** se intenta cancelar un reintegro ya recibido
- **THEN** la operación se rechaza

### Requirement: La edición y el borrado del gasto origen protegen el vínculo del reintegro

El gasto origen de un reintegro NO SHALL poder cambiar de cuenta (medio de pago) ni de moneda —en v3 esos campos son inmutables tras la creación de cualquier movimiento—, lo que preserva la semántica del vínculo. Al eliminar un gasto con reintegros asociados, sus reintegros SHALL eliminarse junto con él (`ON DELETE CASCADE`).

#### Scenario: Borrar el gasto elimina sus reintegros

- **WHEN** el usuario elimina un gasto que tiene reintegros asociados
- **THEN** esos reintegros se eliminan junto con el gasto

### Requirement: El detalle de un reintegro muestra el gasto vinculado

El detalle de un reintegro SHALL mostrar a qué gasto está asociado: una referencia al gasto origen (descripción o categoría y monto) que enlaza a su detalle, además del subtipo, el estado (esperado/recibido/cancelado) y la categoría derivada. Cuando el monto recibido difiere del esperado, el detalle SHALL mostrar también el monto esperado.

#### Scenario: El detalle enlaza al gasto origen

- **WHEN** el usuario abre el detalle de un reintegro
- **THEN** ve una referencia clic­keable al gasto origen con su monto
- **AND** ve el subtipo, el estado y la categoría derivada del gasto

### Requirement: La categoría de sistema "Reintegros / Cashback" se retira

Dado que el reintegro es un tipo de movimiento propio que hereda la categoría del gasto, la categoría de sistema de ingreso "Reintegros / Cashback" SHALL retirarse marcándola `is_active = false` (no se elimina, para preservar el historial). Los selectores de categoría NO SHALL ofrecer categorías inactivas en cargas nuevas; los movimientos históricos que ya la referencian SHALL permanecer intactos.

#### Scenario: La categoría retirada no se ofrece en cargas nuevas

- **WHEN** el usuario abre el selector de categorías al registrar un movimiento
- **THEN** "Reintegros / Cashback" no aparece entre las opciones

---

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

### Requirement: Las acciones del listado viven en una micro-toolbar de íconos circulares

El sistema SHALL renderizar las acciones de operación del listado (buscar, ver recurrencias, abrir filtros) como una **micro-toolbar de íconos circulares** alineada a la derecha, ubicada arriba del listado y debajo del card del breakdown. Inspirada en el patrón v2 (`MovimientosTopBar`), pero desacoplada del bloque del header.

Cada botón SHALL ser un cuadrado redondeado de 36×36px con border sutil (`border-border`, `bg-card`), texto/ícono `text-text-muted` con hover `text-text`. Sin label visible — solo el ícono Lucide y un `aria-label` para accesibilidad. Los tres botones, en orden de izquierda a derecha:

1. **Search** (ícono `Search`): click activa el modo de búsqueda — el botón se transforma en un **input expansible** que ocupa todo el ancho, con un botón "Cancelar" al lado. El input dispara la búsqueda con debounce de 300ms, idéntico al patrón v2. Pulsar Cancelar (o limpiar el texto) vuelve al estado de tres íconos.
2. **Recurrencias** (ícono `Repeat`): link directo a `/transactions/recurring`.
3. **Filtros** (ícono `SlidersHorizontal`): abre el panel de filtros como **sheet desde la derecha** (overlay + panel ~440px). Cuando hay filtros de contenido activos, SHALL mostrar un badge navy circular con el conteo, posicionado absoluto en la esquina superior derecha del ícono.

#### Scenario: La toolbar muestra tres íconos circulares cuando no hay búsqueda activa

- **WHEN** el usuario abre `/transactions` sin término de búsqueda en la URL
- **THEN** la toolbar muestra tres íconos: Search, Repeat (Recurrencias), SlidersHorizontal (Filtros)
- **AND** cada uno es un cuadrado redondeado de 36px con border sutil y solo ícono

#### Scenario: El ícono Search expande a un input full-width

- **WHEN** el usuario hace click en el ícono Search
- **THEN** la toolbar se transforma: el input de búsqueda toma el ancho completo y un botón "Cancelar" aparece al lado
- **AND** el input recibe el foco automáticamente
- **AND** la búsqueda se aplica con debounce de 300ms a la URL

#### Scenario: Cancelar la búsqueda vuelve al estado de tres íconos

- **WHEN** el usuario presiona "Cancelar" en el modo búsqueda
- **THEN** la toolbar vuelve a mostrar los tres íconos
- **AND** el término de búsqueda se borra de la URL si había alguno

#### Scenario: El ícono Recurrencias linkea a la página de gestión

- **WHEN** el usuario hace click en el ícono Repeat
- **THEN** navega a `/transactions/recurring`

#### Scenario: El ícono Filtros abre el sheet desde la derecha

- **WHEN** el usuario hace click en el ícono SlidersHorizontal
- **THEN** se abre un overlay con un panel sheet pegado al borde derecho de la pantalla
- **AND** el panel contiene selectores para tipo, categoría, cuenta (si aplica), moneda y rango de monto
- **AND** un footer con botones "Limpiar todo" y "Aplicar"

#### Scenario: El badge en el ícono Filtros refleja el conteo de filtros activos

- **WHEN** el usuario tiene filtros de contenido activos (tipo, categoría, cuenta, moneda, monto)
- **THEN** sobre el ícono SlidersHorizontal aparece un badge circular navy con el número de filtros activos
- **AND** el badge desaparece cuando no hay filtros activos

---

### Requirement: El listado global muestra un esqueleto de filas durante la carga inicial

Mientras los movimientos del mes activo se cargan desde el servidor, el sistema SHALL mostrar un **skeleton del listado** que respete la grilla del componente final (íconos cuadrados a la izquierda, dos líneas de texto en el centro, monto a la derecha), no un `Spinner` centrado en la pantalla. El skeleton SHALL:

- Mostrar al menos dos grupos de día simulados (por ejemplo, "Hoy" con tres filas y "Ayer" con cuatro filas).
- Usar un color de fondo muted (`bg-muted`) con animación `animate-pulse` para los rectángulos placeholder.
- Mantener el encabezado, los banners activos, la barra de filtros y el componente "En qué se fue" renderizados con sus datos reales (es decir, el skeleton aplica solo al listado, no a toda la pantalla).

#### Scenario: La carga inicial del listado muestra skeleton, no Spinner

- **WHEN** el usuario abre `/transactions` y el listado aún no terminó de hidratarse
- **THEN** la zona del listado muestra dos day groups skeleton con filas placeholder animadas
- **AND** el encabezado y el componente "En qué se fue" se renderizan con sus datos reales

#### Scenario: El skeleton respeta la anatomía de la fila

- **WHEN** el skeleton se renderiza
- **THEN** cada fila placeholder tiene la misma estructura visual que una fila real (cuadrado de ícono 40x40 + dos líneas de texto + monto a la derecha)

---

### Requirement: El componente de gastos por categoría usa la variante híbrida donut + ranking compacto y respeta off-ledger

El componente `CategorySpendingOverview` que actúa como carta de presentación del módulo en `/transactions` SHALL renderizar la variante **híbrida donut grande + ranking compacto**:

- Un donut estático de aproximadamente 200px de diámetro con stroke ancho (~32px), renderizado en SVG puro sin librería de charts y sin animación de entrada. Los segmentos del donut representan las categorías del ranking en sus colores definidos en los tokens (`--cat-1` a `--cat-5`, con `--cat-5` o un color secundario para "otros").
- En el centro del donut, un bloque tipográfico con un eyebrow ("GASTADO"), el monto total del mes en la moneda activa con tipografía display tabular, y una caption con el conteo de categorías ("en 8 categorías").
- A la derecha del donut, un **ranking compacto** de hasta cinco filas, **una línea por categoría** (sin meta line apilada). Cada fila SHALL llevar:
  - Un dot del color de la categoría correspondiente al segmento del donut.
  - El emoji y nombre de la categoría.
  - El porcentaje sobre el total, alineado a la derecha del nombre.
  - El monto de la categoría con tipografía tabular, alineado a la derecha del porcentaje.
- Una sexta fila colapsada agrega las categorías restantes ("+ N categorías más · {monto}"), si las hay, con el mismo layout de una sola línea.
- Un footer con la nota explícita del principio off-ledger ("Sin contar consumos en tarjeta sin pagar"). NO SHALL renderizar un link "Ver el detalle →" salvo que exista un destino real al cual drill-downear.

El componente SHALL mantener el switcher ARS/USD y SHALL renderizar la navegación por mes como **flechitas `‹ ›` a los lados del label del mes** ("‹ Mayo 2026 ›"). Las flechitas SHALL preservar la moneda activa en la URL al navegar de un mes a otro. **El header de la pantalla `/transactions` NO SHALL duplicar esta navegación**: el único selector de mes de la pantalla vive dentro de este card.

#### Alcance del "Gastado" — off-ledger respetado

El cálculo del breakdown SHALL excluir cualquier expense que viva en una cuenta `type='credit'` (consumos directos y cuotas hijas, todos con `card_period_id IS NOT NULL`). Esos consumos son **off-ledger**: no afectan el `disponible` del usuario hasta que se paga el resumen, y el donut titulado "Gastado" SHALL reflejar fielmente lo que efectivamente salió del disponible.

Como **trabajo diferido** (no scope de este change): cuando se paga un resumen, el monto pagado SHOULD distribuirse entre las categorías de los consumos que ese pago cubrió, atribuyéndolas al mes del pago. La query actual también excluye los pagos de resumen del breakdown (vía `period_payments?.length > 0`), por lo cual el card spending hoy **no aparece** ni cuando devenga ni cuando se paga; el TODO en `getMonthCategoryBreakdown` documenta el walk pendiente.

#### Scenario: El componente muestra donut + ranking compacto

- **WHEN** el usuario tiene movimientos del mes con cinco o más categorías
- **THEN** el componente renderiza un donut de aproximadamente 200px con cinco segmentos coloreados
- **AND** el centro del donut muestra el total del mes
- **AND** a la derecha del donut hay un ranking de cinco filas, una sola línea por fila, con dot + emoji + nombre + porcentaje + monto

#### Scenario: El footer informa la regla off-ledger sin prometer drill-down inexistente

- **WHEN** el componente se renderiza
- **THEN** el footer incluye explícitamente "Sin contar consumos en tarjeta sin pagar"
- **AND** NO renderiza un link "Ver el detalle →" mientras no exista una vista expandida real a la que llevar al usuario

#### Scenario: El donut es estático

- **WHEN** el componente se renderiza inicialmente
- **THEN** los segmentos del donut aparecen en su estado final sin animación de entrada
- **AND** el componente no aplica animaciones decorativas en hover ni en cambio de moneda

#### Scenario: La sexta fila colapsa las categorías restantes

- **WHEN** el ranking tiene seis o más categorías
- **THEN** las primeras cinco se listan individualmente
- **AND** la sexta fila agrega las restantes en "+ N categorías más" con su porcentaje y monto en la misma fila

#### Scenario: El breakdown excluye gastos en cuentas de tarjeta

- **WHEN** el usuario tiene consumos directos o cuotas hijas con `card_period_id NOT NULL` en el mes activo
- **THEN** esos rows NO contribuyen al total ni a ningún slice del donut
- **AND** un mes que solo tiene actividad de tarjeta SHALL mostrar el empty state del componente

### Requirement: La app nativa expone un FAB para registrar un movimiento

En la app nativa, las pantallas `dashboard` y `transactions` SHALL renderizar un FAB equivalente al de mobile-web para iniciar el alta de un movimiento. El FAB nativo SHALL ser un cuadrado de 80×80 px con esquinas ligeramente redondeadas (`rounded-2xl`), fondo `bg-emerald` (token emerald del mirror de tokens, no hex hardcodeado), ícono `Plus` blanco, anclado en `bottom-10 right-10` por encima del tab bar (no debajo). El label accesible SHALL leerse del catálogo i18n (`transactions.actions.register_movement`).

Con la pantalla `/transactions/new` mobile ya existente, el FAB nativo SHALL estar **habilitado**: SHALL renderizarse sin `opacity-50` y sin `accessibilityState.disabled`, y un tap SHALL ejecutar `router.push('/transactions/new')` navegando a la pantalla de alta. El destino `/transactions/new` SHALL seguir declarado en el componente.

La pantalla `dashboard` SHALL reservar padding inferior en su `ScrollView` (`pb-28` o equivalente) para que el FAB nativo no tape la última sección al scrollear. La pantalla `transactions` SHALL aplicar la misma reserva en su contenido scrolleable.

#### Scenario: FAB visible en dashboard y transactions (mobile native)

- **WHEN** el usuario autenticado abre la pestaña `Dashboard` o `Movimientos` en la app nativa
- **THEN** ve un FAB cuadrado verde de 80 px anclado en la esquina inferior derecha, por encima del tab bar
- **AND** el FAB respeta el safe-area del dispositivo (el tab bar es quien maneja el inset bottom)

#### Scenario: El FAB nativo navega a `/transactions/new`

- **WHEN** el usuario tapea el FAB en la app nativa
- **THEN** el FAB se renderiza habilitado (sin `opacity-50` ni `accessibilityState.disabled`)
- **AND** el tap ejecuta `router.push('/transactions/new')` y abre la pantalla de alta

#### Scenario: El label del FAB nativo es traducible

- **WHEN** un desarrollador inspecciona el FAB en la app nativa
- **THEN** el `accessibilityLabel` se obtiene del catálogo i18n (`transactions.actions.register_movement`), sin string hardcodeado

### Requirement: El usuario puede filtrar movimientos por subcategoría dentro de una categoría

El sistema SHALL aceptar un filtro opcional de subcategoría (`subcategoryId`) en `/transactions`, que se activa exclusivamente cuando hay una `categoryId` seleccionada. El filtro SHALL serializarse al URL como `?subcategory=<uuid>` o, para tx sin subcategoría asignada, como `?subcategory=__none__`.

`parseMovementFilters` SHALL descartar silenciosamente cualquier `subcategory` que llegue sin `category` (el filtro no tiene sentido sin la categoría madre como prerrequisito). `hasContentFilters` SHALL retornar `true` cuando `subcategoryId` está seteado, para que el running balance per-row se oculte. `buildMovementLimitHref` SHALL preservar `subcategory` al cambiar el limit de paginación.

#### Scenario: Filtrar por subcategoría dentro de una categoría

- **WHEN** el usuario está en `/transactions?month=2026-05&category=cat-comida` y elige la subcategoría "Almuerzo"
- **THEN** el URL pasa a `/transactions?month=2026-05&category=cat-comida&subcategory=subcat-almuerzo`
- **AND** la lista muestra solo movimientos con `category_id = cat-comida` y `subcategory_id = subcat-almuerzo`
- **AND** aparece un chip activo "Subcategoría: Almuerzo" con un botón de clear

#### Scenario: Filtrar por "Sin subcategoría"

- **WHEN** el usuario filtra por categoría "Comida" y luego selecciona "Sin subcategoría" del filtro
- **THEN** el URL agrega `&subcategory=__none__`
- **AND** la lista muestra solo movimientos de Comida con `subcategory_id IS NULL`

#### Scenario: Cambio de categoría limpia la subcategoría

- **WHEN** el usuario tiene filtros `category=cat-comida&subcategory=subcat-almuerzo` y cambia la categoría a `cat-transporte`
- **THEN** el sistema actualiza el URL a `category=cat-transporte` sin `subcategory`
- **AND** el filtro de subcategoría queda vacío y muestra las subcategorías de Transporte

#### Scenario: URL con `subcategory` sin `category` se ignora

- **WHEN** el usuario llega a `/transactions?subcategory=subcat-x` (sin `category`)
- **THEN** `parseMovementFilters` descarta el param y la URL se trata como si no tuviera filtro de subcategoría
- **AND** no se aplica ningún filtro `.eq('subcategory_id', ...)` en la query

### Requirement: El filtro de subcategoría se renderea solo cuando hay categoría seleccionada

El componente `movement-filters.tsx` SHALL renderear un select de subcategoría debajo del select de categoría, condicional a que `filters.categoryId` esté seteado. Las opciones SHALL ser solo las subcategorías de la categoría activa. La opción "Sin subcategoría" SHALL estar disponible como una opción explícita (mapea al marker `__none__`).

#### Scenario: Sin categoría seleccionada, el filtro de subcategoría no aparece

- **WHEN** el usuario abre el sheet de filtros sin tener categoría seleccionada
- **THEN** el select de subcategoría no se muestra

#### Scenario: Con categoría seleccionada, el filtro lista solo subcategorías de esa categoría

- **WHEN** el usuario seleccionó la categoría "Comida"
- **THEN** el select de subcategoría aparece y lista las subcategorías de Comida (p. ej. "Desayuno", "Almuerzo", "Cena") + una opción "Sin subcategoría"

### Requirement: `buildSubcategorySlices` está disponible en `@grana/money-logic`

El paquete `@grana/money-logic` SHALL exportar una función `buildSubcategorySlices(input: SubcategorySliceInput[])` que retorne `{ total: number, slices: Array<SubcategorySliceInput & { percentage: number }> }`. La función SHALL ordenar por `value` descendente, calcular percentages que sumen 100, y aceptar un slice con `subcategoryId: null` que representa el bucket "Sin subcategoría".

#### Scenario: Construcción de slices con bucket "Sin subcategoría"

- **WHEN** se llama `buildSubcategorySlices([{ subcategoryId: 'a', value: 60, ...}, { subcategoryId: null, value: 40, ... }])`
- **THEN** retorna `{ total: 100, slices: [{ id: 'a', percentage: 60, ... }, { id: null, percentage: 40, ... }] }`
- **AND** los slices están ordenados por value descendente

### Requirement: El componente "En qué se fue" muestra desglose por subcategoría cuando hay exactamente una categoría filtrada

`CategorySpendingOverview` SHALL aceptar un prop `mode: 'category' | 'subcategory'`. Cuando `mode='subcategory'`, el componente SHALL:

- Mostrar el título dinámico "En qué se fue dentro de **<categoría>**" usando la i18n key `transactions.breakdown.title_with_category` con interpolación del nombre de la categoría activa.
- Usar `buildSubcategorySlices` en lugar de `buildCategorySlices` para construir los slices del donut y del ranking.
- Renderear el slice "Sin subcategoría" (cuando existe value > 0) con label de `transactions.breakdown.no_subcategory_slice` y color neutral gris (distinto de los colores de subcategorías reales).
- Mantener el footer "Sin contar consumos en tarjeta sin pagar" idéntico al `mode='category'`.

`/transactions/page.tsx` SHALL resolver `mode='subcategory'` cuando hay exactamente UN `categoryId` activo Y NO hay `subcategoryId` activo. En cualquier otro caso, `mode='category'`.

#### Scenario: Filtro por una sola categoría activa el breakdown por subcategoría

- **WHEN** el usuario está en `/transactions?month=2026-05&category=cat-comida`
- **THEN** el componente "En qué se fue" muestra el título "En qué se fue dentro de **Comida**"
- **AND** los slices del donut y el ranking listan subcategorías de Comida con sus percentages

#### Scenario: Filtro por categoría + subcategoría vuelve al breakdown por categoría

- **WHEN** el usuario está en `/transactions?category=cat-comida&subcategory=subcat-almuerzo`
- **THEN** el componente "En qué se fue" usa `mode='category'` y muestra el título genérico
- **AND** los slices se calculan con `buildCategorySlices` (que va a tener una sola slice — Comida — porque el filtro ya restringe a esa categoría)

#### Scenario: Sin filtro de categoría, breakdown por categoría como hoy

- **WHEN** el usuario no tiene filtro de categoría activo
- **THEN** el componente usa `mode='category'`, título genérico, slices por categoría — comportamiento idéntico al previo a este change

### Requirement: El click en un slice de subcategoría aplica el filtro de subcategoría

Cuando el componente está en `mode='subcategory'`, el `<Link>` de cada slice del donut y de cada fila del ranking SHALL armar un href que preserve los filtros activos (`month`, `currency`, `category`) y agregue `subcategory=<id>` — usando el marker `__none__` para el slice "Sin subcategoría".

#### Scenario: Drill-down desde slice de subcategoría real

- **WHEN** el usuario está en `/transactions?month=2026-05&category=cat-comida` y hace click en el slice "Almuerzo" del donut
- **THEN** el browser navega a `/transactions?month=2026-05&category=cat-comida&subcategory=subcat-almuerzo&currency=ARS`
- **AND** la lista se filtra a las tx de esa subcategoría

#### Scenario: Drill-down desde "Sin subcategoría"

- **WHEN** el usuario hace click en el slice "Sin subcategoría"
- **THEN** el href agrega `&subcategory=__none__`
- **AND** la lista filtra a tx de la categoría activa con `subcategory_id IS NULL`

### Requirement: El header de /accounts/[id] permanece visible durante carga y error del contenido

`apps/web` SHALL renderizar el chrome de `/accounts/[id]` (back-link a `/accounts` en el layout, y el **hero card de identidad** dentro del shell client: avatar, nombre, badge `Archivada`, balances ARS/USD, acción `Editar`) desde el primer paint, sin estar tapado por un fallback de pantalla completa del layout group. Mientras las queries del hero (account detail) o de las tarjetas pares (movimientos, reembolsos, filtros) están resolviendo o fallan, el chrome SHALL permanecer visible y operable.

El hero card SHALL adoptar la **superficie navy con radial gradient** definida en el spec `accounts` (requirement "El usuario puede ver el detalle de una cuenta"). El back-link a `/accounts` SHALL renderizarse desde el `layout.tsx` (no desde el shell client) para no quedar atado al ciclo de vida del shell ni a los skeletons.

La acción "Editar" del hero card SHALL estar deshabilitada (botón disabled, no clickeable) hasta que la data necesaria para abrir el drawer de edición esté disponible: `account` (con sus monedas e institución) y `institutions` (catálogo). Cuando ambas están listas, el botón SHALL habilitarse. Si alguna falla, el botón MAY caer a su fallback existente (link `<a>` a `/accounts/[id]/edit` como ruta de fallback no-JS) para no quedar bloqueado.

Los balances ARS/USD del hero card SHALL mostrar un skeleton acotado al espacio de los números mientras la query de account detail no resuelve. El nombre y el avatar SHALL mostrarse desde el primer paint con los datos derivables del shell (la cuenta ya está garantizada de existir por el guard server-side; sus datos mínimos pueden hidratarse del initial fetch que hace el shell). El skeleton del hero card SHALL respetar la superficie navy (no `bg-muted` claro sobre fondo navy).

#### Scenario: Back-link y hero card visibles mientras el contenido carga

- **WHEN** el usuario navega a `/accounts/[id]` y las queries de la ruta aún están pendientes
- **THEN** el back-link a `/accounts` está visible desde el layout
- **AND** el hero card está montado sobre superficie navy con su skeleton interno (avatar + 2 líneas de título + balances)
- **AND** los balances ARS/USD muestran un skeleton
- **AND** el botón "Editar" está visualmente disabled (no clickeable) o cae a su link `<a>` de fallback
- **AND** cada tarjeta debajo del hero (reembolsos, movimientos) muestra su propio skeleton-card in-place

#### Scenario: El botón "Editar" se habilita cuando el drawer está listo

- **WHEN** las queries de `account` e `institutions` resolvieron correctamente
- **THEN** el botón "Editar" se habilita
- **AND** clickearlo abre el drawer de edición de la cuenta

#### Scenario: Fallo de las queries del header no tapa el resto del shell

- **WHEN** la query de `account` falla
- **THEN** el área de balances del hero card muestra un mensaje de error o se mantiene vacía con feedback al usuario
- **AND** el back-link a `/accounts`, el nombre (si se hidrató) y las tarjetas de movimientos siguen renderizándose normalmente
- **AND** el `(app)/error.tsx` de segment-level NO se monta

#### Scenario: Un error en una sección del contenido no tapa el hero

- **WHEN** la query de movimientos de la cuenta falla
- **THEN** la tarjeta de movimientos muestra un mensaje de error con retry
- **AND** el hero card permanece visible y operativo
- **AND** la tarjeta de reembolsos pendientes (si tiene su propia query) sigue mostrándose

### Requirement: El estado de filtros y navegación de /accounts/[id] vive en React state, no en URL

`apps/web` SHALL mantener el estado interactivo de `/accounts/[id]` (filtros de tipo, categoría, subcategoría, currency, búsqueda, rango de monto, navegación por mes, paginación) en React state interno de la ruta, no en query strings de la URL.

La URL de `/accounts/[id]` NO SHALL aceptar ni interpretar query parameters relacionados con filtros, navegación o paginación. La URL canónica de la ruta es `/accounts/[id]` sin parámetros.

Recargar la página (F5) SHALL resetear todos los filtros al valor por defecto (mes actual según `getTodayAR()`, sin filtros adicionales, sin búsqueda, sin currency forzado). Este es el comportamiento intencional, coherente con `/transactions`.

El **filtro de cuenta** (`accountId`) NO SHALL exponerse en la barra de filtros — está implícito en la ruta (`accountId === params.id`). El componente `MovementFilters` SHALL renderizarse con `showAccountFilter={false}` y la query subyacente SHALL inyectar el `accountId` desde el shell.

Cualquier acción de "limpiar filtros" o "limpiar búsqueda" SHALL operar sobre este estado, no sobre la URL.

#### Scenario: Cambiar de mes no toca la URL

- **WHEN** el usuario está en `/accounts/[id]` y clickea "mes siguiente"
- **THEN** el contenido se actualiza para mostrar el mes siguiente
- **AND** la URL en la barra del browser sigue siendo `/accounts/[id]` (sin query params)
- **AND** la historia del browser NO recibe una nueva entrada

#### Scenario: F5 limpia todos los filtros

- **WHEN** el usuario está en `/accounts/[id]` con filtros aplicados (ej. categoría X, búsqueda "café")
- **AND** recarga la página (F5)
- **THEN** la pantalla vuelve al estado por defecto: mes actual, sin filtros ni búsqueda

#### Scenario: La URL canónica no acepta query params

- **WHEN** el usuario entra a `/accounts/[id]?month=2026-03` (ej. desde un bookmark antiguo)
- **THEN** la ruta carga normalmente en el estado por defecto
- **AND** los query params son ignorados

#### Scenario: La barra de filtros no muestra el chip de cuenta

- **WHEN** el usuario abre `/accounts/[id]`
- **THEN** la barra de filtros no incluye el control de selección de cuenta (porque el contexto de la ruta ya implica esa cuenta)
- **AND** el resto de los filtros (tipo, categoría, subcategoría, currency, búsqueda, rango de monto) están disponibles normalmente

#### Scenario: Acción "Limpiar filtros" opera sobre state, no URL

- **WHEN** el usuario tiene filtros activos y clickea "Limpiar filtros"
- **THEN** los filtros vuelven a su default
- **AND** el contenido se reconsulta con los filtros limpios
- **AND** la URL no cambia

### Requirement: Cada sección de /accounts/[id] fetchea independientemente y entrega su propio loading/error

`apps/web` SHALL renderizar las secciones de `/accounts/[id]` (`AccountDetailHeader`, `PendingReimbursementsBlock`, `MovementFilters`, `MovementList`) como componentes client que fetchean independientemente vía TanStack Query. Cada sección SHALL exhibir su propio estado de loading (skeleton acotado al espacio que ocupa) y su propio estado de error (mensaje + retry localizados a la sección), sin bloquear el render de las demás.

NO SHALL haber un fetch monolítico server-side que awaitee múltiples queries antes del primer render. Cada `useQuery` se ejecuta tan pronto el componente se monta y muestra resultado en cuanto resuelve.

El `page.tsx` server-side se reserva exclusivamente para los guards terminales: auth (`redirect('/login')` si no hay sesión), `notFound()` si la cuenta no existe o no pertenece al usuario, y `redirect('/cards/[id]')` si la cuenta es `type='credit'`. Estos guards SHALL correr server-side antes de montar el shell, porque son decisiones que no aplican loading/skeleton — la ruta no debe existir.

#### Scenario: Una sección lenta no bloquea las rápidas

- **WHEN** `getAccountMovements` tarda 2s mientras `getPendingReimbursements` resuelve en 100ms
- **THEN** la sección de reembolsos pendientes aparece poblada a los 100ms
- **AND** la sección de la lista muestra su skeleton hasta los 2s
- **AND** ambas son visibles simultáneamente en la pantalla

#### Scenario: Una sección que falla no derrumba el resto

- **WHEN** `getPendingReimbursements` falla con error
- **THEN** la sección de reembolsos pendientes muestra su mensaje de error con un botón "Reintentar"
- **AND** las otras secciones siguen visibles y operativas
- **AND** el header sigue visible y operativo

#### Scenario: Cuenta inexistente cae en notFound server-side

- **WHEN** el usuario intenta acceder a `/accounts/[id-inexistente]`
- **THEN** el `page.tsx` resuelve `getAccountDetail` server-side y, al no encontrar fila (RLS o `id` no válido), llama `notFound()`
- **AND** se renderiza el `not-found.tsx` del segment, no el shell client

#### Scenario: Cuenta de tipo credit redirige server-side a /cards/[id]

- **WHEN** el usuario entra a `/accounts/[id]` y la cuenta tiene `type='credit'`
- **THEN** el `page.tsx` ejecuta `redirect('/cards/[id]')` antes de montar el shell client
- **AND** el usuario nunca ve un loading state del shell de account detail

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

### Requirement: El estado de filtros y navegación de /transactions vive en React state, no en URL

`apps/web` SHALL mantener el estado interactivo de `/transactions` (filtros, navegación por mes, currency, modo egresos/ingresos, búsqueda, drill-down de subcategoría, paginación) en React state interno de la ruta, no en query strings de la URL.

La URL de `/transactions` NO SHALL aceptar ni interpretar query parameters relacionados con filtros, navegación o paginación. La URL canónica de la ruta es `/transactions` sin parámetros.

Recargar la página (F5) SHALL resetear todos los filtros al valor por defecto (mes actual según `getTodayAR()`, currency ARS, modo egresos, sin filtros adicionales, sin búsqueda). Este es el comportamiento intencional.

Los componentes hijos de la ruta (chips de filtro removibles, navegador de mes, toggles de currency y modo, búsqueda, drill-down) SHALL leer y mutar este estado mediante un context y hook compartidos provistos por el shell de la ruta. Cualquier acción de "limpiar filtros" o "limpiar búsqueda" SHALL operar sobre este estado, no sobre la URL.

#### Scenario: Cambiar de mes no toca la URL

- **WHEN** el usuario está en `/transactions` y clickea "mes siguiente"
- **THEN** el contenido se actualiza para mostrar el mes siguiente
- **AND** la URL en la barra del browser sigue siendo `/transactions` (sin query params)
- **AND** la historia del browser NO recibe una nueva entrada

#### Scenario: F5 limpia todos los filtros

- **WHEN** el usuario está en `/transactions` con filtros aplicados (ej. categoría X, búsqueda "café", currency USD)
- **AND** recarga la página (F5)
- **THEN** la pantalla vuelve al estado por defecto: mes actual, ARS, egresos, sin filtros ni búsqueda

#### Scenario: La URL canónica no acepta query params

- **WHEN** el usuario entra a `/transactions?month=2026-03` (ej. desde un bookmark antiguo)
- **THEN** la ruta carga normalmente en el estado por defecto
- **AND** los query params son ignorados
- **AND** la URL queda como `/transactions` (sin params) o conserva los params pero sin efecto sobre el estado — el comportamiento elegido SHALL ser consistente y documentado

#### Scenario: Acción "Limpiar filtros" opera sobre state, no URL

- **WHEN** el usuario tiene filtros activos y clickea "Limpiar filtros" (en un chip o en un botón global)
- **THEN** los filtros vuelven a su default
- **AND** el contenido se reconsulta con los filtros limpios
- **AND** la URL no cambia

### Requirement: Cada sección de /transactions fetchea independientemente y entrega su propio loading/error

`apps/web` SHALL renderizar las secciones de `/transactions` (`RecurrenceSuggestionBanner`, `PendingRecurrencesBlock`, `CategorySpendingOverview`, `PendingReimbursementsBlock`, `MovementFilters`, `MovementList`) como componentes client que fetchean independientemente vía TanStack Query. Cada sección SHALL exhibir su propio estado de loading (skeleton acotado al espacio que ocupa) y su propio estado de error (mensaje + retry localizados a la sección), sin bloquear el render de las demás.

NO SHALL haber un fetch monolítico server-side que awaitee múltiples queries antes del primer render. Cada `useQuery` se ejecuta tan pronto el componente se monta y muestra resultado en cuanto resuelve.

#### Scenario: Una sección lenta no bloquea las rápidas

- **WHEN** `getMonthSubcategoryBreakdown` (sección del overview) tarda 2s mientras `getPendingRecurrenceInstances` resuelve en 100ms
- **THEN** la sección de recurrencias pendientes aparece poblada a los 100ms
- **AND** la sección del overview muestra su skeleton hasta los 2s
- **AND** ambas son visibles simultáneamente en la pantalla

#### Scenario: Una sección que falla no derrumba el resto

- **WHEN** `getPendingReimbursements` falla con error
- **THEN** la sección de reembolsos pendientes muestra su mensaje de error con un botón "Reintentar"
- **AND** las otras secciones siguen visibles y operativas
- **AND** el header sigue visible y operativo

#### Scenario: El "Reintentar" de una sección refetcha solo esa query

- **WHEN** el usuario clickea "Reintentar" en una sección que falló
- **THEN** TanStack refetcha solo la query asociada a esa sección
- **AND** las otras secciones no se reconsultan

### Requirement: Las mutations invalidan caches granulares vía helpers semánticos en el cliente y revalidan paths RSC en el servidor

`apps/web` SHALL definir helpers semánticos de invalidación en `lib/transactions/invalidation.ts` que reciben un `QueryClient` y disparan invalidaciones por familia de mutación. Los componentes que disparan mutaciones SHALL llamar el helper correspondiente en el `onSuccess` de la mutación. NO SHALL llamar `router.refresh()` para invalidación de queries locales.

Las server actions de mutación que afectan data visible en otras rutas (`/dashboard`, `/accounts`, `/cards`) SHALL invocar `revalidatePath` para esas rutas antes de retornar, centralizado en helpers en `app/_actions/_helpers.ts` para evitar duplicación y desincronización.

Los helpers mínimos a definir:

- `invalidateAfterMovementMutation(qc)`: para create / update / delete de movimientos (income, expense, transfer, adjustment, exchange).
- `invalidateAfterRecurrenceInstanceMutation(qc, { confirmed })`: para confirmar o saltar una instancia recurrente pendiente.
- `invalidateAfterReimbursementMutation(qc)`: para confirmar o cancelar un reembolso.
- `invalidateAfterSuggestionMutation(qc)`: para aceptar o descartar una sugerencia de recurrencia.

#### Scenario: Crear un movimiento invalida la página, los breakdowns y otras queries relacionadas

- **WHEN** el usuario crea un gasto desde el drawer y la mutation completa
- **THEN** el helper `invalidateAfterMovementMutation` invalida las query keys de la lista de movimientos, los breakdowns del mes, las filter-options, `has-any`, los reembolsos pendientes, la top-suggestion, y los balances de cuentas
- **AND** las secciones afectadas refetchean automáticamente y muestran los datos actualizados
- **AND** las secciones no afectadas (ej. árbol de categorías cacheado) NO refetchean

#### Scenario: Saltar una instancia recurrente solo invalida pending-instances

- **WHEN** el usuario saltea una instancia recurrente pendiente y la mutation completa
- **THEN** el helper `invalidateAfterRecurrenceInstanceMutation` con `{ confirmed: false }` invalida solo la query de pending-instances
- **AND** la lista de movimientos NO refetchea (no se creó ningún movimiento)
- **AND** los breakdowns NO refetchean

#### Scenario: Una mutation desde /transactions deja /dashboard fresco al navegar

- **WHEN** el usuario crea un movimiento desde `/transactions` y luego navega a `/dashboard`
- **THEN** el dashboard muestra el balance, el hero y los breakdowns con la data nueva
- **AND** no es necesario recargar la página manualmente

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

### Requirement: El monto es el elemento hero del drawer con formato AR en vivo y color por tipo

El sistema SHALL mostrar el monto como campo principal del formulario, usando `MoneyAmountInput` (`parseMoneyInput` para parseo/validación). El monto SHALL formatearse en vivo con separador de miles `.` y decimales tras `,` (máx 2), formato es-AR. El color del monto SHALL depender del tipo: gasto y transferencia en navy, ingreso en verde, ajuste en navy con signo `+`/`−`. Una pill de moneda SHALL alternar entre ARS y USD.

#### Scenario: Formato en vivo del monto

- **WHEN** el usuario tipea `8450` en el monto
- **THEN** el campo muestra `8.450`
- **WHEN** el usuario tipea `8450,5`
- **THEN** el campo muestra `8.450,5`

#### Scenario: Color del monto según tipo ingreso

- **WHEN** el tipo activo es Ingreso
- **THEN** el monto se muestra en color verde

### Requirement: El tipo "Cambio de moneda" está disponible en el formulario unificado

El sistema SHALL ofrecer cinco tipos de movimiento en el selector del formulario: Gasto, Ingreso, Transferencia, Ajuste y Cambio de moneda. El tipo Cambio de moneda SHALL reusar el flujo `createExchange`/`updateExchange`, con cuenta y moneda de origen y cuenta y moneda de destino, exigiendo que la moneda de origen y la de destino difieran.

#### Scenario: Registrar un cambio de moneda desde el drawer

- **WHEN** el usuario elige el tipo "Cambio de moneda", define monto/moneda de origen y monto/moneda de destino con monedas distintas, y confirma
- **THEN** el sistema crea el movimiento usando el flujo de exchange existente

#### Scenario: Origen y destino con la misma moneda es inválido

- **WHEN** el usuario elige Cambio de moneda con moneda de origen y destino iguales
- **THEN** el formulario no permite confirmar (validación de exchange)

### Requirement: El selector de categoría del drawer permite drill a subcategorías

El sistema SHALL presentar la selección de categoría en un popover con dos niveles: nivel 0 lista las categorías (las que tienen subcategorías muestran indicador de drill `›`), y al entrar a una categoría drillable, nivel 1 muestra "Toda la categoría" más sus subcategorías. Seleccionar una categoría no drillable o "Toda la categoría" SHALL fijar la categoría sin subcategoría; seleccionar una subcategoría SHALL fijar categoría + subcategoría. Cuando la categoría fue autosugerida (`suggestCategoryFromHistory`), SHALL mostrarse un chip "Sugerida" que SHALL desaparecer al elegir manualmente.

**Ambos niveles ofrecen solo ítems activos.** El nivel 0 SHALL listar únicamente categorías con `is_active = true` y el nivel 1 únicamente subcategorías con `is_active = true`. El indicador de drill `›` SHALL derivarse de las subcategorías **ofrecibles**: una categoría cuyas subcategorías están todas archivadas NO SHALL mostrarse como drillable, para que el usuario no entre a un nivel 1 que solo contiene "Toda la categoría". La misma regla aplica al selector del formulario de recurrencias, que usa el mismo catálogo.

**Excepción de edición: el ítem ya asignado no se pierde.** Al editar un movimiento o una recurrencia cuya categoría o subcategoría fue archivada después de haberse asignado, el selector SHALL mostrar ese ítem —y, si es una subcategoría, la categoría padre que lo contiene— aunque esté inactivo, identificado como archivado, y el campo SHALL conservar la clasificación existente. Guardar sin tocar el selector NO SHALL borrar ni sustituir la categoría asignada. El ítem archivado así expuesto lo está solo por ser el valor actual de ese formulario: NO SHALL ofrecerse en el alta de un movimiento nuevo, ni quedar disponible para reasignarlo una vez que el usuario eligió otra cosa.

#### Scenario: Drill y selección de subcategoría

- **WHEN** el usuario abre el selector de categoría y entra a "Comida" (drillable) y elige "Almuerzo"
- **THEN** el formulario fija categoría "Comida" y subcategoría "Almuerzo" y cierra el popover

#### Scenario: Selección manual quita el chip Sugerida

- **WHEN** la categoría está autosugerida (chip "Sugerida" visible) y el usuario elige una categoría manualmente
- **THEN** el chip "Sugerida" desaparece

#### Scenario: El alta no ofrece categorías ni subcategorías archivadas

- **WHEN** el usuario abre el selector en el alta de un movimiento y el catálogo del usuario incluye una categoría archivada y una subcategoría archivada bajo una categoría activa
- **THEN** el nivel 0 no lista la categoría archivada
- **AND** el nivel 1 de la categoría activa no lista la subcategoría archivada

#### Scenario: Una categoría con todas sus subcategorías archivadas no se muestra drillable

- **WHEN** una categoría activa tiene subcategorías pero todas están archivadas
- **THEN** el nivel 0 la muestra sin indicador de drill `›`
- **AND** tocarla fija la categoría directamente, sin abrir un nivel 1

#### Scenario: Editar un movimiento con subcategoría archivada conserva su clasificación

- **WHEN** el usuario abre en edición un movimiento clasificado con la subcategoría "Delivery", archivada después de haberse asignado
- **THEN** el selector muestra "Comida › Delivery" como valor actual, identificado como archivado
- **AND** guardar sin tocar el selector deja el movimiento con la misma categoría y subcategoría

#### Scenario: Cambiar de categoría en edición no permite volver a la archivada

- **WHEN** el usuario edita ese movimiento y elige otra categoría
- **THEN** la subcategoría archivada deja de ofrecerse en el selector

### Requirement: El toggle Repetir del drawer ofrece frecuencia personalizada

El sistema SHALL ofrecer en el toggle "Repetir" las frecuencias Semanal, Quincenal, Mensual, Anual y Personalizado. Al elegir Personalizado, SHALL mostrarse un control de intervalo `cada N · unidad` (día/semana/mes/año) con condición de fin opcional, y al guardar SHALL crear la recurrencia vía el flujo existente con el modelo intervalo+unidad.

#### Scenario: Crear una recurrencia personalizada desde el form

- **WHEN** el usuario activa "Repetir", elige "Personalizado" con `cada 3 · meses` y confirma el movimiento
- **THEN** el sistema crea el movimiento real y una recurrencia con `interval_count = 3`, `interval_unit = month`

### Requirement: Atajos de teclado en el drawer

El sistema SHALL soportar, con el drawer abierto, `Esc` para cerrar el popover activo si lo hay o, en su defecto, el drawer; y `⌘/Ctrl+Enter` para enviar el formulario.

#### Scenario: Esc cierra popover antes que drawer

- **WHEN** hay un popover abierto dentro del drawer y el usuario presiona Esc
- **THEN** se cierra el popover y el drawer permanece abierto
- **WHEN** no hay popover abierto y el usuario presiona Esc
- **THEN** se cierra el drawer

#### Scenario: Envío con atajo

- **WHEN** el usuario presiona ⌘/Ctrl+Enter con el formulario válido
- **THEN** el movimiento se envía

### Requirement: El drawer en modo edición ajusta chrome y CTA

El sistema SHALL precargar el movimiento real al abrir el drawer en modo edición y NO SHALL renderizar el selector de tipo: el tipo es inmutable y se enuncia como fila de contexto read-only. El conjunto de campos editables SHALL derivarse de `getEditableFields` (regla ya especificada para el formulario único). En modo edición el encabezado SHALL mostrar **solo el título** "Editar movimiento", sin eyebrow: un "EDITAR" en versalitas sobre un título que ya empieza con esa palabra la dice dos veces. El CTA SHALL decir "Guardar cambios". El borrado SHALL respetar las reglas existentes (no borrar hijas de cuotas aisladas, no borrar consumos pagados).

#### Scenario: El tipo no se ofrece como control en edición

- **WHEN** el usuario abre un movimiento existente en el drawer de edición
- **THEN** el drawer no muestra selector de tipo, en ningún viewport
- **AND** el tipo aparece como fila de contexto read-only con caption de "no editable"

#### Scenario: CTA en edición

- **WHEN** el drawer está en modo edición
- **THEN** el CTA dice "Guardar cambios"

#### Scenario: Borrado respeta reglas de cuotas

- **WHEN** el usuario intenta eliminar una cuota hija desde la edición
- **THEN** el sistema aplica las reglas de borrado existentes y no permite borrarla aislada

#### Scenario: El encabezado de edición no repite la palabra

- **WHEN** el usuario abre un movimiento en modo edición, en cualquier superficie
- **THEN** el encabezado muestra únicamente "Editar movimiento"
- **AND** NO muestra un eyebrow "EDITAR" encima

### Requirement: La lógica del formulario vive en `@grana/movement-form` y los orquestadores en `@grana/transactions-mutations`

El sistema SHALL alojar el estado, las cascadas (tab → cuentas elegibles / moneda / toggles válidos), los validadores y el submit dispatcher del formulario de movimientos en un hook React compartido `useMovementForm` en el package `@grana/movement-form`. El hook SHALL recibir un objeto `Mutators` (tipo top-level exportado por el package) que cada plataforma binde a sus actions de movimiento — web a las server actions de Next, mobile a wrappers que componen las thin mutations compartidas + los orquestadores compartidos. La JSX SHALL quedar en cada app (web/mobile) y consumir el hook.

Las mutaciones que orquestan varias filas o tablas con rollback (`registerInstallments`, `registerCardPurchase`, `createRecurrenceFromMovement`) SHALL vivir en `@grana/transactions-mutations` como funciones puras que reciben un cliente Supabase ya autenticado y un input ya validado, devolviendo `{ ok, formError?, fieldErrors?, id?/parentId? }`.

Las **thin mutations** (creates/updates simples: `createIncome`, `createExpense`, `createTransfer`, `createAdjustment`, `createExchange`, `updateTransaction`, `updateTransfer`, `updateAdjustment`, `updateExchange`, `updateInstallmentParent`) SHALL vivir también en `@grana/transactions-mutations` como funciones isomórficas con la **misma frontera** que los orquestadores: reciben un cliente Supabase **ya autenticado** (más el `userId` resuelto) y un input **ya validado**, devuelven `{ ok, id?, formError?, fieldErrors? }`, y NO SHALL redeclararse inline en cada plataforma. El pre-check de moneda activa (`verifyActiveCurrency`) SHALL acompañarlas en el package (lógica de dominio reusable). Auth (`getAuthenticatedUserId` / `supabase.auth.getUser`) y cache invalidation (`revalidatePath` en web / TanStack en mobile) SHALL quedar en el shell de cada plataforma — ni el orquestador ni la thin mutation conocen ninguno de los dos. Web SHALL consumir las thin mutations vía wrappers thin (validate + auth + delegate + `revalidateAfterMovementMutation`), preservando la firma pública de las server actions y los query keys previos; el comportamiento de `/transactions` y de los call-sites de alta/edición SHALL ser idéntico.

#### Scenario: Web binde el hook a sus server actions

- **WHEN** el componente web del formulario monta el drawer
- **THEN** instancia `useMovementForm` pasando un objeto `Mutators` que mapea cada slot a la server action correspondiente (`createIncome`, `createExpense`, …, `registerInstallments`, `registerCardPurchase`, `createRecurrenceFromMovement`, `suggestCategoryFromHistory`)
- **AND** wirea `onMutationSuccess` para invalidar TanStack queries + `router.refresh()`, y `onSuccess` para cerrar el drawer o navegar

#### Scenario: Mobile binde el hook a wrappers sobre las mutations compartidas

- **WHEN** la pantalla nativa de alta monta `useMovementForm`
- **THEN** pasa un objeto `Mutators` cuyos slots componen `validate(schema) → supabase.auth.getUser() → la thin mutation / el orquestador de @grana/transactions-mutations → { ok, ... }`
- **AND** wirea `onMutationSuccess` a la invalidación de TanStack Query nativa y `onSuccess` a la navegación de vuelta al feed
- **AND** no redeclara el cuerpo `.insert({...})` de ninguna mutation — lo importa del package

#### Scenario: Los orquestadores son la única fuente de verdad de la danza de rollback

- **WHEN** un nuevo consumer (mobile, una server action distinta, un script) necesita registrar cuotas o un consumo simple en tarjeta
- **THEN** importa la función desde `@grana/transactions-mutations` y le pasa su propio cliente Supabase
- **AND** el orquestador ejecuta la misma secuencia atómica con rollback de parent/children/shared splits y devuelve `{ ok, parentId | id, formError?, fieldErrors? }`

#### Scenario: Las thin mutations no se duplican entre plataformas

- **WHEN** web y mobile registran o editan un movimiento simple (ingreso, gasto, transferencia, ajuste, cambio de moneda)
- **THEN** ambas plataformas invocan la misma función de `@grana/transactions-mutations` pasando su propio cliente autenticado y el input ya validado
- **AND** la server action web es un wrapper thin (validate + auth + delegate + revalidate) sin lógica de insert propia
- **AND** el comportamiento de `/transactions` y de los call-sites de alta/edición web no cambia

#### Scenario: El contrato `Mutators` es un drift detector

- **WHEN** una nueva action entra al submit dispatcher del hook
- **THEN** la propiedad correspondiente se agrega al tipo `Mutators` exportado
- **AND** cualquier consumer (web, mobile) cuyo objeto `Mutators` no tenga esa propiedad falla en tiempo de compilación, no en runtime

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

### Requirement: El detalle de cuenta inyecta una fila sintética "Saldo inicial" en su listado

El listado de movimientos del detalle de cuenta (`/accounts/[id]`) SHALL inyectar una fila sintética **"Saldo inicial"** por cada moneda activa de la cuenta cuyo `initial_balance != 0`. Esta fila NO es una transacción — no existe como row en `transactions`, no se persiste, no se replica en el módulo global `/transactions`, y NO SHALL aparecer en ninguna otra pantalla.

La fila SHALL renderizarse usando el contrato funcional `Movimiento` reutilizando la variante de `adjustment` (mismo grouping, mismas reglas de filtros y orden cronológico del listado), con `description = "Saldo inicial"` (label leído del catálogo i18n), `amount = |initial_balance|`, `sign = '+'` si `initial_balance > 0` o `'-'` si `initial_balance < 0`, y `currency_code` igual a la moneda de origen.

La fila SHALL ordenarse cronológicamente como cualquier otra fila del listado, usando la fecha de creación de la moneda en la cuenta (`account_currencies.initial_balance_date`). Cuando exista una transacción real con esa misma fecha, la fila "Saldo inicial" SHALL ordenarse antes — el detalle muestra primero el saldo inicial, después los movimientos del mismo día.

La fila SHALL ser **no navegable** (sin `detail_href`): un click NO SHALL abrir un detalle de movimiento.

La fila SHALL quedar **excluida del recurrence-link lookup** del listado: el identificador sintético de la fila NO SHALL formar parte del input de la query que resuelve qué movimientos están vinculados a una recurrencia (esa query rechazaría un id sintético al castearlo a `uuid`). La regla es independiente del transporte de la query (server action o lectura directa browser → Supabase).

El running balance del listado scoped a cuenta SHALL incluir la fila "Saldo inicial" como punto de partida: el saldo inmediatamente posterior a la fila SHALL ser el `initial_balance` de esa moneda, y los running balances de los movimientos siguientes SHALL acumularse a partir de ahí.

#### Scenario: La fila "Saldo inicial" aparece en el detalle de cuenta

- **WHEN** el usuario abre `/accounts/[id]` de una cuenta cuya moneda ARS tiene `initial_balance = 100000` y la cuenta tiene al menos una transacción
- **THEN** el listado muestra una fila "Saldo inicial" con monto `$100.000` y signo `+`, fechada en `account_currencies.initial_balance_date` para ARS

#### Scenario: Una cuenta con `initial_balance = 0` no genera la fila para esa moneda

- **WHEN** el usuario abre `/accounts/[id]` de una cuenta cuya moneda USD tiene `initial_balance = 0`
- **THEN** el listado NO muestra fila "Saldo inicial" para USD
- **AND** si la moneda ARS de esa misma cuenta tiene `initial_balance != 0`, la fila ARS SÍ se muestra (la regla opera por `account_currency`, no por cuenta)

#### Scenario: Una cuenta bimoneda con ambos saldos iniciales no nulos genera dos filas

- **WHEN** el usuario abre `/accounts/[id]` de una cuenta cuya ARS tiene `initial_balance = 50000` y USD `initial_balance = 200`
- **THEN** el listado muestra dos filas "Saldo inicial" — una por moneda — cada una con su monto, signo y fecha derivados de su `account_currency` correspondiente

#### Scenario: La fila no aparece en el listado global de Movimientos

- **WHEN** el usuario abre `/transactions`
- **THEN** ninguna fila "Saldo inicial" aparece en el listado
- **AND** los filtros por cuenta, categoría, moneda y rango de monto operan sin tener que excluir la fila (nunca está presente)

#### Scenario: La fila no es navegable

- **WHEN** el usuario hace click sobre la fila "Saldo inicial" del detalle de cuenta
- **THEN** el sistema NO navega a un detalle de movimiento
- **AND** ninguna pantalla de detalle existe para esa fila

#### Scenario: La fila se ordena antes de las transacciones del mismo día

- **WHEN** el detalle de cuenta tiene una transacción con fecha igual a `account_currencies.initial_balance_date` (ej. un gasto cargado el mismo día que se creó la moneda)
- **THEN** la fila "Saldo inicial" aparece arriba de esa transacción en el listado
- **AND** el running balance posterior a la fila "Saldo inicial" coincide con `initial_balance`, y a partir de ahí los running balances de las transacciones del día reflejan el saldo acumulado

#### Scenario: La fila queda fuera del recurrence-link lookup

- **WHEN** el listado de detalle de cuenta resuelve qué movimientos están vinculados a una recurrencia para mostrar el indicador correspondiente
- **THEN** el identificador de la fila "Saldo inicial" NO SHALL formar parte del input de la query que resuelve los vínculos
- **AND** la fila nunca se marca como vinculada a una recurrencia

#### Scenario: Una cuenta con saldo inicial negativo muestra signo `-`

- **WHEN** el usuario abre `/accounts/[id]` de una cuenta cuya moneda ARS tiene `initial_balance = -5000` (ej. una tarjeta de crédito que arrancó con deuda — no aplica a credit cards porque son off-ledger, pero la regla soporta el caso genérico)
- **THEN** la fila "Saldo inicial" muestra monto `$5.000` con signo `−`

### Requirement: Los primitivos visuales de ledger (MovementFilters, MovementList, MovementRow) comparten un lenguaje visual único en todas las rutas

Los componentes compartidos `MovementFilters`, `MovementList`, `MovementRow` y `PendingReimbursementsBlock` (`apps/web/lib/transactions/components/`) SHALL renderizarse con el mismo lenguaje visual en las tres rutas que los consumen: `/accounts/[id]`, `/transactions`, `/cards/[id]`. El lenguaje SHALL ser el definido en `docs/design/accounts-detail/components/`:

- **`MovementRow`**: grid de 3 columnas en desktop `minmax(0, 1fr) 126px 126px` (icono + título/categoría / monto / running balance) y 2 columnas en mobile `1fr 112px` (running balance se oculta debajo de 760px). Border-bottom suave entre filas, última sin border. Tipografía: título 13px font-semibold, meta 12px muted, monto tabular-nums con `text-expense` / `text-income` / `text-pending` / `text-neutral-amount` según corresponda.
- **`MovementList`**: agrupación por día con headers (`Hoy`, `Ayer`, fecha formateada). La running balance per-row SHALL respetar `hasContentFilters` (se oculta cuando hay filtros de contenido activos), comportamiento existente preservado.
- **`MovementFilters`**: barra compacta con navegación de mes (‹ ›), íconos compactos para búsqueda / recurrencia / filtros, y los chips de filtros activos debajo. Border y radius alineados al lenguaje de cards par.
- **`PendingReimbursementsBlock`**: header con título y badge de conteo (`X pendiente`), lista con items expandidos mostrando los campos `Monto real` / `Fecha real` + botones `Confirmar` / `Cancelar` en línea. Superficie de tarjeta blanca cuando se renderiza dentro de `/accounts/[id]`.

Los wrappers que envuelven estos primitivos (la `Tarjeta de movimientos` en `/accounts/[id]`, el `PageHeader` + `MovementListContainer` en `/transactions`, el `PeriodMovementsPane` en `/cards/[id]`) son responsables de su propio chrome (encabezado de sección, CTA primaria, navegación). Los primitivos NO SHALL imponer un wrapper visual; el lenguaje vive en row + lista + filtros, no en el contenedor.

Los comportamientos de los primitivos (filtering, running balance, empty states `none` / `filter` / `search`, drawer wiring, paginación, recurrence indicators) SHALL mantenerse inalterados respecto al estado previo. Esta requirement es exclusivamente sobre el contrato visual.

#### Scenario: `/transactions` y `/cards/[id]` heredan el nuevo lenguaje visual sin cambios de comportamiento

- **WHEN** el usuario navega a `/transactions` o a `/cards/[id]` después del rediseño
- **THEN** las filas de movimiento, la lista, y la barra de filtros se renderizan con el mismo lenguaje visual que en `/accounts/[id]`
- **AND** el filtrado, la paginación y el running balance siguen comportándose como antes

#### Scenario: La running balance se oculta debajo de 760px

- **WHEN** la viewport es menor a 760px
- **THEN** cada `MovementRow` renderiza solo el grid de 2 columnas (1fr + 112px)
- **AND** la columna de running balance no se muestra

#### Scenario: Los wrappers de cada ruta proveen su propio chrome de sección

- **WHEN** `MovementList` se renderiza dentro de la `Tarjeta de movimientos` en `/accounts/[id]`
- **THEN** el encabezado de sección (`Movimientos`) y la CTA (`+ Agregar transacción`) viven en el wrapper de la tarjeta, no dentro del primitivo
- **AND** el primitivo solo renderiza la lista de filas agrupadas por día

### Requirement: El hero card de /accounts/[id] usa una superficie navy con radial gradient compuesto por tokens

El **hero card de identidad** de `/accounts/[id]` SHALL renderizar su superficie de fondo como un **radial gradient** compuesto a partir de tres tokens nuevos en `@grana/ui-tokens`:

- `--hero-navy-from`: color inicial del gradient (origin).
- `--hero-navy-to`: color final del gradient (background base).
- `--hero-navy-origin`: posición del centro del radial (`x% y%`).

Los tokens SHALL vivir en `packages/ui-tokens/src/theme.css`. La web SHALL exponer una utility `.bg-hero-navy` que compone los tokens en una declaración `background-color: var(--hero-navy-to); background-image: radial-gradient(circle at var(--hero-navy-origin), var(--hero-navy-from), transparent 60%);`.

El gradient NO SHALL ser autoría inline (`bg-[radial-gradient(...)]`) ni codificado como un único token de string CSS. La forma "partes" (tres tokens separados) SHALL ser la canónica, para que el mirror de mobile vía codegen pueda exponer cada parte como una constante TypeScript y que el componente nativo equivalente (p.ej. `expo-linear-gradient` o un radial wrapper) consuma los stops sin parsear strings CSS.

Los valores concretos de los tres tokens SHALL alinearse a las referencias en `docs/design/accounts-detail/shared.css` (navy de fondo + emerald suave como origin), respetando la regla del repo de no copiar hexes desde la mock: los tokens SHALL referenciar `--navy`, `--emerald-soft` (o variantes existentes en `theme.css`) cuando sea posible, en vez de introducir colores nuevos.

#### Scenario: La superficie del hero card se compone de tres tokens

- **WHEN** la web renderiza el hero card de `/accounts/[id]`
- **THEN** su clase `.bg-hero-navy` resuelve a `background-color: var(--hero-navy-to)` + `background-image: radial-gradient(circle at var(--hero-navy-origin), var(--hero-navy-from), transparent 60%)`
- **AND** los tres tokens están definidos en `packages/ui-tokens/src/theme.css`

#### Scenario: El gradient no se autoriza como string CSS único

- **WHEN** el equipo busca el token del gradient en `theme.css`
- **THEN** no existe ningún token de la forma `--gradient-hero-navy: radial-gradient(...)`
- **AND** existen `--hero-navy-from`, `--hero-navy-to`, `--hero-navy-origin` por separado

#### Scenario: El badge "Archivada" usa una paleta apta para superficie navy

- **WHEN** el hero card renderiza el badge `Archivada` para una cuenta con `is_active=false`
- **THEN** el background y el color del chip provienen de tokens que contrastan sobre superficie navy (p.ej. `bg-navy-soft` + `text-emerald` o un par equivalente)
- **AND** no se usa `bg-yellow-100 text-yellow-800` (paleta de superficie clara)

### Requirement: El drawer de alta de movimiento se abre automáticamente desde un query param

Para permitir que flujos externos al layout `(app)` (como el cierre del onboarding) lleven al usuario directo al alta de un movimiento, el sistema SHALL abrir el drawer de creación de movimiento cuando una ruta dentro de `(app)` se visita con el query param `nuevo=1`. La apertura SHALL ocurrir una sola vez por navegación (no debe reabrirse si el usuario cierra el drawer y permanece en la misma URL), y el query param SHALL limpiarse de la URL al abrir para no re-disparar en refresh o navegación hacia atrás.

El drawer SHALL abrirse en modo creación (equivalente a `openCreate()` sin cuenta preseleccionada), de modo que, si el usuario no tiene movimientos, el tour guiado del primer movimiento arranque con normalidad.

Esta apertura depende de que el `MovementDrawerProvider` esté montado (datos de cuentas/categorías/household listos). Si el provider aún no está disponible al leerse el param, el sistema SHALL reintentar la apertura cuando el provider quede disponible, sin perder la intención.

#### Scenario: Visitar el dashboard con ?nuevo=1 abre el drawer de creación

- **WHEN** un usuario autenticado navega a `/dashboard?nuevo=1`
- **THEN** el drawer de alta de movimiento se abre en modo creación
- **AND** el query param `nuevo` se elimina de la URL (queda `/dashboard`)
- **AND** si el usuario no tiene movimientos, el tour guiado del drawer arranca

#### Scenario: Cerrar el drawer abierto por query param no lo reabre

- **WHEN** el drawer se abrió por `?nuevo=1` y el usuario lo cierra
- **THEN** el drawer permanece cerrado
- **AND** el drawer NO se reabre por la presencia del param (ya fue limpiado de la URL)

### Requirement: El toggle de recurrencia comunica su propósito

El toggle "Hacer recurrente" del alta de movimiento (web) SHALL comunicar para qué sirve, no solo su comportamiento, partiendo la información según el momento de la decisión:

- **Antes de activar** — la nota bajo el label (siempre visible) SHALL comunicar el propósito con ejemplos concretos, para que el usuario decida si le sirve sin tener que activarlo ("Para lo que pagás seguido: alquiler, suscripciones, el sueldo.").
- **Al activar** — el sistema SHALL mostrar un hint contextual **con color** (no texto gris tenue) que explique el mecanismo: cuando corresponde, Grana lo deja listo y el usuario lo registra con un toque, y nunca se registra sin su confirmación.

El hint SHALL ser ayuda contextual permanente mientras el toggle está activo (aparece al activar, desaparece al desactivar) y NO SHALL persistirse en `user_guidance_events` ni marcarse como visto.

Copy de referencia (canon español):
- Nota: "Para lo que pagás seguido: alquiler, suscripciones, el sueldo."
- Hint: "Cuando toca, Grana te lo deja listo y vos lo registrás con un toque. Nunca se carga solo sin tu OK."

#### Scenario: La nota visible comunica el propósito antes de activar

- **WHEN** el usuario ve el toggle "Hacer recurrente" sin activarlo
- **THEN** la nota bajo el label describe para qué sirve con ejemplos (alquiler / suscripciones / sueldo)

#### Scenario: Activar el toggle muestra el hint con el mecanismo

- **WHEN** el usuario activa el toggle "Hacer recurrente" en el alta de movimiento
- **THEN** aparece un hint contextual con tinte de color (no gris)
- **AND** el hint explica que Grana lo deja listo y el usuario lo registra con un toque, sin que se registre sin su confirmación

#### Scenario: Desactivar el toggle oculta el hint

- **WHEN** el usuario desactiva el toggle "Hacer recurrente"
- **THEN** el hint contextual desaparece
- **AND** no se persiste ningún registro de que el hint fue visto

### Requirement: El detalle de una regla recurrente usa vista read-only + edición en drawer

El sistema SHALL exponer la pantalla de detalle de una regla recurrente (`/transactions/recurring/[id]`) con el mismo lenguaje de interacción que el detalle de un movimiento (`/transactions/[txId]`): una **vista de solo lectura** del resumen de la regla por defecto, con las acciones en el header y la edición en un drawer. La pantalla NO SHALL abrir en modo edición.

La vista read-only SHALL mostrar el monto como protagonista junto al tipo y, en filas de metadatos, la frecuencia, la cuenta (o cuenta → destino en transferencias), la categoría cuando aplique, la próxima fecha y la fecha de fin cuando exista. La lista de instancias generadas (`RecurrenceInstancesList`) SHALL mantenerse debajo del resumen.

Las acciones SHALL vivir en el header del detalle como icon-buttons directos (no un dropdown): **Editar**, **Pausar/Reactivar** (un único control que togglea según el estado de la regla) y **Eliminar**. La acción Editar SHALL abrir un drawer; la acción Eliminar SHALL pedir confirmación mediante un diálogo (no un `confirm()` nativo).

El drawer de edición SHALL editar únicamente el field set mutable de la regla — monto, frecuencia, fecha de fin y descripción. La cuenta, la categoría y el tipo de movimiento se fijan al crear la regla y NO SHALL ser editables desde el detalle.

Esta pantalla NO SHALL introducir mutaciones nuevas: reusa las operaciones existentes de actualizar, pausar, reactivar y eliminar reglas recurrentes.

#### Scenario: La pantalla abre en modo lectura

- **WHEN** el usuario abre `/transactions/recurring/[id]`
- **THEN** ve el resumen de la regla en modo solo lectura (monto, frecuencia, cuenta, categoría, próxima fecha y fin si aplica)
- **AND** no hay un formulario de edición visible por defecto

#### Scenario: Editar abre el drawer con el field set reducido

- **WHEN** el usuario activa la acción Editar en el header
- **THEN** se abre un drawer con los campos editables (monto, frecuencia, fecha de fin, descripción)
- **AND** no se ofrecen controles para cambiar la cuenta, la categoría ni el tipo de movimiento
- **AND** al guardar con éxito, el drawer se cierra y el detalle refleja los nuevos valores

#### Scenario: Pausar y reactivar desde el header

- **WHEN** la regla está activa y el usuario activa la acción de estado en el header
- **THEN** la regla se pausa y el control pasa a ofrecer Reactivar
- **WHEN** la regla está pausada y el usuario activa la acción de estado
- **THEN** la regla se reactiva y el control vuelve a ofrecer Pausar

#### Scenario: Eliminar pide confirmación por diálogo

- **WHEN** el usuario activa la acción Eliminar en el header
- **THEN** el sistema muestra un diálogo de confirmación con copy contextual de la regla
- **AND** al confirmar, la regla se elimina/desactiva y el usuario vuelve a `/transactions/recurring`
- **AND** al cancelar, no se realiza ninguna mutación

#### Scenario: Las instancias generadas se mantienen visibles

- **WHEN** el usuario está en el detalle de una regla con instancias generadas
- **THEN** la lista de instancias se muestra debajo del resumen, igual que antes del rework

### Requirement: El listado global permite mostrar u ocultar los movimientos compartidos

El módulo global de movimientos SHALL ofrecer un control en la toolbar (un botón, junto a búsqueda/filtros) que muestra u oculta los movimientos compartidos (`is_shared = true`). Por defecto el control SHALL estar **encendido** (compartidos visibles). Cuando el usuario lo apaga, el listado SHALL consultar únicamente movimientos no compartidos.

A diferencia del resto de los filtros —que viven en React state y se resetean al recargar—, esta preferencia SHALL **persistir por usuario** entre sesiones y recargas: si el usuario la apaga, SHALL permanecer apagada hasta que el usuario la vuelva a encender. El control NO SHALL mostrarse como chip removible ni contar en el contador de "Filtros".

El filtrado SHALL aplicarse en la consulta paginada (RPC), no descartando filas en cliente, para preservar paginación y conteos.

#### Scenario: Por defecto los compartidos se muestran

- **WHEN** un usuario abre `/transactions` por primera vez (sin preferencia guardada)
- **THEN** el control de visibilidad de compartidos está encendido
- **AND** el listado incluye tanto movimientos propios como compartidos

#### Scenario: Ocultar compartidos

- **WHEN** el usuario apaga el control
- **THEN** el listado deja de mostrar los movimientos con `is_shared = true`
- **AND** la sección de movimientos se reconsulta excluyéndolos en la consulta paginada

#### Scenario: La preferencia persiste por usuario

- **WHEN** el usuario apagó el control y luego recarga la página o vuelve más tarde
- **THEN** el control sigue apagado y los compartidos siguen ocultos
- **AND** permanece así hasta que el usuario lo vuelva a encender

#### Scenario: Volver a mostrar compartidos

- **WHEN** el usuario enciende nuevamente el control
- **THEN** el listado vuelve a incluir los movimientos compartidos
- **AND** la preferencia queda guardada como encendida

#### Scenario: El control no es un chip de filtro

- **WHEN** el control de compartidos está apagado
- **THEN** no aparece como chip removible bajo la barra ni incrementa el contador del botón "Filtros"
- **AND** su estado se refleja en el propio botón de la toolbar

### Requirement: La tab Movimientos de mobile muestra el feed global navegable por mes

La pestaña primaria **Movimientos** de la app mobile SHALL renderizar el feed global de movimientos del usuario, navegable por mes y **acotable por filtros**, como thin consumer del read compartido `getGlobalMovementsPage` de `@grana/transactions`.

La pantalla SHALL mostrar, desde el primer frame, el chrome siempre visible: el `PageHeader` nativo (navy) con el título de la sección y el acceso a recurrencias, y un **selector de mes** (el `MonthNavigator` compartido, con controles prev / ‹mes› / next). El mes inicial SHALL ser el mes actual (`monthOf(getTodayAR())`). Cambiar de mes SHALL recargar el feed de ese mes y resetear la paginación.

La lista SHALL reusar los primitivos nativos `MovementList` / `MovementRow` (`apps/mobile/components/movements/`), renderizando las filas del feed agrupadas por fecha. El estado de mes del feed SHALL ser **independiente** del mes del dashboard (navegar uno no mueve el otro).

**Barra de filtros.** La pantalla SHALL ofrecer, bajo el selector de mes: una **búsqueda de texto libre** (input inline que se despliega desde un chip de acción), una **hoja de filtros** (`MovementFiltersSheet`) con tipo, cuenta, categoría, subcategoría, moneda y rango de monto, y los **chips de filtro activos removibles**. El chip que abre la hoja SHALL mostrar el conteo de filtros de contenido activos; ese conteo SHALL **excluir el mes y la búsqueda**, que tienen sus propios controles. El **filtro de cuenta** SHALL ofrecerse sólo cuando hay dos o más cuentas que desambiguar.

**Los filtros SHALL resolverse en la base, no en memoria.** El estado de filtros SHALL proyectarse al contrato `MovementFilters` y viajar a la RPC `get_movements_page`; la pantalla NO SHALL filtrar las filas ya recibidas. La razón es de corrección, no de performance: el feed pagina, de modo que un filtro aplicado sobre la página cargada devolvería las coincidencias **de esa página** en vez de las del mes, y `hasMore` dejaría de describir el conjunto que el usuario está viendo. Esta es la diferencia de diseño con el toolbar del detalle de cuenta, que sí filtra en memoria porque tiene el historial completo de la cuenta cargado (ver la spec de `accounts`); las dos superficies comparten la hoja de filtros, no la forma de aplicarlos.

**El eje de tipo SHALL ser el `kind` derivado** (`MovementTypeFilter` = `FinancialMovement['kind']`), no la columna `transaction_type`. Es lo que el contrato `MovementFilters` ya declara y lo que la RPC ya compara, e incluye las distinciones que el usuario ve dibujadas en los badges de la fila (compra en cuotas, pago de resumen, reintegro).

**Las opciones de la hoja SHALL derivarse del catálogo** (cuentas activas, categorías activas y subcategorías de la categoría seleccionada), vía el read compartido `getMovementFilterOptions` de `@grana/transactions`. NO SHALL derivarse de las filas cargadas: sobre una lista paginada, eso produce un menú de filtros que crece al pedir más filas. Como consecuencia aceptada, el menú PUEDE ofrecer una opción que devuelva cero resultados; el empty-state de sin-resultados es lo que lo explica.

**La búsqueda del feed SHALL matchear lo que matchea la RPC** — título, descripción efectiva y nombres de cuenta origen/destino — y por lo tanto **NO** matchea nombres de categoría ni de subcategoría, a diferencia de la búsqueda del detalle de cuenta, que corre en cliente sobre otro modelo. La divergencia es consecuencia directa del filtrado server-side y SHALL quedar documentada como tal; cerrarla es un change sobre la RPC, con impacto en web.

La paginación SHALL seguir el patrón limit+1 lookahead que el read expone (`{ movements, hasMore, nextLimit }`): mientras `hasMore`, la pantalla SHALL ofrecer una acción "cargar más" que sube el límite hasta `MAX_MOVEMENTS_LIMIT`, respetando los filtros activos. **Cualquier** cambio de filtro —mes, búsqueda, tipo, cuenta, categoría, subcategoría, moneda, rango de monto, o limpiar— SHALL resetear el límite a `DEFAULT_MOVEMENTS_LIMIT`, no sólo el cambio de mes. El reset y el cambio de filtro SHALL ocurrir en una sola actualización de estado, para que no se dispare un fetch intermedio con el filtro nuevo y el límite viejo.

Cuando la lista queda vacía, la pantalla SHALL mostrar un empty-state con **tres** variantes:

1. **Sin resultados** — hay filtros de contenido o búsqueda activos. SHALL ofrecer una acción para limpiarlos.
2. **Bienvenida** — no hay filtros activos y el usuario no tiene ningún movimiento (`hasAnyTransaction === false`).
3. **Mes vacío** — no hay filtros activos, el usuario tiene historial en otros meses y este mes está vacío.

El discriminador SHALL resolverse sin I/O adicional: la presencia de filtros activos se evalúa primero, y sólo si no los hay se consulta `hasAnyTransaction`. Los copies SHALL leerse del catálogo compartido `@grana/i18n-messages`, sin agregar keys nuevas.

Las **filas del feed SHALL ser navegables**: tocar una fila SHALL abrir el detalle del movimiento (`/transactions/[txId]`, ver el requirement del detalle nativo), pasando el contexto de origen (`?from=…`) para resolver el back. El `QuickAddFab` está **habilitado** (alta de movimiento, ver su requirement). El **breakdown por categoría** del feed web sigue explícitamente fuera de alcance: es otra superficie, normada por la spec `spending-by-category`. Los **bloques de pendientes** (recurrencias y reintegros) SÍ se renderizan sobre la lista, cada uno especificado en su propio requirement.

El read SHALL usar el mismo RPC `get_movements_page` y el mismo anon-key/RLS path que web (sin cambios de datos, API ni RLS).

#### Scenario: La tab Movimientos renderiza el feed del mes actual

- **WHEN** el usuario abre la pestaña Movimientos
- **THEN** ve el `PageHeader` + el selector de mes posicionado en el mes actual desde el primer frame
- **AND** ve la lista de movimientos de ese mes agrupada por fecha usando `MovementList`/`MovementRow` nativos
- **AND** el read se resuelve vía `getGlobalMovementsPage(supabase, { filters: { month } })` de `@grana/transactions`

#### Scenario: Navegar entre meses recarga el feed

- **WHEN** el usuario toca prev/next en el selector de mes
- **THEN** el feed se recarga con los movimientos del nuevo mes (`shiftMonth`)
- **AND** el límite de paginación se resetea a `DEFAULT_MOVEMENTS_LIMIT`
- **AND** el mes del dashboard no se ve afectado

#### Scenario: Los filtros del feed viajan a la base

- **WHEN** el usuario aplica un filtro de contenido (tipo, cuenta, categoría, subcategoría, moneda o rango de monto) o escribe en la búsqueda
- **THEN** el estado se proyecta a `MovementFilters` y se pasa a `getGlobalMovementsPage`, que lo traduce a la RPC `get_movements_page`
- **AND** la pantalla NO filtra en memoria las filas ya recibidas
- **AND** el `queryKey` de la lista incluye los filtros proyectados, de modo que cada combinación tiene su propia entrada de cache

#### Scenario: Cambiar un filtro resetea la paginación

- **WHEN** el usuario tiene el límite subido por "cargar más" y cambia cualquier filtro
- **THEN** el límite vuelve a `DEFAULT_MOVEMENTS_LIMIT` en la misma actualización de estado que el filtro
- **AND** no se dispara ningún fetch intermedio con el filtro nuevo y el límite anterior

#### Scenario: Cargar más respeta los filtros activos

- **WHEN** hay filtros activos, el resultado tiene más filas que el límite actual (`hasMore === true`) y el usuario activa "cargar más"
- **THEN** la lista sube el límite a `nextLimit` (tope `MAX_MOVEMENTS_LIMIT`) y las filas adicionales cumplen los mismos filtros
- **AND** `hasMore` describe el conjunto filtrado, no el mes completo

#### Scenario: El conteo de "Filtros" excluye mes y búsqueda

- **WHEN** el usuario tiene seleccionado un mes distinto del actual y un texto de búsqueda, sin filtros de contenido
- **THEN** el chip que abre la hoja no muestra conteo
- **AND** al aplicar además un filtro de tipo y uno de moneda, el conteo muestra 2

#### Scenario: El filtro de cuenta aparece sólo con dos o más cuentas

- **WHEN** el usuario tiene una sola cuenta
- **THEN** la hoja de filtros no ofrece el filtro de cuenta
- **AND** con dos o más cuentas activas, sí lo ofrece

#### Scenario: Las opciones de la hoja salen del catálogo

- **WHEN** la pantalla abre la hoja de filtros
- **THEN** las cuentas, categorías y subcategorías ofrecidas provienen de `getMovementFilterOptions` de `@grana/transactions`
- **AND** la lista de opciones no cambia al pedir más filas con "cargar más"

#### Scenario: Empty-state cuando los filtros vacían la lista

- **WHEN** hay filtros de contenido o búsqueda activos y ningún movimiento coincide
- **THEN** la pantalla muestra el copy de sin-resultados con una acción para limpiar los filtros
- **AND** no consulta `hasAnyTransaction`, porque la causa de la lista vacía ya está determinada

#### Scenario: Empty-state distingue usuario nuevo de mes vacío

- **WHEN** el mes seleccionado no tiene movimientos y no hay filtros de contenido ni búsqueda activos
- **THEN** si el usuario no tiene ningún movimiento en ningún mes (`hasAnyTransaction === false`), la pantalla muestra el copy de bienvenida
- **AND** si tiene historial en otros meses, muestra el copy de mes-vacío
- **AND** los tres copies se leen del catálogo compartido `@grana/i18n-messages`

#### Scenario: La búsqueda del feed no matchea nombres de categoría

- **WHEN** el usuario busca el nombre de una categoría en el feed y ningún movimiento la lleva en su descripción
- **THEN** la lista no devuelve esos movimientos, porque el match lo resuelve la RPC sobre título, descripción efectiva y nombres de cuenta
- **AND** el filtro de categoría de la hoja sí los devuelve

#### Scenario: Tocar una fila del feed abre el detalle

- **WHEN** el usuario toca una fila del feed de Movimientos
- **THEN** navega al detalle `/transactions/[txId]` de ese movimiento, pasando el contexto de origen (`?from=…`) para resolver el back
- **AND** el feed no renderiza breakdown por categoría

### Requirement: Las opciones de filtro de movimientos viven en `@grana/transactions`

El read que resuelve las opciones de la hoja de filtros —cuentas activas con su avatar resuelto, categorías activas, y subcategorías de la categoría seleccionada— SHALL vivir en `@grana/transactions` como isomórfico (`GranaSupabaseClient` como primer parámetro), consumido por **web y mobile**. Es una sola implementación: web SHALL importarlo del package y re-exportarlo desde `apps/web/lib/transactions/queries.ts` para no tocar sus call-sites, con comportamiento idéntico.

El package SHALL resolver por sí mismo el `select` de subcategorías en vez de depender de un helper de `apps/web`. La función homónima de `apps/web/lib/categories/queries.ts` SHALL permanecer donde está, porque tiene consumidores propios ajenos a los filtros.

`@grana/transactions` SHALL declarar `@grana/ui-contracts` como dependencia directa, que es de donde sale la resolución del avatar de cuenta. No introduce ciclo: `@grana/ui-contracts` no depende de ningún package del repo.

#### Scenario: Web y mobile comparten las opciones de filtro

- **WHEN** el feed global (web o mobile) o un detalle de cuenta (web o mobile) puebla su hoja de filtros
- **THEN** las opciones salen de la misma función de `@grana/transactions`, sobre el mismo cliente autenticado y el mismo path de RLS
- **AND** no existe una segunda implementación del read en `apps/web` ni en `apps/mobile`

#### Scenario: La promoción no cambia el comportamiento de web

- **WHEN** las superficies web que ya usaban este read se ejecutan después de la promoción
- **THEN** reciben la misma forma de datos y las mismas opciones que antes
- **AND** sus imports y sus `queryKey` de TanStack quedan sin cambios


### Requirement: La app nativa expone la pantalla de alta de movimiento `/transactions/new`

La app nativa SHALL exponer una pantalla full-screen `/transactions/new` para **registrar** un movimiento, como thin consumer del hook `useMovementForm` de `@grana/movement-form`. La pantalla SHALL montar el hook pasándole: las cuentas del usuario proyectadas a `MovementFormAccount`, el árbol de categorías (`getAllCategories`), el hogar (`getHousehold`, cuando exista), `today: getTodayAR()`, una `translate` wire al i18n mobile, y un objeto `Mutators` nativo. La JSX SHALL ser RN idiomática sobre los primitivos existentes (`PageHeader`, `Segmented`, `MoneyAmountInput`, `DateField`, `SelectField`/`SelectSheet`, `Switch`, `FormError`), con la chrome (`PageHeader` + CTA) visible desde el primer paint.

La selección de **cuenta** y **categoría** SHALL renderizarse con el picker `SelectField` + `SelectSheet` (un trigger-row compacto que muestra la selección actual —avatar + nombre, o placeholder— y abre un `formSheet` modal con la lista), NO como listas de filas inline. El picker NO SHALL incluir buscador (paridad con web). La selección de categoría SHALL drillear **un nivel** dentro del mismo sheet, espejo del web: nivel de categorías (las que tienen subcategorías abren el drill; las que no, se seleccionan directo) → nivel drilleado con "volver", "Toda la categoría" y las subcategorías. El trigger de categoría SHALL mostrar `Categoría › Subcategoría` cuando hay subcategoría elegida.

El alcance de esta pantalla es **create-completo**: SHALL ofrecer las cinco tabs **Gasto**, **Ingreso**, **Transferencia**, **Ajuste** y **Cambio**. El picker de cuentas SHALL incluir **todas** las cuentas del usuario (cash, bank y credit), proyectando las credit como off-ledger (`balances: { ARS: 0, USD: 0 }`, avatar resuelto vía `resolveAccountAvatar`); el gate `eligibleFor` del hook restringe credit a la tab Gasto, y la fila credit SHALL mostrar el hint de consumo de tarjeta (`transactions.drawer.credit_hint`). La pantalla NO SHALL ofrecer (todavía) la **edición** de movimientos (change C).

Con una cuenta credit seleccionada en Gasto, la pantalla SHALL ofrecer **cuotas** cuando la moneda es ARS: chips preset `1·3·6·12` más un stepper custom acotado a 2–60, con preview del monto por cuota y CTA dinámico (`actions.register_installments`); con moneda USD SHALL mostrar el hint de cuotas-sólo-ARS en lugar de los chips, sin bloquear el consumo simple en USD. El submit SHALL rutear vía el hook a `registerCardPurchase` (consumo simple) o `registerInstallments` (cuotas), sin lógica de ruteo propia en la pantalla.

En la tab Gasto la pantalla SHALL ofrecer la **declaración de reintegro** con paridad web y **superficie mínima**, como el **bloque compacto de dos filas** del diseño cerrado (`docs/design/movement-form/reintegro/`): fila 1 con el **monto del reintegro** y la regla **`% + tope` visible inline** (`applyReimbursementPercent`, bidireccional, con el tope resaltado cuando aplica); fila 2 con el **destino** *Resumen | Cuenta* (sólo con credit; cash/bank implica 'account', sin control de resumen) y el estado **"Acreditado"** (checkbox compacto, con su comportamiento pendiente/recibido, no un input crudo). El destino default es Resumen; tocar "Cuenta" elige la cuenta de la **misma entidad del medio de pago** sin abrir el picker, y tocar el **nombre** abre el picker de cuenta de acreditación (misma entidad primero; oculto cuando hay una sola cuenta cash/bank elegible). El bloque SHALL estar disponible también sobre una compra **en cuotas**: el hook vincula el reintegro a la madre de la compra (el subtipo *a resumen* cae en el período de la primera cuota), igual que web. La superficie mínima y la paridad de estos controles con la web-mobile la fija el requirement «El despliegue de las secciones avanzadas es de superficie mínima y paritario entre las superficies mobile».

La pantalla SHALL soportar el **gasto compartido**: cuando el hogar tiene exactamente dos miembros, SHALL exponer el toggle "Compartir gasto" y el control de split como **atajos de un gesto** (Mitad / 70/30 / 75/25 / Todo suyo) más un escape a **porcentaje libre** ("Otro"), con una **barra de reparto Vos / [otro integrante]**, permitiendo **cualquier reparto** incluido el **100%-al-otro-miembro** (atajo "Todo suyo", que fija 0/100). Si no hay hogar de dos miembros (o el read falla), el toggle NO SHALL renderizarse y el alta simple SHALL seguir funcionando.

En la tab **Ajuste** la pantalla SHALL ofrecer un toggle de **dirección** Suma/Resta (`Segmented` de dos opciones cortas, sobre `adjustmentDirection`), un **banner** informativo (`drawer.adjust_banner_title`/`_body`) y un **preview de saldo** "Saldo quedará" que muestre `saldo actual → saldo resultante` computado con `Money.add`/`Money.subtract` sobre el balance de la moneda seleccionada según la dirección. La descripción SHALL re-etiquetarse a "Motivo del ajuste" (`drawer.adjust_reason`) y la categoría NO SHALL renderizarse. El submit SHALL rutear vía el hook a `createAdjustment` con el monto firmado por la dirección.

En la tab **Cambio** la pantalla SHALL ofrecer un picker de **cuenta destino** (cash/bank, reusando el `AccountSelectField`) y una card de **monto recibido** (`labels.exchange_received`) con un segundo `MoneyAmountInput`, el chip de la moneda destino derivada (`exchangeDestCurrency`, la opuesta a la de origen) y un hint de tasa implícita read-only. Cuando la cuenta destino NO habilita la otra moneda (`exchangeDestCurrency` es null) la pantalla SHALL mostrar el hint `exchange.no_other_currency_hint` en lugar de la card, y el submit SHALL bloquearse in-context (el hook valida `destination_account_no_other_currency`). El submit SHALL rutear vía el hook a `createExchange`.

En las tabs **Gasto** (sin cuotas), **Ingreso** y **Transferencia** la pantalla SHALL ofrecer un toggle **Repetir** (recurrencia): `Switch` (`isRecurrent`) más, al activarse, chips de **frecuencia** (semanal/quincenal/mensual/anual/personalizado sobre `frequency`), y —para `custom`— un `intervalCount` numérico junto a un selector de **unidad** por **chips** (día/semana/mes/año, `intervalUnit`), y un `DateField` de "repetir hasta" opcional (`recurrenceEndDate`; el orquestador valida `end_date ≥ fecha del movimiento` server-side). El toggle NO SHALL renderizarse en Ajuste, Cambio ni sobre una compra **en cuotas**. Al guardar con recurrencia activa, tras crear el movimiento el submit SHALL invocar `createRecurrenceFromMovement` vía el hook; si esa llamada falla, el error SHALL mostrarse in-context.

Al guardar con éxito, `onSuccess` SHALL navegar de vuelta al feed y `onMutationSuccess` SHALL invalidar las queries de TanStack del feed / dashboard / accounts, de modo que el movimiento recién creado aparezca sin recarga manual. Los errores de validación/guardado SHALL mostrarse in-context (`FormError` con `form.formError`) sin perder el input.

#### Scenario: Registrar un gasto simple desde mobile

- **WHEN** el usuario tapea el FAB, elige la tab "Gasto", una cuenta cash/bank, un monto, una categoría y guarda
- **THEN** la pantalla invoca `form.onSubmit`, que dispara el mutator `createExpense` nativo (validate + auth + la thin mutation compartida)
- **AND** al éxito navega de vuelta al feed y el gasto aparece en el mes correspondiente sin recarga manual

#### Scenario: Elegir cuenta y categoría vía el picker de sheet

- **WHEN** el usuario tapea el trigger de "Cuenta" (o "Categoría")
- **THEN** se abre un `formSheet` modal con la lista (sin buscador) y al elegir una opción el sheet se cierra y el trigger muestra la selección (avatar + nombre; para categoría, `Categoría › Subcategoría`)
- **AND** en categoría, elegir una categoría con subcategorías drillea un nivel dentro del sheet (con "volver" y "Toda la categoría") en vez de seleccionar directo

#### Scenario: Registrar un ingreso o una transferencia desde mobile

- **WHEN** el usuario elige la tab "Ingreso" (o "Transferencia") y completa los campos requeridos
- **THEN** el submit dispara `createIncome` (o `createTransfer`) vía el mutator nativo
- **AND** las cascadas del hook (cuentas elegibles, moneda, destino) se comportan igual que en web

#### Scenario: Registrar un consumo simple en tarjeta desde mobile

- **WHEN** el usuario elige la tab "Gasto", selecciona una cuenta credit, completa monto/categoría y guarda con cuotas en 1
- **THEN** el submit rutea a `registerCardPurchase` vía el hook (el consumo queda off-ledger, asignado a su período)
- **AND** la fila credit del picker muestra el hint de consumo de tarjeta
- **AND** las tabs Ingreso y Transferencia no ofrecen la cuenta credit

#### Scenario: Registrar un consumo en cuotas desde mobile

- **WHEN** el usuario, con una credit en ARS, elige 3 cuotas (o un valor custom vía stepper, p. ej. 24) y guarda
- **THEN** el preview muestra el monto por cuota antes del submit y el CTA refleja la cantidad de cuotas
- **AND** el submit rutea a `registerInstallments`, creando la madre y sus cuotas
- **AND** con moneda USD los chips de cuotas no se ofrecen (hint cuotas-sólo-ARS) pero el consumo simple USD sigue permitido

#### Scenario: Declarar un reintegro desde mobile

- **WHEN** el usuario registra un gasto (cash/bank, o credit con o sin cuotas), activa el toggle Reintegro y completa el monto (directo o por %/tope, ambos visibles inline)
- **THEN** el submit envía la declaración al mutator (`createExpense`, `registerCardPurchase` o `registerInstallments`), que la inserta atómicamente con rollback
- **AND** con credit el usuario puede elegir destino *Resumen* (reduce el período) o *Cuenta* (misma entidad del medio de pago por defecto); con cash/bank el destino es *a cuenta* sin control de resumen
- **AND** sobre una compra en cuotas el reintegro se vincula a la madre (el subtipo *a resumen* cae en el período de la primera cuota)

#### Scenario: Gasto compartido 100%-al-otro desde mobile

- **WHEN** el hogar tiene dos miembros y el usuario activa "Compartir gasto" y toca el atajo "Todo suyo"
- **THEN** el submit envía el spec de split al mutator, que aplica `applySharedSplits` con el reparto 0/100
- **AND** el gasto queda marcado como compartido con la porción íntegra correspondiente al otro miembro

#### Scenario: Gasto compartido con reparto arbitrario desde mobile

- **WHEN** el hogar tiene dos miembros y el usuario activa "Compartir gasto", toca "Otro" e ingresa `70`
- **THEN** el reparto queda 70/30 y el submit envía ese spec de split al mutator
- **AND** el reparto arbitrario está disponible en mobile igual que en web

#### Scenario: Registrar un ajuste de saldo desde mobile

- **WHEN** el usuario elige la tab "Ajuste", selecciona una cuenta, un monto, la dirección Suma o Resta, escribe un motivo y guarda
- **THEN** el preview "Saldo quedará" muestra `saldo actual → saldo resultante` según la dirección antes del submit
- **AND** el submit rutea a `createAdjustment` con el monto firmado (negativo en Resta) y sin categoría

#### Scenario: Registrar un cambio de moneda desde mobile

- **WHEN** el usuario elige la tab "Cambio", una cuenta de origen, una cuenta destino que habilita la otra moneda, el monto entregado y el monto recibido, y guarda
- **THEN** la card de monto recibido muestra la moneda destino derivada y la tasa implícita, y el submit rutea a `createExchange`
- **AND** si la cuenta destino no habilita la otra moneda, la pantalla muestra el hint "sin otra moneda" y el submit queda bloqueado in-context

#### Scenario: Registrar un movimiento recurrente desde mobile

- **WHEN** el usuario registra un gasto simple / ingreso / transferencia, activa el toggle "Repetir", elige una frecuencia (y para "personalizado" un intervalo count+unidad por chips y opcionalmente una fecha de fin) y guarda
- **THEN** el submit crea primero el movimiento y luego invoca `createRecurrenceFromMovement` con la frecuencia declarada
- **AND** el toggle "Repetir" no se ofrece en las tabs Ajuste ni Cambio, ni sobre una compra en cuotas

#### Scenario: La chrome de la pantalla de alta está visible desde el primer paint

- **WHEN** la pantalla `/transactions/new` hace cold-load y aún resuelve `accounts`/`categories`/`household`
- **THEN** el `PageHeader` (back + título) y el CTA de guardar ya están presentes (el CTA deshabilitado hasta que el form está listo)
- **AND** la carga no se cubre con un skeleton que tape la chrome

### Requirement: El usuario puede agregar, editar o quitar un reintegro al editar un gasto

Al editar un gasto, el usuario SHALL poder gestionar su reintegro vinculado mediante el mismo bloque "Tiene reintegro" del alta (monto esperado, helper de %/tope, subtipo *a cuenta* / *en resumen*, cuenta de acreditación y "ya me lo acreditaron"). El bloque SHALL estar disponible para los mismos tipos de gasto que el alta: gasto simple (efectivo/banco), compra de tarjeta de un solo pago y compra en cuotas.

Las operaciones disponibles dependen del estado del reintegro vinculado:

- Si el gasto **no tiene** reintegro, el usuario SHALL poder **agregar** uno (pendiente o ya recibido), como en el alta.
- Si el gasto tiene un reintegro **pendiente** (`received_at IS NULL` y `cancelled_at IS NULL`), el usuario SHALL poder **editar** su monto, subtipo, cuenta de acreditación y estado (marcarlo como recibido), o **quitarlo**.
- Si el gasto tiene un reintegro **recibido** (`received_at` seteado) o **cancelado** (`cancelled_at` seteado), la sección SHALL mostrarse **read-only**: el sistema NO SHALL permitir editarlo ni quitarlo desde el formulario de edición, porque esas transiciones ya impactaron saldo/resumen y se gestionan desde sus flujos propios (confirmar / cancelar / reabrir).

El reintegro en una compra en cuotas SHALL vincularse a la **madre** (no a una cuota hija); con subtipo "en resumen" SHALL imputarse al período de la **primera cuota**, sin selector de período, en paridad con el alta.

Cuando el gasto es **compartido**, el reintegro agregado o editado SHALL heredar el mismo split del hogar en una única fila, de modo que la deuda derivada lo netee. Si en la misma edición cambia el estado de compartido del gasto, el reintegro vinculado SHALL reflejar ese cambio (heredar el split al compartir, dejar de tenerlo al descompartir).

La edición del reintegro y la del gasto SHALL ser consistentes: si la aplicación del reintegro falla, el sistema SHALL informar el error sin dejar el par gasto/reintegro en un estado inconsistente.

#### Scenario: Agregar un reintegro pendiente a un gasto que no tenía

- **WHEN** el usuario abre la edición de un gasto sin reintegro y activa "Tiene reintegro" con un monto y subtipo "a cuenta", sin marcarlo como recibido
- **THEN** el sistema crea un reintegro pendiente vinculado al gasto
- **AND** el monto no entra a ningún cálculo hasta que se confirme como recibido

#### Scenario: Agregar un reintegro ya recibido en la edición

- **WHEN** el usuario edita un gasto sin reintegro, activa "Tiene reintegro" y marca "ya me lo acreditaron"
- **THEN** el reintegro se crea con `received_at` seteado y entra en los cálculos como un hecho real, sin pasar por el estado pendiente

#### Scenario: Editar el monto de un reintegro pendiente

- **WHEN** el usuario edita un gasto cuyo reintegro está pendiente y cambia el monto esperado
- **THEN** el reintegro vinculado queda con el nuevo monto esperado
- **AND** sigue pendiente (no se marca como recibido por el solo hecho de editar el monto)

#### Scenario: Quitar un reintegro pendiente

- **WHEN** el usuario edita un gasto con un reintegro pendiente y desactiva "Tiene reintegro"
- **THEN** el sistema elimina el reintegro vinculado
- **AND** el gasto queda sin reintegro, sin afectar su propio monto ni su categoría

#### Scenario: Un reintegro recibido se muestra read-only

- **WHEN** el usuario edita un gasto cuyo reintegro ya está recibido (`received_at` seteado)
- **THEN** la sección de reintegro se muestra como contexto de solo lectura
- **AND** el sistema no ofrece editar el monto/subtipo/cuenta ni quitar el reintegro desde este formulario

#### Scenario: Un reintegro cancelado se muestra read-only

- **WHEN** el usuario edita un gasto cuyo reintegro está cancelado (`cancelled_at` seteado)
- **THEN** la sección de reintegro se muestra como contexto de solo lectura, sin permitir editarlo ni quitarlo desde este formulario

#### Scenario: Agregar un reintegro a una compra en cuotas se vincula a la madre

- **WHEN** el usuario edita una compra en cuotas (madre) y agrega un reintegro
- **THEN** el reintegro se vincula a la **madre** de la compra, no a una cuota hija

#### Scenario: Reintegro en resumen sobre cuotas cae en el período de la primera cuota

- **WHEN** el usuario agrega, al editar una compra en cuotas, un reintegro con subtipo "en resumen"
- **THEN** el reintegro se imputa al período de la **primera cuota** (el de la fecha de compra), sin pedir un período

#### Scenario: El reintegro de un gasto compartido hereda el split

- **WHEN** el usuario agrega o edita un reintegro sobre un gasto compartido de su hogar
- **THEN** el reintegro hereda el mismo split del hogar en una única fila, para que la deuda derivada lo netee

#### Scenario: Descompartir el gasto quita el split del reintegro

- **WHEN** el usuario, en la misma edición, descomparte un gasto que tenía un reintegro pendiente compartido
- **THEN** el reintegro deja de tener el split heredado, en consistencia con el gasto ya no compartido

### Requirement: La cuenta de débito de un pago de resumen es editable

Al editar un **pago de resumen** (el gasto-débito que salda un período de tarjeta), el sistema SHALL permitir cambiar la **cuenta desde donde salió el pago**. Cambiarla SHALL mover el débito a la cuenta nueva y recalcular los saldos de ambas cuentas; el vínculo del pago con el período (`period_payments`) y el estado `paid` de las cuotas/consumos del período NO SHALL verse afectados.

La cuenta nueva SHALL ser una cuenta de débito (efectivo o banco, no de crédito) con la moneda del pago activa. Esta editabilidad SHALL aplicar **solo** al pago de resumen: la cuenta del resto de los movimientos (incluido un consumo de tarjeta, cuya cuenta define el período) permanece inmutable en la edición.

#### Scenario: Corregir la cuenta desde donde se pagó el resumen

- **WHEN** el usuario edita un pago de resumen que salió de una cuenta equivocada y elige otra cuenta de débito
- **THEN** el pago queda registrado desde la cuenta nueva y los saldos de ambas cuentas se recalculan
- **AND** el período sigue pagado y sus cuotas siguen en estado `paid`

#### Scenario: La cuenta de un consumo de tarjeta sigue inmutable

- **WHEN** el usuario edita un consumo de tarjeta (no un pago de resumen)
- **THEN** la cuenta permanece como contexto de solo lectura, sin opción de cambiarla

#### Scenario: La cuenta nueva debe soportar la moneda del pago

- **WHEN** el usuario intenta mover el pago a una cuenta que no tiene la moneda del pago activa
- **THEN** el sistema rechaza el cambio y no altera la cuenta del pago

### Requirement: La app nativa expone el detalle de movimiento `/transactions/[txId]`

La app nativa SHALL exponer una pantalla de detalle `/transactions/[txId]` para cada movimiento. La pantalla SHALL ser thin consumer de los reads del grafo de la transacción extraídos a `@grana/transactions` (`getTransactionDetail`, `getInstallmentFamily`, `getReimbursementsForExpense`) más el mirror thin de `getMovementSharedInfo` en mobile, y SHALL reusar los VMs/tono compartidos (`toFinancialMovement`, `resolveMovementView`, `Tone`) y las keys `transactions.detail.*` de `@grana/i18n-messages` (cero i18n nuevo).

Los reads del grafo de la transacción SHALL vivir en `@grana/transactions` como isomórficos (`GranaSupabaseClient`), reusando `TRANSACTION_SELECT` / `attachLinkedExpenses` ya compartidos; **web SHALL consumirlos desde el package** (una sola implementación, sin cambio de comportamiento — los tests web siguen verdes). El read mobile SHALL usar el mismo anon-key/RLS path que web; el detalle es **legible cross-user** (un movimiento compartido lo ven ambos miembros del hogar).

La **presentación** SHALL reflejar la anatomía web con primitivos nativos (no el HTML): un **topbar** (`PageHeader` nativo) con back que resuelve el origen (`?from=account:<id>` / `?from=card:<id>` / feed), un **hero tonal** y una **grilla de tiles** en una columna. El chrome (topbar) SHALL estar visible desde el primer paint (el skeleton de carga NO SHALL taparlo).

El **hero** SHALL mostrar: banda tintada por el **tono del tipo** (gasto → terracotta signo `−`; ingreso → emerald-deep signo `+`; transferencia → slate, sin signo), el **ícono de categoría** en un cuadro tintado, el **monto grande** tonal con el símbolo de moneda opaco y los decimales según `showCents`, una **línea de contexto**, y una fila de **chips** (fecha · medio de pago · categoría · subcategoría). Las transferencias SHALL llevar el eyebrow "Transferencia interna".

Los **tiles core por tipo** SHALL incluir: **medio de pago** (nombre + tipo de cuenta, NUNCA número de tarjeta), **progreso de cuotas** (barra pagadas/restantes + próxima/fin) para compras en cuotas, **flujo de transferencia/cambio** (origen → destino) con el callout "no cuenta como gasto ni ingreso", **reintegro-neto** (pagaste + reintegro = costo neto, con el gasto vinculado **tappable** a su detalle), **reparto compartido** ("Te toca pagar" + "Dividido entre", sin badge de liquidación) y **descripción**. El detalle SHALL mostrar un estado sólo cuando informa algo real (*Reintegrado* / *Completada* / *Acreditado*).

El detalle SHALL exponer las afordancias de **editar** y **borrar** el movimiento, gateadas por permiso: SHALL calcular `canManage` (= el usuario actual es el dueño/pagador), `canEdit` (`canManage` && cuenta resoluble && no es cuota hija — un consumo con `status='paid'` **SÍ** es editable: conserva categoría y descripción, ver el requirement "El usuario puede editar una transacción") y `canDelete` (`canManage` && cuenta resoluble && sin `parent_id` && `status !== 'paid'`), con las mismas reglas que el detalle web. Un movimiento compartido pagado por el **otro** miembro SHALL ser legible pero NO editable ni borrable (las acciones se ocultan). La acción **Editar** SHALL navegar a `/transactions/[txId]/edit`; la acción **Borrar** SHALL confirmar de forma destructiva antes de ejecutar (ver el requirement de edición/borrado).

Los tiles de **contexto** que requieren reads adicionales — **"Peso en el mes"** (breakdown del mes), **recurrencia** (tile + historial + banner) y **composición de pago de resumen** — quedan **fuera de este alcance**; la pantalla SHALL omitirlos sin romper para esos kinds.

#### Scenario: Tocar una fila abre el detalle

- **WHEN** el usuario toca una fila del feed de un gasto categorizado en una cuenta cash
- **THEN** navega a `/transactions/[txId]` y ve el hero con tono gasto (terracotta), monto con signo `−`, ícono de categoría tintado, título, línea de contexto y los chips fecha · medio · categoría · subcategoría
- **AND** la grilla muestra los tiles "Medio de pago" y "Descripción" (si la tiene)
- **AND** el back resuelve al destino que indica `?from=` o, por defecto, al feed

#### Scenario: El detalle de una compra en cuotas muestra el progreso

- **WHEN** el usuario abre el detalle de una compra en cuotas (madre o hija)
- **THEN** ve el tile de progreso de cuotas (barra pagadas/restantes + próxima/fin) y el detalle por cuota
- **AND** los datos salen de `getInstallmentFamily` (extraído a `@grana/transactions`)

#### Scenario: El detalle de un gasto con reintegro muestra el neto y el gasto vinculado

- **WHEN** el usuario abre el detalle de un gasto con un reintegro vinculado
- **THEN** ve el tile reintegro-neto (pagaste + reintegro = costo neto) y el movimiento vinculado
- **AND** tocar el gasto/reintegro vinculado navega a su propio detalle

#### Scenario: El detalle de un gasto compartido muestra el reparto

- **WHEN** el usuario abre el detalle de un gasto compartido de un hogar de dos miembros
- **THEN** ve el tile de reparto ("Te toca pagar" + "Dividido entre" con la parte de cada uno)
- **AND** el detalle es legible aunque el movimiento lo haya pagado el otro miembro

#### Scenario: Los tiles de contexto diferidos no rompen la pantalla

- **WHEN** el usuario abre el detalle de un movimiento generado por una recurrencia (o de un pago de resumen)
- **THEN** la pantalla renderiza el hero y los tiles core sin el tile de recurrencia / composición / peso-en-el-mes
- **AND** no muestra un estado de error por los tiles diferidos

#### Scenario: El topbar del detalle está visible desde el primer paint

- **WHEN** la pantalla `/transactions/[txId]` hace cold-load y aún resuelve el read del detalle
- **THEN** el `PageHeader` (back + título) ya está presente
- **AND** la carga no se cubre con un skeleton que tape el topbar

#### Scenario: El detalle ofrece editar y borrar sólo al dueño

- **WHEN** el usuario abre el detalle de un movimiento propio, cash/bank y no pagado
- **THEN** ve las acciones **Editar** y **Borrar** en el topbar
- **AND** un movimiento compartido pagado por el otro miembro (o un consumo pagado, o una cuota hija) NO ofrece esas acciones

### Requirement: La app nativa expone la edición y el borrado de un movimiento

La app nativa SHALL permitir **editar** y **borrar** un movimiento desde el detalle, reusando la capa compartida: la edición SHALL usar `useMovementForm` en modo edición (`edit: MovementEditContext`) con el mismo `submitEdit()` y los mismos `update*` mutators ya bindeados en mobile; el borrado SHALL usar un thin `deleteTransaction(supabase, userId, id)` compartido en `@grana/transactions-mutations`, consumido por **web y mobile** (una sola implementación de los guards). **Cero i18n nuevo**: las acciones y los warnings de borrado ya viven en `@grana/i18n-messages`.

**Edición.** La app SHALL exponer una pantalla `/transactions/[txId]/edit` que arma el `MovementEditContext` vía un mirror mobile de `buildMovementEditContext` (mismos reads del detalle + `getEditableFields` puro/compartido) y renderiza el `MovementForm` en modo edición. En modo edición el form SHALL: ocultar el selector de tipo (el tipo es inmutable); mostrar **filas de contexto read-only** (tipo · moneda · cuenta(s)) con caption de "no editable"; y **gatear cada campo** por `editableFields` — monto/fecha editables sólo cuando lo permite el estado (un consumo `paid` bloquea monto y fecha; una compra en cuotas madre bloquea el monto si alguna cuota está pagada; una cuota hija es totalmente inmutable), categoría/descripción según el tipo, la cuenta de débito editable **sólo** en un pago de resumen (`editable.account`), y el reintegro editable sólo si está **pendiente** (uno recibido/cancelado se muestra read-only). El submit SHALL rutear al `updateX` correspondiente (o `updateInstallmentParent` para la madre) y, si aplica, a `saveExpenseReimbursement`.

**Permisos.** El edit-context SHALL devolver `null` cuando el movimiento no es editable por este form — ajeno (`transaction.user_id !== user.id`), reintegro/liquidación, o padre sin cuenta resoluble — y la pantalla de edición SHALL responder con su estado de "no encontrado". El detalle SHALL ocultar la acción Editar en esos casos (ver `canEdit` en el requirement del detalle).

**Borrado.** La acción Borrar del detalle SHALL confirmar de forma **destructiva** con un `Alert.alert` nativo (el patrón de confirmación destructiva ya usado en la app), mostrando el warning **por tipo** (`delete_warning_default` / `delete_warning_parent` / `delete_warning_card_payment`) y el CTA `delete_confirm`. Al confirmar SHALL invocar el thin `deleteTransaction`; los **guards** (cuota hija → borrar desde la madre; consumo `paid`; leg de `settlement`; guard temporal `GRN01` de gasto ya liquidado) SHALL vivir en el mutator compartido y devolverse como `errorCode` para que la plataforma localice el mensaje. Al éxito SHALL invalidar el cache de movimientos y volver al feed.

El borrado y la edición SHALL usar el mismo anon-key/RLS path que web (las mutations filtran por `user_id`); sin cambios de datos, API ni RLS más allá de mover los guards del borrado a la capa compartida.

#### Scenario: Editar un gasto simple

- **WHEN** el dueño abre el detalle de un gasto propio cash/bank no pagado y toca Editar
- **THEN** llega a `/transactions/[txId]/edit` con el form en modo edición, el tipo/moneda/cuenta como contexto read-only y los campos monto/categoría/fecha/descripción editables
- **AND** al guardar, el `updateTransaction` persiste los cambios, se invalida el cache y vuelve al detalle

#### Scenario: Los campos bloqueados no se editan

- **WHEN** el usuario edita un consumo de tarjeta ya pagado, o una cuota hija de una compra en cuotas
- **THEN** el consumo pagado muestra monto y fecha como contexto read-only (sólo categoría/descripción editables)
- **AND** la cuota hija no ofrece edición (la afordancia vive en la madre)

#### Scenario: Editar el reintegro de un gasto

- **WHEN** el dueño edita un gasto con un reintegro **pendiente**
- **THEN** la sección de reintegro es editable (puede cambiar el monto, agregarlo o quitarlo) y el submit llama a `saveExpenseReimbursement`
- **AND** si el reintegro ya está recibido/cancelado, se muestra read-only y no se toca

#### Scenario: Un movimiento ajeno no se edita ni se borra

- **WHEN** un miembro del hogar abre el detalle de un gasto compartido que pagó el **otro** miembro
- **THEN** ve el detalle completo pero sin las acciones Editar/Borrar
- **AND** si fuerza `/transactions/[txId]/edit`, la pantalla responde con "no encontrado" (el edit-context es `null`)

#### Scenario: Borrar un movimiento confirma y respeta los guards

- **WHEN** el dueño toca Borrar en un gasto propio no pagado
- **THEN** un `Alert.alert` destructivo muestra el warning por tipo y pide confirmación
- **AND** al confirmar, el thin `deleteTransaction` borra el movimiento, se invalida el cache y vuelve al feed
- **AND** si el movimiento es una cuota hija, un consumo pagado o un leg de liquidación, el mutator devuelve el `errorCode` y la pantalla muestra el mensaje correspondiente sin borrar

#### Scenario: Web y mobile comparten los guards del borrado

- **WHEN** se borra un movimiento desde web o desde mobile
- **THEN** ambos pasan por el thin `deleteTransaction` de `@grana/transactions-mutations` (mismos guards)
- **AND** la action web conserva su `revalidateAfterMovementMutation()` y no cambia de comportamiento (tests web verdes)

### Requirement: El grafo de recurrencias es isomórfico en `@grana/recurrences`

Los reads, el generador de instancias, la detección de sugerencias y las mutations de recurrencias SHALL vivir en el package `@grana/recurrences` sobre `GranaSupabaseClient`, consumidos por **web y mobile** (una sola implementación). El package SHALL exponer: los reads (`getRecurrences`, `getRecurrenceDetail`, `getPendingRecurrenceInstances`, `getTopRecurrenceSuggestion`, `getRecurrenceLinkForTransaction`, y los auxiliares de listado/conteo), el **generador perezoso** `generateDueRecurrenceInstances`, la **detección** `detectRecurrenceSuggestions`, y las **mutations** de ciclo de vida e instancias (`createRecurrence`, `confirmRecurrenceInstance`, `skipRecurrenceInstance`, `updateRecurrence`, `pauseRecurrence`, `resumeRecurrence`, `deleteRecurrence`, `acceptRecurrenceSuggestion`, `dismissRecurrenceSuggestion`) más los tipos del dominio.

Las funciones SHALL tomar `(supabase, userId, …)` y devolver data o un resultado `{ ok, … }`, **sin auth ni revalidación** (que quedan en el shell de cada plataforma). `confirmRecurrenceInstance` SHALL delegar en los thin creates de `@grana/transactions-mutations` al materializar una instancia; la matemática de fechas SHALL seguir en `@grana/money-logic`. `createRecurrenceFromMovement` SHALL permanecer en `@grana/transactions-mutations` (no se duplica su owner).

**Web SHALL re-apuntar** sus reads (`apps/web/lib/recurrences/queries.ts`) y server actions (`apps/web/app/_actions/recurrences.ts`) al package como wrappers thin, conservando su validación, auth y `revalidatePath`/invalidación. La extracción SHALL preservar comportamiento: la suite de tests web SHALL seguir verde sin tests de negocio nuevos.

#### Scenario: Web y mobile comparten el grafo de recurrencias

- **WHEN** se lee o muta una recurrencia desde web o desde mobile
- **THEN** ambos pasan por las funciones de `@grana/recurrences` (una sola implementación de los reads, el generador y las mutations)
- **AND** las server actions web conservan su auth + `revalidatePath` y no cambian de comportamiento (tests web verdes)

#### Scenario: Confirmar una instancia reusa los thin creates compartidos

- **WHEN** se confirma una instancia recurrente (desde web o mobile)
- **THEN** `confirmRecurrenceInstance` mapea la instancia a un plan de movimiento y delega en los thin creates de `@grana/transactions-mutations`
- **AND** la instancia queda `confirmed` con su `confirmed_transaction_id` y la regla avanza su `last_generated_date`

### Requirement: La app nativa expone el hub de recurrencias `/transactions/recurring`

La app nativa SHALL exponer una pantalla hub `/transactions/recurring` como thin consumer de `@grana/recurrences`. La pantalla SHALL listar las reglas del usuario agrupadas por **tabs de estado** (Activas / Pausadas / Finalizadas) con cards read-only que muestran el monto, la próxima fecha, la frecuencia, un badge de estado y un badge de **compartida** cuando la regla pertenece a un hogar. Cada tab SHALL mostrar su **estado vacío** propio cuando no hay reglas en ese estado.

El hub SHALL **materializar instancias vencidas de forma perezosa**: al enfocar la pantalla SHALL disparar `generateDueRecurrenceInstances` una sola vez por foco, fire-and-forget, e invalidar las queries del hub/pendientes cuando se generó al menos una instancia. El read path NO SHALL bloquearse esperando la generación (si falla, la instancia aparece en la próxima visita). El generador SHALL ser idempotente (un pending por regla), de modo que dobles disparos no dupliquen.

El chrome (`PageHeader` con back al feed) SHALL estar visible desde el primer paint; la carga SHALL usar un skeleton que NO tape el chrome. El hub SHALL ser accesible desde una afordancia "Recurrencias" en el header del feed de Movimientos (es una pantalla pushed, no una tab — las tabs nativas están fijas). El header del hub SHALL ofrecer además una afordancia **"+"** para **crear una regla desde cero** → `/transactions/recurring/new`.

#### Scenario: El hub lista las reglas por estado

- **WHEN** el usuario abre `/transactions/recurring`
- **THEN** ve las tabs Activas / Pausadas / Finalizadas y, en la activa, las cards de sus reglas con monto, próxima fecha, frecuencia y badge de estado
- **AND** una regla compartida muestra además su badge de compartida
- **AND** una tab sin reglas muestra su estado vacío

#### Scenario: El hub materializa instancias vencidas al enfocar

- **WHEN** el usuario enfoca el hub y hay reglas activas con instancias vencidas sin generar
- **THEN** se dispara la generación perezosa una vez y, si se creó alguna instancia, la lista de pendientes se refresca sin recarga manual
- **AND** si la generación falla, el hub igual renderiza las reglas desde el read (no bloquea)

#### Scenario: El hub ofrece crear una regla

- **WHEN** el usuario toca la afordancia "+" del header del hub
- **THEN** navega a `/transactions/recurring/new` para crear una regla desde cero

### Requirement: La app nativa expone el detalle de una regla recurrente con pausar/reanudar/eliminar

La app nativa SHALL exponer una pantalla de detalle `/transactions/recurring/[id]` con el mismo lenguaje de interacción que el detalle de movimiento: una **vista read-only** del resumen de la regla y las acciones en el header como icon-buttons directos. La vista SHALL mostrar el monto como protagonista junto al tipo y, en filas de metadatos, la frecuencia, la cuenta (o cuenta → destino en transferencias), la categoría cuando aplique, la próxima fecha y la fecha de fin cuando exista. La lista de instancias generadas (pending/confirmed/skipped) SHALL mantenerse debajo del resumen.

Las acciones del header SHALL ser **Editar** (abre el form de edición en un `Drawer`; ver el requirement de edición), **Pausar/Reactivar** (un único control que togglea según el estado de la regla, vía `pauseRecurrence`/`resumeRecurrence`) y **Eliminar** (`deleteRecurrence`). Eliminar SHALL confirmar de forma **destructiva** con un `Alert.alert` nativo (el patrón de confirmación destructiva ya usado en la app) antes de ejecutar; al éxito SHALL invalidar el cache y volver al hub. El borrado SHALL ser soft-delete (preserva las instancias confirmadas, elimina las pendientes). El chrome SHALL estar visible desde el primer paint.

#### Scenario: El detalle de una regla muestra el resumen y el historial

- **WHEN** el usuario abre el detalle de una regla desde el hub
- **THEN** ve la vista read-only (monto, frecuencia, cuenta, categoría, próxima fecha, fin) y, debajo, la lista de sus instancias generadas
- **AND** el chrome (back + acciones) está presente desde el primer paint

#### Scenario: Pausar, reactivar y eliminar una regla

- **WHEN** el usuario toca Pausar en una regla activa
- **THEN** la regla pasa a pausada y el control ahora ofrece Reactivar (y viceversa)
- **AND** al tocar Eliminar, un `Alert.alert` destructivo pide confirmación; al confirmar, la regla se elimina (soft-delete), se invalida el cache y vuelve al hub

#### Scenario: El detalle ofrece editar la regla

- **WHEN** el usuario toca Editar en el header del detalle
- **THEN** se abre el form de edición (monto/frecuencia/fin/descripción) en un `Drawer`; al guardar, el detalle se invalida y el resumen refleja los cambios

### Requirement: La app nativa muestra los pendientes recurrentes y la sugerencia en el feed

El feed de Movimientos nativo SHALL mostrar un **bloque de instancias recurrentes pendientes**, separado del historial, como thin consumer de `@grana/recurrences`. Por cada instancia pendiente el bloque SHALL ofrecer **Confirmar** y **Omitir**. Confirmar SHALL invocar `confirmRecurrenceInstance` (materializa el movimiento real vía los thin creates compartidos), invalidando el feed y el hub; Omitir SHALL invocar `skipRecurrenceInstance`. En esta slice, confirmar SHALL usar el **snapshot** de la instancia (sin edición inline de monto/fecha/descripción). Las instancias **compartidas** SHALL mostrarse con su badge y, al confirmarse, crear el gasto compartido con su split (paridad con `shared-recurrences`). El **warning de saldo negativo** al confirmar queda **diferido** (nicety read-only que requiere el read de saldos por cuenta); su ausencia no bloquea el confirmar.

El feed SHALL mostrar además un **banner de sugerencia de recurrencia** cuando `getTopRecurrenceSuggestion` detecta un patrón repetido, con **Aceptar** (crea la regla vía `acceptRecurrenceSuggestion`) y **Descartar** (`dismissRecurrenceSuggestion`, idempotente por fingerprint). El bloque de pendientes y el banner SHALL ofrecer un deep-link al hub / a la regla.

#### Scenario: Confirmar una instancia pendiente desde el feed

- **WHEN** el usuario toca Confirmar en una instancia recurrente pendiente
- **THEN** se crea el movimiento real (vía `confirmRecurrenceInstance`), la instancia queda confirmada, y el feed + el hub se invalidan
- **AND** confirmar usa el snapshot de la instancia (sin edición inline en esta slice)

#### Scenario: Omitir una instancia pendiente

- **WHEN** el usuario toca Omitir en una instancia pendiente
- **THEN** la instancia queda `skipped` (sin crear movimiento) y la regla avanza su cursor para no re-proponer esa fecha

#### Scenario: Aceptar o descartar una sugerencia

- **WHEN** el feed muestra un banner de sugerencia de recurrencia
- **THEN** Aceptar crea la regla (`acceptRecurrenceSuggestion`) y ofrece ir a ella; Descartar la oculta de forma idempotente (`dismissRecurrenceSuggestion`)

#### Scenario: Una instancia compartida se confirma como gasto compartido

- **WHEN** el usuario confirma una instancia recurrente **compartida** (con hogar + split)
- **THEN** se crea un gasto compartido con el split heredado de la regla
- **AND** la instancia se muestra con su badge de compartida en el bloque de pendientes

### Requirement: La app nativa crea una regla recurrente desde cero

La app nativa SHALL exponer una pantalla `/transactions/recurring/new` con un form **dedicado** (`RecurrenceForm`) que compone los primitivos de UI existentes (`Segmented`, `SelectField`/`SelectSheet`, `MoneyAmountInput`, `Switch`, `DateField`, `Input`, `AccountAvatar`) — NO SHALL reusar `MovementForm` (evita acoplar la creación de regla al hot path del alta de movimiento). El form SHALL cubrir tipo (ingreso/gasto/transferencia — sin ajuste/cambio/cuotas), cuenta (con la misma elegibilidad por tipo del alta: sólo el gasto admite tarjeta de crédito), moneda, monto, categoría+subcategoría (ingreso/gasto) o cuenta destino (transferencia, ≠ origen), descripción, **fecha de inicio** (default hoy), **frecuencia** (preset o `custom` con intervalo), **fecha de fin** opcional, **máximo de ocurrencias** opcional, y **compartir** (template de split; sólo gasto + hogar de dos miembros).

Al guardar, el form SHALL validar client-side los casos comunes (monto > 0; categoría requerida en ingreso/gasto; destino requerido y distinto del origen en transferencia; fin ≥ inicio) y luego invocar `createRecurrence` de `@grana/recurrences` (vía el mutator mobile, que resuelve auth y pasa el hogar). `createRecurrence` SHALL crear **sólo la regla** — sin movimiento hoy; la primera ocurrencia vencida se materializa como instancia **pendiente** (visible en el bloque de pendientes del feed y en el hub). Al éxito SHALL invalidar el cache de recurrencias y volver al hub. El chrome (`PageHeader` + back) SHALL estar visible desde el primer paint; el cuerpo del form SHALL esperar a que carguen sus inputs (cuentas, categorías, hogar).

El hub `/transactions/recurring` SHALL ofrecer la entrada a esta pantalla mediante una afordancia "+" en su header.

#### Scenario: Crear una regla desde el hub

- **WHEN** el usuario toca "+" en el hub y completa el form (tipo, cuenta, monto, categoría o destino, frecuencia, fecha de inicio)
- **THEN** al guardar se crea la regla vía `createRecurrence` (sin crear un movimiento hoy), se invalida el cache y vuelve al hub, donde la regla aparece en su tab de estado
- **AND** si la fecha de inicio es hoy/pasada, la primera instancia se materializa como **pendiente** y aparece en el bloque de pendientes del feed

#### Scenario: Frecuencia custom y fecha de fin

- **WHEN** el usuario elige frecuencia `custom` e ingresa intervalo (cantidad + unidad), o activa la fecha de fin
- **THEN** el payload incluye `interval_count`/`interval_unit` (sólo en custom) y `end_date` (sólo si se activó), y `createRecurrence` los persiste
- **AND** una fecha de fin anterior a la de inicio se rechaza client-side antes de enviar

#### Scenario: Regla compartida

- **WHEN** el usuario crea un **gasto** recurrente con un hogar de dos miembros y activa "compartir" con un split
- **THEN** el payload incluye el `shared` template (household_id + splits) que semillará el split de cada instancia generada
- **AND** en ingreso o transferencia la opción de compartir no se ofrece

### Requirement: La app nativa edita los campos mutables de una regla recurrente

La app nativa SHALL permitir editar una regla existente desde el detalle `/transactions/recurring/[id]` mediante un form (`RecurrenceEditForm`) montado en un `Drawer` (bottom sheet) que se abre con una afordancia **Editar** en el header del detalle. El form SHALL editar únicamente el **subconjunto mutable**: monto, frecuencia (sólo presets — weekly/biweekly/monthly/annual, sin `custom`), fecha de fin (opcional) y descripción. Cuenta, categoría y tipo de movimiento SHALL ser **inmutables** (fijados en la creación; la instancia es un snapshot de la regla) y NO SHALL aparecer en el form — paridad con el drawer de edición web.

Al guardar, el form SHALL validar el monto (> 0) y luego invocar `updateRecurrence` de `@grana/recurrences` (vía el mutator mobile). Al éxito SHALL invalidar el detalle (`['recurrences','detail',id]`) y el hub, y cerrar el sheet; el resumen read-only SHALL reflejar los valores nuevos.

#### Scenario: Editar el monto y la frecuencia de una regla

- **WHEN** el usuario toca Editar en el detalle, cambia el monto y/o la frecuencia y guarda
- **THEN** se invoca `updateRecurrence` con el patch, se invalida el detalle y el hub, el sheet se cierra y el resumen muestra los valores nuevos

#### Scenario: El form de edición no expone cuenta, categoría ni tipo

- **WHEN** el usuario abre el form de edición de una regla
- **THEN** ve monto, frecuencia, fecha de fin y descripción, pero NO controles para cambiar la cuenta, la categoría o el tipo de movimiento
- **AND** la frecuencia ofrece sólo los presets (sin `custom`)

### Requirement: La app nativa muestra los reintegros pendientes accionables en el feed

La pestaña **Movimientos** de la app mobile SHALL renderizar un bloque
**"Reintegros a confirmar"** arriba del listado, hermano nativo del bloque de
pendientes recurrentes, como thin consumer del read compartido
`getPendingReimbursements(supabase)` de `@grana/transactions` (sin scope de
cuenta = global).

El bloque SHALL renderizar **nada** cuando no hay reintegros pendientes **y el
usuario no actuó sobre ninguno en esta sesión**. Entrar sin pendientes no ocupa
espacio ni muestra un empty-state en el feed (mismo comportamiento que
`PendingRecurrencesBlock`, que la card read-only de la cuenta y que el bloque
web). **Quedar** sin pendientes por haber confirmado o cancelado es un caso
distinto y SHALL resolverse como dice "Feedback después de actuar", más abajo.

**Presentación.** El bloque SHALL componer el `Card` del design system nativo y
SHALL exponer un header accionable con badge slate + ícono `Undo2`, título
(`…pending.title`), subtítulo (`…pending.subtitle`), pill con el conteo de
pendientes (`…pending.count`, oculta cuando la lista está vacía) y un chevron
que indica el estado. El acento SHALL ser **slate** (informacional), distinto
del dorado del bloque de recurrencias, y SHALL expresarse con los tokens de
`@grana/ui-tokens` (`slate`, `slate-soft`) — NO SHALL copiarse el hex literal
que la implementación web escribe inline. El halo de 4px de web SHALL traducirse
a un anillo de layout alrededor de la card, porque las sombras de RN no tienen
`spread`; ese anillo SHALL ser lo que carga el acento, sin pisar desde
`className` el borde ni el radio propios del primitivo `Card`.

El header SHALL colapsar y expandir el cuerpo del bloque. El estado inicial
SHALL derivarse de la cantidad de pendientes —**abierto** con uno o ninguno,
**colapsado** con dos o más, paridad con web— y, una vez que el usuario toca el
header, su elección SHALL mandar. Como en nativo la lista llega por `useQuery` y
no por prop, ese default SHALL derivarse del estado de los datos en cada render
mientras no haya elección del usuario; NO SHALL sincronizarse con un efecto, que
pisaría la elección del usuario en cada refetch.

Cada fila del bloque SHALL permitir **confirmar** o **cancelar** el reintegro,
delegando en los mutators nativos `confirmReimbursement` / `cancelReimbursement`
(`apps/mobile/lib/transactions/mutators.ts`), que son thin shells sobre las
impls isomórficas de `@grana/transactions-mutations` (auth + delegación +
localización del `formError`). La invalidación de cache SHALL correr en el
handler de éxito del bloque vía `invalidateAfterReimbursementMutation`, nunca
dentro del mutator.

Cada fila SHALL mostrar el **chip de ícono + tinte de la categoría** derivada
(`categoryIcon` / `categoryColor` de `PendingReimbursementVM`), con el fondo
teñido con el color de la categoría. Sin ícono derivado la fila NO SHALL dibujar
un chip vacío.

**Confirmar** SHALL ser una reconciliación de **monto + fecha únicamente**. La
fila SHALL exponer los dos controles —un `MoneyAmountInput` con default = monto
estimado y un `DateField` con default = fecha del gasto (o hoy)— **visibles
desde el primer paint**, sin sheet y sin paso de expand, paridad con web. El
botón primario SHALL commitear `{ id, amount, date }` en su **primer** press:
NO SHALL gastar un press en revelar los controles.

Los controles NO SHALL esconderse detrás del botón de confirmar. Un reintegro
pendiente es una expectativa, y confirmarlo es el momento de declarar cuánto
llegó realmente; dejar la corrección un press detrás del botón que aparenta
aceptar el estimado esconde justamente el dato que la fila existe para capturar.

El commit NO SHALL ofrecer selector de cuenta ni de período: para el subtipo
`account` la cuenta declarada queda intacta, y para `statement` el período se
deriva del lado del servidor a partir de la fecha (rechazando un período ya
pagado).

**Cancelar** SHALL pedir una confirmación destructiva (`Alert.alert`) antes de
setear `cancelled_at`. La fila SHALL mostrar estado de carga por fila y error
inline localizado.

**Feedback después de actuar.** Confirmar o cancelar con éxito SHALL dejar un
**aviso de éxito persistente y descartable** dentro del bloque
(`…pending.confirmed_success` / `…pending.cancelled_success`, con acción de
cierre etiquetada `…pending.close_notice`). El aviso NO SHALL autodescartarse
por temporizador: es lo único que explica por qué la lista se vació, así que no
puede irse antes de que el usuario lo mire.

Mientras ese aviso esté vivo el bloque SHALL seguir montado aunque la lista
quede vacía, y en ese caso el cuerpo SHALL mostrar la fila "todo al día"
(`…pending.all_clear`). Vaciar la lista actuando NO SHALL desmontar el bloque en
silencio. El aviso SHALL ser la condición de montaje del caso vacío —un único
estado, no dos que puedan desincronizarse—, de modo que cerrarlo con la lista ya
vacía SHALL desmontar el bloque.

Los copies SHALL leerse del catálogo compartido `@grana/i18n-messages`
(`transactions.reimbursement.pending.*`, `reimbursement.confirm` / `.cancel`).

#### Scenario: El feed muestra el bloque de reintegros pendientes

- **WHEN** el usuario abre la pestaña Movimientos y tiene al menos un reintegro
  pendiente (`type='reimbursement'`, `received_at IS NULL`, `cancelled_at IS NULL`)
- **THEN** ve el bloque "Reintegros a confirmar" arriba del listado, resuelto vía
  `getPendingReimbursements(supabase)` de `@grana/transactions`
- **AND** cada fila muestra la descripción/categoría derivada y el monto esperado
- **AND** cada fila con categoría derivada muestra el chip con su ícono y su tinte

#### Scenario: El bloque se presenta como card con header colapsable

- **WHEN** el usuario ve el bloque en el feed
- **THEN** el bloque es una card del design system con header de badge slate +
  `Undo2`, título, subtítulo, pill de count y chevron
- **AND** tocar el header colapsa o expande el cuerpo
- **AND** con un solo pendiente el bloque abre expandido, y con dos o más abre
  colapsado, hasta que el usuario elige lo contrario

#### Scenario: La fila expone monto y fecha desde el primer paint

- **WHEN** el usuario abre el bloque y mira una fila pendiente
- **THEN** ve el input de monto (default = estimado) y el selector de fecha
  (default = fecha del gasto o hoy) ya visibles, sin haber tocado nada
- **AND** puede corregir el monto antes de tocar "Confirmar"

#### Scenario: Confirmar commitea en un solo press

- **WHEN** el usuario toca "Confirmar" en una fila
- **THEN** el press commitea: envía `{ id, amount, date }` al mutator, que setea
  `received_at`, sobrescribe `amount` y `date`, y NO altera `estimated_amount`
- **AND** el bloque invalida cache vía `invalidateAfterReimbursementMutation`
- **AND** NO hace falta un segundo press: el primero no se gasta en revelar los
  controles

#### Scenario: Confirmar un reintegro en resumen deriva el período del lado del servidor

- **WHEN** el usuario confirma un reintegro con subtipo `statement` eligiendo una
  fecha
- **THEN** el mutator resuelve el período de la tarjeta que cubre esa fecha vía
  `getOrCreatePeriodForDate` y lo imputa, sin ofrecer un selector de período
- **AND** si ese período ya fue pagado, la confirmación falla con un error
  localizado y no modifica el reintegro

#### Scenario: Cancelar un reintegro pendiente pide confirmación destructiva

- **WHEN** el usuario toca "Cancelar" en una fila y confirma el diálogo destructivo
- **THEN** el mutator setea `cancelled_at`, el reintegro desaparece del bloque y
  el bloque invalida cache
- **AND** el bloque muestra el aviso de cancelación
- **AND** si el reintegro ya estaba recibido, la operación falla con un error
  localizado

#### Scenario: Actuar deja un aviso de éxito descartable

- **WHEN** el usuario confirma o cancela un reintegro con éxito y todavía quedan
  otros pendientes
- **THEN** el bloque muestra un aviso con la copy de la acción y un control de
  cierre
- **AND** el aviso sigue visible hasta que el usuario lo cierra o vuelve a actuar

#### Scenario: Vaciar la lista actuando muestra "todo al día"

- **WHEN** el usuario confirma (o cancela) el último reintegro pendiente
- **THEN** el bloque NO se desmonta: sigue en pantalla con su header y su aviso
  de éxito
- **AND** el cuerpo muestra la fila "todo al día" en vez de la lista
- **AND** cerrar el aviso desmonta el bloque

#### Scenario: Sin reintegros pendientes el bloque no se renderiza

- **WHEN** el usuario abre la pestaña Movimientos sin reintegros pendientes y sin
  haber actuado sobre ninguno en esta sesión
- **THEN** el bloque "Reintegros a confirmar" no se renderiza (no ocupa espacio ni
  muestra un empty-state en el feed)

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

---

### Requirement: El selector de categoría no obliga a elegir subcategoría

En modo create, elegir una categoría SHALL ser suficiente para guardar un movimiento de `gasto` o `ingreso`: la subcategoría es un refinamiento opcional. El selector completo SHALL asignar la categoría con un solo gesto sobre su nombre, aun cuando la categoría tenga subcategorías, dejando el segundo nivel accesible como refinamiento explícito (no como un paso obligatorio).

#### Scenario: Elegir una categoría con subcategorías sin entrar al segundo nivel

- **WHEN** el usuario abre el selector de categoría y toca una categoría que tiene subcategorías
- **THEN** esa categoría queda asignada a secas
- **AND** el movimiento puede guardarse sin elegir subcategoría

#### Scenario: El segundo nivel sigue disponible como refinamiento

- **WHEN** el usuario quiere clasificar con una subcategoría
- **THEN** puede abrir el segundo nivel de esa categoría explícitamente y elegir una subcategoría

---

### Requirement: El monto queda enfocado al abrir el alta

Al abrir el formulario de alta, el campo de monto SHALL quedar enfocado y listo para tipear sin un gesto adicional.

#### Scenario: El monto no requiere un tap para enfocarse

- **WHEN** el usuario abre el formulario de alta
- **THEN** el campo de monto queda enfocado y listo para tipear sin un gesto adicional

---

### Requirement: La descripción es opcional

La descripción de un movimiento SHALL seguir siendo opcional: nunca bloquea el guardado ni es requisito para clasificar.

#### Scenario: Guardar sin descripción

- **WHEN** el usuario registra un gasto con monto y categoría pero sin descripción
- **THEN** el movimiento se guarda correctamente

---

### Requirement: El selector de tipo ofrece dos primarias y "Otros"

Este requirement gobierna el **alta**. En **edición** no hay selector de tipo en ninguna superficie (ver el requirement del formulario único y el del drawer en modo edición): el tipo es inmutable, así que se enuncia como fila de contexto read-only y no como control.

El formulario de alta SHALL presentar `gasto` e `ingreso` como las únicas opciones primarias fijas. Los demás tipos —`transferencia`, `ajuste` y `cambio de moneda`— SHALL quedar tras una affordance explícita ("Otros") que los ofrece gateados por su elegibilidad (`transferencia` requiere dos o más cuentas propias; `cambio de moneda` requiere capacidad bimoneda; `ajuste` está siempre disponible). La affordance "Otros" SHALL mostrarse siempre que exista al menos un tipo secundario elegible. La partición es fija y no altera ninguna regla contable ni la disponibilidad de los tipos.

#### Scenario: Solo gasto e ingreso son primarios

- **WHEN** el usuario abre el formulario de alta en modo create
- **THEN** el selector de tipo muestra `gasto` e `ingreso` como opciones primarias
- **AND** ni `transferencia`, ni `ajuste`, ni `cambio de moneda` ocupan un lugar primario

#### Scenario: Los tipos secundarios están en "Otros"

- **WHEN** el usuario activa la affordance "Otros"
- **THEN** puede elegir `transferencia` (si tiene dos o más cuentas), `ajuste` o `cambio de moneda` (si tiene capacidad bimoneda)
- **AND** el flujo de ese tipo funciona igual que antes de este cambio

#### Scenario: En edición no hay selector de tipo

- **WHEN** el formulario se abre en modo edición de un movimiento existente, en cualquier superficie (web escritorio, web en viewport angosto o app nativa)
- **THEN** el formulario NO dibuja el selector de tipo — ni la partición primario/"Otros", ni el selector completo en estado deshabilitado
- **AND** el tipo del movimiento se enuncia como fila de contexto read-only, junto a la moneda y la(s) cuenta(s), con el mismo caption de "no editable"

---

### Requirement: El formulario oculta la dimensión cuenta cuando hay una sola cuenta elegible para el tipo activo

El formulario de alta SHALL omitir el selector de cuenta cuando el usuario tiene exactamente una cuenta elegible para el tipo de movimiento activo, usando esa cuenta de forma implícita. Con dos o más cuentas elegibles, el selector SHALL mostrarse. La elegibilidad depende del tipo (solo `gasto` puede apuntar a una cuenta de crédito), de modo que el resultado puede variar por tipo y se recalcula por render.

> **Follow-up (fuera de esta pasada de superficie):** el refinamiento por *moneda* —ocultar también cuando hay una sola cuenta elegible para la moneda activa, p. ej. una `Billetera` en ARS y una cuenta solo en USD, dejando que el toggle de moneda desambigüe— queda diferido: hoy el toggle de moneda es por cuenta (`currencyOptions` = monedas de la cuenta seleccionada), así que hacerlo bien requiere que el toggle maneje la selección de cuenta, un cambio en la cascada de moneda. Está anotado en `use-movement-form.ts`.

#### Scenario: Una sola cuenta elegible oculta el selector

- **WHEN** el usuario tiene una sola cuenta elegible para el tipo activo
- **THEN** el formulario no muestra el selector de cuenta
- **AND** el movimiento se registra en esa cuenta implícita

#### Scenario: Dos o más cuentas elegibles muestran el selector

- **WHEN** el usuario tiene dos o más cuentas elegibles para el tipo activo
- **THEN** el formulario muestra el selector de cuenta
- **AND** el usuario elige entre ellas

---

### Requirement: El gasto simple no atraviesa ninguna sección avanzada

Las secciones avanzadas del alta —reintegro, gasto compartido, repetir (recurrencia) y cuotas— SHALL arrancar sin activar y SHALL NOT ser obligatorias para registrar un gasto simple. El camino mínimo de un gasto simple es: monto, categoría, cuenta (si el selector aplica), fecha y guardar.

#### Scenario: Registrar un gasto simple sin abrir secciones avanzadas

- **WHEN** el usuario completa monto, categoría y fecha en una cuenta cash/bank y confirma, sin tocar reintegro, compartido, repetir ni cuotas
- **THEN** el gasto se registra correctamente
- **AND** no se creó ningún reintegro, split de gasto compartido ni regla recurrente

#### Scenario: Las funcionalidades avanzadas están sin activar al abrir

- **WHEN** el usuario abre el formulario de alta en el tipo `gasto`
- **THEN** reintegro, compartido y repetir se ofrecen como chips de activación sin activar (sin sus parámetros)
- **AND** las cuotas no aparecen salvo que la cuenta sea de crédito

---

### Requirement: El despliegue de las secciones avanzadas es de superficie mínima y paritario entre las superficies mobile

Al activarse, cada sección avanzada del alta —Reintegro, Compartido (split) y Repetir (recurrencia)— SHALL revelar sus parámetros con **superficie mínima** y con la **misma estructura y controles equivalentes** en la superficie **mobile-web** (gateada por breakpoint) y en la **app nativa**, de modo que ambas se lean como el mismo producto. Esta paridad es de **presentación**: no altera ningún campo, tipo de movimiento, regla contable ni el contrato del hook compartido (`splitFirstPct`, `reimbursementReceivedNow`, `reimbursementPercent`/`Cap`, `intervalUnit` ya existen). La paridad se evalúa por **rol y estructura** de los controles, no por igualdad de píxeles ni por el widget exacto de cada plataforma. La superficie **desktop** de web NO SHALL verse afectada.

**Reintegro.** El bloque revelado SHALL presentarse como **dos filas compactas** (diseño cerrado con el PO, ref. visual en `docs/design/movement-form/reintegro/`), logrando la superficie mínima por **densidad** —sin labels sobre los campos— en vez de esconder controles:

- **Fila 1 — monto y regla de cálculo.** El **monto del reintegro** (editable a mano) junto a la **regla `% + tope` visible inline** (no detrás de un disparador). El porcentaje deriva el monto vía `applyReimbursementPercent` de forma **bidireccional** (cargar un % calcula el monto; escribir un monto a mano descarta el %); el **tope** acota el monto calculado y su texto se resalta cuando efectivamente aplicó.
- **Fila 2 — destino y estado.** El **destino**, *solo con tarjeta de crédito*, SHALL presentarse como un control **`Resumen | Cuenta`**. El valor por defecto lo fija el hook **sin cambio de comportamiento** (hoy `'account'` → "Cuenta"); este rediseño es de presentación y NO SHALL alterar ese default. Tocar **Cuenta** SHALL seleccionar la cuenta de la **misma entidad bancaria del medio de pago** sin abrir ningún selector (prerellenada por institución; comportamiento ya existente que este rediseño preserva); tocar el **nombre** de la cuenta SHALL abrir el selector, con la cuenta de la misma entidad primero (rotulada "mismo banco") y el resto después. Con cash/bank el destino es *a cuenta* sin control de resumen, y el selector de cuenta NO SHALL renderizarse cuando hay una sola cuenta cash/bank elegible. El **estado** SHALL ofrecerse como un control **"Acreditado"** (checkbox compacto, no un input crudo): apagado deja el reintegro **pendiente de confirmación** —sin chip ni texto "Pendiente"—, encendido lo registra como recibido.

Los controles crudos de web-mobile (`<input type=checkbox>`, `<input type=radio>`, `<select>`) SHALL reemplazarse por los equivalentes diseñados, con la **misma estructura** que la app nativa. La paridad se evalúa por rol/estructura, no por el widget exacto.

**Compartido (split).** El control de split SHALL ofrecer **atajos de un gesto** —**Mitad** (`splitFirstPct = 50`), **70/30** (`70`), **75/25** (`75`) (los porcentajes son *tu parte*) y **Todo suyo** (`0`, el gasto es íntegramente del otro)— más un disparador **"Otro"** que revela un editor de **porcentaje libre** (tu parte editable con el teclado del sistema; la del otro se calcula sola, no editable). El atajo **"Todo suyo" SHALL fijar el reparto 0/100** (`{pagador: 0, otro: 100}`), absorbiendo el caso "lo pagué yo pero es 100% del otro": NO SHALL existir un toggle dedicado aparte, ni un atajo "todo mío" (un gasto 100% propio no se marca compartido). El reparto SHALL visualizarse con una **barra proporcional Vos / [otro integrante]** (el nombre lo trae el Hogar), que puede mostrar porcentajes o montos. El editor libre, cuando está revelado, SHALL permitir cualquier reparto válido (0–100 que suman 100). Ambas superficies mobile SHALL usar la **misma familia de claves i18n** para este control.

**Repetir (recurrencia).** En el intervalo personalizado, la **unidad** (día/semana/mes/año) SHALL elegirse con **chips** en ambas superficies mobile (no con un `select` en una y chips en la otra). El resto de la sección (chips de frecuencia, cantidad del intervalo, fecha de fin opcional, hint) ya es paritario y SHALL permanecer así.

Ninguna de estas reglas cambia el comportamiento del gasto simple: las secciones SHALL seguir arrancando desactivadas y sin parámetros (según el requirement «El gasto simple no atraviesa ninguna sección avanzada»).

#### Scenario: El reintegro se despliega como dos filas compactas con el %/tope visible

- **WHEN** el usuario activa "reintegro" en un gasto, en la web-mobile o en la app nativa
- **THEN** el bloque muestra dos filas compactas: la primera con el monto y la regla `% + tope` visible inline, la segunda con el destino y el control "Acreditado"
- **AND** el cálculo por porcentaje/tope está a la vista, no detrás de un disparador

#### Scenario: El porcentaje deriva el monto de forma bidireccional y el tope lo acota

- **WHEN** el usuario, con el reintegro activo, ingresa un porcentaje (y opcionalmente un tope)
- **THEN** el monto del reintegro se deriva de ese porcentaje sobre el gasto, acotado por el tope, y el texto del tope se resalta cuando efectivamente aplicó
- **AND** si el usuario luego escribe un monto a mano, el porcentaje se descarta

#### Scenario: El destino ofrece Resumen y Cuenta, y tocar Cuenta usa la misma entidad del medio de pago

- **WHEN** el usuario activa un reintegro sobre un gasto pagado con tarjeta de crédito
- **THEN** el destino se ofrece como el control "Resumen | Cuenta" (el default lo fija el hook, sin cambio de comportamiento)
- **AND** tocar "Cuenta" selecciona la cuenta de la misma entidad bancaria del medio de pago sin abrir ningún selector, y tocar el nombre de esa cuenta abre el selector con la cuenta de la misma entidad primero

#### Scenario: La cuenta de acreditación se oculta cuando hay una sola cuenta elegible

- **WHEN** el usuario activa un reintegro "a cuenta" (cash/bank, o crédito con destino Cuenta) y tiene una sola cuenta cash/bank elegible
- **THEN** el selector de cuenta de acreditación no se renderiza y el sistema usa esa cuenta (prerellenada por institución)
- **AND** cuando hay más de una cuenta cash/bank elegible, tocar el nombre de la cuenta abre el selector

#### Scenario: El split se resuelve de un tap en el caso común

- **WHEN** el usuario activa "compartir" en un gasto, en la web-mobile o en la app nativa
- **THEN** se ofrecen los atajos Mitad / 70/30 / 75/25 / Todo suyo como opciones de un gesto, y una barra de reparto Vos / [otro integrante]
- **AND** tocar "Mitad" fija el reparto 50/50 sin abrir el editor de porcentaje libre

#### Scenario: "Todo suyo" es el caso 0/100 sin toggle aparte

- **WHEN** el usuario toca el atajo "Todo suyo"
- **THEN** el reparto queda en `{pagador: 0, otro: 100}` (el gasto corresponde íntegramente al otro miembro) y la barra queda entera del lado del otro
- **AND** no se ofrece un toggle dedicado adicional para el caso "es 100% del otro"

#### Scenario: "Otro" revela el reparto arbitrario en ambas superficies

- **WHEN** el usuario toca "Otro" e ingresa `70`
- **THEN** el reparto queda 70/30 entre el pagador y el otro miembro
- **AND** este reparto arbitrario está disponible tanto en la web-mobile como en la app nativa

#### Scenario: La unidad del intervalo personalizado se elige con chips en ambas superficies

- **WHEN** el usuario activa "repetir", elige frecuencia "personalizado" y va a elegir la unidad del intervalo
- **THEN** la unidad (día/semana/mes/año) se elige con chips tanto en la web-mobile como en la app nativa

### Requirement: El formulario ofrece las funcionalidades avanzadas según el contexto y las activa en el lugar

Las funcionalidades avanzadas del alta —reintegro, gasto compartido y repetir (recurrencia)— SHALL ofrecerse como opciones de activación directa gateadas por el contexto: un solo gesto SHALL activar la funcionalidad y revelar sus parámetros en el lugar, y otro gesto SHALL desactivarla. El conjunto ofrecido depende del contexto y de los datos (gasto compartido solo con un hogar de dos miembros; repetir no disponible en compras en cuotas; ninguna en `ajuste` ni `cambio de moneda`), de modo que puede ir de una a tres opciones o ninguna. Las cuotas SHALL ofrecerse junto a la cuenta cuando esta es una tarjeta de crédito, por ser parte de la forma de pago, y no dentro de las funcionalidades avanzadas. Ninguna de estas funcionalidades SHALL estar activa por defecto ni ser obligatoria para un gasto simple.

Al revelar sus parámetros, cada funcionalidad SHALL mostrar la **superficie mínima**, sea por **densidad** (bloque compacto sin labels redundantes, como el reintegro) o por **disclosure** (los controles de conveniencia poco frecuentes a un gesto de distancia detrás de un disparador, como el editor de porcentaje libre de un split tras "Otro"), en lugar de volcar todos los controles de una. El detalle de qué queda visible y cómo se alcanza lo secundario en cada sección, y la paridad de estos parámetros entre las superficies mobile, lo fija el requirement «El despliegue de las secciones avanzadas es de superficie mínima y paritario entre las superficies mobile».

#### Scenario: Activar una funcionalidad revela sus parámetros en el lugar

- **WHEN** el usuario activa "compartir" en un gasto
- **THEN** aparecen los parámetros del split (con un default 50/50) sin abrir otra pantalla
- **AND** desactivarla los oculta de nuevo

#### Scenario: Al activar una funcionalidad se revela su superficie mínima

- **WHEN** el usuario activa "reintegro" en un gasto
- **THEN** el bloque muestra el monto y la regla `% + tope` en una fila compacta, y el destino más el control "Acreditado" en otra
- **AND** no se vuelcan labels ni controles redundantes; la densidad hace las veces de la superficie mínima

#### Scenario: El conjunto de funcionalidades es contextual

- **WHEN** el usuario abre el alta en `ingreso`
- **THEN** se ofrece "repetir" pero no "reintegro" ni "gasto compartido"

#### Scenario: El gasto compartido requiere un hogar de dos

- **WHEN** el usuario no tiene un hogar de dos miembros
- **THEN** no se ofrece la opción de gasto compartido

#### Scenario: Las cuotas se ofrecen junto a la cuenta de crédito

- **WHEN** el usuario selecciona una tarjeta de crédito para un gasto
- **THEN** la elección de cuotas aparece junto a la cuenta, como parte de la forma de pago
- **AND** no aparece entre las funcionalidades avanzadas

---

### Requirement: El alta preselecciona la cuenta con los datos disponibles

En modo create, el formulario SHALL preseleccionar la cuenta según este orden de preferencia, usando solo datos ya disponibles: (1) la cuenta de contexto cuando el usuario llega desde una vista de cuenta; (2) la única cuenta elegible cuando hay una sola para el tipo activo; (3) la primera cuenta elegible como fallback. La preselección nunca elige una cuenta no elegible para el tipo activo.

#### Scenario: Preselección desde una vista de cuenta

- **WHEN** el usuario abre el alta desde la vista de una cuenta específica
- **THEN** esa cuenta queda preseleccionada

#### Scenario: Preselección con una sola cuenta elegible

- **WHEN** el usuario tiene una sola cuenta elegible para el tipo activo
- **THEN** esa cuenta queda seleccionada de forma implícita

#### Scenario: Fallback a la primera elegible

- **WHEN** no hay cuenta de contexto y hay varias cuentas elegibles
- **THEN** queda preseleccionada la primera cuenta elegible

### Requirement: El alta ofrece las clasificaciones más frecuentes como aceleradores de un tap

En modo create, el formulario de alta SHALL ofrecer las clasificaciones-hoja `(categoría, subcategoría)` que el usuario usó con más frecuencia recientemente, como chips de un solo gesto, derivadas de su historial de movimientos. Un gesto sobre un chip SHALL asignar su categoría y —si la hoja la incluye— su subcategoría, dejando el movimiento listo para guardar sin abrir el selector de categoría. Los chips son una sugerencia: la selección resultante SHALL seguir siendo visible y editable, y elegir un chip nunca clasifica en silencio.

El conjunto ofrecido SHALL comenzar por las hojas del historial del propio usuario, acotadas a las compatibles con el tipo de movimiento activo, y SHALL completarse con **clasificaciones sugeridas** (categorías semilla del sistema) hasta llenar los chips, sin repetir una hoja ya presente; un usuario nuevo, sin historial, ve solo las sugerencias. Tanto el historial como las sugerencias SHALL excluir toda hoja cuya categoría o subcategoría esté archivada o ya no exista en el catálogo vigente, resolviéndose por identidad estable de la categoría/subcategoría. El ranking del historial SHALL excluir además las clasificaciones **generadas por el sistema** —las que se agregan automáticamente en otro flujo y casi nunca se cargan a mano, como el `impuesto de sellos` del pago de resumen de tarjeta— **antes** de tomar las más frecuentes, de modo que un pico de esas no desplace a las que el usuario sí carga manualmente. Si ni el historial ni las sugerencias resuelven ninguna hoja, el formulario SHALL no mostrar chips y comportarse igual que sin esta funcionalidad. Esta funcionalidad no modifica ninguna regla contable ni el significado de los campos del movimiento.

#### Scenario: Un chip frecuente asigna la clasificación de un tap

- **WHEN** el usuario abre el alta en un tipo con historial y toca un chip de clasificación frecuente cuya hoja es "Comida › Pedidos Ya"
- **THEN** el movimiento queda con esa categoría y esa subcategoría asignadas
- **AND** puede guardarse sin abrir el selector de categoría

#### Scenario: Los chips respetan el tipo activo

- **WHEN** el usuario está en el tipo `ingreso`
- **THEN** los chips ofrecidos son solo clasificaciones compatibles con `ingreso`
- **AND** ninguna hoja exclusiva de `gasto` aparece como chip

#### Scenario: Las hojas archivadas no se ofrecen

- **WHEN** una de las clasificaciones históricamente frecuentes del usuario tiene su categoría o subcategoría archivada
- **THEN** esa hoja no aparece entre los chips

#### Scenario: Una clasificación generada por el sistema no aparece aunque sea frecuente

- **WHEN** el usuario pagó un resumen de tarjeta y quedaron muchos movimientos de `impuesto de sellos` (agregados automáticamente por ese flujo) en la ventana reciente
- **THEN** `impuesto de sellos` no se ofrece como chip
- **AND** su lugar lo ocupa la siguiente clasificación más frecuente que el usuario sí carga a mano

#### Scenario: Un usuario nuevo ve clasificaciones por defecto

- **WHEN** el usuario todavía no tiene historial para el tipo activo
- **THEN** el formulario ofrece un conjunto de clasificaciones por defecto (categorías semilla del sistema)
- **AND** un tap sobre uno asigna su categoría (y subcategoría si la incluye), igual que un chip de historial

#### Scenario: Sin historial ni defaults resolubles no hay chips

- **WHEN** el usuario no tiene historial para el tipo activo y el catálogo vigente no sirve ninguna de las clasificaciones por defecto
- **THEN** el formulario no muestra chips de clasificación frecuente
- **AND** el selector de categoría funciona igual que sin esta funcionalidad

#### Scenario: En edición no se ofrecen chips

- **WHEN** el formulario se abre en modo edición de un movimiento existente
- **THEN** no se ofrecen chips de clasificación frecuente

### Requirement: La superficie del alta presenta la misma jerarquía visual en las superficies mobile (web y nativa)

El formulario de alta de movimientos SHALL presentar la misma jerarquía visual en la superficie **mobile-web** (gateada por breakpoint) y en la **app nativa**, de modo que ambas se lean como el mismo producto. Esta paridad es de **presentación**: no altera ningún campo, tipo de movimiento, regla contable ni el contrato del hook compartido. En web sigue gateada por breakpoint y el formulario **desktop** no se ve afectado.

La jerarquía compartida SHALL incluir:

- **Monto como hero.** El campo de monto SHALL presentarse como un bloque destacado con el número en tamaño grande y **centrado**, precedido por el signo del tipo activo y por el **símbolo de la moneda atenuado**. La **moneda** SHALL ofrecerse como un **chip inline** dentro del bloque de monto —no como un control segmentado separado— que al accionarse rota entre las monedas elegibles y SHALL quedar inerte cuando hay una sola. En el bloque de monto SHALL haber un **disparador de calculadora** cuando el campo la habilita.
- **Campos secundarios agrupados.** Categoría, cuenta, cuotas (cuando aplican) y fecha SHALL presentarse dentro de **un único contenedor** con separadores entre filas, en lugar de contenedores sueltos e independientes.
- **Fecha compacta.** La fecha SHALL presentarse como un disparador de calendario junto a chips de acceso rápido **Hoy/Ayer**, sin una etiqueta de campo propia.
- **Descripción slim.** La descripción SHALL presentarse como una sola línea compacta, sin una etiqueta de campo propia.

La paridad se evalúa por **rol y estructura** de los elementos (qué es el hero, qué comparte contenedor), no por igualdad de píxeles. El comportamiento de cada campo (ocultamiento de la cuenta, chips de avanzado, cuotas junto a la cuenta de crédito, etc.) SHALL permanecer como lo definen los requirements de comportamiento vigentes.

#### Scenario: El monto se presenta como hero en ambas superficies mobile

- **WHEN** el usuario abre el alta en la web-mobile o en la app nativa
- **THEN** el monto se muestra como un bloque destacado con el número grande y centrado, el signo del tipo y el símbolo de moneda atenuado
- **AND** la moneda aparece como un chip dentro de ese bloque, no como un control segmentado aparte

#### Scenario: Los campos secundarios comparten un único contenedor

- **WHEN** el usuario abre el alta en la web-mobile o en la app nativa
- **THEN** categoría, cuenta (si el selector aplica), cuotas (si aplican) y fecha se presentan dentro de un único contenedor con separadores
- **AND** no aparecen como contenedores independientes y sueltos

#### Scenario: La fecha usa disparador de calendario más chips Hoy/Ayer

- **WHEN** el usuario mira la fila de fecha del alta en cualquiera de las dos superficies mobile
- **THEN** ve un disparador de calendario acompañado de chips Hoy/Ayer
- **AND** no ve una etiqueta de campo separada para la fecha

#### Scenario: El desktop no se ve afectado

- **WHEN** el formulario de alta se renderiza en viewport de escritorio
- **THEN** conserva su maqueta de escritorio y no adopta la presentación mobile
