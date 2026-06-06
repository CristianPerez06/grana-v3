## ADDED Requirements

### Requirement: Variant C aplica también a rutas hijas con loading.tsx

Cualquier ruta hija bajo `apps/web/app/(app)/<section>/**` que actualmente renderice su `PageHeader` (o equivalente) dentro de `page.tsx` y dependa de un `loading.tsx` (propio o heredado de un segmento padre) como fallback durante el `await` server-side, SHALL adoptar Variant C:

1. La ruta SHALL definir un `<ruta>/layout.tsx` (server component) que renderice el chrome persistente del segmento. El layout SHALL ser **efectivamente sync**: los únicos `await` permitidos son operaciones rápidas in-memory (`await params`, `await getTranslations()`). El layout NO SHALL hacer fetches a DB / red / cualquier I/O lento antes de renderizar el chrome, porque Next bloquea el output del layout hasta que todos sus awaits resuelven — durante ese tiempo, lo que el usuario ve es el `loading.tsx` del segmento padre, no el chrome del layout. El chrome SHALL incluir como mínimo el back-link al parent inmediato, usando el estilo canónico `← {label}` (clases `text-sm text-muted-foreground hover:text-foreground transition-colors`). El chrome MAY incluir título textual, descripción y action slot según el shape de la ruta. Si el chrome necesita data dinámica (nombre del recurso, descripción), las opciones son: (a) usar label/título estático de translation-key y mover la info dinámica al cuerpo del page como sub-header; (b) usar `<Suspense>` con un async child component que fetchea y se streamea (requiere que la prop del consumer acepte ReactNode). Opción (a) es la default.

2. La ruta SHALL definir un `<ruta>/loading.tsx` que renderice **solo skeletons del cuerpo** del segmento (filas, cards, secciones), encapsulados en los mismos containers de layout (max-w, gap) que el `page.tsx`. El `loading.tsx` SHALL NO usar `PageHeaderSkeleton` ni ningún otro skeleton que tape el back-link, el título o el action slot del chrome.

3. Si el chrome incluye acciones que dependen de data asincrónica para habilitarse (botones que abren drawers, navegación gateada), el slot de acciones SHALL renderizar el botón en su posición final con `disabled={true}` mientras la data no esté lista. NO SHALL ocultarse, reemplazarse por skeleton, ni renderizar `null`.

4. Si el chrome incluye un título dinámico (depende de data del recurso: nombre de cuenta, de tarjeta, label de período, descripción de recurrencia), el componente SHALL renderizar un placeholder no-breaking-space (`' '`) o equivalente que reserve la altura del título sin mostrar texto, hasta que la data resuelva — mismo patrón que `CategoriesHeader`. El back-link y el slot de acciones SHALL renderizarse siempre, independientemente de si el título dinámico resolvió.

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
- **AND** si el fetch del layout falla o devuelve null, el back-link cae a `← {placeholder}` (`' '`) pero la flecha y el link al parent siguen siendo navegables
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
