## MODIFIED Requirements

### Requirement: El desglose pesa por el neto de cada categoría, por moneda

El peso de cada categoría SHALL ser el **neto por moneda** = suma de gastos de esa categoría − suma de reintegros recibidos de esa categoría (categoría derivada del gasto). El desglose SHALL ser sólo de **gastos** (los ingresos no participan). ARS y USD NO SHALL sumarse entre sí: la vista muestra **una moneda por vez**, con ARS por defecto y un toggle ARS|USD.

**El toggle se gatea por el usuario, no por el mes.** El toggle SHALL aparecer cuando el usuario **opera en USD** —tiene al menos una cuenta con moneda USD (bimoneda)—, y NO cuando el mes visualizado casualmente tuvo movimientos en USD. Gatearlo por mes haría que el control desapareciera al navegar a un mes sin gasto USD, dejando al usuario bimoneda sin forma de volver a la lectura en dólares; la pregunta que responde el gate es "¿este usuario piensa en dos monedas?", que es month-independent y por lo tanto cacheable a nivel usuario.

Cuentan los gastos con **fecha contable en el mes** seleccionado (base **devengado**): gastos cash/débito, consumos de tarjeta, y **cada cuota** de una compra en cuotas.

**Corte temporal — de CAJA, no universal.** Un gasto **on-ledger** (efectivo/débito, `status IS NULL`) con `date > hoy_AR` NO SHALL contar en el desglose: la plata no salió de ninguna cuenta todavía, así que no es gasto del mes (mismo `hoy_AR` que corta el saldo y "Balance del mes": la fecha calendario en `America/Argentina/Buenos_Aires`). Las filas de **tarjeta** (`status` 'pending'/'paid') NO SHALL cortarse por fecha: para la lente devengado la unidad de acumulación es el **mes**, no el día, así que la cuota o el consumo fechados más adelante en el mes en curso SHALL contar desde el día 1 — ya están incurridos, y esconderlos hasta que llegue su día haría que la dona arrancara vacía cada mes y se llenara sin que exista gasto nuevo.

Ese mismo corte SHALL aplicarse **idénticamente** en el desglose, en la lista drilleada de una categoría y en el drill de subcategorías: son la misma lente a distinto nivel de detalle, y la reconciliación exigida más abajo (la lista suma el peso del donut) solo se sostiene si las tres descartan exactamente las mismas filas.

**Semántica de fecha (cuotas) — explícita para evitar ambigüedad:** una compra en cuotas NO impacta su total junto en el mes de compra. Cada cuota impacta el mes de la **fecha de su transacción hija** (`date` de cada cuota, que está alineada a su período de tarjeta), no la fecha de compra de la operación original. La compra "madre" (`is_parent`, off-ledger, `account_id=null`) NUNCA cuenta. Es decir: una compra de 12 cuotas en marzo aporta solo 1/12 en marzo, 1/12 en abril, etc., cada una en el mes de su cuota.

El **pago del resumen de tarjeta NO es gasto** (cancela deuda) y NO cuenta en "En qué se fue". **El pago de resumen PUEDE aparecer en "Balance del mes" como salida de caja (lente CAJA), pero NUNCA en "En qué se fue" (lente CONSUMO)** — son lentes distintas que responden preguntas distintas, y por eso sus totales difieren a propósito.

Los reintegros **recibidos** (no cancelados) de esa categoría restan, por su **fecha**, sin importar su destino (`reimbursement_target`: "a cuenta" o "en resumen") — para la categorización solo importa que volvió plata a esa categoría. Les aplica el mismo corte de caja: un reintegro fechado adelante todavía no volvió.

Cuando hay al menos un crédito, el total del centro deja de ser el gasto del mes: es la suma de lo dibujado, ni bruto ni neto. Por eso la card SHALL cerrar, sólo en ese caso, con una línea que muestre **el neto del mes** = total del centro − suma de los créditos. Sin créditos esa línea NO SHALL mostrarse: el centro ya es el neto y repetirlo sería ruido. La línea SHALL existir en **ambas plataformas** y SHALL calcularse con aritmética de dinero, no con resta de floats.

Esa línea es el puente con la card "Cuánto gastaste" del Inicio, que muestra el mismo neto en el caso corriente. Las dos pantallas PUEDEN seguir difiriendo por dos causas que esta línea no explica y que NO SHALL ocultarse detrás de ella: un balde de "Cuánto gastaste" pisado en cero (reintegro mayor que el gasto de ese medio de pago) y las filas sin cuenta asignada, que el Inicio saltea.

El neto de una categoría PUEDE quedar **negativo** (un **crédito**): cuando los reintegros recibidos de la categoría en el mes superan su gasto del mes (p. ej. un reintegro cuyo gasto original fue de un mes anterior, o un consumo de tarjeta aún no devengado). El sistema NO SHALL descartar ni capear a cero esos netos negativos: SHALL mostrarlos como **créditos** ("te devolvieron"), separados del peso de gasto y **fuera de la dona** (una dona no puede representar una porción negativa). El total/peso de la dona SHALL derivarse solo de los netos positivos. Los créditos SHALL mostrarse en **ambas plataformas**.

#### Scenario: Con una categoría en crédito, la card cierra con el neto

- **WHEN** el mes cierra con la dona en $2.211.312,91 y una categoría en crédito por $146.985,07
- **THEN** debajo del bloque "te devolvieron" la card muestra una línea con $2.064.327,84
- **AND** ese es el mismo número que la card "Cuánto gastaste" del Inicio muestra para ese mes

#### Scenario: Sin créditos no aparece la línea de cierre

- **WHEN** ninguna categoría del mes quedó en crédito
- **THEN** la card no muestra la línea de cierre
- **AND** el total del centro ya es el neto del mes

#### Scenario: El neto descuenta los reintegros recibidos

- **WHEN** una categoría tiene $100.000 de gastos en el mes y un reintegro recibido de $20.000
- **THEN** la categoría pesa $80.000 en el desglose

#### Scenario: Los consumos de tarjeta cuentan como gasto del mes

- **WHEN** el usuario tuvo un consumo de tarjeta categorizado este mes
- **THEN** ese consumo cuenta en el desglose de su categoría (aunque no haya tocado el disponible)

#### Scenario: Cada cuota cuenta en el mes que devenga

- **WHEN** el usuario compró en 12 cuotas en marzo con tarjeta
- **THEN** en el desglose de marzo cuenta solo la cuota 1/12 (no el total)
- **AND** en abril cuenta la cuota 2/12, y así sucesivamente
- **AND** la compra "madre" off-ledger nunca cuenta

#### Scenario: El pago del resumen no es gasto categorizado

- **WHEN** el usuario paga el resumen de la tarjeta en el mes
- **THEN** ese pago NO aparece en el desglose por categoría (es cancelación de deuda, no consumo)
- **AND** los consumos ya contaron en el mes en que se hicieron

#### Scenario: Una categoría puede quedar en crédito

- **WHEN** una categoría recibe en el mes un reintegro de $10.000 y no tiene gasto en ese mes (el gasto original fue antes)
- **THEN** la categoría muestra un crédito de $10.000 ("te devolvieron"), fuera de la dona
- **AND** ese crédito NO se descarta ni se capea a cero

#### Scenario: Una moneda por vez

- **WHEN** el usuario tuvo gastos en ARS y en USD en el mes
- **THEN** el desglose muestra ARS por defecto y ofrece un toggle para ver USD
- **AND** nunca suma ARS y USD en el mismo total

#### Scenario: El toggle de moneda sobrevive a un mes sin gasto en USD

- **WHEN** el usuario tiene al menos una cuenta en USD y navega a un mes donde no hubo ningún movimiento en USD
- **THEN** el toggle ARS|USD sigue visible
- **AND** al elegir USD el desglose muestra su estado vacío de ese mes, no la lectura en ARS

#### Scenario: El usuario monomoneda no ve el toggle

- **WHEN** el usuario no tiene ninguna cuenta con moneda USD
- **THEN** el desglose no muestra el toggle ARS|USD en ninguna plataforma

#### Scenario: Un gasto de caja fechado adelante no pesa todavía

- **WHEN** hoy es el 1 de agosto y la categoría Hogar tiene un gasto de débito de $300.000 fechado el 20 de agosto
- **THEN** ese gasto NO cuenta en el desglose de agosto
- **AND** el 20 de agosto pasa a contar automáticamente

#### Scenario: La cuota de tarjeta del mes pesa desde el día 1

- **WHEN** hoy es el 1 de agosto y la categoría Hogar tiene una cuota de tarjeta de $50.000 fechada el 20 de agosto
- **THEN** esa cuota SÍ cuenta en el desglose de agosto desde hoy (ya está incurrida: la compra ocurrió antes)
