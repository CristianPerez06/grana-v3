## ADDED Requirements

### Requirement: El header de /accounts/[id] permanece visible durante carga y error del contenido

`apps/web` SHALL renderizar el header de `/accounts/[id]` (back link a `/accounts`, avatar de cuenta, nombre, badges de estado, balances ARS/USD, acciones edit/archive/reactivate/delete) desde el primer paint, sin estar tapado por un fallback de pantalla completa del layout group. Mientras las queries del header (account detail) o de las secciones (movimientos, reembolsos, filtros) están resolviendo o fallan, el chrome SHALL permanecer visible y operable.

La acción "Editar" del header SHALL estar deshabilitada (botón disabled, no clickeable) hasta que la data necesaria para abrir el drawer de edición esté disponible: `account` (con sus monedas e institución) y `institutions` (catálogo). Cuando ambas están listas, el botón SHALL habilitarse. Si alguna falla, el botón MAY caer a su fallback existente (link `<a>` a `/accounts/[id]/edit` como ruta de fallback no-JS) para no quedar bloqueado.

Los balances ARS/USD del header SHALL mostrar un skeleton acotado al espacio de los números mientras la query de account detail no resuelve. El nombre y el avatar SHALL mostrarse desde el primer paint con los datos derivables del shell (la cuenta ya está garantizada de existir por el guard server-side; sus datos mínimos pueden hidratarse del initial fetch que hace el shell).

#### Scenario: Header visible mientras el contenido carga

- **WHEN** el usuario navega a `/accounts/[id]` y las queries de la ruta aún están pendientes
- **THEN** el back link, el nombre de la cuenta y el avatar ya están visibles
- **AND** los balances ARS/USD muestran un skeleton
- **AND** el botón "Editar" está visualmente disabled (no clickeable) o cae a su link `<a>` de fallback
- **AND** cada sección debajo del header (reembolsos, filtros, lista) muestra su propio estado de carga in-place

#### Scenario: El botón "Editar" se habilita cuando el drawer está listo

- **WHEN** las queries de `account` e `institutions` resolvieron correctamente
- **THEN** el botón "Editar" se habilita
- **AND** clickearlo abre el drawer de edición de la cuenta

#### Scenario: Fallo de las queries del header no tapa el resto del shell

- **WHEN** la query de `account` falla
- **THEN** el área de balances muestra un mensaje de error o se mantiene vacía con feedback al usuario
- **AND** el back link, el nombre (si se hidrató) y las secciones de movimientos siguen renderizándose normalmente
- **AND** el `(app)/error.tsx` de segment-level NO se monta

#### Scenario: Un error en una sección del contenido no tapa el header

- **WHEN** la query de movimientos de la cuenta falla
- **THEN** la sección de la lista muestra un mensaje de error con retry
- **AND** el header permanece visible y operativo
- **AND** la sección de reembolsos pendientes (si tiene su propia query) sigue mostrándose

---

### Requirement: El estado de filtros y navegación de /accounts/[id] vive en React state, no en URL

`apps/web` SHALL mantener el estado interactivo de `/accounts/[id]` (filtros de tipo, categoría, subcategoría, currency, búsqueda, rango de monto, navegación por mes, paginación) en React state interno de la ruta, no en query strings de la URL.

La URL de `/accounts/[id]` NO SHALL aceptar ni interpretar query parameters relacionados con filtros, navegación o paginación. La URL canónica de la ruta es `/accounts/[id]` sin parámetros.

Recargar la página (F5) SHALL resetear todos los filtros al valor por defecto (mes actual según `getTodayAR()`, sin filtros adicionales, sin búsqueda, sin currency forzado). Este es el comportamiento intencional, coherente con `/transactions`.

El **filtro de cuenta** (`accountId`) NO SHALL exponerse en la barra de filtros — está implícito en la ruta (`accountId === params.id`). El componente `MovementFilters` SHALL renderizarse con `showAccountFilter={false}` y la query subyacente SHALL inyectar el `accountId` desde el shell.

Cualquier acción de "limpiar filtros" o "limpiar búsqueda" SHALL operar sobre este estado, no sobre la URL.

#### Scenario: Cambiar de mes no toca la URL

- **WHEN** el usuario está en `/accounts/[id]` y clickea "mes siguiente"
- **THEN** el contenido se actualiza para mostrar el mes siguiente
- **AND** la URL en la barra del browser sigue siendo `/accounts/[id]` (sin query params)
- **AND** la historia del browser NO recibe una nueva entrada

#### Scenario: F5 limpia todos los filtros

- **WHEN** el usuario está en `/accounts/[id]` con filtros aplicados (ej. categoría X, búsqueda "café")
- **AND** recarga la página (F5)
- **THEN** la pantalla vuelve al estado por defecto: mes actual, sin filtros ni búsqueda

#### Scenario: La URL canónica no acepta query params

- **WHEN** el usuario entra a `/accounts/[id]?month=2026-03` (ej. desde un bookmark antiguo)
- **THEN** la ruta carga normalmente en el estado por defecto
- **AND** los query params son ignorados

#### Scenario: La barra de filtros no muestra el chip de cuenta

- **WHEN** el usuario abre `/accounts/[id]`
- **THEN** la barra de filtros no incluye el control de selección de cuenta (porque el contexto de la ruta ya implica esa cuenta)
- **AND** el resto de los filtros (tipo, categoría, subcategoría, currency, búsqueda, rango de monto) están disponibles normalmente

#### Scenario: Acción "Limpiar filtros" opera sobre state, no URL

- **WHEN** el usuario tiene filtros activos y clickea "Limpiar filtros"
- **THEN** los filtros vuelven a su default
- **AND** el contenido se reconsulta con los filtros limpios
- **AND** la URL no cambia

---

### Requirement: Cada sección de /accounts/[id] fetchea independientemente y entrega su propio loading/error

`apps/web` SHALL renderizar las secciones de `/accounts/[id]` (`AccountDetailHeader`, `PendingReimbursementsBlock`, `MovementFilters`, `MovementList`) como componentes client que fetchean independientemente vía TanStack Query. Cada sección SHALL exhibir su propio estado de loading (skeleton acotado al espacio que ocupa) y su propio estado de error (mensaje + retry localizados a la sección), sin bloquear el render de las demás.

NO SHALL haber un fetch monolítico server-side que awaitee múltiples queries antes del primer render. Cada `useQuery` se ejecuta tan pronto el componente se monta y muestra resultado en cuanto resuelve.

El `page.tsx` server-side se reserva exclusivamente para los guards terminales: auth (`redirect('/login')` si no hay sesión), `notFound()` si la cuenta no existe o no pertenece al usuario, y `redirect('/cards/[id]')` si la cuenta es `type='credit'`. Estos guards SHALL correr server-side antes de montar el shell, porque son decisiones que no aplican loading/skeleton — la ruta no debe existir.

#### Scenario: Una sección lenta no bloquea las rápidas

- **WHEN** `getAccountMovements` tarda 2s mientras `getPendingReimbursements` resuelve en 100ms
- **THEN** la sección de reembolsos pendientes aparece poblada a los 100ms
- **AND** la sección de la lista muestra su skeleton hasta los 2s
- **AND** ambas son visibles simultáneamente en la pantalla

#### Scenario: Una sección que falla no derrumba el resto

- **WHEN** `getPendingReimbursements` falla con error
- **THEN** la sección de reembolsos pendientes muestra su mensaje de error con un botón "Reintentar"
- **AND** las otras secciones siguen visibles y operativas
- **AND** el header sigue visible y operativo

#### Scenario: Cuenta inexistente cae en notFound server-side

- **WHEN** el usuario intenta acceder a `/accounts/[id-inexistente]`
- **THEN** el `page.tsx` resuelve `getAccountDetail` server-side y, al no encontrar fila (RLS o `id` no válido), llama `notFound()`
- **AND** se renderiza el `not-found.tsx` del segment, no el shell client

#### Scenario: Cuenta de tipo credit redirige server-side a /cards/[id]

- **WHEN** el usuario entra a `/accounts/[id]` y la cuenta tiene `type='credit'`
- **THEN** el `page.tsx` ejecuta `redirect('/cards/[id]')` antes de montar el shell client
- **AND** el usuario nunca ve un loading state del shell de account detail

---

## MODIFIED Requirements

### Requirement: El listado de una cuenta muestra el saldo corriente por fila

En la perspectiva de cuenta, el sistema SHALL mostrar junto a cada fila el saldo corriente (running balance) de la cuenta resultante después de ese movimiento, calculado por moneda. El saldo corriente SHALL derivarse del historial de transacciones; NO SHALL persistirse en ninguna columna.

El saldo corriente SHALL mostrarse cuando se ven los movimientos de la cuenta en orden, **incluida la navegación por mes**: navegar de mes es navegación temporal, no un filtro de contenido, y el saldo se recalcula sobre el historial previo al mes visible. Los **filtros de contenido** (búsqueda de texto, tipo, categoría, subcategoría, rango de monto) SÍ ocultan el saldo corriente, porque saltean filas y un acumulado parcial sería incorrecto. En la perspectiva global el saldo corriente NO SHALL mostrarse (mezclaría cuentas y monedas).

Esta regla es independiente del modelo de estado de los filtros (URL, React state, etc.) — depende exclusivamente de qué filtros están activos al momento de renderizar la lista. Cuando `/accounts/[id]` está implementado como shell client con TanStack Query, el cómputo del running balance SHALL ejecutarse client-side a partir del historial ascendente completo de la cuenta (obtenido como query separada o como parte de la página de movimientos), aplicando `computeRunningBalances` del paquete `@grana/money-logic`.

#### Scenario: Cada fila muestra el saldo resultante por moneda

- **WHEN** el usuario abre el detalle de una cuenta sin filtros de contenido
- **THEN** cada fila muestra el saldo de la cuenta en la moneda del movimiento, resultante después de ese movimiento

#### Scenario: Navegar por mes no oculta el saldo corriente

- **WHEN** el usuario navega a otro mes en el detalle de la cuenta (sin filtros de contenido)
- **THEN** el saldo corriente se sigue mostrando, recalculado con el historial previo al mes visible

#### Scenario: Los filtros de contenido ocultan el saldo corriente

- **WHEN** el usuario aplica un filtro de tipo, categoría, subcategoría, búsqueda de texto o rango de monto en el detalle de la cuenta
- **THEN** el saldo corriente por fila se oculta

#### Scenario: El listado global no muestra saldo corriente

- **WHEN** el usuario abre `/transactions`
- **THEN** las filas no muestran saldo corriente

#### Scenario: Cómputo client-side preserva el resultado

- **WHEN** el shell client de `/accounts/[id]` calcula el running balance con `computeRunningBalances` sobre el historial ascendente devuelto por la query
- **THEN** los saldos por fila coinciden numéricamente con los que producía el cálculo server-side previo (mismas reglas: incluye ingresos, gastos, transferencias salientes/entrantes, ajustes; excluye `is_parent=true` y transacciones de tarjeta `expense` con `status='pending'`)
