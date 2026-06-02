## Context

`/transactions` es la ruta más compleja del módulo web: combina lista paginada con filtros + búsqueda + navegación por mes + toggle ARS/USD + toggle egresos/ingresos + drill-down de subcategorías + bloques side-car (recurrencias pendientes, sugerencia de recurrencia, reembolsos pendientes, breakdown del mes). Hoy todo eso se fetchea en un único `page.tsx` server component que hace ~13 awaits antes del primer render.

El estado interactivo del usuario hoy se modela como **query string**. Cada toggle (mes, currency, mode, categoría, búsqueda, limit, drill-down) es una navegación que muta la URL y dispara un nuevo render server-side de toda la ruta. Eso genera tres familias de helpers (`parseMovementFilters`, `resolveEmptyVariant`, `parseMovementLimit`, `buildFiltersClearedHref`, `buildSearchClearedHref`, `buildMovementLimitHref`, `shiftMonth` como href builder) que solo existen porque la URL es el source of truth.

Cada mutación (crear, editar, borrar, confirmar recurrencia, marcar reembolso, etc.) llama `router.refresh()`, que purga el RSC cache de la ruta actual y re-renderiza el `page.tsx` entero. Funciona, pero es coarse-grained: no hay forma de invalidar solo una sección.

Cuando llegue la app mobile (Expo + Expo Router + TanStack Query, decidido en otro change), nada de esto se va a poder reusar. RN no tiene URL params. Mobile va a manejar filtros como state, queries como `useQuery`, e invalidación con `queryClient.invalidateQueries`. Si dejamos `/transactions` web como RSC + URL, tenemos dos modelos de datos paralelos para la misma feature.

Otros routes del repo (`/dashboard`, `/accounts`, `/cards/[id]`) están bien con RSC: son read-only, sin interactividad de filtros, ya implementan el patrón "in-page chrome" del spec `route-loading-and-errors`. No tiene sentido tocarlos.

## Goals / Non-Goals

**Goals:**

- Header de `/transactions` visible desde el primer paint; nunca tapado por un fallback de pantalla completa.
- Acción primaria del header (`RegisterMovementButton`) disabled hasta que `accounts + categories + household` (data que el drawer necesita para abrir) estén listas. Habilitada el resto del tiempo.
- Cada sección (`RecurrenceSuggestionBanner`, `PendingRecurrencesBlock`, `CategorySpendingOverview`, `PendingReimbursementsBlock`, `MovementFilters`, `MovementList`) fetchea independientemente; cada una muestra su propio loading/error in-place; ninguna bloquea las otras.
- Filtros viven en React state, no en URL. F5 los limpia (comportamiento intencional, alineado con la mayoría de SPAs).
- Invalidación de mutations es granular vía TanStack `queryKey`, con helpers semánticos por familia de acción.
- Paridad de modelo de datos con mobile: cuando mobile aterrice, importa las mismas queries y las consume con TanStack del mismo modo.
- Mutations server-side llaman `revalidatePath` para mantener `/dashboard`, `/accounts`, `/cards` frescos (RSC cache).

**Non-Goals:**

- Migrar `/dashboard`, `/accounts`, `/cards/[id]` a client. Esas rutas funcionan, no tienen UX equivalente, y migrarlas tendría costo desproporcionado.
- Optimistic updates en las mutations. TanStack los soporta; lo dejamos para un follow-up si la UX lo pide.
- Persistir filtros entre sesiones (localStorage) o entre tabs (sessionStorage). F5 = reset es la regla; si después aparece pedido concreto se evalúa.
- Cambiar el contrato `Movimiento` ni cualquier signature de query/action existente.
- Mover los componentes hijos (`/transactions/new`, `/transactions/[txId]`, `/transactions/recurring/*`) — son páginas separadas con sus propios models de fetching.
- Deep-linking a un mes/filtro específico. Hoy nadie linkea con params (verificado por grep); si en el futuro hay necesidad real (notifs, emails), se evalúa hidratar desde search params como `initialState` — pero ese es otro change.

## Decisions

### D1: TanStack Query como cache + fetching del cliente

**Decisión**: Adoptar `@tanstack/react-query` en `apps/web`. Cada sección de `/transactions` usa `useQuery` con un `queryKey` semántico estable.

**Por qué**:
- Es el estándar de facto para este patrón en React; bien soportado, bien documentado.
- Maneja staleTime, refetch on focus, dedupe de queries idénticas, invalidación por prefijo de key, garbage collection — todo lo que necesitaríamos hacer a mano.
- Es lo que va a usar `apps/mobile`. Compartir lib unifica el mental model.

**Alternativas consideradas**:
- **SWR**: API más simple pero menos features (peor invalidación por prefijo, menos control sobre staleTime). TanStack es marginalmente más complejo pero mucho más capaz.
- **Server actions + estado local manual + revalidate**: requiere escribir nuestro propio cache. Inviable.
- **Apollo / urql**: para REST overkill. Solo si tuviéramos GraphQL.

### D2: Filtros en `useReducer` con un `FiltersContext`

**Decisión**: Los filtros (mes, currency, type, categoryId, subcategoryId, accountId, query, overviewMode, limit) viven en un `useReducer` envuelto por un `FiltersContext` que el shell de la ruta provee. Componentes consumen vía `useTransactionsFilters()`.

**Por qué**:
- El state tree tiene ~10 campos y media docena de acciones (`setMonth`, `setCurrency`, `setCategory`, `setOverview`, `clearAll`, `clearSearch`, `setLimit`, `nextMonth`, `prevMonth`, etc.) — un reducer encaja mejor que useState múltiples.
- Lo leen ~5 componentes en distintas profundidades; un context dedicado es la forma idiomática React.
- Centralizado, fácil de testear (el reducer es pura función).

**Alternativas consideradas**:
- **Zustand**: overkill para un scope tan acotado y sin necesidad de selectores sofisticados.
- **`useState` múltiples + prop drilling**: feo y propenso a errores cuando son 10 fields.
- **`nuqs` (state-in-URL)**: contradice el goal explícito de salir de URL-state.

### D3: Header visible siempre; button gated en `useQueries` de drawer data

**Decisión**: `TransactionsHeader` es un client component. Usa `useQueries` para pedir simultáneamente `accounts`, `categories`, `household`. El botón `RegisterMovementButton` mira `isPending` agregado: si alguna está pending → disabled. Si todas resolvieron → enabled. Si alguna falló → enabled pero el click muestra un toast de "no se pudo cargar el formulario, recargá" (degraded mode).

**Por qué**:
- Es el caso de uso exacto del Requirement #5 del spec `route-loading-and-errors`, adaptado a client.
- `useQueries` evita el problema del callback-up-to-parent que discutí antes: TanStack ya tiene un estado agregado natural.
- El degraded mode en error evita lockup del UI ante un fallo aislado de una query.

**Alternativas consideradas**:
- **`<Suspense>` + server component**: no aplica si el resto pasa a client; el header tendría que ser una excepción y se rompe la coherencia.
- **Una sola query "drawer-ready" que awaitea las tres y devuelve `{ accounts, categories, household }`**: viable, pero pierde la posibilidad de servir individualmente (`accounts` lo van a necesitar también los warnings de balance, los filtros, etc.). Mejor cachear cada una con su propia key.

### D4: 4 helpers semánticos de invalidación, no invalidación inline

**Decisión**: Crear `lib/transactions/invalidation.ts` con cuatro funciones puras:

```ts
invalidateAfterMovementMutation(queryClient)
invalidateAfterRecurrenceInstanceMutation(queryClient, { confirmed: boolean })
invalidateAfterReimbursementMutation(queryClient)
invalidateAfterSuggestionMutation(queryClient)
```

Cada componente que dispara una mutation llama el helper correspondiente en su `onSuccess`. La lista de keys a invalidar es decisión central, no del callsite.

**Por qué**:
- Las invalidations correctas son un detalle fácil de olvidar/desincronizar entre callsites. Centralizarlas hace que el régimen sea testeable y refactorable de un solo lado.
- El "qué invalidar" cambia si agregamos queries nuevas; un solo punto de update.

**Alternativas consideradas**:
- **Una sola `invalidateAll()` que tira `queryClient.invalidateQueries()` sin key**: simple pero golpea todo, incluyendo cosas que no cambiaron (los datos del drawer, etc.). Suficiente al principio, pero pierde la granularidad que estamos pagando con TanStack.
- **Mantener `router.refresh()`**: no resuelve el problema (sigue siendo coarse-grained y no es invalidación de TanStack — los `useQuery` no se enteran).

### D5: Cross-route freshness vía `revalidatePath` en server actions

**Decisión**: Cada server action de mutation que afecta data visible en otras rutas llama `revalidatePath` server-side antes de retornar. Centralizado en helpers:

```ts
// app/_actions/_helpers.ts
export function revalidateAfterMovementMutation() {
  revalidatePath('/dashboard')
  revalidatePath('/accounts', 'layout')
  revalidatePath('/cards', 'layout')
}
```

Las actions de `transactions.ts`, `recurrences.ts`, `reimbursements.ts` lo llaman en cada función de mutación (create/update/delete + confirm/skip/cancel).

**Por qué**:
- Sin esto, el usuario crea un gasto en `/transactions`, navega al dashboard, y ve balance stale (porque el RSC cache no se invalidó).
- `revalidatePath` es la forma canónica de invalidar el RSC cache cross-route en Next.
- Funciona en paralelo a la invalidación TanStack: el cliente refetcha sus queries del lado de `/transactions`, el server invalida su cache para las próximas navegaciones a otras rutas.

**Alternativas consideradas**:
- **`revalidateTag` con tags por dominio**: más granular (`revalidateTag('movements')` invalida solo eso). Mejor a largo plazo, pero requiere taggear cada `fetch` que hace Next, y nuestras queries son a Supabase directo (no via `fetch` taggeable). Posible futuro refactor.
- **Llamar `router.refresh()` desde el cliente al onSuccess**: refresca la ruta actual, no las otras. No resuelve el problema.

### D6: Server actions wrap-eando las queries existentes para consumo TanStack

**Decisión**: Para cada query que el cliente necesita llamar, exponer una server action wrapper en `app/_actions/transactions.ts` (o `_actions/queries.ts` nuevo) que retorna el mismo shape que la función actual de `lib/transactions/queries.ts`. TanStack usa estas actions como `queryFn`.

```ts
// app/_actions/queries.ts
'use server'
export async function getMovementsPageAction(input: GetMovementsInput) {
  return getGlobalMovementsPage(input)
}
```

```ts
// en el cliente
useQuery({
  queryKey: ['transactions', 'page', filters, limit],
  queryFn: () => getMovementsPageAction({ filters, limit }),
})
```

**Por qué**:
- Mantiene las queries existentes (`lib/transactions/queries.ts`) sin tocar. Son agnósticas del runtime; las usa `/dashboard`, `/accounts`, etc.
- Las server actions reusan el supabase client con la sesión del usuario sin exponer credenciales.
- Es el patrón recomendado por Next 14+ para llamar lógica server-only desde el cliente sin endpoints REST manuales.

**Alternativas consideradas**:
- **Endpoints `/api/transactions/...`**: más overhead (más código, más boilerplate, manejo manual de auth). Server actions ya cubren el caso.
- **Llamar Supabase desde el cliente directamente con RLS**: posible pero duplica la lógica que hoy vive en `queries.ts` (joins, mappers, etc.). Y nuestras queries no son triviales — hacen attach de linked expenses, recurrence linkage, etc.

### D7: staleTime por familia de query

**Decisión**: Configurar staleTime conservador en el `QueryClient`:

```
['accounts','list']               5min
['categories','tree']              15min
['household','detail']             15min
['transactions','filter-options']  2min
['transactions','page']            0
['transactions','breakdown']       0
['transactions','pending-reimbursements']  0
['recurrences','pending-instances']  0
['recurrences','top-suggestion']   5min
['transactions','has-any']         Infinity
```

**Por qué**:
- Las queries "lentas de cambiar" (accounts/categories/household) tienen staleTime alto: refetch innecesario en cada cambio de filtro sería ridículo.
- Las queries "rápidas" (movements page, breakdowns) tienen staleTime 0: confiamos en invalidations explícitas post-mutation; entre tanto se evita refetch en navegación interna.
- `has-any` solo flip-ea en el primer movimiento de la vida del usuario → cache para siempre, invalidate en create.

**Alternativas consideradas**:
- **Default global de 0**: causa refetches en cada montaje. Aceptable pero perceptiblemente más spinner-y.
- **Tiempo muy largo en todas**: causa data stale tras mutations si la invalidación falla. Más arriesgado.

### D8: Granularidad del shell

**Decisión**: El árbol de componentes nuevo:

```
page.tsx (sync, server)
  └─ <TransactionsQueryProvider>      ← QueryClientProvider envuelto
       └─ <FiltersProvider>            ← reducer + context para filtros
            └─ <TransactionsShell>     ← client; pasa por compose ↓
                ├─ <TransactionsHeader>    ← drawer-ready useQueries; button gating
                │     └─ <RegisterMovementButton disabled={!ready} />
                ├─ <RecurrenceSuggestionBanner>   ← useQuery top-suggestion
                ├─ <PendingRecurrencesBlock>       ← useQuery pending-instances + accounts
                ├─ <CategorySpendingOverview>      ← useQuery breakdowns
                ├─ <PendingReimbursementsBlock>    ← useQuery pending-reimbursements
                ├─ <MovementFilters>               ← lee filtros del context, useQuery filter-options
                ├─ <MovementList>                  ← useQuery movements page + linked-recurrence-ids
                └─ <QuickAddFab>                   ← link estático, no necesita query
       <MovementDrawerProvider>        ← se mueve adentro de TransactionsShell para usar las useQueries cacheadas
```

**Por qué**:
- Provider de filtros separado del provider de query: una refactor de uno no impacta al otro.
- `MovementDrawerProvider` adentro del shell tiene acceso a las queries cacheadas; el header le pasa los datos cuando están listos.

**Alternativas consideradas**:
- **Filtros en context separado del shell, montado en `page.tsx`**: hace ruido (provider extra en server) y no tiene beneficio funcional.

## Risks / Trade-offs

**Riesgo: regresión funcional en empty states / clear actions / month nav.**
Los empty-state variants (welcome, month-empty, search-empty, filter-empty) son ricos y tienen lógica condicional. La búsqueda con clear-search, el filter chip removal, el "ver detalle" del overview — todo eso pasa de URL-driven a state-driven. Es fácil romper un caso edge.
**Mitigación**: smoke test manual cubriendo cada empty variant + cada clear action + cada nav (mes anterior/siguiente, currency toggle, mode toggle, drill-in de categoría, drill-back de subcategoría). Documentar el plan de test en `tasks.md`.

**Riesgo: olvido de `revalidatePath` en una server action → cross-route stale.**
Si una nueva mutation aparece y se olvida llamar el helper, `/dashboard` muestra balance viejo hasta el próximo reload natural.
**Mitigación**: lint rule custom? Demasiado para el scope. En su lugar: 1 helper único, llamarlo en *todas* las actions identificadas, y dejar comentario marcador "// see invalidation helpers — keep in sync" en `lib/transactions/invalidation.ts`.

**Riesgo: TanStack Query agrega bundle size a `/transactions`.**
La librería pesa ~13KB gzipped. Aceptable, especialmente porque va a usarse en mobile también (mismo paquete vía pnpm workspace).
**Mitigación**: ninguna inmediata; medirlo después y revisar si justifica.

**Riesgo: server actions tienen overhead vs. server components.**
Cada `useQuery` que dispara una action es un POST al server. Para la primera carga, 7-8 actions en paralelo. vs. RSC que sería un único stream. Posible degradación de TTFB.
**Mitigación**: medirlo. Si es relevante, evaluar batch query (`useQueries` con una action que retorna múltiples slices). En la práctica, Next bundle-ea las server actions agresivamente y la diferencia debería ser baja.

**Riesgo: el primer paint muestra más skeletons que hoy.**
Hoy la pantalla se mantiene en `loading.tsx` mientras todo resuelve, después salta a "todo poblado". En el nuevo modelo: pantalla aparece con header + skeletons por sección, y cada uno se rellena en su tiempo.
**Mitigación**: es trade-off deliberado del modelo de streaming. Mejor UX en la mayoría de casos (el usuario ve estructura inmediatamente), peor en caso de "todo carga rápido y los skeletons parpadean". Skeletons bien diseñados (no demasiado largos) lo hacen tolerable.

**Riesgo: cambio de comportamiento de back/forward del browser.**
Hoy: cambiar mes pushea historia → back vuelve al mes anterior. Nuevo: cambiar mes no toca historia → back sale de `/transactions` directo.
**Mitigación**: es trade-off explícito y se documenta. En la mayoría de casos el usuario espera back = "volver al dashboard", no "volver al filtro anterior". Si después hay queja, evaluar `history.pushState` selectivo en cambios "grandes" como mes.

## Migration Plan

Es un cambio de una sola ruta sin afectar API/DB. Migration plan:

1. Implementar todo el shell nuevo en paralelo al `page.tsx` actual (sin desactivar el viejo).
2. Renombrar el `page.tsx` viejo a `page.legacy.tsx` (no se exporta de Next pero queda para diff/comparación durante review).
3. Activar el nuevo `page.tsx`. Smoke test manual de todo el flujo crítico.
4. Una vez verificado en main por unos días, borrar el `page.legacy.tsx` en un follow-up commit.

Rollback: revertir el archivo `page.tsx` al legacy es cuestión de un git revert hasta que se borre el `page.legacy.tsx`. Después de eso, rollback es un revert del PR completo.

## Open Questions

- **¿`@tanstack/react-query` ya está en el monorepo?** Hay que verificar. Si está, usar la versión existente. Si no, agregarla y decidir si vive en root, en `apps/web`, o en un paquete shared.
- **¿`revalidatePath` con segundo argumento `'layout'` es lo correcto?** Documentación dice que invalida todo el segment + niños. Verificar contra nuestro layout group `(app)`.
- **¿Necesitamos un `QueryClient` por request del server, o un singleton es OK?** En Next con server actions, el cliente cachea en cliente; el server no participa. Singleton en `apps/web` debería ser suficiente. Verificar con docs.
- **¿Los tests de `lib/transactions/__tests__/filters.test.ts` se borran o se reescriben?** Como los URL builders desaparecen, los tests específicos de hrefs se borran. Pero los tests de `parseMovementFilters` (o lo que sobreviva como helper de "compute next state" del reducer) podrían tener valor — depende de cuánto se reescriba la lógica.
