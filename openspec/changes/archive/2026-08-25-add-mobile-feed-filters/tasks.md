> Las fases 1→2→3 son secuenciales: la 1 deja el read compartido que la 2 necesita, y la 2 deja el estado y la hoja que la 3 monta. La 4 migra el consumidor existente y es la que carga el riesgo del change. La 5 cierra.

## 1. Promover el read de opciones de filtro

- [x] 1.1 Crear `packages/transactions/src/filter-options.ts` con `getMovementFilterOptions`, copiada de `apps/web/lib/transactions/queries.ts:95-175`. Cambiar el tipo del primer parámetro de `DbClient` a `GranaSupabaseClient` (son el mismo cliente; el alias web no viaja al package) e **inlinear** el `select` de subcategorías que hoy delega en `getSubcategoriesByCategoryId` — ocho líneas sobre `subcategories` filtrando `category_id` + `is_active`, ordenadas por `name`. La firma pública, la forma del retorno y el orden de los `Promise.all` no cambian
- [x] 1.2 Agregar `@grana/ui-contracts` a `dependencies` en `packages/transactions/package.json` (lo necesita `resolveAccountAvatar`). Ya entra transitivamente vía `@grana/dashboard` y `ui-contracts` no depende de ningún package, así que no hay ciclo; correr `pnpm install` para que el workspace lo linkee
- [x] 1.3 Exportar `getMovementFilterOptions` desde `packages/transactions/src/index.ts`
- [x] 1.4 En `apps/web/lib/transactions/queries.ts`, borrar la implementación y **re-exportar** la del package, con el mismo patrón que usa `apps/web/lib/transactions/filters.ts` para el contrato. Los dos call-sites web (`transactions/_components/movement-filters-container.tsx:40` y `accounts/[id]/_components/movement-filters-account-container.tsx:40`) NO se tocan
- [x] 1.5 Verificar por lectura que `apps/web/lib/categories/queries.ts` queda intacto: `getSubcategoriesByCategoryId` se queda ahí por su consumidor propio (`app/(app)/settings/categories/[id]/subcategories/page.tsx:21`)
- [x] 1.6 `pnpm typecheck` y `pnpm lint` sin errores. Este es el punto de corte donde web tiene que seguir comportándose igual: si algo se rompe acá, se rompió en la promoción, no en el trabajo nativo

## 2. La máquina de filtros nativa y la hoja compartida

- [x] 2.1 Crear `apps/mobile/lib/transactions/feed-filters.ts` con el estado de filtros de movimientos nativo: `month`, `query`, `type: MovementTypeFilter | null`, `accountId`, `categoryId`, `subcategoryId`, `currency`, `amountMin`, `amountMax`. **Sin `customRange` y sin `showShared`** (issues #77 y #76). Incluir `emptyFilters(month)`, `activeFilterCount(filters)` —que excluye `month` y `query`— y `hasActiveSearch(filters)`
- [x] 2.2 En el mismo archivo, agregar `adaptFiltersForQuery(filters): MovementFilters`, espejo nativo de `apps/web/lib/transactions/filters-state.ts:236-254`: proyecta el mes a `month`, omite los campos vacíos (ausentes, no `null`) y no proyecta `excludeShared`. Es la identidad de cache del feed, así que tiene que ser pura y determinística
- [x] 2.3 Reapuntar `apps/mobile/lib/accounts/movement-filters.ts` al tipo compartido: borrar la declaración local de `AccountMovementFilters` y re-exportar el tipo de `feed-filters.ts`. Los helpers de mes (`monthOf`, `currentMonth`, `shiftMonth`, `monthLabel`) y `movementMatchesText` se quedan donde están — son del filtrado en memoria
- [x] 2.4 Cambiar `applyAccountFilters` para que el eje de tipo sea el `kind` derivado: recibe un tercer parámetro `kindById: Map<string, MovementTypeFilter>` y compara `kindById.get(tx.id) !== filters.type` en vez de `tx.type !== filters.type`. El resto de los predicados no cambia
- [x] 2.5 Mover `apps/mobile/components/accounts/MovementFiltersSheet.tsx` a `apps/mobile/components/movements/MovementFiltersSheet.tsx` (`git mv`, para que el historial siga la mudanza)
- [x] 2.6 En la hoja: cambiar `TYPE_OPTIONS` de `TransactionType[]` a `MOVEMENT_TYPE_KEYS` de `@grana/transactions` (los ocho `kind`), y cambiar las etiquetas de `transactions.types.*` a **`transactions.movement_kinds.*`**, que es el catálogo del eje `kind` y ya tiene las ocho entradas (incluidas `card_payment`, `installment_purchase` y `reimbursement`). Es el mismo catálogo que usa web para sus chips de tipo (`movement-filters.tsx:250`). **Cero i18n nuevo**
- [x] 2.7 En la hoja: sumar la prop `showAccountFilter?: boolean` (default `true`) y el bloque de chips de cuenta, con las opciones que llegan por prop. El bloque se renderiza sólo si `showAccountFilter` **y** hay 2 o más cuentas, replicando la regla `showAccount` de web
- [x] 2.8 En la hoja: cambiar `categoryOptions` para que las opciones lleguen del catálogo. Definir el tipo de la prop sobre la forma que devuelve `getMovementFilterOptions` (categorías planas + subcategorías de la categoría activa), no sobre el `CategoryOption` con subcategorías anidadas que servía a las opciones derivadas
- [x] 2.9 Extraer `apps/mobile/components/movements/ActiveFilterChips.tsx` del bloque de chips de `MovementsSection.tsx:229-244`: recibe la lista de chips ya armada (`{ key, label, onRemove }[]`) y la dibuja. Es un renderer, no arma los chips — cada superficie compone su propia lista porque las etiquetas dependen de sus opciones
- [x] 2.10 `pnpm typecheck` y `pnpm lint`. En este punto el detalle de cuenta todavía no compila contra la hoja nueva; se cierra en la fase 4

## 3. Montar la barra de filtros en el feed

- [x] 3.1 En `apps/mobile/lib/transactions/queries.ts`, cambiar la firma de `getMovementsFeedPage(month, limit)` a `getMovementsFeedPage(filters: MovementFilters, limit)` y pasarle los filtros completos a `getGlobalMovementsPage`
- [x] 3.2 En `apps/mobile/app/(app)/transactions/index.tsx`, reemplazar los dos `useState` de `month` y `limit` por un único estado de filtros (`feed-filters.ts`) más el `limit`, con un **único** setter que aplica el cambio de filtro y el reset de `limit` a `DEFAULT_MOVEMENTS_LIMIT` en la misma actualización. El `queryKey` pasa a ser `['transactions','feed',{ filters: adapted, limit }]`
- [x] 3.3 Agregar el read de opciones: `useQuery` sobre `getMovementFilterOptions(supabase, { categoryId })`, con la categoría activa en el `queryKey` (las subcategorías dependen de ella, mismo criterio que `movement-filters-container.tsx:65`)
- [x] 3.4 Montar la fila de acciones bajo el `MonthNavigator`: chip **Buscar** (despliega el input inline) y chip **Filtros** con el badge de `activeFilterCount`. **Recurrencias no va como chip** — ya vive en el `PageHeader` de esta pantalla (`index.tsx:130`). Reusar el patrón visual de `ActionChip` de `MovementsSection.tsx:266-297`
- [x] 3.5 Debounce del input de búsqueda a 300ms antes de que toque el estado de filtros, mismo valor que web (`movement-filters.tsx:216`). Sin esto cada tecla es un round-trip a la base
- [x] 3.6 Montar `ActiveFilterChips` bajo la fila de acciones, componiendo la lista de chips desde el estado + las opciones del catálogo (tipo, cuenta, categoría, subcategoría, moneda, monto mín, monto máx). Quitar un chip aplica el cambio por el setter único del 3.2, así que también resetea el límite
- [x] 3.7 Montar `MovementFiltersSheet` con `showAccountFilter` (sin pasar el flag: en el feed va en `true`) y las opciones del catálogo
- [x] 3.8 Empty state de tres variantes: primero evaluar si hay filtros de contenido o búsqueda activos → variante sin-resultados con acción de limpiar; sólo si no los hay, consultar `hasAnyTransaction` para separar bienvenida de mes-vacío. Mantener el `enabled` de esa query gateado también por "no hay filtros activos", para que un feed vaciado por filtros no dispare I/O extra
- [x] 3.9 Verificar que "cargar más" sigue leyendo `feedQuery.data.nextLimit` y que `hasMore` describe el conjunto filtrado
- [x] 3.10 `pnpm typecheck` y `pnpm lint`

## 4. Migrar el detalle de cuenta a la hoja compartida

- [x] 4.1 En `apps/mobile/components/accounts/MovementsSection.tsx`, cambiar el import de `MovementFiltersSheet` a `../movements/MovementFiltersSheet`
- [x] 4.2 Reemplazar el `useMemo` de `categoryOptions` derivadas de las filas (`:47-70`) por un `useQuery` sobre `getMovementFilterOptions`, con la categoría activa en el `queryKey`. Con esto se va también el uso local de `resolveCategoryLabel` para armar opciones — verificar si sigue haciendo falta para las etiquetas de los chips activos antes de borrar el import
- [x] 4.3 Agregar el `useMemo` que construye `kindById: Map<string, MovementTypeFilter>` con `toFinancialMovement(tx).kind`, dependiente **sólo** de `movements`, y pasarlo a `applyAccountFilters`
- [x] 4.4 Pasar `showAccountFilter={false}` a la hoja
- [x] 4.5 Reemplazar el bloque de chips inline por `ActiveFilterChips`, componiendo la lista con las etiquetas que salen ahora del catálogo
- [x] 4.6 Verificar por lectura que el toolbar del detalle **no** cambió de forma: sigue con su título "Movimientos", su navegador de mes inline y su chip de Recurrencias. Lo que cambió es de dónde salen las opciones y sobre qué eje filtra el tipo
- [x] 4.7 `pnpm typecheck` y `pnpm lint`

## 5. Cierre

- [x] 5.1 Confirmar por lectura que no quedó filtrado en memoria en el feed: el único consumo de las filas recibidas es renderizarlas
- [x] 5.2 Confirmar que `@grana/i18n-messages` quedó **sin keys nuevas** y que las tres variantes de empty state leen del catálogo compartido
- [x] 5.3 Confirmar que `apps/mobile/components/accounts/MovementFiltersSheet.tsx` ya no existe y que nadie lo importa
- [x] 5.4 `pnpm typecheck` y `pnpm lint` en verde sobre todo el repo
- [x] 5.5 Archivar el change antes del merge: mover a `openspec/changes/archive/YYYY-MM-DD-add-mobile-feed-filters/`, aplicar los deltas a `openspec/specs/transactions/spec.md` y `openspec/specs/accounts/spec.md` (integrados en el `## Requirements` plano, sin secciones de delta), y correr `pnpm openspec:check`
