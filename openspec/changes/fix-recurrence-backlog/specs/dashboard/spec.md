## MODIFIED Requirements

### Requirement: La card "Comprometido" muestra los resúmenes de tarjeta y los gastos fijos del mes próximo (lente COMPROMISO)

La card SHALL responder una sola pregunta: **cuánta plata ya se sabe que hay que pagar el mes siguiente al que se está mirando.** La ventana SHALL ser el **mes calendario siguiente al mes seleccionado** en el navegador —del día 1 al último día—, no "desde hoy" ni "los próximos 30 días", y el encabezado SHALL nombrar ese mes.

**Dos fechas, dos roles.** La lectura SHALL parametrizar por separado:

- `window`: el mes calendario siguiente al mes seleccionado. Define **qué** se cuenta.
- `snapshotDate`: el último día del mes seleccionado, o `hoy_AR` cuando el mes seleccionado es el mes en curso. Define **desde cuándo** se evalúa el estado de cada compromiso.
- `lens`: `'live'` cuando el mes seleccionado **es** el mes en curso, `'snapshot'` en cualquier otro caso. Gobierna cómo se evalúa el estado de pago de los resúmenes.
- `windowElapsed`: verdadero cuando la ventana ya terminó antes de `hoy_AR`. Gobierna si la proyección de reglas de recurrencia sigue aportando.

`lens` y `windowElapsed` SHALL ser campos **separados**: son hechos ortogonales y las dos mitades de la card parten las posiciones del navegador por lugares distintos. Un único campo derivado de "¿la ventana ya terminó?" NO alcanza — el 1º de septiembre, mirando agosto, la ventana es septiembre y todavía no terminó, pero el estado de pago SHALL evaluarse al 31/8 igual.

Las dos NO SHALL colapsarse en un único parámetro: una ventana pasada evaluada con el estado de hoy no es ninguna de las dos lecturas. Parado en junio 2026 la card lee `snapshotDate = 2026-06-30` y `window = 2026-07-01..2026-07-31`.

**El estado de pago es un atributo, no un filtro, bajo la lente `snapshot`.** En `lens: 'live'` la pregunta es "cuánto me va a salir" y lo ya pagado SHALL excluirse. En `lens: 'snapshot'` la pregunta es "qué había que pagar ese mes": que se haya pagado después del corte es el desenlace y NO SHALL sacar el compromiso de la ventana. En consecuencia el monto de un mes pasado SHALL ser **estable**: no SHALL cambiar porque el usuario pague algo hoy.

**Tarjetas** SHALL contar los resúmenes cuyo **vencimiento** cae dentro de la ventana. El universo de tarjetas depende de la lente: con `lens: 'live'` son las **activas**; con `lens: 'snapshot'` SHALL incluirse también las **archivadas**, porque archivar no es retroactivo — una tarjeta archivada el mes pasado estaba vigente durante la ventana que se está leyendo y su resumen fue un compromiso real entonces. Excluirla haría que el total de una ventana pasada cambiara un día en que no se pagó nada. El criterio es la fecha de vencimiento, no la de cierre: un resumen que cierra el 28/09 pero vence el 10/10 se paga en octubre y NO es un compromiso de septiembre.

Su estado de pago SHALL evaluarse a la **fecha financiera del pago** —`period_payments.transaction_id → transactions.date`—, nunca al estado actual del resumen ni a `period_payments.created_at` (que es cuándo se registró en la app, no cuándo salió la plata). Un resumen pagado **después** del `snapshotDate` SHALL contar en esa foto; uno pagado **en o antes** NO SHALL contar, porque a esa fecha ya no era un compromiso pendiente. Pagar un resumen ya cerrado antes de su vencimiento es un flujo soportado por el sistema, así que este caso NO es hipotético.

**Los consumos de un resumen NO SHALL cortarse por fecha.** El resumen aporta su contenido completo; el `snapshotDate` decide únicamente si a esa fecha seguía siendo un compromiso pendiente.

El motivo es que un corte por `transactions.date` rompe las compras en cuotas, que son el contenido dominante de un resumen en este mercado: las N cuotas se insertan **en el momento de la compra**, fechadas `fechaCompra + i meses`, así que una compra de mayo en 12 cuotas ya tiene desde mayo un hijo fechado en julio. Al cierre de junio ese consumo existía y el usuario lo conocía — es exactamente el compromiso que la card está para anticipar — y un corte por fecha lo dejaba afuera. Tampoco SHALL usarse `created_at` en su lugar: ataría un monto de plata al momento de carga en la app, el mismo acoplamiento que esta card rechaza al fechar un pago por `transactions.date` y no por `period_payments.created_at`.

En consecuencia, para un resumen que al corte todavía no había cerrado la card muestra **más** de lo que la pantalla mostraba ese día. Es deliberado: la card responde qué hubo que pagar en la ventana, no qué decía la pantalla el día del corte. A cambio, el monto de una ventana pasada SHALL quedar **estable** una vez cerrados sus resúmenes.

**Gastos fijos** SHALL contar las recurrencias que caen dentro de la ventana y que **NO se pagan con tarjeta de crédito**. Una recurrencia debitada de una tarjeta no saca plata de la cuenta ese mes: entra al resumen de esa tarjeta y se paga cuando ese resumen vence, que es otra ventana. Contarla acá y otra vez dentro de su resumen sería contarla dos veces.

La fuente SHALL componerse de dos partes gobernadas por campos distintos:

- **Qué instancias materializadas cuentan** lo decide `lens`. En `lens: 'live'`, sólo las que siguen `pending`. En `lens: 'snapshot'`, las `confirmed` **y** las `pending`: al corte todas seguían sin resolver, y filtrar por `pending` haría que el monto de esa ventana **encogiera** a medida que el usuario confirma, rompiendo la estabilidad exigida más arriba. Las instancias `skipped` NO SHALL contarse en ningún caso: saltear es el usuario declarando que ese gasto no ocurrió, y esa plata nunca tuvo que salir.

  **Una ocurrencia SHALL ubicarse en la ventana por su VENCIMIENTO**, y SHALL contarse con esa misma fecha. Al resolverse, `scheduled_date` pasa a guardar la **fecha de pago**, así que ubicar por esa columna saca la ocurrencia del mes al que pertenece: una cuota que venció el 10/08 y se pagó el 15/09 desaparecía de agosto —mientras su vencimiento seguía tapando la proyección de agosto— y reaparecía en septiembre encima de la de septiembre.

  **Fallback explícito:** una ocurrencia resuelta antes de que el sistema distinguiera vencimiento de fecha de pago no tiene vencimiento recuperable. Esas SHALL ubicarse por `scheduled_date`, que es la única fecha que tienen y **una fecha legada de significado incierto** —no se sabe si es el vencimiento o la fecha en que se resolvió—, y NO SHALL quedar fuera de toda ventana. Ubicar aproximadamente una fila histórica es el único uso admitido de esa columna.
- **Si la proyección aporta** lo decide `windowElapsed`. Mientras la ventana no haya terminado, las ocurrencias **proyectadas** de las reglas activas SHALL sumarse a las instancias; una vez terminada, NO SHALL proyectarse: la proyección usaría los montos actuales de las reglas, perdería las dadas de baja e inventaría las creadas después.

- **Los ingresos recurrentes SHALL componerse de las mismas dos fuentes.** Las ocurrencias de ingreso ya materializadas que sigan **sin resolver** SHALL sumarse a "Ya entra", además de la proyección: una ocurrencia materializada queda restada de la proyección, así que sumar sólo la proyección la haría desaparecer de la banda. Las `confirmed` NO SHALL contarse —esa plata ya está en la cuenta— ni las `skipped`.

  La bajada del grupo NO SHALL llamar "pendientes" a sus filas bajo `lens: 'snapshot'`: ahí el conjunto incluye instancias `confirmed`, que es justamente lo que impide que una ventana pasada encoja, y llamarlas pendientes describe mal un gasto ya pagado. SHALL usar un rótulo neutro ("N gastos fijos"). Bajo `live` el conjunto sí es sólo `pending` y el rótulo original SHALL conservarse.

  Cuando `lens: 'snapshot'` y `windowElapsed: false` conviven —el mes anterior, cuya ventana es el mes en curso— la proyección se hace sobre las reglas **vigentes hoy**, de modo que una regla creada o editada después del corte aporta a esa lectura con sus valores actuales. Se acepta explícitamente: no proyectar ahí dejaría la ventana en casi cero, porque el generador todavía no materializó sus instancias, y un monto levemente desactualizado informa más que uno ausente.

**Las dos fuentes NO SHALL superponerse, y lo que las separa SHALL ser el conjunto de ocurrencias que ya existen** en la ventana, en **cualquier** estado —pendiente, confirmada y omitida—. La proyección de una regla SHALL restar ese conjunto: una ocurrencia que ya tiene fila NO SHALL volver a anunciarse como proyectada.

NO SHALL usarse `last_generated_date` para separarlas. Ese cursor sólo avanzaba cuando el usuario **resolvía** una ocurrencia, de modo que una sin resolver quedaba **antes** de él: la lectura de instancias la contaba y la proyección, caminando desde el cursor, la emitía otra vez. La misma cuota, dos veces, justo para el usuario que no se puso al día.

**Sólo un vencimiento exacto SHALL tapar una fecha.** Una ocurrencia con vencimiento desconocido se muestra ubicada por la única fecha que tiene, pero NO SHALL restarse de la proyección: `scheduled_date` no es una identidad sino una fecha legada de significado incierto, y dejar que reserve un día del calendario haría que una fila histórica tapara la ocurrencia real de ese día — una fecha incierta ocupando una real, que es exactamente lo que el modelo de identidad rechaza.

**Las lecturas que alimentan la card SHALL leerse completas**, paginando hasta agotarlas y ordenando por columnas que identifiquen la fila. Una respuesta truncada no es sólo una lectura incompleta: las ocurrencias que quedan afuera dejan de tapar sus propias fechas, así que la proyección las vuelve a emitir y aparece plata comprometida que nadie debe.

**La ventana bajo lente `snapshot` es un registro reconstruido, no un replay de la pantalla.** El generador materializa las ocurrencias sólo cuando la fecha ya llegó, de modo que al cierre del mes seleccionado los gastos fijos de la ventana eran **proyección no persistida**. Esa proyección no se puede reconstruir: las reglas no tienen versionado histórico. La card SHALL presentar la ventana pasada como lo que efectivamente hubo que pagar, y el sistema NO SHALL prometer fidelidad a lo que la pantalla mostraba ese día.

**Lo ya vencido SHALL mostrarse, marcado aparte, con UNA sola regla en las tres posiciones.** Un resumen cuyo vencimiento ya había pasado **al `snapshotDate`** y que a esa fecha seguía impago es plata que se debía y desaparecería de la pantalla si la card se limitara a su ventana: SHALL sumarse con su **propia etiqueta explícita** —nombrando que está vencido— y NO SHALL confundirse dentro del monto de la ventana.

El arrastre NO SHALL evaluarse contra `hoy_AR` cuando la lente es `snapshot`: mezclaría dos horizontes dentro de una misma lectura. Con `lens: 'live'` el `snapshotDate` **es** hoy, así que la regla se reduce al comportamiento actual sin caso especial.

El arrastre se refiere a resúmenes vencidos **antes** de que la ventana abra, no a los de la ventana: los de la ventana vencen todos después del corte, y por eso los dos conjuntos son disjuntos por construcción. Disjuntos pero NO exhaustivos: un resumen que vence exactamente el `snapshotDate` no cae en ninguno de los dos. Es el mismo KNOWN GAP que la card ya tiene —un resumen que vence antes de que la ventana abra no está en ningún conjunto—, angostado de "lo que resta del mes" a un solo día. El umbral SHALL seguir siendo estrictamente `<`, que es la definición de vencido de `derivePeriodStatus`: un resumen que vence el día del corte está **cerrado esperando pago**, no vencido, y la card NO SHALL contradecir al módulo de tarjetas sobre esa palabra. Que un resumen anterior a la ventana estuviera vencido al corte es un hecho perfectamente reconstruible y NO SHALL descartarse por estar mirando un mes pasado — al cierre de agosto, un resumen que venció el 28/07 y seguía impago estaba vencido, y la card de ese día lo decía.

El aviso SHALL ocupar **una sola línea**: la card comparte fila con "Cuánto gastaste" y todo lo que crece acá aparece como hueco en la card vecina.

Lo que **NO** entra: los consumos de tarjeta cuyo resumen vence fuera de la ventana, las recurrencias fuera de la ventana, y cualquier gasto que todavía no exista como compromiso.

La card SHALL encabezar con el mes al que refiere y un link al listado completo, y SHALL mostrar un bloque de total con: el rótulo "Ya comprometido", el monto total en ARS, su línea USD según la regla bimoneda, una **barra apilada** de dos segmentos (Tarjetas y Gastos fijos) y una leyenda con el cuadradito y el porcentaje de cada uno.

El total SHALL ser `Tarjetas + Gastos fijos` dentro de cada moneda, y los porcentajes de la barra SHALL derivarse de ese total — NO SHALL hardcodearse. Cuando el total es cero, la barra NO SHALL renderizarse con proporciones arbitrarias.

El detalle de Tarjetas SHALL agregarse **por tarjeta** —una fila por tarjeta con su total comprometido y su próximo cierre en la bajada del grupo—, no por consumo individual: la pregunta del usuario es cuánto le viene de cada tarjeta.

Los estados vacíos SHALL cubrirse por separado: sin tarjetas con compromiso, el grupo Tarjetas muestra su vacío; sin gastos fijos, el grupo Gastos fijos muestra el suyo; sin ninguno de los dos, la card muestra un vacío único en lugar de dos vacíos apilados.

**El mes rotulado SHALL derivarse del resultado de la lectura**, que SHALL exponer su `window`, su `snapshotDate`, su `lens` y su `windowElapsed`. Ninguna plataforma SHALL recalcular el mes por su cuenta a partir del reloj: dos relojes independientes es exactamente lo que hacía que la card ignorara el navegador.

#### Scenario: La card sigue al mes seleccionado

- **WHEN** el usuario está en septiembre 2026 y navega a junio 2026
- **THEN** la card lee la ventana `2026-07-01..2026-07-31` con `snapshotDate = 2026-06-30`
- **AND** su encabezado nombra julio 2026

#### Scenario: Un resumen que cierra dentro de la ventana pero vence después

- **WHEN** una tarjeta cierra el 28 de septiembre y vence el 10 de octubre
- **THEN** ese resumen NO suma en los compromisos de septiembre
- **AND** sí suma cuando la ventana es octubre

#### Scenario: Un resumen de la ventana que ya fue pagado

- **WHEN** el usuario mira junio 2026 y un resumen que vencía el 10/07 fue pagado el 12/07
- **THEN** ese resumen suma en la foto de junio, porque al 30/06 seguía por pagar
- **AND** el monto de esa foto no cambia si el usuario paga otro resumen hoy

#### Scenario: Un resumen pagado antes del corte

- **WHEN** un resumen que cerró el 20/06 y vencía el 05/07 fue pagado el 25/06
- **THEN** NO suma en la foto de junio: a esa fecha ya no era un compromiso pendiente

#### Scenario: Un resumen que al corte todavía no había cerrado

- **WHEN** el usuario mira junio 2026 y un resumen de la ventana cerraba el 15/07
- **THEN** ese resumen aporta su contenido completo, no sólo lo acumulado al 30/06
- **AND** el monto de esa foto no cambia una vez cerrado el resumen

#### Scenario: Cuotas futuras ya conocidas al corte

- **WHEN** el usuario compró en mayo 2026 en 12 cuotas y mira junio 2026
- **THEN** la cuota fechada en julio suma en la foto de junio, porque al 30/06 ya existía y era un compromiso conocido
- **AND** el sistema NO filtra los consumos por `transactions.date` ni por `created_at`

#### Scenario: El mes anterior usa el corte de su cierre aunque su ventana no haya terminado

- **WHEN** hoy es el 01/09/2026 y el usuario mira agosto 2026
- **THEN** la ventana es septiembre 2026 y el estado de pago se evalúa al 31/08
- **AND** la proyección de reglas activas sigue aportando, porque septiembre todavía no terminó

#### Scenario: El monto de una ventana no encoge mientras se confirman recurrencias

- **WHEN** el usuario mira agosto 2026 el 01/09 y vuelve a mirarlo el 20/09, habiendo confirmado entretanto varias recurrencias de septiembre
- **THEN** el total de gastos fijos de esa ventana es el mismo en las dos visitas

#### Scenario: Una recurrencia que se paga con tarjeta

- **WHEN** una recurrencia de la ventana se debita de una tarjeta de crédito
- **THEN** NO suma en "Gastos fijos"
- **AND** llegará como parte del resumen de esa tarjeta, en la ventana en que ese resumen venza

#### Scenario: Una recurrencia ya generada y una todavía proyectada

- **WHEN** el mes seleccionado es el actual, el generador ya creó la instancia de la ventana de una regla mensual y la de la siguiente todavía no
- **THEN** la ventana cuenta esa instancia una sola vez
- **AND** la proyección no la vuelve a agregar

#### Scenario: Una ocurrencia SIN RESOLVER no se cuenta dos veces

- **WHEN** una regla mensual de $500.000 tiene la ocurrencia de la ventana materializada y todavía sin resolver
- **THEN** la card la cuenta una sola vez
- **AND** la proyección no vuelve a emitir esa misma fecha

#### Scenario: Una cuota pagada más tarde cuenta en el mes en que venció

- **WHEN** una cuota vence el `2026-08-10` y se paga el `2026-09-15`
- **THEN** cuenta en la ventana de agosto, una sola vez
- **AND** no cuenta en la ventana de septiembre

#### Scenario: Una ocurrencia sin vencimiento recuperable no desaparece

- **WHEN** una ocurrencia resuelta antes de la distinción tiene su vencimiento desconocido
- **THEN** se ubica en la ventana por la única fecha que conserva
- **AND** cuenta una sola vez

#### Scenario: Un vencimiento desconocido no tapa la ocurrencia real de esa fecha

- **WHEN** un pago histórico con vencimiento desconocido quedó registrado el `2026-08-10` y la regla tiene además su ocurrencia real del `2026-08-10`
- **THEN** la card cuenta las dos
- **AND** la ocurrencia real sigue proyectándose

#### Scenario: Un ingreso materializado sigue apareciendo en "Ya entra"

- **WHEN** la ocurrencia de un ingreso recurrente ya está materializada y sigue sin resolver
- **THEN** "Ya entra" la cuenta una sola vez

#### Scenario: Una respuesta truncada no inventa compromiso

- **WHEN** la ventana tiene más ocurrencias de las que el servidor devuelve en una sola respuesta
- **THEN** la card las lee todas
- **AND** el monto no incluye ninguna ocurrencia que ya exista

#### Scenario: Gastos fijos de una ventana ya terminada

- **WHEN** el usuario mira junio 2026 y en julio hubo tres instancias: una confirmada, una salteada y una que quedó pendiente
- **THEN** la card cuenta la confirmada y la pendiente
- **AND** NO cuenta la salteada
- **AND** no reproyecta las reglas activas sobre julio

#### Scenario: Un resumen vencido e impago, mirando el mes actual

- **WHEN** un resumen venció el mes pasado y sigue sin pagarse
- **THEN** la card lo muestra con su etiqueta de vencido, en una sola línea
- **AND** ese monto no se confunde con el de la ventana

#### Scenario: El arrastre de vencidos también existe bajo la lente snapshot

- **WHEN** un resumen venció el 28/07, siguió impago, y el usuario mira agosto 2026
- **THEN** la card lo muestra como vencido, porque al 31/08 ya lo estaba
- **AND** no se confunde con el monto de la ventana de septiembre

#### Scenario: El arrastre se evalúa al corte, no a hoy

- **WHEN** un resumen venció el 28/07, se pagó el 15/08, y el usuario mira julio 2026
- **THEN** figura como vencido, porque al 31/07 estaba vencido e impago
- **WHEN** el mismo usuario mira agosto 2026
- **THEN** NO figura, porque al 31/08 ya estaba pago

#### Scenario: Usuario sin compromisos de ningún tipo

- **WHEN** no hay ni tarjetas ni gastos fijos comprometidos
- **THEN** la card muestra un único estado vacío
- **AND** no renderiza la barra apilada con proporciones inventadas

---
