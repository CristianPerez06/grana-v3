## Why

Después de `per-route-loading-shells` (que llevó `/dashboard` y `/transactions` a Variant C), el resto del shell `(app)` quedó en estados mixtos: `/accounts` y `/cards` todavía tienen su header dentro del `page.tsx` async (Variant A specceada pero implementada como page async que suspende durante navegación), y `/transactions/recurring`, `/transactions/[txId]`, `/settings`, `/transactions/new` no tienen ningún `loading.tsx` propio — al borrar `(app)/loading.tsx`, las transiciones a esas rutas dejan visible la ruta anterior hasta resolver, sin feedback intermedio. Este change completa la cobertura.

**Por qué Variant C también para `/accounts` y `/cards` (no "arreglar" Variant A haciendo el page sync).** El spec post-`per-route-loading-shells` aprobó Variant A para `/accounts` por scope-limitation del change anterior (que tocó solo dashboard y transactions), no porque A fuera estrictamente preferible para esa ruta. Tres razones concretas para migrar a C en este change:

1. **Coherencia con el patrón ya adoptado en el shell.** Dashboard y transactions usan C; mantener accounts/cards en A deja el shell con dos recetas distintas para el mismo problema (chrome persistente + loading shape-matched). Una sola receta baja la carga cognitiva y simplifica el onboarding de rutas nuevas.
2. **Chrome visible desde el primer paint del segmento.** Con A, el header solo aparece cuando el `page.tsx` resuelve sus awaits (auth check defensivo + `getTranslations()`). Con C, el header vive en `layout.tsx` y aparece antes de que el page resuelva — el mismo beneficio por el que dashboard migró.
3. **Elimina duplicación y simplifica el page.** El auth check del `page.tsx` de `/accounts` es redundante con el del `(app)/layout.tsx` (la auth ya está garantizada cuando el page se monta); al mover el chrome al layout, ese check desaparece sin esfuerzo. El page queda como un wrapper trivial del scaffold de Suspense, fácil de leer.

## What Changes

**Variant C migration (header en layout + skeletons en loading.tsx):**

- **MODIFICAR** `/accounts`: crear `accounts/layout.tsx` que monta `<AccountsHeader />` y renderiza `{children}`. Crear `accounts/loading.tsx` con skeletons shape-matched para las dos secciones (active accounts, archived accounts). `accounts/page.tsx` queda sin el header (y sin el auth check, que ya cubre `(app)/layout.tsx`); las translations server-side para los `SectionFallback` siguen viviendo en el page o se mueven a containers async según convenga.
- **MODIFICAR** `/cards`: crear `cards/layout.tsx` con `<CardsHeader />`, crear `cards/loading.tsx` con skeletons shape-matched para las tres secciones (month hero, wallet, archived). `cards/page.tsx` simétrico al de accounts.

**Simple loading.tsx (no Variant C — son pages monolíticos servidor-renderizados que no se prestan a header-en-layout):**

- **AGREGAR** `apps/web/app/(app)/transactions/recurring/loading.tsx`: skeleton con PageHeader placeholder + tabs + lista de filas de recurrencias. Es la ruta más pesada en fetches (recurrences + due instances + accounts + categories) y la que más se beneficia del skeleton.
- **AGREGAR** `apps/web/app/(app)/transactions/[txId]/loading.tsx`: skeleton con PageHeader placeholder + tarjeta de detalle de transacción.
- **AGREGAR** `apps/web/app/(app)/settings/loading.tsx`: skeleton con PageHeader placeholder + bloques de secciones del form.
- **AGREGAR** `apps/web/app/(app)/transactions/new/loading.tsx`: skeleton con PageHeader placeholder + bloques del form de movimiento (campos principales). El usuario suele venir clickeando "Nuevo movimiento" desde dashboard/transactions, así que ver un skeleton es mejor que ver la ruta de origen.
**Variant C migration adicional para `/shared` y sub-rutas:**

`/shared` y sus tres sub-rutas (`/shared/settings`, `/shared/settle`, `/shared/setup`) quedaron fuera del proposal original. Tras la verificación manual se detecta que (a) la transición a /shared queda en "click muerto" porque no hay loading.tsx, y (b) una vez agregado el loading skeleton, el contraste con el patrón de /accounts (header real visible desde primer paint) sigue siendo molesto: el skeleton del header se ve por unas décimas antes de saltar al PageHeader real. Se migran todas a Variant C.

**Complicación: 4 rutas con headers distintos.** El header de `/shared` cambia según estado (título = `household.name` o `t('title')`; acción = SettingsLink si hay household). Cada sub-ruta tiene su PageHeader propio (título + backLink). Para evitar header-duplicado por herencia del layout, se usa un **route group** `/shared/(home)/` que aloja el page+layout+loading de la home en URL `/shared`. Los sub-routes (`settings`, `settle`, `setup`) son hermanos del `(home)` group, cada uno con su propio layout.tsx que aloja su header. Resultado: 4 segmentos paralelos, cada uno con su Variant C; ningún header se duplica.

- **MOVER** `apps/web/app/(app)/shared/page.tsx` → `apps/web/app/(app)/shared/(home)/page.tsx`. Quita el render del PageHeader inline (ahora en layout). El `SetupForm` inline para el caso "sin household" se mantiene (es un sub-render del home, no de la sub-ruta `/shared/setup`).
- **AGREGAR** `apps/web/app/(app)/shared/(home)/layout.tsx`: server async; awaitea `getHousehold` + `getTranslations`, computa título dinámico (household.name | t('title')) y acción (SettingsLink si hay household), monta `<PageHeader>` arriba de `{children}`.
- **MOVER y ACTUALIZAR** el `loading.tsx` de la home → `apps/web/app/(app)/shared/(home)/loading.tsx`. Pierde el `<PageHeaderSkeleton>` (header vive en layout, persiste durante transición). Mantiene balance card + lista de expenses placeholder.
- **AGREGAR** `apps/web/app/(app)/shared/settings/layout.tsx`, **MODIFICAR** `apps/web/app/(app)/shared/settings/page.tsx`, **ACTUALIZAR** `apps/web/app/(app)/shared/settings/loading.tsx`: el layout async awaitea `getHousehold` + `getTranslations`, redirect si no hay household (movido del page), monta `<PageHeader>`. El page queda como wrapper trivial del `<SettingsForm />`. El loading.tsx pierde el `<PageHeaderSkeleton>` y queda solo con el form skeleton.
- **AGREGAR / MODIFICAR / ACTUALIZAR** los archivos análogos en `/shared/settle/` y `/shared/setup/`. Settle mantiene el auth check + guards específicos en page (porque dependen de debt y user id, datos que el layout no necesita).
- **BORRAR** `apps/web/app/(app)/shared/page.tsx` y `apps/web/app/(app)/shared/loading.tsx` (movidos al route group `(home)/`).

**Spec hygiene — Variant A queda sin consumidores:**

- **MODIFICAR** la sección `Variant A` del requirement "Una ruta de apps/web puede optar por loading y error in-page para mantener su chrome visible" para agregar una nota de estado: tras este change, ningún caso aprobado usa Variant A (`/accounts` era el último y migra a C). La variante se mantiene documentada por completitud histórica pero las rutas nuevas SHOULD adoptar Variant C salvo razón concreta documentada. La definición técnica de la variante no se toca — solo se suma la nota de estado.

**Notas:**

- Ninguna de estas rutas pierde su `error.tsx` global (`(app)/error.tsx` se mantiene intacto y sigue cubriendo errores de todas las rutas del shell que no definan uno propio).
- Para `/accounts` y `/cards`, el header sigue siendo Client Component (ya lo era — fetchean institutions / count via supabase browser client). Solo cambia su ubicación.

## Capabilities

### New Capabilities
- _(ninguna nueva)_

### Modified Capabilities
- `route-loading-and-errors`: actualizar la lista de casos de uso aprobados del requirement "Una ruta de apps/web puede optar por loading y error in-page para mantener su chrome visible" para reflejar que `/accounts` y `/cards` ahora usan **Variant C** (no Variant A como dice la versión actual tras `per-route-loading-shells`). Adicionalmente, agregar una nota de estado al final de la sección `Variant A` marcándola como variante sin casos aprobados después de este change y recomendando Variant C para rutas nuevas (la definición técnica de la variante se preserva por completitud histórica). El resto del requirement se mantiene.
- `accounts`: actualizar el requirement "El header de `/accounts` se renderiza desde el primer paint y sus secciones cargan independientemente" para reflejar que el header vive en `accounts/layout.tsx` (Variant C). Mantener inalterado el contrato de UX del header (queries client-side, botón "+ Nueva cuenta" gated por institutions, secciones aisladas con su loading/error). Agregar scenario para persistencia del header durante navegación entre rutas hermanas.
- `cards`: actualizar el requirement "El header de `/cards` se renderiza desde el primer paint y sus secciones cargan independientemente" análogamente. Header en `cards/layout.tsx`, contrato de UX intacto (count, subtítulo con mes, queries de institutions/networks). Agregar scenario equivalente al de accounts.

## Impact

**Código:**
- `apps/web/app/(app)/accounts/layout.tsx` (nuevo)
- `apps/web/app/(app)/accounts/loading.tsx` (nuevo)
- `apps/web/app/(app)/accounts/page.tsx` (sin header, sin auth duplicado)
- `apps/web/app/(app)/accounts/_components/active-accounts-skeleton.tsx` (nuevo, shape-matched)
- `apps/web/app/(app)/accounts/_components/archived-accounts-skeleton.tsx` (nuevo)
- `apps/web/app/(app)/cards/layout.tsx` (nuevo)
- `apps/web/app/(app)/cards/loading.tsx` (nuevo)
- `apps/web/app/(app)/cards/page.tsx` (sin header, sin auth duplicado)
- `apps/web/app/(app)/cards/_components/{cards-month-hero,wallet,archived-cards}-skeleton.tsx` (nuevos)
- `apps/web/app/(app)/transactions/recurring/loading.tsx` (nuevo)
- `apps/web/app/(app)/transactions/[txId]/loading.tsx` (nuevo)
- `apps/web/app/(app)/settings/loading.tsx` (nuevo)
- `apps/web/app/(app)/transactions/new/loading.tsx` (nuevo)
- `apps/web/app/(app)/shared/(home)/layout.tsx` (nuevo)
- `apps/web/app/(app)/shared/(home)/page.tsx` (movido desde `shared/page.tsx`, sin header inline)
- `apps/web/app/(app)/shared/(home)/loading.tsx` (movido desde `shared/loading.tsx`, sin PageHeaderSkeleton)
- `apps/web/app/(app)/shared/settings/layout.tsx` (nuevo, guarda + header)
- `apps/web/app/(app)/shared/settings/page.tsx` (sin header inline ni redirect)
- `apps/web/app/(app)/shared/settings/loading.tsx` (sin PageHeaderSkeleton)
- `apps/web/app/(app)/shared/settle/layout.tsx` (nuevo, guarda + header)
- `apps/web/app/(app)/shared/settle/page.tsx` (sin header inline; guards específicos del page se mantienen)
- `apps/web/app/(app)/shared/settle/loading.tsx` (sin PageHeaderSkeleton)
- `apps/web/app/(app)/shared/setup/layout.tsx` (nuevo, guarda + header)
- `apps/web/app/(app)/shared/setup/page.tsx` (sin header inline ni redirect)
- `apps/web/app/(app)/shared/setup/loading.tsx` (sin PageHeaderSkeleton)
- `apps/web/app/(app)/shared/page.tsx` (borrado, reemplazado por `(home)/page.tsx`)
- `apps/web/app/(app)/shared/loading.tsx` (borrado, reemplazado por `(home)/loading.tsx`)

Skeletons reusables (PageHeader skeleton, generic form skeleton) que puedan compartirse entre rutas similares SHOULD vivir en `apps/web/components/ui/` o `apps/web/app/(app)/shared/` para evitar duplicar la receta tres veces. La decisión exacta sobre qué primitives extraer se documenta en `design.md`.

**APIs/dependencias:** Ninguna.

**Dependencias entre changes (importante):**

Este change asume que `per-route-loading-shells` ya está **archivado** (es decir, las specs `route-loading-and-errors` y `dashboard` ya contienen Variant C y el caso de uso de dashboard). Las modificaciones de spec acá se construyen encima de ese estado. Implementar este change **antes** de archivar `per-route-loading-shells` produciría conflictos de delta (dos changes proponiendo cambios al mismo requirement). El orden correcto:

1. Archivar `per-route-loading-shells`.
2. Branch nuevo a partir de main para este change.
3. Implementar las tasks y archivar.

**Out of scope (explícito):**

- Cambios al `(app)/error.tsx` global.
- Migraciones de Variant en `/accounts/[id]`, `/cards/[id]` (siguen siendo Variant B según el spec; no se tocan).
- Performance del auth check del `(app)/layout.tsx` (sigue siendo el cuello del cold-load redirect login→cualquier ruta, ya fuera de scope en per-route-loading-shells).
- Mobile.
