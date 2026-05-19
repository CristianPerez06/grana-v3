# transactions Specification

## Purpose
TBD - created by archiving change add-transactions-income-expense. Update Purpose after archive.
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

El sistema SHALL permitir filtrar el listado global de movimientos por texto, período, tipo de movimiento, categoría y cuenta. Los filtros SHALL estar representados en la URL para que la pantalla sea compartible, recargable y navegable con back/forward del browser.

#### Scenario: Buscar por descripción

- **WHEN** el usuario ingresa texto en la búsqueda
- **THEN** el sistema filtra movimientos cuya descripción o texto funcional visible coincida con la búsqueda
- **AND** mantiene el término de búsqueda en la URL

#### Scenario: Filtrar por período

- **WHEN** el usuario filtra por mes actual, mes pasado, año actual o rango personalizado
- **THEN** el sistema muestra solamente movimientos cuya fecha contable esté dentro del período
- **AND** interpreta las fechas como `financial_date`, no como timestamp UTC

#### Scenario: Filtrar por cuenta

- **WHEN** el usuario filtra por una cuenta específica
- **THEN** el sistema muestra movimientos donde esa cuenta participa como origen, destino, cuenta de pago o tarjeta relacionada según el tipo funcional del movimiento

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

### Requirement: El usuario puede revertir un pago de resumen

El sistema SHALL exponer una operación `reverseCardPayment(paymentId)` que ejecute, en una única transacción DB:

1. UPDATE `status='pending'` de todas las transacciones con `card_period_id = payment.period_id` que estaban en `paid`.
2. DELETE de la fila en `period_payments`.
3. DELETE de la transacción `expense` original del pago.

El período "siguiente" creado durante el pago NO SHALL borrarse automáticamente — vive como `card_periods` independiente y el usuario puede borrarlo manualmente si está `open` y vacío.

#### Scenario: Reversión limpia de pago reciente

- **WHEN** el usuario revierte un pago que marcó las cuotas del período X como paid
- **THEN** todas las cuotas vuelven a `status='pending'`
- **AND** la fila en `period_payments` se elimina
- **AND** el expense que registró el pago se elimina, recuperando el saldo de la cuenta de pago

#### Scenario: Período siguiente creado durante el pago sobrevive a la reversión

- **WHEN** el usuario revierte un pago que había generado el período siguiente Y
- **THEN** la reversión no toca el `card_periods` del período Y
- **AND** si Y tiene transacciones imputadas, esas transacciones se conservan

#### Scenario: Reversión falla si hay tx imputadas al período siguiente Y, no — la reversión sigue siendo válida

- **WHEN** el período Y creado durante el pago tiene una transacción imputada (un consumo nuevo entre el pago y la reversión)
- **THEN** la reversión se ejecuta exitosamente
- **AND** Y queda intacto con su transacción

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

