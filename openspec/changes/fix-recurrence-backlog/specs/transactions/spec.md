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

**Excepción histórica.** Las ocurrencias resueltas **antes** de que el sistema distinguiera el
vencimiento de la fecha de pago no tienen vencimiento recuperable: el dato fue sobrescrito y no
quedó registrado en ningún lado. Para ellas el sistema SHALL declarar el vencimiento **desconocido**
en vez de aproximarlo, y una ocurrencia con vencimiento desconocido NO SHALL participar de la
identidad ni impedir que se materialice el vencimiento verdadero que le corresponda a esa fecha —
una fecha incierta ocupando una identidad real volvería a bloquear la ocurrencia legítima. El
sistema SHALL permitir corregir un vencimiento desconocido a uno exacto; hecho eso, pasa a ser
inmutable como cualquier otro.

Una vez establecido, un vencimiento exacto SHALL ser inmutable: NO SHALL poder moverse a otra fecha
ni volver a desconocido.

Esa inmutabilidad SHALL sobrevivir al retiro de la columna legada de compatibilidad. Hoy la sostiene
el mismo guard de base que deriva esa columna, así que la entrega que la retire NO SHALL eliminar el
guard entero —eso reabriría el agujero que este change cierra—: SHALL quitar únicamente sus ramas de
compatibilidad, o reemplazarlo por un guard con nombre propio que conserve la regla.

El sistema SHALL distinguir cuatro instantes que hoy se pisan entre sí, y ninguno SHALL derivarse de
otro:

- **vencimiento** (`due_date`) — cuándo tocaba, fijado por el calendario de la regla, inmutable;
- **fecha de pago** (`transactions.date`) — cuándo salió la plata, elegida por el usuario;
- **fecha de carga** (`transactions.created_at`) — cuándo quedó registrado el movimiento;
- **fecha de resolución** (`resolved_at`) — cuándo se resolvió la ocurrencia.

Una ocurrencia **sin resolver** SHALL tener únicamente vencimiento: los otros tres nacen al
resolverla. `scheduled_date` se retira, y durante la transición sobrevive únicamente como **columna
legada de compatibilidad**.

**Qué significa `scheduled_date` en una ocurrencia histórica: una fecha legada de significado
incierto.** No se sabe si es el vencimiento que le dio origen o la fecha en que se resolvió, porque un
cliente anterior al despliegue la sobrescribe al resolver. En consecuencia:

- PUEDE usarse **únicamente** para ubicar aproximadamente la fila en una vista histórica, que es
  mejor que no mostrarla en ninguna;
- NO SHALL leerse como **vencimiento**, ni como **fecha de pago**, ni como **identidad** de la
  ocurrencia;
- NO SHALL **tapar una fecha del calendario**: una fecha incierta que reserva un día impediría
  materializar la ocurrencia real de ese día, que es el bloqueo que este change existe para quitar.

El sistema SHALL registrar además **cómo** se resolvió cada ocurrencia: con un movimiento **creado**
por la recurrencia, o con un movimiento preexistente **vinculado** por el usuario. Ese dato SHALL
escribirse en el momento de resolver, porque no es reconstruible después: es lo único que distingue un
movimiento que el sistema produjo de uno que ya era del usuario.

Resolver una ocurrencia —registrando un pago, vinculando un movimiento existente u omitiéndola— NO
SHALL alterar el cursor de generación de la regla. El sistema SHALL derivar qué falta materializar
del cronograma de la regla y del conjunto de ocurrencias ya existentes, de modo que resolverlas en
cualquier orden NO SHALL producir duplicados ni saltear ocurrencias.

#### Scenario: El vencimiento sobrevive a un pago con otra fecha

- **WHEN** una ocurrencia vence el `2026-06-23` y el usuario registra su pago con fecha `2026-09-03`
- **THEN** la ocurrencia conserva `2026-06-23` como vencimiento
- **AND** el movimiento creado queda fechado el `2026-09-03`
- **AND** el vencimiento de junio no vuelve a materializarse

#### Scenario: Resolver fuera de orden no regenera lo ya resuelto

- **WHEN** una regla mensual tiene sin resolver los vencimientos de junio, julio y agosto, y el
  usuario resuelve primero el de agosto y después el de julio
- **THEN** el vencimiento de agosto NO vuelve a materializarse
- **AND** el de junio sigue disponible sin resolver

#### Scenario: Una ocurrencia sin resolver no tiene fecha de pago

- **WHEN** el sistema materializa una ocurrencia vencida que el usuario todavía no resolvió
- **THEN** la ocurrencia tiene vencimiento
- **AND** no tiene fecha de pago, ni de carga, ni de resolución

#### Scenario: Un vencimiento histórico desconocido no bloquea el verdadero

- **WHEN** una ocurrencia resuelta antes de la distinción quedó con su vencimiento desconocido, y el
  sistema debe materializar el vencimiento real que cae en la fecha que esa ocurrencia tiene
  registrada como fecha de pago
- **THEN** el vencimiento real se materializa
- **AND** la ocurrencia histórica se conserva, con su vencimiento declarado desconocido

#### Scenario: Un vencimiento exacto no se puede mover ni borrar

- **WHEN** se intenta cambiar el vencimiento de una ocurrencia que ya lo tiene establecido, o
  declararlo desconocido
- **THEN** el sistema rechaza la operación

#### Scenario: La misma ocurrencia no puede existir dos veces

- **WHEN** un proceso intenta materializar una ocurrencia cuyo vencimiento ya tiene una instancia,
  sea pendiente, pagada u omitida
- **THEN** el sistema no crea una segunda instancia para ese vencimiento

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

Las ocurrencias que ya existían **antes** de la pausa SHALL seguir visibles y resolubles, de modo que
el usuario pueda registrarlas u omitirlas: pausar una regla NO SHALL ocultarlas ni resolverlas por su
cuenta.

Al reanudar, el sistema SHALL tomar el **próximo vencimiento futuro respetando el calendario
original** de la regla, sin desplazarlo por la duración de la pausa.

#### Scenario: Reanudar no trae los períodos de la pausa

- **WHEN** una regla mensual del día 23 se pausa en junio y se reanuda el `2026-09-05`
- **THEN** el próximo vencimiento es el `2026-09-23`
- **AND** no se materializan vencimientos de junio, julio ni agosto

#### Scenario: Lo anterior a la pausa sigue disponible

- **WHEN** una regla tenía un vencimiento sin resolver antes de pausarse
- **THEN** ese vencimiento sigue visible y resoluble
- **AND** pausar la regla no lo oculta ni lo resuelve por su cuenta

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

Las ocurrencias anteriores al horizonte NO SHALL materializarse. El sistema NO SHALL afirmar que el
período tiene información incompleta: esos pagos pueden haberse registrado a mano en su momento.

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
- **AND** el usuario puede resolver cualquiera de ellas por separado, en el orden que quiera

#### Scenario: Una ocurrencia sin resolver no bloquea la siguiente

- **WHEN** una regla mensual tiene la ocurrencia de junio sin resolver y llega el vencimiento de julio
- **THEN** la ocurrencia de julio se materializa igual
- **AND** el usuario puede resolver la de julio sin haber tocado la de junio

#### Scenario: Un atraso largo no deja afuera lo que vence hoy

- **WHEN** una regla diaria acumula noventa ocurrencias sin resolver
- **THEN** la ocurrencia vigente queda materializada
- **AND** las anteriores dentro del horizonte siguen siendo accesibles y resolubles

#### Scenario: Más allá del horizonte no se reconstruye

- **WHEN** una regla mensual arrancó hace tres años y nunca se resolvió ninguna ocurrencia
- **THEN** se materializan las ocurrencias de los últimos 12 meses
- **AND** no se materializa ninguna anterior
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

**En web**, el usuario SHALL poder ajustar **fecha de pago, importe y cuenta** al registrar, y SHALL
recibir la advertencia correspondiente si la cuenta quedara en negativo. **En la app nativa**, el
registro SHALL usar los valores propuestos por la regla, sin edición.

Cualquiera sea la plataforma y el valor con que se registre: la fecha SHALL ser la del movimiento y NO
SHALL sobrescribir el vencimiento de la ocurrencia, que se conserva. La cuenta SHALL ser un override
de esa ocurrencia y NO SHALL redefinir la cuenta de la regla. El importe SHALL comportarse igual:
afecta solo a esa ocurrencia y NO SHALL reescribir el de la regla.

Registrar un pago NO SHALL avanzar el cursor de generación de la regla: la ocurrencia queda resuelta
por su propia identidad, de modo que registrar pagos en cualquier orden es seguro.

Lo que SHALL estar disponible por igual en web y en la app nativa es la **materialización** del
atraso y el **bloque de vencimientos por revisar**: que una ocurrencia exista, se vea y se pueda
resolver NO SHALL depender de la plataforma.

#### Scenario: Registrar un pago con otra fecha conserva el vencimiento (web)

- **WHEN** el usuario registra el pago de la ocurrencia que vencía el `2026-06-23`, con fecha
  `2026-09-03`
- **THEN** se crea un movimiento fechado el `2026-09-03`
- **AND** la ocurrencia conserva el `2026-06-23` como vencimiento

#### Scenario: Registrar un importe distinto no reescribe la regla (web)

- **WHEN** el usuario registra el pago de una ocurrencia con un importe distinto al de la regla
- **THEN** el movimiento se crea con el importe que el usuario indicó
- **AND** el importe de la regla no cambia

#### Scenario: Confirmar consumo recurrente de tarjeta

- **WHEN** el usuario registra el pago de una ocurrencia de gasto recurrente en tarjeta de crédito
- **THEN** el sistema crea un consumo de tarjeta con `status='pending'`, `card_period_id` y `due_date`
- **AND** NO exige cotización aunque la moneda sea USD: la conversión se resuelve al pagar el resumen,
  con la cotización de ese día
- **AND** el saldo cash/bank no cambia

#### Scenario: Confirmar consumo de tarjeta en periodo pagado falla

- **WHEN** una ocurrencia recurrente de tarjeta tiene fecha dentro de un periodo ya pagado
- **THEN** el registro falla con error explicativo
- **AND** no se crea ninguna transaccion
- **AND** la ocurrencia permanece sin resolver para que el usuario edite la fecha u omita

### Requirement: El usuario puede omitir una instancia recurrente

El sistema SHALL permitir omitir una ocurrencia recurrente. Omitir SHALL resolverla sin crear
transacción y sin modificar saldos ni resúmenes, y SHALL significar que **ese período no
corresponde** — no que hubo un error de carga.

Omitir SHALL ser una operación distinta de **deshacer la resolución** de una ocurrencia: deshacer
devuelve la ocurrencia al estado *sin resolver*, nunca a omitida, porque eso afirmaría que el período
no correspondía cuando el usuario solo se equivocó. El sistema SHALL registrar **cómo** se resolvió
cada ocurrencia, que es el dato del que depende esa distinción.

Omitir una ocurrencia NO SHALL impedir que se materialicen ni se resuelvan las siguientes.

#### Scenario: Omitir no crea movimiento

- **WHEN** el usuario omite una ocurrencia sin resolver
- **THEN** la ocurrencia queda omitida
- **AND** no se inserta ninguna fila en `transactions`

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
