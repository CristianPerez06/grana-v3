## MODIFIED Requirements

### Requirement: La tab Movimientos de mobile muestra el feed global navegable por mes

La pestaña primaria **Movimientos** de la app mobile SHALL renderizar el feed global de movimientos del usuario, navegable por mes, como thin consumer del read compartido `getGlobalMovementsPage` de `@grana/transactions`. Reemplaza el placeholder vacío actual (`apps/mobile/app/(app)/transactions.tsx`).

La pantalla SHALL mostrar, desde el primer frame, el chrome siempre visible: el `PageHeader` nativo (navy) con el título de la sección y un **selector de mes** (el `MonthNavigator` compartido, con controles prev / ‹mes› / next). El mes inicial SHALL ser el mes actual (`monthOf(getTodayAR())`). Cambiar de mes SHALL recargar el feed de ese mes y resetear la paginación.

La lista SHALL reusar los primitivos nativos `MovementList` / `MovementRow` (`apps/mobile/components/movements/`), renderizando las filas del feed agrupadas por fecha. El estado de mes del feed SHALL ser **independiente** del mes del dashboard (navegar uno no mueve el otro).

La paginación SHALL seguir el patrón limit+1 lookahead que el read expone (`{ movements, hasMore, nextLimit }`): mientras `hasMore`, la pantalla SHALL ofrecer una acción "cargar más" que sube el límite hasta `MAX_MOVEMENTS_LIMIT`. Cambiar de mes SHALL resetear el límite a `DEFAULT_MOVEMENTS_LIMIT`.

Cuando el mes seleccionado no tiene movimientos, la pantalla SHALL mostrar un empty-state con dos variantes, distinguidas por `hasAnyTransaction`: **bienvenida** (el usuario no tiene ningún movimiento aún) vs. **mes vacío** (tiene historial en otros meses, este mes está vacío). Los copies SHALL leerse del catálogo compartido `@grana/i18n-messages`.

Las **filas del feed SHALL ser navegables**: tocar una fila SHALL abrir el detalle del movimiento (`/transactions/[txId]`, ver el requirement del detalle nativo), pasando el contexto de origen (`?from=…`) para resolver el back. El `QuickAddFab` está **habilitado** (alta de movimiento, ver su requirement). La **barra de filtros**, el **breakdown por categoría** y los **bloques de pendientes** (recurrencias / reintegros) del feed web siguen explícitamente fuera de este alcance.

El read SHALL usar el mismo RPC `get_movements_page` y el mismo anon-key/RLS path que web (sin cambios de datos, API ni RLS).

#### Scenario: La tab Movimientos renderiza el feed del mes actual

- **WHEN** el usuario abre la pestaña Movimientos
- **THEN** ve el `PageHeader` + el selector de mes posicionado en el mes actual desde el primer frame
- **AND** ve la lista de movimientos de ese mes agrupada por fecha usando `MovementList`/`MovementRow` nativos
- **AND** el read se resuelve vía `getGlobalMovementsPage(supabase, { filters: { month } })` de `@grana/transactions`

#### Scenario: Navegar entre meses recarga el feed

- **WHEN** el usuario toca prev/next en el selector de mes
- **THEN** el feed se recarga con los movimientos del nuevo mes (`shiftMonth`)
- **AND** el límite de paginación se resetea a `DEFAULT_MOVEMENTS_LIMIT`
- **AND** el mes del dashboard no se ve afectado

#### Scenario: Cargar más pagina dentro del mes

- **WHEN** el mes tiene más movimientos que el límite actual (`hasMore === true`) y el usuario activa "cargar más"
- **THEN** la lista sube el límite a `nextLimit` (tope `MAX_MOVEMENTS_LIMIT`) y muestra las filas adicionales del mismo mes

#### Scenario: Empty-state distingue usuario nuevo de mes vacío

- **WHEN** el mes seleccionado no tiene movimientos
- **THEN** si el usuario no tiene ningún movimiento en ningún mes (`hasAnyTransaction === false`), la pantalla muestra el copy de bienvenida
- **AND** si tiene historial en otros meses, muestra el copy de mes-vacío
- **AND** ambos copies se leen del catálogo compartido `@grana/i18n-messages`

#### Scenario: Tocar una fila del feed abre el detalle

- **WHEN** el usuario toca una fila del feed de Movimientos
- **THEN** navega al detalle `/transactions/[txId]` de ese movimiento, pasando el contexto de origen (`?from=…`) para resolver el back
- **AND** el feed no renderiza barra de filtros, breakdown por categoría ni bloques de pendientes

## ADDED Requirements

### Requirement: La app nativa expone el detalle de movimiento `/transactions/[txId]`

La app nativa SHALL exponer una pantalla de detalle `/transactions/[txId]` para cada movimiento, **read-only** en este alcance (la edición y el borrado son un change posterior). La pantalla SHALL ser thin consumer de los reads del grafo de la transacción extraídos a `@grana/transactions` (`getTransactionDetail`, `getInstallmentFamily`, `getReimbursementsForExpense`) más el mirror thin de `getMovementSharedInfo` en mobile, y SHALL reusar los VMs/tono compartidos (`toFinancialMovement`, `resolveMovementView`, `Tone`) y las keys `transactions.detail.*` de `@grana/i18n-messages` (cero i18n nuevo).

Los reads del grafo de la transacción SHALL vivir en `@grana/transactions` como isomórficos (`GranaSupabaseClient`), reusando `TRANSACTION_SELECT` / `attachLinkedExpenses` ya compartidos; **web SHALL consumirlos desde el package** (una sola implementación, sin cambio de comportamiento — los tests web siguen verdes). El read mobile SHALL usar el mismo anon-key/RLS path que web; el detalle es **legible cross-user** (un movimiento compartido lo ven ambos miembros del hogar) sin gate de edición en este alcance.

La **presentación** SHALL reflejar la anatomía web con primitivos nativos (no el HTML): un **topbar** (`PageHeader` nativo) con back que resuelve el origen (`?from=account:<id>` / `?from=card:<id>` / feed), un **hero tonal** y una **grilla de tiles** en una columna. El chrome (topbar) SHALL estar visible desde el primer paint (el skeleton de carga NO SHALL taparlo).

El **hero** SHALL mostrar: banda tintada por el **tono del tipo** (gasto → terracotta signo `−`; ingreso → emerald-deep signo `+`; transferencia → slate, sin signo), el **ícono de categoría** en un cuadro tintado, el **monto grande** tonal con el símbolo de moneda opaco y los decimales según `showCents`, una **línea de contexto**, y una fila de **chips** (fecha · medio de pago · categoría · subcategoría). Las transferencias SHALL llevar el eyebrow "Transferencia interna".

Los **tiles core por tipo** SHALL incluir: **medio de pago** (nombre + tipo de cuenta, NUNCA número de tarjeta), **progreso de cuotas** (barra pagadas/restantes + próxima/fin) para compras en cuotas, **flujo de transferencia/cambio** (origen → destino) con el callout "no cuenta como gasto ni ingreso", **reintegro-neto** (pagaste + reintegro = costo neto, con el gasto vinculado **tappable** a su detalle), **reparto compartido** ("Te toca pagar" + "Dividido entre", sin badge de liquidación) y **descripción**. El detalle SHALL mostrar un estado sólo cuando informa algo real (*Reintegrado* / *Completada* / *Acreditado*).

Los tiles de **contexto** que requieren reads adicionales — **"Peso en el mes"** (breakdown del mes), **recurrencia** (tile + historial + banner) y **composición de pago de resumen** — quedan **fuera de este alcance**; la pantalla SHALL omitirlos sin romper para esos kinds.

#### Scenario: Tocar una fila abre el detalle read-only

- **WHEN** el usuario toca una fila del feed de un gasto categorizado en una cuenta cash
- **THEN** navega a `/transactions/[txId]` y ve el hero con tono gasto (terracotta), monto con signo `−`, ícono de categoría tintado, título, línea de contexto y los chips fecha · medio · categoría · subcategoría
- **AND** la grilla muestra los tiles "Medio de pago", "Descripción" (si la tiene) y no ofrece acciones de edición/borrado
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
