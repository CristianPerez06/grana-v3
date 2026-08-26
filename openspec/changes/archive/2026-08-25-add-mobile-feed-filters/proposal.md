# Proposal: add-mobile-feed-filters

## Why

La tab **Movimientos** de la app nativa es el único listado del producto que no se puede acotar. `apps/mobile/app/(app)/transactions/index.tsx:71` proyecta un solo filtro —el mes— y `getMovementsFeedPage` (`apps/mobile/lib/transactions/queries.ts:31`) lo pasa como `filters: { month }`, cuando la RPC `get_movements_page` acepta **nueve** predicados (`categoryId`, `subcategoryId`, `currency`, `accountId`, `type`, `query`, `amountMin`, `amountMax`, `excludeShared` — ver la traducción en `packages/transactions/src/queries.ts:257-271`).

La inconsistencia no es contra web: es **interna a mobile**. El detalle de cuenta —una superficie más chica— ya tiene la toolbar completa: chips de acción, búsqueda inline y chips activos removibles (`apps/mobile/components/accounts/MovementsSection.tsx`), hoja de filtros de 249 líneas (`apps/mobile/components/accounts/MovementFiltersSheet.tsx`) y máquina de estado con contador de activos (`apps/mobile/lib/accounts/movement-filters.ts`). El mock de paridad tampoco falta: `docs/design/transactions/mobile/transactions.html:61-71` ya dibuja la toolbar y los chips que la pantalla real no tiene.

O sea: el trabajo es **promover lo que ya existe en el detalle de cuenta al feed global**, no escribirlo de cero.

Cierra el issue [#68](https://github.com/CristianPerez06/grana-v3/issues/68).

## What Changes

- **La máquina de filtros se extrae a `apps/mobile/lib/transactions/feed-filters.ts`**, superset de la de cuenta: suma `accountId`, que el detalle no necesita porque ya está scopeado. `lib/accounts/movement-filters.ts` pasa a consumirla en vez de declarar la suya.

- **El feed filtra en el servidor; el detalle de cuenta sigue filtrando en memoria.** Es la diferencia de diseño más importante del change y no es una inconsistencia: el detalle tiene **todas** las filas de la cuenta cargadas (`getAccountMovementsAscending`) y las necesita completas para el running balance por fila, así que `applyAccountFilters` sobre memoria es correcto ahí. El feed **pagina**: filtrar en memoria sobre una página parcial daría un resultado que cambia al tocar "cargar más". Los filtros del feed viajan a la RPC proyectados a `MovementFilters`.

- **`MovementFiltersSheet` se muda a `apps/mobile/components/movements/`** y se parametriza con `showAccountFilter` — visible en el feed, oculto en el detalle de cuenta. Mismo criterio que web (`apps/web/lib/transactions/components/movement-filters.tsx:74`). Una sola implementación de la hoja, dos modos de aplicación del resultado.

- **El filtro de cuenta aparece sólo cuando hay 2+ cuentas que desambiguar**, replicando la regla `showAccount` de web (`movement-filters-container.tsx:109`). Es la misma regla de "perfil único" del dominio: con una sola `Billetera`, la dimensión cuenta no se ofrece.

- **`getMovementFilterOptions` se promueve de `apps/web/lib/transactions/queries.ts:95` a `@grana/transactions`.** Ya es isomórfica —recibe el cliente como primer parámetro, no importa nada de `next/*`— así que la promoción es mecánica y web la sigue importando desde donde la importa hoy. Su única dependencia web, `getSubcategoriesByCategoryId` (`apps/web/lib/categories/queries.ts:45`), **no** se promueve: son ocho líneas de `select` sobre `subcategories` que se inlinean en el package, y la función web se queda donde está porque tiene otro consumidor propio (`app/(app)/settings/categories/[id]/subcategories/page.tsx:21`). No hace falta crear un `@grana/categories` para esto.

  La promoción **no es un extra opcional:** el feed pagina, así que derivar las opciones de la página cargada daría un menú de filtros que **crece al hacer "cargar más"**. Las opciones salen del catálogo.

- **El detalle de cuenta nativo pasa a leer sus opciones del mismo catálogo.** Hoy las deriva de sus propias filas (`MovementsSection.tsx:47-70`) — pero el detalle de cuenta **web** ya usa `getMovementFilterOptions` (`app/(app)/accounts/[id]/_components/movement-filters-account-container.tsx:40`), así que derivar de las filas es una divergencia sólo del nativo. Unificar deja la hoja compartida con **una** fuente de opciones en vez de dos. El costo es real y aceptado: el menú puede ofrecer una categoría que en esa cuenta da cero resultados, cosa que las opciones derivadas nunca hacían. Es exactamente lo que ya pasa en web, y la tercera variante de empty state que este change agrega es la que lo explica.

- **El eje `type` se unifica sobre el `kind` derivado.** Hoy la hoja de cuenta filtra sobre `tx.type` —la columna DB, cinco opciones— (`applyAccountFilters`, `lib/accounts/movement-filters.ts:88`), mientras la RPC filtra sobre `calc.kind` —el VM derivado, ocho opciones— (`0042_…sql:166`), que es lo que `MovementFilters.type` ya declara (`packages/transactions/src/filters.ts:7`). Compartir la hoja obliga a elegir un eje, y el eje del contrato compartido es `kind`. Gana además las tres distinciones que el usuario **sí** ve en los badges de la fila y hoy no puede filtrar: compra en cuotas, pago de resumen y reintegro. El detalle de cuenta deriva el `kind` de sus filas una vez por carga con `toFinancialMovement` (la única derivación que existe, `packages/transactions/src/movements.ts:248-362`), sin extraer nada del package.

- **La toolbar se monta en `transactions/index.tsx` sobre el `MonthNavigator`**, con los chips activos removibles debajo. La pantalla ya scrollea con `KeyboardAwareScrollView` (`apps/mobile/components/layout/keyboard-aware-scroll-view`), que es lo que AGENTS.md exige para una superficie con input de texto: el input de búsqueda no necesita chrome nuevo.

- **`limit` se resetea a `DEFAULT_MOVEMENTS_LIMIT` en cada cambio de filtro**, no sólo al cambiar de mes como hoy (`transactions/index.tsx:63`). Web lo hace en **todas** las ramas de su reducer (`apps/web/lib/transactions/filters-state.ts:107-176`); el nativo hereda la misma regla.

- **Tercera variante de empty state: "ningún movimiento coincide con los filtros"**, con acción de limpiar. Hoy el feed distingue dos (`bienvenida` vs `mes vacío`, vía `hasAnyTransaction`); falta la que aparece cuando el usuario mismo vació la lista. Las copys ya existen: `transactions.empty.filter_title` / `filter_description` / `clear_filters` y `search_title` / `search_description` / `clear_search`.

- **La búsqueda del feed cambia de semántica respecto de la del detalle de cuenta, a propósito.** El match del feed lo hace SQL (`ILIKE` sobre título, descripción efectiva y nombres de cuenta origen/destino — `supabase/migrations/0042_get_movements_page_exclude_shared.sql:167-173`); el `movementMatchesText` nativo del detalle (`lib/accounts/movement-filters.ts:70`) además matchea nombre de categoría y subcategoría. Buscar "supermercado" en el feed no traerá los gastos categorizados como Supermercado si la descripción no lo dice; en el detalle sí. La alternativa —matchear categorías en el feed— exigiría el filtrado en cliente que este change existe para evitar. Queda documentado como divergencia conocida entre las dos superficies, no como bug.

**Fuera de alcance, con ticket propio:**

- **Rango de fechas custom (`from`/`to`).** El feed nativo se queda en navegación mensual. La razón no es la que suponía el issue: web tampoco lo ofrece. `customRange` vive en el reducer (`filters-state.ts:36,120`) y en el contrato, pero **ninguna UI despacha `setCustomRange`** —`MovementFiltersController` ni declara el callback— y el único lugar donde el componente toca `from`/`to` es `goToMonth` (`movement-filters.tsx:236`), que los manda en `null`. Es estado alcanzable sólo desde tests. Sumarlo en nativo sería adelantarse a web, no alcanzarla. → [#77](https://github.com/CristianPerez06/grana-v3/issues/77), que decide para las dos plataformas si se activa o se borra.
- **`showShared`.** En web es una **preferencia de vista persistida** (`localStorage`, key `grana:tx:showShared`), no un chip: sobrevive recargas y no cuenta para "Filtros (N)". Portarla implica almacenamiento nativo (`expo-secure-store`, el seam de `lib/preferences.ts`), que es otra clase de problema que el resto de los filtros. → [#76](https://github.com/CristianPerez06/grana-v3/issues/76).

Sin migraciones, sin cambios de datos, de API ni de RLS: la RPC ya soporta todo esto. Sin strings nuevas: `transactions.filters.*`, `transactions.empty.*` y `transactions.movement_kinds.*` —las ocho etiquetas del eje `kind`, las mismas que usa web— ya viven en `@grana/i18n-messages`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`: el requirement **"La tab Movimientos de mobile muestra el feed global navegable por mes"** hoy **prohíbe** explícitamente lo que este change construye — su último párrafo dice "La **barra de filtros** y el **breakdown por categoría** del feed web siguen explícitamente fuera de este alcance", y el scenario "Tocar una fila del feed abre el detalle" cierra con "**AND** el feed no renderiza barra de filtros ni breakdown por categoría". El delta saca la barra de filtros de la exclusión (el **breakdown por categoría sigue fuera**: es otra superficie, con su propia spec `spending-by-category`), suma la regla de **filtrado server-side sobre listas paginadas**, el reset de paginación en cada cambio de filtro, el origen-catálogo de las opciones y la tercera variante de empty state.

- `accounts`: el requirement **"El detalle de cuenta en mobile filtra los movimientos con un toolbar (mobile)"** (`openspec/specs/accounts/spec.md:1079`) ancla la hoja de filtros a una implementación propia del detalle y a opciones derivadas de los movimientos de la cuenta. El delta la reapunta a la hoja **compartida** con el feed (parametrizada por `showAccountFilter`), preservando explícitamente lo que **no** cambia en esta superficie: sigue filtrando en cliente sobre el historial completo de la cuenta, y sigue derivando sus opciones de categoría de esas filas.

**Drift preexistente que este change SÍ corrige, y por qué.** El requirement de `accounts` cierra hoy con "mientras el módulo de recurrencias mobile no exista, esa ruta SHALL ser un placeholder vacío (sin construir la funcionalidad todavía)". Es falso desde que `recurring-movements` está ✅ Done: `apps/mobile/app/(app)/transactions/recurring/` tiene `index`, `[id]` y `new`. La convención del repo es restatear el drift ajeno **verbatim** y corregirlo en su propio change — pero acá la frase es parte del párrafo que este delta reescribe, y restatear una falsedad dentro de un texto que estoy editando es peor que arreglarla. Se corrige, y queda anotado como decisión, no como edición silenciosa.

**Pre-change check.** El único change activo es `mirror-native-chrome-on-web-mobile`, que toca `overlay-primitives`, `page-header` y `web-app-shell` — chrome web, fases 3 y 4 pendientes. No toca `transactions`, `accounts`, ni ningún archivo de `apps/mobile/app/(app)/transactions/`. Sin solapamiento. (Los directorios `add-mobile-money-calculator`, `align-mobile-movement-form-surface`, `close-movement-form-parity-gaps` y `fix-native-movement-form-spec-drift` bajo `openspec/changes/` están **vacíos**: son restos locales sin trackear de changes ya archivados.)

## Impact

**Mobile — el grueso del change**

- `apps/mobile/lib/transactions/feed-filters.ts` — **nuevo**. Máquina de filtros del feed (estado, `emptyFilters`, `activeFilterCount`, proyección a `MovementFilters`).
- `apps/mobile/lib/accounts/movement-filters.ts` — pasa a consumir el estado compartido; conserva `applyAccountFilters` / `movementMatchesText`, que son propios del filtrado en memoria.
- `apps/mobile/components/movements/MovementFiltersSheet.tsx` — **movido** desde `components/accounts/`, más `showAccountFilter` y el selector de cuenta.
- `apps/mobile/components/movements/ActiveFilterChips.tsx` — **nuevo**. El renderer de chips activos removibles, lo único de la toolbar que las dos superficies comparten sin variación.
- `apps/mobile/app/(app)/transactions/index.tsx` — arma su fila de acciones, monta la hoja y los chips, proyecta los filtros a la query, resetea el límite y suma la variante de empty state.
- `apps/mobile/components/accounts/MovementsSection.tsx` — consume la hoja desde su nueva ubicación y pasa a opciones de catálogo; su toolbar se queda donde está.
- `apps/mobile/lib/transactions/queries.ts` — `getMovementsFeedPage` acepta `MovementFilters` completo en vez de sólo el mes.

**Packages — promoción, sin lógica nueva**

- `packages/transactions/src/filter-options.ts` — **nuevo**. Recibe `getMovementFilterOptions` tal cual, con el `select` de subcategorías inlineado.
- `packages/transactions/package.json` — suma `@grana/ui-contracts` como dependencia directa (la necesita `resolveAccountAvatar`). Ya entra transitivamente vía `@grana/dashboard`, y `ui-contracts` no depende de nada, así que no hay ciclo posible.

**Web — sólo un re-export**

- `apps/web/lib/transactions/queries.ts` — `getMovementFilterOptions` se re-exporta desde ahí, igual que `filters.ts` re-exporta hoy el contrato desde `@grana/transactions`. Los call-sites web no se tocan y su comportamiento no cambia. `apps/web/lib/categories/queries.ts` queda intacto.

**Specs**

- `openspec/specs/transactions/spec.md` y `openspec/specs/accounts/spec.md` — vía los deltas de arriba.
