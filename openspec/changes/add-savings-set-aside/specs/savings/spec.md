## ADDED Requirements

### Requirement: Guardar es una decisión del usuario y vive fuera del ledger

El sistema SHALL permitir al usuario **guardar** un monto en una moneda —declarar que esa parte de su dinero no la va a gastar— y **liberarlo**. Guardar NO SHALL mover dinero, NO SHALL crear ninguna fila en `transactions` y NO SHALL generar ningún movimiento visible en el módulo Movimientos: cambia la **función** de plata que el usuario ya tiene, no su ubicación.

Las decisiones SHALL registrarse en una tabla propia `availability_reserve`, con RLS por `user_id`, cuyas filas llevan **monto con signo** (guardar positivo, liberar negativo), `currency_code` y una **fecha contable**. El total guardado SHALL derivarse de la suma de sus filas y NO SHALL persistirse en ninguna columna, igual que todo saldo en Grana.

El nombre técnico es deliberado: lo que la tabla registra es una **reserva de disponibilidad** —"de la plata que hoy podría gastar, decidí no tocar este monto"— y NO un concepto patrimonial. Un plazo fijo o una tenencia en dólares NO SHALL registrarse acá.

#### Scenario: Guardar no genera un movimiento

- **WHEN** el usuario guarda $200.000 en pesos
- **THEN** se registra una fila en `availability_reserve` con `amount = 200000` y la fecha de hoy
- **AND** no se crea ninguna fila en `transactions`
- **AND** el listado de Movimientos no muestra ninguna entrada nueva
- **AND** los saldos de todas sus cuentas quedan sin cambios

#### Scenario: Liberar es la operación simétrica

- **WHEN** el usuario libera $50.000 de un guardado de $200.000
- **THEN** se registra una fila con `amount = -50000`
- **AND** el total guardado pasa a $150.000, derivado de la suma

#### Scenario: El usuario solo accede a sus propias reservas

- **WHEN** un usuario intenta leer o escribir filas de `availability_reserve` de otro usuario
- **THEN** RLS bloquea la operación

---

### Requirement: El guardado es por moneda y no se ancla a una cuenta

El sistema SHALL registrar cada reserva en **una** moneda. NO SHALL existir un "guardado total" que sume ARS y USD, en ningún cálculo ni en ninguna pantalla, en línea con el invariante bimoneda.

Una reserva NO SHALL anclarse a una cuenta. Anclarla afirmaría que ese dinero está en un lugar puntual, cuando en realidad está repartido en todas las cuentas del usuario: sería simular un movimiento que no ocurrió.

En consecuencia, cuando el guardado se muestre junto a un listado de cuentas, SHALL renderizarse como **línea del grupo** y NUNCA adosado a la fila de una cuenta.

#### Scenario: Guardado en las dos monedas

- **WHEN** el usuario tiene guardados $200.000 y US$ 500
- **THEN** cada moneda muestra su propio total
- **AND** no existe ninguna lectura que los sume

---

### Requirement: El disponible real y el flujo reservado son lectura única en SQL

El sistema SHALL exponer el disponible real y el flujo reservado del período como **funciones de Postgres**, y toda superficie —web, mobile y las agregaciones del dashboard— SHALL consumirlas sin recomponer la resta por su cuenta:

- `get_available_sums(p_today)` SHALL devolver, **por moneda**: el neto de las cuentas propias cortado a la fecha, lo reservado vigente, y el **disponible real** ya calculado.
- `get_reserve_flow_sums(p_from, p_to)` SHALL devolver, **por moneda**, el **neto reservado** en el rango (guardado menos liberado).

Es la misma regla que estableció la migración `0051` para el criterio de "cuenta propia": ese predicado estaba replicado a mano en cada call site y **ya había divergido** en producción. Un concepto de plata, una definición. `get_available_sums` tiene tres consumidores —el Hero, el tope del alta y la validación del write path—, de modo que derivar la resta por separado en cada uno garantiza la divergencia.

Estas funciones NO SHALL modificar `get_owned_account_ids()` ni `get_account_balance_sums`: componen sobre ellas.

#### Scenario: Todas las superficies leen el mismo disponible

- **WHEN** el usuario tiene $1.800.000 en cuentas propias y $200.000 guardados
- **THEN** `get_available_sums` devuelve `accounts_net = 1800000`, `reserved = 200000` y `available = 1600000`
- **AND** el Hero, el drawer y la validación del alta muestran y usan ese mismo `1600000`

#### Scenario: El flujo del mes no es el stock acumulado

- **WHEN** el usuario venía con $200.000 guardados de meses anteriores y este mes guarda $150.000 y libera $50.000
- **THEN** `get_reserve_flow_sums` del mes devuelve `reserved_net = 100000`
- **AND** el total guardado que devuelve `get_available_sums` es $300.000

---

### Requirement: Guardar tiene tope en el disponible y liberar tiene piso en lo guardado; gastar no tiene ninguno

El sistema SHALL rechazar una operación de guardar cuyo monto supere el **disponible real** de esa moneda al momento de la operación. La validación SHALL ejecutarse en el write path y NO SHALL depender de que la UI la haya aplicado.

Es la diferencia deliberada con el ledger: un saldo negativo es un **hecho** válido que Grana muestra tal cual, pero guardar más de lo que se tiene no es un estado incómodo — es un **input inválido**.

El sistema SHALL rechazar una operación de liberar cuyo monto supere el **total guardado vigente** de esa moneda. El stock guardado NO SHALL poder quedar negativo: un guardado negativo haría que el disponible **supere** el saldo de las cuentas, es decir, que Grana afirme que el usuario puede gastar plata que no tiene. Es el mismo criterio que el tope de guardar, del otro lado.

Recíprocamente, cuando el gasto posterior lleva el disponible por debajo de cero, el sistema SHALL mostrar el disponible negativo tal cual, con el aviso no bloqueante que ya rige para el resto de las operaciones, y **NO SHALL reducir el guardado** para que el número cierre: sería revocar en silencio una decisión que el usuario no revocó.

#### Scenario: Guardar más de lo disponible es rechazado

- **WHEN** el usuario tiene $300.000 disponibles en pesos e intenta guardar $500.000
- **THEN** la operación es rechazada con un mensaje que indica cuánto tiene disponible
- **AND** no se registra ninguna fila

#### Scenario: Liberar más de lo guardado es rechazado

- **WHEN** el usuario tiene $200.000 guardados en pesos e intenta liberar $300.000
- **THEN** la operación es rechazada
- **AND** el total guardado sigue siendo $200.000

#### Scenario: Gastar sobre el guardado deja el disponible negativo

- **WHEN** el usuario tiene $350.000 en cuentas y $200.000 guardados, y registra un gasto de $200.000
- **THEN** el disponible real queda en `-$50.000` y se muestra tal cual
- **AND** el total guardado sigue siendo $200.000
- **AND** el sistema avisa sin bloquear que está usando lo que había guardado

---

### Requirement: Las reservas se cortan a la fecha, como todo número de plata

El sistema SHALL aplicar a las reservas el mismo **corte temporal** que al resto: una reserva con fecha posterior al día de corte NO SHALL participar del disponible ni del flujo del período. La fecha de corte SHALL calcularse en la zona horaria financiera del usuario, nunca con el reloj del servidor.

#### Scenario: Una reserva futura no afecta el disponible de hoy

- **WHEN** existe una reserva fechada mañana
- **THEN** el disponible de hoy no la descuenta

---

### Requirement: El alta de guardado es contextual y no pide lo que puede inferir

El sistema SHALL ofrecer el alta de guardado en un **drawer**. Cuando el alta se origina en un ingreso recién registrado, el drawer SHALL **heredar la moneda de ese ingreso**, prellenar el monto con el porcentaje sugerido y NO SHALL preguntar la fecha, que es hoy por definición del acto. Abierto fuera de ese contexto, SHALL ofrecer la moneda **solo si el usuario tiene saldo en más de una**, y la fecha con hoy por defecto.

El drawer SHALL mostrar el cálculo **al momento de la operación** —disponible actual, monto a guardar, remanente— y NO SHALL calcularlo contra el monto del ingreso: eso implicaría que la reserva sale de ese movimiento, y una reserva es fungible y no pertenece a ninguno.

Abierto desde la vista de detalle —que es **por moneda**— el drawer SHALL heredar esa moneda y NO SHALL ofrecer elegirla. Abierto suelto NO SHALL prellenar ningún monto: sin un ingreso del cual sacar el porcentaje, un número prellenado sería una cifra recomendada por Grana, que es justamente lo que el producto no hace.

**Liberar NO SHALL pedir una cuenta de destino, y el copy SHALL decir explícitamente que la plata no se mueve.** Es el punto donde el modelo se puede malentender: los verbos *guardar* y *liberar* suenan a mover, y el usuario puede esperar elegir adónde va. No va a ninguna parte — estuvo todo el tiempo en las mismas cuentas. Lo único que cambia es cuánto de eso Grana cuenta como gastable. Un selector de cuenta ahí enseñaría el modelo equivocado en el momento exacto en que el usuario lo está aprendiendo.

El copy NO SHALL sugerir que hubo una transferencia. Grana **nunca inventa un movimiento financiero para representar una intención**.

#### Scenario: Guardar desde un ingreso no pregunta moneda ni fecha

- **WHEN** el usuario llega al drawer desde un ingreso en pesos
- **THEN** la moneda es pesos y no se ofrece elegirla
- **AND** no se pide la fecha
- **AND** el monto viene prellenado con el porcentaje sugerido

#### Scenario: Liberar no pregunta adónde va la plata

- **WHEN** el usuario libera $50.000 de su guardado en pesos
- **THEN** el drawer no ofrece elegir una cuenta de destino
- **AND** el copy dice que esa plata vuelve a estar disponible para gastar, sin moverse de donde está
- **AND** ningún saldo de cuenta cambia

#### Scenario: Abierto suelto, el monto viene vacío

- **WHEN** el usuario abre el drawer de Guardar desde la vista de detalle, sin venir de un ingreso
- **THEN** el monto viene vacío
- **AND** la moneda es la de la vista de detalle y no se ofrece elegirla

#### Scenario: El cálculo es del momento, no del cierre del mes

- **WHEN** el usuario abre el drawer el día 5, con $2.000.000 arrastrados y un ingreso de $2.000.000 recién registrado
- **THEN** el drawer muestra $4.000.000 disponibles, no el saldo que tendrá a fin de mes

---

### Requirement: Grana sugiere guardar después de un ingreso, como máximo una vez por mes

El sistema SHALL ofrecer guardar mediante una tira contextual después de que el usuario registre un `income`, **por cualquier camino** —confirmando una instancia recurrente o cargándolo a mano—, y **como máximo una vez por mes calendario**. Un `reimbursement` NO SHALL disparar la sugerencia.

La tira SHALL servirse desde el módulo `guidance`, de modo que su ciclo de vida por usuario (visto, descartado, completado) quede registrado y la sugerencia deje de aparecer si el usuario la descarta.

El monto sugerido SHALL derivarse del **porcentaje** usado la vez anterior —no del importe— y la primera vez SHALL ser el 10% del ingreso. NO SHALL existir una pantalla de configuración para esto.

El copy SHALL formular una **propuesta de comportamiento**, no una recomendación financiera: el monto se presenta como *sugerido*, no como la cifra que Grana aconseja guardar.

#### Scenario: La sugerencia aparece una sola vez por mes

- **WHEN** el usuario registra dos ingresos en el mismo mes
- **THEN** la tira se ofrece solo con el primero

#### Scenario: El porcentaje se recuerda, no el importe

- **WHEN** el usuario guardó el 10% de un ingreso de $2.000.000 en agosto
- **AND** en septiembre registra un ingreso de $2.500.000
- **THEN** la sugerencia es $250.000

#### Scenario: Un reintegro no dispara la sugerencia

- **WHEN** el usuario registra un reintegro recibido
- **THEN** no se ofrece guardar

---

### Requirement: El guardado tiene una vista de detalle, y no entra en la navegación

El sistema SHALL exponer una vista de detalle del guardado con: el **total guardado por moneda** (stock), el **neto del mes en curso** (flujo) y el **historial** de reservas y liberaciones con su fecha. La vista SHALL ofrecer las acciones Guardar y Liberar.

Se SHALL llegar a ella **tocando la fila de guardado del dashboard**, y esa fila SHALL estar presente en el mes corriente sin importar si el usuario guardó algo o no. NO SHALL agregarse una entrada nueva a la navegación de la app.

La vista SHALL presentarse como **overlay sobre el dashboard** —`Drawer` lateral en web, `BottomSheet` en nativo— y NO SHALL tener ruta propia ni cambiar la URL. Es el mismo mecanismo con el que ya se edita una cuenta desde la lista. Que no entre a la navegación no es una postura de producto: no hay ninguna dirección a la que ir.

La vista existe por una razón de fondo: como guardar no es un movimiento, **no aparece en Movimientos**, y sin este detalle el usuario no podría auditar su propia decisión — lo que contradiría el pilar de confianza contable.

El historial SHALL incluir las operaciones de meses anteriores, pero la vista NO SHALL seguir el selector de mes del dashboard ni presentar ese historial como una reconciliación mensual. *"Guardaste $200.000 en mayo"* es un **dato histórico** y NO SHALL restarse del saldo al cierre de mayo en ninguna superficie: el saldo al cierre de un mes es un hecho del ledger, y una decisión tomada en mayo —que el usuario pudo haber revertido en junio— no puede deformarlo hacia atrás. La reconciliación del guardado vive en el mes corriente y en ningún otro.

#### Scenario: El historial pasado no deforma un mes cerrado

- **WHEN** el usuario guardó $200.000 en mayo y navega el dashboard a mayo
- **THEN** el historial de la vista de detalle sigue mostrando esa operación con su fecha
- **AND** el saldo al cierre de mayo que muestra la card es el mismo que sería si nunca hubiera guardado

#### Scenario: El historial distingue stock de flujo

- **WHEN** el usuario venía con $200.000 guardados y este mes guardó $150.000
- **THEN** la vista muestra $350.000 como total y `+$150.000` como neto del mes
- **AND** el historial lista las dos operaciones con su fecha
