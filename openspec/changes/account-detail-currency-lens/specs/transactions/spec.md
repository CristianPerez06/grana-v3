## REMOVED Requirements

### Requirement: El listado de una cuenta muestra el saldo corriente por fila

**Reason**: Mostraba los saldos de las dos monedas uno abajo del otro en cada fila y las dos patas de un cambio en la misma fila; probado con datos reales, la lista se leía peor. Se reemplaza por "El listado de una cuenta muestra el saldo corriente por fila, de a una moneda", que muestra un libro por vez con un selector ARS | USD.
**Migration**: Ninguna de datos. Las cuentas con pesos y dólares muestran el selector ARS | USD; las de una sola moneda se ven igual que antes.

## MODIFIED Requirements

### Requirement: Los primitivos visuales de ledger (MovementFilters, MovementList, MovementRow) comparten un lenguaje visual único en todas las rutas y anchos de pantalla

Los componentes compartidos `MovementFilters`, `MovementList`, `MovementRow` y `PendingReimbursementsBlock` (`apps/web/lib/transactions/components/`) SHALL renderizarse con el mismo lenguaje visual en las tres rutas que los consumen: `/accounts/[id]`, `/transactions`, `/cards/[id]`. El lenguaje SHALL ser el definido en `docs/design/accounts-detail/components/`:

- **`MovementRow`**: grid de 3 columnas en desktop `minmax(0, 1fr) 126px 126px` (icono + título/categoría / monto / running balance) y 2 columnas debajo de 760px `1fr 112px`. Debajo de 760px el running balance NO se oculta: SHALL mostrarse en la columna del monto, debajo de él, en tipografía chica y atenuada, separado del monto. Border-bottom suave entre filas, última sin border. Tipografía: título 13px font-semibold, meta 12px muted, monto tabular-nums con `text-expense` / `text-income` / `text-pending` / `text-neutral-amount` según corresponda. Un monto en dólares lleva su símbolo `US$` delante del número y NO SHALL repetir una etiqueta "USD" debajo; vale para todas las filas de movimiento, en web y en la app nativa.
- **`MovementList`**: agrupación por día con headers (`Hoy`, `Ayer`, fecha formateada). La running balance per-row SHALL respetar `hasContentFilters` (se oculta cuando hay filtros de contenido activos), comportamiento existente preservado.
- **`MovementFilters`**: barra compacta con navegación de mes (‹ ›) donde la ruta navega por mes —el mes se lee «Noviembre 2026», y «Nov 2026» en viewport de celular—, íconos compactos para búsqueda / recurrencia / filtros, y los chips de filtros activos debajo. Un host PUEDE ocupar el lado izquierdo de la barra con su propio contenido (el detalle de cuenta pone ahí su título y su selector ARS | USD) agregar una acción después de los íconos y ocultar el acceso a recurrencias (el detalle de cuenta lo oculta: lleva al listado general, ajeno a la cuenta). Los encabezados de día de `MovementList` SHALL leerse «Hoy», «Ayer» o «Viernes, 13 de noviembre» —mayúscula solo al principio—. Border y radius alineados al lenguaje de cards par.
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

#### Scenario: Un monto en dólares no repite la etiqueta USD

- **WHEN** una fila de movimiento muestra un monto en dólares, en cualquier ruta o en la app nativa
- **THEN** el monto se lee `US$ 2.482,60` y no hay una línea "USD" debajo

## ADDED Requirements

### Requirement: El listado de una cuenta muestra el saldo corriente por fila, de a una moneda

En la perspectiva de cuenta, el sistema SHALL mostrar junto a cada fila el saldo corriente (running balance) de la cuenta resultante después de ese movimiento, en una sola moneda. El saldo corriente SHALL derivarse del historial de transacciones; NO SHALL persistirse en ninguna columna.

**Una moneda por vez.** Cuando la cuenta **usa** las dos monedas, el listado SHALL ofrecer un selector **ARS | USD** al lado del título «Movimientos», en la misma fila que los íconos de búsqueda y filtros y, en la web, el botón de agregar (en viewport de celular, reducido a su ícono «+»); en un teléfono angosto el selector baja debajo del título, con el mismo aspecto que el selector de moneda de «¿En qué gasté?», y SHALL mostrar solo los movimientos de la moneda elegida, cada uno con el saldo de esa moneda. La moneda inicial SHALL ser ARS (la principal). Una moneda se considera **usada** por la cuenta cuando su saldo inicial es distinto de cero o cuando algún movimiento del historial completo de la cuenta la mueve (incluida la pata recibida de un cambio de moneda); se decide sobre el historial completo, no sobre el mes visible. Una cuenta que usa una sola moneda NO SHALL mostrar el selector, y su listado muestra esa moneda.

**Un movimiento pertenece a una moneda por su parte en esta cuenta.** Un movimiento SHALL aparecer en la moneda en la que mueve a esta cuenta. Un cambio de moneda con la cuenta como origen **y** destino SHALL aparecer en las dos: en la moneda de origen como salida (signo `−`) y en la de destino como entrada (signo `+`). Un cambio entre dos cuentas distintas aparece, en cada cuenta, solo en la moneda de la pata que la afecta.

**La moneda no es un filtro.** Con el selector visible, la hoja de filtros NO SHALL ofrecer el filtro de moneda, la moneda elegida NO SHALL aparecer como chip de filtro activo ni contar en el número del botón de filtros, y «Limpiar todo» NO SHALL cambiarla. Elegir la moneda NO SHALL ocultar el saldo corriente, porque no saltea filas del libro cuyo saldo se muestra. Una cuenta de una sola moneda, sin selector, conserva el filtro de moneda en la hoja como antes.

**Lista corrida.** El listado de una cuenta NO SHALL tener navegador de mes: muestra todos los movimientos de la cuenta, del más reciente al más viejo, paginados con «Cargar más», como el resumen de un banco. Para ver un tramo puntual, la hoja de filtros SHALL ofrecer «Desde / Hasta»; el tramo elegido se muestra como chip removible y cuenta en el número del botón de filtros. El saldo corriente SHALL mostrarse también con un tramo elegido: las fechas son navegación temporal, no un filtro de contenido, y el saldo de cada fila es el de la cuenta después de ese movimiento, calculado sobre todo el historial. Los **filtros de contenido** (búsqueda de texto, tipo, categoría, subcategoría, rango de monto) SÍ ocultan el saldo corriente, porque saltean filas y un acumulado parcial sería incorrecto. En la perspectiva global el saldo corriente NO SHALL mostrarse (mezclaría cuentas y monedas).

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

#### Scenario: La moneda elegida no se muestra como filtro

- **WHEN** el usuario elige USD en el selector del detalle de una cuenta con pesos y dólares
- **THEN** no aparece un chip "USD" de filtro activo, el botón de filtros no cuenta la moneda y la hoja de filtros no ofrece moneda
- **AND** «Limpiar todo» quita los demás filtros y deja la lista en USD

#### Scenario: La lista es corrida y un tramo de fechas no oculta el saldo

- **WHEN** el usuario abre el detalle de una cuenta con movimientos en octubre y noviembre
- **THEN** ve los de noviembre y, a continuación, los de octubre, sin navegador de mes
- **AND** si elige «Desde 01/10/26 – Hasta 31/10/26» ve solo los de octubre, cada uno con su saldo corriente

#### Scenario: Los filtros de contenido ocultan el saldo corriente

- **WHEN** el usuario aplica un filtro de tipo, categoría, subcategoría, búsqueda de texto o rango de monto en el detalle de la cuenta
- **THEN** el saldo corriente por fila se oculta

#### Scenario: El listado global no muestra saldo corriente

- **WHEN** el usuario abre `/transactions`
- **THEN** las filas no muestran saldo corriente

#### Scenario: Cómputo client-side preserva el resultado

- **WHEN** el shell client de `/accounts/[id]` calcula el running balance con `computeRunningBalances` sobre el historial ascendente devuelto por la query
- **THEN** los saldos por fila coinciden numéricamente con los que producía el cálculo server-side previo (mismas reglas: incluye ingresos, gastos, transferencias salientes/entrantes, ajustes; excluye `is_parent=true` y transacciones de tarjeta `expense` con `status='pending'`)
