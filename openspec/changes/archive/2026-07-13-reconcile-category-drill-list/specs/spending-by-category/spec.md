## MODIFIED Requirements

### Requirement: Tocar una categoría abre sus movimientos

Al tocar una categoría del desglose (donut o ranking), el sistema SHALL abrir, debajo del desglose, la **lista de las líneas que componen el peso de esa categoría** en el mes y la moneda visualizados. Esta lista SHALL usar la **misma lente contable (CONSUMO / devengado)** que el desglose, de modo que **la suma de los montos mostrados en la lista iguale el peso de la categoría en el donut**. La lista drilleada NO SHALL usar la lente CAJA del listado general (`get_movements_page`); el listado general conserva su semántica sin cambios y se restablece al limpiar el filtro de categoría.

La lista drilleada aplica cuando el **único** filtro de contenido activo es la categoría (opcionalmente acotada por subcategoría y por la moneda visualizada). Si el usuario superpone **otro** filtro (cuenta, tipo, rango de monto o búsqueda de texto), ya no está en el drill puro: el listado SHALL volver a la lente CAJA del listado general (`get_movements_page`), que respeta TODOS los filtros combinados. La reconciliación con el donut solo se promete en el estado de drill puro.

Reglas de composición de la lista drilleada (espejo del desglose):

- **Cuotas**: en un mes en que devenga una cuota, la lista SHALL mostrar la **cuota de ese mes** (la transacción hija, con su fecha de vencimiento, su monto de cuota y un indicador `n/total`), NO la compra "madre". La compra madre (`is_parent`, off-ledger) NUNCA SHALL aparecer.
- **Compartidos**: la lista SHALL mostrar **la parte del usuario** (`shared_expense_split.amount_assigned` de su `user_id`), NO el monto total de la operación. Un movimiento compartido **sin parte propia** (100% del otro miembro) NO SHALL aparecer en la lista drilleada (consistente con que el desglose no lo cuenta).
- **Reintegros — dos filas**: la lista SHALL mostrar el gasto **y** el reintegro recibido de esa categoría como **filas separadas**, con el reintegro restando; su suma neta SHALL igualar el peso de la categoría. La lista NO SHALL colapsar el reintegro en una única fila ya neteada.
- **Pago de resumen de tarjeta**: NUNCA SHALL aparecer en la lista drilleada (cancela deuda, no es consumo).

Cada fila de la lista drilleada SHALL apuntar a una **transacción real** (la cuota hija, el gasto o el reintegro), de modo que abrir su detalle muestre esa transacción. Cuando el monto mostrado en la fila difiere del monto crudo de la transacción (compartidos: parte vs total), el detalle SHALL seguir mostrando la verdad cruda (total + parte), explicando la diferencia sin contradecirla.

Cuando el desglose está en modo subcategoría (una categoría activa con sus subcategorías en el donut), la lista drilleada SHALL respetar el mismo filtro: la categoría activa, o la subcategoría si el usuario navega a una. Al seleccionar una subcategoría el donut SHALL permanecer mostrando el desglose por subcategoría de la categoría activa (NO SHALL volver a la vista de todas las categorías): seleccionar una subcategoría solo acota la lista, conservando el contexto "dentro de esta categoría". Tocar la subcategoría ya seleccionada la deselecciona (vuelve a la categoría completa) sin salir del drill.

#### Scenario: La lista drilleada suma el peso del donut

- **WHEN** el usuario toca una categoría cuyo peso en el donut es $100.000 en la moneda visualizada
- **THEN** el sistema muestra debajo la lista de líneas que componen esa categoría
- **AND** la suma de los montos mostrados en la lista es $100.000

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

#### Scenario: Seleccionar una subcategoría no revierte el donut a todas las categorías

- **WHEN** el usuario está en el sub-desglose de una categoría (p. ej. Entretenimiento) y toca una de sus subcategorías (p. ej. Netflix)
- **THEN** el donut sigue mostrando el sub-desglose de esa categoría (no vuelve a la vista de todas las categorías)
- **AND** la lista de abajo se acota a esa subcategoría
- **AND** tocar de nuevo la subcategoría seleccionada la deselecciona y la lista vuelve a la categoría completa

#### Scenario: Superponer otro filtro sale del drill y vuelve a la lente CAJA

- **WHEN** el usuario tiene una categoría activa y además aplica un filtro de cuenta, tipo, monto o una búsqueda de texto
- **THEN** el listado usa la lente CAJA general que respeta todos los filtros combinados (no la lista devengada)
- **AND** el sistema no promete que ese listado sume el peso del donut
