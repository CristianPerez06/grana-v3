## RENAMED Requirements

- FROM: `### Requirement: La ruta de detalle de tarjeta nativa (mobile) muestra el overview read-only del ciclo de vida`
- TO: `### Requirement: La ruta de detalle de tarjeta nativa (mobile) muestra el overview del ciclo de vida y expone las acciones de escritura`

## MODIFIED Requirements

### Requirement: La ruta de detalle de tarjeta nativa (mobile) muestra el overview del ciclo de vida y expone las acciones de escritura

La app mobile SHALL exponer una ruta `/cards/[id]` nativa que renderiza el detalle de una tarjeta de crédito consumiendo el read layer y el builder puro de `@grana/cards` — los reads `getCreditCardDetail` / `getCardPeriods` / `getActiveInstallments` (parametrizados por el client nativo) y `resolveCardDetailState({ cardDetail, periods, installments, todayISO })` — sin re-derivar el view-model ni re-implementar los reads en `apps/mobile/lib/`.

La ruta SHALL renderizar las cuatro ramas del discriminated union que devuelve `resolveCardDetailState`: `not-found` (tarjeta inexistente o no `credit`), `new-card` (sin historial → estado informativo, **con** CTA de registro de primer consumo), `archived-empty` (archivada sin pendientes → estado informativo, con acción **reactivar**), y `active` (overview). El overview activo SHALL mostrar: el timeline del ciclo de vida seleccionable (a pagar / en curso / próximo), el monto a pagar y los días a vencimiento, el total en curso, el próximo cierre, el panel de límite, y — dentro de un control segmentado `[Movimientos | Cuotas]` (default **Movimientos**) — los movimientos del período seleccionado y las cuotas en curso.

La ruta SHALL exponer las acciones de escritura de la tarjeta, cada una especificada en su propio requirement nativo: una acción **Editar** en el header (→ `/cards/[id]/edit`), un **CTA de pago** en el componente "a pagar" (→ el pago del resumen a pagar), un acceso a la **lista de períodos** (→ `/cards/[id]/periods`), el **CTA de registro de primer consumo** en la rama `new-card` (deep-link al alta de movimiento con la tarjeta preseleccionada), y **reactivar** en la rama `archived-empty`. El componente "a pagar" deja de ser display-only: es el disparador del flujo de pago.

La ruta SHALL mostrar el pane de movimientos por período (la pestaña `Movimientos` del segmented): la lista de consumos y reintegros recibidos del período, agrupada por fecha, con el chip "Cuota X de Y" en las filas de cuota. Renderiza consumiendo un `MovementList`/`MovementRow` nativos (acotados a los kinds `expense`/`reimbursement`) sobre `FinancialMovement`s mapeados desde `period.transactions` con `cardPeriodTransactionToMovement` de `@grana/cards`. Las filas del pane SHALL ser **navegables** al detalle nativo del movimiento (`/transactions/[txId]`, que ya existe). El detalle de período y el pago viven en las rutas anidadas especificadas por sus propios requirements.

El header chrome (`PageHeader` + back-link) SHALL estar visible desde el primer paint, con placeholder en el título mientras cargan los datos y sin skeleton de pantalla completa. Los componentes de presentación nativos SHALL espejar por nombre y props públicas a los del detalle web, con implementación RN idiomática y sin JSX compartido, consumiendo `CardDetailViewModel` de `@grana/cards`.

#### Scenario: Tocar una tarjeta del wallet abre su detalle nativo

- **WHEN** el usuario toca una tarjeta en el wallet mobile
- **THEN** navega a `/cards/[id]` y la pantalla nativa carga el detalle de esa tarjeta
- **AND** el detalle se deriva invocando `resolveCardDetailState` de `@grana/cards`, sin re-derivar el ciclo `apagar`/`curso`/`prox` a mano

#### Scenario: El detalle activo muestra el overview y las acciones de escritura

- **WHEN** una tarjeta activa con historial se abre en la ruta nativa
- **THEN** la pantalla muestra el timeline del ciclo de vida, el monto a pagar con días a vencimiento, el total en curso, el próximo cierre, el panel de límite y el segmented `[Movimientos | Cuotas]`
- **AND** ofrece la acción Editar en el header, el CTA de pago sobre el componente "a pagar" y el acceso a la lista de períodos

#### Scenario: Tarjeta sin historial ofrece el CTA de registro de primer consumo

- **WHEN** una tarjeta sin consumos (rama `new-card`) se abre en la ruta nativa
- **THEN** la pantalla muestra un estado informativo
- **AND** ofrece el CTA de registro de primer consumo, que abre el alta de movimiento con la tarjeta preseleccionada

#### Scenario: El detalle nativo muestra el pane de movimientos del período en el segmented

- **WHEN** se renderiza el overview activo y el usuario está en la pestaña `Movimientos`
- **THEN** ve los consumos y reintegros recibidos del período seleccionado, agrupados por fecha, con el chip "Cuota X de Y" en las filas de cuota
- **AND** tocar una fila navega al detalle del movimiento (`/transactions/[txId]`)
- **AND** al elegir otra pestaña ve las cuotas en curso, y al seleccionar otro período en el timeline el pane muestra los movimientos de ese período

#### Scenario: Período sin movimientos muestra el empty state del pane

- **WHEN** el período seleccionado no tiene consumos
- **THEN** la pestaña `Movimientos` muestra el empty state ("sin movimientos") en vez de una lista

#### Scenario: Id inexistente o cuenta no-credit resuelve a no encontrado

- **WHEN** la ruta nativa recibe un `id` que no corresponde a una tarjeta de crédito del usuario
- **THEN** `resolveCardDetailState` devuelve `kind: 'not-found'` y la pantalla muestra un estado de no encontrado
- **AND** el header chrome permanece visible

## ADDED Requirements

### Requirement: La app nativa permite editar, archivar, reactivar y eliminar una tarjeta

La app mobile SHALL exponer una pantalla nativa `/cards/[id]/edit` (pushed, con `PageHeader` propio) para editar los campos mutables de una tarjeta, thin consumer de las mutaciones compartidas `updateCreditCard` y `updatePeriodDates` de `@grana/cards` (bindeadas en `apps/mobile/lib/cards/mutations.ts`, mismo patrón que `createCreditCard`). La pantalla SHALL permitir editar **nombre**, **institución** (banco), **`credit_limit`** y las **fechas del ciclo** (cierre/vencimiento del resumen actual y del próximo, cada par visible solo si ese período existe). La **red** SHALL mostrarse como chip read-only con candado (inmutable, igual que web). Guardar SHALL persistir nombre/banco/límite vía `updateCreditCard` y las fechas vía `updatePeriodDates` **primero el período actual y luego el próximo, solo las fechas que cambiaron**, con las mismas validaciones que web (nombre 1–50, límite > 0, vto > cierre, próximo cierre > cierre actual, próximo vto > próximo cierre). El botón Guardar SHALL estar deshabilitado mientras no haya cambios y el back con cambios sin guardar SHALL pedir confirmación de descarte.

La pantalla SHALL ofrecer **archivar** la tarjeta (sujeto al check de deuda server-side; el resultado tipado `pending_debt` SHALL mostrar un diálogo de bloqueo con copy `cards.deactivate_block.*`) y **eliminar** (habilitado solo si la tarjeta nunca tuvo movimientos, deshabilitado con copy explicativo en caso contrario). El archivar y reactivar SHALL delegar en las mutaciones de cuentas compartidas (`archiveAccount` / `reactivateAccount`), ya que una tarjeta es una cuenta; el binding nativo SHALL surfacear el motivo `pending_debt` de forma distinguible. **Reactivar** SHALL ser alcanzable desde el detalle de una tarjeta archivada (rama `archived-empty`).

#### Scenario: Editar nombre y límite de una tarjeta

- **WHEN** el usuario abre `/cards/[id]/edit`, cambia el nombre y el `credit_limit`, y guarda
- **THEN** la pantalla llama `updateCreditCard` con `{ name, credit_limit }` y la tarjeta se actualiza
- **AND** la red no es editable (chip read-only con candado)

#### Scenario: Editar las fechas del ciclo persiste actual-luego-próximo

- **WHEN** el usuario edita el cierre del resumen actual y guarda
- **THEN** la pantalla llama `updatePeriodDates` para el período actual y, si cambió, para el próximo, solo con las fechas modificadas
- **AND** se aplican las validaciones de cronología y los bloqueos de período pagado

#### Scenario: Archivar una tarjeta con deuda es bloqueado

- **WHEN** el usuario intenta archivar una tarjeta con un resumen cerrado sin pagar
- **THEN** el binding surfacea el motivo `pending_debt` y la pantalla muestra el diálogo de bloqueo
- **AND** la tarjeta no se archiva

#### Scenario: Eliminar deshabilitado con movimientos

- **WHEN** la tarjeta tiene o tuvo movimientos
- **THEN** la acción Eliminar está deshabilitada con copy explicativo y Archivar queda como acción recomendada

### Requirement: La app nativa expone los períodos de una tarjeta y el detalle de un resumen

La app mobile SHALL exponer una ruta `/cards/[id]/periods` que lista todos los resúmenes de una tarjeta (thin consumer de `getCardPeriods`), y una ruta `/cards/[id]/periods/[periodId]` con el detalle de un resumen (thin consumer de `getCardPeriodDetail`). Cada fila de la lista SHALL mostrar el rango de fechas, un pill de estado (`futuro` / `actual` / `cerrado_esperando_pago` / `vencido` / `pagado`), la marca "fechas estimadas" cuando `is_estimated=true`, la línea de vencimiento y el monto ARS (con el total USD subordinado cuando exista).

El detalle de un resumen SHALL mostrar el header (rango, vencimiento, y "Editar fechas" cuando el período no está pagado), el resumen de monto (pagado/pendiente, USD, "Pagado el …" cuando corresponde), la lista de movimientos del período agrupada por fecha (reusando `MovementList`/`MovementRow` nativos sobre `cardPeriodTransactionToMovement`, filas navegables), y un **CTA de pago** cuando `!has_payment && (cerrado_esperando_pago | vencido)` (→ la pantalla de pago). "Editar fechas" SHALL abrir un sheet nativo sobre `updatePeriodDates` con validación de cronología, bloqueado cuando el período siguiente ya está pagado.

#### Scenario: La lista de períodos muestra estado y monto por resumen

- **WHEN** el usuario abre `/cards/[id]/periods`
- **THEN** ve una fila por período con rango de fechas, pill de estado, marca de estimado cuando aplica, vencimiento y monto ARS (+ USD subordinado)

#### Scenario: El detalle de un resumen impago ofrece pagar

- **WHEN** el usuario abre un resumen `cerrado_esperando_pago` o `vencido` sin pago
- **THEN** ve los movimientos del período agrupados por fecha y un CTA de pago
- **AND** tocar una fila de movimiento navega a su detalle

#### Scenario: Editar fechas de un período pagado está bloqueado

- **WHEN** el usuario abre "Editar fechas" pero el período siguiente ya está pagado
- **THEN** el sheet impide guardar y muestra el error correspondiente

### Requirement: La app nativa permite pagar un resumen de tarjeta

La app mobile SHALL exponer una pantalla nativa `/cards/[id]/periods/[periodId]/pay` para pagar un resumen, thin consumer de la mutación compartida `payCardPeriod` de `@grana/cards`. La pantalla SHALL ser un único formulario scrolleable de dos secciones y NO SHALL reimplementar ninguna lógica de sellos, FX ni confirmación de período — toda esa lógica vive server-side en `payCardPeriod`; la pantalla solo **arma el payload** y reproduce los defaults y la validación client-side de web. Los reads SHALL ser `getCreditCardDetail`, `getCardPeriodDetail`, `getAccounts` y `suggestNextPeriodDates` (`@grana/money-logic`).

La **Sección 1 (datos del pago)** SHALL exponer, en orden: el campo de **cotización FX** (solo cuando `pendingAmountUSD > 0`; 6 decimales sin agrupado; requerido; recalcula el monto; muestra `USD × TC = $ARS`), el **impuesto de sellos** (chips de sugerencia + "Sin sello" + alerta de alícuota aprendida o hint de primera vez; recalcula el monto), el **monto a pagar** (default `pendingAmountARS + sello` o el total con USD; editable para pago parcial; con caja de desglose cuando hay USD), la **cuenta de débito** (`AccountSelectField`, default = cuenta ARS del mismo banco de la tarjeta o la primera elegible, solo cash/bank, con aviso suave de saldo negativo) y la **fecha de pago** (default hoy). La **Sección 2 (próximo resumen)** SHALL pedir la confirmación de `next_end_date` y `next_due_date` pre-llenadas con las fechas del período en curso (min = cierre del período pagado / próximo cierre), con el copy de contexto que nombra el cierre del período pagado como ancla y la marca "estimada" cuando corresponde.

La validación client-side SHALL espejar web exactamente (monto > 0; FX requerido si hay deuda USD; cuenta/fecha/fechas-próximas requeridas; `next_end_date` posterior al cierre pagado; `next_due_date` posterior a `next_end_date`). El submit SHALL llamar `payCardPeriod` con el `PayCardPeriodInput` completo y, en éxito, invalidar `cards`/`transactions`/`accounts`/`dashboard` y volver al detalle. El footer SHALL mostrar el aviso de irreversibilidad del pago.

#### Scenario: Pagar un resumen ARS-only

- **WHEN** el usuario abre el pago de un resumen sin deuda USD, confirma el monto, la cuenta de débito, la fecha y las fechas del próximo período, y confirma
- **THEN** la pantalla llama `payCardPeriod` con `{ period_id, amount, payment_account_id, payment_date, next_end_date, next_due_date }` (sin `fx_rate_to_ars`)
- **AND** NO se muestra el campo de cotización FX

#### Scenario: Pagar un resumen con deuda USD exige la cotización

- **WHEN** el resumen tiene `pendingAmountUSD > 0`
- **THEN** la pantalla muestra el campo de cotización FX (requerido) y la caja de desglose ARS + USD×TC + sello = total
- **AND** el submit falla con error localizado si la cotización está vacía o no es positiva

#### Scenario: El próximo resumen se pre-llena y se confirma

- **WHEN** el usuario abre el pago y el período en curso tiene fechas persistidas o proyectadas
- **THEN** las fechas de la Sección 2 vienen pre-llenadas y el copy nombra el cierre del período pagado como ancla
- **AND** la validación rechaza un `next_end_date` que no sea posterior a ese cierre

#### Scenario: La pantalla no reimplementa la lógica de sellos ni FX

- **WHEN** se arma el pago
- **THEN** la pantalla solo compone el `PayCardPeriodInput` y delega en `payCardPeriod`
- **AND** la derivación de alícuota de sellos, la persistencia de `fx_rate_to_ars` y la confirmación del período estimado ocurren server-side, no en la pantalla
