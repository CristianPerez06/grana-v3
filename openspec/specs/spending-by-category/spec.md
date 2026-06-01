# spending-by-category Specification

## Purpose

"En qué se fue": el desglose de los gastos del mes agrupados por categoría, pesado por **neto** (gastos − reintegros recibidos) y **por moneda**. Es la carta de presentación del módulo Movimientos —un donut + ranking, con navegación por mes y drill-down al listado filtrado— y se asoma como un teaser de las categorías que más pesan en el dashboard. Responde una de las tres preguntas centrales del usuario, complementando "cuánto tengo" y "qué viene".
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

### Requirement: El desglose pesa por el neto de cada categoría, por moneda

El peso de cada categoría SHALL ser el **neto por moneda** = suma de gastos de esa categoría − suma de reintegros recibidos de esa categoría (categoría derivada del gasto). El desglose SHALL ser sólo de **gastos** (los ingresos no participan). ARS y USD NO SHALL sumarse entre sí: la vista muestra **una moneda por vez**, con ARS por defecto y un toggle ARS|USD que aparece cuando hay gasto en USD en el mes.

Cuentan los gastos con **fecha contable en el mes** seleccionado: gastos cash/débito, consumos de tarjeta, y la **cuota** de una compra en cuotas que devenga en el mes (la madre off-ledger NO cuenta). Los reintegros **recibidos** de esa categoría restan, por su fecha.

#### Scenario: El neto descuenta los reintegros recibidos

- **WHEN** una categoría tiene $100.000 de gastos en el mes y un reintegro recibido de $20.000
- **THEN** la categoría pesa $80.000 en el desglose

#### Scenario: Los consumos de tarjeta cuentan como gasto del mes

- **WHEN** el usuario tuvo un consumo de tarjeta categorizado este mes
- **THEN** ese consumo cuenta en el desglose de su categoría (aunque no haya tocado el disponible)

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

### Requirement: Tocar una categoría abre sus movimientos

Al tocar una categoría del desglose (donut o ranking), el sistema SHALL abrir el listado de movimientos filtrado por esa categoría.

#### Scenario: Drill-down a la categoría

- **WHEN** el usuario toca "Supermercado" en el desglose
- **THEN** el sistema muestra el listado de movimientos filtrado por la categoría "Supermercado"

### Requirement: El desglose navega por mes

El desglose SHALL permitir navegar entre meses, mostrando por defecto el mes actual (según la zona horaria financiera).

#### Scenario: Navegar a un mes anterior

- **WHEN** el usuario navega al mes anterior en el desglose
- **THEN** el donut y el ranking se recalculan con los gastos de ese mes

### Requirement: El dashboard muestra un teaser de las categorías que más pesan

El dashboard SHALL mostrar un teaser con las **3 categorías que más pesan** del mes, que enlaza al desglose completo en Movimientos. El teaser NO SHALL ser el desglose completo (ese vive en Movimientos).

El teaser SHALL mostrarse en **ambas plataformas** (web y mobile) con el mismo contrato: por cada categoría, su `icon + label`, una **barra de proporción** y el **porcentaje** que representa. El teaser SHALL mostrar proporciones, NO montos — por lo tanto NO participa del eye-mask del dashboard. Si no hay gasto del mes (cero slices), el teaser NO SHALL renderizarse.

El peso y el orden de las categorías del teaser SHALL derivarse del mismo cálculo neto-por-moneda del desglose completo (vía `buildCategorySlices` con `topN: 3` sobre el breakdown del mes), de modo que web y mobile muestren las mismas 3 categorías y los mismos porcentajes ante los mismos datos.

#### Scenario: El teaser linkea al desglose

- **WHEN** el usuario ve el teaser de categorías en el dashboard
- **THEN** ve las 3 categorías que más pesan del mes
- **AND** al tocarlo llega al desglose completo en Movimientos

#### Scenario: El teaser muestra proporciones, no montos

- **WHEN** el usuario ve el teaser de categorías
- **THEN** cada categoría muestra una barra de proporción y su porcentaje
- **AND** NO muestra importes en pesos ni dólares
- **AND** el eye-mask del dashboard no lo afecta (no hay montos que enmascarar)

#### Scenario: El teaser se renderiza en el dashboard mobile (mobile)

- **WHEN** un usuario con gastos del mes abre el dashboard en la app nativa
- **THEN** el teaser se renderiza al final del dashboard (después de "Balance del mes")
- **AND** muestra hasta 3 categorías con barra de proporción y porcentaje
- **AND** el link "Ver desglose" del header navega a Movimientos mobile (`/transactions`); el cuerpo del card no es pressable, en paridad con web
- **AND** mientras el desglose completo no exista en Movimientos mobile, el destino es la lista de movimientos (decisión transitoria documentada en código)

#### Scenario: Sin gastos del mes el teaser no aparece (mobile)

- **WHEN** el usuario no tuvo gastos en el mes
- **THEN** el teaser no se renderiza (cero slices)
- **AND** el resto del dashboard mobile renderiza normalmente

