## ADDED Requirements

### Requirement: La app nativa muestra los reintegros pendientes accionables en el feed

La pestaña **Movimientos** de la app mobile SHALL renderizar un bloque
**"Reintegros a confirmar"** arriba del listado, hermano nativo del bloque de
pendientes recurrentes, como thin consumer del read compartido
`getPendingReimbursements(supabase)` de `@grana/transactions` (sin scope de
cuenta = global). El bloque SHALL renderizar **nada** cuando no hay reintegros
pendientes (mismo comportamiento que `PendingRecurrencesBlock` y que la card
read-only de la cuenta).

Cada fila del bloque SHALL permitir **confirmar** o **cancelar** el reintegro,
delegando en los mutators nativos `confirmReimbursement` / `cancelReimbursement`
(`apps/mobile/lib/transactions/mutators.ts`), que son thin shells sobre las
impls isomórficas de `@grana/transactions-mutations` (auth + delegación +
localización del `formError`). La invalidación de cache SHALL correr en el
handler de éxito del bloque vía `invalidateAfterReimbursementMutation`, nunca
dentro del mutator.

**Confirmar** SHALL ser una reconciliación de **monto + fecha únicamente**,
paridad con web: la fila SHALL exponer inline (expand in-place, sin sheet) un
`MoneyAmountInput` con default = monto estimado y un `DateField` con default =
fecha del gasto (o hoy). El commit SHALL enviar `{ id, amount, date }` — NO
SHALL ofrecer selector de cuenta ni de período: para el subtipo `account` la
cuenta declarada queda intacta, y para `statement` el período se deriva del
lado del servidor a partir de la fecha (rechazando un período ya pagado).

**Cancelar** SHALL pedir una confirmación destructiva (`Alert.alert`) antes de
setear `cancelled_at`. La fila SHALL mostrar estado de carga por fila, error
inline localizado y un aviso de éxito transitorio.

Los copies SHALL leerse del catálogo compartido `@grana/i18n-messages`
(`transactions.reimbursement.pending.*`, `reimbursement.confirm` / `.cancel`).

#### Scenario: El feed muestra el bloque de reintegros pendientes

- **WHEN** el usuario abre la pestaña Movimientos y tiene al menos un reintegro
  pendiente (`type='reimbursement'`, `received_at IS NULL`, `cancelled_at IS NULL`)
- **THEN** ve el bloque "Reintegros a confirmar" arriba del listado, resuelto vía
  `getPendingReimbursements(supabase)` de `@grana/transactions`
- **AND** cada fila muestra la descripción/categoría derivada y el monto esperado

#### Scenario: Confirmar reconcilia monto y fecha inline

- **WHEN** el usuario toca "Confirmar" en una fila
- **THEN** la fila expande in-place un input de monto (default = estimado) y un
  selector de fecha (default = fecha del gasto o hoy)
- **AND** al commitear, envía `{ id, amount, date }` al mutator, que setea
  `received_at`, sobrescribe `amount` y `date`, y NO altera `estimated_amount`
- **AND** el bloque invalida cache vía `invalidateAfterReimbursementMutation`

#### Scenario: Confirmar un reintegro en resumen deriva el período del lado del servidor

- **WHEN** el usuario confirma un reintegro con subtipo `statement` eligiendo una
  fecha
- **THEN** el mutator resuelve el período de la tarjeta que cubre esa fecha vía
  `getOrCreatePeriodForDate` y lo imputa, sin ofrecer un selector de período
- **AND** si ese período ya fue pagado, la confirmación falla con un error
  localizado y no modifica el reintegro

#### Scenario: Cancelar un reintegro pendiente pide confirmación destructiva

- **WHEN** el usuario toca "Cancelar" en una fila y confirma el diálogo destructivo
- **THEN** el mutator setea `cancelled_at`, el reintegro desaparece del bloque y
  el bloque invalida cache
- **AND** si el reintegro ya estaba recibido, la operación falla con un error
  localizado

#### Scenario: Sin reintegros pendientes el bloque no se renderiza

- **WHEN** el usuario no tiene reintegros pendientes
- **THEN** el bloque "Reintegros a confirmar" no se renderiza (no ocupa espacio ni
  muestra un empty-state en el feed)

## MODIFIED Requirements

### Requirement: La tab Movimientos de mobile muestra el feed global navegable por mes

La pestaña primaria **Movimientos** de la app mobile SHALL renderizar el feed global de movimientos del usuario, navegable por mes, como thin consumer del read compartido `getGlobalMovementsPage` de `@grana/transactions`. Reemplaza el placeholder vacío actual (`apps/mobile/app/(app)/transactions.tsx`).

La pantalla SHALL mostrar, desde el primer frame, el chrome siempre visible: el `PageHeader` nativo (navy) con el título de la sección y un **selector de mes** (el `MonthNavigator` compartido, con controles prev / ‹mes› / next). El mes inicial SHALL ser el mes actual (`monthOf(getTodayAR())`). Cambiar de mes SHALL recargar el feed de ese mes y resetear la paginación.

La lista SHALL reusar los primitivos nativos `MovementList` / `MovementRow` (`apps/mobile/components/movements/`), renderizando las filas del feed agrupadas por fecha. El estado de mes del feed SHALL ser **independiente** del mes del dashboard (navegar uno no mueve el otro).

La paginación SHALL seguir el patrón limit+1 lookahead que el read expone (`{ movements, hasMore, nextLimit }`): mientras `hasMore`, la pantalla SHALL ofrecer una acción "cargar más" que sube el límite hasta `MAX_MOVEMENTS_LIMIT`. Cambiar de mes SHALL resetear el límite a `DEFAULT_MOVEMENTS_LIMIT`.

Cuando el mes seleccionado no tiene movimientos, la pantalla SHALL mostrar un empty-state con dos variantes, distinguidas por `hasAnyTransaction`: **bienvenida** (el usuario no tiene ningún movimiento aún) vs. **mes vacío** (tiene historial en otros meses, este mes está vacío). Los copies SHALL leerse del catálogo compartido `@grana/i18n-messages`.

Las **filas del feed SHALL ser navegables**: tocar una fila SHALL abrir el detalle del movimiento (`/transactions/[txId]`, ver el requirement del detalle nativo), pasando el contexto de origen (`?from=…`) para resolver el back. El `QuickAddFab` está **habilitado** (alta de movimiento, ver su requirement). La **barra de filtros** y el **breakdown por categoría** del feed web siguen explícitamente fuera de este alcance. Los **bloques de pendientes** (recurrencias y reintegros) SÍ se renderizan sobre la lista, cada uno especificado en su propio requirement.

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
- **AND** el feed no renderiza barra de filtros ni breakdown por categoría
