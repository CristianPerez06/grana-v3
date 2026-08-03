# route-loading-and-errors Specification

## Purpose

Define los estados de carga y error a nivel de ruta para `apps/web` y `apps/mobile`. Cubre los componentes primitivos compartidos (`Spinner`, `RouteError`) — sus variantes de tamaño, su API común vía `@grana/ui-contracts` y sus reglas de contenido (mensaje genérico, retry, ocultar detalles en producción) — y la regla de presencia por ruta en cada plataforma. Web usa `loading.tsx` y `error.tsx` de Next App Router por layout group; mobile usa los componentes inline contra los estados `isPending`/`error` de los hooks de TanStack Query.
## Requirements
### Requirement: La app provee un componente Spinner con tres variantes de tamaño

Cada app (web y mobile) SHALL exponer un componente `Spinner` reutilizable en su librería local de componentes UI. El componente SHALL aceptar exactamente tres tamaños: `sm`, `md`, `lg`. Los tres tamaños SHALL renderizarse como una animación de carga indeterminada (rotación continua), sin un valor de progreso.

Las propiedades públicas del componente SHALL coincidir entre plataformas. El tipo `SpinnerProps` SHALL vivir en `packages/ui-contracts/` y SHALL ser importado tanto desde `apps/web` como desde `apps/mobile`:

```ts
type SpinnerProps = {
  size: 'sm' | 'md' | 'lg'
  className?: string  // solo significativo en web; mobile lo acepta para paridad de API
}
```

Los colores del spinner SHALL leerse de tokens existentes en `@grana/ui-tokens` (paleta de marca). NO SHALL haber literales de color hex hardcodeados en el componente.

El uso esperado por tamaño:

- `sm`: dentro de botones u otros controles compactos (reservado para futuro; debe existir desde el primer día para no requerir un cambio adicional).
- `md`: indicadores secundarios dentro de páginas (ej. una sección que recarga sin bloquear la navegación).
- `lg`: indicador principal de carga de ruta (usado por el wrapper de `loading.tsx` en web y por el `RouteError`/loading screens en mobile).

#### Scenario: Spinner web renderiza las tres variantes

- **WHEN** un desarrollador renderiza `<Spinner size="sm" />`, `<Spinner size="md" />` y `<Spinner size="lg" />` en `apps/web`
- **THEN** los tres se montan sin error
- **AND** los tres tienen diámetros visualmente distintos (orden creciente sm < md < lg)
- **AND** los tres usan colores derivados de tokens de `@grana/ui-tokens`

#### Scenario: Spinner mobile renderiza las tres variantes

- **WHEN** un desarrollador renderiza `<Spinner size="sm" />`, `<Spinner size="md" />` y `<Spinner size="lg" />` en `apps/mobile`
- **THEN** los tres se montan sin error en un dispositivo iOS o Android
- **AND** los diámetros guardan la misma relación de orden que en web
- **AND** ningún color está hardcodeado en el componente

#### Scenario: SpinnerProps es la misma tipo en ambas plataformas

- **WHEN** se modifica `SpinnerProps` en `packages/ui-contracts/`
- **THEN** TypeScript reporta error en `apps/web` y en `apps/mobile` simultáneamente si la nueva firma rompe el uso existente

---

### Requirement: La app provee un componente RouteError reutilizable

Cada app (web y mobile) SHALL exponer un componente `RouteError` reutilizable en su librería local de componentes UI. El componente SHALL aceptar un error y un callback de reintento, y SHALL mostrar al usuario:

1. Un mensaje genérico de error en el idioma activo del usuario (ej. en español: "Algo salió mal").
2. Un botón "Reintentar" que invoca el callback `onRetry` provisto por el caller.

El componente NO SHALL mapear el contenido del `error` a copy específica en esta iteración (es mejora futura). En modo desarrollo, el componente MAY mostrar adicionalmente el `error.message` o el `error.digest` para ayudar al debug; en producción ese detalle SHALL estar oculto.

El tipo `RouteErrorProps` SHALL vivir en `packages/ui-contracts/` y SHALL ser idéntico entre plataformas:

```ts
type RouteErrorProps = {
  error: Error & { digest?: string }
  onRetry: () => void
  className?: string  // solo significativo en web
}
```

El callback se nombra `onRetry` (no `onPress` ni `onClick`) porque tiene semántica de dominio explícita — no es un wrapper genérico de interacción.

#### Scenario: RouteError web renderiza mensaje y botón funcional

- **WHEN** un usuario aterriza en un `error.tsx` que renderiza `<RouteError error={err} onRetry={reset} />`
- **THEN** la pantalla muestra el mensaje genérico en el idioma activo del usuario
- **AND** muestra un botón etiquetado "Reintentar"
- **AND** presionar el botón invoca `reset()` (el callback provisto)

#### Scenario: RouteError mobile renderiza mensaje y botón funcional

- **WHEN** una pantalla mobile renderiza `<RouteError error={err} onRetry={retry} />` ante un error de fetching
- **THEN** la pantalla muestra el mensaje genérico en el idioma activo del usuario
- **AND** muestra un botón "Reintentar"
- **AND** presionar el botón invoca `retry()` (típicamente `query.refetch()` cuando se usa con TanStack Query)

#### Scenario: El componente no expone error.message en producción

- **WHEN** la app corre en modo producción (`NODE_ENV=production`)
- **AND** `<RouteError>` recibe un `error` con `message` revelador (ej. "Connection refused to host db.internal:5432")
- **THEN** el DOM/UI NO contiene ese `message` visible al usuario

---

### Requirement: Toda ruta de apps/web bajo (app), (auth) y (onboarding-wizard) tiene loading.tsx y error.tsx (web)

`apps/web` SHALL incluir, para cada segmento de ruta bajo `app/(app)/`, `app/(auth)/` y `app/(onboarding-wizard)/`, cobertura de `loading` y `error` accesible al render. La cobertura puede vivir a tres niveles, en orden de preferencia:

1. **A nivel de layout group** (`(app)/loading.tsx`, `(app)/error.tsx`): único par que cubre todas las rutas hijas que NO adopten in-page chrome. Es el lugar default cuando las rutas hijas no tienen necesidades especiales.
2. **A nivel de ruta** (`<ruta>/loading.tsx`, `<ruta>/error.tsx`): cuando la ruta adopta una variante de in-page chrome (ver el requirement de in-page chrome) o necesita un fallback shape-matched específico (skeletons del contenido de esa ruta en vez de un spinner genérico). El `loading.tsx` de la ruta convive con un `<ruta>/layout.tsx` que aloja el chrome persistente.
3. **In-page** (Suspense + client error boundary co-localizados en `page.tsx`): variante específica de in-page chrome para rutas que necesitan control más fino sobre el wrapper de contenido.

El `error.tsx` SHALL ser un Client Component (Next lo exige) que recibe `{ error, reset }` y renderiza `<RouteError error={error} onRetry={reset} />`. El `loading.tsx` SHALL renderizar un componente apropiado al nivel:

- En layout group genérico: un `<RouteLoading />` que envuelve `<Spinner size="lg" />` centrado.
- A nivel de ruta con in-page chrome: el set de skeletons shape-matched del contenido de la ruta (ej. `HeroSkeleton`, `MonthBalanceSkeleton`, etc. para dashboard).

La regla operativa: agregar cobertura al **nivel más alto donde aplica el mismo fallback**. Las rutas hijas pueden sobrescribir solo si necesitan un comportamiento distinto. Cuando todas las rutas hijas de un layout group adoptan in-page chrome con su propio `loading.tsx`, el layout group MAY omitir el `loading.tsx` global; el `error.tsx` global SHALL mantenerse para capturar errores de render del propio shell.

#### Scenario: Navegar a una ruta no congela la URL anterior

- **WHEN** un usuario hace click en un link a una ruta que tarda > 200ms en resolver el RSC payload
- **THEN** la URL en la barra cambia inmediatamente
- **AND** el área de contenido principal muestra un fallback (skeleton de la ruta destino si la ruta tiene `loading.tsx` propio, o spinner del layout group si no)
- **AND** el sidebar/topbar permanece visible y operable durante la carga

#### Scenario: Un error en una server query cae en error.tsx

- **WHEN** una página bajo `(app)/` lanza un error durante el fetch server-side (ej. Supabase devuelve 500)
- **THEN** el `error.tsx` del segmento (o del layout group más cercano) se monta
- **AND** el usuario ve `<RouteError>` con el botón "Reintentar"
- **AND** presionar "Reintentar" invoca `reset()` y reintenta el render de la ruta

#### Scenario: Las tres áreas de routing tienen cobertura

- **WHEN** un desarrollador inspecciona `apps/web/app/`
- **THEN** existe al menos un `error.tsx` accesible desde cualquier ruta bajo `(app)/`
- **AND** existe al menos un `error.tsx` accesible desde cualquier ruta bajo `(auth)/`
- **AND** existe al menos un `error.tsx` accesible desde cualquier ruta bajo `(onboarding-wizard)/`
- **AND** toda ruta sin in-page chrome tiene un `loading.tsx` accesible (propio o heredado del layout group)
- **AND** toda ruta con in-page chrome tiene su propio `loading.tsx` shape-matched o usa un mecanismo equivalente in-page

---

### Requirement: Toda pantalla autenticada de apps/mobile con fetching cliente entrega loading y error states (mobile)

`apps/mobile` SHALL renderizar un estado de loading y un estado de error consistentes en toda pantalla que dependa de un fetch cliente (típicamente vía `useQuery` de TanStack Query, ver `mobile-app-shell`). El loading SHALL usar `<Spinner size="lg" />`; el error SHALL usar `<RouteError>`.

Patrón canónico para pantallas mobile:

```tsx
const { data, isPending, error, refetch } = useQuery({ ... })

if (isPending) return <ScreenLoading />  // wrapper que centra <Spinner size="lg" />
if (error) return <RouteError error={error} onRetry={() => refetch()} />
return <ScreenContent data={data} />
```

Esta regla aplica a cualquier pantalla bajo `(app)/` que monte queries cliente. Pantallas placeholder (sin fetching) están exentas hasta su primera implementación real.

#### Scenario: Una pantalla mobile en carga muestra Spinner centrado

- **WHEN** un usuario abre una pantalla mobile cuyas queries cliente aún están en estado `pending`
- **THEN** la pantalla muestra `<Spinner size="lg" />` centrado vertical y horizontalmente
- **AND** no muestra el contenido principal vacío ni texto placeholder

#### Scenario: Una pantalla mobile con error muestra RouteError con retry funcional

- **WHEN** una query cliente en una pantalla mobile cae en error
- **THEN** la pantalla muestra `<RouteError>` con el mensaje genérico y el botón "Reintentar"
- **AND** presionar "Reintentar" llama a `refetch()` y la pantalla vuelve a entrar en estado de loading mientras la query reintenta

---

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

- `apps/web/app/(app)/dashboard/`: **Variant C**. El chrome (saludo, fecha, navegador mensual, `eye toggle`, botón "Nuevo movimiento" en desktop) vive en `dashboard/layout.tsx` envuelto por `EyeMaskProvider` + `DashboardMonthProvider`. `dashboard/loading.tsx` renderiza los skeletons del contenido (`HeroSkeleton`, `MonthBalanceSkeleton`, `SpendingSkeleton` — la composición post-rediseño `redesign-dashboard-home`) con la misma disposición que `DashboardContent`. `page.tsx` es sync y solo retorna `<DashboardContent />` y el FAB. Las secciones internas mantienen su propio `<Suspense>` shape-matched (regla preexistente del spec `dashboard`).
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

### Requirement: Las rutas bajo `/settings` adoptan Variant C de in-page chrome

`apps/web/app/(app)/settings/**` SHALL adoptar la **Variant C** del requirement *"Una ruta de apps/web puede optar por loading y error in-page para mantener su chrome visible"*: el header de cada segmento vive en su `layout.tsx` y persiste durante el loading/error del cuerpo. Esto extiende el alcance ya cubierto por `/dashboard`, `/transactions`, `/accounts`, `/cards` y `/shared` a las rutas de configuración.

La distribución concreta es:

1. `apps/web/app/(app)/settings/layout.tsx` SHALL montar `<SettingsHeader />` envolviendo `{children}`. `SettingsHeader` es un Client Component que renderiza `<PageHeader title="Configuración" />` **únicamente** cuando `usePathname() === '/settings'`, y retorna `null` en cualquier sub-ruta. El pathname guard existe para evitar que el header de `/settings` se apile sobre el `CategoriesHeader` cuando el usuario navega a `/settings/categories/**`.
2. `apps/web/app/(app)/settings/categories/layout.tsx` SHALL montar `<CategoriesHeader />` envolviendo `{children}`. `CategoriesHeader` es un Client Component que conmuta su `PageHeaderProps` (`title`, `description`, `backLink`, `actions`) según `usePathname()` y `useParams()`, cubriendo las cinco rutas hijas (`/settings/categories`, `/new`, `/[id]/edit`, `/[id]/subcategories`, `/[id]/subcategories/new`).
3. Para las rutas con segmento `[id]` (`/edit`, `/subcategories`, `/subcategories/new`), `CategoriesHeader` SHALL fetchear `category.name` client-side y mostrar un placeholder vacío (non-breaking space, U+00A0) en la `description` mientras el fetch no resuelve. El placeholder SHALL preservar la altura de la línea sin texto visible — el objetivo es evitar reflow del título cuando la descripción aparece, no mostrar feedback textual al usuario. NO SHALL mostrar un skeleton animado, ni texto "Cargando...", ni una descripción vacía que colapse la línea.
4. Las acciones de los headers de `/settings/categories` y `/settings/categories/[id]/subcategories` SHALL componerse como `<Button asChild><Link href={…/new}>…</Link></Button>` (primitivo `Button` del UI library), nunca como `<Link>` con clases inline de botón. Esta regla ya está specceada en `ui-foundations` y este requirement la aplica explícitamente al segmento de settings.
5. `apps/web/app/(app)/settings/loading.tsx` NO SHALL renderizar `<PageHeaderSkeleton />`: el header ya vive en el layout y no necesita placeholder. SHALL renderizar únicamente skeletons del cuerpo.
6. `apps/web/app/(app)/settings/categories/loading.tsx` SHALL renderizar un skeleton shape-matched de la lista de categorías. NO SHALL renderizar `<PageHeaderSkeleton />`.

#### Scenario: /settings mantiene el header durante el loading del contenido

- **WHEN** un usuario navega a `/settings` y el server tarda > 200ms en resolver el RSC payload (por ejemplo, mientras `getShowCents()` o `getLocale()` resuelven)
- **THEN** `<SettingsHeader />` con el título "Configuración" aparece desde el primer paint, montado por `settings/layout.tsx`
- **AND** el cuerpo de la página se reemplaza por los skeletons de `settings/loading.tsx` (sin `PageHeaderSkeleton`)
- **AND** una vez que el contenido resuelve, el cuerpo reemplaza a los skeletons sin remontar el header

#### Scenario: /settings/categories mantiene el header durante el loading del contenido

- **WHEN** un usuario navega a `/settings/categories` y el server tarda en resolver `getAllCategories(user.id)`
- **THEN** `<CategoriesHeader />` con el título "Categorías", su descripción y el botón "Agregar" (icono `<Plus />` + label, sin `+` literal) aparece desde el primer paint
- **AND** el botón es el primitivo `Button` con `variant="primary"` y `className="w-auto"` (override del `w-full` default), NO un `<Link>` con `bg-primary px-4 py-2 …` inline
- **AND** el cuerpo se reemplaza por el skeleton de la lista de categorías (`categories/loading.tsx`)
- **AND** el header permanece visible y operable durante toda la transición

#### Scenario: Las sub-rutas de /settings/categories preservan CategoriesHeader durante la navegación

- **WHEN** un usuario navega de `/settings/categories` a `/settings/categories/<id>/subcategories` (o a `/new`, `/[id]/edit`, etc.)
- **THEN** el segmento `settings/categories/layout.tsx` NO se remonta: `<CategoriesHeader />` permanece en el DOM
- **AND** el contenido del header conmuta a los `PageHeaderProps` correspondientes a la nueva sub-ruta (`title`, `description`, `backLink`, `actions`) sin parpadear
- **AND** `<SettingsHeader />` del segmento padre retorna `null` durante toda la sesión bajo `/settings/categories/**` (el guard `pathname === '/settings'` lo apaga)

#### Scenario: /settings/categories/[id]/subcategories reserva la línea de descripción durante el loading

- **WHEN** un usuario navega a `/settings/categories/<id>/subcategories` y el fetch client-side de `category.name` aún no resuelve
- **THEN** el header se renderiza con `title="Subcategorías"` desde el primer paint
- **AND** la `description` contiene un non-breaking space (U+00A0) que preserva la altura de la línea sin texto visible
- **AND** no se muestra texto "Cargando..." ni un skeleton animado en el slot de descripción
- **AND** cuando `category.name` resuelve, la `description` se reemplaza por el nombre real sin reflow del título ni del back link

#### Scenario: Las acciones del header de categorías usan el primitivo Button

- **WHEN** un desarrollador inspecciona el DOM del header en `/settings/categories` o `/settings/categories/<id>/subcategories`
- **THEN** el botón "Agregar" es renderizado por `<Button asChild className="w-auto">` envolviendo un `<Link>` de `next/link`, con `<Plus />` como única fuente del "+" visual (los strings i18n `settings.categories.actions.add` y `.add_subcategory` ya NO incluyen el `+` literal)
- **AND** las clases del botón provienen del primitivo `Button` (variant `primary` por default, equivalente al verde emerald del UI library), no de `className="bg-primary px-4 py-2 …"` re-tipeado inline
- **AND** el estilo es visualmente idéntico al botón "Crear cuenta" de `/accounts` (mismo override `w-auto`, mismo icono + label sin `+` literal)

### Requirement: Variant C aplica también a rutas hijas con loading.tsx

Cualquier ruta hija bajo `apps/web/app/(app)/<section>/**` que actualmente renderice su `PageHeader` (o equivalente) dentro de `page.tsx` y dependa de un `loading.tsx` (propio o heredado de un segmento padre) como fallback durante el `await` server-side, SHALL adoptar Variant C:

1. La ruta SHALL definir un `<ruta>/layout.tsx` (server component) que renderice el chrome persistente del segmento. El layout SHALL ser **efectivamente sync**: los únicos `await` permitidos son operaciones rápidas in-memory (`await params`, `await getTranslations()`). El layout NO SHALL hacer fetches a DB / red / cualquier I/O lento antes de renderizar el chrome, porque Next bloquea el output del layout hasta que todos sus awaits resuelven — durante ese tiempo, lo que el usuario ve es el `loading.tsx` del segmento padre, no el chrome del layout. El chrome SHALL incluir como mínimo el back-link al parent inmediato, usando el estilo canónico `← {label}` (clases `text-sm text-muted-foreground hover:text-foreground transition-colors`). El chrome MAY incluir título textual, descripción y action slot según el shape de la ruta. Si el chrome necesita data dinámica (nombre del recurso, descripción), las opciones son: (a) usar label/título estático de translation-key y mover la info dinámica al cuerpo del page como sub-header; (b) usar `<Suspense>` con un async child component que fetchea y se streamea (requiere que la prop del consumer acepte ReactNode). Opción (a) es la default.

2. La ruta SHALL definir un `<ruta>/loading.tsx` que renderice **solo skeletons del cuerpo** del segmento (filas, cards, secciones), encapsulados en los mismos containers de layout (max-w, gap) que el `page.tsx`. El `loading.tsx` SHALL NO usar `PageHeaderSkeleton` ni ningún otro skeleton que tape el back-link, el título o el action slot del chrome.

3. Si el chrome incluye acciones que dependen de data asincrónica para habilitarse (botones que abren drawers, navegación gateada), el slot de acciones SHALL renderizar el botón en su posición final con `disabled={true}` mientras la data no esté lista. NO SHALL ocultarse, reemplazarse por skeleton, ni renderizar `null`.

4. Si el chrome incluye un título dinámico (depende de data del recurso: nombre de cuenta, de tarjeta, label de período, descripción de recurrencia), el componente SHALL renderizar un placeholder no-breaking-space (`' '`) o equivalente que reserve la altura del título sin mostrar texto, hasta que la data resuelva — mismo patrón que `CategoriesHeader`. El back-link y el slot de acciones SHALL renderizarse siempre, independientemente de si el título dinámico resolvió.

5. Para rutas cuyo título visual primario es un widget compuesto de detalle (ej. `AccountDetailHeader`, `CardDetailHeader`, header interno de `GlobalTransactionDetail` — los exceptuados en el requirement "Las pages no declaran títulos top-level por fuera de PageHeader" del spec `page-header`), el `layout.tsx` SHALL montar **solo el back-link** (no un `PageHeader` con título). El widget compuesto sigue siendo responsabilidad del `page.tsx` y aparece como sub-sección del cuerpo, con su propio skeleton acotado en `loading.tsx`.

Rutas explícitamente cubiertas por este requirement (cada una SHALL tener su `layout.tsx` y `loading.tsx` propios):

- `/transactions/recurring`
- `/transactions/recurring/[id]`
- `/transactions/[txId]`
- `/transactions/[txId]/edit`
- `/accounts/[id]`
- `/accounts/[id]/edit`
- `/cards/[id]`
- `/cards/[id]/edit`
- `/cards/[id]/periods`
- `/cards/[id]/periods/[periodId]`
- `/cards/[id]/periods/[periodId]/pay`
- `/settings/categories/new`
- `/settings/categories/[id]/edit`
- `/settings/categories/[id]/subcategories`
- `/settings/categories/[id]/subcategories/new`

Componentes que conmutan chrome por pathname desde el cliente (como el viejo `CategoriesHeader` que decidía entre 5 variantes via `usePathname` + `useParams`) SHALL ser reemplazados por per-route layouts server-side. El switch client-side introduce ventanas de render donde el chrome puede aparecer vacío (caída al fallback `return null` cuando `usePathname` y `useParams` no se actualizan en el mismo tick). Per-route layouts evitan esta clase de race entirely al delegar la decisión al filesystem routing de Next.

#### Scenario: /transactions/recurring mantiene el chrome durante el loading

- **WHEN** un usuario navega a `/transactions/recurring` y el `page.tsx` está en flight (fetcheando `getRecurrences`, `getPendingRecurrenceInstances`, etc.)
- **THEN** `transactions/recurring/layout.tsx` ya pinta el `PageHeader` con título "Recurrencias", back-link `← Movimientos` y el botón `CreateRecurrenceButton` en su slot de acciones
- **AND** el botón `CreateRecurrenceButton` aparece con `disabled={true}` hasta que sus dependencias (`accounts`, `categories`) resuelvan via `useQueries`
- **AND** `transactions/recurring/loading.tsx` renderiza solo skeletons de las tabs y de las filas de la lista, NO incluye `PageHeaderSkeleton`
- **AND** una vez que el page resuelve, las secciones internas pintan inline sin reflow del chrome

#### Scenario: /cards/[id]/periods mantiene chrome durante el loading sin fetches en el layout

- **WHEN** un usuario navega a `/cards/[id]/periods` y el `page.tsx` está en flight
- **THEN** `cards/[id]/periods/layout.tsx` (server async, fetchea el nombre de la tarjeta) pinta el `PageHeader` con back-link `← {cardName}` y título "Resúmenes" desde el first paint
- **AND** si el fetch del layout falla o devuelve null, el back-link cae a `← {placeholder}` (`' '`) pero la flecha y el link al parent siguen siendo navegables
- **AND** `cards/[id]/periods/loading.tsx` renderiza solo skeletons de las filas de períodos, NO un `PageHeaderSkeleton`

#### Scenario: Layouts introducidos por este change no bloquean chrome con fetches a DB

- **WHEN** se inspeccionan los `layout.tsx` introducidos o modificados por este change (las 13+ rutas hijas listadas arriba)
- **THEN** ninguno awaitea operaciones de I/O (DB / red / Supabase / etc.) — solo se permiten `await params` y `await getTranslations(...)`
- **AND** cualquier fetch a DB / red para data del chrome SHALL vivir o en el `page.tsx` (que tiene su propio `loading.tsx` para skeletonear el cuerpo) o en un client component que carga via TanStack Query con skeleton acotado
- **AND** los layouts pre-existentes en `/dashboard`, `/shared/(home)`, `/shared/settings`, `/shared/settle`, `/shared/setup` quedan fuera del scope de este scenario: su fetch de chrome data es legacy y podrá ser auditado en un change futuro

#### Scenario: /accounts/[id] mantiene solo back-link durante el loading

- **WHEN** un usuario navega a `/accounts/[id]` y el `page.tsx` está en flight
- **THEN** `accounts/[id]/layout.tsx` (server sync) ya pinta el back-link `← Cuentas` desde el first paint
- **AND** el layout NO pinta un `PageHeader` con título — el título visual es responsabilidad de `AccountDetailHeader`, que vive en el cuerpo del page
- **AND** `accounts/[id]/loading.tsx` renderiza skeletons de `AccountDetailHeader` + secciones del cuerpo, debajo del back-link

#### Scenario: Una ruta hija nueva sigue el patrón

- **WHEN** se introduce una page nueva bajo `apps/web/app/(app)/<section>/<child>/page.tsx` que awaitea data server-side y necesita fallback de loading
- **THEN** la ruta SHALL definir `<child>/layout.tsx` con el chrome persistente Y `<child>/loading.tsx` con skeletons solo del cuerpo
- **AND** ningún `loading.tsx` nuevo SHALL usar `PageHeaderSkeleton` excepto en casos excepcionales documentados (no hay hoy)
- **AND** las acciones del chrome con dependencia asincrónica SHALL aparecer disabled hasta que la data resuelva

#### Scenario: /settings/categories/[id]/edit y similares no comparten un único componente client-side switching

- **WHEN** se inspecciona `apps/web/app/(app)/settings/categories/_components/categories-header.tsx`
- **THEN** el componente solo renderiza el chrome del root (`/settings/categories`) y retorna `null` para cualquier otra pathname
- **AND** las sub-rutas (`/new`, `/[id]/edit`, `/[id]/subcategories`, `/[id]/subcategories/new`) declaran su chrome en su propio `<sub-ruta>/layout.tsx` server-side
- **AND** cada sub-ruta tiene su `<sub-ruta>/loading.tsx` con skeletons del cuerpo apropiados al shape (form de N campos para `/new` y `/edit`, lista de filas para `/subcategories`)
- **AND** ningún sub-route depende de un client-side pathname switch ni del fallback del padre para mostrar su chrome

---

### Requirement: La app provee un componente RouteNotFound reutilizable

La app web SHALL exponer un componente `RouteNotFound` reutilizable en `apps/web/components/ui/route-not-found.tsx`. El componente SHALL aceptar las strings ya traducidas y un destino de navegación, y SHALL mostrar al usuario:

1. Un título corto en el idioma activo del usuario (ej. en español: "No encontramos esa página" o, en variantes por módulo, "No encontramos esa tarjeta").
2. Una descripción breve en el idioma activo (ej. "Puede haber sido eliminada o no existir").
3. Un botón de acción primaria (variant `primary` del `Button` interno) etiquetado con `backLabel` que navega a `backHref` mediante el `<Link>` de Next.

El componente NO SHALL exponer un callback de reintento — la semántica es navegación a un punto de partida conocido, no recuperación. El componente SHALL alinear su disposición visual con `<RouteError>` (contenedor centrado, `min-h-[50vh]`, padding `px-6 py-12`, tipografía `text-lg font-semibold text-text` para el título) para mantener coherencia entre estados terminales de ruta. El componente NO SHALL usar `role="alert"` (no es un error); MAY omitir role o usar `role="status"`.

El tipo `RouteNotFoundProps` SHALL vivir en `packages/ui-contracts/`:

```ts
type RouteNotFoundProps = {
  title: string
  description: string
  backHref: string
  backLabel: string
  className?: string  // solo significativo en web
}
```

Las props se pasan ya traducidas — el componente NO SHALL invocar `useTranslations` internamente. La razón es que el set de strings depende del módulo (cada `not-found.tsx` consume su propio namespace) y delegar la traducción al caller mantiene al primitivo agnóstico del scope de i18n.

#### Scenario: RouteNotFound web renderiza título, descripción y link funcional

- **WHEN** un `not-found.tsx` renderiza `<RouteNotFound title="Card not found" description="It may have been deleted or never existed." backHref="/cards" backLabel="Back to cards" />`
- **THEN** la pantalla muestra el título "Card not found"
- **AND** muestra la descripción "It may have been deleted or never existed."
- **AND** muestra un botón "Back to cards" que apunta a `/cards`
- **AND** hacer click sobre el botón navega a `/cards`

#### Scenario: RouteNotFound no anuncia como alerta

- **WHEN** un screen reader recorre el árbol accesible de una pantalla con `<RouteNotFound />`
- **THEN** el componente NO se anuncia con `role="alert"` (reservado a errores)

---

### Requirement: Toda ruta dinámica de id en (app) tiene un not-found.tsx ancestro que preserva chrome

Toda ruta dentro de `apps/web/app/(app)/**` que llame a `notFound()` desde `next/navigation` SHALL estar cubierta por al menos un `not-found.tsx` ubicado en algún ancestro del árbol de segmentos, de modo que el fallback default chromeless de Next.js NUNCA se exhiba al usuario autenticado.

La cobertura SHALL cumplir:

1. EXISTE `apps/web/app/(app)/not-found.tsx` como **floor global**. Renderiza `<RouteNotFound>` con las strings genéricas del namespace `notFound.generic`, `backHref="/dashboard"`, `backLabel` desde `notFound.generic.back_label`. Por su posición en el árbol, queda envuelto por `(app)/layout.tsx` y por lo tanto preserva el `AppShell` (sidebar + main area).

2. CADA módulo cuyo árbol contiene rutas dinámicas de id con `notFound()` que se beneficien de un back-link más específico SHALL definir su propio `<modulo>/not-found.tsx`. En el alcance inicial, esto cubre:
   - `apps/web/app/(app)/cards/not-found.tsx` → `backHref="/cards"`, namespace `notFound.cards`
   - `apps/web/app/(app)/accounts/not-found.tsx` → `backHref="/accounts"`, namespace `notFound.accounts`
   - `apps/web/app/(app)/transactions/not-found.tsx` → `backHref="/transactions"`, namespace `notFound.transactions`
   - `apps/web/app/(app)/settings/categories/not-found.tsx` → `backHref="/settings/categories"`, namespace `notFound.categories`

3. El `not-found.tsx` por módulo SHALL ser un Server Component que invoca `getTranslations('notFound')` y pasa las strings del sub-namespace correspondiente al `<RouteNotFound>`.

4. NUEVAS rutas dinámicas de id en `(app)` con llamadas a `notFound()` SHALL caer bajo el floor global por defecto. Si el módulo dueño de la ruta no tiene aún un `not-found.tsx` propio y su back-link a un índice de módulo aporta valor sobre `/dashboard`, ese módulo SHALL agregar su `not-found.tsx`.

La cobertura aplica con independencia de la Variant (A/B/C) que la ruta use para loading/error. El boundary de not-found es ortogonal a esos variants.

#### Scenario: Acceder a /cards/<id-inexistente> conserva el chrome del módulo

- **GIVEN** un usuario autenticado
- **WHEN** navega a `/cards/<id-que-no-existe>`
- **THEN** la respuesta renderiza `<AppShell>` (sidebar visible)
- **AND** renderiza el chrome de `cards/layout.tsx` (header del módulo Cards)
- **AND** dentro del slot principal muestra el contenido localizado de `notFound.cards`
- **AND** ofrece un botón "Volver a tarjetas" que navega a `/cards`
- **AND** NO muestra el texto literal "404 | This page could not be found"

#### Scenario: Acceder a /cards/<carpeta-no-existente>/<algo> dentro del subárbol de cards conserva chrome del módulo

- **GIVEN** un usuario autenticado
- **WHEN** navega a una URL dentro del subárbol de un módulo cubierto (ej. `/cards/<id>/wild/segment`) cuyo segmento extra no matchea ningún archivo
- **THEN** Next.js renderiza el `not-found.tsx` más cercano dentro del subárbol (`(app)/cards/not-found.tsx`)
- **AND** la respuesta preserva `<AppShell>` + el header del módulo Cards
- **AND** ofrece el back-link del módulo (`/cards`)

**Nota:** URLs que NO entran a ningún route group de `(app)` (ej. `/blahblah` en la raíz) caen al fallback default de Next.js — quedan fuera del alcance de este change. Cubrirlas requeriría `app/not-found.tsx` a nivel raíz, que no puede preservar AppShell por no tener establecido el contexto de auth/providers, y se trata como un change separado si surge la necesidad.

#### Scenario: Acceder a /accounts/<id-inexistente> usa el back-link de cuentas

- **GIVEN** un usuario autenticado
- **WHEN** navega a `/accounts/<id-que-no-existe>`
- **THEN** el botón de acción primaria del estado not-found apunta a `/accounts`, no a `/dashboard`

---

### Requirement: Las strings de not-found viven bajo el namespace notFound de @grana/i18n-messages

El paquete `@grana/i18n-messages` SHALL exponer un namespace `notFound` con la siguiente forma:

```jsonc
"notFound": {
  "generic":      { "title": "…", "description": "…", "back_label": "…" },
  "cards":        { "title": "…", "description": "…", "back_label": "…" },
  "accounts":     { "title": "…", "description": "…", "back_label": "…" },
  "transactions": { "title": "…", "description": "…", "back_label": "…" },
  "categories":   { "title": "…", "description": "…", "back_label": "…" }
}
```

Cada sub-namespace SHALL contener las tres claves (`title`, `description`, `back_label`). El español es la fuente canónica del proyecto; el inglés SHALL existir como traducción paralela completa (ninguna clave faltante entre locales).

#### Scenario: Las claves notFound están completas en ambos locales

- **WHEN** se carga `packages/i18n-messages/src/es.json` y `packages/i18n-messages/src/en.json`
- **THEN** ambos archivos contienen el namespace `notFound`
- **AND** los sub-namespaces `generic`, `cards`, `accounts`, `transactions`, `categories` están presentes en ambos
- **AND** cada sub-namespace tiene las claves `title`, `description`, `back_label`

### Requirement: Toda nueva ruta o pantalla entrega loading y error states desde su primera implementación

Cuando un colaborador agrega una ruta nueva a `apps/web` o una pantalla nueva con fetching cliente a `apps/mobile`, esa ruta/pantalla SHALL incluir loading y error states desde el commit que la introduce (no en un follow-up).

Aplicación concreta por plataforma:

- **Web** (`apps/web/app/.../page.tsx`): el segmento SHALL tener un `loading.tsx` y un `error.tsx` colocalizados, o estar cubierto por un par a nivel de layout group ancestro. La regla operativa es: si la ruta nueva queda cubierta por el `loading.tsx`/`error.tsx` del layout group superior con un fallback aceptable, no hace falta duplicar; si necesita un fallback distinto, agregar el par específico.
- **Mobile** (`apps/mobile/app/.../<screen>.tsx`): la pantalla SHALL manejar explícitamente los estados `isPending` y `error` de sus queries, usando `<Spinner size="lg" />` y `<RouteError>` (componentes provistos por la capability `route-loading-and-errors`). Pantallas placeholder (sin queries) están exentas hasta su primera implementación real.

Esta regla NO aplica retroactivamente a rutas anteriores al change que introdujo la capability `route-loading-and-errors` — aunque ese change agrega el par a las rutas existentes en un solo commit, lo que importa para esta convención es que **de aquí en adelante** ninguna ruta nueva se mergee sin loading/error.

#### Scenario: Una ruta web nueva entrega loading.tsx y error.tsx en el mismo PR

- **WHEN** un colaborador crea un nuevo `apps/web/app/<group>/<route>/page.tsx`
- **AND** el segmento NO queda cubierto por un `loading.tsx` o `error.tsx` de un layout ancestro con fallback aceptable
- **THEN** el mismo PR agrega `loading.tsx` y `error.tsx` colocalizados con el `page.tsx` nuevo
- **AND** el PR es revisado antes de merge para validar que ambos archivos están presentes o que el fallback ancestro aplica

#### Scenario: Una pantalla mobile nueva con queries entrega loading y error states en el mismo PR

- **WHEN** un colaborador crea una nueva pantalla `apps/mobile/app/(app)/<screen>.tsx` que invoca `useQuery({ ... })`
- **THEN** el componente maneja `isPending` (renderizando `<Spinner size="lg" />`) y `error` (renderizando `<RouteError>`) antes de renderizar contenido
- **AND** el PR no se mergea sin esa cobertura

