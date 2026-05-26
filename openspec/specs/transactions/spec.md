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

El período SHALL navegarse **por mes** (mes anterior / mes siguiente) como control primario; por defecto SHALL mostrarse el **mes actual** (computado en la zona horaria financiera con `getTodayAR()`), conservando una opción de rango personalizado que tiene prioridad sobre el mes. En **modo novato** el filtro por cuenta NO SHALL mostrarse.

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

#### Scenario: Filtrar por cuenta solo en modo experto

- **WHEN** un usuario experto filtra por una cuenta específica
- **THEN** el sistema muestra movimientos donde esa cuenta participa como origen, destino, cuenta de pago o tarjeta relacionada según el tipo funcional del movimiento
- **AND** en modo novato el filtro por cuenta no se ofrece

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

El sistema SHALL mostrar el detalle completo de una transacción: fecha, monto, moneda, tipo, cuenta, descripción, y los campos extra según el tipo — categoría/subcategoría (income/expense), cuenta destino (transfer) o signo (adjustment).

#### Scenario: Acceso al detalle

- **WHEN** el usuario toca una transacción en la lista
- **THEN** el sistema navega a la pantalla de detalle con todos los campos visibles

#### Scenario: Detalle de transferencia muestra la cuenta destino

- **WHEN** el usuario abre el detalle de una transferencia
- **THEN** el sistema muestra la cuenta origen y la cuenta destino con sus nombres respectivos

#### Scenario: Detalle de ajuste muestra el signo

- **WHEN** el usuario abre el detalle de un ajuste con `amount = -30`
- **THEN** el sistema muestra el monto `-$30` con indicación visual de que es una resta

#### Scenario: Transacción de otro usuario no es accesible

- **WHEN** el usuario intenta acceder directamente a la URL de una transacción que no le pertenece
- **THEN** el sistema retorna `notFound()` (la RLS filtra la fila; la página renderiza 404)

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

### Requirement: El usuario puede crear una regla recurrente al registrar un movimiento

El sistema SHALL permitir que el usuario marque como recurrente un movimiento al registrarlo. La recurrencia SHALL ser una regla separada del movimiento real y SHALL conservar los datos necesarios para generar futuras instancias: tipo funcional, cuenta o tarjeta, cuenta destino cuando aplique, moneda, monto, categoria cuando aplique, descripcion, frecuencia, fecha de inicio y fecha final opcional.

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

El detalle global de un movimiento (`/transactions/<transaction_id>`) SHALL ofrecer las acciones de Editar y Eliminar, sin obligar al usuario a navegar primero al detalle en contexto de cuenta. Estas acciones SHALL respetar exactamente las mismas reglas de edición y eliminación ya definidas para el detalle en-cuenta (campos mutables por tipo, propagación en compras en cuotas, bloqueos por estado `paid`). Ningún movimiento accesible desde el listado global SHALL quedar sin camino para editarse o eliminarse.

#### Scenario: Editar desde el detalle global

- **WHEN** el usuario abre un ingreso, gasto, transferencia o ajuste desde `/transactions` y elige "Editar"
- **THEN** el sistema abre el formulario de edición con los campos mutables según el tipo del movimiento
- **AND** al guardar, recalcula los saldos afectados y vuelve al origen global

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
- **THEN** el sistema rechaza la operación con el mismo criterio que en el detalle en-cuenta
- **AND** no se produce ningún cambio de estado ni de saldo

### Requirement: El usuario puede registrar un movimiento desde el módulo global

El módulo global de Movimientos (`/transactions`) SHALL ofrecer un punto de entrada para registrar un nuevo movimiento, de modo que el usuario no esté obligado a entrar primero a una cuenta para cargar un ingreso, gasto, transferencia o ajuste.

#### Scenario: Punto de entrada visible en el módulo global

- **WHEN** el usuario autenticado abre `/transactions`
- **THEN** ve una acción para registrar un nuevo movimiento
- **AND** al activarla accede al flujo de registro de movimiento

#### Scenario: La cuenta se elige dentro del formulario, después del tipo

- **WHEN** el usuario abre el flujo de registro desde el módulo global
- **THEN** el formulario muestra primero el selector de tipo (ingreso/gasto/transferencia/ajuste) y, debajo, la cuenta como un campo que se elige mientras se carga el movimiento (sin un paso previo de selección de cuenta)
- **AND** para gasto, el selector de cuenta incluye tarjetas de crédito; al elegir una, aparecen las cuotas (ARS) o la cotización (USD) inline
- **AND** para ingreso/transferencia/ajuste el selector ofrece solo cuentas de efectivo/banco

#### Scenario: Al registrar desde el módulo global se vuelve al listado

- **WHEN** el usuario guarda un movimiento desde el flujo de registro iniciado en `/transactions`
- **THEN** el sistema lo redirige a `/transactions` (el listado de movimientos), no al detalle de la cuenta ni al de la tarjeta

#### Scenario: El registro respeta las reglas de creación existentes

- **WHEN** el usuario registra un movimiento desde el flujo iniciado en el módulo global
- **THEN** se aplican las mismas validaciones de creación vigentes (moneda activa en la cuenta, monto válido, categoría obligatoria para ingreso/gasto, fecha contable)
- **AND** el movimiento creado aparece en el listado global

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
- **Jerarquía** de texto invertida: el título primario SHALL ser la descripción que escribió el usuario; el subtítulo secundario SHALL ser la categoría y, en modo experto, la cuenta (`categoría · cuenta`). Si el movimiento no tiene descripción, el título primario SHALL caer a la categoría o al nombre funcional del tipo.
- **Color del monto** semántico: ingreso en verde; gasto (incluidos consumos y cuotas de tarjeta) en rojo; ajuste positivo en verde y negativo en rojo; transferencia y cambio de moneda en color neutro (no son ingreso ni gasto).
- **Etiqueta de moneda** fiel al principio bimoneda: ARS no SHALL llevar etiqueta de moneda (es la primaria); USD SHALL mostrarse etiquetada.

La cuenta en el subtítulo SHALL mostrarse únicamente en modo experto; en modo novato se omite.

#### Scenario: Un gasto muestra el emoji y color de su categoría

- **WHEN** el sistema renderiza un gasto categorizado como "Comida"
- **THEN** la fila muestra el emoji y color de esa categoría como ícono
- **AND** el monto se muestra en rojo

#### Scenario: Una transferencia muestra ícono neutro

- **WHEN** el sistema renderiza una transferencia
- **THEN** la fila muestra un ícono de estructura neutro (no un emoji de categoría)
- **AND** el monto se muestra en color neutro

#### Scenario: La descripción es el título primario

- **WHEN** el usuario registró un gasto "Coto" categorizado como "Comida"
- **THEN** la fila muestra "Coto" como título primario y "Comida" como subtítulo

#### Scenario: Sin descripción el título cae a la categoría

- **WHEN** el sistema renderiza un gasto sin descripción categorizado como "Transporte"
- **THEN** la fila muestra "Transporte" como título primario

#### Scenario: La cuenta en el subtítulo depende del modo

- **WHEN** un usuario en modo experto ve un gasto en el listado global
- **THEN** el subtítulo incluye la cuenta (`categoría · cuenta`)
- **AND** el mismo gasto para un usuario en modo novato muestra solo la categoría

#### Scenario: La etiqueta de moneda respeta bimoneda

- **WHEN** el sistema renderiza un movimiento en ARS y otro en USD
- **THEN** el de ARS no muestra etiqueta de moneda y el de USD se muestra etiquetado como USD

---

### Requirement: La fila de movimiento muestra marcadores de estado

El sistema SHALL mostrar en la fila los marcadores de estado aplicables al movimiento, sin alterar su impacto contable:

- **Recurrencia**: indicador cuando el movimiento fue generado por una regla recurrente.
- **Revisión**: indicador cuando el movimiento tiene flags de revisión (sin categoría, cotización faltante).
- **Cuota**: para una cuota de tarjeta, la posición de la cuota (`3/6`).
- **Pendiente**: para un consumo de tarjeta cuyo período aún no fue pagado.

Los marcadores de recurrencia y revisión SHALL aparecer tanto en el listado global como en el de cuenta. Los grupos de fecha del listado SHALL usar etiquetas relativas ("Hoy", "Ayer") y fecha para días anteriores.

#### Scenario: Movimiento recurrente y a revisar conservan sus marcadores en ambas vistas

- **WHEN** un gasto generado por una recurrencia y sin categoría se muestra en `/transactions` y en el detalle de su cuenta
- **THEN** en ambas vistas la fila muestra el indicador de recurrencia y el de revisión

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

