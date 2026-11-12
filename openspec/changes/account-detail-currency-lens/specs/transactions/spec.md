## REMOVED Requirements

### Requirement: El listado de una cuenta muestra el saldo corriente por fila

**Reason**: Mostraba los saldos de las dos monedas uno abajo del otro en cada fila y las dos patas de un cambio en la misma fila; probado con datos reales, la lista se leía peor. Se reemplaza por "El listado de una cuenta muestra el saldo corriente por fila, de a una moneda", que muestra un libro por vez con un selector ARS | USD.
**Migration**: Ninguna de datos. Las cuentas con pesos y dólares muestran el selector ARS | USD; las de una sola moneda se ven igual que antes.

## ADDED Requirements

### Requirement: El listado de una cuenta muestra el saldo corriente por fila, de a una moneda

En la perspectiva de cuenta, el sistema SHALL mostrar junto a cada fila el saldo corriente (running balance) de la cuenta resultante después de ese movimiento, en una sola moneda. El saldo corriente SHALL derivarse del historial de transacciones; NO SHALL persistirse en ninguna columna.

**Una moneda por vez.** Cuando la cuenta **usa** las dos monedas, el listado SHALL ofrecer un selector **ARS | USD** arriba de la lista, con el mismo aspecto que el selector de moneda de «¿En qué gasté?», y SHALL mostrar solo los movimientos de la moneda elegida, cada uno con el saldo de esa moneda. La moneda inicial SHALL ser ARS (la principal). Una moneda se considera **usada** por la cuenta cuando su saldo inicial es distinto de cero o cuando algún movimiento del historial completo de la cuenta la mueve (incluida la pata recibida de un cambio de moneda); se decide sobre el historial completo, no sobre el mes visible. Una cuenta que usa una sola moneda NO SHALL mostrar el selector, y su listado muestra esa moneda.

**Un movimiento pertenece a una moneda por su parte en esta cuenta.** Un movimiento SHALL aparecer en la moneda en la que mueve a esta cuenta. Un cambio de moneda con la cuenta como origen **y** destino SHALL aparecer en las dos: en la moneda de origen como salida (signo `−`) y en la de destino como entrada (signo `+`). Un cambio entre dos cuentas distintas aparece, en cada cuenta, solo en la moneda de la pata que la afecta.

**El selector es la moneda de los filtros.** El selector y el filtro de moneda de la hoja de filtros SHALL ser el mismo estado: elegir una moneda en uno la elige en el otro. Elegir la moneda NO SHALL ocultar el saldo corriente, porque no saltea filas del libro cuyo saldo se muestra.

El saldo corriente SHALL mostrarse cuando se ven los movimientos de la cuenta en orden, **incluida la navegación por mes**: navegar de mes es navegación temporal, no un filtro de contenido, y el saldo se recalcula sobre el historial previo al mes visible. Los **filtros de contenido** (búsqueda de texto, tipo, categoría, subcategoría, rango de monto) SÍ ocultan el saldo corriente, porque saltean filas y un acumulado parcial sería incorrecto. En la perspectiva global el saldo corriente NO SHALL mostrarse (mezclaría cuentas y monedas).

Esta regla es independiente del modelo de estado de los filtros (URL, React state, etc.) — depende exclusivamente de qué filtros están activos al momento de renderizar la lista. Cuando `/accounts/[id]` está implementado como shell client con TanStack Query, el cómputo del running balance SHALL ejecutarse client-side a partir del historial ascendente completo de la cuenta, aplicando `computeRunningBalances` del paquete `@grana/money-logic`. La regla de qué monedas usa la cuenta y la parte de un movimiento en una moneda SHALL vivir también en `@grana/money-logic`, de modo que web y mobile las deriven sin reimplementarlas.

#### Scenario: Una cuenta de una sola moneda no muestra el selector

- **WHEN** el usuario abre el detalle de una cuenta que usa solo ARS, sin filtros de contenido
- **THEN** no hay selector ARS | USD y cada fila muestra el saldo ARS resultante después de ese movimiento

#### Scenario: Una cuenta con pesos y dólares arranca en ARS

- **WHEN** el usuario abre el detalle de una cuenta con movimientos en ARS y en USD
- **THEN** ve el selector ARS | USD con ARS elegido, solo los movimientos en ARS y el saldo ARS en cada fila

#### Scenario: Elegir USD muestra el libro en dólares

- **WHEN** el usuario elige USD en el selector
- **THEN** la lista muestra solo los movimientos que mueven dólares en esa cuenta, cada uno con el saldo USD resultante
- **AND** el saldo corriente se sigue mostrando

#### Scenario: Un cambio de moneda dentro de la misma cuenta aparece en las dos monedas

- **WHEN** el usuario cambia `$ 3.859.133,55` a `US$ 2.482,00` con origen y destino en la misma cuenta
- **THEN** con ARS elegido la fila del cambio muestra `−$ 3.859.133,55` y el saldo ARS ya descontado
- **AND** con USD elegido la fila del cambio muestra `+US$ 2.482,00` y el saldo USD ya acreditado

#### Scenario: Un cambio entre dos cuentas aparece en una moneda en cada una

- **WHEN** el usuario cambia pesos de la cuenta A a dólares en la cuenta B
- **THEN** en el detalle de A el cambio aparece solo en ARS, como salida, y en el detalle de B solo en USD, como entrada

#### Scenario: El selector y el filtro de moneda son el mismo estado

- **WHEN** el usuario elige USD en la hoja de filtros del detalle de una cuenta con pesos y dólares
- **THEN** el selector muestra USD elegido y la lista muestra el libro en dólares

#### Scenario: Navegar por mes no oculta el saldo corriente

- **WHEN** el usuario navega a otro mes en el detalle de la cuenta (sin filtros de contenido)
- **THEN** el saldo corriente se sigue mostrando, recalculado con el historial previo al mes visible

#### Scenario: Los filtros de contenido ocultan el saldo corriente

- **WHEN** el usuario aplica un filtro de tipo, categoría, subcategoría, búsqueda de texto o rango de monto en el detalle de la cuenta
- **THEN** el saldo corriente por fila se oculta

#### Scenario: El listado global no muestra saldo corriente

- **WHEN** el usuario abre `/transactions`
- **THEN** las filas no muestran saldo corriente

#### Scenario: Cómputo client-side preserva el resultado

- **WHEN** el shell client de `/accounts/[id]` calcula el running balance con `computeRunningBalances` sobre el historial ascendente devuelto por la query
- **THEN** los saldos por fila coinciden numéricamente con los que producía el cálculo server-side previo (mismas reglas: incluye ingresos, gastos, transferencias salientes/entrantes, ajustes; excluye `is_parent=true` y transacciones de tarjeta `expense` con `status='pending'`)
