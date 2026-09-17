## MODIFIED Requirements

### Requirement: El usuario puede confirmar una instancia recurrente

El sistema SHALL permitir registrar el pago de una ocurrencia recurrente. Al registrarlo, el sistema
SHALL crear una transacción real usando el mismo contrato de creación que usa un movimiento manual
del mismo tipo, y la ocurrencia SHALL quedar vinculada a la transacción creada.

**REGISTRAR NO ESPERA AL VENCIMIENTO.** El sistema SHALL permitir registrar el pago de un vencimiento
**cuya fecha todavía no llegó**, sin exigir que la ocurrencia ya esté materializada. Quien paga el
alquiler el 3 no tiene por qué esperar al 23 para decirlo, y la alternativa que hoy le queda —cargar
el gasto a mano— produce exactamente el duplicado que el vencimiento del 23 va a proponerle después.

Al registrarse de forma anticipada, el vencimiento SHALL quedar resuelto **bajo su propia identidad**
—la fecha en que vencía, no la del pago—, de modo que el generador reconozca esa fecha como cubierta
cuando llegue y NO la vuelva a producir. La resolución anticipada SHALL dejar el mismo estado que
habría dejado resolverla el día del vencimiento: el sistema NO SHALL crear una ocurrencia pendiente
fechada en el futuro como paso intermedio, porque una ocurrencia pendiente con fecha futura aparecería
en el bloque de vencimientos por revisar anunciando como pendiente algo que el usuario acaba de pagar.

Registrar de forma anticipada NO SHALL mover el calendario de la regla: el vencimiento siguiente
SHALL ser el que el calendario ya preveía. El ritmo pertenece a la obligación, no a la fecha en que
el usuario eligió pagarla.

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

#### Scenario: Registrar un pago antes de que el vencimiento llegue

- **WHEN** hoy es el `2026-09-03`, una regla mensual vence el `2026-09-23` y esa ocurrencia todavía no
  está materializada, y el usuario registra su pago con fecha de hoy
- **THEN** se crea un movimiento fechado el `2026-09-03`
- **AND** la ocurrencia del `2026-09-23` queda resuelta conservando el `2026-09-23` como vencimiento
- **AND** en ningún momento queda una ocurrencia pendiente en el bloque de vencimientos por revisar

#### Scenario: Un vencimiento pagado antes no se vuelve a proponer al llegar su fecha

- **WHEN** el usuario registró el `2026-09-03` el pago del vencimiento del `2026-09-23`, y llega el
  `2026-09-23`
- **THEN** el generador NO produce una ocurrencia para el `2026-09-23`
- **AND** el bloque de vencimientos por revisar no muestra nada de esa regla por esa fecha

#### Scenario: Pagar antes no adelanta el vencimiento siguiente

- **WHEN** el usuario registra el `2026-09-03` el pago del vencimiento del `2026-09-23` de una regla
  mensual
- **THEN** el próximo vencimiento de la regla sigue siendo el `2026-10-23`
- **AND** NO es el `2026-10-03`

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

#### Scenario: Confirmar gasto cash/bank recurrente

- **WHEN** el usuario confirma una instancia de gasto recurrente en cuenta cash o bank
- **THEN** el sistema crea una transaccion `type='expense'` con `status=NULL`
- **AND** el saldo de esa cuenta baja segun las reglas existentes

#### Scenario: Confirmar transferencia recurrente

- **WHEN** el usuario confirma una instancia de transferencia recurrente
- **THEN** el sistema crea una transaccion `type='transfer'`
- **AND** el saldo de la cuenta origen baja y el de la cuenta destino sube

### Requirement: Una regla con límite de vencimientos dice en qué punto está y cuándo va a terminar

Cuando una regla tiene `max_occurrences`, su detalle SHALL mostrar **cuántos vencimientos lleva de cuántos**, **cuántos le quedan** y **la fecha del último vencimiento previsto**. Un límite que decide cuándo la regla deja de avisar y que el usuario no puede leer en ninguna pantalla es indistinguible de no tener límite, y la regla parece indefinida hasta el día en que deja de recordar.

El conteo SHALL expresarse en **posiciones del calendario de la regla**, la misma unidad que usa el corte de la generación (ver "La generación de instancias recurrentes usa intervalo+unidad y corta por la primera condición de fin"). NO SHALL contarse por filas de `recurrence_instances`: una regla sembrada por un movimiento no tiene fila para su primera ocurrencia, y una posición producida mientras nada estaba generando tampoco — contar filas le atribuye a una regla agotada vencimientos que no le quedan.

**UNA POSICIÓN SE CONSUME AL LLEGAR SU FECHA O AL RESOLVERSE ANTES, LO QUE PASE PRIMERO — Y UNA SOLA VEZ.** Las dos condiciones SHALL combinarse como una unión, nunca como una suma: una posición cuya fecha llegó **y** que además está resuelta cuenta **una**. Sin la segunda condición, quien paga el vencimiento del 23 el día 3 ve la regla en «0 de 3» con un vencimiento ya resuelto, y el avance queda atrasado hasta un intervalo entero. Sin la unión, esa misma posición se contaría dos veces al llegar su fecha y el plan perdería un vencimiento que nunca se usó.

**ESTAR POR REVISAR Y HABER CONSUMIDO UNA POSICIÓN SON COSAS DISTINTAS.** Devolver una ocurrencia a *sin resolver* SHALL cambiar sólo lo primero. Si su fecha **todavía no llegó**, la posición vuelve a estar disponible y el avance retrocede; si su fecha **ya pasó**, la posición sigue consumida aunque la ocurrencia esté otra vez por revisar, porque el calendario ya la produjo y ningún estado de resolución puede devolverle a la regla un día que transcurrió. En los dos casos el plan SHALL conservar exactamente las posiciones que tenía: resolver, deshacer y volver a resolver NO SHALL agregar ninguna.

**UNA PAUSA MIRA HACIA ADELANTE.** El día en que se pausa una regla SHALL seguir perteneciendo a su calendario: una pausa afecta los días **posteriores** al que se abre. La regla estuvo activa parte de ese día, así que la ocurrencia que cae ahí es suya —**haya corrido o no el generador todavía**— y una pausa NO SHALL quitarle a la regla esa posición. Si el generador ya pasó, la instancia existe y la posición está gastada; si todavía no pasó, la posición sigue debida y se va a producir. El estado del generador no cambia de quién es el día.

Esto no es una sutileza de presentación: el mismo conteo corta la generación. Con la lectura anterior, una regla de 3 vencimientos que produjo el primero y se pausó ese mismo día quedaba en «0 de 3» y seguía generando **tres más** — cuatro cuotas en un plan de tres. Una fecha no lleva hora, así que el calendario no puede saber si la pausa fue antes o después de la ocurrencia de ese día; la regla se resuelve en la única dirección que no puede destruir un compromiso ya asumido.

La fecha guardada en `paused_from` SHALL seguir siendo el día real en que el usuario pausó. Lo que cambia es cómo se **lee** el intervalo, no lo que se registra: guardar el día siguiente haría que el historial mienta sobre cuándo ocurrió.

El **último vencimiento previsto** SHALL calcularse con el mismo caminante de calendario que produce las fechas reales, honrando versiones de cronograma, pausas y correcciones de ancla. NO SHALL persistirse: una regla que se pausa o a la que se le corrige el día de vencimiento cambia esa fecha, y un valor guardado quedaría mintiendo.

**UNA REGLA PAUSADA NO TIENE FECHA FINAL, Y ESO NO ES LO MISMO QUE NO TENER FUTURO.** Son dos preguntas distintas y SHALL responderse por separado:

- **«¿le queda algo?»** — se responde igual que en cualquier otra regla, preguntándole al calendario si produciría alguna ocurrencia; para una regla pausada esa pregunta SHALL evaluarse **como si se reanudara hoy**, ignorando la pausa abierta. Una pausa abierta hace que el caminante no produzca ninguna fecha, así que preguntarle sin más daría que toda regla pausada terminó — y una pausa es una interrupción, no un final.
- **«¿cuándo termina?»** — no tiene respuesta mientras la pausa esté abierta: la fecha del último vencimiento depende de cuándo el usuario reanude, y eso todavía no pasó.

El sistema SHALL mostrar el avance de todas formas —las posiciones gastadas no dependen del futuro— y en lugar de una fecha SHALL decir que el final se calcula al reanudar. NO SHALL mostrar una fecha estimada como si fuera cierta.

Una regla **sin** `max_occurrences` NO SHALL mostrar ninguno de estos datos —no hay tope contra el cual medir un avance—, y lo que su detalle diga sobre el final SHALL depender de su `end_date`: si la tiene, SHALL decir que termina en esa fecha; sólo si no tiene ninguna de las dos SHALL decir que se repite sin límite. Decirle «sin límite» a una regla que termina el 31 de diciembre es afirmar lo contrario de lo que la regla hace.

#### Scenario: El detalle muestra el avance del plan

- **WHEN** el usuario abre una regla mensual con `max_occurrences = 11` que ya gastó una posición, anclada al 10 de septiembre de 2026
- **THEN** el detalle muestra que lleva 1 de 11 vencimientos
- **AND** que le quedan 10
- **AND** que el último vencimiento previsto es el 10 de julio de 2027

#### Scenario: Resolver un vencimiento antes de su fecha consume su posición

- **WHEN** hoy es el `2026-09-03` y una regla con `max_occurrences = 3` —vencimientos el `2026-09-23`,
  el `2026-10-23` y el `2026-11-23`— tiene resuelto el del `2026-09-23`
- **THEN** el detalle muestra que lleva 1 de 3
- **AND** le quedan el `2026-10-23` y el `2026-11-23`

#### Scenario: La posición resuelta antes no se cuenta otra vez al llegar su fecha

- **WHEN** la regla del escenario anterior llega al `2026-09-23` con ese vencimiento ya resuelto
- **THEN** el detalle sigue mostrando que lleva 1 de 3
- **AND** NO muestra 2 de 3

#### Scenario: Devolver a revisión antes del vencimiento libera la posición

- **WHEN** hoy es el `2026-09-05`, el vencimiento del `2026-09-23` estaba resuelto y el usuario lo
  devuelve a *sin resolver*
- **THEN** el vencimiento del `2026-09-23` queda por revisar
- **AND** el detalle vuelve a mostrar 0 de 3, porque su fecha todavía no llegó
- **AND** el plan sigue teniendo tres posiciones: `2026-09-23`, `2026-10-23` y `2026-11-23`

#### Scenario: Devolver a revisión después del vencimiento conserva la posición

- **WHEN** hoy es el `2026-09-25`, el vencimiento del `2026-09-23` estaba resuelto y el usuario lo
  devuelve a *sin resolver*
- **THEN** el vencimiento del `2026-09-23` queda por revisar
- **AND** el detalle sigue mostrando 1 de 3, porque su fecha ya pasó
- **AND** el plan sigue teniendo tres posiciones, sin agregar una cuarta

#### Scenario: Pausar el día de un vencimiento no borra ese vencimiento

- **WHEN** una regla mensual con `max_occurrences = 3` produce su primera ocurrencia hoy y el usuario pausa la regla ese mismo día
- **THEN** el detalle sigue mostrando que lleva 1 de 3
- **AND** la regla NO genera una cuarta ocurrencia cuando se reanuda

#### Scenario: Pausar antes de que corra el generador tampoco borra el vencimiento de ese día

- **WHEN** el usuario pausa una regla el día en que le toca vencer, antes de que el generador haya creado la instancia
- **THEN** ese vencimiento sigue debido
- **AND** el avance de la regla lo cuenta igual que si la instancia ya existiera

#### Scenario: Una pausa reanudada días después saltea sólo los días intermedios

- **WHEN** una regla se pausa un día y se reanuda dos días más tarde
- **THEN** la ocurrencia del día en que se pausó sigue contando
- **AND** sólo el día estrictamente interior a la pausa queda sin producir

#### Scenario: El avance no cuenta filas

- **WHEN** una regla creada a partir de un movimiento tiene `max_occurrences = 3` y su primera ocurrencia está cubierta por el movimiento semilla, que no tiene fila en `recurrence_instances`
- **THEN** el detalle informa que lleva 1 de 3, no 0 de 3

#### Scenario: El último vencimiento previsto se mueve con la regla

- **WHEN** el usuario corrige la fecha de referencia de una regla con límite
- **THEN** el último vencimiento previsto que muestra el detalle se recalcula según el cronograma corregido

#### Scenario: Una regla pausada muestra el avance pero no una fecha final

- **WHEN** el usuario abre una regla con límite que está pausada, con la pausa todavía abierta
- **THEN** el detalle muestra cuántos vencimientos lleva y cuántos le quedan
- **AND** en lugar del último vencimiento previsto dice que se va a calcular cuando la regla se reanude
- **AND** no muestra ninguna fecha estimada

#### Scenario: Una regla sin límite no inventa un final

- **WHEN** el usuario abre una regla sin `end_date` ni `max_occurrences`
- **THEN** el detalle no muestra avance ni último vencimiento previsto
- **AND** dice que la regla se repite sin límite

#### Scenario: Una regla que termina por fecha no se anuncia como indefinida

- **WHEN** el usuario abre una regla con `end_date` y sin `max_occurrences`
- **THEN** el detalle no muestra avance ni cuántos vencimientos le quedan
- **AND** dice que la regla termina en esa fecha
- **AND** NO dice que se repite sin límite

## ADDED Requirements

### Requirement: El usuario puede vincular un movimiento que ya cargó a un vencimiento

El sistema SHALL permitir resolver un vencimiento señalando un movimiento **que ya existe** en el
historial del usuario, sin crear ninguna transacción nueva. Es la contracara de registrar un pago: el
usuario que ya cargó el gasto a mano necesita decir «esto que cargué el martes es el alquiler de
septiembre», y sin esa salida la app le vuelve a proponer el mismo gasto y lo empuja a cargarlo dos
veces o a perder el rastro de que lo pagó.

Al vincular, la ocurrencia SHALL quedar resuelta apuntando al movimiento existente, el sistema NO
SHALL insertar ninguna fila en `transactions`, y NO SHALL modificarse ningún saldo: ese movimiento ya
estaba contado. La ocurrencia SHALL conservar su vencimiento.

**LOS DATOS DEL MOVIMIENTO MANDAN Y LA REGLA NO SE REESCRIBE.** La fecha, el importe y la cuenta del
movimiento vinculado SHALL conservarse tal como están —el movimiento es un hecho ya ocurrido y la app
no tiene autoridad para corregirlo— y NO SHALL propagarse a la regla. Una diferencia de importe SHALL
mostrarse como información, no como advertencia ni como impedimento: el importe de una obligación
cambia, y avisar de eso cada vez convertiría el caso normal en un error.

**QUÉ SE OFRECE COMO CANDIDATO.** La lista inicial SHALL contener los movimientos del usuario que
cumplan **todas** estas condiciones: ser del mismo tipo funcional que la regla, estar en la misma
moneda, **no estar ya vinculados** a ninguna otra ocurrencia, y caer en la ventana que va **desde el
vencimiento anterior hasta el vencimiento siguiente** de la regla.

La ventana SHALL derivarse del calendario de la regla y NO SHALL ser un número fijo de días: media
docena de días alrededor del vencimiento deja afuera el caso que motiva esta capacidad —pagar el 3 lo
que vence el 23—, y un número fijo que lo cubriera sería absurdo en una regla semanal. Que la ventana
de dos vencimientos consecutivos se superponga es **aceptado a propósito**: la app genuinamente no
sabe a qué período correspondió un pago, y quien sabe es el usuario. Un movimiento ya vinculado
desaparece de toda otra lista, así que no puede resolver dos vencimientos.

**EL IMPORTE Y LA CUENTA ORDENAN, NO EXCLUYEN.** El sistema SHALL ordenar los candidatos por
proximidad —misma cuenta primero, luego importe más parecido, luego fecha más cercana al
vencimiento— y NO SHALL usar ninguno de esos criterios para dejar un movimiento fuera de la lista. Un
alquiler que aumentó es justo el caso en que el usuario más necesita encontrarlo, y filtrar por
importe lo esconde exactamente ahí.

**AMPLIAR LA BÚSQUEDA SHALL estar siempre disponible**, incluso cuando la lista ya trae candidatos —
no sólo cuando queda vacía—. El sistema NO SHALL exigir que el usuario escriba una búsqueda para
llegar a la lista inicial.

#### Scenario: Vincular no crea ningún movimiento

- **WHEN** el usuario vincula un gasto que ya tenía cargado al vencimiento del `2026-09-23`
- **THEN** la ocurrencia del `2026-09-23` queda resuelta apuntando a ese movimiento
- **AND** no se inserta ninguna fila nueva en `transactions`
- **AND** ningún saldo cambia

#### Scenario: Un pago hecho veinte días antes aparece entre los candidatos

- **WHEN** el vencimiento es el `2026-09-23`, la regla es mensual y el usuario cargó un gasto el
  `2026-09-03`
- **THEN** ese gasto aparece en la lista inicial de candidatos

#### Scenario: Un importe distinto no esconde el movimiento

- **WHEN** la regla tiene un importe de `450000` y el movimiento cargado es de `610000`, dentro de la
  ventana
- **THEN** el movimiento aparece igual entre los candidatos
- **AND** la pantalla muestra la diferencia de importe como información

#### Scenario: El movimiento vinculado conserva sus datos y la regla no cambia

- **WHEN** el usuario vincula al vencimiento del `2026-09-23` un movimiento fechado el `2026-09-03`,
  de `610000`, cargado en una cuenta distinta de la de la regla
- **THEN** el movimiento conserva su fecha, su importe y su cuenta
- **AND** el importe y la cuenta de la regla no cambian
- **AND** la ocurrencia conserva el `2026-09-23` como vencimiento

#### Scenario: Un movimiento ya vinculado no se ofrece para otro vencimiento

- **WHEN** un movimiento ya está vinculado al vencimiento del `2026-09-23` y el usuario abre los
  candidatos del vencimiento del `2026-10-23`
- **THEN** ese movimiento no aparece en la lista

#### Scenario: Ampliar la búsqueda está disponible con la lista llena

- **WHEN** la lista inicial de candidatos ya muestra movimientos
- **THEN** la pantalla ofrece igualmente ampliar la búsqueda

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
deshacerla significaría borrar ese movimiento, que es una operación distinta y con su propio alcance.
Que el sistema pueda distinguir las dos es el motivo por el que cada ocurrencia registra **cómo** se
resolvió.

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

### Requirement: Un movimiento vinculado se rotula como vinculado, no como originado

Un movimiento que existía **antes** de resolverse la ocurrencia NO SHALL presentarse como originado en
la regla recurrente: no lo originó, el usuario lo cargó por su cuenta. El sistema SHALL rotularlo como
**vinculado** a esa recurrencia, y SHALL reservar el rótulo de origen para los movimientos que la
recurrencia efectivamente creó.

La distinción SHALL ser visible para el usuario, no sólo interna: es la misma que decide qué acción se
le ofrece para deshacer, y un rótulo que las confunda hace que dos filas idénticas en pantalla se
comporten distinto sin explicación.

#### Scenario: El historial distingue vinculado de originado

- **WHEN** el usuario abre un movimiento que vinculó a una recurrencia
- **THEN** la ficha dice que está **vinculado** a esa recurrencia
- **AND** NO dice que la recurrencia lo originó

#### Scenario: Un movimiento creado por la recurrencia conserva su rótulo de origen

- **WHEN** el usuario abre un movimiento que la recurrencia creó al registrarse un pago
- **THEN** la ficha dice que lo originó esa recurrencia
