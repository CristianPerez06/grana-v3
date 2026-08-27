## MODIFIED Requirements

### Requirement: El detalle de cuenta en mobile filtra los movimientos con un toolbar (mobile)

La lista de movimientos del detalle SHALL ofrecer un toolbar con paridad funcional al del web app: navegación por mes (anterior/siguiente con label de mes), búsqueda de texto libre, un acceso a recurrencias, y una hoja de filtros (tipo, categoría, subcategoría, moneda, monto mín/máx) con chips de filtro activos removibles.

**La hoja de filtros SHALL ser la misma que usa el feed global de Movimientos** — una sola implementación, parametrizada por `showAccountFilter`. En el detalle de cuenta el filtro de cuenta SHALL estar **oculto**: la pantalla ya está scopeada a una cuenta. Mismo criterio que web. La hoja vive con el resto de los componentes de movimientos, no bajo los del detalle de cuenta.

**El filtrado SHALL seguir siendo en cliente**, y eso NO es una inconsistencia con el feed global, que filtra en la base. Es consecuencia de que las dos superficies leen distinto: el detalle carga el historial **completo** de la cuenta porque lo necesita para el saldo corriente, así que filtrar en memoria es correcto y gratis; el feed pagina, y filtrar una página parcial daría un resultado incorrecto (ver la spec de `transactions`). Las dos superficies comparten la hoja de filtros y el renderer de chips activos; NO comparten la forma de aplicar los filtros ni la fila de acciones, que difiere en título, ubicación del navegador de mes y acceso a recurrencias.

El rango del mes SHALL calcularse con `resolveMonthRange` de `@grana/dashboard`, y la aplicación de los filtros SHALL ser un paso nativo puro sobre `TransactionWithDetails`. El **match de búsqueda**, en cambio, SHALL delegarse a `movementMatchesText` de `@grana/transactions` sobre el `FinancialMovement` de cada fila — el mismo que usa el detalle de cuenta web—, y NO SHALL reimplementarse en `apps/mobile`. Es lo que garantiza el set único de campos buscables que la spec de `transactions` define; un matcher nativo paralelo sería el patrón "mirror … keep in sync" que las convenciones del repo prohíben. La pantalla ya deriva el `FinancialMovement` de cada fila una vez por carga para el eje de tipo (ver el párrafo siguiente), de modo que el matcher compartido no agrega una segunda derivación.

**El eje de tipo SHALL ser el `kind` derivado** (`MovementTypeFilter`), no la columna `transaction_type`, para que la hoja compartida hable un solo lenguaje con el feed y con el contrato `MovementFilters`. Como el detalle filtra sobre `TransactionWithDetails`, que no lleva `kind`, la pantalla SHALL derivar el `FinancialMovement` de cada fila con `toFinancialMovement` de `@grana/transactions` —la única derivación de `kind` que existe— **una vez por carga de las filas**, no por interacción de filtrado, y SHALL conservarlo indexado por id para que tanto el eje de tipo como el match de búsqueda lo consuman. NO SHALL reimplementarse la derivación en `apps/mobile`.

**Las opciones de categoría/subcategoría SHALL derivarse del catálogo** (`getMovementFilterOptions` de `@grana/transactions`), no de los movimientos de la cuenta. Es lo que ya hace el detalle de cuenta web, y es lo que permite que la hoja compartida tenga una sola fuente de opciones en vez de dos con semánticas distintas. Se acepta la consecuencia: el menú PUEDE ofrecer una categoría que en esta cuenta no tenga movimientos.

El acceso a recurrencias SHALL navegar a la ruta nativa de recurrencias.

#### Scenario: Navegar meses y filtrar movimientos (mobile)

- **WHEN** el usuario cambia el mes o aplica filtros (tipo/categoría/moneda/monto) o escribe en la búsqueda
- **THEN** la lista de movimientos se filtra en cliente sobre el historial de la cuenta usando el rango del mes (`resolveMonthRange`) y el resto de los filtros
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
