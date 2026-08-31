## MODIFIED Requirements

### Requirement: La tab Movimientos de mobile muestra el feed global navegable por mes

La pestaña primaria **Movimientos** de la app mobile SHALL renderizar el feed global de movimientos del usuario, navegable por mes y **acotable por filtros**, como thin consumer del read compartido `getGlobalMovementsPage` de `@grana/transactions`.

La pantalla SHALL mostrar, desde el primer frame, el chrome siempre visible: el `PageHeader` nativo (navy) con el título de la sección y el acceso a recurrencias, y un **selector de mes** (el `MonthNavigator` compartido, con controles prev / ‹mes› / next). El mes inicial SHALL ser el mes actual (`monthOf(getTodayAR())`). Cambiar de mes SHALL recargar el feed de ese mes y resetear la paginación.

La lista SHALL reusar los primitivos nativos `MovementList` / `MovementRow` (`apps/mobile/components/movements/`), renderizando las filas del feed agrupadas por fecha. El estado de mes del feed SHALL ser **independiente** del mes del dashboard (navegar uno no mueve el otro).

**Barra de filtros.** La pantalla SHALL ofrecer, bajo el selector de mes: una **búsqueda de texto libre** (input inline que se despliega desde un chip de acción), una **hoja de filtros** (`MovementFiltersSheet`) con tipo, cuenta, categoría, subcategoría, moneda y rango de monto, y los **chips de filtro activos removibles**. El chip que abre la hoja SHALL mostrar el conteo de filtros de contenido activos; ese conteo SHALL **excluir el mes y la búsqueda**, que tienen sus propios controles. El **filtro de cuenta** SHALL ofrecerse sólo cuando hay dos o más cuentas que desambiguar.

**Los filtros SHALL resolverse en la base, no en memoria.** El estado de filtros SHALL proyectarse al contrato `MovementFilters` y viajar a la RPC `get_movements_page`; la pantalla NO SHALL filtrar las filas ya recibidas. La razón es de corrección, no de performance: el feed pagina, de modo que un filtro aplicado sobre la página cargada devolvería las coincidencias **de esa página** en vez de las del mes, y `hasMore` dejaría de describir el conjunto que el usuario está viendo. Esta es la diferencia de diseño con el toolbar del detalle de cuenta, que sí filtra en memoria porque tiene el historial completo de la cuenta cargado (ver la spec de `accounts`); las dos superficies comparten la hoja de filtros, no la forma de aplicarlos.

**El eje de tipo SHALL ser el `kind` derivado** (`MovementTypeFilter` = `FinancialMovement['kind']`), no la columna `transaction_type`. Es lo que el contrato `MovementFilters` ya declara y lo que la RPC ya compara, e incluye las distinciones que el usuario ve dibujadas en los badges de la fila (compra en cuotas, pago de resumen, reintegro).

**Las opciones de la hoja SHALL derivarse del catálogo** (cuentas activas, categorías activas y subcategorías de la categoría seleccionada), vía el read compartido `getMovementFilterOptions` de `@grana/transactions`. NO SHALL derivarse de las filas cargadas: sobre una lista paginada, eso produce un menú de filtros que crece al pedir más filas. Como consecuencia aceptada, el menú PUEDE ofrecer una opción que devuelva cero resultados; el empty-state de sin-resultados es lo que lo explica.

**La búsqueda del feed SHALL matchear lo que matchea la RPC** — título, descripción efectiva y nombres de cuenta origen/destino — y por lo tanto **NO** matchea nombres de categoría ni de subcategoría, a diferencia de la búsqueda del detalle de cuenta, que corre en cliente sobre otro modelo. La divergencia es consecuencia directa del filtrado server-side y SHALL quedar documentada como tal; cerrarla es un change sobre la RPC, con impacto en web.

La paginación SHALL seguir el patrón limit+1 lookahead que el read expone (`{ movements, hasMore, nextLimit }`): mientras `hasMore`, la pantalla SHALL ofrecer una acción "cargar más" que sube el límite hasta `MAX_MOVEMENTS_LIMIT`, respetando los filtros activos. **Cualquier** cambio de filtro —mes, búsqueda, tipo, cuenta, categoría, subcategoría, moneda, rango de monto, o limpiar— SHALL resetear el límite a `DEFAULT_MOVEMENTS_LIMIT`, no sólo el cambio de mes. El reset y el cambio de filtro SHALL ocurrir en una sola actualización de estado, para que no se dispare un fetch intermedio con el filtro nuevo y el límite viejo.

Cuando la lista queda vacía, la pantalla SHALL mostrar un empty-state con **tres** variantes:

1. **Sin resultados** — hay filtros de contenido o búsqueda activos. SHALL ofrecer una acción para limpiarlos.
2. **Bienvenida** — no hay filtros activos y el usuario no tiene ningún movimiento (`hasAnyTransaction === false`).
3. **Mes vacío** — no hay filtros activos, el usuario tiene historial en otros meses y este mes está vacío.

El discriminador SHALL resolverse sin I/O adicional: la presencia de filtros activos se evalúa primero, y sólo si no los hay se consulta `hasAnyTransaction`. Los copies SHALL leerse del catálogo compartido `@grana/i18n-messages`, sin agregar keys nuevas.

Las **filas del feed SHALL ser navegables**: tocar una fila SHALL abrir el detalle del movimiento (`/transactions/[txId]`, ver el requirement del detalle nativo), pasando el contexto de origen (`?from=…`) para resolver el back. El `QuickAddFab` está **habilitado** (alta de movimiento, ver su requirement). El **breakdown por categoría** del feed web sigue explícitamente fuera de alcance: es otra superficie, normada por la spec `spending-by-category`. Los **bloques de pendientes** (recurrencias y reintegros) SÍ se renderizan sobre la lista, cada uno especificado en su propio requirement.

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

#### Scenario: Los filtros del feed viajan a la base

- **WHEN** el usuario aplica un filtro de contenido (tipo, cuenta, categoría, subcategoría, moneda o rango de monto) o escribe en la búsqueda
- **THEN** el estado se proyecta a `MovementFilters` y se pasa a `getGlobalMovementsPage`, que lo traduce a la RPC `get_movements_page`
- **AND** la pantalla NO filtra en memoria las filas ya recibidas
- **AND** el `queryKey` de la lista incluye los filtros proyectados, de modo que cada combinación tiene su propia entrada de cache

#### Scenario: Cambiar un filtro resetea la paginación

- **WHEN** el usuario tiene el límite subido por "cargar más" y cambia cualquier filtro
- **THEN** el límite vuelve a `DEFAULT_MOVEMENTS_LIMIT` en la misma actualización de estado que el filtro
- **AND** no se dispara ningún fetch intermedio con el filtro nuevo y el límite anterior

#### Scenario: Cargar más respeta los filtros activos

- **WHEN** hay filtros activos, el resultado tiene más filas que el límite actual (`hasMore === true`) y el usuario activa "cargar más"
- **THEN** la lista sube el límite a `nextLimit` (tope `MAX_MOVEMENTS_LIMIT`) y las filas adicionales cumplen los mismos filtros
- **AND** `hasMore` describe el conjunto filtrado, no el mes completo

#### Scenario: El conteo de "Filtros" excluye mes y búsqueda

- **WHEN** el usuario tiene seleccionado un mes distinto del actual y un texto de búsqueda, sin filtros de contenido
- **THEN** el chip que abre la hoja no muestra conteo
- **AND** al aplicar además un filtro de tipo y uno de moneda, el conteo muestra 2

#### Scenario: El filtro de cuenta aparece sólo con dos o más cuentas

- **WHEN** el usuario tiene una sola cuenta
- **THEN** la hoja de filtros no ofrece el filtro de cuenta
- **AND** con dos o más cuentas activas, sí lo ofrece

#### Scenario: Las opciones de la hoja salen del catálogo

- **WHEN** la pantalla abre la hoja de filtros
- **THEN** las cuentas, categorías y subcategorías ofrecidas provienen de `getMovementFilterOptions` de `@grana/transactions`
- **AND** la lista de opciones no cambia al pedir más filas con "cargar más"

#### Scenario: Empty-state cuando los filtros vacían la lista

- **WHEN** hay filtros de contenido o búsqueda activos y ningún movimiento coincide
- **THEN** la pantalla muestra el copy de sin-resultados con una acción para limpiar los filtros
- **AND** no consulta `hasAnyTransaction`, porque la causa de la lista vacía ya está determinada

#### Scenario: Empty-state distingue usuario nuevo de mes vacío

- **WHEN** el mes seleccionado no tiene movimientos y no hay filtros de contenido ni búsqueda activos
- **THEN** si el usuario no tiene ningún movimiento en ningún mes (`hasAnyTransaction === false`), la pantalla muestra el copy de bienvenida
- **AND** si tiene historial en otros meses, muestra el copy de mes-vacío
- **AND** los tres copies se leen del catálogo compartido `@grana/i18n-messages`

#### Scenario: La búsqueda del feed no matchea nombres de categoría

- **WHEN** el usuario busca el nombre de una categoría en el feed y ningún movimiento la lleva en su descripción
- **THEN** la lista no devuelve esos movimientos, porque el match lo resuelve la RPC sobre título, descripción efectiva y nombres de cuenta
- **AND** el filtro de categoría de la hoja sí los devuelve

#### Scenario: Tocar una fila del feed abre el detalle

- **WHEN** el usuario toca una fila del feed de Movimientos
- **THEN** navega al detalle `/transactions/[txId]` de ese movimiento, pasando el contexto de origen (`?from=…`) para resolver el back
- **AND** el feed no renderiza breakdown por categoría

## ADDED Requirements

### Requirement: Las opciones de filtro de movimientos viven en `@grana/transactions`

El read que resuelve las opciones de la hoja de filtros —cuentas activas con su avatar resuelto, categorías activas, y subcategorías de la categoría seleccionada— SHALL vivir en `@grana/transactions` como isomórfico (`GranaSupabaseClient` como primer parámetro), consumido por **web y mobile**. Es una sola implementación: web SHALL importarlo del package y re-exportarlo desde `apps/web/lib/transactions/queries.ts` para no tocar sus call-sites, con comportamiento idéntico.

El package SHALL resolver por sí mismo el `select` de subcategorías en vez de depender de un helper de `apps/web`. La función homónima de `apps/web/lib/categories/queries.ts` SHALL permanecer donde está, porque tiene consumidores propios ajenos a los filtros.

`@grana/transactions` SHALL declarar `@grana/ui-contracts` como dependencia directa, que es de donde sale la resolución del avatar de cuenta. No introduce ciclo: `@grana/ui-contracts` no depende de ningún package del repo.

#### Scenario: Web y mobile comparten las opciones de filtro

- **WHEN** el feed global (web o mobile) o un detalle de cuenta (web o mobile) puebla su hoja de filtros
- **THEN** las opciones salen de la misma función de `@grana/transactions`, sobre el mismo cliente autenticado y el mismo path de RLS
- **AND** no existe una segunda implementación del read en `apps/web` ni en `apps/mobile`

#### Scenario: La promoción no cambia el comportamiento de web

- **WHEN** las superficies web que ya usaban este read se ejecutan después de la promoción
- **THEN** reciben la misma forma de datos y las mismas opciones que antes
- **AND** sus imports y sus `queryKey` de TanStack quedan sin cambios
