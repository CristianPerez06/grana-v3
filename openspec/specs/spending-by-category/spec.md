# spending-by-category Specification

## Purpose

"En qué se fue": el desglose de los gastos del mes agrupados por categoría, pesado por **neto** (gastos − reintegros recibidos) y **por moneda**. Es la carta de presentación del módulo Movimientos —un donut + ranking, con navegación por mes y drill-down al listado filtrado— y se asoma en el dashboard: en web como la sección "En qué se fue" (dona + leyenda con montos y toggle ARS/USD), en mobile como un teaser de proporciones de las 3 categorías que más pesan. Responde una de las tres preguntas centrales del usuario, complementando "cuánto tengo" y "qué viene".
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

---

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

La presencia del desglose de gastos por categoría en el dashboard difiere por plataforma. El desglose **completo** (donut + ranking + drill) SHALL seguir viviendo en Movimientos en ambas plataformas; el dashboard nunca lo reemplaza.

En **web**, el dashboard SHALL mostrar la sección "En qué se fue": una dona con los gastos del mes por categoría (`topN: 5` + bucket "Otros"), leyenda con **montos** y porcentajes, y toggle ARS/USD. Su contrato detallado vive en la spec de `dashboard` (requirement "La sección 'En qué se fue' muestra el desglose de gastos por categoría con dona y toggle de moneda (web)"). A diferencia del teaser anterior, esta sección SÍ muestra importes y por lo tanto SÍ participa del eye-mask del dashboard; sus filas linkean al desglose completo en Movimientos. El teaser web de 3 categorías deja de existir.

En **mobile**, el dashboard SHALL seguir mostrando el teaser con las **3 categorías que más pesan** del mes, que enlaza al desglose completo en Movimientos. El teaser NO SHALL ser el desglose completo. Por cada categoría: su `icon + label`, una **barra de proporción** y el **porcentaje**. El teaser mobile SHALL mostrar proporciones, NO montos — por lo tanto NO participa del eye-mask. Si no hay gasto del mes (cero slices), el teaser mobile NO SHALL renderizarse.

En ambas plataformas, el peso y el orden de las categorías SHALL derivarse del mismo cálculo neto-por-moneda del desglose completo (vía `buildCategorySlices` sobre `getMonthCategoryBreakdown`), de modo que dashboard y Movimientos muestren los mismos porcentajes ante los mismos datos.

#### Scenario: La sección web muestra montos y linkea al desglose (web)

- **WHEN** el usuario ve "En qué se fue" en el dashboard web
- **THEN** ve la dona y la leyenda con monto y porcentaje por categoría
- **AND** al tocar una fila o el link "Ver desglose" llega al desglose completo en Movimientos
- **AND** el eye-mask del dashboard enmascara los montos (no los porcentajes)

#### Scenario: Mismos porcentajes que el desglose completo

- **WHEN** el dashboard y el desglose de Movimientos se calculan sobre los mismos datos del mes
- **THEN** ambos muestran los mismos porcentajes por categoría (mismo cálculo neto por moneda)

#### Scenario: El teaser se renderiza en el dashboard mobile (mobile)

- **WHEN** un usuario con gastos del mes abre el dashboard en la app nativa
- **THEN** el teaser se renderiza al final del dashboard (después de "Balance del mes")
- **AND** muestra hasta 3 categorías con barra de proporción y porcentaje
- **AND** NO muestra importes en pesos ni dólares (el eye-mask no lo afecta)
- **AND** el link "Ver desglose" del header navega a Movimientos mobile (`/transactions`); el cuerpo del card no es pressable
- **AND** mientras el desglose completo no exista en Movimientos mobile, el destino es la lista de movimientos (decisión transitoria documentada en código)

#### Scenario: Sin gastos del mes el teaser no aparece (mobile)

- **WHEN** el usuario no tuvo gastos en el mes
- **THEN** el teaser mobile no se renderiza (cero slices)
- **AND** el resto del dashboard mobile renderiza normalmente
