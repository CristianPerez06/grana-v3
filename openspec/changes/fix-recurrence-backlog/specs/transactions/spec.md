## RENAMED Requirements

- FROM: `### Requirement: El sistema genera instancias recurrentes de forma secuencial`
- TO: `### Requirement: El sistema genera todas las ocurrencias vencidas de una regla`

**Reason**: el título describía el invariante que este change elimina — "secuencial" significaba "de
a una, y la siguiente solo después de resolver la anterior", que es exactamente lo que traba la
recurrencia (#96). El requirement pasa a describir la generación completa del atraso.

## ADDED Requirements

### Requirement: Cada ocurrencia recurrente tiene una identidad estable

El sistema SHALL identificar cada ocurrencia de una regla recurrente por su **vencimiento**
(`due_date`), derivado del cronograma de la regla y NO de ninguna fecha que el usuario elija al
resolverla. Esa identidad SHALL ser única por regla y SHALL estar protegida en **todos** los estados
de la ocurrencia —pendiente, resuelta con pago, u omitida—, de modo que una ocurrencia ya resuelta no
pueda volver a materializarse.

El sistema SHALL distinguir tres fechas que hoy se pisan entre sí, y las tres SHALL sobrevivir a la
resolución de la ocurrencia:

- **vencimiento** — cuándo tocaba, fijado por el calendario de la regla, inmutable;
- **fecha de pago** — cuándo salió la plata, elegida por el usuario, y que es la fecha del movimiento;
- **fecha de carga** — cuándo se registró en la app.

Resolver una ocurrencia —registrando un pago, vinculando un movimiento existente u omitiéndola— NO
SHALL alterar el cursor de generación de la regla. El sistema SHALL derivar qué falta materializar
del cronograma de la regla y del conjunto de ocurrencias ya existentes, de modo que resolverlas en
cualquier orden NO SHALL producir duplicados ni saltear ocurrencias.

#### Scenario: El vencimiento sobrevive a un pago con otra fecha

- **WHEN** una ocurrencia vence el `2026-06-23` y el usuario registra su pago con fecha `2026-09-03`
- **THEN** la ocurrencia conserva `2026-06-23` como vencimiento
- **AND** el movimiento creado queda fechado el `2026-09-03`
- **AND** el historial de la regla permite ver que el pago del `2026-09-03` corresponde al
  vencimiento de junio

#### Scenario: Resolver fuera de orden no regenera lo ya resuelto

- **WHEN** una regla mensual tiene sin resolver los vencimientos de junio, julio y agosto, y el
  usuario resuelve primero el de agosto y después el de julio
- **THEN** el vencimiento de agosto NO vuelve a materializarse
- **AND** el de junio sigue disponible sin resolver

#### Scenario: La misma ocurrencia no puede existir dos veces

- **WHEN** un proceso intenta materializar una ocurrencia cuyo vencimiento ya tiene una instancia,
  sea pendiente, pagada u omitida
- **THEN** el sistema no crea una segunda instancia para ese vencimiento

### Requirement: El usuario puede registrar el pago de una ocurrencia antes de su vencimiento

El sistema SHALL permitir registrar el pago de la próxima ocurrencia de una regla activa **aunque su
vencimiento todavía no haya llegado**, sin esperar a que la ocurrencia se materialice por sí sola. La
acción SHALL estar disponible desde el hub de recurrencias y desde el detalle de la regla, en web y
en la app nativa.

Al registrar el pago anticipado, el sistema SHALL abrir el mismo formulario de resolución que usa una
ocurrencia vencida, con la fecha de pago propuesta en el día en curso y editable.

Registrar un pago por adelantado NO SHALL desplazar el cronograma de la regla: la ocurrencia
siguiente SHALL calcularse a partir del vencimiento de la regla y NO a partir de la fecha en que el
usuario pagó.

#### Scenario: Pago anticipado sin correr el calendario

- **WHEN** hoy es el `2026-09-03`, una regla mensual vence los días 23, y el usuario registra el pago
  de la ocurrencia del `2026-09-23`
- **THEN** se crea un movimiento con fecha `2026-09-03`
- **AND** la ocurrencia del `2026-09-23` queda resuelta
- **AND** el próximo vencimiento de la regla es el `2026-10-23`

#### Scenario: Pagos anticipados repetidos no desfasan la regla

- **WHEN** el usuario registra anticipadamente tres meses seguidos, cada uno unos días antes del 23
- **THEN** el vencimiento sigue cayendo el día 23 de cada mes

#### Scenario: Una regla pausada no ofrece pago anticipado

- **WHEN** el usuario abre el detalle de una regla pausada
- **THEN** la acción de registrar un pago anticipado no está disponible

### Requirement: El usuario puede vincular un movimiento existente a una ocurrencia

El sistema SHALL permitir resolver una ocurrencia recurrente **vinculándola a un movimiento que ya
existe**, en lugar de crear uno nuevo. Al vincular, el sistema NO SHALL crear ninguna transacción: la
ocurrencia SHALL quedar resuelta apuntando al movimiento existente, que SHALL pasar a mostrarse como
originado en esa regla.

El sistema SHALL ofrecer para vincular únicamente movimientos compatibles con la ocurrencia —misma
moneda, mismo tipo de movimiento— y NO SHALL permitir vincular un movimiento ya vinculado a otra
ocurrencia.

#### Scenario: Vincular no duplica el gasto

- **WHEN** el usuario ya había cargado a mano el gasto del alquiler y lo vincula a la ocurrencia
  correspondiente
- **THEN** no se crea ningún movimiento nuevo
- **AND** el total de gastos del mes no cambia
- **AND** la ocurrencia queda resuelta y el movimiento aparece como originado en la regla

#### Scenario: Un movimiento ya vinculado no se ofrece de nuevo

- **WHEN** el usuario busca un movimiento para vincular a una ocurrencia
- **THEN** los movimientos ya vinculados a otra ocurrencia no aparecen entre las opciones

### Requirement: El usuario puede resolver en bloque las ocurrencias sin revisar

El sistema SHALL agrupar las ocurrencias sin resolver de una misma regla y SHALL ofrecer resolverlas
en una sola pasada. Para **cada** ocurrencia del grupo el usuario SHALL poder revisar y corregir
**fecha de pago, importe y cuenta** antes de guardar, y SHALL poder elegir entre cuatro salidas:
registrar el pago, vincular un movimiento existente, indicar que el período no corresponde, o dejarla
sin resolver.

Antes de aplicar, el sistema SHALL mostrar un resumen de lo que va a ocurrir, incluidos los
movimientos que se van a crear y su efecto sobre el saldo de las cuentas involucradas.

Dejar una ocurrencia sin resolver NO SHALL impedir resolver las demás ni bloquear la generación de
las siguientes.

#### Scenario: Ponerse al día corrigiendo cada pago

- **WHEN** una regla tiene sin resolver los vencimientos de junio, julio y agosto, y el usuario los
  resuelve juntos con importes distintos entre sí y uno pagado desde otra cuenta
- **THEN** se crean tres movimientos, cada uno con el importe, la fecha y la cuenta que el usuario
  indicó
- **AND** ninguno usa el importe de la regla cuando el usuario lo corrigió

#### Scenario: Resolver algunas y dejar otras

- **WHEN** el usuario registra el pago de julio y agosto y deja junio sin resolver
- **THEN** junio sigue disponible sin resolver
- **AND** la regla sigue generando las ocurrencias siguientes con normalidad

### Requirement: El sistema materializa las ocurrencias vencidas sin depender de la navegación

El sistema SHALL materializar las ocurrencias vencidas de las reglas activas **en cualquier pantalla
de la aplicación**, y NO SHALL condicionarlo a que el usuario visite una ruta en particular. El
requisito aplica por igual a web y a la app nativa: hoy el feed nativo muestra las ocurrencias por
revisar pero no las materializa, lo que hace que dependan de haber abierto el hub.

La materialización SHALL ser idempotente y NO SHALL bloquear la lectura de la pantalla en la que
ocurre.

#### Scenario: Entrar al inicio alcanza para que aparezca lo vencido

- **WHEN** el usuario abre la aplicación en el inicio, sin pasar por Movimientos ni por el hub de
  recurrencias, y tiene una ocurrencia vencida
- **THEN** la ocurrencia queda materializada y visible

#### Scenario: El feed nativo materializa igual que el web

- **WHEN** el usuario abre el feed de movimientos de la app nativa y tiene una ocurrencia vencida
- **THEN** la ocurrencia queda materializada, con el mismo resultado que en web

## MODIFIED Requirements

### Requirement: El sistema genera todas las ocurrencias vencidas de una regla

El sistema SHALL materializar **todas** las ocurrencias vencidas de una regla activa, y NO SHALL
detenerse porque exista otra ocurrencia sin resolver. Una ocurrencia sin resolver NO SHALL impedir
que se materialicen las posteriores.

Las ocurrencias SHALL materializarse en orden de calendario. El sistema PUEDE materializarlas por
tandas cuando el atraso es grande, siempre que la **ocurrencia vigente** —la más reciente ya
vencida— quede materializada en la primera tanda: un corte que dejara afuera lo que vence hoy
reproduciría el defecto que este requirement elimina. Ninguna ocurrencia SHALL quedar fuera del
alcance del sistema por efecto de una tanda o de un tope de presentación.

La fecha de cada ocurrencia SHALL ser la que corresponde por cronograma, nunca la fecha actual.

#### Scenario: Usuario vuelve después de varios meses

- **WHEN** el usuario abre la app después de varios períodos sin resolver una regla mensual
- **THEN** el sistema materializa las ocurrencias vencidas de esos períodos, cada una con su propia
  fecha de vencimiento
- **AND** las presenta agrupadas, de modo que el usuario pueda resolverlas en una sola pasada

#### Scenario: Una ocurrencia sin resolver no bloquea la siguiente

- **WHEN** una regla mensual tiene la ocurrencia de junio sin resolver y llega el vencimiento de julio
- **THEN** la ocurrencia de julio se materializa igual
- **AND** el usuario puede resolver la de julio sin haber tocado la de junio

#### Scenario: Un atraso largo no deja afuera lo que vence hoy

- **WHEN** una regla diaria acumula noventa ocurrencias sin resolver
- **THEN** la ocurrencia vigente queda materializada
- **AND** las anteriores siguen siendo accesibles y resolubles

### Requirement: La generación de instancias recurrentes usa intervalo+unidad y corta por la primera condición de fin

El sistema SHALL calcular la fecha de cada ocurrencia recurrente aplicando `interval_count` veces la
`interval_unit`, avanzando desde `start_date`. El cálculo SHALL aplicar clamping de fin de mes:
avanzar por `month` o `year` desde un día que no existe en el mes destino SHALL caer al último día
válido de ese mes (p. ej. 31-ene + 1 mes ⇒ 28/29-feb), y el día original SHALL restaurarse en los
meses siguientes.

La generación SHALL cortar por la primera condición de fin que se cumpla (`end_date` o
`max_occurrences`).

`max_occurrences` SHALL tener **una sola definición**: cuenta ocurrencias del cronograma desde
`start_date`, incluida la ocurrencia que la regla ya tuviera cubierta por el movimiento que la creó.
El generador, la proyección de próximas ocurrencias y la pantalla SHALL derivar ese conteo del mismo
cronograma, de modo que no puedan dar números distintos para la misma regla.

`interval_count` + `interval_unit` son la **fuente de verdad** del cronograma; `frequency` es solo la
etiqueta de presentación. Para los cuatro presets, la etiqueta y el intervalo SHALL ser coherentes
(`weekly` ⇒ 1 `week`, `biweekly` ⇒ 2 `week`, `monthly` ⇒ 1 `month`, `annual` ⇒ 1 `year`); `custom`
admite cualquier intervalo válido. Esa coherencia SHALL estar enforced por un `CHECK` en la base.

#### Scenario: Clamping de fin de mes en febrero

- **WHEN** una regla mensual tiene `start_date = 2026-01-31`
- **THEN** la ocurrencia de febrero cae el `2026-02-28`
- **AND** la de marzo vuelve al `2026-03-31`

#### Scenario: Corte por end_date

- **WHEN** una regla tiene `end_date = 2026-03-01` y la siguiente ocurrencia caería el `2026-03-15`
- **THEN** esa ocurrencia no se materializa

#### Scenario: max_occurrences da el mismo número en todas las superficies

- **WHEN** una regla creada desde un movimiento tiene `max_occurrences = 3`
- **THEN** el total de ocurrencias del cronograma es 3, contando la que cubre el movimiento de origen
- **AND** el generador materializa 2 ocurrencias adicionales
- **AND** la proyección de próximas ocurrencias anuncia esas mismas 2

#### Scenario: La base rechaza un preset incoherente con su intervalo

- **WHEN** cualquier cliente intenta insertar o actualizar una regla con `frequency = 'weekly'` e
  `interval_count = 1`, `interval_unit = 'month'`
- **THEN** la base rechaza la escritura por violación del `CHECK`

### Requirement: El usuario puede confirmar una instancia recurrente

El sistema SHALL permitir registrar el pago de una ocurrencia recurrente. Al registrarlo, el sistema
SHALL crear una transacción real usando el mismo contrato de creación que usa un movimiento manual
del mismo tipo, y la ocurrencia SHALL quedar vinculada a la transacción creada.

El usuario SHALL poder ajustar **fecha de pago, importe y cuenta** al registrar. La fecha que elija
SHALL ser la del movimiento y NO SHALL sobrescribir el vencimiento de la ocurrencia, que se conserva.
La cuenta SHALL ser un override de esa ocurrencia y NO SHALL redefinir la cuenta de la regla.

Registrar un pago NO SHALL avanzar el cursor de generación de la regla: la ocurrencia queda resuelta
por su propia identidad, de modo que registrar pagos en cualquier orden es seguro.

Estas capacidades SHALL estar disponibles por igual en web y en la app nativa, incluida la
advertencia de saldo negativo que hoy solo existe en web.

#### Scenario: Registrar un pago con otra fecha conserva el vencimiento

- **WHEN** el usuario registra el pago de la ocurrencia que vencía el `2026-06-23`, con fecha
  `2026-09-03`
- **THEN** se crea un movimiento fechado el `2026-09-03`
- **AND** la ocurrencia conserva el `2026-06-23` como vencimiento

#### Scenario: Confirmar consumo recurrente de tarjeta

- **WHEN** el usuario registra el pago de una ocurrencia de gasto recurrente en tarjeta de crédito
- **THEN** el sistema crea un consumo de tarjeta con `status='pending'`, `card_period_id` y `due_date`
- **AND** si la moneda no es ARS, exige `fx_rate_to_ars`
- **AND** el saldo cash/bank no cambia

#### Scenario: Registrar el pago en la app nativa ofrece los mismos ajustes

- **WHEN** el usuario registra un pago recurrente desde la app nativa
- **THEN** puede ajustar fecha, importe y cuenta igual que en web
- **AND** recibe la misma advertencia si la cuenta quedaría en negativo

#### Scenario: Confirmar consumo de tarjeta en periodo pagado falla

- **WHEN** una ocurrencia recurrente de tarjeta tiene fecha dentro de un periodo ya pagado
- **THEN** el registro falla con error explicativo
- **AND** no se crea ninguna transaccion
- **AND** la ocurrencia permanece sin resolver para que el usuario edite la fecha u omita

### Requirement: El usuario puede omitir una instancia recurrente

El sistema SHALL permitir omitir una ocurrencia recurrente. Omitir SHALL resolverla sin crear
transacción y sin modificar saldos ni resúmenes, y SHALL significar que **ese período no
corresponde** — no que hubo un error de carga.

Omitir SHALL ser una operación distinta de **deshacer un pago ya registrado**. Deshacer un pago
SHALL borrar el movimiento y devolver la ocurrencia al estado **sin resolver**, para que el usuario
pueda volver a registrarla; NO SHALL dejarla omitida, porque eso afirmaría que el período no
correspondía cuando el usuario solo se equivocó al cargarlo.

Omitir una ocurrencia NO SHALL impedir que se materialicen ni se resuelvan las siguientes.

#### Scenario: Omitir no crea movimiento

- **WHEN** el usuario omite una ocurrencia sin resolver
- **THEN** la ocurrencia queda omitida
- **AND** no se inserta ninguna fila en `transactions`

#### Scenario: Deshacer un pago devuelve la ocurrencia a revisión

- **WHEN** el usuario deshace el pago que había registrado para una ocurrencia
- **THEN** el movimiento se elimina
- **AND** la ocurrencia vuelve a estar sin resolver, no omitida
- **AND** el usuario puede volver a registrar su pago

### Requirement: El modulo Movimientos muestra pendientes recurrentes separados del historial

El sistema SHALL mostrar las ocurrencias recurrentes sin resolver en un bloque separado del historial
de movimientos, sin mezclarlas con las transacciones reales.

El bloque SHALL estar presente también en la pantalla de inicio de la aplicación, que es donde
empieza la sesión: hoy vive únicamente en Movimientos y en el hub, de modo que un usuario puede tener
vencimientos sin revisar y no enterarse nunca.

El bloque SHALL estar **expandido siempre que haya al menos una ocurrencia vencida**. NO SHALL
plegarse en función de la cantidad de ocurrencias sin resolver: cuantas más haya, más visible tiene
que ser, no menos.

El lenguaje del bloque SHALL expresar que hay información **por revisar** y NO SHALL afirmar deuda:
una ocurrencia sin resolver puede corresponder a un pago que el usuario ya hizo y todavía no
registró. El sistema NO SHALL rotular el conjunto como dinero adeudado.

Cada fila SHALL indicar a qué vencimiento corresponde, y SHALL explicitar qué va a ocurrir al
resolverla —qué movimiento se crea, con qué fecha y en qué cuenta— antes de que el usuario confirme.

Estas reglas SHALL aplicar por igual en web y en la app nativa.

#### Scenario: El aviso está en el inicio

- **WHEN** el usuario abre la aplicación y tiene ocurrencias recurrentes sin resolver
- **THEN** las ve desde la pantalla de inicio, sin navegar a Movimientos ni al hub

#### Scenario: Con vencidos el bloque no arranca plegado

- **WHEN** el usuario tiene tres ocurrencias sin resolver, al menos una ya vencida
- **THEN** el bloque se muestra expandido

#### Scenario: El lenguaje no afirma deuda

- **WHEN** el bloque agrupa tres ocurrencias sin resolver de una misma regla
- **THEN** el rótulo las presenta como pagos por revisar
- **AND** no afirma que el usuario debe esa suma
