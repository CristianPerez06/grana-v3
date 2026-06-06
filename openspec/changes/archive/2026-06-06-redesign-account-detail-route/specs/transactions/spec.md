## MODIFIED Requirements

### Requirement: El header de /accounts/[id] permanece visible durante carga y error del contenido

`apps/web` SHALL renderizar el chrome de `/accounts/[id]` (back-link a `/accounts` en el layout, y el **hero card de identidad** dentro del shell client: avatar, nombre, badge `Archivada`, balances ARS/USD, acción `Editar`) desde el primer paint, sin estar tapado por un fallback de pantalla completa del layout group. Mientras las queries del hero (account detail) o de las tarjetas pares (movimientos, reembolsos, filtros) están resolviendo o fallan, el chrome SHALL permanecer visible y operable.

El hero card SHALL adoptar la **superficie navy con radial gradient** definida en el spec `accounts` (requirement "El usuario puede ver el detalle de una cuenta"). El back-link a `/accounts` SHALL renderizarse desde el `layout.tsx` (no desde el shell client) para no quedar atado al ciclo de vida del shell ni a los skeletons.

La acción "Editar" del hero card SHALL estar deshabilitada (botón disabled, no clickeable) hasta que la data necesaria para abrir el drawer de edición esté disponible: `account` (con sus monedas e institución) y `institutions` (catálogo). Cuando ambas están listas, el botón SHALL habilitarse. Si alguna falla, el botón MAY caer a su fallback existente (link `<a>` a `/accounts/[id]/edit` como ruta de fallback no-JS) para no quedar bloqueado.

Los balances ARS/USD del hero card SHALL mostrar un skeleton acotado al espacio de los números mientras la query de account detail no resuelve. El nombre y el avatar SHALL mostrarse desde el primer paint con los datos derivables del shell (la cuenta ya está garantizada de existir por el guard server-side; sus datos mínimos pueden hidratarse del initial fetch que hace el shell). El skeleton del hero card SHALL respetar la superficie navy (no `bg-muted` claro sobre fondo navy).

#### Scenario: Back-link y hero card visibles mientras el contenido carga

- **WHEN** el usuario navega a `/accounts/[id]` y las queries de la ruta aún están pendientes
- **THEN** el back-link a `/accounts` está visible desde el layout
- **AND** el hero card está montado sobre superficie navy con su skeleton interno (avatar + 2 líneas de título + balances)
- **AND** los balances ARS/USD muestran un skeleton
- **AND** el botón "Editar" está visualmente disabled (no clickeable) o cae a su link `<a>` de fallback
- **AND** cada tarjeta debajo del hero (reembolsos, movimientos) muestra su propio skeleton-card in-place

#### Scenario: El botón "Editar" se habilita cuando el drawer está listo

- **WHEN** las queries de `account` e `institutions` resolvieron correctamente
- **THEN** el botón "Editar" se habilita
- **AND** clickearlo abre el drawer de edición de la cuenta

#### Scenario: Fallo de las queries del header no tapa el resto del shell

- **WHEN** la query de `account` falla
- **THEN** el área de balances del hero card muestra un mensaje de error o se mantiene vacía con feedback al usuario
- **AND** el back-link a `/accounts`, el nombre (si se hidrató) y las tarjetas de movimientos siguen renderizándose normalmente
- **AND** el `(app)/error.tsx` de segment-level NO se monta

#### Scenario: Un error en una sección del contenido no tapa el hero

- **WHEN** la query de movimientos de la cuenta falla
- **THEN** la tarjeta de movimientos muestra un mensaje de error con retry
- **AND** el hero card permanece visible y operativo
- **AND** la tarjeta de reembolsos pendientes (si tiene su propia query) sigue mostrándose

## ADDED Requirements

### Requirement: Los primitivos visuales de ledger (MovementFilters, MovementList, MovementRow) comparten un lenguaje visual único en todas las rutas

Los componentes compartidos `MovementFilters`, `MovementList`, `MovementRow` y `PendingReimbursementsBlock` (`apps/web/lib/transactions/components/`) SHALL renderizarse con el mismo lenguaje visual en las tres rutas que los consumen: `/accounts/[id]`, `/transactions`, `/cards/[id]`. El lenguaje SHALL ser el definido en `docs/design/accounts-detail/components/`:

- **`MovementRow`**: grid de 3 columnas en desktop `minmax(0, 1fr) 126px 126px` (icono + título/categoría / monto / running balance) y 2 columnas en mobile `1fr 112px` (running balance se oculta debajo de 760px). Border-bottom suave entre filas, última sin border. Tipografía: título 13px font-semibold, meta 12px muted, monto tabular-nums con `text-expense` / `text-income` / `text-pending` / `text-neutral-amount` según corresponda.
- **`MovementList`**: agrupación por día con headers (`Hoy`, `Ayer`, fecha formateada). La running balance per-row SHALL respetar `hasContentFilters` (se oculta cuando hay filtros de contenido activos), comportamiento existente preservado.
- **`MovementFilters`**: barra compacta con navegación de mes (‹ ›), íconos compactos para búsqueda / recurrencia / filtros, y los chips de filtros activos debajo. Border y radius alineados al lenguaje de cards par.
- **`PendingReimbursementsBlock`**: header con título y badge de conteo (`X pendiente`), lista con items expandidos mostrando los campos `Monto real` / `Fecha real` + botones `Confirmar` / `Cancelar` en línea. Superficie de tarjeta blanca cuando se renderiza dentro de `/accounts/[id]`.

Los wrappers que envuelven estos primitivos (la `Tarjeta de movimientos` en `/accounts/[id]`, el `PageHeader` + `MovementListContainer` en `/transactions`, el `PeriodMovementsPane` en `/cards/[id]`) son responsables de su propio chrome (encabezado de sección, CTA primaria, navegación). Los primitivos NO SHALL imponer un wrapper visual; el lenguaje vive en row + lista + filtros, no en el contenedor.

Los comportamientos de los primitivos (filtering, running balance, empty states `none` / `filter` / `search`, drawer wiring, paginación, recurrence indicators) SHALL mantenerse inalterados respecto al estado previo. Esta requirement es exclusivamente sobre el contrato visual.

#### Scenario: `/transactions` y `/cards/[id]` heredan el nuevo lenguaje visual sin cambios de comportamiento

- **WHEN** el usuario navega a `/transactions` o a `/cards/[id]` después del rediseño
- **THEN** las filas de movimiento, la lista, y la barra de filtros se renderizan con el mismo lenguaje visual que en `/accounts/[id]`
- **AND** el filtrado, la paginación y el running balance siguen comportándose como antes

#### Scenario: La running balance se oculta debajo de 760px

- **WHEN** la viewport es menor a 760px
- **THEN** cada `MovementRow` renderiza solo el grid de 2 columnas (1fr + 112px)
- **AND** la columna de running balance no se muestra

#### Scenario: Los wrappers de cada ruta proveen su propio chrome de sección

- **WHEN** `MovementList` se renderiza dentro de la `Tarjeta de movimientos` en `/accounts/[id]`
- **THEN** el encabezado de sección (`Movimientos`) y la CTA (`+ Agregar transacción`) viven en el wrapper de la tarjeta, no dentro del primitivo
- **AND** el primitivo solo renderiza la lista de filas agrupadas por día

### Requirement: El hero card de /accounts/[id] usa una superficie navy con radial gradient compuesto por tokens

El **hero card de identidad** de `/accounts/[id]` SHALL renderizar su superficie de fondo como un **radial gradient** compuesto a partir de tres tokens nuevos en `@grana/ui-tokens`:

- `--hero-navy-from`: color inicial del gradient (origin).
- `--hero-navy-to`: color final del gradient (background base).
- `--hero-navy-origin`: posición del centro del radial (`x% y%`).

Los tokens SHALL vivir en `packages/ui-tokens/src/theme.css`. La web SHALL exponer una utility `.bg-hero-navy` que compone los tokens en una declaración `background-color: var(--hero-navy-to); background-image: radial-gradient(circle at var(--hero-navy-origin), var(--hero-navy-from), transparent 60%);`.

El gradient NO SHALL ser autoría inline (`bg-[radial-gradient(...)]`) ni codificado como un único token de string CSS. La forma "partes" (tres tokens separados) SHALL ser la canónica, para que el mirror de mobile vía codegen pueda exponer cada parte como una constante TypeScript y que el componente nativo equivalente (p.ej. `expo-linear-gradient` o un radial wrapper) consuma los stops sin parsear strings CSS.

Los valores concretos de los tres tokens SHALL alinearse a las referencias en `docs/design/accounts-detail/shared.css` (navy de fondo + emerald suave como origin), respetando la regla del repo de no copiar hexes desde la mock: los tokens SHALL referenciar `--navy`, `--emerald-soft` (o variantes existentes en `theme.css`) cuando sea posible, en vez de introducir colores nuevos.

#### Scenario: La superficie del hero card se compone de tres tokens

- **WHEN** la web renderiza el hero card de `/accounts/[id]`
- **THEN** su clase `.bg-hero-navy` resuelve a `background-color: var(--hero-navy-to)` + `background-image: radial-gradient(circle at var(--hero-navy-origin), var(--hero-navy-from), transparent 60%)`
- **AND** los tres tokens están definidos en `packages/ui-tokens/src/theme.css`

#### Scenario: El gradient no se autoriza como string CSS único

- **WHEN** el equipo busca el token del gradient en `theme.css`
- **THEN** no existe ningún token de la forma `--gradient-hero-navy: radial-gradient(...)`
- **AND** existen `--hero-navy-from`, `--hero-navy-to`, `--hero-navy-origin` por separado

#### Scenario: El badge "Archivada" usa una paleta apta para superficie navy

- **WHEN** el hero card renderiza el badge `Archivada` para una cuenta con `is_active=false`
- **THEN** el background y el color del chip provienen de tokens que contrastan sobre superficie navy (p.ej. `bg-navy-soft` + `text-emerald` o un par equivalente)
- **AND** no se usa `bg-yellow-100 text-yellow-800` (paleta de superficie clara)
