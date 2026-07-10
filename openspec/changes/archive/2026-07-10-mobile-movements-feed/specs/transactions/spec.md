## ADDED Requirements

### Requirement: La tab Movimientos de mobile muestra el feed global navegable por mes

La pestaña primaria **Movimientos** de la app mobile SHALL renderizar el feed global de movimientos del usuario, navegable por mes, como thin consumer del read compartido `getGlobalMovementsPage` de `@grana/transactions`. Reemplaza el placeholder vacío actual (`apps/mobile/app/(app)/transactions.tsx`).

La pantalla SHALL mostrar, desde el primer frame, el chrome siempre visible: el `PageHeader` nativo (navy) con el título de la sección y un **selector de mes** (el `MonthNavigator` compartido, con controles prev / ‹mes› / next). El mes inicial SHALL ser el mes actual (`monthOf(getTodayAR())`). Cambiar de mes SHALL recargar el feed de ese mes y resetear la paginación.

La lista SHALL reusar los primitivos nativos `MovementList` / `MovementRow` (`apps/mobile/components/movements/`), renderizando las filas del feed agrupadas por fecha. El estado de mes del feed SHALL ser **independiente** del mes del dashboard (navegar uno no mueve el otro).

La paginación SHALL seguir el patrón limit+1 lookahead que el read expone (`{ movements, hasMore, nextLimit }`): mientras `hasMore`, la pantalla SHALL ofrecer una acción "cargar más" que sube el límite hasta `MAX_MOVEMENTS_LIMIT`. Cambiar de mes SHALL resetear el límite a `DEFAULT_MOVEMENTS_LIMIT`.

Cuando el mes seleccionado no tiene movimientos, la pantalla SHALL mostrar un empty-state con dos variantes, distinguidas por `hasAnyTransaction`: **bienvenida** (el usuario no tiene ningún movimiento aún) vs. **mes vacío** (tiene historial en otros meses, este mes está vacío). Los copies SHALL leerse del catálogo compartido `@grana/i18n-messages`.

En este alcance la tab es **read-only**: el `QuickAddFab` SHALL permanecer deshabilitado (el alta de movimiento es un change posterior) y las filas SHALL ser **no navegables** (ignoran `detail_href`; la ruta de detalle de movimiento mobile es un change posterior). La **barra de filtros**, el **breakdown por categoría** y los **bloques de pendientes** (recurrencias / reintegros) del feed web quedan explícitamente fuera de este alcance.

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

#### Scenario: La tab es read-only en este alcance

- **WHEN** el usuario ve el feed de Movimientos
- **THEN** el `QuickAddFab` permanece deshabilitado (sin abrir alta)
- **AND** tocar una fila no navega a ningún detalle (las filas ignoran `detail_href`)
- **AND** no se renderiza barra de filtros, breakdown por categoría ni bloques de pendientes
