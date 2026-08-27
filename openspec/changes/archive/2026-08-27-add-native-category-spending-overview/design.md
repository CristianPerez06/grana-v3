## Context

La card "En qué se fue" existe sólo en web: `apps/web/lib/transactions/components/category-spending-overview.tsx` (873 líneas) + `apps/web/app/(app)/transactions/_components/category-spending-overview-container.tsx` (463). Nativo no tiene nada equivalente, y su feed —cuando se filtra por categoría— usa la lente CAJA, que no reconcilia con ningún donut.

Lo que ya está compartido y no hay que tocar:

| Pieza | Package | Estado |
|---|---|---|
| Lente devengado (`countsAsCategorySpend`, `categoryOwnPortion`, `computeCategoryNet`, `cajaCutOrFilter`) | `@grana/money-logic` | Compartida |
| `buildCategorySlices` / `buildSubcategorySlices` | `@grana/money-logic` | Compartidas |
| `getMonthCategoryBreakdown` + `UNCATEGORIZED_ID` + `resolveMonthRange` | `@grana/dashboard` | Compartida |
| `useMonthCategoryBreakdown` | `apps/mobile/lib/dashboard/queries.ts:60` | Escrito, **sin consumidor** |
| Test invariante de reconciliación | `packages/dashboard/__tests__/category-lines-reconcile.test.ts` | Vive en el package, importa sólo `@grana/money-logic` |
| `MovementList` con `installmentChips?: Map<string,string>` | `apps/mobile/components/movements/` | El chip "Cuota n de N" ya está soportado |
| `MovementFiltersState` con `categoryId` / `subcategoryId` / `currency` | `apps/mobile/lib/transactions/feed-filters.ts` | Shippeado en `f9908a3b` |
| `react-native-svg` 15.12.1 | `apps/mobile/package.json:53` | 3 consumidores (`Spinner`, `GranaLogo`, `OutlookSection`) |
| `translateCategoryLabel` / `translateSubcategoryLabel` nativos | `apps/mobile/lib/categories.ts:361,371` | Existen |

Lo que falta: cuatro reads en `apps/web/lib/transactions/queries.ts`, la card nativa, y la rama de drill puro del feed.

## Goals / Non-Goals

**Goals:**

- Que el usuario nativo pueda leer **en qué** gastó el mes, con la misma lente y los mismos totales que web.
- Que el drill nativo **reconcilie**: la lista de abajo suma exactamente el peso del donut.
- Que web no cambie: mismos imports, mismo comportamiento, mismos tests verdes.
- Dejar el grafo de packages acíclico y la razón del reparto escrita, para que no se reintente.

**Non-Goals:**

- El drill animado in-place de web (`AnimatedDonut` con pool de arcos hijos, `DRILL_LOCK_MS`). Está muerto en la ruta viva y no se porta — ver Decisión 3.
- Refactorizar la card web. Es la referencia, no el objeto del change.
- `excludeShared` (issue #76) y `customRange` (issue #77).
- Una vista nativa de subcategorías más profunda que la de web (sub-sub-drill).

## Decisions

### 1. Las cuatro reads se reparten en dos packages, no en uno

El issue pide "las tres juntas y en el mismo paquete". El grafo no lo permite:

```
   packages/transactions/package.json:16
   ┌──────────────────────┐   depends on   ┌────────────────────┐
   │ @grana/transactions  │ ─────────────▶ │ @grana/dashboard   │
   └──────────────────────┘                └────────────────────┘
            ▲                                        │
            │  getMonthCategoryLines necesita        │  si la ponemos acá,
            │  TRANSACTION_SELECT,                   │  esta arista se
            │  attachLinkedExpenses,                 │  invierte y cierra
            │  toFinancialMovement,                  ▼  el ciclo  ✗
            └── SUBCATEGORY_NONE_MARKER, TransactionWithDetails
```

Reparto:

| Read | Destino | Por qué |
|---|---|---|
| `getMonthIncomeBreakdown` (:298) | `@grana/dashboard` | Sólo `money-logic` + Supabase. Gemela de `getMonthCategoryBreakdown`. |
| `getMonthSubcategoryBreakdown` (:404) + `SUBCATEGORY_UNCATEGORIZED_ID` | `@grana/dashboard` | Ídem. |
| `hasUsdAccount` (:279) | `@grana/dashboard` | Una sola query `head:true` sobre `account_currencies`. Sin dependencias. |
| `getMonthCategoryLines` (:139) + `MonthCategoryLines` | `@grana/transactions` | Es la única que necesita la maquinaria de movimientos. |

**Alternativa descartada:** bajar `getMonthCategoryBreakdown` de `@grana/dashboard` a `@grana/transactions` para reunir la familia entera del lado profundo. Rompe a los consumidores actuales del dashboard (web y nativo), y deja `@grana/dashboard` sin la read que arma "Gastaste" — que es su razón de ser. El costo de la familia partida es una nota en el spec; el costo de esto es una migración de imports en dos apps.

`hasUsdAccount` no está en el issue. Entra porque sin ella las pills ARS/USD no tienen gate y aparecerían para el usuario monomoneda.

### 2. Web queda como re-export, no se toca ningún consumidor

`apps/web/lib/transactions/queries.ts` ya usa ese patrón tres veces (`getGlobalMovements`, `getAccountMovementsAscending`, `getMovementFilterOptions`). Las cuatro implementaciones se van y quedan líneas de re-export. El único cambio de firma es `DbClient` → `GranaSupabaseClient`, que son el mismo tipo (`SupabaseClient<Database>`) por dos nombres.

`getMonthCategoryBreakdown` ya está envuelta en web con un wrapper que inyecta `financialTodayISO()` por default; las nuevas siguen el mismo molde.

### 3. El drill se implementa como filtro, porque eso es lo que web realmente hace

El issue plantea como primera decisión de diseño cómo portar la animación de drill (crossfade tipo `SpentTile` vs rotación 3D). La animación **no se ejecuta en la ruta web viva**:

```
  category-spending-overview-container.tsx:270
    const subBreakdownsByCategory: … | undefined = undefined   ← hardcodeado

  category-spending-overview.tsx:349
    const drillIn = useCallback((categoryId) => {
      if (busyRef.current) return
      if (!subBreakdownsByCategory) return    ← siempre sale por acá
      …
```

Es el único call site. Con `undefined`, `drillIn` retorna temprano, `childrenVisible` nunca se activa, y el pool de arcos hijos de `AnimatedDonut`, `DRILL_LOCK_MS` y `drillOut` son código inalcanzable.

El drill real, en web, es esto:

```
   tap categoría
        │
        ▼
   dispatch({ type: 'setCategory', categoryId })     ← estado de filtros de la ruta
        │
        ├──▶ breakdownMode: 'category' → 'subcategory'
        │         │
        │         ▼
        │    getMonthSubcategoryBreakdown(month, categoryId)
        │         │
        │         ▼
        │    el donut re-renderiza con sub-slices        (swap de datos, sin animación)
        │
        └──▶ la lista de abajo se filtra por la categoría
```

Nativo porta **eso**: `patchFilters({ categoryId })` sobre el `MovementFiltersState` que la pantalla ya tiene. No hay estado de drill interno del componente, así que no puede desincronizarse del feed — que es la propiedad que el spec pide.

**Consecuencia:** cero animación nueva, cero `reanimated` en esta card. Si más adelante se quiere la transición, es un change propio y aplica a las dos plataformas.

### 4. El mes lo gobierna la pantalla; la moneda, la card

Asimetría deliberada, y la razón es cuál control ya existe y es visible:

| Control | Web | Nativo | Por qué |
|---|---|---|---|
| Mes | dentro de la card | `MonthNavigator` de la pantalla | El nativo ya lo tiene y gobierna feed + recurrencias + reintegros. Portar el de la card dejaría dos. |
| Moneda ARS/USD | pills en la card | pills en la card | En nativo la moneda sólo existe hoy enterrada en el sheet de filtros: sin las pills no hay forma visible de cambiar la lectura del donut. |

Las pills escriben `filters.currency` —el mismo estado que filtra el feed—, así que donut y lista no pueden contradecirse. Efecto visible aceptado: elegir USD hace aparecer el chip "USD" entre los filtros activos.

Ojo con la interacción con el spec: la regla *"el drill de egresos NO SHALL fijar un filtro de moneda"* se refiere a **entrar al drill de categoría**, no al toggle. Tocar una categoría no debe pinear moneda; tocar la pill USD sí, porque eso es lo que el usuario pidió explícitamente.

### 5. `overviewMode` entra a `MovementFiltersState`, fuera del conteo de chips

`feed-filters.ts` lo excluye hoy con *"the category breakdown is a web-only surface"*. Entra al shape porque el modo Ingresos cambia qué se filtra al tocar una fila (web despacha `setType('income')` + fija la moneda, porque el drill de ingresos usa la lente CAJA general y necesita ambos para coincidir con el donut).

Queda **fuera** de `activeFilterCount` / `hasActiveContentFilters`, como `month` y `query`: tiene control propio, no es un chip removible, y contarlo haría que el badge de "Filtros" describiera algo que el sheet no contiene.

### 6. La rama de drill puro del feed

La pantalla decide qué read usar:

```
   ¿único filtro de contenido activo == categoría
     (± subcategoría, ± la moneda visualizada)?
            │
       sí ──┴── no
       │         │
       ▼         ▼
  getMonthCategoryLines      getMovementsFeedPage
  (@grana/transactions)      (get_movements_page, lente CAJA)
  lente devengado             respeta todos los filtros
  reconcilia con el donut     no promete reconciliar
       │
       └─▶ MovementList con installmentChips derivado de
           el `installments: Map<id,{n,total}>` que la read ya devuelve
```

`MovementList` ya acepta `installmentChips?: Map<string, string>`, así que el chip "Cuota n de N" no requiere tocar la fila. La lista drilleada **no pagina** (es un mes de una categoría), así que el botón "Cargar más" no se renderiza en esa rama.

### 7. Donut nativo: mismo truco geométrico que web

`<Circle r="15.915">` en un `viewBox="0 0 36 36"` da circunferencia ≈ 100, así que `strokeDasharray="{pct} {100-pct}"` y `strokeDashoffset={-offset}` mapean 1:1 a porcentajes. Es lo que web hace y lo que `react-native-svg` soporta sin trucos. Se porta también `groupForDonut` (top-6 + "Otros") — hoy vive en el container web; sube a `@grana/money-logic` junto a `buildCategorySlices` para no tener dos copias.

Las paletas (`INCOME_PALETTE`, `generateSubTints` con su `hexToHSL`) son funciones puras sobre strings de color: suben también, o se duplican sólo si `generateSubTints` resulta acoplado al formato hex de web.

### 8. Skeleton con forma, no spinner

`SkeletonBlock` (que ya usa `reanimated`) con la geometría de la card: círculo del donut + 5 filas de ranking. El chrome de la card —eyebrow, tabs Egresos/Ingresos, pills— se renderiza **desde el primer paint** y con los controles deshabilitados hasta que llega la data, según la regla de `route-loading-and-errors`.

## Risks / Trade-offs

- **[La familia de reads queda partida en dos packages y se lee como inconsistencia]** → El delta de `repo-architecture` codifica la regla y el de `spending-by-category` nombra la arista. Es exactamente el escenario que ya pasó una vez: el issue reintentó agrupar por tema porque la razón estaba sólo en un comentario.

- **[`getMonthCategoryLines` y `getMonthSubcategoryBreakdown` leen `shared_expense_split` sin paginar]** → Ambas usan `.in('transaction_id', sharedIds)`, así que están acotadas por la cantidad de compartidos del mes en esa categoría — muy lejos del max-rows 1000 de PostgREST. No es el caso de `collectDebtInputs`, que lee sin acotar. Se mueven como están; si alguna vez hiciera falta, es otro change.

- **[La card nativa duplica la lógica de labels/i18n del container web]** → El container web tiene ~150 líneas de relabeling (uncategorized → i18n, categorías del sistema → `translateCategoryLabel`, subcategorías → `translateSubcategoryLabel`). Nativo tiene sus equivalentes en `apps/mobile/lib/categories.ts:361,371`. Es glue de presentación acoplado al motor de i18n de cada app, así que la duplicación es la esperada por `repo-architecture` (mismos nombres, distinta implementación), no el patrón "mirror … keep in sync" que ese spec prohíbe.

- **[Tocar `MovementFiltersState` toca la misma superficie que tres changes activos]** → Los tres (`align-mobile-movement-form-surface`, `close-movement-form-parity-gaps`, `fix-native-movement-form-spec-drift`) están sobre el **formulario de alta**, no sobre el estado de filtros del feed. El campo que se agrega (`overviewMode`) es aditivo. Aun así conviene no aplicarlos en paralelo con éste si alguno toca `apps/mobile/app/(app)/transactions/index.tsx`.

- **[La card agrega 3 queries a una pantalla que ya hace 3]** → El feed, las opciones de filtro y `hasAnyTransaction` ya están. Se suman breakdown de categorías, `hasUsdAccount` (cacheada 30 min, month-independent) y —sólo cuando corresponde— income o subcategory breakdown, que van `enabled`-gateadas por modo como en web. En la práctica son 2 requests extra en el paint inicial.

## Migration Plan

Un solo PR, en este orden, con `pnpm typecheck` + `pnpm lint` + `pnpm test` verdes en cada paso:

1. **Extraer** las 4 reads a sus packages y dejar los re-exports en web. Verificable solo: web compila y sus tests pasan sin que ningún archivo fuera de `queries.ts` cambie.
2. **Subir** `groupForDonut` (y las paletas, si aplica) a `@grana/money-logic`; web pasa a importarlas.
3. **Hooks nativos** en `apps/mobile/lib/dashboard/queries.ts` y `apps/mobile/lib/transactions/queries.ts`.
4. **Card nativa** + skeleton, montada en la pantalla, todavía sin la rama de drill.
5. **Rama de drill puro** del feed + `installmentChips`.

Rollback: los pasos 3–5 son aditivos y se revierten solos. El paso 1 es un movimiento de archivos con re-export, reversible sin tocar consumidores.

## Open Questions

- ¿`generateSubTints` / `hexToHSL` suben a `@grana/money-logic` o se quedan por app? Depende de si son puros sobre strings hex (suben) o si asumen algo del formato de color web. Se decide al mover, no antes.
- Los dos tests de breakdown que hoy viven en `apps/web/lib/transactions/__tests__/` se mueven a `packages/dashboard/__tests__/` por vecindad. Si el mover genera ruido en el diff, pueden quedarse donde están sin costo técnico — no dependen del package del read.
