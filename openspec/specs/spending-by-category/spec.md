# spending-by-category Specification

## Purpose

"En qué se fue": el desglose de los gastos del mes agrupados por categoría, pesado por **neto** (gastos − reintegros recibidos) y **por moneda**. Es la carta de presentación del módulo Movimientos —un donut + ranking, con navegación por mes y drill-down al listado filtrado— y esa es su **superficie única**: el rediseño del dashboard (`redesign-dashboard-home-v2`) retiró de ahí la dona y su teaser, para no sostener la misma lectura en dos lugares. El dashboard sigue consumiendo `getMonthCategoryBreakdown`, que es la fuente del devengado con que arma "Gastaste", pero no vuelve a presentar el desglose. Responde una de las tres preguntas centrales del usuario, complementando "cuánto tengo" y "qué viene".
## Requirements
### Requirement: El módulo Movimientos abre con un desglose de gastos por categoría del mes

El módulo de movimientos SHALL presentar, en **ambas plataformas** (web `/transactions` y la pantalla nativa Movimientos), como carta de presentación arriba del listado, un **desglose de los gastos del mes agrupados por categoría**, que responde "¿en qué se fue?". El listado de movimientos SHALL seguir accesible (el desglose lo antecede, no lo reemplaza).

La navegación por mes de la pantalla SHALL estar unificada en **un único control**, que determina a la vez el mes del desglose y el del listado. La **ubicación** de ese control es idiomática por plataforma y NO SHALL fijarse en este spec:

- **Web** lo lleva **dentro** del desglose: la ruta no tiene otro control de mes, y el bar de filtros del listado no lo duplica.
- **Nativo** lo lleva **arriba de la pantalla** (`MonthNavigator`), porque ese control ya existe y gobierna además el feed, las recurrencias pendientes y los reintegros pendientes. La card nativa **lee** el mes y NO SHALL renderizar un selector propio.

Lo que SHALL sostenerse en las dos es la invariante: **un solo** control de mes visible por pantalla, y el desglose y el listado siempre sobre el mismo mes.

#### Scenario: El overview por categoría encabeza Movimientos

- **WHEN** el usuario abre `/transactions` en web
- **THEN** ve arriba un desglose de los gastos del mes por categoría
- **AND** el listado de movimientos sigue disponible debajo

#### Scenario: El overview por categoría encabeza Movimientos en nativo

- **WHEN** el usuario abre la pantalla Movimientos en la app nativa
- **THEN** ve la card "En qué se fue" entre el selector de mes y los chips de acción (Buscar / Filtros)
- **AND** el feed de movimientos sigue disponible debajo

#### Scenario: Un único selector de mes

- **WHEN** el usuario está en el módulo Movimientos, en cualquiera de las dos plataformas
- **THEN** hay un solo control de mes visible
- **AND** ese control determina el mes del desglose y el del listado

#### Scenario: La card nativa no duplica el selector de mes

- **WHEN** el usuario abre la pantalla Movimientos en nativo
- **THEN** el único control de mes es el `MonthNavigator` de la pantalla
- **AND** la card "En qué se fue" NO muestra flechas de mes propias
- **AND** navegar de mes con ese control recalcula el donut, el ranking y el feed juntos

---

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

Al tocar una categoría del desglose (donut o ranking), el sistema SHALL abrir, debajo del desglose, la **lista de las líneas que componen el peso de esa categoría** en el mes y la moneda visualizados. Esta lista SHALL usar la **misma lente contable (CONSUMO / devengado)** que el desglose, de modo que **la suma de los montos mostrados en la lista iguale el peso de la categoría en el donut**. La lista drilleada NO SHALL usar la lente CAJA del listado general (`get_movements_page`); el listado general conserva su semántica sin cambios y se restablece al limpiar el filtro de categoría.

Esta regla SHALL regir en **ambas plataformas**: web y nativo comparten la lente (`@grana/money-logic`) y la query de la lista (`getMonthCategoryLines` en `@grana/transactions`), de modo que la reconciliación no puede divergir entre ellas.

La lista drilleada aplica cuando el **único** filtro de contenido activo es la categoría (opcionalmente acotada por subcategoría y por la moneda visualizada). Si el usuario superpone **otro** filtro (cuenta, tipo, rango de monto o búsqueda de texto), ya no está en el drill puro: el listado SHALL volver a la lente CAJA del listado general (`get_movements_page`), que respeta TODOS los filtros combinados. La reconciliación con el donut solo se promete en el estado de drill puro.

Los filtros que pone el drill pertenecen al modo que los puso: una fila de ingresos fija el tipo `income` y su categoría; una fila de egresos fija una categoría (y opcionalmente una subcategoría). Al cambiar de modo (Egresos ↔ Ingresos) el sistema SHALL descartar esos filtros de drill (tipo, categoría y subcategoría) en ambas direcciones, y SHALL conservar los filtros propios del usuario: mes, moneda, búsqueda, cuenta y rango de montos. Dejar el tipo o la categoría del modo anterior hace que la lista muestre filas que la card de arriba ya no explica (el chip "Ingresos" pegado bajo un donut de egresos). Cambiar al modo ya activo no altera nada. La regla rige en web y en nativo.

Reglas de composición de la lista drilleada (espejo del desglose):

- **Cuotas**: en un mes en que devenga una cuota, la lista SHALL mostrar la **cuota de ese mes** (la transacción hija, con su fecha de vencimiento, su monto de cuota y un indicador `n/total`), NO la compra "madre". La compra madre (`is_parent`, off-ledger) NUNCA SHALL aparecer.
- **Compartidos**: la lista SHALL mostrar **la parte del usuario** (`shared_expense_split.amount_assigned` de su `user_id`), NO el monto total de la operación. Un movimiento compartido **sin parte propia** (100% del otro miembro) NO SHALL aparecer en la lista drilleada (consistente con que el desglose no lo cuenta).
- **Reintegros — dos filas**: la lista SHALL mostrar el gasto **y** el reintegro recibido de esa categoría como **filas separadas**, con el reintegro restando; su suma neta SHALL igualar el peso de la categoría. La lista NO SHALL colapsar el reintegro en una única fila ya neteada.
- **Pago de resumen de tarjeta**: NUNCA SHALL aparecer en la lista drilleada (cancela deuda, no es consumo).

Cada fila de la lista drilleada SHALL apuntar a una **transacción real** (la cuota hija, el gasto o el reintegro), de modo que abrir su detalle muestre esa transacción. Cuando el monto mostrado en la fila difiere del monto crudo de la transacción (compartidos: parte vs total), el detalle SHALL seguir mostrando la verdad cruda (total + parte), explicando la diferencia sin contradecirla.

Cuando el desglose está en modo subcategoría (una categoría activa con sus subcategorías en el donut), la lista drilleada SHALL respetar el mismo filtro: la categoría activa, o la subcategoría si el usuario navega a una. Al seleccionar una subcategoría el donut SHALL permanecer mostrando el desglose por subcategoría de la categoría activa (NO SHALL volver a la vista de todas las categorías): seleccionar una subcategoría solo acota la lista, conservando el contexto "dentro de esta categoría". Tocar la subcategoría ya seleccionada la deselecciona (vuelve a la categoría completa) sin salir del drill.

**El drill es el filtro, no un estado aparte.** Tocar una categoría SHALL despachar el filtro de categoría de la pantalla; el desglose deriva su modo (categorías vs subcategorías) de ese filtro. NO SHALL existir un estado de drill interno del componente que pueda quedar desincronizado del listado de abajo.

**La moneda visualizada es el filtro de moneda de la pantalla.** El toggle ARS|USD del desglose SHALL escribir el mismo estado de moneda que filtra el listado, de modo que donut y lista nunca muestren monedas distintas. En nativo eso implica que elegir USD en la card hace visible el chip de filtro "USD" entre los filtros activos, y quitar ese chip devuelve el desglose a ARS.

#### Scenario: La lista drilleada suma el peso del donut

- **WHEN** el usuario toca una categoría cuyo peso en el donut es $100.000 en la moneda visualizada
- **THEN** el sistema muestra debajo la lista de líneas que componen esa categoría
- **AND** la suma de los montos mostrados en la lista es $100.000

#### Scenario: La lista drilleada nativa suma el peso del donut

- **WHEN** el usuario nativo toca una categoría cuyo peso en el donut es $100.000
- **THEN** el feed de abajo cambia a la lista devengada de esa categoría
- **AND** la suma de los montos mostrados es $100.000
- **AND** coincide con lo que web muestra para el mismo mes, categoría y moneda

#### Scenario: Una cuota se muestra por su mes de vencimiento

- **WHEN** el usuario compró una notebook en 6 cuotas y el mes visualizado contiene la cuota 3/6 por $100.000
- **AND** toca la categoría de esa compra
- **THEN** la lista muestra la cuota "3/6" por $100.000 (no la compra madre por su total)
- **AND** la compra madre off-ledger no aparece

#### Scenario: Un gasto compartido muestra la parte del usuario

- **WHEN** el usuario tuvo un súper compartido 50/50 de $10.000 y toca la categoría "Comida"
- **THEN** la fila del súper muestra la parte del usuario ($5.000)
- **AND** ese $5.000 es lo que aporta a la suma de la lista (igual que al donut)

#### Scenario: Un compartido 100% del otro no aparece en el drill

- **WHEN** existe un gasto compartido asignado 100% al otro miembro en la categoría tocada
- **THEN** ese gasto NO aparece en la lista drilleada
- **AND** la suma de la lista sigue igualando el peso del donut (que tampoco lo cuenta)

#### Scenario: Un reintegro se muestra como fila separada que resta

- **WHEN** una categoría tiene un gasto de $10.000 y un reintegro recibido de $3.000 en el mes
- **AND** el usuario toca esa categoría
- **THEN** la lista muestra dos filas: el gasto ($10.000) y el reintegro (−$3.000)
- **AND** la suma neta de la lista es $7.000, igual al peso de la categoría en el donut

#### Scenario: Abrir el detalle de una fila drilleada muestra la transacción real

- **WHEN** el usuario toca la fila de un súper compartido que la lista muestra a $5.000 (su parte)
- **THEN** el detalle del movimiento muestra el total real ($10.000) y su parte ($5.000)

#### Scenario: Limpiar la categoría restablece el listado general

- **WHEN** el usuario limpia el filtro de categoría (breadcrumb, "volver", o click en el donut drilleado)
- **THEN** la lista de abajo vuelve al listado general de movimientos (lente CAJA, sin cambios de semántica)

#### Scenario: Volver al gráfico de todas las categorías no deja filtros activos

- **WHEN** el usuario toca una categoría del desglose de egresos y luego vuelve a todas las categorías
- **THEN** no queda ningún filtro de contenido activo por haber entrado al drill (ni categoría, ni subcategoría, ni un filtro de moneda "pegado" por la visualización)
- **AND** el drill de egresos NO SHALL fijar un filtro de moneda: el gráfico y la lista derivan la moneda de la misma fuente, así que volver atrás deja el estado limpio

#### Scenario: Cambiar de modo no deja filtros del modo anterior

- **WHEN** el usuario toca "Sueldo" en el desglose de ingresos (la lista queda filtrada por tipo ingreso y esa categoría) y luego vuelve a "Egresos"
- **THEN** la lista deja de filtrar por tipo ingreso y por categoría, y muestra el listado general del mes
- **AND** no queda ningún chip de filtro de tipo ni de categoría activo
- **AND** el mes, la moneda visualizada, la búsqueda, la cuenta y el rango de montos que el usuario hubiera fijado se conservan

#### Scenario: Cambiar de modo en la app nativa limpia los mismos filtros (mobile)

- **WHEN** el usuario hace lo mismo en la app nativa
- **THEN** la hoja de filtros y los chips muestran el mismo estado que en web: sin tipo ni categoría, con los filtros propios intactos

#### Scenario: Seleccionar una subcategoría no revierte el donut a todas las categorías

- **WHEN** el usuario está en el sub-desglose de una categoría (p. ej. Entretenimiento) y toca una de sus subcategorías (p. ej. Netflix)
- **THEN** el donut sigue mostrando el sub-desglose de esa categoría (no vuelve a la vista de todas las categorías)
- **AND** la lista de abajo se acota a esa subcategoría
- **AND** tocar de nuevo la subcategoría seleccionada la deselecciona y la lista vuelve a la categoría completa

#### Scenario: Superponer otro filtro sale del drill y vuelve a la lente CAJA

- **WHEN** el usuario tiene una categoría activa y además aplica un filtro de cuenta, tipo, monto o una búsqueda de texto
- **THEN** el listado usa la lente CAJA general que respeta todos los filtros combinados (no la lista devengada)
- **AND** el sistema no promete que ese listado sume el peso del donut

#### Scenario: El toggle de moneda de la card nativa filtra el feed

- **WHEN** el usuario nativo toca "USD" en la card "En qué se fue"
- **THEN** el donut y el feed pasan los dos a USD
- **AND** aparece el chip de filtro "USD" entre los filtros activos de la pantalla
- **AND** quitar ese chip devuelve el donut y el feed a ARS

### Requirement: El desglose navega por mes

El desglose SHALL permitir navegar entre meses, mostrando por defecto el mes actual (según la zona horaria financiera).

#### Scenario: Navegar a un mes anterior

- **WHEN** el usuario navega al mes anterior en el desglose
- **THEN** el donut y el ranking se recalculan con los gastos de ese mes

---

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

