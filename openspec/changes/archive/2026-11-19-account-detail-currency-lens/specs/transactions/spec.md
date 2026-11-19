## REMOVED Requirements

### Requirement: El estado de filtros y navegación de /accounts/[id] vive en React state, no en URL

**Reason**: Incluía la navegación por mes, que el detalle de cuenta ya no tiene: su lista es corrida y se acota con «Desde / Hasta». Se reemplaza por "El estado de filtros y del rango de fechas de /accounts/[id] vive en React state, no en URL", igual salvo por eso.
**Migration**: Ninguna de datos.

### Requirement: El listado de una cuenta muestra el saldo corriente por fila

**Reason**: Mostraba los saldos de las dos monedas uno abajo del otro en cada fila y las dos patas de un cambio en la misma fila; probado con datos reales, la lista se leía peor. Se reemplaza por "El listado de una cuenta muestra el saldo corriente por fila, de a una moneda", que muestra un libro por vez con un selector ARS | USD.
**Migration**: Ninguna de datos. Las cuentas con pesos y dólares muestran el selector ARS | USD; las de una sola moneda se ven igual que antes.

## MODIFIED Requirements

### Requirement: El usuario puede ver la lista de transacciones de una cuenta

El sistema SHALL mostrar la lista de transacciones de una cuenta ordenada por fecha descendente (más reciente primero), luego por `created_at` descendente. La lista es parte de la pantalla de detalle de la cuenta y es **corrida**: no se navega por mes; muestra todos los movimientos de la cuenta, del más reciente al más viejo, y se acota por fechas con «Desde / Hasta» (ver "El listado de una cuenta muestra el saldo corriente por fila, de a una moneda"). La lista incluye las transacciones donde `account_id = currentAccount` así como las transferencias entrantes donde `transfer_destination_account_id = currentAccount`.

#### Scenario: Lista muestra ingresos, gastos, transferencias y ajustes

- **WHEN** el usuario abre el detalle de una cuenta con transacciones de los cuatro tipos
- **THEN** el sistema muestra todas las transacciones con fecha, descripción, monto y tipo diferenciado visualmente (ingreso, gasto, transferencia con flecha, ajuste con ícono propio)

#### Scenario: Estado vacío

- **WHEN** la cuenta no tiene transacciones
- **THEN** el sistema muestra el mensaje vacío con CTA para agregar la primera transacción

#### Scenario: La lista está paginada

- **WHEN** la cuenta tiene más de 50 transacciones (`DEFAULT_MOVEMENTS_LIMIT`)
- **THEN** el sistema muestra las 50 más recientes con la acción «Cargar más», que suma otras 50 (`MOVEMENTS_LIMIT_STEP`), en web y en mobile

#### Scenario: La lista incluye transferencias entrantes

- **WHEN** la cuenta B es destino de una transferencia desde A
- **THEN** la lista de movimientos de B incluye esa transferencia con signo positivo y la etiqueta "← A"

### Requirement: El usuario tiene un acceso rápido flotante para registrar un movimiento

En **web**, el sistema SHALL ofrecer un **acceso rápido flotante** (FAB) para registrar un movimiento, **visible solo en viewport `<md` (mobile-web, el mismo corte en el que el shell web pasa a la barra de pestañas y el dashboard esconde su botón "Nuevo movimiento")** en el listado global de Movimientos, en el dashboard y en el **detalle de una cuenta**, de modo que el usuario pueda iniciar un alta sin scrollear de vuelta al header. El FAB SHALL **abrir el drawer de creación de movimiento** (mismo provider que el resto de entry points), sin navegación. En mobile-web el FAB **reemplaza** al botón "Nuevo movimiento" del header del dashboard (el botón no se renderiza en ese viewport, ver spec de `dashboard`); el FAB es el único acceso primario para registrar desde esas pantallas. En el detalle de una cuenta el FAB SHALL abrir el drawer con **esa cuenta preseleccionada**, y reemplaza en mobile-web al CTA «+ Agregar» de la fila del título, que en ese viewport no se renderiza; la app nativa SHALL ofrecer el mismo FAB en su detalle de cuenta, que abre el formulario con la cuenta preseleccionada (`presetAccount`). En desktop-web (viewport `≥md`) el FAB NO SHALL renderizarse: el acceso primario lo cumple el botón "Nuevo movimiento" del header del dashboard y los accesos propios de la pantalla `/transactions`.

El FAB web SHALL ser un cuadrado de 64×64 px con esquinas ligeramente redondeadas (`rounded-2xl`, ≈16 px), fondo verde semántico (`bg-success` / `text-success-foreground`, mapeado al token `--success` = emerald), anclado en `bottom-10 right-10` (40 px de cada borde) con `z-index` por encima del contenido scrolleable. El label accesible SHALL leerse del catálogo i18n (`transactions.actions.register_movement`), nunca hardcodeado.

Las pantallas que renderizan el FAB en mobile-web SHALL reservar padding inferior suficiente para que el FAB no tape la última fila de contenido al scrollear hasta el final (`pb-24 md:pb-0` o equivalente).

Mientras el `MovementDrawerProvider` no esté disponible (las queries `accounts/categories/household` aún cargando o falladas), el FAB SHALL renderizarse en estado **disabled** (sin handler de click) usando el estado disabled estándar del componente `@/components/ui/button`, no SHALL navegar a ninguna ruta de fallback, y SHALL pasar a habilitado cuando el provider resuelve. El visual del estado disabled lo define el design system del `Button` (no se especifica una opacity literal a nivel spec).

#### Scenario: FAB visible en Movimientos y dashboard (mobile-web)

- **WHEN** el usuario autenticado abre `/transactions` o `/dashboard` en viewport `<md`
- **THEN** ve un FAB cuadrado verde anclado en la esquina inferior derecha, visible aunque haya scrolleado la pantalla
- **AND** al activarlo se abre el drawer de creación de movimiento sobre la pantalla actual, sin navegación

#### Scenario: FAB no visible en desktop-web

- **WHEN** el usuario abre `/transactions` o `/dashboard` en viewport `≥md`
- **THEN** el FAB NO se renderiza
- **AND** el acceso primario para registrar lo cumple el botón "Nuevo movimiento" del header del dashboard (en `/dashboard`) y los accesos propios de la pantalla en `/transactions`

#### Scenario: El FAB no aparece en otras pantallas web

- **WHEN** el usuario está en una pantalla web que no es Movimientos, el dashboard ni el detalle de una cuenta (cualquier viewport)
- **THEN** el FAB no se muestra (los accesos de esa pantalla son los suyos propios)

#### Scenario: El contenido scrolleable reserva padding inferior para el FAB en mobile-web

- **WHEN** el usuario en viewport `<md` scrollea hasta el final del contenido de `/dashboard` o `/transactions`
- **THEN** la última fila de contenido NO queda tapada por el FAB
- **AND** el padding inferior solo se aplica en mobile-web (en desktop el FAB no existe y el padding NO SHALL inflar la página innecesariamente)

#### Scenario: El FAB está disabled mientras el provider del drawer no está listo

- **WHEN** el usuario abre `/transactions` o `/dashboard` en viewport `<md` durante el primer paint y `useMovementDrawer()` aún devuelve `null` porque las queries `accounts/categories/household` no resolvieron
- **THEN** el FAB se renderiza con el estado disabled estándar del componente `Button` (sin handler activo, visual atenuado por el design system)
- **AND** un tap sobre el FAB NO produce navegación ni abre el drawer
- **AND** cuando las queries resuelven y `useMovementDrawer()` retorna el opener, el FAB pasa a su rendering normal

#### Scenario: El FAB del detalle de cuenta preselecciona la cuenta

- **WHEN** el usuario, en el celular (web o app), toca el «+» flotante en el detalle de la cuenta Santander
- **THEN** se abre el formulario de alta con Santander ya elegida como cuenta
- **AND** en desktop-web el mismo alta se ofrece con el botón «+ Agregar» al final de la fila del título, y el FAB no se renderiza

### Requirement: Las acciones del listado viven en una micro-toolbar de íconos circulares

El sistema SHALL renderizar las acciones de operación del listado (buscar, ver recurrencias, abrir filtros) como una **micro-toolbar de íconos circulares** alineada a la derecha, ubicada arriba del listado y debajo del card del breakdown. Inspirada en el patrón v2 (`MovimientosTopBar`), pero desacoplada del bloque del header. En el **detalle de una cuenta** la misma toolbar SHALL ocupar la fila del título «Movimientos» y NO SHALL incluir el ícono de Recurrencias —lleva al listado general de recurrencias, que no tiene que ver con la cuenta en pantalla—, así que ahí muestra dos íconos: Search y Filtros. La app nativa SHALL usar el mismo botón de ícono (`ToolbarIconButton`) en la tab Movimientos y en el detalle de cuenta.

Cada botón SHALL ser un cuadrado redondeado de 36×36px con border sutil (`border-border`, `bg-card`), texto/ícono `text-text-muted` con hover `text-text`. Sin label visible — solo el ícono Lucide y un `aria-label` para accesibilidad. Los tres botones, en orden de izquierda a derecha:

1. **Search** (ícono `Search`): click activa el modo de búsqueda — el botón se transforma en un **input expansible** que ocupa todo el ancho, con un botón "Cancelar" al lado. El input dispara la búsqueda con debounce de 300ms, idéntico al patrón v2. Pulsar Cancelar (o limpiar el texto) vuelve al estado de tres íconos.
2. **Recurrencias** (ícono `Repeat`): link directo a `/transactions/recurring`.
3. **Filtros** (ícono `SlidersHorizontal`): abre el panel de filtros como **sheet desde la derecha** (overlay + panel ~440px). Cuando hay filtros de contenido activos, SHALL mostrar un badge navy circular con el conteo, posicionado absoluto en la esquina superior derecha del ícono.

#### Scenario: La toolbar muestra tres íconos circulares cuando no hay búsqueda activa

- **WHEN** el usuario abre `/transactions` sin término de búsqueda en la URL
- **THEN** la toolbar muestra tres íconos: Search, Repeat (Recurrencias), SlidersHorizontal (Filtros)
- **AND** cada uno es un cuadrado redondeado de 36px con border sutil y solo ícono

#### Scenario: El ícono Search expande a un input full-width

- **WHEN** el usuario hace click en el ícono Search
- **THEN** la toolbar se transforma: el input de búsqueda toma el ancho completo y un botón "Cancelar" aparece al lado
- **AND** el input recibe el foco automáticamente
- **AND** la búsqueda se aplica con debounce de 300ms a la URL

#### Scenario: Cancelar la búsqueda vuelve al estado de tres íconos

- **WHEN** el usuario presiona "Cancelar" en el modo búsqueda
- **THEN** la toolbar vuelve a mostrar los tres íconos
- **AND** el término de búsqueda se borra de la URL si había alguno

#### Scenario: El ícono Recurrencias linkea a la página de gestión

- **WHEN** el usuario hace click en el ícono Repeat
- **THEN** navega a `/transactions/recurring`

#### Scenario: El ícono Filtros abre el sheet desde la derecha

- **WHEN** el usuario hace click en el ícono SlidersHorizontal
- **THEN** se abre un overlay con un panel sheet pegado al borde derecho de la pantalla
- **AND** el panel contiene selectores para tipo, categoría, cuenta (si aplica), moneda y rango de monto
- **AND** un footer con botones "Limpiar todo" y "Aplicar"

#### Scenario: El badge en el ícono Filtros refleja el conteo de filtros activos

- **WHEN** el usuario tiene filtros de contenido activos (tipo, categoría, cuenta, moneda, monto)
- **THEN** sobre el ícono SlidersHorizontal aparece un badge circular navy con el número de filtros activos
- **AND** el badge desaparece cuando no hay filtros activos

#### Scenario: En el detalle de cuenta la toolbar no ofrece Recurrencias

- **WHEN** el usuario abre el detalle de una cuenta, en web o en la app
- **THEN** la fila del título muestra los íconos Search y Filtros, sin el de Recurrencias

### Requirement: La tab Movimientos de mobile muestra el feed global navegable por mes

La pestaña primaria **Movimientos** de la app mobile SHALL renderizar el feed global de movimientos del usuario, navegable por mes y **acotable por filtros**, como thin consumer del read compartido `getGlobalMovementsPage` de `@grana/transactions`.

La pantalla SHALL mostrar, desde el primer frame, el chrome siempre visible: el `PageHeader` nativo (navy) con el título de la sección y el acceso a recurrencias, y un **selector de mes** (el `MonthNavigator` compartido, con controles prev / ‹mes› / next). El mes inicial SHALL ser el mes actual (`monthOf(getTodayAR())`). Cambiar de mes SHALL recargar el feed de ese mes y resetear la paginación.

La lista SHALL reusar los primitivos nativos `MovementList` / `MovementRow` (`apps/mobile/components/movements/`), renderizando las filas del feed agrupadas por fecha. El estado de mes del feed SHALL ser **independiente** del mes del dashboard (navegar uno no mueve el otro).

**Barra de filtros.** La pantalla SHALL ofrecer, bajo el selector de mes: una **búsqueda de texto libre** (input inline que se despliega desde un botón de ícono), una **hoja de filtros** (`MovementFiltersSheet`) con tipo, cuenta, categoría, subcategoría, moneda y rango de monto, y los **chips de filtro activos removibles**. Los accesos a la búsqueda y a la hoja SHALL ser botones de ícono de 36px alineados a la derecha (`ToolbarIconButton`), los mismos que la web dibuja sobre su listado. El botón que abre la hoja SHALL mostrar el conteo de filtros de contenido activos; ese conteo SHALL **excluir el mes y la búsqueda**, que tienen sus propios controles. El **filtro de cuenta** SHALL ofrecerse sólo cuando hay dos o más cuentas que desambiguar.

**Los filtros SHALL resolverse en la base, no en memoria.** El estado de filtros SHALL proyectarse al contrato `MovementFilters` y viajar a la RPC `get_movements_page`; la pantalla NO SHALL filtrar las filas ya recibidas. La razón es de corrección, no de performance: el feed pagina, de modo que un filtro aplicado sobre la página cargada devolvería las coincidencias **de esa página** en vez de las del mes, y `hasMore` dejaría de describir el conjunto que el usuario está viendo. Esta es la diferencia de diseño con el toolbar del detalle de cuenta, que sí filtra en memoria porque tiene el historial completo de la cuenta cargado (ver la spec de `accounts`); las dos superficies comparten la hoja de filtros, no la forma de aplicarlos.

**El eje de tipo SHALL ser el `kind` derivado** (`MovementTypeFilter` = `FinancialMovement['kind']`), no la columna `transaction_type`. Es lo que el contrato `MovementFilters` ya declara y lo que la RPC ya compara, e incluye las distinciones que el usuario ve dibujadas en los badges de la fila (compra en cuotas, pago de resumen, reintegro).

**Las opciones de la hoja SHALL derivarse del catálogo** (cuentas activas, categorías activas y subcategorías de la categoría seleccionada), vía el read compartido `getMovementFilterOptions` de `@grana/transactions`. NO SHALL derivarse de las filas cargadas: sobre una lista paginada, eso produce un menú de filtros que crece al pedir más filas. Como consecuencia aceptada, el menú PUEDE ofrecer una opción que devuelva cero resultados; el empty-state de sin-resultados es lo que lo explica.

**La búsqueda del feed SHALL matchear el set canónico** definido en el requirement "Los campos buscables de la búsqueda de movimientos son un set único", resuelto por la RPC `get_movements_page`. El resultado SHALL coincidir con el del detalle de cuenta para la misma query: las dos superficies difieren en **dónde** corre el filtro (base vs. memoria), no en **qué** campos matchea.

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
- **THEN** el botón que abre la hoja no muestra conteo
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

- **WHEN** el usuario busca el nombre de una categoría en el feed y ningún movimiento la lleva en su descripción ni como su título derivado
- **THEN** la lista no devuelve esos movimientos, porque la categoría no es un eje explícito del set: entra sólo cuando es el título, que es el caso de ingresos y gastos
- **AND** una transferencia clasificada con esa categoría, cuyo título es la etiqueta fija, no aparece
- **AND** el filtro de categoría de la hoja sí la devuelve

#### Scenario: La búsqueda del feed matchea el mismo set que el detalle de cuenta

- **WHEN** el usuario busca el nombre de una institución en el feed
- **THEN** la lista devuelve los movimientos de las cuentas de esa institución, y devuelve exactamente los mismos que devolvería la misma query en el detalle de esas cuentas
- **AND** buscar el nombre de una subcategoría NO devuelve los movimientos que sólo la llevan como subcategoría, en ninguna de las dos superficies
- **AND** el filtro de subcategoría de la hoja sí los devuelve

#### Scenario: Tocar una fila del feed abre el detalle

- **WHEN** el usuario toca una fila del feed de Movimientos
- **THEN** navega al detalle `/transactions/[txId]` de ese movimiento, pasando el contexto de origen (`?from=…`) para resolver el back
- **AND** el feed no renderiza breakdown por categoría


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

### Requirement: El estado de filtros y del rango de fechas de /accounts/[id] vive en React state, no en URL

`apps/web` SHALL mantener el estado interactivo de `/accounts/[id]` (filtros de tipo, categoría, subcategoría, currency, búsqueda, rango de monto, rango de fechas «Desde / Hasta», paginación) en React state interno de la ruta, no en query strings de la URL.

La URL de `/accounts/[id]` NO SHALL aceptar ni interpretar query parameters relacionados con filtros, navegación o paginación. La URL canónica de la ruta es `/accounts/[id]` sin parámetros.

Recargar la página (F5) SHALL resetear todos los filtros al valor por defecto (lista corrida sin rango de fechas, sin filtros adicionales, sin búsqueda, y la moneda inicial del selector ARS | USD). Este es el comportamiento intencional, coherente con `/transactions`.

El **filtro de cuenta** (`accountId`) NO SHALL exponerse en la barra de filtros — está implícito en la ruta (`accountId === params.id`). El componente `MovementFilters` SHALL renderizarse con `showAccountFilter={false}` y la query subyacente SHALL inyectar el `accountId` desde el shell.

Cualquier acción de "limpiar filtros" o "limpiar búsqueda" SHALL operar sobre este estado, no sobre la URL.

#### Scenario: Elegir un rango de fechas no toca la URL

- **WHEN** el usuario está en `/accounts/[id]` y elige «Desde» y «Hasta» en la hoja de filtros
- **THEN** la lista se acota a ese tramo
- **AND** la URL en la barra del browser sigue siendo `/accounts/[id]` (sin query params)
- **AND** la historia del browser NO recibe una nueva entrada

#### Scenario: F5 limpia todos los filtros

- **WHEN** el usuario está en `/accounts/[id]` con filtros aplicados (ej. categoría X, búsqueda "café")
- **AND** recarga la página (F5)
- **THEN** la pantalla vuelve al estado por defecto: lista corrida, sin filtros ni búsqueda

#### Scenario: La URL canónica no acepta query params

- **WHEN** el usuario entra a `/accounts/[id]?month=2026-03` (ej. desde un bookmark antiguo)
- **THEN** la ruta carga normalmente en el estado por defecto
- **AND** los query params son ignorados

#### Scenario: La barra de filtros no muestra el chip de cuenta

- **WHEN** el usuario abre `/accounts/[id]`
- **THEN** la barra de filtros no incluye el control de selección de cuenta (porque el contexto de la ruta ya implica esa cuenta)
- **AND** el resto de los filtros (tipo, categoría, subcategoría, «Desde / Hasta», búsqueda, rango de monto) están disponibles normalmente; la moneda se elige con el selector ARS | USD cuando la cuenta usa las dos, y solo entonces no aparece en la hoja

#### Scenario: Acción "Limpiar filtros" opera sobre state, no URL

- **WHEN** el usuario tiene filtros activos y clickea "Limpiar filtros"
- **THEN** los filtros vuelven a su default
- **AND** el contenido se reconsulta con los filtros limpios
- **AND** la URL no cambia


### Requirement: El listado de una cuenta muestra el saldo corriente por fila, de a una moneda

En la perspectiva de cuenta, el sistema SHALL mostrar junto a cada fila el saldo corriente (running balance) de la cuenta resultante después de ese movimiento, en una sola moneda. El saldo corriente SHALL derivarse del historial de transacciones; NO SHALL persistirse en ninguna columna.

**Una moneda por vez.** Cuando la cuenta **usa** las dos monedas, el listado SHALL ofrecer un selector **ARS | USD** al lado del título «Movimientos», en la misma fila que los íconos de búsqueda y filtros (y, en desktop, el botón de agregar; en el celular agregar es el «+» flotante), con el mismo aspecto que el selector de moneda de «¿En qué gasté?», y SHALL mostrar solo los movimientos de la moneda elegida, cada uno con el saldo de esa moneda. La moneda inicial SHALL ser ARS (la principal). Una moneda se considera **usada** por la cuenta cuando su saldo inicial es distinto de cero o cuando algún movimiento del historial completo de la cuenta la mueve (incluida la pata recibida de un cambio de moneda); se decide sobre el historial completo, no sobre el mes visible. Una cuenta que usa una sola moneda NO SHALL mostrar el selector, y su listado muestra esa moneda.

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
