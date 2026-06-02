## MODIFIED Requirements

### Requirement: Una ruta de apps/web puede optar por loading y error in-page para mantener su chrome visible

`apps/web` SHALL soportar un patrón alternativo al `loading.tsx` / `error.tsx` de segmento donde el loading y el error del contenido se montan **in-page** y el chrome de la ruta (header, hero, navegación interna u otros elementos primarios) permanece visible durante esos estados, en lugar de quedar tapado por un fallback de pantalla completa. Cada ruta MAY elegir entre este patrón in-page y el patrón segment-level estándar según sus necesidades.

Toda ruta que opta por el patrón in-page SHALL satisfacer los siguientes requisitos:

1. El chrome de la ruta SHALL ser visible desde el primer paint.
2. El loading del contenido SHALL renderizarse in-place (acotado al área del contenido), no como fallback de pantalla completa.
3. El error del contenido SHALL renderizarse in-place vía `<RouteError onRetry={...} />`, no escalar al `error.tsx` del layout group.
4. Si la ruta tiene una acción primaria en el header cuya ejecución depende de data aún en carga, esa acción SHALL estar disabled (o degraded con feedback claro de la indisponibilidad) hasta que la data esté lista.

La mecánica concreta de cómo se monta el in-page loading/error SHALL depender de la naturaleza de la ruta:

**Variante (a) — RSC streaming**: para rutas read-only que componen secciones sin estado interactivo de cliente (ej. `/dashboard`, `/accounts`), el patrón canónico es:

1. `page.tsx` devuelve un shell sync que monta el chrome más un componente "content" wrapper.
2. El wrapper de contenido envuelve al async server component que hace el fetch en `<Suspense fallback={<RouteLoading />}>` (o `<SectionFallback>` por sección) para cubrir el loading.
3. El wrapper envuelve además al Suspense en un Client Component error boundary (mini `Component` con `getDerivedStateFromError`) que renderiza `<RouteError error={…} onRetry={…} />` cuando el server component throw-ea. El `onRetry` SHALL resetear el state del boundary para reintentar el render.
4. La ruta SHALL seguir cubierta por el `error.tsx` del layout group para errores que ocurran fuera del wrapper (por ejemplo, durante el render del propio chrome o del shell).

**Variante (b) — client + TanStack Query**: para rutas con estado interactivo significativo del cliente (filtros, búsqueda, navegación interna que no pasa por router) — ej. `/transactions` — el patrón es:

1. `page.tsx` devuelve un shell sync que monta un `<QueryClientProvider>` y un shell client (`<TransactionsShell>` o equivalente).
2. El shell client renderiza el header desde el primer paint (siempre visible).
3. Cada sección de contenido es un client component con su propio `useQuery`. El componente muestra su propio skeleton mientras `isPending` y su propio mensaje de error con retry cuando `error` (típicamente reutilizando `<RouteError onRetry={() => refetch()} />`).
4. La acción primaria del header SHALL gating-ear su disabled state contra el `isPending` agregado de las queries necesarias para que la acción funcione (ej. el botón "Registrar" del header de `/transactions` espera a que estén listas `accounts`, `categories`, `household`).
5. La ruta SHALL seguir cubierta por el `error.tsx` del layout group para errores que ocurran fuera de las queries (errores de render del shell, etc.).

Esta variante NO reemplaza al requirement de que cada layout group tenga `loading.tsx` y `error.tsx`; los reemplaza **solo para esa ruta** en lo que respecta al loading/error del contenido.

Los primeros casos de uso son:

- `apps/web/app/(app)/dashboard/` y `apps/web/app/(app)/accounts/`, que usan la variante (a) para que el header se vea desde el primer paint y permanezca visible durante el loading y los errores de su contenido.
- `apps/web/app/(app)/transactions/`, que usa la variante (b) por su naturaleza interactiva: filtros, búsqueda, navegación por mes, currency toggle, modo egresos/ingresos, drill-down de subcategoría. Mover esa interactividad fuera del URL-state es la motivación principal de la variante (b); ver spec `transactions` para los requirements específicos.

#### Scenario: El dashboard mantiene el header durante el loading del contenido

- **WHEN** un usuario navega a `/dashboard` y el fetch server-side del contenido aún no resolvió
- **THEN** el header del dashboard ya está visible
- **AND** el área del contenido muestra `<RouteLoading />` o `<SectionFallback>` por sección (`<Spinner size="lg" />` centrado, o skeleton acotado)
- **AND** el `(app)/loading.tsx` de segment-level NO tapa el header

#### Scenario: El dashboard mantiene el header durante un error del contenido

- **WHEN** el server component que renderiza el contenido del dashboard throw-ea durante el render
- **THEN** el client error boundary in-page captura el throw
- **AND** el área del contenido muestra `<RouteError error={…} onRetry={…} />`
- **AND** el header del dashboard sigue visible y funcional
- **AND** el `(app)/error.tsx` de segment-level NO se monta (porque el error fue capturado adentro)

#### Scenario: Reintentar desde el error boundary in-page vuelve a renderizar el contenido

- **WHEN** el usuario hace click en "Reintentar" en el `<RouteError>` in-page de la variante (a)
- **THEN** el error boundary resetea su state interno
- **AND** el `<Suspense>` vuelve a intentar el render del contenido
- **AND** el usuario ve `<RouteLoading />` mientras el reintento corre

#### Scenario: Un error fuera del wrapper sigue cayendo en error.tsx del segment

- **WHEN** un error ocurre durante el render del shell de la ruta (no del wrapper de contenido) — por ejemplo, el render del propio header throw-ea
- **THEN** el `error.tsx` del layout group más cercano se monta y reemplaza el segmento completo
- **AND** ese fallback se comporta como cualquier otro `error.tsx` del layout group (regla preexistente)

#### Scenario: /transactions mantiene el header durante el loading de cada sección (variante b)

- **WHEN** un usuario navega a `/transactions` y las queries de las secciones aún están pendientes
- **THEN** el header de `/transactions` con título y botón "Registrar movimiento" ya está visible
- **AND** cada sección debajo del header muestra su propio skeleton acotado al espacio que ocupa, sin tapar el header

#### Scenario: /transactions habilita el botón cuando las queries del drawer terminan (variante b)

- **WHEN** las queries de `accounts`, `categories` y `household` resolvieron (las necesarias para abrir el drawer de creación)
- **THEN** el botón "Registrar movimiento" del header pasa de disabled a enabled
- **AND** clickearlo abre el drawer

#### Scenario: /transactions muestra error in-section y mantiene el resto operativo (variante b)

- **WHEN** la query de una sección de `/transactions` (ej. `PendingReimbursements`) falla
- **THEN** esa sección muestra `<RouteError>` con un botón "Reintentar" que llama al `refetch()` de su query
- **AND** el header sigue visible
- **AND** las otras secciones siguen visibles y operativas
- **AND** el `(app)/error.tsx` de segment-level NO se monta
