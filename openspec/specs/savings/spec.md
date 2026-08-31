# savings Specification

## Purpose

Define **«Ahorro e inversión»**: el módulo donde el usuario aparta parte de lo que tiene para no
gastarlo, le pone un propósito, y lo vuelve a usar cuando quiere. Cubre las tres piezas del modelo
que hoy existen — **guardar** (apartar y liberar, por moneda), **propósitos** (repartir lo guardado
en etiquetas con nombre) y el **módulo** con su ruta y su superficie propia en las dos apps.

Dos invariantes lo gobiernan y explican casi todas las reglas de abajo:

- **Guardar NO es un movimiento.** Vive fuera del ledger, en su propia tabla y sin `account_id`: una
  reserva no está en ninguna cuenta. No crea filas en `transactions`, no cambia el saldo de nada, y
  no aparece en Movimientos. Lo único que cambia es **cuánto de lo que hay se puede gastar**.
- **El disponible es una resta, no una función.** `disponible = saldo de cuentas propias − guardado`
  es un hecho sobre la plata, así que se calcula una sola vez y en SQL, y todos los consumidores leen
  ese número en vez de recomponerlo.

Un propósito es **solo una etiqueta**: destinar y quitar destino no mueven plata ni cambian el
disponible. Lo único que sí lo cambia es guardar y volver a usar.

## Requirements

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
- `get_reserve_flow_sums(p_from, p_to)` SHALL devolver, **por moneda**, el **neto reservado** en el rango (guardado menos liberado). Lo consume la **vista de detalle**, no la card: el resumen del mes muestra el stock.

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

**Liberar NO SHALL pedir una cuenta de destino, y el copy SHALL decir explícitamente que la plata no se mueve.** Es el punto donde el modelo se puede malentender: el usuario puede esperar elegir adónde va.

Por lo mismo, la UI NO SHALL llamar a esta operación *"Sacar"*, *"Retirar"* ni ningún verbo que la gente use para **retirar plata del banco**: sugerir movimiento es exactamente la confusión que el modelo combate. El verbo de la UI es **"Volver a usar"** —dice lo que pasa, que esa plata vuelve a contar como gastable— mientras que en el código la operación se sigue llamando `releaseAvailability`. No va a ninguna parte — estuvo todo el tiempo en las mismas cuentas. Lo único que cambia es cuánto de eso Grana cuenta como gastable. Un selector de cuenta ahí enseñaría el modelo equivocado en el momento exacto en que el usuario lo está aprendiendo.

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

### Requirement: Grana sugiere guardar después de un ingreso, una vez por ingreso

El sistema SHALL ofrecer guardar mediante una tira contextual después de que el usuario registre un `income`, **por cualquier camino** —confirmando una instancia recurrente o cargándolo a mano—, y **una vez por cada ingreso**. Un `reimbursement` NO SHALL disparar la sugerencia: plata que vuelve no es plata que llega.

La cadencia es por ingreso y no por mes calendario porque el anti-nagging protege contra que a alguien le pregunten **cuando no pasó nada**, y acá sí pasó algo. Dos sueldos —una quincena, un freelance que factura varias veces— son **dos decisiones distintas**, y ofrecer solo la primera se pierde la mitad de los momentos en que la persona está dispuesta a decidir.

La tira SHALL ofrecer **tres salidas, y ninguna permanente**:

| Acción | Efecto |
|---|---|
| Guardar | guarda el monto y vuelve con el próximo ingreso |
| *Ahora no* | se va y vuelve con el próximo ingreso |
| *Suficiente por este mes* | se va hasta el mes siguiente |

NO SHALL existir un apagado permanente, y no hace falta: la cadencia más lenta que la tira puede tener es **una vez por mes**, que no es nagging. Un apagado definitivo a un toque se presiona sin querer y la función desaparece para siempre sin que el usuario lo haya decidido.

La tira SHALL servirse desde el módulo `guidance`, con dos cortes que significan cosas distintas: `seen_at` es **cuándo se mostró por última vez** y se compara contra el `created_at` del ingreso, de modo que un ingreso posterior la vuelve a habilitar y el mismo ingreso no la repite; `dismissed_at` es *"suficiente por este mes"* y silencia **solo ese mes** — deliberadamente NO es el "para siempre" que la columna significa en el resto de `guidance`. `completed_at` NO SHALL usarse nunca acá: mataría una sugerencia recurrente.

El monto sugerido SHALL calcularse sobre **el ingreso que la disparó** —el último cargado—, nunca sobre el total del mes: el total incluye plata que el usuario ya gastó, y proponer una parte de eso da un número que no se corresponde con ningún acto.

"El último cargado" SHALL resolverse por `created_at` y NO por fecha contable, y NO SHALL acotarse al mes en curso. Un ingreso viejo registrado hoy —poner al día atrasos— es plata que **sí está en el disponible de hoy**, así que negarle la propuesta sería preciosista: el usuario acaba de registrar plata y el momento de decidir es ese. Lo único que queda afuera es el **futuro**: un ingreso fechado mañana existe pero todavía no es un hecho, y no dispara nada.

El monto SHALL derivarse del **porcentaje** usado la vez anterior —no del importe— y la primera vez SHALL ser el 10%. NO SHALL existir una pantalla de configuración para esto.

El copy SHALL formular una **propuesta de comportamiento**, no una recomendación financiera: el monto se presenta como *sugerido*, no como la cifra que Grana aconseja guardar.

#### Scenario: Dos ingresos en el mismo mes, dos sugerencias

- **WHEN** el usuario cobra una quincena el 5 y otra el 20
- **THEN** la tira se ofrece con cada una
- **AND** no se repite con el mismo ingreso

#### Scenario: "Suficiente por este mes" baja la cadencia sin apagar la función

- **WHEN** el usuario toca "Suficiente por este mes" el 5 de agosto y cobra de nuevo el 20
- **THEN** la tira no aparece en agosto
- **AND** vuelve a aparecer con el primer ingreso de septiembre

#### Scenario: El porcentaje se recuerda, no el importe

- **WHEN** el usuario guardó $200.000 de un ingreso de $2.000.000
- **AND** después registra un ingreso de $2.500.000
- **THEN** la sugerencia es $250.000

#### Scenario: La base es el ingreso, no el mes

- **WHEN** en el mes ya habían entrado $1.000.000 y el usuario registra un sueldo de $5.000.000
- **THEN** la sugerencia se calcula sobre $5.000.000

#### Scenario: Un ingreso viejo cargado hoy también propone

- **WHEN** el usuario registra hoy una factura cobrada el mes pasado
- **THEN** la tira se ofrece sobre ese monto

#### Scenario: Un ingreso futuro no propone nada

- **WHEN** el usuario registra un ingreso con fecha del mes que viene
- **THEN** la tira no se ofrece hasta que llegue esa fecha

#### Scenario: Un reintegro no dispara la sugerencia

- **WHEN** el usuario registra un reintegro recibido
- **THEN** no se ofrece guardar

---

La tira SHALL seguir **la moneda del ingreso** que la disparó, y SHALL ser **una sola**.
La tira «¿guardás una parte?» aparece después de cargar un ingreso, **en la moneda de ese ingreso**.
Un ingreso en dólares la despierta igual que uno en pesos.

Cuando hay ingresos en las dos monedas, la tira es UNA sola y ofrece la del ingreso cargado más
recientemente — nunca dos tiras, y nunca una moneda elegida por defecto.

Todo lo que la tira deriva es de esa misma moneda: el disponible que la limita, el historial del que
sale el porcentaje, y el ingreso contra el que ese porcentaje se calculó. Un hábito en una moneda
nunca dicta un monto en la otra.

#### Scenario: Un ingreso en dólares ofrece guardar dólares

- **WHEN** el usuario carga un ingreso en dólares
- **THEN** la tira aparece y propone un monto en dólares
- **AND** al aceptarla, lo guardado se registra en dólares

#### Scenario: Ingresos en las dos monedas

- **WHEN** el usuario cargó un ingreso en pesos y después uno en dólares
- **THEN** se ofrece una sola tira, la de dólares
- **AND** no aparece una segunda tira para los pesos

#### Scenario: El porcentaje no cruza monedas

- **WHEN** la tira propone sobre un ingreso en dólares
- **THEN** el porcentaje sale de lo que el usuario guardó en dólares sobre el ingreso en dólares del
  que lo sacó
- **AND** si nunca guardó en esa moneda, propone el 10% de partida

### Requirement: El guardado tiene una vista de detalle, y no entra en la navegación

El sistema SHALL exponer una vista de detalle del guardado con: el **total guardado por moneda** (stock), el **neto del mes en curso** (flujo) y el **historial** de reservas y liberaciones con su fecha. La vista SHALL ofrecer las acciones **Guardar** y **Volver a usar**.

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

### Requirement: El guardado puede llevar un propósito, y el propósito es solo una etiqueta

El sistema SHALL permitir asociar cada decisión de guardar o volver a usar a un **propósito**: un
nombre y un ícono, propiedad del usuario, registrados en `savings_purpose` con RLS por `user_id`.

Un propósito NO SHALL tener monto objetivo, fecha ni progreso: eso es una **meta** y no pertenece a
esta capability todavía. Un propósito NO SHALL tener moneda — la tienen las reservas que cuelgan de
él, y un mismo propósito SHALL poder acumular en ARS y en USD sin que esas cifras se sumen nunca.

El propósito NO SHALL participar de ningún número del dashboard. `get_available_sums` y
`get_reserve_flow_sums` SHALL devolver exactamente lo mismo con propósitos que sin ellos.

#### Scenario: El propósito no mueve ningún número

- **WHEN** el usuario etiqueta un guardado de $200.000 como "Japón"
- **THEN** el disponible, el guardado total y el flujo del mes quedan sin cambios
- **AND** ningún saldo de cuenta cambia

#### Scenario: Un propósito acumula en dos monedas sin sumarlas

- **WHEN** el usuario guarda $300.000 y US$ 500 en el propósito "Japón"
- **THEN** el detalle muestra $300.000 en la vista de pesos y US$ 500 en la de dólares
- **AND** en ningún lugar aparece un único total que combine las dos

---

### Requirement: Las reservas sin propósito son un grupo con las mismas reglas

El sistema SHALL tratar `purpose_id = NULL` como el grupo **«Sin destino»**, no como una ausencia de
dato. Ese grupo SHALL estar sujeto al mismo piso que cualquier propósito.

Las reservas creadas antes de esta capability SHALL quedar con `purpose_id` en nulo y SHALL leerse
como «Sin destino», sin backfill ni valor por defecto inventado. El sistema NO SHALL obligar al
usuario a elegir un propósito para guardar.

#### Scenario: Lo guardado antes de los propósitos sigue leyéndose

- **WHEN** el usuario tenía $190.000 guardados sin propósito
- **THEN** el detalle los muestra agrupados como «Sin destino»
- **AND** el total guardado sigue siendo $190.000

---

### Requirement: El piso de volver a usar es por propósito y moneda

El sistema SHALL impedir que el guardado de un propósito quede **negativo**, aunque el total guardado
de esa moneda cubra el monto pedido. El límite SHALL leerse del servidor **dentro de la mutación**,
desde una definición única en SQL (`get_purpose_sums`), y NO SHALL recomponerse sumando filas en el
cliente.

El **tope de guardar** NO SHALL volverse por propósito: sigue siendo el disponible de la moneda. Un
propósito no tiene objetivo, así que no hay contra qué toparlo.

Cuando el rechazo sea por el piso de un propósito con nombre, el mensaje SHALL **nombrar el propósito**
y decir su monto — el usuario está mirando un total mayor en la misma pantalla, y un mensaje genérico
se lee como un error del sistema.

Cuando el grupo sea el resto, el sistema NO SHALL llamarlo «lo que tenés guardado»: ese rótulo nombra
el total, y el número es el del resto. SHALL decir **«sin destino»**, salvo que el usuario no tenga
ningún propósito — ahí los dos números son el mismo y «sin destino» sería jerga.

#### Scenario: El total alcanza pero el propósito no

- **GIVEN** "Emergencia" con $150.000 y «Sin destino» con $40.000
- **WHEN** el usuario intenta volver a usar $60.000 desde «Sin destino»
- **THEN** la operación se rechaza indicando el límite de $40.000
- **AND** no se registra ninguna fila

#### Scenario: El mensaje nombra el propósito

- **WHEN** el usuario intenta volver a usar $200.000 desde "Emergencia", que tiene $150.000
- **THEN** el mensaje dice que no puede volver a usar más de lo que tiene guardado **en Emergencia**,
  con el monto

#### Scenario: El rótulo del resto no dice «guardado»

- **GIVEN** $180.000 guardados, de los cuales $55.000 están sin destino
- **WHEN** el usuario abre volver a usar con el resto como origen
- **THEN** el bloque dice **«Sin destino $ 55.000»**, no «Tenés guardado $ 55.000»
- **AND** el rechazo por pasarse dice que no puede volver a usar más de lo que tiene **sin destino**

#### Scenario: Sin propósitos, el resto es el total y se dice así

- **GIVEN** el usuario nunca creó un propósito y tiene $180.000 guardados
- **WHEN** abre volver a usar
- **THEN** el bloque dice **«Tenés guardado $ 180.000»**
- **AND** la palabra «sin destino» no aparece en el formulario

#### Scenario: Guardar no se topea por propósito

- **GIVEN** "Emergencia" con $150.000 y un disponible de $4.000.000
- **WHEN** el usuario guarda $3.000.000 en "Emergencia"
- **THEN** la operación se acepta

---

### Requirement: Borrar un propósito no cambia ningún número

El sistema SHALL devolver a «Sin destino» las reservas de un propósito borrado. Borrar un propósito NO
SHALL borrar ninguna reserva, NO SHALL modificar el total guardado y NO SHALL modificar el disponible.

Antes de borrar, el sistema SHALL informar cuánto dinero se reasigna, **por moneda**.

#### Scenario: La plata sobrevive al borrado de su etiqueta

- **GIVEN** el propósito "Japón" con $300.000 guardados
- **WHEN** el usuario borra el propósito
- **THEN** los $300.000 pasan a «Sin destino»
- **AND** el total guardado y el disponible quedan sin cambios

#### Scenario: El borrado se avisa con el número

- **WHEN** el usuario pide borrar un propósito que tiene plata
- **THEN** se le informa el monto por moneda y que esa plata vuelve a «Sin destino»

---

### Requirement: Los nombres de propósito no se repiten dentro de un usuario

El sistema SHALL rechazar un propósito cuyo nombre coincida con otro del mismo usuario ignorando
mayúsculas y espacios de borde. Dos usuarios distintos SHALL poder tener cada uno un propósito con el
mismo nombre. El sistema SHALL rechazar un nombre vacío.

#### Scenario: El mismo nombre en otra caja no crea un segundo propósito

- **GIVEN** el usuario ya tiene "Emergencia"
- **WHEN** intenta crear "emergencia" o "  EMERGENCIA  "
- **THEN** la operación se rechaza

---

### Requirement: Los propósitos sugeridos no son filas del sistema

El sistema SHALL ofrecer propósitos sugeridos como **copy**, no como filas compartidas. Elegir una
sugerencia SHALL crear un propósito **propiedad del usuario**, renombrable y borrable, y SHALL
continuar con la operación en curso. NO SHALL intercalar un paso de confirmación del nombre: el
nombre y el ícono ya quedaron elegidos al tocar la sugerencia.

El sistema NO SHALL ofrecer una sugerencia cuyo nombre el usuario ya tiene.

#### Scenario: Una sugerencia elegida es del usuario

- **WHEN** el usuario toca la sugerencia "Viaje"
- **THEN** se crea un propósito suyo llamado "Viaje" y la operación continúa
- **AND** puede renombrarlo a "Japón" después, sin restricciones

#### Scenario: No se sugiere lo que ya existe

- **GIVEN** el usuario ya tiene un propósito llamado "Viaje"
- **WHEN** abre el selector de propósitos
- **THEN** "Viaje" no aparece entre las sugerencias

---

### Requirement: El propósito de origen se hereda del contexto

Al volver a usar plata desde un propósito, el sistema NO SHALL pedir que se elija el origen: SHALL
heredarlo del grupo desde el que se abrió la operación.

Cuando la operación se abra desde el total y exista **más de un grupo con saldo**, el sistema SHALL
ofrecer el origen **dentro del mismo formulario**, junto al monto, y NO SHALL interponer una pantalla
previa para elegirlo. SHALL ofrecer únicamente los grupos con saldo en la moneda de la operación. El
sistema NO SHALL repartir el monto entre varios propósitos automáticamente.

#### Scenario: El resto se presenta distinto de un propósito

- **WHEN** el usuario mira el desglose
- **THEN** «Sin destino» aparece separado de la lista de propósitos, sin control de navegación
- **AND** ofrece sus dos acciones —destinar y volver a usar— sin entrar a ninguna vista

#### Scenario: Volver a usar desde un propósito no pregunta

- **WHEN** el usuario abre "Volver a usar" desde el grupo "Emergencia"
- **THEN** no se muestra ningún selector de propósito
- **AND** la fila registrada lleva el propósito "Emergencia"

#### Scenario: Desde el total con varios grupos, se elige sin cambiar de pantalla

- **GIVEN** el usuario tiene saldo en "Emergencia" y en «Sin destino»
- **WHEN** abre "Volver a usar" desde el total
- **THEN** llega directo al formulario, con el origen como chips arriba del bloque de cuentas
- **AND** el chip elegido cambia el tope y el resto sin navegar

#### Scenario: El origen solo ofrece grupos con plata en esa moneda

- **GIVEN** "Viaje" tiene $ 45.000 y US$ 10, y "Estudio" tiene $ 5.000 y nada en dólares
- **WHEN** el usuario está volviendo a usar y pasa el monto a dólares
- **THEN** "Estudio" deja de ofrecerse como origen
- **AND** si estaba elegido, la selección pasa a un grupo con saldo en dólares

---

### Requirement: El propósito se reparte por monto, no se ata a un movimiento

El sistema SHALL permitir **destinar** un monto de lo guardado sin destino hacia un propósito, y
**quitarle el destino** para devolverlo al resto. NO SHALL asociar un propósito a una fila puntual del historial de
guardados: el dinero guardado es fungible y una reserva vieja puede haber sido usada en parte.

Destinar y quitar destino NO SHALL cambiar el total guardado, NO SHALL cambiar el disponible y NO SHALL mover
dinero entre cuentas: lo que entra en un grupo sale de otro.

El verbo de esta acción NO SHALL ser "apartar", que en la app ya significa **guardar**, ni ninguno que
sugiera que el dinero cambia de lugar.

«Sin destino» SHALL derivarse como **el resto** —lo guardado menos lo repartido— y NO SHALL
almacenarse.

#### Scenario: Repartir no mueve ningún total

- **GIVEN** $190.000 guardados, nada repartido
- **WHEN** el usuario destina $150.000 a "Japón"
- **THEN** el total guardado sigue siendo $190.000 y el disponible no cambia
- **AND** "Japón" muestra $150.000 y «Sin destino» $40.000

#### Scenario: Se puede repartir cualquier monto

- **GIVEN** un historial cuyos guardados fueron de $300.000, $600.000 y $200.000
- **WHEN** el usuario quiere decir que $150.000 son para "Japón"
- **THEN** puede hacerlo, sin depender de que exista un movimiento de ese monto

#### Scenario: Quitar el destino devuelve al resto sin sacar del guardado

- **WHEN** el usuario le quita el destino a $50.000 de "Japón"
- **THEN** «Sin destino» sube $50.000 y el total guardado no cambia
- **AND** el disponible no cambia

---

### Requirement: Lo repartido nunca supera lo guardado

El sistema SHALL garantizar, **en la base de datos**, que por moneda la suma repartida entre
propósitos nunca supere el total guardado, y que ningún propósito quede con un reparto negativo. La
garantía NO SHALL depender de que cada camino de escritura la recuerde.

La regla SHALL exigirse también cuando el usuario **vuelve a usar** dinero: retirar del guardado
puede romper el invariante sin tocar ninguna fila de reparto.

#### Scenario: No se puede apartar más de lo guardado

- **GIVEN** $190.000 guardados
- **WHEN** se intenta destinar $200.000 a un propósito
- **THEN** la operación se rechaza

#### Scenario: No se puede volver a usar lo que está repartido

- **GIVEN** $190.000 guardados, de los cuales $150.000 están apartados para "Japón"
- **WHEN** el usuario intenta volver a usar $100.000 sin tocar el reparto
- **THEN** la operación se rechaza
- **AND** volver a usar $40.000 sí se acepta

---

### Requirement: Guardar con un propósito es un solo acto

Cuando el usuario guarde indicando un propósito, el sistema SHALL registrar la reserva y su reparto
**de forma atómica**: o quedan las dos cosas, o no queda ninguna. NO SHALL quedar dinero guardado sin
el reparto que el usuario pidió.

#### Scenario: Si el reparto no se puede registrar, tampoco el guardado

- **WHEN** se guarda con un propósito que no pertenece al usuario
- **THEN** la operación se rechaza entera y no queda ninguna reserva registrada

---

### Requirement: Solo se puede repartir hacia un propósito propio

El sistema SHALL verificar contra la base que el propósito indicado pertenece al usuario, y NO SHALL
apoyarse únicamente en la validación de forma del identificador ni en el rol con el que se ejecute la
operación.

#### Scenario: Un propósito ajeno se rechaza

- **WHEN** se intenta guardar o repartir usando el propósito de otro usuario
- **THEN** la operación se rechaza y no se registra ninguna fila

---

### Requirement: El detalle se organiza por propósito, no por moneda

La vista de detalle del guardado SHALL organizarse por **propósito**, y cada grupo SHALL mostrar sus
montos en todas las monedas en que tenga algo, sin sumarlos y sin convertirlos. NO SHALL partir el
detalle por moneda ni obligar a cambiar de moneda para conocer el total de un propósito.

La elección de moneda SHALL vivir en los formularios de operación, donde determina el tope o el piso
aplicable.

La explicación de la diferencia con el saldo bancario SHALL seguir disponible, y PUEDE presentarse
plegada. El **disponible** NO SHALL competir como número principal de esta vista: el detalle contesta
cuánto hay guardado y para qué; el disponible es el número del dashboard.

#### Scenario: Un propósito bimoneda se lee de una vez

- **GIVEN** "Viaje" con $90.000 y US$ 10
- **WHEN** el usuario abre el detalle del guardado
- **THEN** la fila de "Viaje" muestra los dos montos
- **AND** no aparece ningún número que los combine

#### Scenario: Un propósito de una sola moneda no ocupa de más

- **GIVEN** "Emergencia" con $50.000 y nada en dólares
- **THEN** su fila muestra un solo monto

#### Scenario: La moneda se elige al operar

- **WHEN** el usuario destina un monto
- **THEN** puede elegir la moneda en el formulario
- **AND** el piso mostrado corresponde a la moneda elegida

---

### Requirement: El rótulo lleva la dirección, no el signo

Cuando un rótulo ya exprese la dirección de un flujo, el monto NO SHALL repetirla con un signo
negativo.

#### Scenario: El neto del mes no se muestra en negativo

- **GIVEN** un mes en que se volvió a usar más de lo que se guardó
- **THEN** el rótulo dice "Volviste a usar este mes" y el monto se muestra sin signo negativo

---

### Requirement: Guardar no es una acción de la vista de un propósito

La vista de un propósito SHALL ofrecer únicamente acciones sobre ese grupo: destinarle más, volver a
usar desde él y quitarle el destino. NO SHALL ofrecer guardar, que cambia el total y pertenece a la
vista donde el total está a la vista.

Al guardar, el sistema SHALL permitir elegir el propósito **en el mismo formulario**, sin navegar a
otra pantalla. La pantalla aparte SHALL quedar reservada para crear un propósito nuevo.

#### Scenario: Guardar con propósito en un solo paso

- **WHEN** el usuario abre "Guardar" desde el detalle
- **THEN** puede elegir el propósito entre los que ya tiene, sin cambiar de pantalla
- **AND** «Sin destino» es una de las opciones

#### Scenario: Dentro de un propósito no se guarda

- **WHEN** el usuario abre la vista de "Casa"
- **THEN** las acciones son destinarle más, volver a usar y quitar destino
- **AND** no aparece "Guardar"

---

### Requirement: El origen heredado no se muestra como un campo

Cuando el propósito de una operación quede determinado por el lugar desde el que se entró, el sistema
NO SHALL presentarlo como un campo ni como una fila de la operación. SHALL indicarlo en el título o en
el resumen.

La explicación de la diferencia con el saldo bancario SHALL limitarse a esa conciliación, y NO SHALL
incluir el flujo del período.

#### Scenario: Volver a usar desde un propósito

- **WHEN** el usuario abre "Volver a usar" desde el grupo "Viaje"
- **THEN** el título nombra el origen
- **AND** no aparece ninguna fila de propósito

#### Scenario: La conciliación no incluye el flujo del mes

- **WHEN** el usuario abre la explicación de la diferencia con el banco
- **THEN** ve el saldo bancario, lo guardado y el disponible
- **AND** no ve cuánto guardó o volvió a usar en el período

### Requirement: El ahorro tiene un módulo propio, con entrada de navegación

El sistema SHALL exponer **«Ahorro e inversión»** como destino de navegación propio, alcanzable desde
el menú, con ruta propia y linkeable.

El módulo SHALL ser la **casa de la operatoria**: guardar, volver a usar, destinar, quitar destino,
crear/editar/borrar propósitos. Ninguna otra superficie SHALL alojar esos formularios.

Otras superficies SHALL poder **leer** del módulo —mostrar un número, invitar a entrar— y NO SHALL
operar sobre él. Un módulo sin ese límite no se puede ocultar, apagar ni empaquetar, y el límite se
pierde de a una fila por vez.

#### Scenario: Se llega por navegación, no por un número

- **WHEN** el usuario abre el menú
- **THEN** existe una entrada **Ahorro e inversión** que lleva al módulo
- **AND** la ruta es linkeable y recargable sin pasar por el dashboard

#### Scenario: La operatoria vive en un solo lugar

- **WHEN** el usuario quiere guardar, volver a usar o destinar
- **THEN** el formulario se abre desde el módulo
- **AND** ninguna otra pantalla ofrece esos formularios

#### Scenario: El módulo existe en las dos apps

- **WHEN** el usuario abre Grana en web o en la app nativa
- **THEN** encuentra «Ahorro e inversión» en la navegación de esa app
- **AND** la pantalla tiene el total, el desglose y las tres acciones en las dos
- **AND** la fila de Guardado del dashboard lleva al módulo en las dos, en vez de operar

### Requirement: El módulo muestra la foto por moneda y el bloque de guardado

El módulo SHALL mostrar, **por moneda y sin sumar ARS con USD**, una foto simple con **Para gastar** y
**Guardado**, y el bloque de guardado completo: el total, el desglose **¿Para qué?** con los
propósitos, **«Sin destino»** como resto derivado, y las acciones de guardar, volver a usar y
destinar.

El módulo NO SHALL mostrar bloques, CTAs deshabilitados ni placeholders de funcionalidad que todavía
no existe.

#### Scenario: Las dos monedas no se suman

- **GIVEN** el usuario tiene $180.000 y US$ 10 guardados
- **WHEN** abre el módulo
- **THEN** cada moneda se lee por separado
- **AND** no existe ningún total que las combine

#### Scenario: No se promete lo que no hay

- **WHEN** el usuario abre el módulo antes de que exista el plazo fijo
- **THEN** no se dibuja ningún bloque de inversiones, ni activo ni apagado
- **AND** no hay ningún control deshabilitado esperando una fase futura

### Requirement: La jerarquía del módulo no cambia con el ancho

El guardado total SHALL ser el bloque padre, y «Sin destino» y los propósitos SHALL leerse como su
desglose. En responsive SHALL poder cambiar la cantidad de columnas y NO SHALL cambiar la jerarquía. Si hay dos columnas, van dentro del desglose: la
card del total no comparte fila con nada.

#### Scenario: El mismo orden en los tres tamaños

- **WHEN** el usuario abre el módulo en teléfono, tablet o desktop
- **THEN** lee, en este orden: el total, sus acciones, y el desglose
- **AND** la card del total ocupa todo el ancho en los tres
- **AND** lo único que cambia con el ancho es cuántas columnas tiene la grilla de propósitos

#### Scenario: El panel lateral no sube nada al nivel del total

- **WHEN** el usuario abre el detalle de un propósito en desktop
- **THEN** el total sigue arriba, a todo el ancho
- **AND** ningún propósito queda al lado del total

### Requirement: Ningún monto se corta, y el quiebre lo decide el contenido

En toda fila del módulo que combine texto y plata, el que cede SHALL ser el texto. Un monto NO SHALL
achicarse, NO SHALL partirse y NO SHALL cortarse — ni por el borde de su contenedor ni por debajo de
otro control.

Cuando el texto ya cedió todo lo que podía y el monto sigue sin entrar, la fila **se parte en dos
líneas**: el rótulo arriba, los montos abajo, alineados a la derecha para que la columna de números
siga siendo una columna.

El quiebre depende del CONTENIDO —cuánto miden ese nombre y esos números—, nunca del ancho de la
pantalla: no es un breakpoint. Dos filas del mismo ancho se parten distinto si sus montos son
distintos.

En una LISTA la fila no se parte: el nombre trunca con puntos suspensivos hasta donde haga falta, y
todas las cards conservan el mismo alto. Una grilla con altos distintos deja de leerse como grilla, y
un nombre truncado se recupera abriendo el propósito.

#### Scenario: Ocho cifras en las dos monedas, en un teléfono de 360px

- **WHEN** el usuario tiene guardado ocho cifras en pesos y ocho cifras en dólares
- **AND** abre el módulo en un teléfono de 360px
- **THEN** la card del total muestra los dos montos completos, uno arriba del otro
- **AND** el divisor entre las dos monedas se dibuja horizontal, entre ellas
- **AND** ningún monto queda cortado, desbordado ni tapado por otro elemento

#### Scenario: Los mismos montos entran al lado en una pantalla ancha

- **WHEN** esos dos montos entran uno al lado del otro
- **THEN** la card los muestra en dos mitades iguales, con el divisor vertical entre ellas
- **AND** no hace falta ningún ancho de pantalla en particular: entra porque los números miden menos

#### Scenario: Un propósito de nombre largo con un monto grande

- **WHEN** el nombre y el monto no entran juntos en la card
- **THEN** el monto se muestra entero
- **AND** el nombre trunca con puntos suspensivos
- **AND** la card conserva el mismo alto que las demás de la grilla

#### Scenario: «Sin destino» con su botón

- **WHEN** el monto sin destino y el botón «Destinar» no entran en la misma línea
- **THEN** el botón baja a la línea de abajo
- **AND** el monto nunca queda por debajo del botón

### Requirement: El módulo es la lectura y el overlay son los actos

El overlay NO SHALL tener vista de detalle: SHALL abrir directo a lo que se tocó. La lectura —el
total, el desglose, el puente con el banco y el historial— SHALL vivir en la página.

#### Scenario: Volver desde un acto cierra

- **GIVEN** el usuario entró a un propósito desde la lista del módulo
- **WHEN** toca la flecha de volver
- **THEN** el overlay se cierra
- **AND** no aparece ninguna otra lista de propósitos por detrás

#### Scenario: El puente con el banco se lee en la página

- **WHEN** el usuario quiere entender por qué su banco muestra otro número
- **THEN** encuentra la explicación al pie del módulo, plegada
- **AND** no necesita abrir ningún formulario para leerla

### Requirement: Un propósito sin plata existe y se ve

Un propósito recién creado no tiene reparto, así que no aparece en el corte por moneda. Existe igual,
y la lista SHALL mostrarlo: si no, crearlo y no verlo es indistinguible de que no se haya creado.

#### Scenario: El propósito recién creado aparece

- **GIVEN** el usuario acaba de crear un propósito y no le destinó nada
- **WHEN** vuelve a la lista
- **THEN** lo ve, en cero, al final del desglose

#### Scenario: Los vacíos no compiten con los que tienen plata

- **GIVEN** hay propósitos con saldo y propósitos en cero
- **WHEN** el usuario abre el módulo
- **THEN** ve solo los que tienen saldo
- **AND** un control al pie dice cuántos hay sin saldo y los trae
- **AND** ese control los vuelve a ocultar

#### Scenario: Sin ninguno con saldo no se esconde nada

- **GIVEN** todos los propósitos están en cero
- **WHEN** el usuario abre el módulo
- **THEN** los ve a todos
- **AND** no hay ningún control de «ver sin saldo»

### Requirement: Crear un propósito acusa la creación

El acuse SHALL ser la pantalla siguiente y NO SHALL ser un toast. Una pantalla que da por sabido que el propósito existe
no acusa nada: quien cierra ahí no sabe si quedó creado, y al reintentar choca contra el nombre único.

#### Scenario: La pantalla siguiente lo dice

- **WHEN** el usuario crea un propósito desde el módulo
- **THEN** la pantalla siguiente dice que se creó y con qué nombre
- **AND** ofrece destinarle algo
- **AND** ofrece una salida explícita para no hacerlo

#### Scenario: Destinar es opcional

- **GIVEN** el usuario acaba de crear un propósito
- **WHEN** elige no destinarle nada
- **THEN** el propósito queda creado, en cero
- **AND** aparece en la lista

### Requirement: Volver a usar tiene un origen por operación

La app SHALL sugerir de dónde sale, NO SHALL imponerlo y NO SHALL repartir sola. Si el monto supera
el origen elegido, SHALL decir el tope y nombrar la salida en vez de solo negar.

#### Scenario: El origen viene preseleccionado, no bloqueado

- **GIVEN** «Sin destino» tiene saldo
- **WHEN** el usuario abre volver a usar
- **THEN** «Sin destino» viene elegido
- **AND** puede cambiarlo por cualquier grupo que tenga plata en esa moneda

#### Scenario: El tope que no alcanza ofrece la salida

- **GIVEN** «Sin destino» tiene $ 60.000 y hay propósitos con plata
- **WHEN** el usuario pide $ 70.000
- **THEN** la app dice cuánto hay en «Sin destino»
- **AND** le dice que para volver a usar más elija un propósito
- **AND** no reparte la diferencia por su cuenta

#### Scenario: Sin otro origen, no se ofrece uno

- **GIVEN** no hay ningún otro grupo con saldo en esa moneda
- **WHEN** el monto supera el tope
- **THEN** el mensaje dice el tope y nada más

### Requirement: El origen preseleccionado nunca es un grupo vacío

Al abrir volver a usar, el origen preseleccionado NO SHALL ser un grupo sin saldo en la moneda de la
operación: el sistema SHALL correrlo al primero que tenga plata. Un origen vacío deja el tope en cero
sobre una elección que el usuario no hizo, y el CTA muerto sin nada que lo explique.

#### Scenario: Se corre al primero que tenga plata

- **GIVEN** «Sin destino» está en cero y hay propósitos con saldo
- **WHEN** el usuario abre volver a usar desde el módulo
- **THEN** el origen elegido es uno que tiene plata
- **AND** el tope que se muestra no es cero

### Requirement: Un nombre de propósito con espacios de más se acepta

Un nombre con espacios al principio o al final SHALL aceptarse, y SHALL guardarse recortado. Un nombre
compuesto SOLO por espacios SHALL rechazarse, y el rechazo SHALL señalar el campo del nombre en vez de
mostrar un error genérico.

#### Scenario: El espacio se absorbe, no se rechaza

- **WHEN** el usuario crea un propósito llamado «Prueba » con un espacio al final
- **THEN** se crea, y se guarda como «Prueba»
- **AND** no aparece ningún error

#### Scenario: Un nombre de solo espacios sigue siendo inválido

- **WHEN** el usuario intenta crear un propósito con un nombre de solo espacios
- **THEN** la app lo rechaza diciendo qué pasa con el campo del nombre
- **AND** no muestra un error genérico

### Requirement: Lo escrito sobrevive a los desvíos del formulario

Lo que el usuario ya escribió SHALL sobrevivir a los desvíos que el propio formulario ofrece —ir a
crear un propósito y volver, entre otros—: el monto NO SHALL perderse, y lo que se creó en el desvío
SHALL quedar elegido al volver. Perder el monto es cobrarle al usuario haber querido ser prolijo.

#### Scenario: Crear un propósito en el medio no borra el monto

- **GIVEN** el usuario escribió un monto en el formulario de guardar
- **WHEN** va a crear un propósito y vuelve
- **THEN** el monto sigue escrito
- **AND** el propósito recién creado queda elegido

### Requirement: La fila de Guardado del dashboard explica el disponible y lleva al módulo

La card de saldo SHALL conservar la fila **Guardado** en el mes corriente: es un término de la
identidad `Tenías + Entró − Se fué − Guardado = Para gastar`, y sin ella la card deja de cerrar
contra el número que tiene arriba.

La fila SHALL llevar **al módulo** y NO SHALL abrir el detalle ni los formularios. El dashboard
explica; el módulo opera.

La **tira de sugerencia post-ingreso** SHALL permanecer fuera del módulo: su valor es aparecer en el
momento en que hay plata nueva, y es una lectura que invita, no una casa.

#### Scenario: La card sigue cerrando

- **WHEN** el usuario suma los montos de la card
- **THEN** el resultado es el número de la zona oscura
- **AND** la fila de Guardado sigue siendo uno de los sumandos

#### Scenario: Tocar la fila lleva al módulo

- **WHEN** el usuario toca la fila de Guardado
- **THEN** navega al módulo **Ahorro e inversión**
- **AND** no se abre ningún overlay de detalle sobre el dashboard

### Requirement: Cuentas y Movimientos no alojan operatoria de ahorro

El detalle de una cuenta SHALL seguir contestando **ubicación**: saldo de esa cuenta y sus
movimientos. NO SHALL mostrar «Guardado» ni «disponible para gastar» atribuidos a la cuenta —una
reserva no vive en ninguna cuenta, y repartirla por banco sería inventar una imputación— ni alojar
formularios de ahorro.

Guardar y destinar SHALL seguir fuera del ledger: NO SHALL aparecer en Movimientos.

#### Scenario: La cuenta no habla de guardado

- **WHEN** el usuario abre el detalle de una cuenta
- **THEN** ve el saldo de esa cuenta y sus movimientos
- **AND** no ve ningún monto de guardado ni de disponible atribuido a esa cuenta
