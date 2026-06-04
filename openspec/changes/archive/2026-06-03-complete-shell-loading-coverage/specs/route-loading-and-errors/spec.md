## MODIFIED Requirements

### Requirement: Una ruta de apps/web puede optar por loading y error in-page para mantener su chrome visible

`apps/web` MAY, para una ruta específica donde se justifique, reemplazar el patrón estándar de `loading.tsx` / `error.tsx` a nivel de layout group por **una de las tres variantes de in-page chrome** que mantienen visible el chrome (header, hero, navegación interna u otros elementos primarios) durante los estados de carga y error del contenido. Estas variantes SHALL usarse únicamente cuando la ruta necesita mantener visible su chrome durante esos estados, en vez de tapar todo el segmento con un fallback de pantalla completa.

#### Variant A: server components + Suspense in-page

Cuando una ruta adopta este patrón:

1. Su `page.tsx` SHALL devolver un shell sync que monta el chrome más un componente "content" wrapper.
2. El wrapper de contenido SHALL envolver al async server component que hace el fetch en `<Suspense fallback={<RouteLoading />}>` para cubrir el loading.
3. El wrapper SHALL envolver además al Suspense en un Client Component error boundary (mini `Component` con `getDerivedStateFromError`) que renderiza `<RouteError error={…} onRetry={…} />` cuando el server component throw-ea. El `onRetry` SHALL resetear el state del boundary para reintentar el render.
4. La ruta SHALL seguir cubierta por el `error.tsx` del layout group para errores que ocurran fuera del wrapper (por ejemplo, durante el render del propio chrome o del shell).

**Estado (actualizado por `complete-shell-loading-coverage`):** Variant A se mantiene documentada por completitud histórica. Para rutas nuevas SHOULD adoptarse Variant C salvo que exista una razón concreta documentada para no usar `<ruta>/layout.tsx` (ej.: la ruta no necesita chrome persistente entre navegaciones internas y los archivos extra no se justifican). Tras este change, ningún caso aprobado usa Variant A; las rutas que la usaban (`/accounts`) fueron migradas a Variant C.

#### Variant B: shell cliente + TanStack Query

Cuando una ruta adopta este patrón (modelo aplicado en `/accounts/[id]`):

1. Su `page.tsx` SHALL devolver un shell server mínimo que cubra solo los guards terminales (auth, redirects, `notFound()` por recurso inexistente) y monte un componente client (`<RouteShell />`) con las props mínimas para identificar el contexto (ej. `accountId`).
2. El shell client SHALL alojar el `QueryClientProvider` (o consumir uno provisto por un layout ancestor) y los providers de estado interno (contexto de filtros, drawers, etc.).
3. Cada sección SHALL ser un componente client que ejecuta su propio `useQuery` (o `useQueries`) y renderiza inline su loading state (skeleton acotado al espacio de la sección) y su error state (mensaje + retry localizado).
4. La acción primaria del header (botón de creación/edición que abre un drawer) SHALL estar **disabled** mientras la data necesaria para abrir el drawer no esté lista, y habilitarse cuando lo está.
5. La ruta SHALL seguir cubierta por el `error.tsx` del layout group para errores que ocurran fuera de las queries (por ejemplo, durante el render del propio shell client).

#### Variant C: chrome en `<ruta>/layout.tsx` + skeletons en `<ruta>/loading.tsx`

Cuando una ruta adopta este patrón:

1. La ruta SHALL definir un `<ruta>/layout.tsx` (server component, async si necesita fetch server-side propio) que renderiza el chrome de la ruta (header, providers de estado scopeados a la ruta) y devuelve `{children}` envuelto por ese chrome. El chrome SHALL ser persistente entre navegaciones internas a la ruta.
2. La ruta SHALL definir un `<ruta>/loading.tsx` que renderiza los skeletons shape-matched del contenido principal de la ruta (no un spinner genérico). El loading.tsx actúa como fallback del `{children}` del layout.
3. Su `page.tsx` SHALL ser un Server Component **sync** (sin `async`) o, si necesita awaits, los SHALL hacer dentro de un `<Suspense>` boundary explícito; en ningún caso SHALL hacer awaits top-level que requieran I/O bloqueante, porque eso suspendería el segmento entero y dispararía el `loading.tsx` (lo cual sigue siendo correcto, pero anula la diferencia de variantes — la elección entre A/C es estética en ese caso).
4. Cualquier dato server-side que el chrome necesite (ej. preferencias del usuario que el provider del header inicializa) SHALL fetcharse en el `layout.tsx`, no en el `page.tsx`.
5. La ruta SHALL seguir cubierta por el `error.tsx` del layout group para errores fuera del page (ej. errores en el render del layout o del chrome). Si la ruta quiere preservar el chrome ante errores del contenido, MAY agregar un `<ruta>/error.tsx` propio; no es obligatorio.

Las tres variantes NO reemplazan al requirement general de cobertura de loading/error (`loading.tsx` y `error.tsx` accesibles); las reemplazan **solo para esa ruta** en lo que respecta al loading/error del contenido. Una ruta SHALL adoptar **exactamente una** de las tres variantes; no SHALL combinarlas para un mismo nivel de chrome.

**Casos de uso aprobados:**

- `apps/web/app/(app)/dashboard/`: **Variant C**. El chrome (saludo, fecha, `eye toggle`, botón "Nuevo movimiento" en desktop) vive en `dashboard/layout.tsx` envuelto por `EyeMaskProvider`. `dashboard/loading.tsx` renderiza los skeletons del contenido (`HeroSkeleton`, `UpcomingFortnightSkeleton`, `MonthBalanceSkeleton`, `CategoryTeaserSkeleton`) con la misma disposición que `DashboardContent`. `page.tsx` es sync y solo retorna `<DashboardContent />` y el FAB. Las secciones internas mantienen su propio `<Suspense>` shape-matched (regla preexistente del spec `dashboard`).
- `apps/web/app/(app)/transactions/`: **Variant C** para el chrome del header. El header del módulo vive en `transactions/layout.tsx`. `transactions/loading.tsx` renderiza skeletons del cuerpo (filtros + lista). El `page.tsx` es sync y monta el `TransactionsShell` client. Internamente, el shell sigue el patrón de Variant B para sus secciones (cada query tiene su loading/error inline). Si un control del header depende del estado del shell (ej. botón gated por queries del drawer), ese control puede permanecer en el shell y el header del layout limitarse al título + acciones estáticas — la decisión específica se documenta en la implementación.
- `apps/web/app/(app)/accounts/`: **Variant C**. El `<AccountsHeader />` (Client Component que fetchea `institutions` con supabase browser) vive en `accounts/layout.tsx`. `accounts/loading.tsx` renderiza los skeletons shape-matched de las dos secciones (active accounts + archived accounts). `page.tsx` queda sync (o async solo para `getTranslations()` si las strings de `<SectionFallback>` de los Suspense internos siguen viviendo en page; ver Decision 3 del design.md de `complete-shell-loading-coverage` para opciones). Internamente, el scaffold de Suspense + containers async aislados con `try/catch` + `AccountsErrorBoundary` se mantiene.
- `apps/web/app/(app)/cards/`: **Variant C**. El `<CardsHeader />` (Client Component que fetchea count + institutions + card_networks) vive en `cards/layout.tsx`. `cards/loading.tsx` renderiza los skeletons shape-matched de las tres secciones (month hero + wallet + archived). `page.tsx` simétrico a accounts. Scaffold de Suspense + containers async aislados + `CardsErrorBoundary` se mantienen.
- `apps/web/app/(app)/accounts/[id]/`: **Variant B** (sin cambios). Shell cliente + TanStack Query.
- `apps/web/app/(app)/shared/(home)/` y sub-rutas `apps/web/app/(app)/shared/{settings,settle,setup}/`: **Variant C** para las cuatro rutas paralelas. Como el header de `/shared` depende del estado (`household.name | t('title')` + SettingsLink condicional) y cada sub-ruta tiene su PageHeader propio con backLink distinto, se usa un **route group** `/shared/(home)/` que aloja layout+page+loading de la home. Los sub-routes (`settings`, `settle`, `setup`) son hermanos del `(home)` group en el filesystem (no descendientes), cada uno con su propio `layout.tsx` async que awaitea `getHousehold` + `getTranslations`, ejecuta sus guards de redirect, y monta su `<PageHeader>` con título + backLink. Sus `loading.tsx` son cuerpo-only (sin `PageHeaderSkeleton` — el header vive en layout y persiste durante la transición). Esta estructura evita la herencia de header que ocurriría con un `/shared/layout.tsx` global y mantiene a cada ruta como un segmento Variant C aislado.

Otras rutas (ej. `/cards/[id]`) MAY adoptar cualquiera de las tres variantes cuando se justifique, o seguir con el patrón estándar de `loading.tsx`/`error.tsx` de layout group.

#### Scenario: El dashboard mantiene el header durante el loading del contenido

- **WHEN** un usuario navega a `/dashboard` y el fetch client-side del contenido aún no resolvió
- **THEN** el header del dashboard ya está visible desde el primer paint (proviene de `dashboard/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched de `dashboard/loading.tsx` mientras el page resuelve
- **AND** no se muestra un spinner full-screen del layout group `(app)`

#### Scenario: El dashboard mantiene el header al navegar entre rutas hermanas del shell

- **WHEN** un usuario está en `/transactions` y navega a `/dashboard`
- **THEN** el chrome del shell `(app)` (sidebar, topbar) permanece visible toda la transición
- **AND** apenas el segmento `dashboard` empieza a renderizar, el `dashboard/layout.tsx` paint-ea el header del dashboard
- **AND** el `dashboard/loading.tsx` cubre el área del contenido mientras `dashboard/page.tsx` resuelve
- **AND** el header NO parpadea ni se reemplaza por un spinner

#### Scenario: El dashboard mantiene el header durante un error del contenido

- **WHEN** un server component que renderiza una sección del dashboard throw-ea durante el render
- **THEN** el `<Suspense>` interno de esa sección entrega su error state local (regla del spec `dashboard`)
- **AND** el header del dashboard sigue visible y funcional (vive en el layout, no en el page)
- **AND** el `(app)/error.tsx` de layout-group level NO se monta (porque el error fue capturado adentro de la sección)

#### Scenario: /transactions mantiene el header durante el loading del contenido

- **WHEN** un usuario navega a `/transactions` y el shell client aún no hidrató sus queries
- **THEN** el header del módulo transactions ya está visible desde el primer paint (proviene de `transactions/layout.tsx`)
- **AND** el área del contenido muestra los skeletons de `transactions/loading.tsx` durante la transición de segmento
- **AND** una vez que el page renderiza, las secciones internas del shell siguen el patrón de Variant B (skeletons inline por sección)
- **AND** no se muestra un spinner full-screen del layout group `(app)`

#### Scenario: /accounts mantiene el header durante el loading del contenido

- **WHEN** un usuario navega a `/accounts` y las queries de active/archived accounts (server-side) aún no resolvieron
- **THEN** el `<AccountsHeader />` ya está visible desde el primer paint (proviene de `accounts/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched de `accounts/loading.tsx` durante la transición de segmento
- **AND** una vez que el page renderiza, las secciones internas mantienen su `<Suspense>` con `<SectionFallback>` por sección (regla preexistente del spec `accounts`)
- **AND** no se muestra un spinner full-screen del layout group `(app)`

#### Scenario: /cards mantiene el header durante el loading del contenido

- **WHEN** un usuario navega a `/cards` y las queries de month hero, wallet, archived (server-side) aún no resolvieron
- **THEN** el `<CardsHeader />` ya está visible desde el primer paint (proviene de `cards/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched de `cards/loading.tsx` durante la transición de segmento
- **AND** una vez que el page renderiza, las secciones internas mantienen su `<Suspense>` con `<SectionFallback>` por sección (regla preexistente del spec `cards`)
- **AND** no se muestra un spinner full-screen del layout group `(app)`

#### Scenario: /shared mantiene el header durante el loading del contenido

- **WHEN** un usuario navega a `/shared` (URL servida por `apps/web/app/(app)/shared/(home)/page.tsx`) y las queries del page (household + debt + expenses + pending settlements + accounts) aún no resolvieron
- **THEN** el `<PageHeader>` del home ya está visible desde el primer paint del segmento (proviene de `shared/(home)/layout.tsx`, que ya resolvió su `getHousehold` para computar el título)
- **AND** el área del contenido muestra los skeletons de `shared/(home)/loading.tsx` (balance card placeholder + lista de gastos recientes placeholder) durante la transición de segmento
- **AND** no se muestra un spinner full-screen del layout group `(app)`

#### Scenario: Cada sub-ruta de /shared mantiene su propio header durante el loading

- **WHEN** un usuario navega a `/shared/settings` (o `/shared/settle`, `/shared/setup`) y el page aún no resolvió su fetch
- **THEN** el `<PageHeader>` específico de esa sub-ruta (título + backLink a `/shared`) ya está visible desde el primer paint del segmento (proviene del `layout.tsx` de la sub-ruta)
- **AND** el área del contenido muestra el skeleton del form de esa sub-ruta (de su `loading.tsx`)
- **AND** el header de `/shared` (de `(home)/layout.tsx`) NO se renderiza encima — las sub-rutas son hermanos del route group `(home)`, no descendientes
- **AND** no se muestra un spinner full-screen del layout group `(app)`

#### Scenario: /accounts/[id] mantiene el header durante el loading de las secciones

- **WHEN** un usuario navega a `/accounts/[id]` y las queries del shell cliente (account detail, movimientos, filter options, reembolsos) aún no resolvieron
- **THEN** el back link, el nombre de la cuenta y el avatar ya están visibles desde el primer paint
- **AND** los balances del header muestran un skeleton
- **AND** cada sección debajo del header muestra su propio skeleton in-place
- **AND** el `(app)/loading.tsx` de layout-group level NO tapa el shell

#### Scenario: /accounts/[id] mantiene el chrome durante un error en una sección

- **WHEN** la query de movimientos de `/accounts/[id]` falla
- **THEN** la sección de la lista muestra su error + retry inline
- **AND** el header sigue visible y operativo
- **AND** la sección de reembolsos pendientes sigue mostrándose normalmente
- **AND** el `(app)/error.tsx` de layout-group level NO se monta

#### Scenario: /accounts/[id] redirige terminalmente server-side antes de montar el shell

- **WHEN** un usuario entra a `/accounts/[id]` y la cuenta tiene `type='credit'`
- **THEN** el guard server-side ejecuta `redirect('/cards/[id]')` antes de montar el shell client
- **AND** el usuario nunca ve loading state del shell de account detail

#### Scenario: Reintentar desde el error boundary in-page vuelve a renderizar el contenido (Variant A)

- **WHEN** una ruta que usa Variant A captura un error en su wrapper de contenido
- **AND** el usuario hace click en "Reintentar" en el `<RouteError>` in-page
- **THEN** el error boundary resetea su state interno
- **AND** el `<Suspense>` vuelve a intentar el render del contenido
- **AND** el usuario ve `<RouteLoading />` mientras el reintento corre

#### Scenario: Un error fuera del wrapper sigue cayendo en error.tsx del layout group

- **WHEN** un error ocurre durante el render del shell de la ruta (no del wrapper de contenido) — por ejemplo, el render del propio header throw-ea
- **THEN** el `error.tsx` del layout group más cercano se monta y reemplaza el segmento completo
- **AND** ese fallback se comporta como cualquier otro `error.tsx` del layout group (regla preexistente)
