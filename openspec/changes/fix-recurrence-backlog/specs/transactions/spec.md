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

El sistema SHALL distinguir cuatro instantes que hoy se pisan entre sí, y ninguno SHALL derivarse de
otro:

- **vencimiento** (`due_date`) — cuándo tocaba, fijado por el calendario de la regla, inmutable;
- **fecha de pago** (`transactions.date`) — cuándo salió la plata, elegida por el usuario;
- **fecha de carga** (`transactions.created_at`) — cuándo quedó registrado el movimiento;
- **fecha de resolución** (`resolved_at`) — cuándo se resolvió la ocurrencia.

Una ocurrencia **sin resolver** SHALL tener únicamente vencimiento: los otros tres nacen al
resolverla. `scheduled_date` NO SHALL usarse como fecha de pago; se retira, y durante la transición
solo puede sobrevivir como alias de lectura del vencimiento.

El sistema SHALL registrar además **cómo** se resolvió cada ocurrencia: con un movimiento **creado**
por la recurrencia, o con un movimiento preexistente **vinculado** por el usuario. Ese dato SHALL
gobernar qué hace deshacer.

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

#### Scenario: Una ocurrencia sin resolver no tiene fecha de pago

- **WHEN** el sistema materializa una ocurrencia vencida que el usuario todavía no resolvió
- **THEN** la ocurrencia tiene vencimiento
- **AND** no tiene fecha de pago, ni de carga, ni de resolución

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
ocurrencia. La ocurrencia SHALL quedar marcada como resuelta **por vinculación**, distinta de
resuelta por un movimiento creado por la recurrencia.

Un movimiento vinculado SHALL rotularse como **"vinculado a esta recurrencia"** y NO como "originado
en" ella: existía antes y la recurrencia no lo creó.

Cuando la regla es **compartida con un hogar**, vincular NO SHALL alterar la deuda entre miembros sin
que el usuario lo sepa:

- si el movimiento ya tiene un **reparto compatible** con el de la regla, SHALL vincularse directo;
- si el movimiento es **personal**, el sistema SHALL explicar que va a convertirse en gasto compartido
  con el reparto de la regla y SHALL pedir confirmación explícita;
- si el movimiento ya es compartido con **otro hogar o con otro reparto**, NO SHALL ofrecerse como
  candidato. Reemplazar un reparto existente destruiría una deuda que el otro miembro ya ve.

La conversión y la vinculación SHALL aplicarse dentro de una **única transacción de base de datos**:
NO SHALL quedar un movimiento convertido a compartido sin vincular, ni una ocurrencia vinculada sin
el reparto aplicado. Lo mismo aplica a deshacer esa resolución, que revierte el reparto y desvincula.

#### Scenario: Vincular no duplica el gasto

- **WHEN** el usuario ya había cargado a mano el gasto del alquiler y lo vincula a la ocurrencia
  correspondiente
- **THEN** no se crea ningún movimiento nuevo
- **AND** el total de gastos del mes no cambia
- **AND** la ocurrencia queda resuelta y el movimiento aparece como vinculado a la regla, no como originado en ella

#### Scenario: Vincular a una regla compartida pide confirmación

- **WHEN** el usuario vincula un gasto personal a una ocurrencia de una regla compartida 50·50
- **THEN** el sistema explica que el movimiento se va a registrar como gasto compartido con ese
  reparto y pide confirmación
- **AND** sin confirmación no se modifica ni el movimiento ni la ocurrencia

#### Scenario: Un movimiento con otro reparto no se ofrece para vincular

- **WHEN** el usuario busca un movimiento para vincular a una ocurrencia de una regla compartida y
  existe uno compartido con otro hogar o con un reparto distinto
- **THEN** ese movimiento no aparece entre los candidatos
- **AND** ninguna deuda existente se modifica

#### Scenario: La conversión a compartido y la vinculación son atómicas

- **WHEN** falla la vinculación de un movimiento que el sistema estaba convirtiendo a compartido
- **THEN** el movimiento queda como estaba, sin reparto
- **AND** la deuda del hogar no cambia

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

La resolución en bloque SHALL ser **atómica dentro de una única transacción de base de datos**, y NO
SHALL apoyarse en deshacer lo hecho ante un error: un rollback compensatorio también puede fallar
—una interrupción después de crear los movimientos deja al usuario con movimientos creados y
ocurrencias sin resolver, sin forma de repetir la operación sin duplicar—. O se aplican todos los
cambios del grupo o no se aplica ninguno. Ante un fallo, el sistema SHALL informarlo y dejar el grupo
exactamente como estaba.

El importe que el usuario corrija SHALL afectar **únicamente esa ocurrencia** y NO SHALL modificar el
importe de la regla — de lo contrario, resolver varias ocurrencias con importes distintos dejaría la
regla con un valor que depende del orden de ejecución. Actualizar la regla SHALL ser una acción
explícita y separada, aplicada una sola vez y tomando el importe de la ocurrencia **más reciente** del
grupo.

Dejar una ocurrencia sin resolver NO SHALL impedir resolver las demás ni bloquear la generación de
las siguientes.

#### Scenario: Ponerse al día corrigiendo cada pago

- **WHEN** una regla tiene sin resolver los vencimientos de junio, julio y agosto, y el usuario los
  resuelve juntos con importes distintos entre sí y uno pagado desde otra cuenta
- **THEN** se crean tres movimientos, cada uno con el importe, la fecha y la cuenta que el usuario
  indicó
- **AND** ninguno usa el importe de la regla cuando el usuario lo corrigió

#### Scenario: Corregir importes no reescribe la regla

- **WHEN** el usuario resuelve tres ocurrencias con importes distintos entre sí
- **THEN** cada movimiento se crea con su propio importe
- **AND** el importe de la regla no cambia, cualquiera sea el orden en que se procesaron

#### Scenario: Un fallo a mitad de camino no deja el grupo partido

- **WHEN** el usuario resuelve tres ocurrencias juntas y la tercera falla
- **THEN** no se crea ningún movimiento
- **AND** las tres ocurrencias siguen sin resolver
- **AND** el sistema informa que la operación no se aplicó

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

Un fallo de materialización NO SHALL descartarse en silencio. El sistema SHALL distinguir "no hay
vencimientos por revisar" de "no pudimos actualizarlos", SHALL informar el fallo y SHALL ofrecer
reintentar. Hoy el error se descarta y la pantalla queda idéntica a la de un usuario al día, que es
la afirmación opuesta a la verdadera.

#### Scenario: Entrar al inicio alcanza para que aparezca lo vencido

- **WHEN** el usuario abre la aplicación en el inicio, sin pasar por Movimientos ni por el hub de
  recurrencias, y tiene una ocurrencia vencida
- **THEN** la ocurrencia queda materializada y visible

#### Scenario: Un fallo al actualizar no se muestra como "estás al día"

- **WHEN** la materialización de ocurrencias vencidas falla
- **THEN** el sistema informa que no pudo actualizarlas y ofrece reintentar
- **AND** no presenta la pantalla como si el usuario no tuviera nada por revisar

#### Scenario: El feed nativo materializa igual que el web

- **WHEN** el usuario abre el feed de movimientos de la app nativa y tiene una ocurrencia vencida
- **THEN** la ocurrencia queda materializada, con el mismo resultado que en web

### Requirement: Una regla pausada no acumula vencimientos durante la pausa

El sistema NO SHALL materializar las ocurrencias cuyo vencimiento cae mientras la regla está pausada,
y NO SHALL recuperarlas al reanudarla: pausar significa que la regla no está corriendo, no que se
sigue devengando para cobrarse junta después.

Las ocurrencias que ya existían **antes** de la pausa SHALL seguir visibles y resolubles, señaladas
como pertenecientes a una regla pausada, de modo que el usuario pueda registrarlas u omitirlas.

Al reanudar, el sistema SHALL tomar el **próximo vencimiento futuro respetando el calendario
original** de la regla, sin desplazarlo por la duración de la pausa.

#### Scenario: Reanudar no trae los períodos de la pausa

- **WHEN** una regla mensual del día 23 se pausa en junio y se reanuda el `2026-09-05`
- **THEN** el próximo vencimiento es el `2026-09-23`
- **AND** no se materializan vencimientos de junio, julio ni agosto

#### Scenario: Lo anterior a la pausa sigue disponible

- **WHEN** una regla tenía un vencimiento sin resolver antes de pausarse
- **THEN** ese vencimiento sigue visible y resoluble
- **AND** se muestra señalado como perteneciente a una regla pausada

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

El sistema SHALL materializar las ocurrencias vencidas dentro de un **horizonte de 12 meses hacia
atrás, inclusive**, calculado con la **fecha financiera argentina**. El horizonte SHALL aplicar
únicamente a la **reconstrucción automática**: el usuario SHALL poder registrar a mano un pago más
viejo en cualquier momento.

Las ocurrencias anteriores al horizonte NO SHALL materializarse. El sistema SHALL señalarlo **en la
recurrencia**, nombrando desde cuándo reconstruyó, y NO SHALL afirmar que el período tiene
información incompleta: esos pagos pueden haberse registrado a mano en su momento.

El horizonte NO acota por sí solo el volumen —doce meses de una regla diaria son unas 365
ocurrencias—, así que la materialización SHALL hacerse por **tandas acotadas**: abrir una pantalla NO
SHALL disparar cientos de escrituras, y la tanda SHALL completarse a lo largo de sucesivas aperturas,
con la ocurrencia vigente siempre en la primera.

Mientras queden ocurrencias por reconstruir, el sistema SHALL indicarlo **y SHALL ofrecer continuar
la reconstrucción sin cerrar la aplicación**. Sin el aviso, una lista que crece sola entre visitas es
indistinguible de un error; sin la acción, un atraso grande obligaría al usuario a abrir y cerrar la
app tantas veces como tandas queden, que no es una tarea que se le pueda pedir.

Una ocurrencia materializada por este mecanismo SHALL ser un **elemento por revisar**, no un
movimiento: NO SHALL impactar saldos, ni el gasto del mes, ni resúmenes de tarjeta hasta que el
usuario la resuelva.

Cuando el cronograma de una regla se edita, el cambio SHALL regir **desde una fecha de vigencia** y
NO SHALL reinterpretar las ocurrencias anteriores a ella. Sin esa regla, el sistema leería la
diferencia entre el cronograma nuevo y el historial viejo como huecos, y materializaría vencimientos
que nunca correspondieron.

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
- **AND** las anteriores dentro del horizonte siguen siendo accesibles y resolubles

#### Scenario: Más allá del horizonte se avisa en la recurrencia

- **WHEN** una regla mensual arrancó hace tres años y nunca se resolvió ninguna ocurrencia
- **THEN** se materializan las ocurrencias de los últimos 12 meses
- **AND** la recurrencia avisa que tiene historial anterior que no fue reconstruido
- **AND** no se afirma que esos meses tengan información incompleta
- **AND** ningún saldo cambia por esa materialización

#### Scenario: Un atraso voluminoso no se materializa de una sola vez

- **WHEN** una regla diaria acumula un año de ocurrencias sin resolver y el usuario abre la app
- **THEN** la ocurrencia vigente queda materializada
- **AND** la pantalla no queda bloqueada esperando cientos de escrituras
- **AND** las restantes se completan en sucesivas aperturas
- **AND** mientras queden pendientes de reconstruir, la app lo indica en vez de aparentar que terminó

#### Scenario: El usuario puede continuar la reconstrucción sin salir

- **WHEN** quedan ocurrencias por reconstruir después de la primera tanda
- **THEN** la app ofrece continuar la reconstrucción
- **AND** al usarla se procesa otra tanda sin cerrar ni volver a abrir la aplicación

#### Scenario: Cambiar la frecuencia no fabrica vencimientos anteriores

- **WHEN** una regla mensual con seis meses de historial resuelto se edita a quincenal
- **THEN** no se materializa ninguna ocurrencia con fecha anterior a la vigencia del cambio
- **AND** las ocurrencias ya resueltas conservan su vencimiento original

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
La cuenta SHALL ser un override de esa ocurrencia y NO SHALL redefinir la cuenta de la regla. El
importe SHALL comportarse igual: afecta solo a esa ocurrencia y NO SHALL reescribir el de la regla.

Registrar un pago NO SHALL avanzar el cursor de generación de la regla: la ocurrencia queda resuelta
por su propia identidad, de modo que registrar pagos en cualquier orden es seguro.

Estas capacidades SHALL estar disponibles por igual en web y en la app nativa, incluida la
advertencia de saldo negativo que hoy solo existe en web.

#### Scenario: Registrar un pago con otra fecha conserva el vencimiento

- **WHEN** el usuario registra el pago de la ocurrencia que vencía el `2026-06-23`, con fecha
  `2026-09-03`
- **THEN** se crea un movimiento fechado el `2026-09-03`
- **AND** la ocurrencia conserva el `2026-06-23` como vencimiento

#### Scenario: Registrar un importe distinto no reescribe la regla

- **WHEN** el usuario registra el pago de una ocurrencia con un importe distinto al de la regla
- **THEN** el movimiento se crea con el importe que el usuario indicó
- **AND** el importe de la regla no cambia

#### Scenario: Confirmar consumo recurrente de tarjeta

- **WHEN** el usuario registra el pago de una ocurrencia de gasto recurrente en tarjeta de crédito
- **THEN** el sistema crea un consumo de tarjeta con `status='pending'`, `card_period_id` y `due_date`
- **AND** NO exige cotización aunque la moneda sea USD: la conversión se resuelve al pagar el resumen,
  con la cotización de ese día
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

Omitir SHALL ser una operación distinta de **deshacer la resolución** de una ocurrencia. Deshacer
SHALL devolver la ocurrencia al estado **sin resolver** —nunca a omitida, porque eso afirmaría que el
período no correspondía cuando el usuario solo se equivocó— y SHALL actuar sobre el movimiento según
**cómo** se había resuelto:

- si el movimiento lo **creó la recurrencia**, deshacer SHALL eliminarlo;
- si el usuario había **vinculado** un movimiento suyo, deshacer SHALL **conservarlo** —vuelve a ser
  un movimiento suelto— y solo SHALL romper el vínculo.

Borrar un movimiento que la recurrencia no creó destruiría un dato del usuario que el sistema nunca
tuvo derecho a producir.

Cuando la vinculación hubiera **convertido** un movimiento personal en compartido, deshacer SHALL
revertir también esa conversión —devolverlo a personal y deshacer la deuda que generó— además de
romper el vínculo. Si el movimiento ya era compartido antes de vincularse, deshacer SHALL únicamente
desvincular. Ambas SHALL ser atómicas: un movimiento desvinculado que quedara compartido dejaría la
deuda del hogar movida por una operación que el usuario deshizo.

Omitir una ocurrencia NO SHALL impedir que se materialicen ni se resuelvan las siguientes.

#### Scenario: Omitir no crea movimiento

- **WHEN** el usuario omite una ocurrencia sin resolver
- **THEN** la ocurrencia queda omitida
- **AND** no se inserta ninguna fila en `transactions`

#### Scenario: Deshacer un pago creado por la recurrencia elimina el movimiento

- **WHEN** el usuario deshace un pago que había registrado desde la recurrencia
- **THEN** el movimiento se elimina
- **AND** la ocurrencia vuelve a estar sin resolver, no omitida
- **AND** el usuario puede volver a registrarla

#### Scenario: Deshacer una vinculación que convirtió el movimiento revierte la conversión

- **WHEN** el usuario deshace una ocurrencia compartida que había resuelto vinculando un movimiento
  personal, que el sistema convirtió a compartido al vincularlo
- **THEN** el movimiento se conserva y vuelve a ser personal
- **AND** la deuda del hogar vuelve a su estado anterior
- **AND** la ocurrencia vuelve a estar sin resolver

#### Scenario: Deshacer una vinculación conserva el movimiento

- **WHEN** el usuario deshace la resolución de una ocurrencia que había resuelto vinculando un
  movimiento suyo
- **THEN** el movimiento se conserva y vuelve a figurar como un movimiento suelto
- **AND** la ocurrencia vuelve a estar sin resolver
- **AND** el total de gastos del mes no cambia

### Requirement: El modulo Movimientos muestra pendientes recurrentes separados del historial

El sistema SHALL mostrar las ocurrencias recurrentes sin resolver en un bloque separado del historial
de movimientos, sin mezclarlas con las transacciones reales.

El bloque SHALL estar presente también en la pantalla de inicio de la aplicación, que es donde
empieza la sesión: hoy vive únicamente en Movimientos y en el hub, de modo que un usuario puede tener
vencimientos sin revisar y no enterarse nunca.

El bloque SHALL estar **expandido siempre que haya al menos una ocurrencia vencida**. NO SHALL
plegarse en función de la cantidad de ocurrencias sin resolver: cuantas más haya, más visible tiene
que ser, no menos.

El lenguaje del bloque SHALL expresar que hay **vencimientos por revisar** y NO SHALL afirmar deuda
ni pago: una ocurrencia sin resolver puede corresponder a un pago que el usuario ya hizo y todavía no
registró, o a uno que no hizo. El sistema NO SHALL rotular el conjunto como dinero adeudado, ni
llamarlo "pagos" —lo que afirmaría que hubo pago, que es justamente lo que no sabe—.

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
- **THEN** el rótulo las presenta como vencimientos por revisar
- **AND** no afirma que el usuario debe esa suma
- **AND** no afirma que esos pagos ya ocurrieron
