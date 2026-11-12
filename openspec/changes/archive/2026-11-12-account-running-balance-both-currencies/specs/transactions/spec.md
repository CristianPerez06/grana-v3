## MODIFIED Requirements

### Requirement: El listado de una cuenta muestra el saldo corriente por fila

En la perspectiva de cuenta, el sistema SHALL mostrar junto a cada fila el saldo corriente (running balance) de la cuenta resultante después de ese movimiento, calculado por moneda. El saldo corriente SHALL derivarse del historial de transacciones; NO SHALL persistirse en ninguna columna.

**Qué monedas muestra el saldo.** El saldo corriente de una fila SHALL mostrar el saldo de **cada moneda que la cuenta usa**, uno debajo del otro: ARS primero (tipografía principal) y USD debajo (subordinado, más chico), nunca sumados ni convertidos. Una moneda se considera **usada** por la cuenta cuando su saldo inicial es distinto de cero o cuando algún movimiento del historial completo de la cuenta la mueve (incluida la pata recibida de un cambio de moneda). La decisión SHALL tomarse sobre el historial **completo** de la cuenta, no sobre el mes visible ni fila por fila, de modo que todas las filas de una misma cuenta muestren la misma cantidad de saldos en cualquier mes. Una cuenta que usa una sola moneda SHALL mostrar un solo saldo, el de esa moneda.

**Cambio de moneda dentro de la misma cuenta.** Cuando un cambio de moneda tiene a la cuenta visible como origen **y** como destino, la fila SHALL mostrar en su monto las dos patas: lo que salió (con signo `−`, en la moneda de origen) y, debajo, lo que entró (con signo `+`, en la moneda de destino). Un cambio entre dos cuentas distintas sigue mostrando, en cada cuenta, solo la pata que la afecta.

El saldo corriente SHALL mostrarse cuando se ven los movimientos de la cuenta en orden, **incluida la navegación por mes**: navegar de mes es navegación temporal, no un filtro de contenido, y el saldo se recalcula sobre el historial previo al mes visible. Los **filtros de contenido** (búsqueda de texto, tipo, categoría, subcategoría, rango de monto) SÍ ocultan el saldo corriente, porque saltean filas y un acumulado parcial sería incorrecto. En la perspectiva global el saldo corriente NO SHALL mostrarse (mezclaría cuentas y monedas).

Esta regla es independiente del modelo de estado de los filtros (URL, React state, etc.) — depende exclusivamente de qué filtros están activos al momento de renderizar la lista. Cuando `/accounts/[id]` está implementado como shell client con TanStack Query, el cómputo del running balance SHALL ejecutarse client-side a partir del historial ascendente completo de la cuenta (obtenido como query separada o como parte de la página de movimientos), aplicando `computeRunningBalances` del paquete `@grana/money-logic`. La regla de qué monedas usa la cuenta y la pata recibida del cambio SHALL vivir también en `@grana/money-logic`, de modo que web y mobile las deriven sin reimplementarlas.

#### Scenario: Cada fila muestra el saldo resultante por moneda

- **WHEN** el usuario abre el detalle de una cuenta que usa una sola moneda, sin filtros de contenido
- **THEN** cada fila muestra el saldo de la cuenta en esa moneda, resultante después de ese movimiento

#### Scenario: Una cuenta con pesos y dólares muestra ambos saldos en cada fila

- **WHEN** el usuario abre el detalle de una cuenta con movimientos en ARS y en USD, sin filtros de contenido
- **THEN** cada fila muestra el saldo en ARS y, debajo, el saldo en USD, ambos resultantes después de ese movimiento
- **AND** una fila de un movimiento en ARS también muestra el saldo USD vigente en ese momento, aunque el movimiento no lo haya cambiado

#### Scenario: La cantidad de saldos no cambia entre meses de la misma cuenta

- **WHEN** una cuenta recibió su primer movimiento en USD en noviembre y el usuario navega a octubre
- **THEN** las filas de octubre también muestran los dos saldos, con el saldo USD de ese momento (por ejemplo `US$ 0,00`)

#### Scenario: Un saldo inicial distinto de cero cuenta como moneda usada

- **WHEN** una cuenta tiene saldo inicial USD distinto de cero y ningún movimiento en USD
- **THEN** las filas muestran ambos saldos

#### Scenario: Un cambio de moneda dentro de la misma cuenta muestra ambas patas

- **WHEN** el usuario cambia `$ 3.859.133,55` a `US$ 2.650,00` con origen y destino en la misma cuenta, y abre su detalle
- **THEN** la fila del cambio muestra `−$ 3.859.133,55` y, debajo, `+US$ 2.650,00`
- **AND** su saldo corriente muestra el saldo ARS ya descontado y el saldo USD ya acreditado

#### Scenario: Un cambio entre dos cuentas muestra una pata en cada una

- **WHEN** el usuario cambia pesos de la cuenta A a dólares en la cuenta B
- **THEN** en el detalle de A la fila muestra solo la salida en ARS, y en el detalle de B solo la entrada en USD

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

## REMOVED Requirements

### Requirement: Los primitivos visuales de ledger (MovementFilters, MovementList, MovementRow) comparten un lenguaje visual único en todas las rutas

**Reason**: Ocultaba el saldo corriente debajo de 760px, así que en el celular no se veía el saldo por fila. Se reemplaza por el requirement "… en todas las rutas y anchos de pantalla", idéntico salvo que el saldo pasa debajo del monto en lugar de ocultarse.
**Migration**: Ninguna de datos. `MovementRow` muestra el saldo debajo del monto por debajo de 760px.

## ADDED Requirements

### Requirement: Los primitivos visuales de ledger (MovementFilters, MovementList, MovementRow) comparten un lenguaje visual único en todas las rutas y anchos de pantalla

Los componentes compartidos `MovementFilters`, `MovementList`, `MovementRow` y `PendingReimbursementsBlock` (`apps/web/lib/transactions/components/`) SHALL renderizarse con el mismo lenguaje visual en las tres rutas que los consumen: `/accounts/[id]`, `/transactions`, `/cards/[id]`. El lenguaje SHALL ser el definido en `docs/design/accounts-detail/components/`:

- **`MovementRow`**: grid de 3 columnas en desktop `minmax(0, 1fr) 126px 126px` (icono + título/categoría / monto / running balance) y 2 columnas debajo de 760px `1fr 112px`. Debajo de 760px el running balance NO se oculta: SHALL mostrarse en la columna del monto, debajo de él, en tipografía chica y atenuada, separado del monto. Border-bottom suave entre filas, última sin border. Tipografía: título 13px font-semibold, meta 12px muted, monto tabular-nums con `text-expense` / `text-income` / `text-pending` / `text-neutral-amount` según corresponda.
- **`MovementList`**: agrupación por día con headers (`Hoy`, `Ayer`, fecha formateada). La running balance per-row SHALL respetar `hasContentFilters` (se oculta cuando hay filtros de contenido activos), comportamiento existente preservado.
- **`MovementFilters`**: barra compacta con navegación de mes (‹ ›), íconos compactos para búsqueda / recurrencia / filtros, y los chips de filtros activos debajo. Border y radius alineados al lenguaje de cards par.
- **`PendingReimbursementsBlock`**: header con título y badge de conteo (`X pendiente`), lista con items expandidos mostrando los campos `Monto real` / `Fecha real` + botones `Confirmar` / `Cancelar` en línea. Superficie de tarjeta blanca cuando se renderiza dentro de `/accounts/[id]`.

Los wrappers que envuelven estos primitivos (la `Tarjeta de movimientos` en `/accounts/[id]`, el `PageHeader` + `MovementListContainer` en `/transactions`, el `PeriodMovementsPane` en `/cards/[id]`) son responsables de su propio chrome (encabezado de sección, CTA primaria, navegación). Los primitivos NO SHALL imponer un wrapper visual; el lenguaje vive en row + lista + filtros, no en el contenedor.

Los comportamientos de los primitivos (filtering, running balance, empty states `none` / `filter` / `search`, drawer wiring, paginación, recurrence indicators) SHALL mantenerse inalterados respecto al estado previo. Esta requirement es exclusivamente sobre el contrato visual.

#### Scenario: `/transactions` y `/cards/[id]` heredan el nuevo lenguaje visual sin cambios de comportamiento

- **WHEN** el usuario navega a `/transactions` o a `/cards/[id]` después del rediseño
- **THEN** las filas de movimiento, la lista, y la barra de filtros se renderizan con el mismo lenguaje visual que en `/accounts/[id]`
- **AND** el filtrado, la paginación y el running balance siguen comportándose como antes

#### Scenario: Debajo de 760px el running balance va debajo del monto

- **WHEN** la viewport es menor a 760px y el listado muestra running balance
- **THEN** cada `MovementRow` renderiza el grid de 2 columnas (1fr + 112px)
- **AND** el running balance se muestra debajo del monto, en la misma columna, con la misma cantidad de saldos que en desktop

#### Scenario: Los wrappers de cada ruta proveen su propio chrome de sección

- **WHEN** `MovementList` se renderiza dentro de la `Tarjeta de movimientos` en `/accounts/[id]`
- **THEN** el encabezado de sección (`Movimientos`) y la CTA (`+ Agregar transacción`) viven en el wrapper de la tarjeta, no dentro del primitivo
- **AND** el primitivo solo renderiza la lista de filas agrupadas por día
