## MODIFIED Requirements

### Requirement: El desglose pesa por el neto de cada categoría, por moneda

El peso de cada categoría SHALL ser el **neto por moneda** = suma de gastos de esa categoría − suma de reintegros recibidos de esa categoría (categoría derivada del gasto). El desglose SHALL ser sólo de **gastos** (los ingresos no participan). ARS y USD NO SHALL sumarse entre sí: la vista muestra **una moneda por vez**, con ARS por defecto y un toggle ARS|USD que aparece cuando hay gasto en USD en el mes.

Cuentan los gastos con **fecha contable en el mes** seleccionado (base **devengado**): gastos cash/débito, consumos de tarjeta, y **cada cuota** de una compra en cuotas.

**Semántica de fecha (cuotas) — explícita para evitar ambigüedad:** una compra en cuotas NO impacta su total junto en el mes de compra. Cada cuota impacta el mes de la **fecha de su transacción hija** (`date` de cada cuota, que está alineada a su período de tarjeta), no la fecha de compra de la operación original. La compra "madre" (`is_parent`, off-ledger, `account_id=null`) NUNCA cuenta. Es decir: una compra de 12 cuotas en marzo aporta solo 1/12 en marzo, 1/12 en abril, etc., cada una en el mes de su cuota.

El **pago del resumen de tarjeta NO es gasto** (cancela deuda) y NO cuenta en "En qué se fue". **El pago de resumen PUEDE aparecer en "Balance del mes" como salida de caja (lente CAJA), pero NUNCA en "En qué se fue" (lente CONSUMO)** — son lentes distintas que responden preguntas distintas, y por eso sus totales difieren a propósito.

Los reintegros **recibidos** (no cancelados) de esa categoría restan, por su **fecha**, sin importar su destino (`reimbursement_target`: "a cuenta" o "en resumen") — para la categorización solo importa que volvió plata a esa categoría.

El neto de una categoría PUEDE quedar **negativo** (un **crédito**): cuando los reintegros recibidos de la categoría en el mes superan su gasto del mes (p. ej. un reintegro cuyo gasto original fue de un mes anterior, o un consumo de tarjeta aún no devengado). El sistema NO SHALL descartar ni capear a cero esos netos negativos: SHALL mostrarlos como **créditos** ("te devolvieron"), separados del peso de gasto y **fuera de la dona** (una dona no puede representar una porción negativa). El total/peso de la dona SHALL derivarse solo de los netos positivos.

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
