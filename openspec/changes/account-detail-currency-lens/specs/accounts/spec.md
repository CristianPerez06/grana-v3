## MODIFIED Requirements

### Requirement: El usuario puede ver el detalle de una cuenta

El sistema SHALL mostrar la pantalla de detalle de una cuenta como una composición de **cuatro tarjetas pares** verticales sobre la `--page` surface, en este orden lógico:

1. **Hero card de identidad** (navy gradient surface): avatar, nombre, institución (si `bank`), tipo, balances ARS/USD primario/secundario, badge `Archivada` (si `is_active=false`), y el botón `Editar` (pencil icon) como única acción del slot derecho.
2. **Tarjeta de reembolsos pendientes** (solo si la cuenta tiene reembolsos pendientes asociados): renderiza el `PendingReimbursementsBlock` con su badge de conteo y la lista de items con sus formularios in-line de confirmar/cancelar.
3. **Link píldora `+ Agregar moneda`** (solo si la cuenta no tiene todas las monedas activas — ARS y USD): superficie ligera, no es una card; abre el flujo de edición de monedas.
4. **Tarjeta de movimientos** (siempre): superficie blanca con border-radius alineado al card de hero. Su primera fila SHALL reunir el título `Movimientos` (con el selector ARS | USD cuando la cuenta usa las dos monedas), los íconos de búsqueda, recurrencias y filtros, y la CTA `+ Agregar transacción` (en viewport de celular, solo el ícono «+», y el selector baja debajo del título); debajo, los chips de filtros activos y la lista (`MovementList` con running balance per-row cuando no hay filtros de contenido). NO SHALL haber navegador de mes: los movimientos de la cuenta se leen como **una lista corrida**, de la más reciente a la más vieja, paginada con «Cargar más», como el resumen de un banco; para ver un tramo puntual la hoja de filtros ofrece «Desde / Hasta».

**Las mutaciones de baja (archivar / eliminar / reactivar) NO viven en el detalle**: su superficie canónica es el menú kebab del card en `/accounts` (ver requirement "El usuario puede ver la lista de sus cuentas agrupadas por tipo"). El hero card SHALL renderizar únicamente el botón `Editar` en su slot de acciones.

La pantalla de detalle en `apps/web` SHALL adoptar el patrón de **in-page chrome con shell cliente + TanStack Query** definido en el spec `route-loading-and-errors`: el `page.tsx` server-side se reserva exclusivamente para los guards terminales (auth, `notFound()` si la cuenta no existe o no pertenece al usuario, `redirect('/cards/[id]')` si la cuenta es `type='credit'`); el resto se monta como un shell cliente cuyas secciones (hero card, tarjeta de reembolsos pendientes, tarjeta de movimientos) fetchean independientemente y entregan loading/error in-place. El back-link a `/accounts` SHALL ser visible desde el primer paint; las cards SHALL exhibir cada una su propio skeleton-card mientras cargan. Los detalles del header pattern y del state de filtros están normados en los requirements correspondientes del spec `transactions`.

#### Scenario: Detalle de cuenta cash

- **WHEN** el usuario abre el detalle de una cuenta cash
- **THEN** el hero card muestra el nombre, tipo "Efectivo", sin institución, balances ARS/USD
- **AND** la tarjeta de movimientos muestra en una fila el título `Movimientos`, los íconos de búsqueda, recurrencias y filtros y la CTA, y debajo la lista corrida, sin navegador de mes

#### Scenario: Detalle de cuenta bank muestra institución en el hero card

- **WHEN** el usuario abre el detalle de una cuenta bank
- **THEN** el hero card muestra adicionalmente el nombre de la institución asociada como subtítulo del nombre de cuenta

#### Scenario: La lista de movimientos incluye transferencias entrantes

- **WHEN** la cuenta es destino de una transferencia desde otra cuenta
- **THEN** esa transferencia aparece en la lista dentro de la tarjeta de movimientos con signo `+` y etiqueta de cuenta origen (ver spec `transactions`)

#### Scenario: Cuenta de otro usuario no es accesible

- **WHEN** el usuario intenta acceder al detalle de una cuenta que no le pertenece
- **THEN** el guard server-side del `page.tsx` retorna `notFound()` (RLS filtra la fila; la página renderiza 404)
- **AND** el shell client nunca se monta

#### Scenario: Cuenta credit redirige a /cards/[id] server-side

- **WHEN** el usuario entra a `/accounts/[id]` y la cuenta tiene `type='credit'`
- **THEN** el guard server-side ejecuta `redirect('/cards/[id]')`
- **AND** el shell client de account detail nunca se monta

#### Scenario: El back-link se renderiza desde el primer paint

- **WHEN** un usuario web navega a `/accounts/[id]` y las queries del shell aún no resolvieron
- **THEN** el back-link a `/accounts` ya está visible
- **AND** el hero card muestra su skeleton-card hasta que la query de account detail resuelva
- **AND** la tarjeta de movimientos muestra su skeleton-card hasta que las queries de movimientos resuelvan
- **AND** el botón "Editar" del hero card está disabled o cae a su link de fallback hasta que `account` e `institutions` estén disponibles

#### Scenario: El hero card solo expone Editar

- **WHEN** se renderiza el hero card del detalle de una cuenta (cash o bank)
- **THEN** el único botón en el slot derecho de acciones es `Editar`
- **AND** no se renderizan botones de `Archivar` ni `Eliminar` ni `Reactivar`
- **AND** el hero card no invoca `window.confirm()` para ninguna acción

#### Scenario: La tarjeta de reembolsos pendientes es condicional

- **WHEN** la cuenta no tiene reembolsos pendientes asociados
- **THEN** la tarjeta de reembolsos NO se renderiza
- **AND** el orden visual es: hero card → (opcional) link `+ Agregar moneda` → tarjeta de movimientos

#### Scenario: El link `+ Agregar moneda` es condicional

- **WHEN** la cuenta ya tiene ARS y USD activas
- **THEN** el link `+ Agregar moneda` NO se renderiza
- **AND** el flujo de gestión de monedas sigue disponible desde el drawer de edición

#### Scenario: Las secciones del cuerpo cargan independientemente

- **WHEN** las queries de movimientos, filtros y reembolsos del shell se ejecutan en paralelo
- **THEN** cada tarjeta muestra su propio loading state in-place mientras su query no resuelve
- **AND** una tarjeta que resuelve antes se renderiza con datos sin esperar a las demás
- **AND** una tarjeta que falla muestra error + retry localizados sin tirar el back-link ni las otras tarjetas

#### Scenario: El badge "Archivada" se renderiza sobre la superficie navy del hero card

- **WHEN** se renderiza el hero card de una cuenta con `is_active=false`
- **THEN** el badge `Archivada` aparece junto al nombre de la cuenta
- **AND** la paleta del chip está adaptada a la superficie navy del hero card (no `bg-yellow-100` sobre claro)
- **AND** la copy `accounts.badges.archived` no cambia

#### Scenario: La lista de la cuenta es corrida y se acota con «Desde / Hasta»

- **WHEN** el usuario abre el detalle de una cuenta con movimientos en varios meses
- **THEN** ve todos sus movimientos en una sola lista, del más reciente al más viejo, con «Cargar más» al final, y sin navegador de mes
- **AND** al elegir «Desde» y «Hasta» en la hoja de filtros la lista se acota a ese tramo, aparece un chip con las fechas y el saldo corriente se sigue mostrando

## REMOVED Requirements

### Requirement: El detalle de cuenta en mobile filtra los movimientos con un toolbar (mobile)

**Reason**: Pedía navegación por mes y una fila de acciones con texto. El detalle de cuenta pasa a ser una lista corrida con «Desde / Hasta» y el toolbar de íconos en la fila del título, igual que la web. Se reemplaza por "El detalle de cuenta en mobile filtra una lista corrida con un toolbar en la fila del título (mobile)".
**Migration**: Ninguna de datos.

### Requirement: El detalle de cuenta en mobile muestra saldos, movimientos y reintegros (mobile)

**Reason**: Pedía los dos saldos por fila y las dos patas del cambio en la misma fila. Se reemplaza por "El detalle de cuenta en mobile muestra saldos, movimientos y reintegros, de a una moneda (mobile)", que sigue la regla de un libro por vez de la web.
**Migration**: Ninguna de datos.

## ADDED Requirements

### Requirement: El detalle de cuenta en mobile filtra una lista corrida con un toolbar en la fila del título (mobile)

La lista de movimientos del detalle SHALL ser **corrida** —todos los movimientos de la cuenta, del más reciente al más viejo, paginados con «Cargar más»— y NO SHALL tener navegador de mes, igual que la web. SHALL ofrecer un toolbar con paridad funcional y visual al del web app, **en la fila del título** `Movimientos`: búsqueda de texto libre, un acceso a recurrencias y una hoja de filtros (tipo, categoría, subcategoría, «Desde / Hasta», moneda cuando no hay selector ARS | USD, monto mín/máx) con chips de filtro activos removibles. Los tres son botones de ícono de 36px (`ToolbarIconButton`), los mismos que usa la tab Movimientos. Las filas SHALL ser las de `MovementList` / `MovementRow` compartidas con la tab Movimientos —no una fila propia del detalle—, y tocar una fila SHALL abrir el detalle del movimiento.

**La hoja de filtros SHALL ser la misma que usa el feed global de Movimientos** — una sola implementación, parametrizada por `showAccountFilter`. En el detalle de cuenta el filtro de cuenta SHALL estar **oculto**: la pantalla ya está scopeada a una cuenta. Mismo criterio que web. La hoja vive con el resto de los componentes de movimientos, no bajo los del detalle de cuenta.

**El filtrado SHALL seguir siendo en cliente**, y eso NO es una inconsistencia con el feed global, que filtra en la base. Es consecuencia de que las dos superficies leen distinto: el detalle carga el historial **completo** de la cuenta porque lo necesita para el saldo corriente, así que filtrar en memoria es correcto y gratis; el feed pagina, y filtrar una página parcial daría un resultado incorrecto (ver la spec de `transactions`). Las dos superficies comparten la hoja de filtros y el renderer de chips activos; NO comparten la forma de aplicar los filtros ni la fila de acciones: el detalle lleva el título y el acceso a recurrencias en ella; la tab Movimientos tiene su propio navegador de mes y las recurrencias en su `PageHeader`.

El rango «Desde / Hasta» SHALL aplicarse sobre la fecha contable del movimiento, y la aplicación de los filtros SHALL ser un paso nativo puro sobre `TransactionWithDetails`. El **match de búsqueda**, en cambio, SHALL delegarse a `movementMatchesText` de `@grana/transactions` sobre el `FinancialMovement` de cada fila — el mismo que usa el detalle de cuenta web—, y NO SHALL reimplementarse en `apps/mobile`. Es lo que garantiza el set único de campos buscables que la spec de `transactions` define; un matcher nativo paralelo sería el patrón "mirror … keep in sync" que las convenciones del repo prohíben. La pantalla ya deriva el `FinancialMovement` de cada fila una vez por carga para el eje de tipo (ver el párrafo siguiente), de modo que el matcher compartido no agrega una segunda derivación.

**El eje de tipo SHALL ser el `kind` derivado** (`MovementTypeFilter`), no la columna `transaction_type`, para que la hoja compartida hable un solo lenguaje con el feed y con el contrato `MovementFilters`. Como el detalle filtra sobre `TransactionWithDetails`, que no lleva `kind`, la pantalla SHALL derivar el `FinancialMovement` de cada fila con `toFinancialMovement` de `@grana/transactions` —la única derivación de `kind` que existe— **una vez por carga de las filas**, no por interacción de filtrado, y SHALL conservarlo indexado por id para que tanto el eje de tipo como el match de búsqueda lo consuman. NO SHALL reimplementarse la derivación en `apps/mobile`.

**Las opciones de categoría/subcategoría SHALL derivarse del catálogo** (`getMovementFilterOptions` de `@grana/transactions`), no de los movimientos de la cuenta. Es lo que ya hace el detalle de cuenta web, y es lo que permite que la hoja compartida tenga una sola fuente de opciones en vez de dos con semánticas distintas. Se acepta la consecuencia: el menú PUEDE ofrecer una categoría que en esta cuenta no tenga movimientos.

El acceso a recurrencias SHALL navegar a la ruta nativa de recurrencias.

#### Scenario: Acotar por fechas y filtrar movimientos (mobile)

- **WHEN** el usuario elige «Desde / Hasta», aplica filtros (tipo/categoría/monto) o escribe en la búsqueda
- **THEN** la lista de movimientos se filtra en cliente sobre el historial de la cuenta usando ese rango y el resto de los filtros
- **AND** los filtros activos aparecen como chips removibles y el botón de filtros muestra el conteo activo

#### Scenario: La hoja de filtros es la misma que la del feed (mobile)

- **WHEN** el usuario abre la hoja de filtros desde el detalle de cuenta y desde la tab Movimientos
- **THEN** las dos abren el mismo componente, con los mismos controles y el mismo formato de estado
- **AND** en el detalle de cuenta el filtro de cuenta no se ofrece, porque la pantalla ya está scopeada a una

#### Scenario: El tipo se filtra por `kind` derivado (mobile)

- **WHEN** el usuario filtra por tipo en el detalle de cuenta
- **THEN** las opciones son las del `kind` derivado, incluidas compra en cuotas, pago de resumen y reintegro
- **AND** el `FinancialMovement` de cada fila se deriva con `toFinancialMovement` una sola vez por carga de las filas, no en cada cambio de filtro

#### Scenario: La búsqueda usa el matcher compartido (mobile)

- **WHEN** el usuario escribe un término en la búsqueda del detalle de cuenta nativo
- **THEN** el match lo resuelve `movementMatchesText` de `@grana/transactions`, el mismo que usa el detalle de cuenta web
- **AND** el resultado coincide con el de la misma query en web, incluidos los nombres de institución y la cuenta destino de un `exchange`
- **AND** no existe una implementación del match en `apps/mobile`

#### Scenario: Las opciones de la hoja salen del catálogo (mobile)

- **WHEN** la pantalla puebla la hoja de filtros
- **THEN** las categorías y subcategorías ofrecidas provienen de `getMovementFilterOptions`, igual que en el detalle de cuenta web
- **AND** el usuario puede elegir una categoría que en esta cuenta no tenga movimientos, y la lista queda vacía con su empty-state

#### Scenario: El acceso a recurrencias navega al hub nativo (mobile)

- **WHEN** el usuario toca "Ver recurrencias" en el toolbar de movimientos
- **THEN** la app navega a la ruta nativa de recurrencias

#### Scenario: Las filas son las de la tab Movimientos (mobile)

- **WHEN** el detalle de cuenta muestra un ajuste, un cambio de moneda o una transferencia
- **THEN** cada fila se ve igual que en la tab Movimientos y que en la web: ícono, título («Ajuste», «Cambio», «Transferencia»), la cuenta de la otra punta debajo, monto con tono y saldo debajo del monto
- **AND** las filas se agrupan por día con encabezados «Hoy», «Ayer» o «Viernes, 13 de noviembre»

### Requirement: El detalle de cuenta en mobile muestra saldos, movimientos y reintegros, de a una moneda (mobile)

La pantalla `accounts/[id]/index` SHALL mostrar un hero con la identidad de la cuenta (avatar, nombre, institución/tipo, badge Archivada si aplica) y los saldos ARS/USD totales, obtenidos de `getAccountDetail` de `@grana/accounts`. SHALL mostrar la lista de movimientos de la cuenta usando `getAccountMovementsAscending` de `@grana/transactions`. La presentación SHALL replicar la del web app en viewport de celular, con las mismas reglas (spec `transactions`, requirement "El listado de una cuenta muestra el saldo corriente por fila, de a una moneda"): cada fila muestra fecha/descripción + monto con tono y, debajo del monto, el **saldo corriente** de la moneda que se está viendo; una cuenta que usa las dos monedas muestra el selector **ARS | USD** debajo del título «Movimientos», con el mismo aspecto que el selector de moneda de «¿En qué gasté?» nativo, y arranca en ARS (debajo del título, porque en la fila del título van los íconos de búsqueda, recurrencias y filtros, igual que la web en viewport de celular); un cambio de moneda dentro de la misma cuenta aparece en las dos monedas; con el selector visible la moneda no es un filtro: la hoja no la ofrece, no hay chip ni cuenta en el botón de filtros, y limpiar los filtros no la cambia; y el saldo se oculta mientras haya filtros de contenido (tipo, categoría, subcategoría, rango de monto) o una búsqueda, pero no por la moneda elegida. El saldo corriente SHALL calcularse con `computeRunningBalances` de `@grana/money-logic` sobre el historial ascendente que la pantalla ya carga, partiendo del saldo inicial por moneda de la cuenta; NO SHALL pedir datos nuevos al servidor. El signo/monto por fila desde la perspectiva de la cuenta SHALL derivarse de `resolveMovementView` y `legInCurrency` de `@grana/money-logic`, sin reimplementar la lógica de patas (transferencias/cambios) en mobile. El tono del monto SHALL derivarse de `resolveTone` de `@grana/transactions`, igual que la web y el feed nativo (una transferencia o un cambio entre cuentas propias se ve neutro), y el signo SHALL ir pegado al monto como en la web (`-$ 480`). SHALL mostrar la card de reintegros pendientes ("A confirmar") usando `getPendingReimbursements` de `@grana/transactions` scopeado a la cuenta. SHALL ofrecer un acceso a agregar moneda cuando haya monedas disponibles.

#### Scenario: El detalle muestra saldos y movimientos (mobile)

- **WHEN** el usuario abre el detalle de una cuenta con movimientos
- **THEN** el hero muestra los saldos ARS/USD y la pantalla lista los movimientos de la cuenta
- **AND** la card "A confirmar" lista los reintegros pendientes de esa cuenta si existen

#### Scenario: La presentación de movimientos replica el web app en mobile (mobile)

- **WHEN** la pantalla renderiza la lista de movimientos sin filtros de contenido
- **THEN** cada fila muestra fecha/descripción + monto con tono y, debajo del monto, el saldo corriente de la moneda que se está viendo, igual que la web en viewport de celular
- **AND** el signo/monto por fila desde la perspectiva de la cuenta se deriva de `resolveMovementView` de `@grana/money-logic`, sin reimplementar la lógica en mobile

#### Scenario: Un cambio de moneda se ve con el mismo tono que en la web (mobile)

- **WHEN** el detalle de cuenta muestra un cambio de moneda o una transferencia entre cuentas propias
- **THEN** el monto se ve en tono neutro y con el signo pegado (`-$ 3.859.134`), igual que la web en viewport de celular

#### Scenario: Una cuenta con pesos y dólares se ve de a una moneda (mobile)

- **WHEN** el usuario abre el detalle de una cuenta que usa ARS y USD y elige USD en el selector
- **THEN** la lista muestra solo el libro en dólares, con el saldo USD de cada fila igual al que muestra la web

#### Scenario: Un filtro oculta el saldo corriente, la moneda no (mobile)

- **WHEN** el usuario aplica un filtro de tipo, categoría o monto, o escribe una búsqueda
- **THEN** las filas dejan de mostrar el saldo corriente
- **AND** elegir solo la moneda no lo oculta
