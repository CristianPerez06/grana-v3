# Proposal: add-native-category-spending-overview

## Why

"En qué se fue" es la única superficie del producto donde el usuario ve **en qué** gastó, y no **cuánto**. Nativo hoy resuelve la segunda (`SpentCard` en el dashboard: Gastaste / Ya se pagó / Por pagar) y no tiene nada de la primera: la pantalla Movimientos abre directo en el feed.

El gap no es sólo la card. Cuando el usuario nativo filtra por categoría, la lista de abajo usa la lente **CAJA** de `get_movements_page` y sus montos NO suman el peso de la categoría — muestra la compra madre en vez de la cuota del mes, el total de un compartido en vez de la parte propia, y colapsa el reintegro. En web esa lista usa la lente **devengado** y reconcilia por construcción. El spec ya lo tiene registrado como deuda: `spending-by-category` lleva un bloque *"Paridad de plataforma — MOBILE PENDIENTE (tech lead)"* desde el 2026-07-13.

Cierra el issue [#69](https://github.com/CristianPerez06/grana-v3/issues/69).

## What Changes

**1. Tres reads salen de `apps/web/lib/transactions/queries.ts` a packages — en dos packages, no en uno.**

El issue pide "las tres juntas y en el mismo paquete". No se puede: `@grana/transactions` ya depende de `@grana/dashboard` (`packages/transactions/package.json:16`), y `getMonthCategoryLines` necesita `TRANSACTION_SELECT`, `attachLinkedExpenses`, `toFinancialMovement`, `SUBCATEGORY_NONE_MARKER` y `TransactionWithDetails` — todo de `@grana/transactions`. Ponerla en `@grana/dashboard` cierra el ciclo `dashboard → transactions → dashboard`. El reparto que el grafo permite:

- → `@grana/dashboard`: `getMonthIncomeBreakdown` (:298), `getMonthSubcategoryBreakdown` (:404) y `SUBCATEGORY_UNCATEGORIZED_ID`, más `hasUsdAccount` (:279). Las tres sólo tocan `@grana/money-logic` + Supabase, y quedan al lado de su gemela `getMonthCategoryBreakdown`.
- → `@grana/transactions`: `getMonthCategoryLines` (:139) y su tipo `MonthCategoryLines`. Es la recomendación que el propio spec ya dejó escrita.

Web re-exporta las cinco desde `apps/web/lib/transactions/queries.ts` (patrón ya usado ahí para `getGlobalMovements`, `getAccountMovementsAscending`, `getMovementFilterOptions`), así que **ningún consumidor web cambia sus imports**. La firma pasa de `DbClient` a `GranaSupabaseClient`, que es el mismo tipo.

**El test invariante no se mueve.** El issue dice que hay que moverlo con las reads; ya está en `packages/dashboard/__tests__/category-lines-reconcile.test.ts` e importa sólo de `@grana/money-logic` — replica los dos loops de producción sobre filas sintéticas, no llama a las queries. Igual `apps/web/lib/transactions/__tests__/{category,subcategory}-breakdown.test.ts`: puros y agnósticos de plataforma. Se mueven a `packages/dashboard/__tests__/` por vecindad, no por necesidad.

**2. Card nativa `CategorySpendingOverview`** bajo `apps/mobile/components/transactions/`, con `react-native-svg` (ya instalado, 15.12.1, con tres consumidores). Mismo nombre y mismo contrato de props que web, implementación idiomática RN. Muestra: donut top-6 + "Otros", ranking con cola expandible, toggle Egresos/Ingresos, pills ARS/USD, créditos ("te devolvieron") y nota off-ledger.

**3. La card NO trae su propio selector de mes.** Web lo lleva adentro porque la ruta no tiene otro; la pantalla Movimientos nativa ya tiene `MonthNavigator` arriba, manejando feed, recurrencias pendientes y reintegros pendientes. Portar el de la card dejaría dos controles de mes en la misma pantalla. La card lee el mes de `filters.month` y no lo escribe. Se mantiene la invariante del spec —un solo control de mes por pantalla— cambiando dónde vive en nativo.

**4. Las pills ARS/USD sí van dentro de la card y escriben `filters.currency`.** Es el único control de moneda visible en la pantalla (hoy la moneda está enterrada en el sheet de filtros), y escribir el filtro compartido es lo que garantiza que donut y lista no se contradigan. Consecuencia visible: tocar USD hace aparecer el chip "USD" entre los filtros activos, y quitar el chip devuelve el donut a ARS. Gateadas por `hasUsdAccount` como web, así que el usuario monomoneda no las ve.

**5. La lista drilleada nativa reconcilia.** Cuando el único filtro de contenido activo es la categoría (opcionalmente acotada por subcategoría y por la moneda visualizada), el feed nativo se ramifica a `getMonthCategoryLines` en vez de `get_movements_page`. Si el usuario superpone cuenta, tipo, monto o búsqueda, vuelve a la lente CAJA — la regla ya está escrita en el spec, sólo faltaba el lado nativo. Las filas necesitan el chip "Cuota n de N" y el monto = la parte del usuario.

**6. `overviewMode` entra al estado de filtros nativo.** `apps/mobile/lib/transactions/feed-filters.ts` lo excluye hoy con el comentario *"no `overviewMode`: the category breakdown is a web-only surface"*, que deja de ser cierto. Entra al shape sin contar para `activeFilterCount` (como `month` y `query`: tiene su propio control y no es un chip removible).

**Fuera de alcance.** El drill animado in-place de la card web (`AnimatedDonut` con pool de arcos hijos, `DRILL_LOCK_MS`, `drillIn`/`drillOut`): está **muerto en la ruta web viva** — el único call site pasa `subBreakdownsByCategory = undefined` (`category-spending-overview-container.tsx:270`), así que `drillIn` retorna temprano y nada de ese camino se ejecuta. El drill real, en web y acá, es el filtro: tocar categoría despacha `setCategory`, el modo del desglose pasa a `subcategory` y la query trae el sub-breakdown. Nativo porta eso, no la animación. Tampoco entra `excludeShared` (issue #76) ni `customRange` (issue #77).

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `spending-by-category`: tres cambios de requirement.
  1. **Placement del selector de mes.** El requirement *"El módulo Movimientos abre con un desglose de gastos por categoría del mes"* exige hoy que el único control de mes sea *"el del desglose"*. Nativo lo pone arriba de la pantalla. El delta conserva la invariante real (**un solo** control de mes, que determina el mes del desglose y del listado) y libera su ubicación a lo idiomático de cada plataforma.
  2. **Gate del toggle ARS/USD.** El requirement *"El desglose pesa por el neto de cada categoría, por moneda"* dice que el toggle *"aparece cuando hay gasto en USD en el mes"*. La implementación web no hace eso: gatea con `hasUsdAccount` —"¿el usuario opera en USD?", month-independent— justamente para que el toggle no desaparezca al navegar a un mes sin movimientos USD. Spec drift; el delta lo alinea con el comportamiento vigente.
  3. **Se va el bloque "MOBILE PENDIENTE".** El requirement *"Tocar una categoría abre sus movimientos"* lleva una nota de tech lead que declara la lista drilleada como web-only y recomienda hoistear `getMonthCategoryLines` a `@grana/transactions`. Este change la ejecuta: la nota sale y en su lugar quedan scenarios nativos (la card encabeza el feed, el drill reconcilia, la moneda de la card filtra el listado).

- `repo-architecture`: el requirement *"La lógica isomórfica vive en el package de dominio; sólo el glue acoplado a plataforma queda por app"* resuelve **si** un read va a un package, pero no **a cuál** cuando hay más de un candidato. El delta agrega esa regla: el package se elige por el grafo de dependencias —un read va al package más profundo que ya provee todo lo que necesita, y NUNCA a uno que obligue a invertir una arista existente. Es lo que fuerza el reparto de este change, y lo que evita que el próximo colaborador reintente meter `getMonthCategoryLines` en `@grana/dashboard`.

**Pre-change check.** Los cinco changes activos: `mirror-native-chrome-on-web-mobile` toca `overlay-primitives` / `page-header` / `web-app-shell` (chrome web); `add-mobile-money-calculator` toca `money-input-calculator`; y `align-mobile-movement-form-surface`, `close-movement-form-parity-gaps` y `fix-native-movement-form-spec-drift` tocan `transactions` — los tres sobre el formulario de alta. Ninguno toca `spending-by-category` ni `repo-architecture`. Este change deliberadamente NO deltea `transactions` para no competir con esos tres: la composición de la pantalla Movimientos nativa queda cubierta por `spending-by-category`.

## Impact

**Packages — el movimiento de código**

- `packages/dashboard/src/queries.ts` — entran `getMonthIncomeBreakdown`, `getMonthSubcategoryBreakdown`, `hasUsdAccount`; `packages/dashboard/src/index.ts` los exporta junto con `SUBCATEGORY_UNCATEGORIZED_ID` y `MonthSubcategoryBreakdown`.
- `packages/transactions/src/queries.ts` — entra `getMonthCategoryLines`; `packages/transactions/src/index.ts` la exporta con `MonthCategoryLines`.
- `packages/dashboard/__tests__/` — recibe los dos tests de breakdown que hoy están en web. `category-lines-reconcile.test.ts` no se toca.

**Web — sólo re-exports**

- `apps/web/lib/transactions/queries.ts` — las cuatro implementaciones se van; quedan re-exports. Ningún otro archivo web cambia (`category-spending-overview-container.tsx` sigue importando de la misma ruta).

**Mobile — el trabajo nuevo**

- `apps/mobile/components/transactions/CategorySpendingOverview.tsx` + `CategorySpendingOverviewSkeleton.tsx` (`SkeletonBlock` con forma de donut + filas, no spinner).
- `apps/mobile/lib/dashboard/queries.ts` — `useMonthCategoryBreakdown` (hoy escrito y sin consumidor) gana su primer consumidor; se suman los hooks de subcategoría, ingresos y `hasUsdAccount`.
- `apps/mobile/lib/transactions/queries.ts` — wrapper de `getMonthCategoryLines` y la rama de drill puro del feed.
- `apps/mobile/lib/transactions/feed-filters.ts` — `overviewMode` entra al shape; se corrige el comentario que lo excluía.
- `apps/mobile/app/(app)/transactions/index.tsx` — monta la card entre `MonthNavigator` y los chips de acción.
- `apps/mobile/components/movements/MovementList` / fila — chip "Cuota n de N" en el drill.

**i18n**

- `packages/i18n-messages` — las keys de `transactions.spending.*` ya existen (las consume web). Se revisa cuáles faltan en el catálogo nativo.

**Specs**

- `openspec/specs/spending-by-category/spec.md` y `openspec/specs/repo-architecture/spec.md`, vía los deltas de arriba.
