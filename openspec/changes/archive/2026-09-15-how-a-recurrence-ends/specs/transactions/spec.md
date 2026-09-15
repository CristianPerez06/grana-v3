## MODIFIED Requirements

### Requirement: El usuario puede crear una regla recurrente directamente, sin movimiento de origen

El sistema SHALL permitir crear una regla recurrente desde cero, sin partir de un movimiento ya registrado ni de una sugerencia. La regla SHALL persistirse en `recurrences` con `created_from_transaction_id = NULL` y `last_generated_date = NULL`, y NO SHALL crear ninguna transacción real ni ninguna instancia en el momento de la creación: la primera instancia la produce el generador de instancias.

La entrada SHALL validarse con el mismo modelo de datos que el resto del módulo (tipo funcional, cuenta o tarjeta, cuenta destino cuando aplique, moneda, monto, categoría cuando aplique, descripción, frecuencia como par `interval_count`+`interval_unit` con etiqueta preset o `custom`, `start_date`, y condición de fin opcional `end_date` y/o `max_occurrences`).

**LA CONDICIÓN DE FIN SE PIDE COMO UNA SOLA PREGUNTA.** El formulario SHALL preguntar **cómo termina la regla** y ofrecer exactamente tres respuestas mutuamente excluyentes:

- **sin límite** — ni `end_date` ni `max_occurrences`;
- **en una fecha** — `end_date`, sin `max_occurrences`;
- **después de N vencimientos** — `max_occurrences`, sin `end_date`.

Ningún control de la condición de fin SHALL estar oculto detrás de otro. En particular, el límite de vencimientos NO SHALL vivir dentro del bloque de la fecha de fin: eso obliga a pedir una cosa para llegar a la otra, y deja al usuario cargando un dato desde una pregunta que no es la que respondió.

**LO QUE NO SE VE NO SE GUARDA.** El formulario NO SHALL enviar ningún componente de la condición de fin que no corresponda a la respuesta elegida, aunque el usuario lo haya escrito antes de cambiar de respuesta. Una regla NO SHALL quedar con un límite que el usuario no puede ver en la pantalla donde lo cargó.

**REGLAS QUE YA TIENEN LAS DOS CONDICIONES.** El modelo permitía hasta ahora que una regla llevara `end_date` **y** `max_occurrences` a la vez, y la generación cortaba por la primera que se cumpliera. Las tres respuestas excluyentes rigen para lo que se crea y se edita de acá en adelante; una regla que ya tiene las dos SHALL conservarlas mientras no se toque su condición de fin. Al editarla, el sistema NO SHALL descartar una de las dos en silencio: SHALL decir que la regla tiene ambas y cuál va a quedar, y el usuario SHALL confirmarlo. Una condición de fin que desaparece sin que nadie la haya nombrado es exactamente el defecto que este cambio corrige, y no se arregla creándolo del otro lado.

El campo del límite SHALL aceptar únicamente dígitos y NO SHALL modificar su valor por desplazamiento de rueda, flechas del teclado ni controles de incremento — el mismo criterio que el resto de los campos numéricos del producto, por la misma razón: un número que cambia sin que el usuario escriba es un número que el usuario no sabe que cambió.

El server action SHALL rechazar entradas que violen los invariantes contables:
- `movement_type` SHALL ser uno de `income`, `expense`, `transfer` (los ajustes y las compras en cuotas NO admiten recurrencia).
- `income` y `expense` SHALL requerir `category_id`; `transfer` SHALL requerir `transfer_destination_account_id` distinto de `account_id` y NO SHALL llevar categoría.
- `amount` SHALL ser positivo.
- `currency_code` SHALL ser `ARS` o `USD` y SHALL ser una moneda activa de la cuenta (la bimoneda nunca se mezcla).
- `end_date`, si está presente, SHALL ser ≥ `start_date`.
- `max_occurrences`, si está presente, SHALL ser un entero ≥ 1.
- `account_id` y la cuenta destino, si aplica, SHALL pertenecer al usuario y estar activas.

Las reglas en tarjeta de crédito en moneda no-ARS NO SHALL capturar tipo de cambio al crearse: el `fx_rate` se solicita al confirmar cada instancia.

El sistema SHALL ofrecer un punto de entrada para este flujo desde la pantalla de recurrencias (`/transactions/recurring`).

#### Scenario: Crear un gasto recurrente desde cero

- **WHEN** el usuario abre el flujo de creación directa en `/transactions/recurring` y completa un gasto mensual de `$10.000` en una cuenta cash con categoría, `start_date = 2026-06-01`
- **THEN** el sistema crea una regla recurrente de tipo `expense` con `created_from_transaction_id = NULL` y `last_generated_date = NULL`
- **AND** no crea ninguna transacción real en `transactions`
- **AND** no crea ninguna instancia en `recurrence_instances` en ese momento

#### Scenario: El límite de vencimientos se ofrece sin pedir una fecha de fin

- **WHEN** el usuario abre el formulario de creación y elige «después de N vencimientos»
- **THEN** puede escribir el límite sin activar ningún control de fecha de fin
- **AND** la regla se guarda con `max_occurrences` poblado y `end_date = NULL`

#### Scenario: Un límite escrito y después descartado no se guarda

- **WHEN** el usuario elige «después de N vencimientos», escribe `11`, y luego cambia la respuesta a «sin límite»
- **THEN** el formulario ya no muestra el límite
- **AND** al guardar, la regla queda con `max_occurrences = NULL` y `end_date = NULL`
- **AND** la regla NO queda con un límite invisible que la termine antes de tiempo

#### Scenario: El límite no cambia por desplazamiento ni por flechas

- **WHEN** el usuario escribe `11` en el límite y luego desplaza la pantalla con el puntero sobre ese campo, o presiona las flechas del teclado
- **THEN** el valor sigue siendo `11`

#### Scenario: Crear una transferencia recurrente desde cero

- **WHEN** el usuario crea una transferencia recurrente con cuenta origen y cuenta destino distintas y sin categoría
- **THEN** el sistema crea una regla `transfer` con `transfer_destination_account_id` poblado y `category_id = NULL`

#### Scenario: Rechazo de ajuste como recurrencia

- **WHEN** el usuario o una API intenta crear una regla directa con `movement_type = adjustment`
- **THEN** la action retorna error y no crea la regla

#### Scenario: Rechazo de categoría faltante en gasto

- **WHEN** el usuario intenta crear un gasto recurrente sin `category_id`
- **THEN** la action retorna error y no crea la regla

#### Scenario: Rechazo de fecha de fin anterior al inicio

- **WHEN** el usuario intenta crear una regla con `end_date` anterior a `start_date`
- **THEN** la action retorna error y no crea la regla

#### Scenario: Regla en tarjeta de crédito USD no captura fx_rate al crearse

- **WHEN** el usuario crea una regla recurrente `expense` en una tarjeta de crédito con `currency_code = USD`
- **THEN** la regla se crea sin tipo de cambio almacenado
- **AND** el tipo de cambio se solicitará al confirmar cada instancia

### Requirement: El usuario puede crear una regla recurrente al registrar un movimiento

El sistema SHALL permitir que el usuario marque como recurrente un movimiento al registrarlo. La recurrencia SHALL ser una regla separada del movimiento real y SHALL conservar los datos necesarios para generar futuras instancias: tipo funcional, cuenta o tarjeta, cuenta destino cuando aplique, moneda, monto, categoria cuando aplique, descripcion, frecuencia, fecha de inicio y condicion de fin opcional.

La frecuencia SHALL modelarse como un par `interval_count` (entero ≥ 1) e `interval_unit` (`day | week | month | year`). El campo `frequency` SHALL persistir la etiqueta de la regla: uno de los presets (`weekly`, `biweekly`, `monthly`, `annual`) o `custom`. Los presets SHALL resolver a un par intervalo+unidad fijo: `weekly`⇒`(1, week)`, `biweekly`⇒`(2, week)`, `monthly`⇒`(1, month)`, `annual`⇒`(1, year)`. `custom` SHALL usar el par elegido por el usuario.

La condicion de fin SHALL ser opcional y poder expresarse como `end_date` (fecha límite) o `max_occurrences` (entero ≥ 1, cantidad máxima de ocurrencias). **Este camino SHALL ofrecer la misma pregunta de fin que la creación directa**, con las mismas tres respuestas y las mismas reglas sobre lo que se envía: quien convierte un movimiento en recurrencia SHALL poder decir «esto son 11 cuotas» sin salir del formulario. Una condición de fin disponible en un camino de alta y ausente en otro obliga al usuario a crear la regla de nuevo por el camino correcto.

El movimiento semilla SHALL depender de la fecha elegida:

- **`date <= hoy_AR`**: el movimiento registrado SHALL crearse como transaccion real normal usando el flujo existente, y la regla SHALL apuntar a ese movimiento mediante `created_from_transaction_id` (comportamiento actual, sin cambios).
- **`date > hoy_AR`**: el sistema NO SHALL crear ninguna transaccion real ni ninguna instancia en ese momento. SHALL crear únicamente la regla, con la semántica de la creación directa: `created_from_transaction_id = NULL`, `last_generated_date = NULL` y `start_date =` la fecha elegida, de modo que la primera instancia pendiente la produzca el generador **exactamente en esa fecha** y pase por el gate de confirmación de instancias ("Las instancias recurrentes pendientes no son transacciones reales"). El saldo NO SHALL cambiar hasta que el usuario confirme esa instancia.

#### Scenario: Ingreso recurrente creado desde registro

- **WHEN** el usuario registra un ingreso con fecha de hoy y activa "Recurrente"
- **THEN** el sistema crea el ingreso real en `transactions` con `status=NULL`
- **AND** crea una regla recurrente de tipo `income`
- **AND** no crea una segunda transaccion para la primera recurrencia

#### Scenario: Un plan de cuotas se carga entero desde el movimiento

- **WHEN** el usuario registra un gasto, activa "Recurrente" mensual y responde que termina «después de 11 vencimientos»
- **THEN** la regla se crea con `max_occurrences = 11`
- **AND** el usuario no necesita volver a crearla desde la pantalla de recurrencias para ponerle el límite

#### Scenario: Gasto de tarjeta recurrente creado desde registro

- **WHEN** el usuario registra un consumo simple en tarjeta con fecha de hoy y activa "Recurrente"
- **THEN** el sistema crea el consumo real de tarjeta con `status='pending'` y `card_period_id`
- **AND** crea una regla recurrente de tipo `expense` asociada a esa tarjeta
- **AND** la regla no modifica el estado del resumen

#### Scenario: Transferencia recurrente creada desde registro

- **WHEN** el usuario registra una transferencia con fecha de hoy y activa "Recurrente"
- **THEN** el sistema crea la transferencia real
- **AND** crea una regla recurrente con cuenta origen y cuenta destino

#### Scenario: Movimiento recurrente con fecha futura no crea semilla

- **WHEN** hoy es `2026-07-31` y el usuario registra un gasto en cuenta cash con `date = 2026-08-10` y activa "Recurrente"
- **THEN** el sistema NO inserta ninguna fila en `transactions`
- **AND** crea una regla recurrente con `created_from_transaction_id = NULL`, `last_generated_date = NULL` y `start_date = 2026-08-10`
- **AND** el saldo de la cuenta no cambia

#### Scenario: La primera instancia de una regla sembrada a futuro cae en la fecha elegida

- **WHEN** existe una regla creada desde el form con `start_date = 2026-08-10` (fecha futura, sin semilla) y la fecha financiera AR llega a `2026-08-10`
- **THEN** el generador produce una única instancia pendiente con `scheduled_date = 2026-08-10`
- **AND** el saldo cambia recién cuando el usuario confirma esa instancia

#### Scenario: Consumo recurrente de tarjeta con fecha futura tampoco crea semilla

- **WHEN** el usuario registra un consumo simple en tarjeta con `date` futura y activa "Recurrente"
- **THEN** el sistema NO inserta ningún consumo con `card_period_id`
- **AND** crea la regla `expense` asociada a la tarjeta con `start_date =` la fecha elegida
- **AND** el resumen de la tarjeta no cambia hasta que el usuario confirme la instancia cuando llegue la fecha

### Requirement: El usuario puede gestionar, pausar y eliminar reglas recurrentes

El sistema SHALL exponer una pantalla `/transactions/recurring` para ver y gestionar reglas recurrentes. La pantalla SHALL listar las reglas con tipo, descripcion, monto, cuenta o tarjeta, frecuencia, proxima fecha e indicador de instancia pendiente cuando exista. El sistema SHALL permitir pausar, reactivar y eliminar/desactivar reglas.

El agrupamiento de la pantalla SHALL usar el **estado mostrado** definido en "El fin de una regla se deriva de su calendario, no de una columna guardada", no la columna `status` en crudo: una regla que ya no puede producir nada NO SHALL aparecer junto a las que sí.

La **próxima fecha** mostrada SHALL derivarse del mismo caminante de calendario que la proyección de próximas ocurrencias y que el generador, honrando `last_generated_date`: nunca SHALL anunciarse como próxima una ocurrencia ya cubierta por un movimiento real. Una regla sin próxima fecha NO SHALL mostrarse como activa.

#### Scenario: Acceso desde Movimientos

- **WHEN** el usuario abre `/transactions`
- **THEN** puede navegar a `/transactions/recurring`

#### Scenario: Una regla agotada no se lista entre las activas

- **WHEN** una regla con `status = 'active'` ya gastó todas las posiciones que su límite permite
- **THEN** la pantalla la agrupa como finalizada
- **AND** no la cuenta entre las activas

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

## ADDED Requirements

### Requirement: Una regla con límite de vencimientos dice en qué punto está y cuándo va a terminar

Cuando una regla tiene `max_occurrences`, su detalle SHALL mostrar **cuántos vencimientos lleva de cuántos**, **cuántos le quedan** y **la fecha del último vencimiento previsto**. Un límite que decide cuándo la regla deja de avisar y que el usuario no puede leer en ninguna pantalla es indistinguible de no tener límite, y la regla parece indefinida hasta el día en que deja de recordar.

El conteo SHALL expresarse en **posiciones del calendario de la regla**, la misma unidad que usa el corte de la generación (ver "La generación de instancias recurrentes usa intervalo+unidad y corta por la primera condición de fin"). NO SHALL contarse por filas de `recurrence_instances`: una regla sembrada por un movimiento no tiene fila para su primera ocurrencia, y una posición producida mientras nada estaba generando tampoco — contar filas le atribuye a una regla agotada vencimientos que no le quedan.

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

### Requirement: El fin de una regla se deriva de su calendario, no de una columna guardada

El sistema SHALL mostrar como **finalizada** toda regla que no pueda producir ninguna ocurrencia futura, aunque su columna `recurrences.status` diga `active` o `paused`. El estado mostrado SHALL derivarse en cada lectura del calendario de la regla y de su condición de fin; el sistema NO SHALL reescribir `recurrences.status` para expresarlo.

**UNA REGLA ELIMINADA SIGUE ELIMINADA.** `status = 'deleted'` NO SHALL derivarse a finalizada ni a ningún otro estado: una regla que el usuario borró queda fuera de las superficies que listan reglas vivas, y llamarla «finalizada» la devolvería a una lista de la que fue sacada a propósito. La derivación SHALL aplicarse únicamente a reglas activas y pausadas.

**LA PREGUNTA ES SI EL CALENDARIO TIENE ALGO POR DELANTE**, no si el tope se agotó. Una regla puede quedarse sin futuro por su `end_date`, por su límite, o por las dos. El estado mostrado SHALL derivarse de si el caminante de calendario —el mismo que anuncia la próxima fecha— produce alguna ocurrencia a partir de hoy; las posiciones gastadas y los vencimientos sin resolver dicen **cómo** terminó y qué queda por hacer, no **si** terminó. Inferirlo de `end_date` y del conteo deja afuera a las reglas que terminaron por fecha.

**Para una regla pausada, esa pregunta SHALL hacerse ignorando la pausa abierta**, es decir evaluando el calendario como si la regla se reanudara hoy. Una pausa sin fecha de reanudación hace que el caminante no produzca ninguna ocurrencia, de modo que preguntarle tal cual daría que toda regla pausada está finalizada — el error opuesto al que este requirement corrige. Que no se sepa **cuándo** va a terminar no significa que ya haya terminado.

Esta derivación SHALL aplicarse a **todas** las reglas, sin distinguir cuándo fueron creadas. Aplicarla sólo a las nuevas haría que dos reglas idénticas se muestren distinto según su fecha de alta, y dejaría a las reglas ya agotadas presentándose como activas — que es la situación que este cambio corrige.

El estado mostrado SHALL distinguir dos formas del final:

- **finalizada**: no quedan posiciones futuras ni vencimientos sin resolver;
- **finalizada, con vencimientos por revisar**: no quedan posiciones futuras, pero hay instancias todavía sin confirmar ni omitir. El usuario SHALL poder resolverlas; el sistema NO SHALL ocultarlas por haber terminado la regla.

El estado mostrado SHALL recalcularse ante cualquier cambio que altere lo que la regla puede producir. En particular, **ampliar el límite SHALL devolver la regla a activa** y **quitarlo SHALL volverla indefinida**, sin ninguna operación adicional del usuario y sin tocar `recurrences.status`.

Una regla **pausada** NO SHALL mostrarse como finalizada mientras su calendario todavía tenga posiciones por delante: una pausa es una interrupción, no un final.

#### Scenario: Una regla que agotó su límite se muestra finalizada

- **WHEN** una regla con `max_occurrences = 1` ya gastó esa posición y su columna `status` dice `active`
- **THEN** el sistema la muestra como finalizada
- **AND** `recurrences.status` sigue diciendo `active`

#### Scenario: Ampliar el límite reactiva la regla

- **WHEN** el usuario cambia el límite de esa regla de 1 a 11
- **THEN** el sistema vuelve a mostrarla como activa
- **AND** anuncia su próxima fecha de vencimiento

#### Scenario: Quitar el límite la vuelve indefinida

- **WHEN** el usuario le quita el límite a una regla que estaba finalizada por haberlo agotado
- **THEN** el sistema vuelve a mostrarla como activa
- **AND** su detalle deja de mostrar avance y último vencimiento previsto

#### Scenario: Terminada pero con algo por resolver

- **WHEN** una regla agotó su límite y su último vencimiento sigue pendiente de confirmar u omitir
- **THEN** el sistema la muestra como finalizada indicando que queda un vencimiento por revisar
- **AND** el usuario puede confirmarlo u omitirlo

#### Scenario: Una regla terminada por fecha también se muestra finalizada

- **WHEN** una regla sin `max_occurrences` tiene `end_date` ya pasada y su columna `status` dice `active`
- **THEN** el sistema la muestra como finalizada
- **AND** lo hace sin depender de ningún conteo de posiciones

#### Scenario: Una regla terminada por fecha con algo sin resolver

- **WHEN** una regla pasó su `end_date` y su último vencimiento sigue sin confirmar ni omitir
- **THEN** el sistema la muestra como finalizada indicando que queda un vencimiento por revisar

#### Scenario: Una regla eliminada no reaparece como finalizada

- **WHEN** una regla con `status = 'deleted'` no puede producir ninguna ocurrencia futura
- **THEN** el sistema NO la muestra como finalizada
- **AND** sigue fuera de las superficies que listan reglas vivas

#### Scenario: Una pausa no es un final

- **WHEN** el usuario pausa una regla sin límite
- **THEN** el sistema la muestra como pausada, no como finalizada

#### Scenario: Una pausa abierta no convierte la regla en finalizada

- **WHEN** una regla con límite y posiciones por delante está pausada sin fecha de reanudación, de modo que su calendario hoy no produce ninguna ocurrencia
- **THEN** el sistema evalúa su calendario como si se reanudara hoy
- **AND** la muestra como pausada, no como finalizada
- **AND** no muestra ninguna fecha de último vencimiento

#### Scenario: Una regla pausada que ya no tendría futuro al reanudarse sí está finalizada

- **WHEN** una regla pausada ya gastó todas las posiciones que su límite permite
- **THEN** el sistema la muestra como finalizada
- **AND** lo hace porque reanudarla hoy tampoco produciría ninguna ocurrencia

### Requirement: Cambiar el límite de una regla no puede volver su avance imposible

El sistema SHALL permitir cambiar y quitar el límite de una regla existente desde su edición, en web y en nativo.

**UN LÍMITE NUEVO NO PUEDE SER MENOR QUE LO YA GASTADO.** El sistema SHALL rechazar un `max_occurrences` inferior a las posiciones que la regla ya gastó, y SHALL decir cuántas son. Aceptarlo produciría un avance que se satura contra su propio tope y muestra «3 de 3» sobre una regla que en realidad recorrió cinco: un número que no describe ninguna realidad y que además presentaría como terminada una regla por un motivo falso.

**EL RECHAZO VIVE EN EL CAMINO DE ESCRITURA, NO EN EL FORMULARIO.** La validación SHALL ejecutarse en el punto autoritativo que persiste el cambio —el mismo que ya rechaza un `end_date` anterior al `start_date`—, contando las posiciones gastadas con la lectura normativa y no con un número que el cliente haya mandado. El formulario PUEDE anticiparla para dar un mensaje inmediato, pero esa anticipación NO SHALL ser la garantía: un formulario es una comodidad y se lo puede saltear, y el modelo tiene que quedar íntegro igual. Un invariante que sólo se comprueba en la pantalla donde se carga el dato es exactamente el defecto que originó este cambio.

Igualar el límite a las posiciones ya gastadas SÍ SHALL aceptarse: es la forma de decir «esto ya terminó», y el estado mostrado pasa a finalizada por el camino normal.

Quitar el límite SHALL dejar la regla sin `max_occurrences`, y su final vuelve a depender únicamente de su `end_date` si la tiene.

#### Scenario: Reducir el límite por debajo de lo gastado se rechaza

- **WHEN** una regla ya gastó cinco posiciones y el usuario intenta ponerle un límite de tres
- **THEN** el sistema rechaza el cambio
- **AND** le dice que la regla ya lleva cinco vencimientos
- **AND** la regla conserva el límite que tenía

#### Scenario: El rechazo no depende de haber pasado por el formulario

- **WHEN** una escritura que no pasó por el formulario intenta ponerle a esa misma regla un límite de tres
- **THEN** el camino de escritura la rechaza igual
- **AND** la regla conserva el límite que tenía

#### Scenario: Igualar el límite a lo gastado termina la regla

- **WHEN** una regla que gastó cinco posiciones recibe un límite de cinco
- **THEN** el sistema acepta el cambio
- **AND** pasa a mostrarla como finalizada

#### Scenario: Quitar el límite

- **WHEN** el usuario le quita el límite a una regla que lo tenía
- **THEN** la regla queda con `max_occurrences = NULL`
- **AND** su detalle deja de mostrar avance y último vencimiento previsto
