## ADDED Requirements

### Requirement: El usuario puede deshacer un pago registrado de una recurrencia

El sistema SHALL permitir deshacer un vencimiento resuelto registrando un pago (`resolution_kind =
'created'`). Esto incluye el pago registrado con Confirmar, desde «Vencimientos por revisar», y el
registrado por anticipado con «Ya lo pagué» / «Ya lo cobré» / «Ya la hice». Deshacer SHALL **borrar el
movimiento** que la recurrencia creó y devolver el vencimiento a *sin resolver*. El movimiento sí se
borra, porque la recurrencia lo creó: desvincular, en cambio, lo conserva porque lo cargó el usuario.

Deshacer NO SHALL dejar el vencimiento **omitido**. Omitir afirma que ese período no correspondía;
deshacer dice que el usuario se equivocó al registrarlo. Esta regla reemplaza la decisión anterior del
#104, que pasaba la ocurrencia a omitida al borrar el movimiento.

Deshacer SHALL tener **dos puertas con el mismo efecto**:

- el botón «Deshacer» en la fila de ese vencimiento en el historial de la ficha de la regla, en el
  mismo lugar donde una fila vinculada ofrece «Desvincular»;
- «Eliminar» en el detalle del movimiento.

Las dos SHALL pedir confirmación antes de borrar. La confirmación SHALL avisar que el saldo de la
cuenta cambia y qué vencimiento vuelve a quedar por revisar. Las dos SHALL aplicar las mismas guardas,
dar los mismos rechazos y dejar el mismo resultado. Web y nativo SHALL ofrecer lo mismo.

El vencimiento que vuelve a *sin resolver*:

- conserva su **fecha de vencimiento**, que es su identidad;
- recupera los **datos de la regla** (requirement «Un vencimiento que vuelve a revisión recupera los
  datos de la regla»);
- en cuanto al límite de vencimientos, sigue la regla que ya rige al devolver una ocurrencia a
  revisión. Si su fecha **todavía no llegó** (un pago anticipado), la posición vuelve a estar
  disponible y el avance retrocede. Si su fecha **ya llegó**, la posición sigue consumida. Deshacer y
  volver a registrar NO SHALL agregarle vencimientos a la regla.

Si el vencimiento tiene fecha futura, vuelve a «Vencimientos por revisar» con esa fecha, igual que un
vencimiento desvinculado.

**Pagos anteriores a la identidad de las ocurrencias.** Un pago registrado antes de que cada ocurrencia
guardara su fecha de vencimiento (migración 0064, septiembre de 2026) no sabe qué vencimiento cubría.
Como no hay fecha con la que devolverlo a revisión, deshacerlo SHALL borrar el movimiento y **sacar esa
ocurrencia del historial**: no vuelve a «por revisar» ni queda omitida. La confirmación SHALL avisarlo.
Inventarle una fecha pondría en «por revisar» un vencimiento que tal vez no existe.

**Regla eliminada.** Si la regla ya fue eliminada, deshacer SHALL borrar el movimiento y sacar la
ocurrencia del historial. Una regla eliminada no tiene «por revisar» al que volver, y la ocurrencia
solo se conservaba como rastro de un movimiento que ya no existe.

**Regla pausada.** Si la regla está pausada, el vencimiento vuelve a *sin resolver* igual que en una
regla activa: pausar no resuelve los vencimientos que ya existen.

**Lo que bloquea deshacer** son las guardas que ya bloquean borrar ese movimiento. El sistema SHALL
rechazar sin modificar nada y decir qué resolver primero:

- un **gasto compartido** con una liquidación vigente posterior: revertirla si está completada,
  cancelarla si está pendiente. Es el mismo criterio y el mismo mensaje que al desvincular, y nunca
  dice «revertí» sobre una pendiente;
- un **consumo de tarjeta en un resumen ya pagado**: primero hay que deshacer el pago del resumen desde
  la tarjeta.

El botón «Deshacer» SHALL mostrarse igual en esas filas, y al tocarlo explicar el bloqueo.
Esconderlo haría que filas iguales se comporten distinto sin explicación.

Deshacer es **todo o nada**. Si algo lo impide, ni el movimiento ni el vencimiento SHALL cambiar.

#### Scenario: Deshacer desde la ficha borra el movimiento y devuelve el vencimiento a revisión

- **WHEN** el usuario toca «Deshacer» en la fila del vencimiento del `2026-09-10` de «Celular», resuelto con un gasto de $14.482 que la recurrencia creó, y confirma
- **THEN** el gasto de $14.482 desaparece de Movimientos y el saldo de su cuenta sube $14.482
- **AND** el vencimiento del `2026-09-10` aparece en «Vencimientos por revisar»
- **AND** en el historial de la ficha esa fila figura sin resolver, no omitida

#### Scenario: Las dos puertas dejan el mismo resultado

- **WHEN** un vencimiento resuelto registrando se deshace desde la ficha, y otro igual se deshace eliminando su movimiento desde el detalle
- **THEN** los dos movimientos quedan borrados
- **AND** los dos vencimientos quedan sin resolver, con su fecha y con los datos de la regla

#### Scenario: Deshacer pide confirmación

- **WHEN** el usuario toca «Deshacer» en una fila del historial
- **THEN** el sistema muestra una confirmación que avisa que el saldo cambia y que el vencimiento vuelve a quedar por revisar
- **AND** no borra nada si el usuario cancela

#### Scenario: Deshacer un pago anticipado libera la posición

- **WHEN** hoy es `2026-10-08`, una regla con límite de 3 vencimientos tiene registrado por anticipado el del `2026-11-10`, y el usuario lo deshace
- **THEN** el vencimiento del `2026-11-10` queda sin resolver, en «Vencimientos por revisar»
- **AND** la regla vuelve a contar ese vencimiento como pendiente de su límite: el avance retrocede uno

#### Scenario: Deshacer un pago cuya fecha ya pasó no devuelve la posición

- **WHEN** hoy es `2026-10-08` y el usuario deshace el pago del vencimiento del `2026-09-10` de una regla con límite
- **THEN** el vencimiento queda sin resolver
- **AND** la regla sigue contando esa posición como consumida

#### Scenario: Deshacer y volver a registrar no agrega vencimientos

- **WHEN** el usuario deshace el pago del vencimiento del `2026-09-10` y después lo vuelve a registrar
- **THEN** la regla tiene un solo vencimiento del `2026-09-10`, resuelto
- **AND** su plan no ganó ningún vencimiento

#### Scenario: Deshacer un pago anterior a septiembre lo saca del historial

- **WHEN** el usuario deshace un pago registrado antes de que las ocurrencias guardaran su fecha de vencimiento
- **THEN** la confirmación avisa que ese pago no vuelve a quedar por revisar
- **AND** al confirmar, el movimiento se borra y la fila sale del historial de la ficha
- **AND** no aparece nada nuevo en «Vencimientos por revisar»

#### Scenario: Deshacer un gasto compartido con una liquidación vigente dice qué resolver

- **WHEN** el vencimiento se resolvió con un gasto compartido y hay una liquidación completada del hogar, en esa moneda, fechada después
- **THEN** el sistema rechaza deshacer y dice que primero hay que revertir esa liquidación
- **AND** el movimiento y el vencimiento quedan como estaban

#### Scenario: Una liquidación pendiente pide cancelarla, no revertirla

- **WHEN** la liquidación que bloquea deshacer está pendiente
- **THEN** el mensaje dice que primero hay que cancelarla
- **AND** NO dice «revertí»

#### Scenario: Deshacer un consumo en un resumen pagado dice dónde se resuelve

- **WHEN** el vencimiento se resolvió con un consumo de tarjeta que está en un resumen ya pagado, y el usuario toca «Deshacer»
- **THEN** el sistema rechaza deshacer sin modificar nada
- **AND** dice que primero hay que deshacer el pago del resumen desde la tarjeta

#### Scenario: Deshacer un consumo en un resumen abierto funciona

- **WHEN** el vencimiento se resolvió con un consumo de tarjeta cuyo resumen todavía no se pagó
- **THEN** deshacer borra el consumo y el total del resumen baja en ese importe
- **AND** el vencimiento vuelve a quedar sin resolver

#### Scenario: Web y nativo ofrecen deshacer igual

- **WHEN** el usuario abre la ficha de una regla con un vencimiento resuelto registrando, en web a 360 px y en la app nativa
- **THEN** las dos muestran «Deshacer» en esa fila, con la misma confirmación y el mismo resultado

### Requirement: Un vencimiento que vuelve a revisión recupera los datos de la regla

Cuando un vencimiento resuelto vuelve a *sin resolver*, el sistema SHALL restaurarle los datos de la
**regla**: descripción, categoría, subcategoría, cuenta e importe. Vale para tres casos:

- desvincular;
- deshacer un pago registrado;
- eliminar el movimiento que lo resolvía.

Su fecha de vencimiento NO SHALL cambiar. La moneda, el destino de una transferencia, el hogar y el
reparto nunca dejaron de ser los de la regla y siguen así.

Es la regla que hace que la fila se reconozca. En el hub y en la ficha la regla tiene un nombre; si el
vencimiento vuelve con el nombre del movimiento, el usuario no puede relacionarlos. Y si lo confirma,
se crearía algo que la regla no dice (#186).

Al resolverse, el vencimiento SÍ SHALL seguir copiando los datos del movimiento, tanto al registrar
como al vincular, para que el historial muestre lo que pasó de verdad. Lo que este requirement fija es
la vuelta, no la ida.

Consecuencia aceptada: una corrección hecha a mano solo sobre ese vencimiento (importe, cuenta,
descripción o categoría distintos de los de la regla) se pierde al volver a revisión. El vencimiento
no guarda los datos que tenía antes de resolverse, y la regla es la única fuente que el usuario
reconoce.

Si la cuenta de la regla está archivada, el vencimiento vuelve igual con esa cuenta. Al confirmarlo
rige lo que ya rige para una cuenta de regla archivada: el usuario elige otra cuenta elegible.

#### Scenario: El vencimiento recupera nombre, cuenta, categoría e importe de la regla

- **WHEN** la regla «Prueba recurr» es de $500 en «Billetera», Entretenimiento / Cine, y su vencimiento del `2026-11-15` vuelve a revisión después de haber estado resuelto con «Comida», $3.333,33, en «Visa Galicia»
- **THEN** el vencimiento del `2026-11-15` queda con descripción, categoría, subcategoría, cuenta e importe de «Prueba recurr»
- **AND** su fecha sigue siendo el `2026-11-15`

#### Scenario: Una corrección manual del vencimiento se pierde al volver

- **WHEN** el usuario confirmó el vencimiento del `2026-09-10` de una regla de $500 cambiando el importe a $620, y después lo deshace
- **THEN** el vencimiento vuelve a revisión con $500, el importe de la regla

#### Scenario: Al resolverse, el historial sigue mostrando lo real

- **WHEN** el usuario vincula al vencimiento de una regla de $500 un movimiento de $750
- **THEN** el historial de la ficha muestra ese vencimiento con $750

### Requirement: Las acciones sobre un vencimiento dependen de su estado, no de la pantalla

El sistema SHALL distinguir dos preguntas que hoy se contestan con el mismo dato: **qué vencimiento se
anuncia como próximo** y **sobre qué vencimiento se puede operar**. La primera existe para no nombrar
dos veces la misma fecha, y por eso descarta lo que ya existe. La segunda NO SHALL excluir un
vencimiento por el hecho de que ya exista como fila: lo que el usuario necesita resolver es,
justamente, lo que ya existe y sigue sin resolver. Usar la definición de «próximo» para decidir sobre
qué se puede operar es lo que dejó sin salida a un vencimiento materializado (#162).

Lo que se ofrece SHALL depender únicamente del **estado del vencimiento**, igual en toda pantalla que
lo muestre:

- **Proyectado** —el calendario lo produce y todavía no existe como fila—: el hub y la ficha de la
  regla SHALL ofrecer **registrarlo** («Ya lo pagué» / «Ya lo cobré» / «Ya la hice», según el tipo de
  la regla) y **vincularlo** a un movimiento ya cargado («Ya lo tengo cargado»).
- **Existente y sin resolver**, cualquiera sea su fecha —vencido, de hoy o futuro—: toda superficie
  que lo muestre SHALL ofrecer **registrarlo**, **vincularlo** y **omitirlo**. Registrarlo y
  confirmarlo son la misma acción: confirmar ya abre el formulario con importe, cuenta y fecha.
- **Resuelto registrando** (`resolution_kind = 'created'`): el historial de la regla SHALL ofrecer
  **deshacer**, que borra el movimiento que la recurrencia creó y devuelve el vencimiento a *sin
  resolver*. El detalle del movimiento lo ofrece como «Eliminar», con el mismo efecto. Ninguna otra
  superficie SHALL ofrecerlo.
- **Resuelto vinculando** (`resolution_kind = 'linked'`): el historial de la regla SHALL ofrecer
  **desvincular**, y ninguna otra superficie SHALL hacerlo.
- **Omitido**: no SHALL ofrecerse ninguna acción de deshacer. Deshacer una omisión queda fuera de
  este requirement.

La **ficha de la regla** SHALL seguir anunciando como «próxima fecha» la primera fecha que el
calendario todavía no produjo. Los vencimientos existentes sin resolver se operan desde **su propia
fila del historial**, no desde la próxima fecha: apuntar los botones de la próxima fecha «al más
viejo sin resolver» resuelve uno y deja a los demás igual de huérfanos.

Una regla **pausada** NO SHALL ofrecer registrar ni vincular por anticipado: una pausa es la regla
diciendo que no está corriendo. Sus vencimientos **ya existentes** sin resolver SHALL seguir
ofreciendo lo mismo que los de una regla activa, porque pausar no los resuelve.

El hub SHALL ofrecer las acciones sobre el **mismo conjunto** de vencimientos proyectados en web y en
nativo. Hoy web las ofrece sobre cada ocurrencia proyectada dentro de treinta días, y ninguna si la
próxima cae más lejos; nativo las ofrece sobre la próxima de cada regla, sin tope de días. No es una
divergencia forzada por la plataforma. El conjunto SHALL ser el de nativo: **la próxima ocurrencia
de cada regla activa**, además de cada fila que la proyección muestre.

**DIVERGENCIA CONOCIDA (#162).** El bloque de vencimientos por revisar ya cumple este requirement:
cada fila ofrece confirmar —que es registrar—, vincular y omitir, también sobre una ocurrencia
desvinculada con fecha futura. Lo que todavía no lo cumple: el **historial de la ficha de la regla**
no ofrece ninguna acción sobre sus filas sin resolver, y el **hub web** no ofrece las acciones sobre
el mismo conjunto que el nativo. Hasta que ese change se haga, el sistema NO SHALL darse por cumplido
en el historial de la ficha ni en el hub web; este requirement fija lo que esas pantallas tienen que
ofrecer, no afirma que ya lo ofrezcan.

#### Scenario: Un vencimiento proyectado ofrece registrar y vincular

- **WHEN** una regla activa tiene su próximo vencimiento el `2026-10-23`, todavía sin fila, y hoy es el `2026-10-07`
- **THEN** el hub y la ficha de la regla ofrecen registrarlo y vincularlo sobre esa fecha
- **AND** no ofrecen omitirlo, porque no existe nada que omitir

#### Scenario: Un vencimiento existente sin resolver ofrece registrar, vincular y omitir

- **WHEN** el generador materializó el vencimiento del `2026-09-25` y sigue sin resolver
- **THEN** el bloque de vencimientos por revisar y la fila de ese vencimiento en el historial de la regla ofrecen registrarlo, vincularlo y omitirlo
- **AND** la ficha anuncia como próxima fecha la siguiente que el calendario todavía no produjo, no el `2026-09-25`

#### Scenario: Un vencimiento desvinculado se puede volver a vincular

- **WHEN** el usuario desvincula el movimiento del vencimiento del `2026-11-23`, cuya fecha todavía no llegó
- **THEN** ese vencimiento queda existente y sin resolver, con fecha futura
- **AND** sigue ofreciendo registrarlo, vincularlo y omitirlo, aunque ya exista como fila

#### Scenario: Lo resuelto registrando ofrece deshacer, no desvincular

- **WHEN** el usuario abre en el historial una ocurrencia resuelta con un movimiento que la recurrencia creó
- **THEN** la fila ofrece «Deshacer»
- **AND** NO ofrece desvincular

#### Scenario: Lo resuelto vinculando ofrece desvincular, no deshacer

- **WHEN** el usuario abre en el historial una ocurrencia resuelta con un movimiento que vinculó
- **THEN** la fila ofrece «Desvincular»
- **AND** NO ofrece «Deshacer»

#### Scenario: Una regla pausada no ofrece resolver por anticipado

- **WHEN** una regla está pausada y su calendario produciría un vencimiento el `2026-10-23`
- **THEN** ni el hub ni la ficha ofrecen registrarlo ni vincularlo
- **AND** un vencimiento que ya existía sin resolver antes de la pausa sigue ofreciendo registrar, vincular y omitir

#### Scenario: Web y nativo ofrecen las acciones sobre los mismos vencimientos

- **WHEN** una regla mensual activa tiene su próximo vencimiento a treinta y cinco días de hoy
- **THEN** el hub web y el hub nativo ofrecen registrarlo y vincularlo sobre esa misma fecha

## MODIFIED Requirements

### Requirement: El usuario puede eliminar una transacción

El sistema SHALL permitir eliminar permanentemente una transacción. El sistema solicita confirmación antes de ejecutar. El saldo de la cuenta se recalcula automáticamente tras la eliminación.

El sistema NO SHALL permitir eliminar desde el detalle del movimiento aquellas transacciones cuyo borrado aislado rompería una operación mayor de la que forman parte. En esos casos SHALL rechazar la operación con un mensaje que indique **dónde** se resuelve, sin exponer detalles técnicos:

- una **cuota hija** de una compra en cuotas se elimina desde el movimiento padre;
- un **consumo ya pagado** en un resumen no se elimina: el mensaje SHALL decir que primero hay que deshacer el pago del resumen desde la tarjeta;
- una **pata de liquidación** del hogar se revierte desde la cuenta corriente;
- un **pago de resumen de tarjeta** se deshace desde el detalle del período de la tarjeta.

El pago de un resumen NO SHALL eliminarse desde el detalle del movimiento: es la contrapartida de una operación que también dejó movimientos del resumen en `paid`, un registro en el pago del período y, eventualmente, un impuesto de sellos. Deshacerlo es la operación de la capability `cards`.

Un movimiento que **sembró una regla recurrente** (existe una regla con `created_from_transaction_id` apuntándolo) NO SHALL borrarse en silencio dejando la regla huérfana. La garantía SHALL vivir en la base: `recurrences.created_from_transaction_id` es `ON DELETE RESTRICT`, de modo que el bloqueo aplica a todos los clientes (web, mobile, SQL manual) y no depende de que cada frontend lo recuerde. Antes de intentar el borrado, el sistema SHALL detectar la regla sembrada y ofrecer al usuario dos salidas explícitas:

- **eliminar también la regla** — se elimina la regla (con sus instancias pendientes) y luego el movimiento;
- **conservar la regla, desvincularla** — se pone `created_from_transaction_id = NULL` deliberadamente y luego se borra el movimiento.

Al desvincular, si la regla queda con `last_generated_date` igual a su `start_date` y esa fecha es **futura**, el sistema SHALL además poner `last_generated_date = NULL`: la ocurrencia que ese cursor decía cubrir es justamente el movimiento que se está borrando, y sin la corrección la regla perdería ese período. Sin una de las dos confirmaciones, ni el movimiento ni la regla SHALL modificarse.

Un movimiento que **resuelve un vencimiento** de una regla recurrente —porque la recurrencia lo creó al registrar el pago, o porque el usuario lo vinculó— SHALL poder eliminarse desde su detalle, con las mismas guardas que cualquier otro movimiento. Eliminarlo SHALL devolver ese vencimiento a *sin resolver* en la misma operación, con las reglas del requirement «El usuario puede deshacer un pago registrado de una recurrencia». La confirmación SHALL avisar, además de que el saldo cambia, qué vencimiento de qué regla vuelve a quedar por revisar. La garantía SHALL vivir en la base: cualquier borrado de un movimiento que resuelve un vencimiento, venga del cliente que venga, deja el vencimiento sin resolver o —si es un pago anterior a la identidad de las ocurrencias— lo saca del historial. Nunca SHALL fallar por el vínculo con la recurrencia.

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

#### Scenario: Eliminar un movimiento que resuelve un vencimiento lo devuelve a revisión

- **WHEN** el usuario elimina desde su detalle el gasto de $14.482 que la regla «Celular» creó al registrar el vencimiento del `2026-09-10`
- **THEN** el movimiento se borra y el saldo de la cuenta sube $14.482
- **AND** el vencimiento del `2026-09-10` de «Celular» queda *sin resolver*, en «Vencimientos por revisar»
- **AND** el sistema NO muestra «Algo salió mal»

#### Scenario: La confirmación nombra el vencimiento que vuelve a revisión

- **WHEN** el usuario toca «Eliminar» en el detalle de un movimiento que resuelve el vencimiento del `2026-09-10` de «Celular»
- **THEN** el diálogo avisa que el saldo cambia
- **AND** avisa que el vencimiento del 10 sep de «Celular» vuelve a quedar por revisar

#### Scenario: Eliminar un movimiento vinculado lo devuelve a revisión

- **WHEN** el usuario elimina desde su detalle un movimiento que había vinculado al vencimiento del `2026-11-15` con «Ya lo tengo cargado»
- **THEN** el movimiento se borra
- **AND** el vencimiento del `2026-11-15` queda *sin resolver*, con los datos de la regla

#### Scenario: Eliminar un consumo pagado dice dónde se resuelve

- **WHEN** un consumo de tarjeta está en un resumen ya pagado
- **THEN** el detalle del movimiento no ofrece «Eliminar»
- **AND** si se intenta borrarlo por otra puerta, como «Deshacer» en la ficha de la regla, el sistema lo rechaza y dice que primero hay que deshacer el pago del resumen desde la tarjeta

### Requirement: El usuario puede desvincular un movimiento de un vencimiento

El sistema SHALL permitir deshacer una vinculación. Desvincular SHALL **conservar el movimiento** —
vuelve a estar suelto, tal como estaba antes— y devolver la ocurrencia a *sin resolver*. El sistema NO
SHALL borrar el movimiento: la recurrencia no lo creó, lo cargó el usuario, y borrarlo destruiría un
hecho real de su historial.

Desvincular NO SHALL dejar la ocurrencia **omitida**: omitir afirma que ese período no correspondía, y
lo que el usuario está diciendo al desvincular es que se equivocó de movimiento. Es la distinción que
ya rige entre deshacer y omitir.

El sistema SHALL ofrecer desvincular **únicamente sobre ocurrencias resueltas por vinculación**. Una
ocurrencia resuelta por un movimiento que la recurrencia **creó** NO SHALL ofrecer esta acción, porque
deshacerla significa borrar ese movimiento, que es la operación «Deshacer» (requirement «El usuario
puede deshacer un pago registrado de una recurrencia»).
Que el sistema pueda distinguir las dos es el motivo por el que cada ocurrencia registra **cómo** se
resolvió.

Al desvincular, la ocurrencia SHALL volver con los **datos de la regla** —descripción, categoría,
subcategoría, cuenta e importe—, no con los del movimiento que tenía vinculado (requirement «Un
vencimiento que vuelve a revisión recupera los datos de la regla»). El movimiento desvinculado NO
SHALL modificarse.

#### Scenario: Desvincular conserva el movimiento y devuelve el vencimiento a revisión

- **WHEN** el usuario desvincula el movimiento que había asociado al vencimiento del `2026-09-23`
- **THEN** el movimiento sigue existiendo, sin vínculo con ninguna regla
- **AND** la ocurrencia del `2026-09-23` queda *sin resolver*, conservando su vencimiento
- **AND** la ocurrencia NO queda omitida

#### Scenario: Un vencimiento desvinculado se puede volver a resolver

- **WHEN** el usuario desvincula el vencimiento del `2026-09-23` y después vincula otro movimiento
- **THEN** la ocurrencia queda resuelta por el movimiento nuevo
- **AND** la regla no gana ningún vencimiento adicional

#### Scenario: Desvincular no se ofrece sobre un pago que creó la recurrencia

- **WHEN** el usuario abre una ocurrencia que se resolvió registrando un pago, con un movimiento
  creado por la recurrencia
- **THEN** la pantalla NO ofrece desvincular

#### Scenario: Desvincular devuelve el vencimiento con los datos de la regla

- **WHEN** la regla «Prueba recurr» es de $500 en «Billetera», categoría Entretenimiento / Cine, y el usuario desvincula de su vencimiento del `2026-11-15` el movimiento «Comida» de $3.333,33 en «Visa Galicia»
- **THEN** en «Vencimientos por revisar» el vencimiento del `2026-11-15` se llama «Prueba recurr», está en «Billetera» y es de $500
- **AND** confirmarlo crea un gasto de $500 en «Billetera»
- **AND** el movimiento «Comida» sigue igual en Movimientos

## REMOVED Requirements

### Requirement: Qué se puede hacer sobre un vencimiento depende de su estado, no de la pantalla

**Reason**: Lo resuelto registrando pasa a ofrecer «Deshacer», y su escenario «Lo resuelto registrando no ofrece deshacer» deja de valer. El validador no deja que un requirement modificado pierda un escenario, así que se reemplaza por «Las acciones sobre un vencimiento dependen de su estado, no de la pantalla», con el mismo contenido salvo ese cambio.
**Migration**: Ver el requirement «Las acciones sobre un vencimiento dependen de su estado, no de la pantalla» en ADDED.
