## ADDED Requirements

### Requirement: El módulo de cuentas en mobile se pushea desde Menú (mobile)

La app nativa SHALL exponer el módulo de cuentas como un stack de Expo Router (`app/(app)/accounts/`) pusheado desde Menú, NO como una tab nueva — las tabs nativas (Inicio / Movimientos / Hogar / Menú) están fijas. La navegación de entrada SHALL ser `router.push('/accounts')` (ya emitida por la card de cuentas del dashboard). El stack SHALL usar `Stack { headerShown:false }`; cada pantalla SHALL renderizar su propio `PageHeader` sobre `SafeAreaView edges={['top']}`, nunca el header nativo del stack.

El chrome de cada pantalla (back-link y slots de acción del `PageHeader`) SHALL ser visible desde el primer paint; los botones que dependen de data (p. ej. "Crear" mientras cargan instituciones) SHALL renderizarse disabled hasta que la data esté disponible, sin taparse con un skeleton de header.

#### Scenario: Cuentas se abre desde Menú, no como tab (mobile)

- **WHEN** el usuario toca Cuentas en el Menú (o la card de cuentas del dashboard)
- **THEN** la app pushea el stack `accounts/` y muestra la lista con un `PageHeader` propio y back-link
- **AND** las tabs fijas (Inicio / Movimientos / Hogar / Menú) no cambian

#### Scenario: El chrome del header se ve desde el primer paint (mobile)

- **WHEN** una pantalla de cuentas monta y sus queries aún no resolvieron
- **THEN** el `PageHeader` (título, back-link, slots de acción) ya es visible
- **AND** el botón "Crear" está disabled hasta que resuelve la query de instituciones

### Requirement: La lista de cuentas en mobile agrupa activas y archivadas con acciones por fila (mobile)

La pantalla `accounts/index` SHALL listar las cuentas cash/bank del usuario agrupadas en Efectivo y Cuentas bancarias (activas), más una sección Archivadas que SHALL renderizarse solo si existen archivadas. Cada fila SHALL mostrar el avatar resuelto, el nombre (con institución cuando exista), y los saldos ARS/USD. Los datos SHALL salir de `getCashAndBankAccounts` de `@grana/accounts` vía un hook TanStack con query key propio de mobile. Con cero cuentas activas SHALL mostrarse un empty state.

Las acciones por fila SHALL presentarse vía el patrón de action sheet nativo del repo (`Popover` bottom-sheet + `Alert.alert` para confirmaciones destructivas), NO una lib de action sheet nueva: Editar, Archivar/Eliminar (según `is_active` y `has_transactions`) y Reactivar. La elección archivar-vs-eliminar SHALL respetar el guard del paquete (una cuenta con movimientos se archiva, no se elimina).

#### Scenario: La lista agrupa y muestra saldos (mobile)

- **WHEN** el usuario abre Cuentas con cuentas de efectivo y bancarias activas
- **THEN** la lista muestra las secciones Efectivo y Cuentas bancarias, cada fila con avatar, nombre/institución y saldos ARS/USD
- **AND** la sección Archivadas aparece solo si el usuario tiene cuentas archivadas

#### Scenario: Las acciones de fila usan el action sheet nativo (mobile)

- **WHEN** el usuario toca el menú de acciones de una fila
- **THEN** se abre un `Popover` bottom-sheet con Editar / Archivar (o Reactivar) / Eliminar según el estado de la cuenta
- **AND** Eliminar y Archivar piden confirmación vía `Alert.alert` antes de ejecutar

### Requirement: El detalle de cuenta en mobile muestra saldos, movimientos y reintegros (mobile)

La pantalla `accounts/[id]/index` SHALL mostrar un hero con la identidad de la cuenta (avatar, nombre, institución/tipo, badge Archivada si aplica) y los saldos ARS/USD totales, obtenidos de `getAccountDetail` de `@grana/accounts`. SHALL mostrar la lista de movimientos de la cuenta usando `getAccountMovementsAscending` de `@grana/transactions`. La presentación SHALL replicar la del web app dentro de los breakpoints mobile: cada fila muestra fecha/descripción + monto con tono, SIN columna de saldo corriente por fila (en web esa columna es `hidden md:block`; el saldo total vive en el hero). El signo/monto por fila desde la perspectiva de la cuenta SHALL derivarse de `resolveMovementView` de `@grana/money-logic`, sin reimplementar la lógica de patas (transferencias/cambios) en mobile. SHALL mostrar la card de reintegros pendientes ("A confirmar") usando `getPendingReimbursements` de `@grana/transactions` scopeado a la cuenta. SHALL ofrecer un acceso a agregar moneda cuando haya monedas disponibles.

#### Scenario: El detalle muestra saldos y movimientos (mobile)

- **WHEN** el usuario abre el detalle de una cuenta con movimientos
- **THEN** el hero muestra los saldos ARS/USD y la pantalla lista los movimientos de la cuenta
- **AND** la card "A confirmar" lista los reintegros pendientes de esa cuenta si existen

#### Scenario: La presentación de movimientos replica el web app en mobile (mobile)

- **WHEN** la pantalla renderiza la lista de movimientos
- **THEN** cada fila muestra fecha/descripción + monto con tono, sin saldo corriente por fila (paridad con el web app en breakpoints mobile, donde esa columna está oculta)
- **AND** el signo/monto por fila desde la perspectiva de la cuenta se deriva de `resolveMovementView` de `@grana/money-logic`, sin reimplementar la lógica en mobile

### Requirement: El detalle de cuenta en mobile filtra los movimientos con un toolbar (mobile)

La lista de movimientos del detalle SHALL ofrecer un toolbar con paridad funcional al del web app: navegación por mes (anterior/siguiente con label de mes), búsqueda de texto libre, un acceso a recurrencias, y una hoja de filtros (tipo, categoría, subcategoría, moneda, monto mín/máx) con chips de filtro activos removibles. El rango del mes SHALL calcularse con `resolveMonthRange` de `@grana/dashboard`; el filtrado y el match de búsqueda SHALL ser un paso nativo puro sobre `TransactionWithDetails` (análogo de `applyAccountFilters`/`movementMatchesText` del web, que son web-only sobre otro modelo). Las opciones de categoría/subcategoría SHALL derivarse de los movimientos de la cuenta. El acceso a recurrencias SHALL navegar a una ruta nativa dedicada; mientras el módulo de recurrencias mobile no exista, esa ruta SHALL ser un placeholder vacío (sin construir la funcionalidad todavía).

#### Scenario: Navegar meses y filtrar movimientos (mobile)

- **WHEN** el usuario cambia el mes o aplica filtros (tipo/categoría/moneda/monto) o escribe en la búsqueda
- **THEN** la lista de movimientos se filtra en cliente sobre el historial de la cuenta usando el rango del mes (`resolveMonthRange`) y el resto de los filtros
- **AND** los filtros activos aparecen como chips removibles y el botón de filtros muestra el conteo activo

#### Scenario: El acceso a recurrencias navega a un placeholder (mobile)

- **WHEN** el usuario toca "Ver recurrencias" en el toolbar de movimientos
- **THEN** la app navega a una ruta nativa dedicada de recurrencias
- **AND** esa ruta es un placeholder vacío (el módulo de recurrencias mobile se construye en una change posterior)

### Requirement: Crear, editar y gestionar monedas de una cuenta en mobile (mobile)

La app nativa SHALL permitir crear una cuenta (`accounts/new`), editar nombre e institución (`accounts/[id]/edit`, con saldos iniciales en modo locked) y agregar/desactivar monedas (`accounts/[id]/currency`), cada uno como pantalla pusheada en el stack con `PageHeader` + back-link (el equivalente nativo de los drawers web). El selector de institución SHALL permitir buscar instituciones y crear una institución custom inline (nombre + color). Los montos SHALL capturarse con el primitivo `MoneyAmountInput`. Las operaciones SHALL ejecutarse vía un mutator mobile (`lib/accounts/mutations.ts`) que llama directamente a las mutations de `@grana/accounts` — sin server actions en mobile.

#### Scenario: Crear una cuenta bancaria con institución custom (mobile)

- **WHEN** el usuario crea una cuenta bancaria y la institución no está en el catálogo
- **THEN** desde el selector crea una institución custom (nombre + color) inline y la asigna a la cuenta
- **AND** ingresa los saldos iniciales con `MoneyAmountInput` y al guardar navega al detalle de la cuenta creada

#### Scenario: Editar deja los saldos iniciales locked (mobile)

- **WHEN** el usuario edita una cuenta existente
- **THEN** puede cambiar nombre e institución pero los saldos iniciales se muestran locked (no editables)

#### Scenario: Los guards de moneda se respetan con mensaje traducido (mobile)

- **WHEN** el usuario intenta desactivar la última moneda activa o una moneda con saldo distinto de cero
- **THEN** la operación se rechaza y la pantalla muestra el mensaje correspondiente resuelto por `useT`

### Requirement: El mutator de cuentas en mobile traduce el contrato de error neutro con `useT` (mobile)

Las mutations de cuentas en mobile SHALL ejecutarse por un mutator (`apps/mobile/lib/accounts/mutations.ts`) que resuelve el `userId` (`supabase.auth.getUser()`), inyecta `today` (`getTodayAR()` de `@grana/money-logic`) y el client nativo, invoca la mutation de `@grana/accounts` y mapea el `AccountMutationResult` neutro a un resultado nativo `{ ok } | { ok:false, errorKey, fieldErrors }`. El `messageKey` del paquete SHALL resolverse con `useT` en la pantalla; el `errorCode` PG SHALL mapearse a la misma key que usa web (`23505 → accounts.errors.duplicate`, fallback `accounts.errors.generic`); el `reason` estructurado SHALL preservarse para ramificar UX. En éxito, el mutator SHALL invalidar los query keys de cuentas correspondientes. El mutator NO SHALL depender de `apps/web` ni de server actions.

#### Scenario: Un error de dominio se muestra traducido por useT (mobile)

- **WHEN** una mutation de cuenta falla devolviendo `messageKey` o `errorCode`
- **THEN** el mutator lo mapea a un `errorKey` y la pantalla lo muestra resuelto por `useT` en el locale activo
- **AND** no se muestra un literal en español hardcodeado ni un `error.message` crudo

#### Scenario: Una mutación exitosa invalida la cache nativa (mobile)

- **WHEN** el usuario crea, edita, archiva, reactiva o elimina una cuenta, o agrega/desactiva una moneda
- **THEN** el mutator invalida los query keys de cuentas afectados (lista, detalle, instituciones)
- **AND** las pantallas montadas refetchean la data actualizada
