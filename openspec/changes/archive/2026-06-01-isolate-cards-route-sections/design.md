## Context

`apps/web/app/(app)/cards/page.tsx` es hoy un server component que hace un único `Promise.all` con cuatro queries (`getCreditCards`, `getCardsMonthSummary`, `getCardNetworks`, `getInstitutions`) más preferencias y catálogo i18n, todo antes de devolver HTML. El resultado: el header del módulo solo aparece después de que la query más lenta resuelve, y un único `throw` en cualquiera de esas queries propaga al `error.tsx` del layout group `(app)`, lo que reemplaza la ruta completa con `<RouteError>` y oculta el header.

`apps/web/app/(app)/dashboard/page.tsx` resolvió el mismo problema con un patrón limpio:

1. El page es un shell server casi vacío que monta el chrome + un wrapper de contenido.
2. El `DashboardHeader` es client-only, se renderiza desde el primer paint y hace su propio fetch con el browser client de Supabase (`profiles` para el nombre).
3. El cuerpo es un árbol de `<Suspense>` boundaries, cada uno con un container server async que fetcha **una** query, hace su propio `try/catch`, y devuelve `<SectionFallback message=…>` en caso de error.
4. Un `DashboardErrorBoundary` (`'use client'`, `Component<…, …>` con `getDerivedStateFromError`) envuelve el cuerpo como red de seguridad.

Este mismo patrón ya está reconocido en el spec `route-loading-and-errors` como "in-page loading y error para mantener el chrome visible" — `/cards` es el segundo consumidor.

## Goals / Non-Goals

**Goals:**

- El header de `/cards` (título + subtítulo con count + botón "Agregar tarjeta") se ve desde el primer paint en cualquier estado de red.
- Cada sección del listado (hero del mes, wallet, archivadas) carga y falla independientemente, sin tirar la ruta.
- Cualquier fallback de carga ocupa visualmente el mismo "slot" que el contenido final (mismas alturas mínimas) para evitar reflujo.
- El usuario nunca ve el botón "Agregar tarjeta" habilitado sin la data necesaria para abrir el drawer.

**Non-Goals:**

- No tocar `/cards/[id]` ni `/cards/new`. Sus patrones de carga quedan donde están.
- No mover `SectionFallback` a una librería compartida. Se reusa importándolo desde `../dashboard/_components/section-fallback`. La promoción a `components/ui/` (o a `@grana/ui` cuando ese paquete exista) se hace cuando aparezca el tercer consumidor.
- No reescribir las queries server. Si una flag falta (`archivedOnly` en `getCreditCards`), se agrega como extensión backwards-compatible; no se rediseña el contrato.
- No introducir TanStack Query en `apps/web`. Las queries del header se mantienen como `useEffect + supabase.from(...)`, igual que en `DashboardHeader`.
- No cambiar el comportamiento visible del módulo más allá del orden de aparición y el manejo de errores.

## Decisions

### 1. El header es `'use client'` con fetch propio, no un server component con Suspense

**Alternativas consideradas:**

- (a) Header server component que streamea independiente vía `<Suspense>` en `page.tsx`.
- (b) Header `'use client'` con browser Supabase client + `useEffect`. ← elegido.

**Por qué (b):** El requirement del usuario dice literalmente "button disabled until API calls are completed", lo que implica que el header debe estar **siempre montado** mostrando su estado de carga (count = `"-"`, botón disabled). Si fuera un server component dentro de Suspense, el fallback inicial sería un placeholder genérico — no el header con su layout completo. Además, este es el mismo patrón que ya usa `DashboardHeader`, y mantener la consistencia entre rutas principales pesa más que el costo marginal de hacer las queries client-side.

**Consecuencia:** El header dispara tres queries en el browser:

```ts
// pseudo
const [count, institutions, networks] = await Promise.all([
  supabase.from('accounts').select('id', { count: 'exact', head: true })
    .eq('kind', 'credit_card').eq('is_active', true),
  supabase.from('institutions').select('*').order('name'),
  supabase.from('card_networks').select('*').order('name'),
])
```

El `count` se obtiene con `head: true` para no traer filas. Si los nombres de tabla / RLS no coinciden con lo que asume este snippet, el implementador ajusta sin cambiar la decisión arquitectural.

### 2. Cada container fetcha lo suyo, aunque haya overlap

`WalletGridContainer` y `ArchivedCardsContainer` ambos podrían reusar un solo `getCreditCards({ includeArchived: true })`. Decisión: cada uno llama `getCreditCards` con su filtro propio.

**Por qué:** Aislamiento literal de error states. Si las activas fallan, las archivadas pueden seguir renderizando (y viceversa). El costo: una query extra a Supabase. Es barato porque las filas son pocas (decenas como mucho por usuario) y van en paralelo gracias a Suspense.

**Trade-off aceptado:** doble round-trip a credit cards. Si en métricas reales se vuelve un problema, se consolida más adelante.

### 3. Reusar `SectionFallback` por path relativo, no promoverlo

`SectionFallback` vive en `apps/web/app/(app)/dashboard/_components/section-fallback.tsx`. Lo importamos desde el header de cards como `../dashboard/_components/section-fallback`.

**Por qué:** Promoverlo ahora a `components/ui/` triplica el alcance del cambio (storybook, types compartidos, posiblemente i18n keys movidas). Con dos consumidores el costo del move no se justifica. Cuando aparezca un tercero (probablemente `/accounts` cuando le toque el mismo tratamiento), se hace el move como cambio aparte.

### 4. `CardsErrorBoundary` es nuevo, paralelo a `DashboardErrorBoundary`

No reutilizar `DashboardErrorBoundary`. El componente es ~10 líneas y duplicarlo evita acoplar dos rutas distintas a un mismo símbolo que vive en otro feature folder.

**Cuando aparezca el tercer caso**, se promueve a `components/ui/route-error-boundary.tsx`.

### 5. El subtítulo del header vive en el header, no en el wallet

En la exploración consideramos mover el count al título de la sección "Mis tarjetas". Decisión: queda en el header, con `"-"` mientras carga.

**Por qué:** Coincide con el spec actual (`cards`: "subtítulo (N tarjetas de crédito · resúmenes de <mes>)"). Mover el count al wallet rompería ese requirement sin justificación, y la UX "muestro un guion durante 150ms" es preferible a reescribir capa de información.

### 6. Container vs `Suspense` boundary: separación clara

Convención:

- Un `Suspense` boundary vive en `page.tsx` (o en el wrapper inmediato de `page.tsx`), envuelve un `<XxxContainer />`.
- El container es un server async component que hace su query, atrapa errores, y devuelve `<XxxSection data={…} />` o `<SectionFallback message={…} />`.
- La sección presentacional (`XxxSection`) ya existe en `_components/` para hero, wallet y archived — solo cambian sus wrappers.

Esto mantiene los componentes presentacionales "tontos" y desacopla la política de error/loading del rendering.

### 7. El page.tsx server hace el auth check pero nada más

`const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login')` se queda en `page.tsx`. Es el mismo patrón que dashboard. Auth check es barato (lo hace el middleware igual, esto es defensive) y mantenerlo server-side garantiza el redirect antes del primer paint.

## Risks / Trade-offs

- **[Riesgo] Tres queries client-side en el header pueden mostrar el botón disabled por más tiempo del que las queries server-side tardarían en un solo round-trip.** → Mitigación: las tres se disparan en paralelo y son baratas (`accounts` con `head: true`, dos catálogos chicos). En la práctica se completan en <200ms en condiciones normales.
- **[Riesgo] El `SectionFallback` importado cross-route crea acoplamiento entre cards y dashboard.** → Mitigación aceptada: el componente es estable y trivial; cuando aparezca un tercer consumidor se mueve. Riesgo materialmente bajo.
- **[Riesgo] Si una RLS o el shape de `accounts`/`institutions`/`card_networks` cambia, las queries inline del header rompen sin que TypeScript de las server queries lo detecte.** → Mitigación: usar los tipos generados de Supabase (`Database['public']['Tables']['accounts']['Row']`) en el header para tener el mismo nivel de cobertura de tipos que las queries server.
- **[Trade-off] Doble round-trip a credit cards (activos y archivados separados).** → Aceptado por aislamiento de errores. Reversible si métricas lo justifican.
- **[Trade-off] Cuatro componentes nuevos para algo que era una sola page server.** → Aceptado: cada uno tiene responsabilidad única y el page.tsx queda casi vacío, lo que hace más fácil agregar más secciones después.
