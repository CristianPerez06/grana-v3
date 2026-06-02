## ADDED Requirements

### Requirement: El header de /transactions permanece visible durante carga y error del contenido

`apps/web` SHALL renderizar el header de `/transactions` (título + acceso primario para registrar un movimiento) desde el primer paint, sin estar tapado por un fallback de pantalla completa del layout group. Mientras las queries de la ruta están resolviendo o fallan, el chrome (header + estructura general) SHALL permanecer visible y operable.

La acción primaria del header (`RegisterMovementButton`) SHALL estar deshabilitada (botón disabled, no clickeable) hasta que la data necesaria para abrir el drawer de creación esté disponible: lista de cuentas (`accounts`), árbol de categorías (`categories`), y configuración del hogar (`household`). Cuando las tres están listas, el botón SHALL habilitarse.

Si alguna de esas tres queries falla (no resuelve), el botón MAY habilitarse igual con un modo degradado: el click SHALL mostrar feedback al usuario indicando que el formulario no se pudo cargar y SHALL ofrecer una acción de reintentar. NO SHALL quedar el botón disabled indefinidamente impidiendo al usuario reintentar.

#### Scenario: Header visible mientras el contenido carga

- **WHEN** el usuario navega a `/transactions` y las queries de las secciones aún están pendientes
- **THEN** el header con el título "Movimientos" y el botón "Registrar movimiento" ya está visible
- **AND** el botón "Registrar movimiento" está visualmente disabled (no clickeable)
- **AND** cada sección debajo del header muestra su propio estado de carga in-place (no un fallback de pantalla completa)

#### Scenario: El botón se habilita cuando el drawer está listo

- **WHEN** las queries de `accounts`, `categories` y `household` resolvieron correctamente
- **THEN** el botón "Registrar movimiento" se habilita
- **AND** clickearlo abre el drawer de creación de movimiento

#### Scenario: Mientras el contenido stream-ea, el botón se habilita en cuanto las tres queries del drawer terminan

- **WHEN** `accounts`, `categories` y `household` ya resolvieron pero otras secciones (movimientos, breakdown del mes, recurrencias pendientes) siguen cargando
- **THEN** el botón "Registrar movimiento" ya está habilitado
- **AND** las otras secciones siguen mostrando su loading state in-place sin bloquear el header

#### Scenario: Fallo aislado en una query del drawer no deja el botón locked

- **WHEN** la query de `accounts` (o `categories`, o `household`) falla
- **THEN** el botón "Registrar movimiento" se habilita en modo degradado
- **AND** clickearlo muestra un mensaje de error y una acción para reintentar la carga
- **AND** las secciones del contenido que sí cargaron siguen visibles y operativas

#### Scenario: Un error en una sección no tapa el header

- **WHEN** una sección del contenido (ej. `CategorySpendingOverview`) cae en error durante el fetch
- **THEN** esa sección muestra `<RouteError>` o equivalente en su propio espacio
- **AND** el header sigue visible y funcional
- **AND** las otras secciones siguen visibles y funcionales

### Requirement: El estado de filtros y navegación de /transactions vive en React state, no en URL

`apps/web` SHALL mantener el estado interactivo de `/transactions` (filtros, navegación por mes, currency, modo egresos/ingresos, búsqueda, drill-down de subcategoría, paginación) en React state interno de la ruta, no en query strings de la URL.

La URL de `/transactions` NO SHALL aceptar ni interpretar query parameters relacionados con filtros, navegación o paginación. La URL canónica de la ruta es `/transactions` sin parámetros.

Recargar la página (F5) SHALL resetear todos los filtros al valor por defecto (mes actual según `getTodayAR()`, currency ARS, modo egresos, sin filtros adicionales, sin búsqueda). Este es el comportamiento intencional.

Los componentes hijos de la ruta (chips de filtro removibles, navegador de mes, toggles de currency y modo, búsqueda, drill-down) SHALL leer y mutar este estado mediante un context y hook compartidos provistos por el shell de la ruta. Cualquier acción de "limpiar filtros" o "limpiar búsqueda" SHALL operar sobre este estado, no sobre la URL.

#### Scenario: Cambiar de mes no toca la URL

- **WHEN** el usuario está en `/transactions` y clickea "mes siguiente"
- **THEN** el contenido se actualiza para mostrar el mes siguiente
- **AND** la URL en la barra del browser sigue siendo `/transactions` (sin query params)
- **AND** la historia del browser NO recibe una nueva entrada

#### Scenario: F5 limpia todos los filtros

- **WHEN** el usuario está en `/transactions` con filtros aplicados (ej. categoría X, búsqueda "café", currency USD)
- **AND** recarga la página (F5)
- **THEN** la pantalla vuelve al estado por defecto: mes actual, ARS, egresos, sin filtros ni búsqueda

#### Scenario: La URL canónica no acepta query params

- **WHEN** el usuario entra a `/transactions?month=2026-03` (ej. desde un bookmark antiguo)
- **THEN** la ruta carga normalmente en el estado por defecto
- **AND** los query params son ignorados
- **AND** la URL queda como `/transactions` (sin params) o conserva los params pero sin efecto sobre el estado — el comportamiento elegido SHALL ser consistente y documentado

#### Scenario: Acción "Limpiar filtros" opera sobre state, no URL

- **WHEN** el usuario tiene filtros activos y clickea "Limpiar filtros" (en un chip o en un botón global)
- **THEN** los filtros vuelven a su default
- **AND** el contenido se reconsulta con los filtros limpios
- **AND** la URL no cambia

### Requirement: Cada sección de /transactions fetchea independientemente y entrega su propio loading/error

`apps/web` SHALL renderizar las secciones de `/transactions` (`RecurrenceSuggestionBanner`, `PendingRecurrencesBlock`, `CategorySpendingOverview`, `PendingReimbursementsBlock`, `MovementFilters`, `MovementList`) como componentes client que fetchean independientemente vía TanStack Query. Cada sección SHALL exhibir su propio estado de loading (skeleton acotado al espacio que ocupa) y su propio estado de error (mensaje + retry localizados a la sección), sin bloquear el render de las demás.

NO SHALL haber un fetch monolítico server-side que awaitee múltiples queries antes del primer render. Cada `useQuery` se ejecuta tan pronto el componente se monta y muestra resultado en cuanto resuelve.

#### Scenario: Una sección lenta no bloquea las rápidas

- **WHEN** `getMonthSubcategoryBreakdown` (sección del overview) tarda 2s mientras `getPendingRecurrenceInstances` resuelve en 100ms
- **THEN** la sección de recurrencias pendientes aparece poblada a los 100ms
- **AND** la sección del overview muestra su skeleton hasta los 2s
- **AND** ambas son visibles simultáneamente en la pantalla

#### Scenario: Una sección que falla no derrumba el resto

- **WHEN** `getPendingReimbursements` falla con error
- **THEN** la sección de reembolsos pendientes muestra su mensaje de error con un botón "Reintentar"
- **AND** las otras secciones siguen visibles y operativas
- **AND** el header sigue visible y operativo

#### Scenario: El "Reintentar" de una sección refetcha solo esa query

- **WHEN** el usuario clickea "Reintentar" en una sección que falló
- **THEN** TanStack refetcha solo la query asociada a esa sección
- **AND** las otras secciones no se reconsultan

### Requirement: Las mutations invalidan caches granulares vía helpers semánticos en el cliente y revalidan paths RSC en el servidor

`apps/web` SHALL definir helpers semánticos de invalidación en `lib/transactions/invalidation.ts` que reciben un `QueryClient` y disparan invalidaciones por familia de mutación. Los componentes que disparan mutaciones SHALL llamar el helper correspondiente en el `onSuccess` de la mutación. NO SHALL llamar `router.refresh()` para invalidación de queries locales.

Las server actions de mutación que afectan data visible en otras rutas (`/dashboard`, `/accounts`, `/cards`) SHALL invocar `revalidatePath` para esas rutas antes de retornar, centralizado en helpers en `app/_actions/_helpers.ts` para evitar duplicación y desincronización.

Los helpers mínimos a definir:

- `invalidateAfterMovementMutation(qc)`: para create / update / delete de movimientos (income, expense, transfer, adjustment, exchange).
- `invalidateAfterRecurrenceInstanceMutation(qc, { confirmed })`: para confirmar o saltar una instancia recurrente pendiente.
- `invalidateAfterReimbursementMutation(qc)`: para confirmar o cancelar un reembolso.
- `invalidateAfterSuggestionMutation(qc)`: para aceptar o descartar una sugerencia de recurrencia.

#### Scenario: Crear un movimiento invalida la página, los breakdowns y otras queries relacionadas

- **WHEN** el usuario crea un gasto desde el drawer y la mutation completa
- **THEN** el helper `invalidateAfterMovementMutation` invalida las query keys de la lista de movimientos, los breakdowns del mes, las filter-options, `has-any`, los reembolsos pendientes, la top-suggestion, y los balances de cuentas
- **AND** las secciones afectadas refetchean automáticamente y muestran los datos actualizados
- **AND** las secciones no afectadas (ej. árbol de categorías cacheado) NO refetchean

#### Scenario: Saltar una instancia recurrente solo invalida pending-instances

- **WHEN** el usuario saltea una instancia recurrente pendiente y la mutation completa
- **THEN** el helper `invalidateAfterRecurrenceInstanceMutation` con `{ confirmed: false }` invalida solo la query de pending-instances
- **AND** la lista de movimientos NO refetchea (no se creó ningún movimiento)
- **AND** los breakdowns NO refetchean

#### Scenario: Una mutation desde /transactions deja /dashboard fresco al navegar

- **WHEN** el usuario crea un movimiento desde `/transactions` y luego navega a `/dashboard`
- **THEN** el dashboard muestra el balance, el hero y los breakdowns con la data nueva
- **AND** no es necesario recargar la página manualmente

## MODIFIED Requirements

### Requirement: El módulo global de movimientos permite búsqueda y filtros

El sistema SHALL permitir filtrar el listado global de movimientos por texto, tipo de movimiento, categoría, cuenta, **moneda** y **rango de monto**, y navegar el período **por mes**. Los filtros SHALL vivir en el state interno del cliente (React state via context), no en la URL.

La URL canónica de `/transactions` SHALL ser `/transactions` sin query params. La ruta NO SHALL ser deep-linkeable con un filtro pre-aplicado en esta iteración (ver requirement separado sobre estado en React state). Recargar la página resetea los filtros al default.

La UI de filtros SHALL ser una **barra compacta** (búsqueda + navegación por mes + botón "Filtros" con un contador de filtros activos); los filtros detallados (tipo, categoría, cuenta, moneda, rango de monto) SHALL vivir en un **panel desplegable**, y los filtros activos SHALL mostrarse como **chips removibles** bajo la barra, junto con una acción "Limpiar todo". La búsqueda SHALL ser **instantánea** (sin botón de aplicar, con un breve debounce) y SHALL buscar en **todo el historial** del usuario, no solo en los movimientos ya paginados.

El período SHALL navegarse **por mes** (mes anterior / mes siguiente) como control primario; por defecto SHALL mostrarse el **mes actual** (computado en la zona horaria financiera con `getTodayAR()`), conservando una opción de rango personalizado que tiene prioridad sobre el mes. El filtro por cuenta SHALL mostrarse únicamente cuando el usuario tiene **dos o más cuentas**; con una sola cuenta no se ofrece.

#### Scenario: Buscar por descripción de forma instantánea

- **WHEN** el usuario tipea en la búsqueda
- **THEN** el sistema filtra (con un breve debounce) los movimientos cuya descripción o texto visible coincida, sin requerir un botón de aplicar
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

### Requirement: El listado global está paginado

El sistema SHALL paginar el listado global con un tamaño inicial de página y una acción para cargar más movimientos. El estado de paginación (`limit`) vive en React state, no en la URL.

#### Scenario: El usuario carga más movimientos

- **WHEN** el usuario abre `/transactions` y existen más movimientos que el tamaño inicial de página
- **THEN** el sistema muestra los movimientos más recientes primero
- **AND** ofrece una acción para cargar más movimientos
- **AND** los movimientos adicionales respetan el mismo orden funcional del listado global
- **AND** la acción "cargar más" incrementa el `limit` en el estado interno y reconsulta la sección de movimientos sin afectar otros filtros activos

### Requirement: El listado global distingue el motivo de un resultado vacío

Cuando el listado global de Movimientos no tiene resultados, el sistema SHALL mostrar un estado vacío acorde al **motivo**, no un único mensaje genérico. SHALL distinguir tres variantes:

- **Sin movimientos** (no hay búsqueda ni filtros de contenido activos): el contenido del estado SHALL ser **contextual al estado del usuario**:
  - Si el usuario nunca registró movimientos en ningún mes (primera vez) → mensaje de bienvenida ("Acá va a aparecer cada peso que se mueva") y acción para registrar el primer movimiento.
  - Si el usuario tiene movimientos en otros meses pero solo navegó a un mes vacío → mensaje contextual al mes ("No registraste nada en {mes} todavía") y la misma acción de registrar, sin el tono de bienvenida.
- **Sin resultados de búsqueda** (hay un término de búsqueda activo): un mensaje que indica que no se encontraron coincidencias y una acción para **limpiar la búsqueda**.
- **Sin resultados de filtro** (hay filtros de contenido activos — tipo, categoría, cuenta, moneda o rango de monto): un mensaje que indica que ningún movimiento cumple los filtros y una acción para **limpiar los filtros**.

La **navegación por mes** NO cuenta como filtro de contenido para esta clasificación (es una ventana temporal, no un filtro): un mes sin movimientos y sin otros filtros SHALL mostrar la variante "sin movimientos" en la sub-variante contextual del mes. El resto —tipo, categoría, cuenta, moneda y rango de monto— SÍ cuenta como filtro. Cuando coexisten búsqueda y filtros, prevalece la variante de **filtro**. Las acciones de limpiar SHALL operar sobre el **estado interno de filtros** (React state, no URL), coherente con la barra de filtros.

#### Scenario: Primera vez del usuario muestra bienvenida

- **WHEN** el usuario abre `/transactions` por primera vez (sin ningún movimiento registrado en ningún mes) sin búsqueda ni filtros activos
- **THEN** el sistema muestra un estado de bienvenida con copy "Acá va a aparecer cada peso que se mueva"
- **AND** la acción abre el drawer de alta de movimiento (o `/transactions/new` como fallback)

#### Scenario: Mes vacío con historial previo muestra copy contextual

- **WHEN** el usuario tiene movimientos registrados en otros meses pero navegó a un mes vacío y no tiene filtros activos
- **THEN** el sistema muestra copy contextual "No registraste nada en {mes} todavía"
- **AND** la acción abre el drawer de alta de movimiento
- **AND** la copy NO tiene tono de bienvenida (no es la primera vez)

#### Scenario: Búsqueda sin resultados ofrece limpiar la búsqueda

- **WHEN** el usuario tiene un término de búsqueda activo y ninguno de sus movimientos coincide
- **THEN** el sistema indica que no se encontraron resultados para ese término
- **AND** ofrece una acción para limpiar la búsqueda
- **AND** la acción de limpiar opera sobre el estado interno

#### Scenario: Filtros sin resultados ofrecen limpiar los filtros

- **WHEN** el usuario tiene filtros de contenido activos (tipo, categoría, cuenta, moneda o rango de monto) y ningún movimiento los cumple
- **THEN** el sistema indica que ningún movimiento cumple los filtros
- **AND** ofrece una acción para limpiar los filtros
- **AND** la acción de limpiar opera sobre el estado interno

#### Scenario: Un mes vacío no se confunde con un filtro sin resultados

- **WHEN** el usuario navega a un mes sin movimientos y no tiene filtros de contenido activos
- **THEN** el sistema muestra la variante "sin movimientos" en su sub-variante contextual del mes (no la de filtros)
