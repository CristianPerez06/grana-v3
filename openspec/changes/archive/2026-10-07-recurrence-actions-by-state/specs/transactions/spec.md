## ADDED Requirements

### Requirement: Qué se puede hacer sobre un vencimiento depende de su estado, no de la pantalla

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
- **Resuelto registrando** (`resolution_kind = 'created'`): NO SHALL ofrecerse ninguna acción de
  deshacer mientras no exista una operación propia para borrar el movimiento que la recurrencia creó
  (#104).
- **Resuelto vinculando** (`resolution_kind = 'linked'`): el historial de la regla SHALL ofrecer
  **desvincular**, y ninguna otra superficie SHALL hacerlo.

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

**DIVERGENCIA CONOCIDA (#162).** Hoy registrar y vincular se ofrecen SÓLO sobre vencimientos
proyectados; un vencimiento que ya existe y sigue sin resolver tiene únicamente confirmar y omitir en
el bloque de por revisar, y nada en la ficha. Desvincular deja exactamente ese estado —una ocurrencia
existente sin resolver, a veces con fecha futura—, de modo que un vencimiento desvinculado no puede
volver a vincularse desde ninguna pantalla. El hub web tampoco ofrece todavía las acciones sobre el
mismo conjunto que el nativo. Hasta que ese change se haga, el sistema NO SHALL darse por cumplido
en el bloque de por revisar, en el historial de la ficha ni en el hub web; este requirement fija lo
que esas pantallas tienen que ofrecer, no afirma que ya lo ofrezcan.

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

#### Scenario: Lo resuelto registrando no ofrece deshacer

- **WHEN** el usuario abre en el historial una ocurrencia resuelta con un movimiento que la recurrencia creó
- **THEN** la fila no ofrece desvincular ni ninguna otra acción de deshacer

#### Scenario: Una regla pausada no ofrece resolver por anticipado

- **WHEN** una regla está pausada y su calendario produciría un vencimiento el `2026-10-23`
- **THEN** ni el hub ni la ficha ofrecen registrarlo ni vincularlo
- **AND** un vencimiento que ya existía sin resolver antes de la pausa sigue ofreciendo registrar, vincular y omitir

#### Scenario: Web y nativo ofrecen las acciones sobre los mismos vencimientos

- **WHEN** una regla mensual activa tiene su próximo vencimiento a treinta y cinco días de hoy
- **THEN** el hub web y el hub nativo ofrecen registrarlo y vincularlo sobre esa misma fecha

### Requirement: Los rechazos del módulo de recurrencias se dicen en el idioma del usuario

Todo mensaje con el que el módulo de recurrencias rechaza una operación y que llega a pantalla
—regla no encontrada, instancia ya resuelta, cuenta sin esa moneda activa, cuenta archivada,
transferencia sin destino, reparto que no coincide con el hogar, y los demás— SHALL salir del
catálogo de textos de la aplicación, en el idioma del usuario, en web y en la app nativa por igual.

El módulo compartido NO SHALL ser quien elige el texto: SHALL identificar cada rechazo con un
**código** y cada plataforma SHALL traducirlo con su propio catálogo, que es el mismo mecanismo con
el que ya se traducen los rechazos de vincular y registrar por anticipado. El catálogo SHALL tener
texto para cada código en los dos idiomas, y los dos textos SHALL ser distintos: una traducción
pegada del español pasa cualquier chequeo de existencia.

Un rechazo sin código —un error de la base que el módulo sólo puede repetir— SHALL mostrarse con el
mensaje genérico traducido, nunca con el texto crudo del motor.

Hoy no es así: los mensajes están escritos en español dentro del módulo compartido. Web los muestra
tal cual aunque la app esté en inglés, y nativo los degrada a «Algo salió mal» en todas las
operaciones salvo crear y editar, de modo que el usuario no sabe qué pasó.

#### Scenario: Un rechazo se muestra traducido en web

- **WHEN** la app está en inglés y el usuario intenta confirmar una ocurrencia que otro proceso ya resolvió
- **THEN** el mensaje que ve está en inglés
- **AND** dice que la ocurrencia ya fue resuelta, no un texto genérico

#### Scenario: Un rechazo se muestra con su motivo en la app nativa

- **WHEN** desde la app nativa el usuario intenta reactivar una regla que fue eliminada
- **THEN** el mensaje dice que la regla está eliminada y no puede reactivarse, en el idioma de la app
- **AND** no dice «Algo salió mal»

#### Scenario: El catálogo cubre cada código en los dos idiomas

- **WHEN** se agrega un rechazo nuevo al módulo con su código
- **THEN** una prueba falla si el catálogo no tiene texto para ese código en español y en inglés
- **AND** falla también si los dos textos son iguales

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

Las reglas en tarjeta de crédito en moneda no-ARS NO SHALL capturar tipo de cambio al crearse **ni al confirmar cada instancia**: la conversión se resuelve al pagar el resumen, con la cotización de ese día (ver «El usuario puede confirmar una instancia recurrente», escenario «Confirmar consumo recurrente de tarjeta»). Este requirement decía antes que la cotización «se solicita al confirmar», contradiciendo a aquél; queda lo que la app hace.

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
- **AND** confirmar cada instancia tampoco pide cotización: la conversión queda para el pago del resumen

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

**El sistema SHALL avisar cuando una regla está trabada.** Una regla está trabada cuando acumula
**dos o más ocurrencias sin resolver y la más vieja ya está vencida**. En ese caso el bloque SHALL
nombrar la situación con todas sus letras, indicando **desde cuándo** —la fecha de la ocurrencia sin
resolver más antigua— y **cuántas** ocurrencias sin resolver hay.

El conteo SHALL expresarse como **lo que hay para revisar**, y NO SHALL presentarse como el total del
atraso. La materialización de vencimientos vencidos corre por lotes acotados y continúa en corridas
siguientes, de modo que un atraso largo puede tener todavía ocurrencias sin crear: afirmar un total
sería afirmar un número que el sistema no tiene.

Cuando queda reconstrucción pendiente, el bloque SHALL decirlo **una sola vez, para toda la
pantalla**, y NO SHALL atribuirla a ninguna regla. Lo que falta reconstruir es un único número de la
corrida completa y no identifica reglas; además el generador sólo consulta reglas **activas**, de
modo que colgárselo a cada línea haría que una regla pausada afirmara que se está recuperando un
atraso que nadie está recuperando. Las líneas por regla SHALL limitarse a nombrar la regla, su fecha
y su conteo.

El aviso NO SHALL bloquear ninguna acción, NO SHALL introducir por sí mismo ninguna acción —qué
acciones lleva cada fila del bloque lo decide el requirement «Qué se puede hacer sobre un
vencimiento depende de su estado, no de la pantalla», no este aviso— y NO SHALL afirmar deuda, por
la misma razón que el resto del bloque. Una
regla con ocurrencias acumuladas SHALL contar para este aviso **cualquiera sea su `status`**: el
aviso describe vencimientos que quedaron sin resolver, y ninguna condición de la regla los resuelve
por su cuenta.

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

#### Scenario: Pendiente recurrente visible sobre el historial

- **WHEN** existen instancias recurrentes pendientes
- **THEN** `/transactions` muestra un bloque de pendientes con acciones de confirmar, editar y omitir
- **AND** debajo muestra el historial real de movimientos

#### Scenario: Movimiento confirmado aparece en historial

- **WHEN** el usuario confirma una instancia recurrente
- **THEN** se crea una transaccion real
- **AND** el movimiento aparece en el historial global segun su fecha contable

#### Scenario: Una regla con vencimientos acumulados se nombra como trabada

- **WHEN** hoy es `2026-09-15` y una regla tiene veintisiete ocurrencias sin resolver, la más vieja del `2026-06-10`, sin reconstrucción pendiente
- **THEN** el bloque avisa que esa recurrencia está trabada desde el `2026-06-10`
- **AND** dice que hay veintisiete ocurrencias para revisar
- **AND** no afirma que el usuario deba esa suma

#### Scenario: Con reconstrucción pendiente se dice una sola vez, y de nadie en particular

- **WHEN** dos reglas están trabadas y la materialización todavía tiene ocurrencias por crear
- **THEN** el bloque dice una sola vez que la reconstrucción sigue en curso
- **AND** cada línea por regla dice desde cuándo está trabada y cuántos vencimientos hay para revisar
- **AND** ninguna línea atribuye la reconstrucción a su propia regla

#### Scenario: Una regla pausada no afirma que se está recuperando su atraso

- **WHEN** una regla pausada y una activa están trabadas, y lo que falta reconstruir corresponde a la activa
- **THEN** la línea de la regla pausada no afirma que se esté recuperando su atraso

#### Scenario: Una sola ocurrencia vencida no es una regla trabada

- **WHEN** una regla tiene exactamente una ocurrencia sin resolver, ya vencida
- **THEN** el bloque la muestra con su urgencia habitual
- **AND** no la nombra como trabada

#### Scenario: Dos ocurrencias que todavía no vencieron no son una regla trabada

- **WHEN** una regla tiene dos ocurrencias sin resolver y las dos vencen después de hoy
- **THEN** el bloque no la nombra como trabada

### Requirement: El usuario puede gestionar, pausar y eliminar reglas recurrentes

El sistema SHALL exponer una pantalla `/transactions/recurring` para ver y gestionar reglas recurrentes. La pantalla SHALL listar las reglas con tipo, descripcion, monto, cuenta o tarjeta, frecuencia, proxima fecha e indicador de instancia pendiente cuando exista. El sistema SHALL permitir pausar, reactivar y eliminar/desactivar reglas.

El agrupamiento de la pantalla SHALL usar el **estado mostrado** definido en "El fin de una regla se deriva de su calendario, no de una columna guardada", no la columna `status` en crudo: una regla que ya no puede producir nada NO SHALL aparecer junto a las que sí.

La **próxima fecha** mostrada SHALL derivarse del mismo caminante de calendario que la proyección de próximas ocurrencias y que el generador, descartando **el conjunto de fechas que la regla ya cubre** —la semilla de una regla creada desde un movimiento y toda ocurrencia materializada, en cualquier estado— y NO un cursor de avance como `last_generated_date`, que dejó de gobernar la generación (ver «El hub de recurrencias proyecta lo que viene en dos ventanas, sin repetir lo ya materializado»). Nunca SHALL anunciarse como próxima una ocurrencia que ya existe, esté cubierta por un movimiento real o siga sin resolver. Una regla sin próxima fecha NO SHALL mostrarse como activa.

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

- **WHEN** una regla mensual fue creada a partir de un movimiento del `2026-08-07`, de modo que su semilla cubre esa fecha, y hoy es `2026-08-04`
- **THEN** el hub muestra `2026-09-07` como próxima fecha, no `2026-08-07`
