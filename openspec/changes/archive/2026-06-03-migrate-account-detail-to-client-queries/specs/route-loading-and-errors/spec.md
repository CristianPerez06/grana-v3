## MODIFIED Requirements

### Requirement: Una ruta de apps/web puede optar por loading y error in-page para mantener su chrome visible

`apps/web` MAY, para una ruta específica donde se justifique, reemplazar el patrón estándar de `loading.tsx` / `error.tsx` a nivel de segmento por **loading y error montados in-page**, usando `<Suspense fallback={<RouteLoading />}>` y un Client Component error boundary co-localizado, **o** usando un shell cliente con TanStack Query donde cada sección entrega su propio loading/error in-place. Esta alternativa SHALL usarse únicamente cuando la ruta necesita mantener visible su chrome (header, hero, navegación interna u otros elementos primarios) durante los estados de carga y error del contenido, en vez de tapar todo el segmento con un fallback de pantalla completa.

Cuando una ruta adopta este patrón con **server components + Suspense**:

1. Su `page.tsx` SHALL devolver un shell sync que monta el chrome más un componente "content" wrapper.
2. El wrapper de contenido SHALL envolver al async server component que hace el fetch en `<Suspense fallback={<RouteLoading />}>` para cubrir el loading.
3. El wrapper SHALL envolver además al Suspense en un Client Component error boundary (mini `Component` con `getDerivedStateFromError`) que renderiza `<RouteError error={…} onRetry={…} />` cuando el server component throw-ea. El `onRetry` SHALL resetear el state del boundary para reintentar el render.
4. La ruta SHALL seguir cubierta por el `error.tsx` del layout group para errores que ocurran fuera del wrapper (por ejemplo, durante el render del propio chrome o del shell).

Cuando una ruta adopta este patrón con **shell cliente + TanStack Query** (modelo aplicado en `/transactions` y `/accounts/[id]`):

1. Su `page.tsx` SHALL devolver un shell server mínimo que cubra solo los guards terminales (auth, redirects, `notFound()` por recurso inexistente) y monte un componente client (`<RouteShell />`) con las props mínimas para identificar el contexto (ej. `accountId`).
2. El shell client SHALL alojar el `QueryClientProvider` (o consumir uno provisto por un layout ancestor) y los providers de estado interno (contexto de filtros, drawers, etc.).
3. Cada sección SHALL ser un componente client que ejecuta su propio `useQuery` (o `useQueries`) y renderiza inline su loading state (skeleton acotado al espacio de la sección) y su error state (mensaje + retry localizado).
4. La acción primaria del header (botón de creación/edición que abre un drawer) SHALL estar **disabled** mientras la data necesaria para abrir el drawer no esté lista, y habilitarse cuando lo está.
5. La ruta SHALL seguir cubierta por el `error.tsx` del layout group para errores que ocurran fuera de las queries (por ejemplo, durante el render del propio shell client).

Esta variante NO reemplaza al requirement de que cada layout group tenga `loading.tsx` y `error.tsx`; los reemplaza **solo para esa ruta** en lo que respecta al loading/error del contenido.

**Casos de uso aprobados:**

- `apps/web/app/(app)/dashboard/`: server components + Suspense (header visible desde el primer paint; el contenido del dashboard se cubre con `<Suspense>`).
- `apps/web/app/(app)/transactions/`: shell cliente + TanStack Query (reference implementation del patrón cliente; header con `RegisterMovementButton` gated por queries de drawer-ready).
- `apps/web/app/(app)/accounts/`: server components + Suspense para la lista (header con botón "+ Nueva cuenta" gated por institutions; secciones active/archived como containers async aislados).
- `apps/web/app/(app)/accounts/[id]/`: shell cliente + TanStack Query (header de detalle con back link + avatar + balances con skeleton + botón "Editar" gated; secciones de filtros, lista de movimientos y reembolsos pendientes como componentes client independientes).

Otras rutas (ej. `/cards/[id]`) MAY adoptar cualquiera de las dos variantes cuando se justifique, o seguir con el patrón estándar de `loading.tsx`/`error.tsx` de segmento.

#### Scenario: El dashboard mantiene el header durante el loading del contenido

- **WHEN** un usuario navega a `/dashboard` y el fetch server-side del contenido aún no resolvió
- **THEN** el header del dashboard ya está visible
- **AND** el área del contenido muestra `<RouteLoading />` (`<Spinner size="lg" />` centrado)
- **AND** el `(app)/loading.tsx` de segment-level NO tapa el header

#### Scenario: El dashboard mantiene el header durante un error del contenido

- **WHEN** el server component que renderiza el contenido del dashboard throw-ea durante el render
- **THEN** el client error boundary in-page captura el throw
- **AND** el área del contenido muestra `<RouteError error={…} onRetry={…} />`
- **AND** el header del dashboard sigue visible y funcional
- **AND** el `(app)/error.tsx` de segment-level NO se monta (porque el error fue capturado adentro)

#### Scenario: Reintentar desde el error boundary in-page vuelve a renderizar el contenido

- **WHEN** el usuario hace click en "Reintentar" en el `<RouteError>` in-page
- **THEN** el error boundary resetea su state interno
- **AND** el `<Suspense>` vuelve a intentar el render del contenido
- **AND** el usuario ve `<RouteLoading />` mientras el reintento corre

#### Scenario: Un error fuera del wrapper sigue cayendo en error.tsx del segment

- **WHEN** un error ocurre durante el render del shell de la ruta (no del wrapper de contenido) — por ejemplo, el render del propio header throw-ea
- **THEN** el `error.tsx` del layout group más cercano se monta y reemplaza el segmento completo
- **AND** ese fallback se comporta como cualquier otro `error.tsx` del layout group (regla preexistente)

#### Scenario: /accounts/[id] mantiene el header durante el loading de las secciones

- **WHEN** un usuario navega a `/accounts/[id]` y las queries del shell cliente (account detail, movimientos, filter options, reembolsos) aún no resolvieron
- **THEN** el back link, el nombre de la cuenta y el avatar ya están visibles desde el primer paint
- **AND** los balances del header muestran un skeleton
- **AND** cada sección debajo del header muestra su propio skeleton in-place
- **AND** el `(app)/loading.tsx` de segment-level NO tapa el shell

#### Scenario: /accounts/[id] mantiene el chrome durante un error en una sección

- **WHEN** la query de movimientos de `/accounts/[id]` falla
- **THEN** la sección de la lista muestra su error + retry inline
- **AND** el header sigue visible y operativo
- **AND** la sección de reembolsos pendientes sigue mostrándose normalmente
- **AND** el `(app)/error.tsx` de segment-level NO se monta

#### Scenario: /accounts/[id] redirige terminalmente server-side antes de montar el shell

- **WHEN** un usuario entra a `/accounts/[id]` y la cuenta tiene `type='credit'`
- **THEN** el guard server-side ejecuta `redirect('/cards/[id]')` antes de montar el shell client
- **AND** el usuario nunca ve loading state del shell de account detail
