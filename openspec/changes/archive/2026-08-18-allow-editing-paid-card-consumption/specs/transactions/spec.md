## MODIFIED Requirements

### Requirement: El usuario puede editar una transacción

El sistema SHALL permitir editar los campos mutables de una transacción según su tipo:

- **Ingresos y gastos en cash/bank**: monto, fecha, descripción, categoría y subcategoría. Los campos `type`, `account_id` y `currency_code` son inmutables.
- **Transferencias**: ver requirement específico.
- **Ajustes**: ver requirement específico.
- **Consumos en tarjeta (1 cuota, `status='pending'`)**: monto, fecha, descripción, categoría, subcategoría. NO editable: cuenta, moneda, cuotas. Si `status='paid'`, sólo editables descripción y categoría — el consumo **sigue siendo editable, no se congela**: el detalle SHALL ofrecer la acción Editar y el formulario SHALL mostrar monto y fecha como contexto read-only. Recategorizar un gasto ya pagado es una corrección corriente. **Borrarlo** sí SHALL quedar bloqueado: deshacer un resumen liquidado se hace desde el período, y `period_payments` lo impide con una FK `RESTRICT`.
- **Compras en cuotas (madre)**: ver requirement específico "Editar una compra en cuotas".

Los campos `type`, `account_id`, `currency_code`, `is_parent` y `parent_id` SHALL ser siempre inmutables post-creación.

#### Scenario: Edición de monto actualiza el saldo

- **WHEN** el usuario cambia el monto de un gasto cash/bank de $100 a $150
- **THEN** el saldo de la cuenta disminuye $50 adicionales respecto al saldo previo

#### Scenario: Cambio de tipo es rechazado

- **WHEN** el usuario intenta cambiar un ingreso a gasto mediante la acción de edición
- **THEN** el sistema rechaza el input; el tipo es inmutable

#### Scenario: Cambio de cuenta es rechazado

- **WHEN** el usuario intenta mover la transacción a otra cuenta mediante la acción de edición
- **THEN** el sistema rechaza el input; la cuenta es inmutable

#### Scenario: Edición de consumo en tarjeta pending

- **WHEN** el usuario edita el monto de un consumo de tarjeta con `status='pending'`
- **THEN** la action acepta el cambio
- **AND** se recalcula el período asignado si la fecha cambió (con potencial reubicación al período correspondiente)

#### Scenario: Edición de consumo en tarjeta paid solo permite descripción y categoría

- **WHEN** el usuario intenta editar el monto de un consumo con `status='paid'`
- **THEN** el sistema rechaza el cambio de monto (campo inmutable post-pago)
- **AND** acepta cambios de descripción o categoría

#### Scenario: Un consumo pagado se puede recategorizar

- **WHEN** el dueño abre el detalle de un consumo de tarjeta cuyo resumen ya se pagó (`status='paid'`)
- **THEN** el detalle ofrece la acción Editar
- **AND** NO ofrece la acción Borrar
- **AND** el formulario de edición muestra monto y fecha como contexto read-only, y permite cambiar categoría, subcategoría y descripción

### Requirement: La app nativa expone el detalle de movimiento `/transactions/[txId]`

La app nativa SHALL exponer una pantalla de detalle `/transactions/[txId]` para cada movimiento. La pantalla SHALL ser thin consumer de los reads del grafo de la transacción extraídos a `@grana/transactions` (`getTransactionDetail`, `getInstallmentFamily`, `getReimbursementsForExpense`) más el mirror thin de `getMovementSharedInfo` en mobile, y SHALL reusar los VMs/tono compartidos (`toFinancialMovement`, `resolveMovementView`, `Tone`) y las keys `transactions.detail.*` de `@grana/i18n-messages` (cero i18n nuevo).

Los reads del grafo de la transacción SHALL vivir en `@grana/transactions` como isomórficos (`GranaSupabaseClient`), reusando `TRANSACTION_SELECT` / `attachLinkedExpenses` ya compartidos; **web SHALL consumirlos desde el package** (una sola implementación, sin cambio de comportamiento — los tests web siguen verdes). El read mobile SHALL usar el mismo anon-key/RLS path que web; el detalle es **legible cross-user** (un movimiento compartido lo ven ambos miembros del hogar).

La **presentación** SHALL reflejar la anatomía web con primitivos nativos (no el HTML): un **topbar** (`PageHeader` nativo) con back que resuelve el origen (`?from=account:<id>` / `?from=card:<id>` / feed), un **hero tonal** y una **grilla de tiles** en una columna. El chrome (topbar) SHALL estar visible desde el primer paint (el skeleton de carga NO SHALL taparlo).

El **hero** SHALL mostrar: banda tintada por el **tono del tipo** (gasto → terracotta signo `−`; ingreso → emerald-deep signo `+`; transferencia → slate, sin signo), el **ícono de categoría** en un cuadro tintado, el **monto grande** tonal con el símbolo de moneda opaco y los decimales según `showCents`, una **línea de contexto**, y una fila de **chips** (fecha · medio de pago · categoría · subcategoría). Las transferencias SHALL llevar el eyebrow "Transferencia interna".

Los **tiles core por tipo** SHALL incluir: **medio de pago** (nombre + tipo de cuenta, NUNCA número de tarjeta), **progreso de cuotas** (barra pagadas/restantes + próxima/fin) para compras en cuotas, **flujo de transferencia/cambio** (origen → destino) con el callout "no cuenta como gasto ni ingreso", **reintegro-neto** (pagaste + reintegro = costo neto, con el gasto vinculado **tappable** a su detalle), **reparto compartido** ("Te toca pagar" + "Dividido entre", sin badge de liquidación) y **descripción**. El detalle SHALL mostrar un estado sólo cuando informa algo real (*Reintegrado* / *Completada* / *Acreditado*).

El detalle SHALL exponer las afordancias de **editar** y **borrar** el movimiento, gateadas por permiso: SHALL calcular `canManage` (= el usuario actual es el dueño/pagador), `canEdit` (`canManage` && cuenta resoluble && no es cuota hija — un consumo con `status='paid'` **SÍ** es editable: conserva categoría y descripción, ver el requirement "El usuario puede editar una transacción") y `canDelete` (`canManage` && cuenta resoluble && sin `parent_id` && `status !== 'paid'`), con las mismas reglas que el detalle web. Un movimiento compartido pagado por el **otro** miembro SHALL ser legible pero NO editable ni borrable (las acciones se ocultan). La acción **Editar** SHALL navegar a `/transactions/[txId]/edit`; la acción **Borrar** SHALL confirmar de forma destructiva antes de ejecutar (ver el requirement de edición/borrado).

Los tiles de **contexto** que requieren reads adicionales — **"Peso en el mes"** (breakdown del mes), **recurrencia** (tile + historial + banner) y **composición de pago de resumen** — quedan **fuera de este alcance**; la pantalla SHALL omitirlos sin romper para esos kinds.

#### Scenario: Tocar una fila abre el detalle

- **WHEN** el usuario toca una fila del feed de un gasto categorizado en una cuenta cash
- **THEN** navega a `/transactions/[txId]` y ve el hero con tono gasto (terracotta), monto con signo `−`, ícono de categoría tintado, título, línea de contexto y los chips fecha · medio · categoría · subcategoría
- **AND** la grilla muestra los tiles "Medio de pago" y "Descripción" (si la tiene)
- **AND** el back resuelve al destino que indica `?from=` o, por defecto, al feed

#### Scenario: El detalle de una compra en cuotas muestra el progreso

- **WHEN** el usuario abre el detalle de una compra en cuotas (madre o hija)
- **THEN** ve el tile de progreso de cuotas (barra pagadas/restantes + próxima/fin) y el detalle por cuota
- **AND** los datos salen de `getInstallmentFamily` (extraído a `@grana/transactions`)

#### Scenario: El detalle de un gasto con reintegro muestra el neto y el gasto vinculado

- **WHEN** el usuario abre el detalle de un gasto con un reintegro vinculado
- **THEN** ve el tile reintegro-neto (pagaste + reintegro = costo neto) y el movimiento vinculado
- **AND** tocar el gasto/reintegro vinculado navega a su propio detalle

#### Scenario: El detalle de un gasto compartido muestra el reparto

- **WHEN** el usuario abre el detalle de un gasto compartido de un hogar de dos miembros
- **THEN** ve el tile de reparto ("Te toca pagar" + "Dividido entre" con la parte de cada uno)
- **AND** el detalle es legible aunque el movimiento lo haya pagado el otro miembro

#### Scenario: Los tiles de contexto diferidos no rompen la pantalla

- **WHEN** el usuario abre el detalle de un movimiento generado por una recurrencia (o de un pago de resumen)
- **THEN** la pantalla renderiza el hero y los tiles core sin el tile de recurrencia / composición / peso-en-el-mes
- **AND** no muestra un estado de error por los tiles diferidos

#### Scenario: El topbar del detalle está visible desde el primer paint

- **WHEN** la pantalla `/transactions/[txId]` hace cold-load y aún resuelve el read del detalle
- **THEN** el `PageHeader` (back + título) ya está presente
- **AND** la carga no se cubre con un skeleton que tape el topbar

#### Scenario: El detalle ofrece editar y borrar sólo al dueño

- **WHEN** el usuario abre el detalle de un movimiento propio, cash/bank y no pagado
- **THEN** ve las acciones **Editar** y **Borrar** en el topbar
- **AND** un movimiento compartido pagado por el otro miembro (o un consumo pagado, o una cuota hija) NO ofrece esas acciones
