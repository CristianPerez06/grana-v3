## ADDED Requirements

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

## MODIFIED Requirements

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
