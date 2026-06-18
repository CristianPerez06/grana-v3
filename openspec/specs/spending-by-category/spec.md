# spending-by-category Specification

## Purpose

"En qué se fue": el desglose de los gastos del mes agrupados por categoría, pesado por **neto** (gastos − reintegros recibidos) y **por moneda**. Es la carta de presentación del módulo Movimientos —un donut + ranking, con navegación por mes y drill-down al listado filtrado— y se asoma en el dashboard de ambas plataformas como la sección "En qué se fue" (dona + leyenda con montos y toggle ARS/USD). Responde una de las tres preguntas centrales del usuario, complementando "cuánto tengo" y "qué viene".
## Requirements
### Requirement: El módulo Movimientos abre con un desglose de gastos por categoría del mes

El módulo de movimientos (`/transactions`) SHALL presentar, como carta de presentación arriba del listado, un **desglose de los gastos del mes agrupados por categoría**, que responde "¿en qué se fue?". El listado de movimientos SHALL seguir accesible (el desglose lo antecede, no lo reemplaza). La navegación por mes de la página SHALL estar unificada en un único selector (el del desglose); el bar de filtros del listado no duplica el selector de mes.

#### Scenario: El overview por categoría encabeza Movimientos

- **WHEN** el usuario abre `/transactions`
- **THEN** ve arriba un desglose de los gastos del mes por categoría
- **AND** el listado de movimientos sigue disponible debajo

#### Scenario: Un único selector de mes

- **WHEN** el usuario está en `/transactions`
- **THEN** hay un solo control de mes (en el desglose), que también determina el mes del listado

---

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

### Requirement: El desglose se presenta como donut más ranking

El desglose SHALL mostrarse como un **donut** que representa el peso relativo de cada categoría, acompañado de un **ranking** ordenado de mayor a menor (categoría, monto y porcentaje). Las categorías de menor peso SHALL poder agruparse en una entrada **"Otros"** para mantener el donut legible.

#### Scenario: El donut refleja los pesos y el ranking los ordena

- **WHEN** el usuario tiene gastos en varias categorías
- **THEN** el donut muestra cada categoría proporcional a su peso
- **AND** el ranking las lista de mayor a menor con su monto y porcentaje

#### Scenario: La cola se agrupa en "Otros"

- **WHEN** hay más categorías de las que el donut muestra legiblemente
- **THEN** las de menor peso se agrupan en una entrada "Otros"

---

### Requirement: Tocar una categoría abre sus movimientos

Al tocar una categoría del desglose (donut o ranking), el sistema SHALL abrir el listado de movimientos filtrado por esa categoría.

#### Scenario: Drill-down a la categoría

- **WHEN** el usuario toca "Supermercado" en el desglose
- **THEN** el sistema muestra el listado de movimientos filtrado por la categoría "Supermercado"

---

### Requirement: El desglose navega por mes

El desglose SHALL permitir navegar entre meses, mostrando por defecto el mes actual (según la zona horaria financiera).

#### Scenario: Navegar a un mes anterior

- **WHEN** el usuario navega al mes anterior en el desglose
- **THEN** el donut y el ranking se recalculan con los gastos de ese mes

---

### Requirement: El dashboard muestra un teaser de las categorías que más pesan

El dashboard SHALL mostrar en **ambas plataformas** (web y nativo) la sección "En qué se fue": una dona con los gastos del mes por categoría (`topN: 5` + bucket "Otros"), leyenda con **montos** y porcentajes, y toggle ARS/USD. Su contrato detallado vive en la spec de `dashboard` (requirement "La sección 'En qué se fue' muestra el desglose de gastos por categoría con dona y toggle de moneda"). La sección muestra importes y por lo tanto SÍ participa del eye-mask del dashboard; sus filas y el link "Ver desglose" llevan al desglose completo en Movimientos. El desglose **completo** (donut + ranking + drill) sigue viviendo en Movimientos; el dashboard nunca lo reemplaza.

El teaser de proporciones de 3 categorías (el formato anterior del dashboard) dejó de existir en ambas plataformas (`redesign-dashboard-home` en web, `dashboard-mobile-parity` en nativo).

El peso y el orden de las categorías SHALL derivarse del mismo cálculo neto-por-moneda del desglose completo (vía `buildCategorySlices` sobre `getMonthCategoryBreakdown`), de modo que dashboard y Movimientos muestren los mismos porcentajes ante los mismos datos.

#### Scenario: La sección muestra montos y linkea al desglose

- **WHEN** el usuario ve "En qué se fue" en el dashboard (web o nativo)
- **THEN** ve la dona y la leyenda con monto y porcentaje por categoría
- **AND** al tocar una fila o el link "Ver desglose" llega al desglose completo en Movimientos
- **AND** el eye-mask del dashboard enmascara los montos (no los porcentajes)

#### Scenario: Mismos porcentajes que el desglose completo

- **WHEN** el dashboard y el desglose de Movimientos se calculan sobre los mismos datos del mes
- **THEN** ambos muestran los mismos porcentajes por categoría (mismo cálculo neto por moneda)

#### Scenario: El teaser de proporciones no existe en ninguna plataforma

- **WHEN** se busca `CategoryTeaser` en `apps/web` y `apps/mobile`
- **THEN** el componente no existe en ninguna de las dos apps

### Requirement: El desglose cuenta la parte del miembro en los movimientos compartidos

En un hogar (módulo Compartido), el desglose "En qué se fue" responde "¿en qué se fue **MI** plata?" bajo el modelo de **cuenta corriente**: un movimiento compartido pertenece a cada miembro **por su parte**, no por el total. Por lo tanto, el desglose SHALL contar la **parte de la usuaria** en los movimientos compartidos (gastos y reintegros), no su total:

- Un **gasto compartido** (`is_shared = true`) SHALL contar solo la **parte de la usuaria** = `shared_expense_split.amount_assigned` de la fila cuyo `user_id` es la usuaria. NO SHALL contar el monto total.
- Esto SHALL aplicar **sin importar quién cargó el gasto**: como la RLS del hogar expone los movimientos compartidos de ambos miembros, un gasto compartido cargado por el otro miembro SHALL contar también solo la parte de la usuaria (y NO su total).
- Un movimiento **propio no compartido** (`is_shared = false`) SHALL contar su monto **completo**.
- Si la usuaria **no tiene fila de split** en un gasto compartido (parte 0 / no asignada), ese gasto NO SHALL aparecer en su desglose (es 100% del otro miembro).
- La regla SHALL ser **simétrica para los reintegros compartidos**: un reintegro compartido SHALL netear solo la **parte de la usuaria** (`amount_assigned`), no su total, para no doble-contar contra el gasto ya contado por su parte.

Como la RLS de `shared_expense_split` expone las filas de **ambos** miembros del hogar, la resolución de "la parte de la usuaria" SHALL filtrar explícitamente por su `user_id` (no asumir que el único split visible es el suyo).

El desglose de **ingresos** NO SHALL verse afectado: el ingreso no se comparte (`is_shared` solo aplica a gastos).

#### Scenario: Un gasto compartido cuenta solo mi parte

- **WHEN** hay un gasto compartido de $100.000 al 50% (mi parte $50.000) en categoría Transporte
- **THEN** el desglose cuenta $50.000 en Transporte, no $100.000

#### Scenario: El gasto compartido del otro miembro solo cuenta mi parte

- **WHEN** mi compañero/a cargó una nafta compartida de $101.994 al 50% (mi parte $50.997)
- **THEN** el desglose cuenta $50.997 en su categoría (no $101.994, ni $0)
- **AND** no aparece el total del gasto del otro

#### Scenario: Un compartido sin parte propia no aparece

- **WHEN** hay un gasto compartido en el hogar donde la usuaria tiene 0% (sin fila de split propia)
- **THEN** ese gasto NO aparece en el desglose de la usuaria

#### Scenario: El reintegro compartido netea solo mi parte

- **WHEN** un gasto compartido cuenta por mi parte ($50.000) y recibo un reintegro compartido al 50% de $20.000 (mi parte $10.000)
- **THEN** la categoría netea $10.000 (mi parte del reintegro), quedando en $40.000
- **AND** NO se resta el total del reintegro ($20.000)

#### Scenario: Los gastos propios no se ven afectados

- **WHEN** tengo un gasto propio no compartido de $30.000
- **THEN** el desglose lo cuenta completo ($30.000)

