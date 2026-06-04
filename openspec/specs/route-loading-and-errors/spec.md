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
- `apps/web/app/(app)/accounts/`: **Variant A** (sin cambios respecto a su definición previa). Header con botón "+ Nueva cuenta" gated por institutions; secciones active/archived como containers async aislados.
- `apps/web/app/(app)/accounts/[id]/`: **Variant B** (sin cambios). Shell cliente + TanStack Query.

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
