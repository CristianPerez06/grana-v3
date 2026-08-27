## ADDED Requirements

### Requirement: Los campos buscables de la búsqueda de movimientos son un set único

Grana ofrece búsqueda de texto libre sobre movimientos en tres superficies: el feed global de `/transactions` (web), el detalle de cuenta `/accounts/[id]` (web) y sus dos equivalentes nativos —la tab Movimientos y el detalle de cuenta de mobile—. Las tres SHALL matchear **el mismo set de campos**, de modo que la misma query devuelva el mismo conjunto de movimientos en cualquiera de ellas.

El set canónico SHALL ser, y SHALL estar limitado a:

1. El **título derivado** del movimiento (el nombre de la categoría en ingresos y gastos; la etiqueta fija en transferencia, cambio, pago de resumen y ajuste).
2. La **descripción efectiva** — la del propio movimiento, salvo en el reintegro, que hereda la del gasto vinculado.
3. El **nombre de la cuenta origen**.
4. El **nombre de la institución de la cuenta origen**.
5. El **nombre de la cuenta destino**, en los movimientos que tienen dos extremos: `transfer` **y** `exchange`.
6. El **nombre de la institución de la cuenta destino**, en esas mismas dos kinds.

La institución entra al set porque es el texto **principal** de la cuenta en la fila: el listado renderiza `institución || nombre de cuenta`, así que el usuario lee "Galicia" y no el nombre que le puso a la cuenta. Un campo visible y prominente que no es alcanzable por ningún filtro dedicado tiene que ser alcanzable por la búsqueda.

Quedan **fuera** del set, deliberadamente:

- **Nombre de categoría y de subcategoría como eje explícito.** Ambos tienen filtro dedicado y preciso (`categoryId` / `subcategoryId`), que es el camino correcto para ese eje. Además la categoría ya entra por el título en ingresos y gastos —donde el título derivado **es** el nombre de la categoría—, que es el caso que motivaba pedirla: un gasto sin descripción se encuentra por su categoría, porque la categoría es su título. Sumarla como eje separado sólo cambiaría el resultado en transferencia, cambio, pago de resumen y ajuste, donde el título es una etiqueta fija.
- **Monto y fecha.** Tienen filtros dedicados (`amountMin` / `amountMax`, mes o rango). Matchearlos como texto obligaría a normalizar formatos de número y no agregaría nada sobre el filtro existente.
- **`canonical_name` de las categorías del sistema.** Es un slug interno de traducción, no texto que el usuario vea.

La búsqueda SHALL tratar el término como **texto literal**: los caracteres `%` y `_` tipeados por el usuario SHALL matchear como sí mismos y NO como comodines del patrón SQL. La comparación SHALL ser insensible a mayúsculas.

**Dónde vive el set.** El match SHALL tener exactamente dos implementaciones, y ninguna más: la cláusula de texto de la RPC `get_movements_page` (que sirve a las dos superficies de feed, porque paginan y el filtro tiene que resolverse en la base) y la función pura `movementMatchesText` de `@grana/transactions` (que sirve a los dos detalles de cuenta, que tienen el historial completo cargado en memoria). `movementMatchesText` SHALL ser la declaración canónica del set en código, y la RPC SHALL referenciarla por comentario. NO SHALL existir una tercera implementación por plataforma: un matcher nativo separado sería el patrón "mirror … keep in sync" que las convenciones del repo prohíben.

**Límite conocido: el match corre sobre el texto subyacente, no sobre su etiqueta traducida.** El contenido que carga el usuario (descripción, nombres de cuenta, institución, categorías propias) se guarda tal como lo tipeó, así que matchea en cualquier idioma. El texto que genera Grana, no: las categorías del sistema se guardan en español y se renderizan traducidas, y el label de tipo de la fila se traduce al renderizar en vez de leerse del título derivado. Con la UI en inglés, entonces, ninguno de esos dos matchea por su etiqueta visible. Es un comportamiento preexistente que este requirement enuncia sin cerrar; cerrarlo implicaría sacar la derivación del título del SQL o llevar el catálogo i18n a la query.

#### Scenario: Un movimiento sin descripción se encuentra por su institución

- **WHEN** el usuario tiene un gasto sin descripción en una cuenta de la institución "Galicia" y busca "Galicia"
- **THEN** el movimiento aparece en el listado
- **AND** aparece igual en el feed global y en el detalle de esa cuenta, en web y en mobile

#### Scenario: Un movimiento sin descripción se encuentra por su categoría, vía el título

- **WHEN** el usuario tiene un gasto sin descripción categorizado como "Supermercado" y busca "Supermercado"
- **THEN** el movimiento aparece, porque el título derivado de un gasto es el nombre de su categoría
- **AND** el mismo término no devuelve una transferencia categorizada como "Supermercado", cuyo título es la etiqueta fija "Transferencia"

#### Scenario: La cuenta destino de un cambio de moneda es buscable

- **WHEN** el usuario busca el nombre (o la institución) de la cuenta que recibe el dinero en un movimiento de tipo `exchange`
- **THEN** ese movimiento aparece en el listado
- **AND** lo mismo vale para una `transfer`

#### Scenario: La subcategoría no es buscable como texto

- **WHEN** el usuario busca el nombre de una subcategoría y ningún movimiento lo lleva en su descripción, su título ni sus cuentas
- **THEN** el listado no devuelve esos movimientos, en ninguna de las cuatro superficies
- **AND** el filtro de subcategoría sí los devuelve

#### Scenario: Las tres superficies devuelven lo mismo para la misma query

- **WHEN** el usuario aplica el mismo término de búsqueda en `/transactions` y en el detalle de una cuenta, sobre el mismo mes
- **THEN** los movimientos de esa cuenta presentes en un resultado están presentes en el otro
- **AND** la diferencia entre las superficies es sólo dónde corre el filtro (la base en el feed, memoria en el detalle), no qué campos matchea

#### Scenario: Los comodines SQL se buscan como texto literal

- **WHEN** el usuario busca `%` o `_`
- **THEN** el sistema devuelve los movimientos cuyo texto contiene ese carácter
- **AND** no interpreta el término como un patrón que matchea todo

## MODIFIED Requirements

### Requirement: El módulo global de movimientos permite búsqueda y filtros

El sistema SHALL permitir filtrar el listado global de movimientos por texto, tipo de movimiento, categoría, cuenta, **moneda** y **rango de monto**, y navegar el período **por mes**. Los filtros SHALL vivir en el state interno del cliente (React state via context), no en la URL.

La URL canónica de `/transactions` SHALL ser `/transactions` sin query params. La ruta NO SHALL ser deep-linkeable con un filtro pre-aplicado en esta iteración (ver requirement separado sobre estado en React state). Recargar la página resetea los filtros al default.

La UI de filtros SHALL ser una **barra compacta** (búsqueda + navegación por mes + botón "Filtros" con un contador de filtros activos); los filtros detallados (tipo, categoría, cuenta, moneda, rango de monto) SHALL vivir en un **panel desplegable**, y los filtros activos SHALL mostrarse como **chips removibles** bajo la barra, junto con una acción "Limpiar todo". La búsqueda SHALL ser **instantánea** (sin botón de aplicar, con un breve debounce) y SHALL buscar en **todo el historial** del usuario, no solo en los movimientos ya paginados. El set de campos que la búsqueda matchea SHALL ser el canónico definido en el requirement "Los campos buscables de la búsqueda de movimientos son un set único"; en esta superficie el match lo resuelve la RPC `get_movements_page`.

El período SHALL navegarse **por mes** (mes anterior / mes siguiente) como control primario; por defecto SHALL mostrarse el **mes actual** (computado en la zona horaria financiera con `getTodayAR()`), conservando una opción de rango personalizado que tiene prioridad sobre el mes. El filtro por cuenta SHALL mostrarse únicamente cuando el usuario tiene **dos o más cuentas**; con una sola cuenta no se ofrece.

#### Scenario: Buscar de forma instantánea sobre el set canónico

- **WHEN** el usuario tipea en la búsqueda
- **THEN** el sistema filtra (con un breve debounce) los movimientos cuyo título, descripción efectiva, nombre de cuenta o nombre de institución coincida, sin requerir un botón de aplicar
- **AND** la coincidencia se busca en todo el historial, no solo en la página actual
- **AND** el término de búsqueda vive en React state (el componente lo lee del context de filtros)

#### Scenario: Navegación por mes como período por defecto

- **WHEN** el usuario abre `/transactions`
- **THEN** el sistema muestra los movimientos del mes actual (según `getTodayAR()`)
- **AND** el usuario puede navegar al mes anterior o siguiente con las flechas
- **AND** interpreta las fechas como fecha contable, no como timestamp UTC
- **AND** el cambio de mes muta el estado interno; la URL no cambia

#### Scenario: Rango personalizado

- **WHEN** el usuario define un rango de fechas personalizado
- **THEN** el sistema muestra los movimientos de ese rango
- **AND** el rango personalizado tiene prioridad sobre el mes seleccionado

#### Scenario: Filtrar por moneda

- **WHEN** el usuario filtra por ARS o por USD
- **THEN** el sistema muestra solo los movimientos de esa moneda
- **AND** nunca combina ni convierte montos de monedas distintas

#### Scenario: Filtrar por cuenta cuando hay dos o más cuentas

- **WHEN** un usuario con dos o más cuentas filtra por una cuenta específica
- **THEN** el sistema muestra movimientos donde esa cuenta participa como origen, destino, cuenta de pago o tarjeta relacionada según el tipo funcional del movimiento
- **AND** un usuario con una sola cuenta no ve el filtro por cuenta

#### Scenario: Filtros activos como chips removibles

- **WHEN** hay uno o más filtros aplicados
- **THEN** el sistema los muestra como chips removibles bajo la barra y un contador en el botón "Filtros"
- **AND** quitar un chip elimina ese filtro del estado interno y reconsulta la sección de movimientos
- **AND** la URL no se modifica

### Requirement: La tab Movimientos de mobile muestra el feed global navegable por mes

La pestaña primaria **Movimientos** de la app mobile SHALL renderizar el feed global de movimientos del usuario, navegable por mes y **acotable por filtros**, como thin consumer del read compartido `getGlobalMovementsPage` de `@grana/transactions`.

La pantalla SHALL mostrar, desde el primer frame, el chrome siempre visible: el `PageHeader` nativo (navy) con el título de la sección y el acceso a recurrencias, y un **selector de mes** (el `MonthNavigator` compartido, con controles prev / ‹mes› / next). El mes inicial SHALL ser el mes actual (`monthOf(getTodayAR())`). Cambiar de mes SHALL recargar el feed de ese mes y resetear la paginación.

La lista SHALL reusar los primitivos nativos `MovementList` / `MovementRow` (`apps/mobile/components/movements/`), renderizando las filas del feed agrupadas por fecha. El estado de mes del feed SHALL ser **independiente** del mes del dashboard (navegar uno no mueve el otro).

**Barra de filtros.** La pantalla SHALL ofrecer, bajo el selector de mes: una **búsqueda de texto libre** (input inline que se despliega desde un chip de acción), una **hoja de filtros** (`MovementFiltersSheet`) con tipo, cuenta, categoría, subcategoría, moneda y rango de monto, y los **chips de filtro activos removibles**. El chip que abre la hoja SHALL mostrar el conteo de filtros de contenido activos; ese conteo SHALL **excluir el mes y la búsqueda**, que tienen sus propios controles. El **filtro de cuenta** SHALL ofrecerse sólo cuando hay dos o más cuentas que desambiguar.

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

#### Scenario: La búsqueda del feed matchea el mismo set que el detalle de cuenta

- **WHEN** el usuario busca el nombre de una institución en el feed
- **THEN** la lista devuelve los movimientos de las cuentas de esa institución, y devuelve exactamente los mismos que devolvería la misma query en el detalle de esas cuentas
- **AND** buscar el nombre de una subcategoría NO devuelve los movimientos que sólo la llevan como subcategoría, en ninguna de las dos superficies
- **AND** el filtro de subcategoría de la hoja sí los devuelve

#### Scenario: Tocar una fila del feed abre el detalle

- **WHEN** el usuario toca una fila del feed de Movimientos
- **THEN** navega al detalle `/transactions/[txId]` de ese movimiento, pasando el contexto de origen (`?from=…`) para resolver el back
- **AND** el feed no renderiza breakdown por categoría
