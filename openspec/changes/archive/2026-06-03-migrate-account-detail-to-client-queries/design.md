## Context

`/accounts/[id]` es la segunda ruta interactiva de mayor uso del módulo (después de `/transactions`). Hoy:

- `page.tsx` async RSC con `Promise.all` de 5 queries (account detail, account movements full history ascendente, filter options, pending reimbursements scoped, institutions) antes del primer render.
- Filtros viven en la URL (`?month=`, `?currency=`, `?type=`, `?category=`, `?q=`, `?amount_min=`, `?amount_max=`, etc.) y la ruta `parseMovementFilters` cada change.
- `MovementFilters` y `MovementList` se renderizan en "modo URL-driven" (sin `controller` ni callbacks), porque sus props compartidas con `/transactions` permiten ambos modos: cuando hay `controller` dispatchan al reducer, cuando no hay `controller` hacen `router.push` con búsqueda actualizada.
- `computeRunningBalances` corre server-side sobre el historial completo ascendente; el resultado se pasa al `MovementList` cuando `!hasContentFilters(filters)`.
- `EditAccountDrawerProvider` (envuelve todo el body) recibe `account` e `institutions` como props.
- Las mutations de cuenta (`archiveAccount`, `reactivateAccount`, `deleteAccount`, `updateAccount`, etc.) hacen `revalidatePath('/accounts', 'layout')`, lo cual sí cubre la ruta de detalle.

El cambio anterior (`migrate-transactions-to-client-queries`) montó:
- `AppQueryProvider` en `(app)/layout.tsx` (`QueryClient` global con `staleTime` defaults).
- Reducer + context de filtros (`filters-state.ts` + `filters-context.tsx`) testeable y reusable.
- Containers cliente (`MovementListContainer`, `MovementFiltersContainer`, etc.) que hablan TanStack.
- Helpers semánticos de invalidación (`lib/transactions/invalidation.ts`) y de `revalidatePath` (`app/_actions/_helpers.ts`).
- `MovementFilters` y `MovementList` aceptan `controller?` opcional para soportar `/accounts/[id]` URL-driven en paralelo durante el cutover.

Este change cierra ese paréntesis y elimina el dual-mode.

## Goals / Non-Goals

**Goals:**

- Header de `/accounts/[id]` visible desde el primer paint; nunca tapado por un fallback de pantalla completa.
- Balances ARS/USD del header muestran skeleton (no la pantalla entera) mientras la query resuelve.
- Botón "Editar" del header disabled hasta que `account` + `institutions` (data del drawer) estén listas; fallback al link `<a>` `/accounts/[id]/edit` cuando alguna falla.
- Cada sección (`PendingReimbursementsBlock`, `MovementFilters`, `MovementList`) fetchea independientemente; cada una muestra su propio loading/error in-place; ninguna bloquea las otras.
- Filtros viven en React state (mismo reducer que `/transactions`), no en URL. F5 los limpia.
- Filtro de cuenta NO se muestra (route-scoped); se inyecta como prop fija del shell al adaptar la query.
- Running balance se computa client-side cuando no hay filtros de contenido activos.
- Invalidación de mutations sigue siendo granular vía TanStack; helpers semánticos reusados; las actions de account suman invalidación del account-detail query key.
- Cleanup completo de `lib/transactions/filters.ts`: parsers/builders/predicados muertos eliminados; constantes y types se relocan donde corresponda.

**Non-Goals:**

- Migrar `/dashboard`, `/accounts` (lista) ni `/cards/[id]` a client. Esas rutas funcionan, no tienen UX equivalente, y siguen RSC.
- Cambios al data layer (`lib/accounts/queries.ts`, `lib/transactions/queries.ts`) más allá de envolverlas en server actions wrappers.
- Optimistic updates en las mutations de account.
- Persistir filtros entre sesiones o entre tabs.
- Cambiar el contrato `AccountWithBalances` ni cualquier signature de query/action existente.
- Deep-linking a un mes/filtro específico desde `/accounts/[id]` (consistente con la decisión que se tomó para `/transactions`).

## Decisions

### D1: Reusar el reducer de filtros existente (no forkear)

**Decisión**: `/accounts/[id]` consume el mismo `filtersReducer` + `FiltersContext` de `lib/transactions/filters-state.ts` y `apps/web/app/(app)/transactions/_components/filters-context.tsx`. Para hacerlo reusable cross-route, el `FiltersProvider` se relocaliza a un módulo neutro (`apps/web/lib/transactions/filters-provider.tsx` o `apps/web/components/transactions-filters/provider.tsx`) que el shell de cada ruta importa.

El shell de `/accounts/[id]` monta el provider con `initialFilters` derivados de `createInitialFilters()`, sin tocar `accountId` (queda en `null` en el state porque el route ya impone el scope) y con el filtro de cuenta oculto vía prop del `MovementFilters` (`showAccountFilter={false}`, ya soportado).

**Por qué**:
- El state shape es idéntico al que necesita `/accounts/[id]` (mes, currency, type, category/subcategory, búsqueda, rango de monto). El único campo que sobra es `accountId`, y el reducer ya tolera dejarlo en `null`.
- Mantener una sola implementación es lo correcto: dos reducers diferentes por la misma feature divergirían rápido.
- El selector "showAccountFilter" del componente `MovementFilters` ya cubre el caso "no mostrar el control de cuenta" sin tocar el reducer.

**Alternativas consideradas**:
- **Reducer separado por ruta**: divergencia inevitable, duplicación de tests.
- **Quitar `accountId` del shape**: rompe el container de `/transactions` que sí lo usa.

**Trade-off**:
- El shape tiene un campo (`accountId`) que `/accounts/[id]` nunca usa. Aceptable; es un `string | null` y queda `null`.

### D2: `page.tsx` mantiene los guards server-side; shell client se monta debajo

**Decisión**: `page.tsx` queda como async RSC mínimo (~20-30 líneas):

```tsx
const AccountDetailPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const account = await getAccountDetail(id)
  if (!account) notFound()
  if (account.type === 'credit') redirect(`/cards/${id}`)

  return <AccountDetailShell accountId={id} />
}
```

El shell client (`<AccountDetailShell>`) recibe solamente `accountId` como prop. Toda la data se re-fetchea desde el cliente vía TanStack — incluyendo `getAccountDetail(id)`, que el guard server-side llamó. La duplicación es aceptable y deliberada (el server-side fetch es solo para el guard; no se hidrata el shell con el resultado).

**Por qué**:
- Los guards `notFound()` y `redirect('/cards/[id]')` SON decisiones terminales: la ruta no debe renderizarse o no debe existir. No tiene sentido pasarlas al cliente con un loading state.
- Auth server-side es el patrón del repo y evita un flash de UI no autenticada.
- Pasar `accountId` solo (no el objeto `account`) mantiene el contrato simple: el shell es responsable de su propio fetching.
- La duplicación de fetch (server guard + client TanStack) es marginal y no introduce inconsistencias: ambos llaman la misma función y el cliente cachea su resultado para las siguientes secciones.

**Alternativas consideradas**:
- **Hidratar el shell con el account inicial**: requiere serializar la response a través del boundary RSC→client. Para una sola query es razonable, pero suma complejidad y un punto de divergencia (¿qué pasa si la query del cliente devuelve algo distinto?). Mejor que el cliente sea siempre la fuente de verdad.
- **Mover todos los guards al cliente**: peor UX (flash, loading antes de redirect) y rompe con el patrón del repo.

### D3: Header con `useQuery` y skeleton para los balances

**Decisión**: `AccountDetailHeader` se convierte en un client component que:

- Lee `accountId` del shell vía prop o context.
- Hace `useQuery({ queryKey: ['account', 'detail', accountId], queryFn: () => getAccountDetailAction(accountId), staleTime: 0 })`.
- Renderiza desde el primer paint: back link a `/accounts` (estático), avatar + nombre (usando `account?.name` y `account?.avatar`; si está pending, renderiza un skeleton para avatar + 2/3 del ancho del texto).
- Balances ARS/USD muestran skeleton (`<Skeleton className="h-9 w-32" />`) mientras la query está pending; cuando resuelve, se renderizan los números.
- Botón "Editar": `disabled` cuando `accountQ.data === undefined || institutionsQ.data === undefined`. Cuando ambos resuelven, llama `editDrawer.openEdit()`. Cuando `accountQ.error` o `institutionsQ.error`, cae al link `<a href="/accounts/[id]/edit">` (fallback existente).
- Las acciones archive/reactivate/delete dependen de `account` (para saber el estado y si tiene transacciones). Mientras `accountQ.data === undefined`, el bloque de acciones se renderiza como skeleton pequeño (un placeholder de ~80px de ancho). Cuando resuelve, se renderizan los botones reales.

**Por qué**:
- Es la mecánica idéntica a `TransactionsHeader` post-migración. Coherencia cross-route.
- Skeleton específico (no full-screen) es el ajuste fino del patrón "in-page chrome": el header existe desde t=0; solo el contenido dinámico tiene su propia transición.
- El fallback a link `<a>` ya existe en el componente (cuando no hay `editDrawer` context); reusarlo cuando el drawer no está listo evita lockup.

**Alternativas consideradas**:
- **Hidratar con datos parciales server-side**: hace al shell impuro (recibe parte de la data, el resto lo fetchea). Mejor que sea uniformemente client.
- **Mantener acciones disabled hasta que account resuelva**: equivalente; el skeleton da feedback visual más claro.

### D4: Running balance se computa client-side

**Decisión**: `MovementListContainer` (variante account) hace `useQuery` para:

- **Página visible**: `getAccountMovementsPageAction({ accountId, filters, limit })` — devuelve `{ movements, hasMore }` con filtros aplicados, paginado.
- **Historial ascendente (running balance source)**: `getAccountMovementsAscendingAction({ accountId })` — devuelve el historial completo de la cuenta en orden ascendente, sin filtros. Esta query corre con `staleTime` alto (~1 min) y se invalida explícitamente en cada mutation que afecta movimientos de la cuenta.

El container computa `runningBalances` con `computeRunningBalances` (`@grana/money-logic`, ya es código pura y agnóstico de runtime) sobre el historial ascendente, una sola vez por cambio de la data ascendente (memoizado con `useMemo`). El resultado se pasa al `MovementList` cuando `!hasActiveContentFilters(filters)` (mismo predicado que ya existe en `filters-state.ts`).

**Por qué**:
- `computeRunningBalances` no toca DB ni I/O; es funcional puro. Correr client-side es seguro y elimina el roundtrip extra al server.
- Separar las dos queries (página visible + historial completo) le permite a TanStack cachear ambas independientemente: el historial cambia solo en mutations; los filtros cambian la página pero no el historial.
- El historial completo de una cuenta es bounded (raramente >5k movimientos en cuentas reales); la transferencia es aceptable. Si una cuenta llega a tener decenas de miles de movimientos, se evalúa paginar el historial ascendente y recalcular incrementalmente — está fuera del scope inicial.

**Alternativas consideradas**:
- **Query única que devuelva movements + runningBalances ya computados**: viable, pero acopla balance al filtering. Cada cambio de filtro re-corre el cómputo server-side. Peor UX y peor para cache.
- **Endpoint dedicado `getAccountRunningBalancesAction({ accountId })`** que devuelve solo el snapshot final por moneda: necesita ser invocado per-row o por chunk visible para construir el balance histórico. Demasiado granular para ganancia marginal.

### D5: Account-scoped queries via server actions wrappers

**Decisión**: Agregar al `app/_actions/queries.ts` los wrappers necesarios:

```ts
'use server'

export async function getAccountDetailAction(id: string) {
  return getAccountDetail(id)
}

export async function getAccountMovementsAction(accountId: string) {
  return getAccountMovements(accountId) // historial ascendente completo
}

export async function getAccountMovementsPageAction(input: {
  accountId: string
  filters: AccountMovementFiltersAdapted
  limit: number
}) {
  return getAccountMovementsPage(input) // nueva función en queries.ts
}

export async function getInstitutionsAction() {
  return getInstitutions()
}

export async function getPendingReimbursementsForAccountAction(accountId: string) {
  return getPendingReimbursements(accountId) // ya existe, accepta accountId opcional
}
```

`getAccountMovementsPage` es **nueva** en `lib/transactions/queries.ts` (o `lib/accounts/queries.ts`, según donde encaje semánticamente): aplica los mismos filtros que el server-side hoy hace inline en el `page.tsx` (rango de fechas según month/customRange, type, currency, category, subcategory, amountMin/amountMax, búsqueda de texto). Es la versión "scoped a cuenta" de `getGlobalMovementsPage`.

**Por qué**:
- Mantener el filtering server-side preserva la performance: la DB hace el trabajo, no el cliente.
- `getAccountMovements` (historial ascendente sin filtros) ya existe; se reusa.
- Refactor mínimo: la función nueva extrae la lógica que hoy vive inline en `page.tsx`.

**Alternativas consideradas**:
- **Filtrar client-side sobre el historial completo**: viable porque ya tenemos el historial cargado para el running balance. Más simple. Pero rompe el patrón de paginación: si una cuenta tiene 5k movimientos, cargarlos siempre es OK para balance pero no para mostrarlos todos. Mejor mantener filtering server-side y dejar el historial completo como query separada solo para balance.
- **Una sola query que devuelva ambas listas**: acopla filters con balance. Mismo problema que D4.

### D6: `EditAccountDrawerProvider` adentro del shell, hidratado por TanStack

**Decisión**: Mover `EditAccountDrawerProvider` adentro del shell client. Crear un `EditAccountDrawerLoader` que:

- Hace `useQueries` para `account` (key compartida con el header — single source of truth) e `institutions`.
- Cuando ambas resuelven, monta `<EditAccountDrawerProvider account={...} institutions={...}>{children}</EditAccountDrawerProvider>`.
- Mientras no resuelven, renderiza `children` directamente (sin provider). El header en ese estado renderiza el botón "Editar" disabled o como link `<a>` a `/accounts/[id]/edit`.

**Por qué**:
- `EditAccountDrawerProvider` necesita `account` e `institutions` como props. Hidratarlas vía TanStack mantiene la coherencia con el resto del shell.
- No bloquear el render del shell mientras el drawer no está listo; el link `<a>` de fallback ya cubre la opción no-JS.

**Alternativas consideradas**:
- **Mantener `EditAccountDrawerProvider` recibiendo props server-side**: requiere que el `page.tsx` siga awaiteando esas queries. Defeats el propósito.
- **Eliminar el drawer y dejar solo el link a `/edit`**: regresión funcional; el drawer es feature deliberada (`redesign-movement-form-as-drawer` change archivado).

### D7: Generalización vs. variantes específicas de los containers

**Decisión**: Crear `MovementListAccountContainer` y `MovementFiltersAccountContainer` como **nuevos** containers en `apps/web/app/(app)/accounts/[id]/_components/`, en vez de generalizar los existentes con un prop `perspective`.

Razones:

- **`MovementFiltersContainer`** de `/transactions` cuenta con `getMovementFilterOptionsAction()` que devuelve cuentas + categorías. La variante account omite el control de cuenta (`showAccountFilter={false}`) y puede saltarse el fetch de `accounts` (no se necesita). Lógicamente es un container distinto.
- **`MovementListContainer`** de `/transactions` usa `getMovementsPageAction()` (global). La variante account llama `getAccountMovementsPageAction()` y suma una segunda query para el historial ascendente + running balance. Bastante divergencia para que un solo container con flags se vuelva un árbol de condicionales.

Ambos containers **reusan**: el `MovementFilters` y `MovementList` components (mismos primitivos), el reducer (`useTransactionsFilters`), los helpers de predicates (`hasActiveContentFilters`, `hasActiveSearch`), y los query keys de TanStack.

**Por qué**:
- DRY a nivel de componente visual (`MovementFilters`, `MovementList`) está garantizado: ahí es donde el costo de fork sería alto.
- DRY a nivel de container forzaría un objeto `perspective: { kind: 'account' | 'global'; accountId?: string }` con ramas en todos lados. Más legible mantenerlos separados y aceptar la duplicación de ~30 líneas de glue.

**Alternativas consideradas**:
- **Un solo `MovementListContainer({ perspective })`**: viable pero el árbol de condiciones (queryFn distinta, second query para historial solo en account, empty-state copy distinta, etc.) sería frágil. Preferimos coupling claro con la ruta.
- **Compartir un `useMovementListData(perspective)` hook**: posible follow-up si el code-shape se estabiliza, pero no se justifica de entrada.

### D8: Cleanup de `lib/transactions/filters.ts` ya en este change

**Decisión**: Una vez `/accounts/[id]` no consume más URL state, ejecutar el cleanup completo de `lib/transactions/filters.ts` en el mismo change (no en un follow-up):

**Eliminar:**
- `parseMovementFilters`
- `buildClearedHref` (interno)
- `buildFiltersClearedHref`
- `buildSearchClearedHref`
- `hasContentFilters`
- `hasSearch`
- `hasOtherContentFilters`
- `resolveEmptyVariant`
- `MovementEmptyVariant` type
- `movementMatchesText`
- Constantes `FILTER_PARAM_KEYS`, `CONTENT_FILTER_PARAM_KEYS`

**Preservar (vivas):**
- `SUBCATEGORY_NONE_MARKER` (consumida por `dashboard/category-teaser-container`, `overview-container`, `_actions/queries`)
- `monthOf`, `shiftMonth` (consumidas por el reducer y la query)
- `MovementFilters` type (consumida por la query y el reducer adapter)
- `MovementCurrencyFilter`, `MovementTypeFilter`, `MOVEMENT_TYPE_KEYS`
- Constantes de limit: `DEFAULT_MOVEMENTS_LIMIT`, `MOVEMENTS_LIMIT_STEP`, `MAX_MOVEMENTS_LIMIT`
- `resolveMonthRange` re-export

Las preservadas pueden mantenerse en `filters.ts` (no es necesario relocarlas) o moverse a `filters-state.ts` / `month.ts` si el nombre del archivo `filters.ts` queda confuso. **Decisión por simplicidad**: mantener el archivo, eliminar solo lo muerto. Rename queda como housekeeping opcional para un follow-up.

**Eliminar también:**
- En `MovementFilters` component: las ramas `if (!controller) setParamsUrl(...)`, la función `setParamsUrl` y sus dependencias (`useRouter`, `useSearchParams`, `usePathname`). El componente queda controller-only.
- En `MovementList` component: las props `emptyState.clearHref` y `emptyState.addHref`. El componente acepta solo `onClear` y `onAdd` como callbacks.
- `lib/transactions/__tests__/filters.test.ts`: bloques que cubren `parseMovementFilters`, `buildFiltersClearedHref`, `buildSearchClearedHref`, `resolveEmptyVariant`, `hasContentFilters`, `hasOtherContentFilters`, `hasSearch`, `movementMatchesText`. Si quedan tests vivos para `monthOf`, `shiftMonth`, etc., el file sobrevive minimal.

**Por qué hacerlo en este change**:
- Es la consecuencia directa de la migración. Dejarlo como follow-up acumula dead code visible durante la review y deja el riesgo de que el follow-up no llegue.
- El blast radius es acotado: cuatro componentes y un test file, todos cubiertos por typecheck + lint + smoke test.

**Por qué no hacerlo después**:
- (Considerado: separar por menor riesgo) — los tests existentes para los helpers vivos siguen pasando; los muertos se eliminan junto con el código. No hay riesgo adicional.

### D9: Invalidación de mutations que afectan account detail

**Decisión**:

**Cliente (TanStack):**

Agregar a `lib/transactions/invalidation.ts` un nuevo helper:

```ts
export function invalidateAfterAccountMutation(qc: QueryClient, accountId?: string) {
  qc.invalidateQueries({ queryKey: ['account', 'detail', accountId] })
  qc.invalidateQueries({ queryKey: ['accounts', 'list'] })
  qc.invalidateQueries({ queryKey: ['institutions'] })
}
```

`invalidateAfterMovementMutation` (ya existe) cubre la invalidación de movimientos. Para la página `/accounts/[id]`, en cada mutation de movement que el container dispare, se llama `invalidateAfterMovementMutation(qc)` Y `qc.invalidateQueries({ queryKey: ['account', 'detail', accountId] })` para que el running balance source y los balances del header refresquen.

**Server (revalidatePath):**

Las server actions de account ya llaman `revalidatePath('/accounts', 'layout')`, que cubre `/accounts/[id]`. Verificar y, si falta, agregar a `_actions/_helpers.ts`:

```ts
export function revalidateAfterAccountMutation() {
  revalidatePath('/accounts', 'layout')
  revalidatePath('/dashboard')
}
```

Auditar `_actions/accounts.ts` y migrar callsites a este helper (consistencia con el patrón de movements/recurrences).

**Por qué**:
- El head del shell y el balance son derivados de `getAccountDetail` + `getAccountMovements`. Cuando una mutación de movement ocurre, ambas tienen que refrescarse.
- Mantener un helper por familia mantiene el "qué invalidar" centralizado y refactorable de un solo lado (consistencia con D4 del change anterior).

**Alternativas consideradas**:
- **`invalidateQueries()` global**: golpea todo, incluso queries del drawer (`accounts`, `categories`, `household`) que no cambian con la mutación. Aceptable pero pierde la granularidad ganada en el change anterior.

### D10: Tests

**Decisión**:

- **Reducer**: ya está testeado para `/transactions`. Sin tests nuevos del reducer.
- **Filtering server-side para account**: agregar tests para `getAccountMovementsPage(input)` que cubran cada filtro (type, category, subcategory, currency, amountMin/Max, query, month). Vivos en `lib/transactions/__tests__/queries-account.test.ts` o similar (siguiendo convención del repo).
- **Container tests**: no — los containers tienen lógica trivial (orquestar useQuery + dispatch). Cobertura via smoke tests manuales según pattern del change anterior.
- **filters.test.ts**: eliminar los bloques que cubren código muerto. Mantener bloques que cubren helpers vivos (`monthOf`, `shiftMonth`, etc.) si los hay.

**Por qué**:
- Reducer ya está testeado; reusarlo no requiere nuevos tests.
- La query nueva (`getAccountMovementsPage`) es la única superficie con lógica nueva. Tests unitarios cubren el contrato.
- Smoke tests manuales son el bar del repo para UI flows.

## Risks / Trade-offs

**Riesgo: regresión en empty states / clear actions / running balance.**
Los empty variants (welcome, month-empty, search-empty, filter-empty) son ricos. El running balance tiene casos edge (cuenta sin movimientos, cuenta con solo USD, transferencias entrantes, etc.).
**Mitigación**: smoke test manual cubriendo cada empty variant + cada clear action + cada nav (mes anterior/siguiente, currency toggle, type toggle, category drill-in). Verificar que el running balance muestra los mismos números que la versión server-side antes del cutover (comparando a ojo en una cuenta real con varios movimientos).

**Riesgo: doble fetch de `getAccountDetail` (server guard + client TanStack).**
La query se ejecuta dos veces en el primer render: una server-side para el guard, una client-side para hidratar el header.
**Mitigación**: aceptado como trade-off para mantener el shell uniformemente cliente. La segunda llamada se cachea en TanStack desde t=0 si la conexión es rápida (~50ms); no se nota en práctica.

**Riesgo: el historial ascendente completo de cuentas grandes es payload pesado.**
Una cuenta con 10k movimientos podría transferir 1-2MB JSON solo para el running balance.
**Mitigación**: para el alcance inicial, aceptable (la mayoría de cuentas tiene <2k movimientos). Si emerge problema en producción, evaluar paginar el historial ascendente y recalcular incrementalmente — está fuera del scope.

**Riesgo: cleanup de `filters.ts` rompe call-sites no auditados.**
Cuatro componentes y un test file están en la lista. Si algo más consume `parseMovementFilters` o `buildFiltersClearedHref`, el cleanup rompe el build.
**Mitigación**: typecheck + grep antes de borrar. La lista de consumers fue revisada (audit confirmó `/accounts/[id]` + `movement-list-container` + `filters.ts` + `filters.test.ts`); post-migración, los dos primeros ya no consumen los helpers muertos.

**Riesgo: invalidación olvidada en una mutation → balance stale.**
Si una mutation nueva aparece y se olvida invalidar `['account', 'detail', accountId]`, el header muestra balance viejo.
**Mitigación**: helper único `invalidateAfterAccountMutation()` llamado en todos los callsites identificados; comentario marcador en `invalidation.ts`.

**Riesgo: el botón "Editar" disabled durante el primer paint puede confundir al usuario.**
Si el usuario clickea inmediatamente, el botón no responde por ~100-300ms hasta que `account+institutions` resuelven.
**Mitigación**: en práctica no perceptible si la cache de `institutions` está caliente (es una query de `staleTime: 15min`). En cold cache, el skeleton + disabled comunica visualmente que no está listo.

## Migration Plan

Es un cambio de una sola ruta sin afectar API/DB. Migration plan:

1. Implementar todo el shell nuevo en paralelo al `page.tsx` actual (`page.tsx` → `page.legacy.tsx` durante desarrollo si conviene, o trabajar sobre `page.tsx` directamente con commit incremental).
2. Verificar que los containers nuevos funcionan en `/accounts/[id]` sin tocar `/transactions`.
3. Eliminar el modo URL-driven de `MovementFilters` y `MovementList` (sacar las ramas `if (!controller)` y `emptyState.clearHref/addHref`). Validar typecheck.
4. Cleanup de `lib/transactions/filters.ts` y `filters.test.ts`.
5. Smoke test manual del flujo crítico (lista + filtros + drawer + mutations).
6. Lint + typecheck + tests verdes.
7. Commit + push de la branch; merge a main lo hace el usuario.

Rollback: revertir el commit (o secuencia de commits) restaura el modo URL-driven y los helpers eliminados. Ningún cambio de DB ni de API.

## Open Questions

- **¿`getAccountMovementsPage` vive en `lib/transactions/queries.ts` o en `lib/accounts/queries.ts`?**
  - Semánticamente: query de movimientos scoped a cuenta. Pendulo entre los dos módulos. Tiendo a `lib/transactions/queries.ts` por simetría con `getGlobalMovementsPage`, pero `lib/accounts/queries.ts` también sería coherente. A decidir en implementación según donde encaje el código existente con menos fricción.
- **¿`getAccountMovements` (historial ascendente completo) se renombra a `getAccountMovementsAscending` para evitar confusión con `getAccountMovementsPage`?**
  - Razonable. Decidir en implementación; afecta solo a un call-site nuevo.
- **¿El `EditAccountDrawerLoader` debe esperar a ambas queries antes de montar el provider, o solo a `account` (institutions puede llegar después)?**
  - El form interno usa ambas — `EditAccountForm` necesita institutions para el picker. Esperar las dos es lo correcto; durante el wait el botón cae al link fallback.
- **¿Los smoke tests manuales se hacen sobre una cuenta de prueba dedicada o sobre la cuenta real del usuario?**
  - Como se hizo con `/transactions`: cuenta real del usuario, con confirmación step-by-step.
