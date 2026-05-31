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

El sistema SHALL permitir registrar un gasto (plata que sale) en una cuenta. Para `type='cash'` o `type='bank'`, el gasto requiere: cuenta, moneda activa, monto mayor a cero, fecha y categoría; la subcategoría y descripción son opcionales; el sistema persiste con `status=NULL` (no aplica) e impacta saldo inmediatamente. Para `type='credit'` (tarjeta), el gasto sigue el requirement específico de consumos en tarjeta (con `status='pending'`, `card_period_id`, eventualmente cuotas, y SIN impacto al saldo disponible) — ver requirement separado.

#### Scenario: Gasto en cash creado correctamente

- **WHEN** el usuario completa el formulario con cuenta cash, moneda, monto > 0, fecha y categoría válidos y confirma
- **THEN** el sistema inserta una fila en `transactions` con `type='expense'`, `status=NULL`, `amount > 0`, y el saldo de la cuenta disminuye en ese monto para la moneda indicada

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

El sistema SHALL calcular el saldo de cada cuenta como `initial_balance + Σ income − Σ expense − Σ transfer saliente + Σ transfer entrante + Σ adjustment` en la moneda correspondiente. No existe columna de saldo cacheada.

#### Scenario: Saldo después de crear un ingreso

- **WHEN** el usuario crea un ingreso de $100 ARS en una cuenta con `initial_balance_ars = 500`
- **THEN** la pantalla de detalle de esa cuenta muestra saldo ARS = $600

#### Scenario: Saldo después de crear un gasto

- **WHEN** el usuario crea un gasto de $200 ARS en una cuenta con `initial_balance_ars = 500` y sin transacciones previas
- **THEN** la pantalla de detalle muestra saldo ARS = $300

#### Scenario: Saldo después de crear una transferencia saliente

- **WHEN** el usuario crea una transferencia de `$150 ARS` desde la cuenta A (saldo $500) hacia la cuenta B (saldo $0)
- **THEN** la pantalla de detalle de A muestra saldo ARS = `$350` y la de B muestra saldo ARS = `$150`

#### Scenario: Saldo después de crear un ajuste

- **WHEN** el usuario crea un ajuste de `+$30 ARS` en una cuenta con saldo de `$500`
- **THEN** la pantalla de detalle muestra saldo ARS = `$530`

#### Scenario: Saldo puede ser negativo

- **WHEN** los gastos acumulados superan el `initial_balance` de una moneda
- **THEN** el sistema muestra el saldo negativo (no lo clampea a cero)

#### Scenario: ARS y USD se calculan por separado

- **WHEN** la cuenta tiene transacciones en ARS y en USD
- **THEN** el sistema muestra saldos independientes por moneda; nunca los convierte ni combina

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

#### Scenario: El listado global está paginado

- **WHEN** el usuario abre `/transactions` y existen más movimientos que el tamaño inicial de página
- **THEN** el sistema muestra los movimientos más recientes primero
- **AND** ofrece una acción para cargar más movimientos preservando los filtros activos en la URL
- **AND** los movimientos adicionales respetan el mismo orden funcional del listado global

---

### Requirement: El usuario tiene un acceso rápido flotante para registrar un movimiento

En **web**, el sistema SHALL ofrecer un **acceso rápido flotante** (FAB) para registrar un movimiento, **visible solo en viewport `<sm` (mobile-web)** en el listado global de Movimientos y en el dashboard, de modo que el usuario pueda iniciar un alta sin scrollear de vuelta al header. El FAB SHALL abrir el flujo de alta canónico (`/transactions/new`). En mobile-web el FAB **reemplaza** al botón "Nuevo movimiento" del header del dashboard (el botón no se renderiza en ese viewport, ver spec de `dashboard`); el FAB es el único acceso primario para registrar desde esas pantallas. En desktop-web (viewport `≥sm`) el FAB NO SHALL renderizarse: el acceso primario lo cumple el botón "Nuevo movimiento" del header del dashboard y los accesos propios de la pantalla `/transactions`.

El FAB web SHALL ser un cuadrado de 64×64 px con esquinas ligeramente redondeadas (`rounded-2xl`, ≈16 px), fondo verde semántico (`bg-success` / `text-success-foreground`, mapeado al token `--success` = emerald), anclado en `bottom-10 right-10` (40 px de cada borde) con `z-index` por encima del contenido scrolleable. El label accesible SHALL leerse del catálogo i18n (`transactions.actions.register_movement`), nunca hardcodeado.

Las pantallas que renderizan el FAB en mobile-web SHALL reservar padding inferior suficiente para que el FAB no tape la última fila de contenido al scrollear hasta el final (`pb-24 sm:pb-0` o equivalente).

#### Scenario: FAB visible en Movimientos y dashboard (mobile-web)

- **WHEN** el usuario autenticado abre `/transactions` o `/dashboard` en viewport `<sm`
- **THEN** ve un FAB cuadrado verde anclado en la esquina inferior derecha, visible aunque haya scrolleado la pantalla
- **AND** al activarlo navega a `/transactions/new`

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

### Requirement: El listado global distingue el motivo de un resultado vacío

Cuando el listado global de Movimientos no tiene resultados, el sistema SHALL mostrar un estado vacío acorde al **motivo**, no un único mensaje genérico. SHALL distinguir tres variantes:

- **Sin movimientos** (no hay búsqueda ni filtros de contenido activos): el contenido del estado SHALL ser **contextual al estado del usuario**:
  - Si el usuario nunca registró movimientos en ningún mes (primera vez) → mensaje de bienvenida ("Acá va a aparecer cada peso que se mueva") y acción para registrar el primer movimiento.
  - Si el usuario tiene movimientos en otros meses pero solo navegó a un mes vacío → mensaje contextual al mes ("No registraste nada en {mes} todavía") y la misma acción de registrar, sin el tono de bienvenida.
- **Sin resultados de búsqueda** (hay un término de búsqueda activo): un mensaje que indica que no se encontraron coincidencias y una acción para **limpiar la búsqueda**.
- **Sin resultados de filtro** (hay filtros de contenido activos — tipo, categoría, cuenta, moneda o rango de monto): un mensaje que indica que ningún movimiento cumple los filtros y una acción para **limpiar los filtros**.

La **navegación por mes** NO cuenta como filtro de contenido para esta clasificación (es una ventana temporal, no un filtro): un mes sin movimientos y sin otros filtros SHALL mostrar la variante "sin movimientos" en la sub-variante contextual del mes. El resto —tipo, categoría, cuenta, moneda y rango de monto— SÍ cuenta como filtro. Cuando coexisten búsqueda y filtros, prevalece la variante de **filtro**. Las acciones de limpiar SHALL operar sobre el estado de filtros en la URL (sin recargar la pantalla completa), coherente con la barra de filtros.

#### Scenario: Primera vez del usuario muestra bienvenida

- **WHEN** el usuario abre `/transactions` por primera vez (sin ningún movimiento registrado en ningún mes) sin búsqueda ni filtros activos
- **THEN** el sistema muestra un estado de bienvenida con copy "Acá va a aparecer cada peso que se mueva"
- **AND** la acción abre `/transactions/new`

#### Scenario: Mes vacío con historial previo muestra copy contextual

- **WHEN** el usuario tiene movimientos registrados en otros meses pero navegó a un mes vacío y no tiene filtros activos
- **THEN** el sistema muestra copy contextual "No registraste nada en {mes} todavía"
- **AND** la acción abre `/transactions/new`
- **AND** la copy NO tiene tono de bienvenida (no es la primera vez)

#### Scenario: Búsqueda sin resultados ofrece limpiar la búsqueda

- **WHEN** el usuario tiene un término de búsqueda activo y ninguno de sus movimientos coincide
- **THEN** el sistema indica que no se encontraron resultados para ese término
- **AND** ofrece una acción para limpiar la búsqueda

#### Scenario: Filtros sin resultados ofrecen limpiar los filtros

- **WHEN** el usuario tiene filtros de contenido activos (tipo, categoría, cuenta, moneda o rango de monto) y ningún movimiento los cumple
- **THEN** el sistema indica que ningún movimiento cumple los filtros
- **AND** ofrece una acción para limpiar los filtros

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

El sistema SHALL permitir filtrar el listado global de movimientos por texto, tipo de movimiento, categoría, cuenta, **moneda** y **rango de monto**, y navegar el período **por mes**. Los filtros SHALL estar representados en la URL para que la pantalla sea compartible, recargable y navegable con back/forward del browser.

La UI de filtros SHALL ser una **barra compacta** (búsqueda + navegación por mes + botón "Filtros" con un contador de filtros activos); los filtros detallados (tipo, categoría, cuenta, moneda, rango de monto) SHALL vivir en un **panel desplegable**, y los filtros activos SHALL mostrarse como **chips removibles** bajo la barra, junto con una acción "Limpiar todo". La búsqueda SHALL ser **instantánea** (sin botón de aplicar, con un breve debounce) y SHALL buscar en **todo el historial** del usuario, no solo en los movimientos ya paginados.

El período SHALL navegarse **por mes** (mes anterior / mes siguiente) como control primario; por defecto SHALL mostrarse el **mes actual** (computado en la zona horaria financiera con `getTodayAR()`), conservando una opción de rango personalizado que tiene prioridad sobre el mes. El filtro por cuenta SHALL mostrarse únicamente cuando el usuario tiene **dos o más cuentas**; con una sola cuenta no se ofrece.

#### Scenario: Buscar por descripción de forma instantánea

- **WHEN** el usuario tipea en la búsqueda
- **THEN** el sistema filtra (con un breve debounce) los movimientos cuya descripción o texto visible coincida, sin requerir un botón de aplicar
- **AND** la coincidencia se busca en todo el historial, no solo en la página actual
- **AND** mantiene el término de búsqueda en la URL

#### Scenario: Navegación por mes como período por defecto

- **WHEN** el usuario abre `/transactions` sin un período en la URL
- **THEN** el sistema muestra los movimientos del mes actual (según `getTodayAR()`)
- **AND** el usuario puede navegar al mes anterior o siguiente con las flechas
- **AND** interpreta las fechas como fecha contable, no como timestamp UTC

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
- **AND** quitar un chip elimina ese filtro de la URL y reconsulta

---

### Requirement: El módulo global de movimientos destaca movimientos que requieren revisión

El sistema SHALL poder marcar movimientos con estados de revisión funcionales cuando detecta que podrían requerir atención del usuario. Estos estados no cambian el impacto contable del movimiento: solamente ayudan a priorizar revisión, corrección o categorización.

Un movimiento MAY requerir revisión por motivos como: falta de categoría, monto inusualmente alto, posible duplicado, datos incompletos, cotización faltante, ajuste frecuente o inconsistencia funcional detectada.

#### Scenario: Movimiento sin categoría requiere revisión

- **WHEN** existe un movimiento de tipo gasto o ingreso que debería tener categoría pero no la tiene
- **THEN** el listado global puede mostrarlo como "Sin categoría"
- **AND** puede incluirlo en un filtro de revisión

#### Scenario: Posible duplicado requiere revisión

- **WHEN** existen dos movimientos del mismo usuario con fecha, monto, moneda, cuenta y descripción muy similares
- **THEN** el sistema puede marcarlos como posibles duplicados
- **AND** no los elimina ni los fusiona automáticamente

#### Scenario: Revisión por cotización faltante

- **WHEN** un movimiento requiere cotización para mostrarse o controlarse correctamente y la cotización falta
- **THEN** el sistema puede marcarlo como movimiento a revisar
- **AND** la marca no inventa una cotización ni modifica el monto original

#### Scenario: Revisión no altera saldos

- **WHEN** un movimiento es marcado como requiere revisión
- **THEN** el saldo de las cuentas no cambia
- **AND** la marca funciona únicamente como ayuda operativa para el usuario

---

### Requirement: El usuario puede ver el detalle de una transacción

El sistema SHALL exponer una pantalla de detalle `/transactions/[txId]` para cada movimiento, que muestre toda la información asociada al movimiento (campos según su `kind`), las cuotas hermanas cuando es una compra en cuotas (madre o hija), los reintegros vinculados cuando corresponde, y la regla recurrente que lo generó cuando aplica. La pantalla SHALL respetar el origen de navegación (`?from=account:<id>` o `?from=card:<id>`) para resolver el destino del "Volver".

La **presentación visual** SHALL seguir el patrón editorial centrado:

- **`TxHeader`** arriba: un ícono `←` (sin label de texto) a la izquierda como link al destino del back, y un slot a la derecha para el `TxActionsMenu` (kebab) o nada cuando el movimiento no permite acciones.
- **`TxHero`** centrado verticalmente: ícono circular de 64px con sombra suave (`0 8px 22px rgba(11,26,43,0.10)`) y fondo derivado de la categoría (categorizables) o `bg-muted` (estructurales). Debajo, el monto display 38-48px en `text-{tone}` (income/expense/neutral-amount/pending), con el signo (+/−), el currency symbol más chico y opaco (~60% opacity) y los decimales en superscript (`fontSize: 0.55em, verticalAlign: 0.65em`). Debajo del monto, la descripción 18px font-bold navy centrada (hasta ~300px de ancho), y opcionalmente una context line 12px muted centrada con la info contextual (fecha · cuenta · subtipo · etc.).
- **`TxDetailGroup`(s)** para los metadatos: cards blancos con border y radius grande (~18px), un eyebrow caps uppercase opcional como header del group (ej. "DETALLES", "TARJETA"), y filas adentro de tipo `TxDetailRow` (ícono cuadrado redondeado 32×32 con bg-muted + label uppercase 10.5px + value 13.5px font-semibold navy). Las filas se separan con border-bottom; la última no tiene border.
- **`TxInstallmentRows`** cuando aplica (madre o hija de cuotas): variant del DetailGroup con cada fila llevando un número circular 28×28 con color de fondo según estado (`pending` warning soft, `paid` income soft, otras muted), descripción de la cuota, chip de estado y monto.
- **`TxActionsMenu`** como kebab `⋯` arriba a la derecha, no como botones planos abajo: dropdown con "Editar" (link a `[txId]/edit`) y "Eliminar" (abre AlertDialog con copy contextual según parent / card payment / default).
- **Banner de recurrencia** (cuando aplica) se mantiene arriba del `TxHero`, ubicado en el layout de la página (`page.tsx`), no dentro del componente del detalle.

La lógica de qué campos mostrar por kind, el manejo de cuotas hermanas, los reembolsos vinculados y el back navigation NO cambia — preserva todo el comportamiento del componente actual.

#### Scenario: El detalle se abre y muestra los campos correctos según el kind

- **WHEN** el usuario abre `/transactions/[txId]` de un gasto categorizado en una cuenta cash
- **THEN** el detalle muestra el hero centrado con monto en `text-expense`, ícono de la categoría con bg tintado, descripción debajo del monto, y un `TxDetailGroup` con filas para fecha, cuenta, categoría y subcategoría (si la tiene)
- **AND** el back en `TxHeader` resuelve al destino que indica `?from=` o, por defecto, a `/transactions`

#### Scenario: Compra en cuotas muestra el detalle con tabla de cuotas

- **WHEN** el usuario abre el detalle de una compra en cuotas (madre o hija)
- **THEN** el `TxHero` muestra la descripción de la compra y el monto total (en la madre) o la cuota (en la hija)
- **AND** un `TxInstallmentRows` lista todas las cuotas con su número circular, estado y monto
- **AND** un click sobre una cuota hija navega a su propio detalle

#### Scenario: Un reintegro pendiente muestra tone pending

- **WHEN** el usuario abre el detalle de un reintegro con `received_at IS NULL` y `cancelled_at IS NULL`
- **THEN** el `TxHero` muestra el monto con `text-pending` (gris)
- **AND** un `TxDetailGroup` lista el gasto vinculado, el monto esperado y el estado

#### Scenario: El back navigation respeta el origen

- **WHEN** el usuario abre `/transactions/[txId]?from=account:abc-123` y hace click en el `←`
- **THEN** el sistema navega a `/accounts/abc-123`

#### Scenario: El AlertDialog de eliminar tiene copy contextual

- **WHEN** el usuario abre el kebab del detalle de una compra en cuotas madre y elige "Eliminar"
- **THEN** el AlertDialog muestra el warning "Se van a eliminar la compra y todas sus cuotas. Esta acción no se puede deshacer."
- **AND** cuando el movimiento es un pago de resumen, el warning dice "Al eliminar este pago, las cuotas del período volverán a pendientes. ¿Continuar?"
- **AND** en todos los otros casos, el warning genérico "Esta acción no se puede deshacer."

#### Scenario: Transacción de otro usuario no es accesible

- **WHEN** el usuario intenta acceder directamente a la URL de una transacción que no le pertenece
- **THEN** el sistema retorna `notFound()` (la RLS filtra la fila; la página renderiza 404)

### Requirement: El detalle del movimiento usa un hero editorial centrado con el monto como protagonista

El sistema SHALL renderizar el hero del detalle de un movimiento como un bloque **centrado verticalmente**, con la siguiente anatomía:

- Un **ícono circular** de 64×64 px con sombra suave (`box-shadow: 0 8px 22px rgba(11,26,43,0.10)`) y fondo derivado del kind: tintado del color de la categoría para movimientos categorizables (income, expense, installment_purchase), bg-muted con un ícono lucide en text-soft para movimientos de estructura (transfer, exchange, adjustment, card_payment), bg con tono del estado para reintegros.
- El **monto display** debajo del ícono, tipografía editorial 38-48px font-bold, en `text-{tone}` según el tone resuelto:
  - `text-income` para income, reimbursement recibido, ajuste positivo.
  - `text-expense` para gasto en cash/bank, consumo o cuota de tarjeta, pago de resumen, ajuste negativo.
  - `text-neutral-amount` para transferencia y cambio de moneda.
  - `text-pending` para reintegro esperado (no recibido).
- El monto SHALL llevar un **signo** (+/−) cuando el tone es income o expense, y omitirlo cuando es neutral o pending. El **currency symbol** SHALL renderearse en línea, a la izquierda del entero, en font-size ~63% del display, opacidad 0.6. Los **decimales** SHALL renderearse en **superscript** (`fontSize: 0.55em, verticalAlign: 0.65em`) cuando el usuario tiene `showCents=true` y el monto no es entero exacto.
- Debajo del monto, una **descripción** 18px font-bold navy centrada, máximo ~300px de ancho.
- Opcionalmente, una **context line** 12px muted centrada con info contextual (fecha relativa, cuenta, subtipo, fx_rate, período, etc., según el kind).

El hero NO SHALL llevar type chips ("Compra en cuotas", "3 cuotas · pesos", etc.) — la información del tipo se infiere del ícono y se especifica en los DetailGroups y la tabla de cuotas debajo.

#### Scenario: El hero usa el tone semántico correcto

- **WHEN** el sistema renderiza el detalle de un gasto cash de $1.234,56 en ARS
- **THEN** el hero muestra el monto como `−$1.234,56` con `,56` en superscript, en color `text-expense`
- **AND** la descripción 18px bold debajo

#### Scenario: El hero de un reintegro pendiente usa tone pending

- **WHEN** el sistema renderiza el detalle de un reintegro con `received_at IS NULL`
- **THEN** el monto se muestra con `text-pending` (gris) y sin signo
- **AND** la context line incluye la etiqueta "esperado"

#### Scenario: El hero no muestra type chips

- **WHEN** el sistema renderiza el detalle de una compra en cuotas madre
- **THEN** el hero muestra ícono + monto + descripción + context line
- **AND** NO renderea pills con etiquetas tipo "Compra en cuotas" o "3 cuotas · pesos" arriba del monto

### Requirement: Las acciones del detalle viven en un kebab menu

El sistema SHALL exponer las acciones del detalle (Editar, Eliminar) como un **kebab menu `⋯`** ubicado arriba a la derecha del `TxHeader`, no como botones planos al pie del detalle. El kebab es un botón de 36×36 con ícono `MoreHorizontal`. Al click abre un dropdown con los items disponibles según los permisos del usuario y el editable-state del movimiento.

Items del dropdown:

- **Editar**: link a `/transactions/[txId]/edit`. SHALL aparecer solo cuando `canEdit` (movimiento editable según `getEditableFields`).
- **Eliminar**: abre un AlertDialog con copy contextual según el kind del movimiento. SHALL aparecer solo cuando `canDelete`.

Cuando ambos `canEdit` y `canDelete` son false, el kebab NO SHALL renderearse — el slot de actions del header queda vacío.

#### Scenario: El kebab abre el dropdown con los items aplicables

- **WHEN** el usuario abre el detalle de un gasto editable y eliminable y hace click en el kebab `⋯`
- **THEN** se abre un dropdown con "Editar" y "Eliminar"
- **AND** click en "Editar" navega a `/transactions/[txId]/edit`
- **AND** click en "Eliminar" abre un AlertDialog de confirmación

#### Scenario: El kebab se oculta cuando no hay acciones disponibles

- **WHEN** el usuario abre el detalle de un movimiento donde `canEdit && canDelete` son false (ej. una cuota hija con período pagado)
- **THEN** el slot de actions del `TxHeader` queda vacío
- **AND** el kebab `⋯` no aparece

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
- **Consumos en tarjeta (1 cuota, `status='pending'`)**: monto, fecha, descripción, categoría, subcategoría. NO editable: cuenta, moneda, cuotas. Si `status='paid'`, sólo editables descripción y categoría.
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

### Requirement: El usuario puede eliminar una transacción

El sistema SHALL permitir eliminar permanentemente una transacción. El sistema solicita confirmación antes de ejecutar. El saldo de la cuenta se recalcula automáticamente tras la eliminación.

#### Scenario: Eliminar transacción actualiza el saldo

- **WHEN** el usuario confirma la eliminación de un gasto de $200 ARS
- **THEN** el sistema borra la fila y el saldo ARS de la cuenta aumenta $200

#### Scenario: Eliminación requiere confirmación

- **WHEN** el usuario toca "Eliminar" en el detalle de la transacción
- **THEN** el sistema muestra un diálogo de confirmación antes de ejecutar el borrado

---

### Requirement: Solo el dueño de la transacción puede leerla y modificarla

El sistema SHALL aplicar Row Level Security sobre `transactions` de forma que `user_id = auth.uid()` para toda operación SELECT, INSERT, UPDATE y DELETE.

#### Scenario: RLS bloquea acceso cross-user

- **WHEN** un usuario autenticado realiza una query directa contra `transactions` sin filtro de `user_id`
- **THEN** Supabase retorna únicamente las filas donde `user_id = auth.uid()`

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

La distribución de montos SHALL ser: `cuota_base = floor(amount_total * 100 / N) / 100` (en centavos), `residuo = amount_total − cuota_base * N`, `cuota_1 = cuota_base + residuo`, cuotas 2..N = `cuota_base`. La cuota `i` SHALL tener `date = madre.date + (i-1) meses` (date virtual de imputación al resumen) y `card_period_id` del período cuyo rango contenga esa fecha (auto-generando el período si no existe vía rolling).

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

El sistema SHALL rechazar la inserción de cualquier transacción de tarjeta cuya `date` caiga dentro del rango (`start_date`, `end_date`) de un `card_periods` cuyo estado derivado sea `paid`. El sistema SHALL devolver un error explicativo y ofrecer al usuario alternativas (registrar como ajuste manual, o consultar un flujo futuro de corrección).

#### Scenario: Backdating en período paid es rechazado

- **WHEN** el usuario intenta registrar un consumo con `date='2026-04-20'` y existe un `card_periods` con rango `2026-04-01` a `2026-04-30` en estado `paid`
- **THEN** la action retorna error tipado `period_already_paid`
- **AND** no inserta la transacción

#### Scenario: Backdating en período no-paid es aceptado

- **WHEN** el usuario registra un consumo con `date='2026-05-05'` y el período de mayo está en estado `open`
- **THEN** la transacción se inserta normalmente

---

### Requirement: Las transacciones de tarjeta NO impactan el saldo disponible del usuario

El sistema SHALL excluir del cálculo de saldo de cualquier cuenta a las transacciones de `type='expense'` con `account.type='credit'` (tanto `pending` como `paid`). El saldo de las cuentas `cash`/`bank` SHALL afectarse únicamente por:

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

---

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

El sistema SHALL validar mediante constraint `CHECK` y/o lógica de action que `transactions.fx_rate_to_ars` esté populado (NOT NULL, > 0) si y solo si `account.type='credit'` AND `currency_code != 'ARS'` AND `type='expense'` AND `is_parent=false`. En cualquier otro caso, `fx_rate_to_ars` SHALL ser `NULL`.

#### Scenario: Consumo USD en tarjeta exige fx_rate_to_ars

- **WHEN** se intenta insertar `expense` en tarjeta con `currency_code='USD'` y `fx_rate_to_ars=NULL`
- **THEN** la DB o action rechaza con error

#### Scenario: Consumo ARS en tarjeta no debe tener fx_rate_to_ars

- **WHEN** se intenta insertar `expense` en tarjeta con `currency_code='ARS'` y `fx_rate_to_ars=1400`
- **THEN** la DB o action rechaza con error

#### Scenario: Income en cuenta cash no debe tener fx_rate_to_ars

- **WHEN** se intenta insertar `income` con `fx_rate_to_ars` no nulo
- **THEN** la DB o action rechaza

---

### Requirement: Las transacciones de pago de resumen y reversión preservan el orden determinístico

El sistema SHALL preservar el ordering determinístico (`date ASC, created_at ASC, id ASC`) en todas las queries de listados de movimientos, incluyendo movimientos generados por el pago de resumen y por la reversión. Los `expense` de pago SHALL aparecer en la cuenta de pago con la fecha del pago.

#### Scenario: Lista de movimientos de "Galicia" muestra el pago como expense ordinario

- **WHEN** el usuario abre el detalle de "Galicia" después de pagar un resumen
- **THEN** la lista muestra ese `expense` en la posición correspondiente a su `date` (no agrupado aparte)
- **AND** el ordering respeta `date ASC, created_at ASC, id ASC`

---

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

El movimiento registrado en ese momento SHALL crearse como transaccion real normal usando el flujo existente. La regla recurrente SHALL apuntar opcionalmente a ese movimiento mediante `created_from_transaction_id`.

#### Scenario: Ingreso recurrente creado desde registro

- **WHEN** el usuario registra un ingreso y activa "Recurrente"
- **THEN** el sistema crea el ingreso real en `transactions` con `status=NULL`
- **AND** crea una regla recurrente de tipo `income`
- **AND** no crea una segunda transaccion para la primera recurrencia

#### Scenario: Gasto de tarjeta recurrente creado desde registro

- **WHEN** el usuario registra un consumo simple en tarjeta y activa "Recurrente"
- **THEN** el sistema crea el consumo real de tarjeta con `status='pending'` y `card_period_id`
- **AND** crea una regla recurrente de tipo `expense` asociada a esa tarjeta
- **AND** la regla no modifica el estado del resumen

#### Scenario: Transferencia recurrente creada desde registro

- **WHEN** el usuario registra una transferencia y activa "Recurrente"
- **THEN** el sistema crea la transferencia real
- **AND** crea una regla recurrente con cuenta origen y cuenta destino

#### Scenario: Recurrencia con preset mensual persiste su intervalo derivado

- **WHEN** el usuario crea una recurrencia con `frequency = monthly`
- **THEN** la regla persiste `interval_count = 1` e `interval_unit = month`
- **AND** `frequency` queda como `monthly`

#### Scenario: Recurrencia personalizada cada 3 meses

- **WHEN** el usuario elige "Personalizado" con `cada 3 · meses`
- **THEN** la regla persiste `frequency = custom`, `interval_count = 3`, `interval_unit = month`

#### Scenario: Recurrencia personalizada con fin por ocurrencias

- **WHEN** el usuario crea una recurrencia personalizada `cada 2 · semanas` con límite de `6` ocurrencias
- **THEN** la regla persiste `interval_count = 2`, `interval_unit = week`, `max_occurrences = 6`

### Requirement: La generación de instancias recurrentes usa intervalo+unidad y corta por la primera condición de fin

El sistema SHALL calcular la fecha de la siguiente instancia recurrente aplicando `interval_count` veces la `interval_unit`. La fecha base SHALL determinarse así:

- Si `last_generated_date` es NULL (regla creada directamente, sin ocurrencia semilla): la **primera** instancia se programa **exactamente en `start_date`** (no se suma intervalo).
- Si `last_generated_date` NO es NULL (reglas creadas desde un movimiento o desde una sugerencia, donde `start_date` ya está cubierto por una transacción real): la siguiente instancia se programa aplicando el intervalo sobre `last_generated_date`.

El cálculo SHALL aplicar clamping de fin de mes: avanzar por `month` o `year` desde un día que no existe en el mes destino SHALL caer al último día válido de ese mes (p. ej. 31-ene + 1 mes ⇒ 28/29-feb).

La generación SHALL cortar por la primera condición de fin que se cumpla (`end_date` o `max_occurrences`). Una sola instancia pendiente SHALL existir por regla a la vez; un `start_date` pasado en una regla directa NO SHALL generar instancias retroactivas por cada período vencido, sino una única instancia pendiente fechada en `start_date`.

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

El sistema SHALL permitir editar los campos mutables de una instancia recurrente pendiente antes de confirmarla. Los cambios de fecha, descripcion, categoria y subcategoria SHALL aplicar a la instancia puntual. Si el usuario modifica el monto, el sistema SHALL actualizar tambien el monto de la regla recurrente.

#### Scenario: Editar fecha de consumo recurrente de tarjeta

- **WHEN** el usuario cambia la fecha de una instancia pendiente de tarjeta
- **THEN** la confirmacion usa la nueva fecha para asignar el `card_period_id`

#### Scenario: Editar monto y actualizar regla

- **WHEN** el usuario cambia el monto de una instancia pendiente
- **THEN** la instancia se confirma con el nuevo monto
- **AND** las futuras instancias de la regla se generan con ese nuevo monto

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

#### Scenario: Acceso desde Movimientos

- **WHEN** el usuario abre `/transactions`
- **THEN** puede navegar a `/transactions/recurring`

#### Scenario: Regla eliminada no borra historial

- **WHEN** el usuario desactiva o elimina una regla recurrente
- **THEN** las transacciones reales ya confirmadas se conservan
- **AND** dejan trazabilidad hacia la regla si la FK sigue disponible

#### Scenario: Regla pausada no genera instancias

- **WHEN** el usuario pausa una regla recurrente
- **THEN** el sistema no genera nuevas instancias pendientes para esa regla
- **AND** las transacciones ya confirmadas se conservan

#### Scenario: Regla pausada puede reactivarse

- **WHEN** el usuario reactiva una regla pausada
- **THEN** el sistema vuelve a considerarla para generar la proxima instancia pendiente segun su frecuencia

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

El detalle global de un movimiento (`/transactions/<id>`) SHALL ofrecer las acciones de Editar y Eliminar, sin obligar al usuario a navegar primero al detalle en contexto de cuenta. La edición SHALL abrir la ruta canónica `/transactions/<id>/edit`, renderizada por el **formulario único** en modo edición. Estas acciones SHALL respetar exactamente las mismas reglas de edición y eliminación ya definidas (campos mutables por tipo, propagación en compras en cuotas, bloqueos por estado `paid`), ahora gobernadas por la función pura `getEditableFields`. Ningún movimiento accesible desde el listado global SHALL quedar sin camino para editarse o eliminarse.

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

### Requirement: El usuario puede registrar un movimiento desde el módulo global

El módulo global de Movimientos (`/transactions`) SHALL ofrecer el **punto de entrada único** para registrar un nuevo movimiento, de modo que el usuario no esté obligado a entrar primero a una cuenta para cargar un ingreso, gasto, transferencia, ajuste o cambio. El alta SHALL vivir en la ruta canónica `/transactions/new`; no existe un alta scoped por cuenta. La cuenta puede venir **pre-seleccionada** vía `?account=<id>` cuando el alta se lanza desde el detalle de una cuenta o de una tarjeta.

#### Scenario: Punto de entrada visible en el módulo global

- **WHEN** el usuario autenticado abre `/transactions`
- **THEN** ve una acción para registrar un nuevo movimiento
- **AND** al activarla accede a `/transactions/new`

#### Scenario: La cuenta se elige dentro del formulario, después del tipo

- **WHEN** el usuario abre el flujo de registro desde el módulo global sin cuenta pre-seleccionada
- **THEN** el formulario muestra primero el selector de tipo (ingreso/gasto/transferencia/ajuste/cambio) y, debajo, la cuenta como un campo que se elige mientras se carga el movimiento (sin un paso previo de selección de cuenta)
- **AND** para gasto, el selector de cuenta incluye tarjetas de crédito; al elegir una, aparecen las cuotas (ARS) o la cotización (USD) inline
- **AND** para ingreso/transferencia/ajuste el selector ofrece solo cuentas de efectivo/banco

#### Scenario: Alta con cuenta pre-seleccionada

- **WHEN** el usuario abre `/transactions/new?account=<id>` desde una cuenta o una tarjeta
- **THEN** el selector arranca con esa cuenta elegida
- **AND** si es una tarjeta de crédito, el formulario arranca en el tipo Gasto

#### Scenario: Al guardar se vuelve al origen

- **WHEN** el usuario guarda un movimiento desde `/transactions/new`
- **THEN** si había `?from=` (una cuenta o una tarjeta), el sistema vuelve a ese origen
- **AND** si no había origen, vuelve a `/transactions` (el listado), no al detalle de la cuenta ni de la tarjeta

#### Scenario: El registro respeta las reglas de creación existentes

- **WHEN** el usuario registra un movimiento desde `/transactions/new`
- **THEN** se aplican las mismas validaciones de creación vigentes (moneda activa en la cuenta, monto válido, categoría obligatoria para ingreso/gasto, fecha contable)
- **AND** el movimiento creado aparece en el listado global

### Requirement: El sistema usa un formulario único para crear y editar movimientos

El sistema SHALL usar **un único formulario** para crear y editar todo tipo de movimiento (ingreso, gasto, transferencia, ajuste, cambio de moneda, consumo de tarjeta y compra en cuotas). En **modo creación** el usuario elige el tipo y la cuenta dentro del formulario; en **modo edición** el tipo, la moneda y la(s) cuenta(s) se muestran como contexto inmutable y sólo se ofrecen los campos editables.

Qué campos son editables y cuáles visibles según el tipo y el estado del movimiento SHALL derivarse de una **función pura** (`getEditableFields`) en `@grana/money-logic`, única fuente de verdad de esas reglas, reutilizable por web y mobile. Esta función NO cambia las reglas de editabilidad ya especificadas (ingreso/gasto, transferencia, ajuste, consumo `pending`/`paid`, madre de cuotas con o sin cuota pagada, pago de resumen sin categoría); las centraliza.

En **modo creación**, el selector de cuenta SHALL mostrar el **saldo disponible actual de cada cuenta por moneda** (bimoneda). Las tarjetas de crédito NO muestran saldo (son off-ledger).

#### Scenario: El mismo formulario crea y edita

- **WHEN** el usuario crea un movimiento nuevo y, en otro momento, edita uno existente
- **THEN** ambas pantallas usan el mismo formulario
- **AND** en edición el tipo, la moneda y la cuenta se muestran como contexto no editable

#### Scenario: La editabilidad la decide una función pura

- **WHEN** el formulario renderiza un movimiento en modo edición
- **THEN** los campos editables y visibles se determinan por `getEditableFields` según el tipo y estado del movimiento
- **AND** un consumo de tarjeta `paid` o una compra en cuotas con alguna cuota `paid` sólo permite editar categoría/descripción (monto y fecha bloqueados)

#### Scenario: El selector de cuenta muestra el saldo por moneda

- **WHEN** el usuario abre el formulario de alta y despliega el selector de cuenta
- **THEN** cada cuenta de efectivo/banco muestra su saldo disponible actual por moneda
- **AND** las tarjetas de crédito no muestran saldo

### Requirement: Las rutas de movimiento son canónicas bajo `/transactions`

Cada movimiento SHALL tener **una única URL canónica** bajo `/transactions`: el detalle en `/transactions/<id>`, la edición en `/transactions/<id>/edit` y el alta en `/transactions/new`. El árbol scoped por cuenta `/accounts/<id>/transactions/*` (alta, detalle, edición) NO SHALL existir.

El contexto de cuenta SHALL transmitirse por query params, no por jerarquía de ruta: `?account=<id>` pre-selecciona la cuenta en el alta (lo usan los accesos desde el detalle de una cuenta o de una tarjeta), y `?from=<origen>` determina la navegación de retorno y la perspectiva de la pantalla. Los accesos desde el detalle de cuenta y de tarjeta (filas, CTA de alta, pago de resumen) SHALL apuntar a las rutas canónicas con esos params.

#### Scenario: Una sola URL por movimiento

- **WHEN** el usuario abre un movimiento desde el listado global o desde la lista de una cuenta
- **THEN** llega a `/transactions/<id>`, la misma URL en ambos casos
- **AND** el `?from=` ajusta sólo el back-nav (al listado global, a la cuenta o a la tarjeta de origen)

#### Scenario: Alta pre-seleccionando una cuenta

- **WHEN** el usuario toca "registrar" desde el detalle de una cuenta o "registrar consumo" desde una tarjeta
- **THEN** se abre `/transactions/new?account=<id>` con esa cuenta ya elegida en el selector
- **AND** si la cuenta es una tarjeta de crédito, el formulario arranca en el tipo Gasto
- **AND** al guardar vuelve al origen indicado por `?from=` (la cuenta o la tarjeta), o a `/transactions` si no hay origen

#### Scenario: Las rutas scoped ya no existen

- **WHEN** se intenta acceder a `/accounts/<id>/transactions/...`
- **THEN** la ruta no existe (404); el árbol fue eliminado y los enlaces internos apuntan a las rutas canónicas

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

El saldo corriente SHALL mostrarse cuando se ven los movimientos de la cuenta en orden, **incluida la navegación por mes**: navegar de mes es navegación temporal, no un filtro de contenido, y el saldo se recalcula sobre el historial previo al mes visible. Los **filtros de contenido** (búsqueda de texto, tipo, categoría, rango de monto) SÍ ocultan el saldo corriente, porque saltean filas y un acumulado parcial sería incorrecto. En la perspectiva global el saldo corriente NO SHALL mostrarse (mezclaría cuentas y monedas).

#### Scenario: Cada fila muestra el saldo resultante por moneda

- **WHEN** el usuario abre el detalle de una cuenta sin filtros de contenido
- **THEN** cada fila muestra el saldo de la cuenta en la moneda del movimiento, resultante después de ese movimiento

#### Scenario: Navegar por mes no oculta el saldo corriente

- **WHEN** el usuario navega a otro mes en el detalle de la cuenta (sin filtros de contenido)
- **THEN** el saldo corriente se sigue mostrando, recalculado con el historial previo al mes visible

#### Scenario: Los filtros de contenido ocultan el saldo corriente

- **WHEN** el usuario aplica un filtro de tipo, categoría, búsqueda de texto o rango de monto en el detalle de la cuenta
- **THEN** el saldo corriente por fila se oculta

#### Scenario: El listado global no muestra saldo corriente

- **WHEN** el usuario abre `/transactions`
- **THEN** las filas no muestran saldo corriente

### Requirement: El usuario puede declarar un reintegro al registrar un gasto

Al registrar un gasto, el usuario SHALL poder declarar opcionalmente que ese gasto tiene un reintegro asociado, mediante un bloque "Tiene reintegro". Al activarlo, el usuario SHALL indicar el **monto esperado**, el **subtipo** (a cuenta / en resumen) y si el reintegro **ya fue recibido** o queda pendiente. El sistema SHALL crear el gasto y el reintegro en una **operación atómica**: si la creación del reintegro falla, el gasto tampoco se crea.

El subtipo "en resumen" SHALL ofrecerse únicamente cuando el gasto es sobre una tarjeta de crédito; "a cuenta" SHALL estar disponible para cualquier medio de pago, y SHALL ser el default.

Para el subtipo "a cuenta", la cuenta de acreditación SHALL prerellenarse con una cuenta del **mismo banco/institución** que la cuenta del gasto, cuando exista (refleja el comportamiento real); el usuario puede cambiarla.

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

Razón: las acciones del listado (buscar, ver recurrencias, filtrar) viven en una **micro-toolbar pegada al listado** especificada en el próximo requirement, donde tienen contexto inmediato con la lista sobre la que operan. El único selector de mes vive dentro del card del `CategorySpendingOverview`. El acceso para registrar **en mobile-web** pasa por el FAB definido más abajo en esta spec. **En desktop-web** el FAB NO se renderiza y el encabezado pelado tampoco ofrece CTA: el acceso primario para registrar desde desktop-web se cumple desde el header del dashboard (botón "Nuevo movimiento", spec de `dashboard`) o navegando directo a `/transactions/new`; restaurar un CTA en este encabezado para desktop-web es follow-up explícito fuera de alcance de esta spec.

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
- **AND** el acceso para registrar en ese viewport se cumple desde el header del dashboard o navegando directo a `/transactions/new`
- **AND** restaurar un CTA en este encabezado para desktop-web es follow-up explícito fuera de alcance

---

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

Mientras la pantalla `/transactions/new` mobile **no exista**, el FAB nativo SHALL renderizarse en estado **disabled**: SHALL mantener su aspecto visual (forma, color, ícono) con `opacity-50` y `accessibilityState.disabled = true`, NO SHALL responder al press, y NO SHALL ejecutar `router.push('/transactions/new')`. El destino de navegación (`/transactions/new`) SHALL estar declarado en el componente para que habilitarlo cuando llegue la pantalla sea un cambio mínimo (flip de un constante / borrado del flag).

La pantalla `dashboard` SHALL reservar padding inferior en su `ScrollView` (`pb-28` o equivalente) para que el FAB nativo no tape la última sección al scrollear. La pantalla `transactions` stub actual no necesita padding adicional mientras no tenga contenido scrolleable; cuando llegue contenido SHALL aplicarse la misma reserva.

#### Scenario: FAB visible en dashboard y transactions (mobile native)

- **WHEN** el usuario autenticado abre la pestaña `Dashboard` o `Movimientos` en la app nativa
- **THEN** ve un FAB cuadrado verde de 80 px anclado en la esquina inferior derecha, por encima del tab bar
- **AND** el FAB respeta el safe-area del dispositivo (el tab bar es quien maneja el inset bottom)

#### Scenario: El FAB nativo está disabled mientras no existe `/transactions/new` mobile

- **WHEN** la pantalla `/transactions/new` mobile todavía no fue implementada
- **THEN** el FAB se renderiza con `opacity-50` y `accessibilityState.disabled = true`
- **AND** un tap sobre el FAB NO ejecuta `router.push('/transactions/new')`
- **AND** el destino `/transactions/new` está declarado en el código del componente para habilitarlo cuando la pantalla aterrice

#### Scenario: El FAB nativo se habilita cuando aterriza `/transactions/new` mobile

- **WHEN** un change posterior implementa la pantalla `/transactions/new` en la app nativa y flippea el flag del FAB
- **THEN** el FAB pierde la opacidad reducida y el `accessibilityState.disabled`
- **AND** un tap navega a `/transactions/new`

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

