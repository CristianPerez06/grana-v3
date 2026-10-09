## MODIFIED Requirements

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

**LA FOTO DE LA OCURRENCIA ES DEL MOVIMIENTO, POR LOS DOS CAMINOS.** Vincular termina en la misma
fila de dos maneras —creando la ocurrencia, cuando el calendario todavía no la materializó, o
resolviendo la que el generador ya dejó pendiente— y las dos SHALL dejarla igual: el importe, la
cuenta, la clasificación y la descripción que la ocurrencia guarda SHALL ser los del movimiento
vinculado, no los que la regla preveía. El destino de una transferencia, el hogar y el reparto SHALL
seguir siendo los de la REGLA por los dos caminos, porque describen la obligación y no el pago.
Una ocurrencia que conserva la foto sembrada por el generador muestra en el historial un importe que
nunca se pagó, y lo hace de la forma más difícil de ver: el número es plausible, es el de la regla, y
coincide con el de todas las demás filas.

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

**QUÉ NUNCA ES CANDIDATO.** Hay movimientos que no son el pago de una obligación recurrente aunque
coincidan en tipo, moneda y fecha. NO SHALL ofrecerse, ni siquiera al ampliar la búsqueda:

- **una compra en cuotas**: ni la compra original ni ninguna de sus cuotas. Una cuota no es un
  movimiento que el usuario pueda borrar o editar por sí sola, y las reglas recurrentes ya excluyen
  las compras en cuotas como origen;
- **el débito con que se pagó un resumen de tarjeta, y su impuesto de sellos**: los crea y los borra
  la operación de pagar o revertir el resumen, no el usuario. Si uno resolviera un vencimiento,
  revertir el pago desde Tarjetas reabriría ese vencimiento sin que ninguna pantalla lo dijera;
- **un reintegro o una liquidación de Compartido**: no son movimientos del usuario en este sentido.

Una compra con tarjeta **en un solo pago** SÍ es candidata: es el caso típico de un servicio que se
paga con la tarjeta.

**VINCULAR APLICA LA MISMA REGLA QUE LA LISTA.** Qué movimiento se puede vincular SHALL decidirse en
un solo lugar, que comparten la lista y la operación de vincular. Un movimiento que la lista no
ofrecería SHALL rechazarse también al vincular, con un motivo propio —distinto del de tipo o moneda
incompatible— y sin crear ni modificar ninguna ocurrencia. Sin eso, la lista sería la única defensa
y cualquier otro camino podría vincular lo que ella esconde.

Las ocurrencias que ya quedaron vinculadas a uno de esos movimientos antes de esta regla NO SHALL
modificarse automáticamente: siguen resueltas y se pueden desvincular como cualquier otra.

**CADA CANDIDATO SE RECONOCE SIN SALIR DE LA LISTA.** Cada fila SHALL nombrarse en el mismo orden con
que la app nombra una regla o una ocurrencia —descripción, subcategoría, categoría, etiqueta del
tipo; un texto en blanco cuenta como ausente— y SHALL mostrar además la **cuenta** del movimiento y
su fecha. Una categoría o subcategoría del sistema SHALL mostrarse traducida al idioma del usuario.
Como la etiqueta del tipo nunca falta, ninguna fila SHALL quedar sin nombre.

**EL IMPORTE Y LA CUENTA ORDENAN, NO EXCLUYEN.** El sistema SHALL ordenar los candidatos por
proximidad —misma cuenta primero, luego importe más parecido, luego fecha más cercana al
vencimiento— y NO SHALL usar ninguno de esos criterios para dejar un movimiento fuera de la lista. Un
alquiler que aumentó es justo el caso en que el usuario más necesita encontrarlo, y filtrar por
importe lo esconde exactamente ahí.

**AMPLIAR LA BÚSQUEDA SHALL estar siempre disponible**, incluso cuando la lista ya trae candidatos —
no sólo cuando queda vacía—. El sistema NO SHALL exigir que el usuario escriba una búsqueda para
llegar a la lista inicial.

**EL VENCIMIENTO SE VALIDA ANTES DE CREARLE UNA IDENTIDAD.** Vincular o registrar por anticipado
SHALL rechazar una fecha que el calendario de la regla no produce —incluida una posición que cae
dentro de una pausa, y la fecha de la semilla, ya cubierta por el movimiento que creó la regla—, una
posición que excede el tope del plan, y un vencimiento ya resuelto. Sin ese chequeo quedaría una
ocurrencia con una identidad que el calendario nunca produce, y como una posición resuelta antes de
su fecha cuenta como gastada, esa fecha fantasma consumiría una posición del límite. La regla SHALL
ser **una sola** para los dos caminos, de modo que vincular y registrar por anticipado no puedan
contestar distinto sobre la misma fecha.

La ventana de candidatos SHALL tomar sus bordes del **calendario real** —los vecinos que la regla
efectivamente produce, honrando versiones de cronograma y pausas— y no de una aritmética sobre el
intervalo vigente. Cuando el vencimiento no tiene anterior (es el primero de la regla) o no tiene
siguiente (el último de un plan con tope), el borde faltante SHALL ser un paso del calendario en esa
dirección, para que un pago hecho antes del primer vencimiento siga entrando.

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

#### Scenario: Vincular sobre una ocurrencia que el generador ya había creado

- **WHEN** una regla de $600 tiene el vencimiento de este mes ya materializado como pendiente, y el
  usuario lo resuelve señalando un movimiento de $2.500
- **THEN** el historial de la regla muestra ese vencimiento con **$2.500** y la descripción del
  movimiento, no los $600 de la regla
- **AND** la regla sigue siendo de $600

#### Scenario: Un movimiento ya vinculado no se ofrece para otro vencimiento

- **WHEN** un movimiento ya está vinculado al vencimiento del `2026-09-23` y el usuario abre los
  candidatos del vencimiento del `2026-10-23`
- **THEN** ese movimiento no aparece en la lista

#### Scenario: Ampliar la búsqueda está disponible con la lista llena

- **WHEN** la lista inicial de candidatos ya muestra movimientos
- **THEN** la pantalla ofrece igualmente ampliar la búsqueda

#### Scenario: Una fecha que no es un vencimiento se rechaza sin crear nada

- **WHEN** se intenta vincular un movimiento al `2026-09-15` de una regla mensual del 23
- **THEN** la operación se rechaza
- **AND** no queda ninguna ocurrencia con esa fecha

#### Scenario: Una posición más allá del tope se rechaza

- **WHEN** una regla con `max_occurrences = 3` —vencimientos el `2026-09-23`, `2026-10-23` y
  `2026-11-23`— recibe un intento de vincular al `2026-12-23`
- **THEN** la operación se rechaza explicando que el plan ya usó todos sus vencimientos

#### Scenario: Con un cambio de frecuencia, el vencimiento anterior es el de la versión vieja

- **WHEN** una regla fue semanal hasta el `2026-09-30` y mensual del 23 desde octubre, y se abren
  los candidatos del `2026-10-23`
- **THEN** la ventana empieza en el último vencimiento semanal (`2026-09-28`)
- **AND** un movimiento del `2026-09-20` NO aparece, aunque «un mes antes del 23/10» lo admitiría

#### Scenario: El primer vencimiento de una regla también admite un pago anterior

- **WHEN** el vencimiento del `2026-09-23` es el primero de su regla mensual y el usuario cargó un
  gasto el `2026-09-03`
- **THEN** ese gasto aparece entre los candidatos

#### Scenario: Un candidato sin descripción se nombra por su clasificación y su cuenta

- **WHEN** dentro de la ventana hay un gasto sin descripción, de la subcategoría «Supermercado»,
  cargado en la cuenta «Visa Galicia»
- **THEN** la fila se llama «Supermercado» y muestra «Visa Galicia» y su fecha
- **AND** ninguna fila dice «Movimiento sin descripción»

#### Scenario: Un candidato con descripción se nombra por ella

- **WHEN** un gasto de la ventana tiene la descripción «Alquiler depto» y la categoría «Vivienda»
- **THEN** la fila se llama «Alquiler depto»

#### Scenario: Las cuotas no se ofrecen

- **WHEN** el usuario compró en 6 cuotas con su tarjeta y una de las cuotas cae dentro de la ventana
  de una regla de gasto en pesos
- **THEN** ni la compra ni ninguna de sus cuotas aparece entre los candidatos
- **AND** tampoco aparecen al ampliar la búsqueda

#### Scenario: Una compra con tarjeta en un pago sí se ofrece

- **WHEN** el usuario pagó un servicio con su tarjeta en un solo pago, dentro de la ventana
- **THEN** esa compra aparece entre los candidatos

#### Scenario: El débito de un pago de resumen no se ofrece

- **WHEN** el usuario pagó el resumen de su tarjeta desde su cuenta bancaria dentro de la ventana de
  una regla de gasto, con impuesto de sellos
- **THEN** ni el débito del pago ni el impuesto de sellos aparecen entre los candidatos

#### Scenario: Vincular rechaza lo que la lista no ofrece

- **WHEN** se intenta vincular a un vencimiento una cuota de una compra en cuotas, o el débito de un
  pago de resumen, por un camino que no es la lista
- **THEN** la operación se rechaza diciendo que ese movimiento no puede resolver un vencimiento
- **AND** el vencimiento sigue sin resolver
- **AND** no queda ninguna ocurrencia nueva

#### Scenario: Un vínculo previo a una cuota se conserva y se puede deshacer

- **WHEN** antes de esta regla el usuario había vinculado una cuota a un vencimiento
- **THEN** ese vencimiento sigue resuelto con esa cuota
- **AND** el usuario puede desvincularlo, y el vencimiento vuelve a «por revisar»

