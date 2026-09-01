# dashboard — delta

## MODIFIED Requirements

### Requirement: El selector de mes del dashboard gobierna las secciones mensuales

El dashboard SHALL exponer un navegador mensual `‹ Mes Año ›` (`MonthNavigator`) cuyo estado vive en un context client-side compartido (`DashboardMonthProvider` en web; su espejo nativo en mobile), inicializado en el mes actual derivado de `getTodayAR()`. Su ubicación es específica de cada plataforma: en **web** vive en el header de la página (junto al eye toggle y "Nuevo movimiento"); en **nativo** vive dentro del header navy de la pantalla, debajo del saludo, ocupando el ancho (pill blanca sobre navy).

Cambiar el mes seleccionado SHALL actualizar **en simultáneo la card de saldo completa** —el saldo, el desglose "Dónde está" y "Resumen del mes"—, la card **"Cuánto gastaste"** y la card **"Compromisos del próximo mes"**. El saldo deja de ser "de hoy": se corta al último día del mes seleccionado. Es lo que permite que los tres montos del resumen cierren contra él; dejar el saldo de hoy encima de los flujos de otro mes rompía la única verificación que la card ofrece al usuario.

La card de compromisos SHALL seguir al selector con un **desfasaje de un mes**: parado en el mes M, muestra los compromisos del mes **M+1** (ver el requirement de la card "Comprometido"). Ese desfasaje NO es una inconsistencia sino la condición para que los dos montos de la pantalla sean comparables: el saldo corta el último día de M y la ventana de compromisos abre el 1º de M+1, de modo que en **toda** posición del navegador las dos lecturas son **disjuntas y contiguas** —sin solape y sin hueco—. Una ventana que cubriera el mismo mes M contaría compromisos cuyo pago ya salió del saldo que la card de arriba muestra.

La tira "Compartido" NO SHALL seguir al selector: muestra el neto vigente del hogar.

La navegación de mes NO SHALL modificar la URL/ruta ni provocar una navegación; el mes seleccionado NO se persiste (al re-montar, abre en el mes actual; en nativo, salir del tab y volver resetea al mes actual, mismo mecanismo de remount que el eye-mask). Las flechas SHALL permitir navegar hasta 12 meses hacia atrás; la flecha derecha SHALL deshabilitarse en el mes actual (no se navega al futuro) — en consecuencia la ventana de compromisos nunca se proyecta más allá de "mes actual + 1", que es el mismo horizonte que la card ya tenía. Cada sección mensual SHALL obtener los datos del mes no-actual client-side (web: TanStack sobre el cliente del browser; nativo: su hook TanStack existente) mostrando su propio estado de carga in-card; en web el mes actual llega server-rendered como initial data.

#### Scenario: Cambiar el mes mueve la card de saldo entera

- **WHEN** el usuario en agosto 2026 toca la flecha izquierda del navegador
- **THEN** el saldo, "Dónde está", "Resumen del mes" y "Cuánto gastaste" muestran julio 2026
- **AND** el saldo es el del cierre de julio, no el de hoy
- **AND** no hay navegación de ruta ni recarga de pantalla

#### Scenario: Compromisos sigue al selector con un mes de desfasaje

- **WHEN** el usuario navega a junio 2026
- **THEN** la card de compromisos muestra la ventana `2026-07-01..2026-07-31`
- **AND** su encabezado nombra julio, no el mes siguiente a hoy
- **AND** la tira "Compartido" no cambia

#### Scenario: El saldo y los compromisos nunca se solapan

- **WHEN** el usuario está parado en cualquier mes del navegador
- **THEN** el corte del saldo (último día del mes seleccionado, u hoy si es el mes en curso) es anterior al primer día de la ventana de compromisos
- **AND** ningún movimiento aporta a los dos montos a la vez

#### Scenario: Límites de navegación

- **WHEN** el usuario está en el mes actual
- **THEN** la flecha derecha está deshabilitada
- **AND** tras navegar 12 meses hacia atrás, la flecha izquierda se deshabilita

#### Scenario: Mes no-actual se fetchea client-side con loading in-card

- **WHEN** el usuario navega a un mes cuyos datos no están cargados
- **THEN** cada sección mensual muestra su skeleton in-card (título y chrome visibles) mientras su fetch resuelve
- **AND** una falla en el fetch de una sección muestra error compacto en esa sección sin romper las otras

#### Scenario: El navegador vive en el header navy (mobile)

- **WHEN** el usuario abre el dashboard en la app nativa
- **THEN** el `MonthNavigator` se renderiza dentro del header navy, debajo del saludo, ocupando el ancho
- **AND** salir del tab y volver resetea la selección al mes actual

---

### Requirement: La card "Comprometido" muestra los resúmenes de tarjeta y los gastos fijos del mes próximo (lente COMPROMISO)

La card SHALL responder una sola pregunta: **cuánta plata ya se sabe que hay que pagar el mes siguiente al que se está mirando.** La ventana SHALL ser el **mes calendario siguiente al mes seleccionado** en el navegador —del día 1 al último día—, no "desde hoy" ni "los próximos 30 días", y el encabezado SHALL nombrar ese mes.

**Dos fechas, dos roles.** La lectura SHALL parametrizar por separado:

- `window`: el mes calendario siguiente al mes seleccionado. Define **qué** se cuenta.
- `snapshotDate`: el último día del mes seleccionado, o `hoy_AR` cuando el mes seleccionado es el mes en curso. Define **desde cuándo** se evalúa el estado de cada compromiso.
- `mode`: `'past'` cuando la ventana terminó antes de `hoy_AR`, `'current'` en caso contrario.

Las dos NO SHALL colapsarse en un único parámetro: una ventana pasada evaluada con el estado de hoy no es ninguna de las dos lecturas. Parado en junio 2026 la card lee `snapshotDate = 2026-06-30` y `window = 2026-07-01..2026-07-31`.

**El estado de pago es un atributo, no un filtro, en ventana pasada.** En `mode: 'current'` la pregunta es "cuánto me va a salir" y lo ya pagado SHALL excluirse. En `mode: 'past'` la pregunta es "qué había que pagar ese mes": que se haya pagado después es el desenlace y NO SHALL sacar el compromiso de la ventana. En consecuencia el monto de un mes pasado SHALL ser **estable**: no SHALL cambiar porque el usuario pague algo hoy.

**Tarjetas** SHALL contar los resúmenes cuyo **vencimiento** cae dentro de la ventana. El criterio es la fecha de vencimiento, no la de cierre: un resumen que cierra el 28/09 pero vence el 10/10 se paga en octubre y NO es un compromiso de septiembre.

Su estado de pago SHALL evaluarse a la **fecha financiera del pago** —`period_payments.transaction_id → transactions.date`—, nunca al estado actual del resumen ni a `period_payments.created_at` (que es cuándo se registró en la app, no cuándo salió la plata). Un resumen pagado **después** del `snapshotDate` SHALL contar en esa foto; uno pagado **en o antes** NO SHALL contar, porque a esa fecha ya no era un compromiso pendiente. Pagar un resumen ya cerrado antes de su vencimiento es un flujo soportado por el sistema, así que este caso NO es hipotético.

Los consumos de un resumen SHALL cortarse en `date <= snapshotDate`. Un resumen que al corte todavía no había cerrado aporta **lo acumulado hasta esa fecha** y ese monto puede crecer hasta el cierre; la card NO SHALL presentarlo como definitivo. Es la misma regla que ya rige para el resumen abierto, con el `snapshotDate` en el rol de "hoy". El corte de consumos y el de pagos SHALL aplicarse juntos: reconstruir uno sin el otro produce un monto que no corresponde a ninguna lectura.

**Gastos fijos** SHALL contar las recurrencias que caen dentro de la ventana y que **NO se pagan con tarjeta de crédito**. Una recurrencia debitada de una tarjeta no saca plata de la cuenta ese mes: entra al resumen de esa tarjeta y se paga cuando ese resumen vence, que es otra ventana. Contarla acá y otra vez dentro de su resumen sería contarla dos veces.

La fuente SHALL depender del `mode`:

- En `mode: 'current'`, el conjunto SHALL componerse de las instancias **ya generadas** con fecha dentro de la ventana y todavía sin resolver, más las ocurrencias **proyectadas** de las reglas activas sobre esa misma ventana. Las dos fuentes NO SHALL superponerse: la proyección avanza desde `last_generated_date`, de modo que nunca devuelve una ocurrencia ya generada.
- En `mode: 'past'`, la fuente SHALL ser **únicamente** las `recurrence_instances` materializadas de la ventana, con status `confirmed` o `pending`. Las instancias `skipped` NO SHALL contarse: saltear es el usuario declarando que ese gasto no ocurrió, y esa plata nunca tuvo que salir. NO SHALL reproyectarse las reglas sobre una ventana pasada: la proyección usaría los montos actuales de las reglas, perdería las dadas de baja e inventaría las creadas después.

**La ventana pasada es un registro reconstruido, no un replay de la pantalla.** El generador materializa una sola instancia pendiente por regla y sólo cuando la fecha ya llegó, de modo que al cierre del mes seleccionado los gastos fijos de la ventana eran **proyección no persistida**. Esa proyección no se puede reconstruir: las reglas no tienen versionado histórico. La card SHALL presentar la ventana pasada como lo que efectivamente hubo que pagar, y el sistema NO SHALL prometer fidelidad a lo que la pantalla mostraba ese día.

**Lo ya vencido SHALL mostrarse, marcado aparte, y su significado depende del `mode`.** En `mode: 'current'`, un resumen cuyo vencimiento ya pasó y sigue impago es plata que se debe y desaparecería de la pantalla si la card se limitara a su ventana: SHALL sumarse con su **propia etiqueta explícita** —nombrando que está vencido— y NO SHALL confundirse dentro del monto de la ventana. En `mode: 'past'` no hay arrastre que mostrar (todo vencimiento de la ventana es posterior al corte), y el mismo slot SHALL reusarse para declarar **cuánto de esa ventana sigue impago hoy**. En ambos casos el aviso SHALL ocupar **una sola línea**: la card comparte fila con "Cuánto gastaste" y todo lo que crece acá aparece como hueco en la card vecina.

Lo que **NO** entra: los consumos de tarjeta cuyo resumen vence fuera de la ventana, las recurrencias fuera de la ventana, y cualquier gasto que todavía no exista como compromiso.

La card SHALL encabezar con el mes al que refiere y un link al listado completo, y SHALL mostrar un bloque de total con: el rótulo "Ya comprometido", el monto total en ARS, su línea USD según la regla bimoneda, una **barra apilada** de dos segmentos (Tarjetas y Gastos fijos) y una leyenda con el cuadradito y el porcentaje de cada uno.

El total SHALL ser `Tarjetas + Gastos fijos` dentro de cada moneda, y los porcentajes de la barra SHALL derivarse de ese total — NO SHALL hardcodearse. Cuando el total es cero, la barra NO SHALL renderizarse con proporciones arbitrarias.

El detalle de Tarjetas SHALL agregarse **por tarjeta** —una fila por tarjeta con su total comprometido y su próximo cierre en la bajada del grupo—, no por consumo individual: la pregunta del usuario es cuánto le viene de cada tarjeta.

Los estados vacíos SHALL cubrirse por separado: sin tarjetas con compromiso, el grupo Tarjetas muestra su vacío; sin gastos fijos, el grupo Gastos fijos muestra el suyo; sin ninguno de los dos, la card muestra un vacío único en lugar de dos vacíos apilados.

**El mes rotulado SHALL derivarse del resultado de la lectura**, que SHALL exponer su `window`, su `snapshotDate` y su `mode`. Ninguna plataforma SHALL recalcular el mes por su cuenta a partir del reloj: dos relojes independientes es exactamente lo que hacía que la card ignorara el navegador.

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
- **THEN** ese resumen aporta únicamente los consumos con fecha hasta el 30/06
- **AND** la card no lo presenta como un monto definitivo

#### Scenario: Una recurrencia que se paga con tarjeta

- **WHEN** una recurrencia de la ventana se debita de una tarjeta de crédito
- **THEN** NO suma en "Gastos fijos"
- **AND** llegará como parte del resumen de esa tarjeta, en la ventana en que ese resumen venza

#### Scenario: Una recurrencia ya generada y una todavía proyectada

- **WHEN** el mes seleccionado es el actual, el generador ya creó la instancia de la ventana de una regla mensual y la de la siguiente todavía no
- **THEN** la ventana cuenta esa instancia una sola vez
- **AND** la proyección no la vuelve a agregar

#### Scenario: Gastos fijos de una ventana pasada

- **WHEN** el usuario mira junio 2026 y en julio hubo tres instancias: una confirmada, una salteada y una que quedó pendiente
- **THEN** la card cuenta la confirmada y la pendiente
- **AND** NO cuenta la salteada
- **AND** no reproyecta las reglas activas sobre julio

#### Scenario: Un resumen vencido e impago, mirando el mes actual

- **WHEN** un resumen venció el mes pasado y sigue sin pagarse
- **THEN** la card lo muestra con su etiqueta de vencido, en una sola línea
- **AND** ese monto no se confunde con el de la ventana

#### Scenario: Una ventana pasada con saldo impago

- **WHEN** el usuario mira una ventana pasada de la que un resumen sigue sin pagarse hoy
- **THEN** el mismo slot de una línea declara cuánto de esa ventana sigue impago
- **AND** la card no cambia de alto respecto de la ventana actual

#### Scenario: Usuario sin compromisos de ningún tipo

- **WHEN** no hay ni tarjetas ni gastos fijos comprometidos
- **THEN** la card muestra un único estado vacío
- **AND** no renderiza la barra apilada con proporciones inventadas

---

### Requirement: Cada sección del dashboard rotula la pregunta que ayuda a responder

Cada bloque del dashboard SHALL llevar un título que nombre la pregunta que responde, en el lenguaje del usuario y no en el del dominio: "Saldo disponible total" y "Dónde está" para cuánto tengo y dónde, "Resumen del mes" para qué pasó este mes, "Cuánto gastaste" para en qué se me fue y cuánto debo todavía, "Compromisos del próximo mes" para qué se viene, y "Compartido" para cómo estoy con el hogar.

El título de la card de compromisos SHALL depender del `mode` de su lectura. En `mode: 'current'` SHALL seguir siendo "Compromisos del próximo mes": es un pronóstico. En `mode: 'past'` SHALL rotular lo que el número efectivamente es —lo que hubo que pagar en ese mes—, porque en esa posición del navegador ya no anticipa nada. Los dos títulos SHALL salir del catálogo i18n, sin string hardcodeado, y ninguna plataforma SHALL derivar el mes del rótulo de su propio reloj.

Los rótulos de los tres tiles de "Cuánto gastaste" SHALL ser verbos en pasado dirigidos al usuario (Gastaste / Pagaste / Te queda por pagar), y cada uno SHALL ir acompañado de un sub-bloque que desambigüe qué mide, porque los tres son montos de gasto y sin esa aclaración se confunden entre sí.

#### Scenario: Los tres tiles se distinguen entre sí

- **WHEN** el usuario lee la card "Cuánto gastaste"
- **THEN** cada tile aclara en su sub-bloque qué mide su monto
- **AND** queda explícito que "Te queda por pagar" es lo financiado con tarjeta

#### Scenario: El título de compromisos cambia con la posición del navegador

- **WHEN** el usuario está en el mes actual
- **THEN** la card se titula "Compromisos del próximo mes"
- **WHEN** el usuario navega a un mes pasado
- **THEN** el título nombra lo que hubo que pagar en la ventana de ese mes
