# Diseño — Teaser "En qué se fue" en el dashboard mobile

## Qué se comparte y qué no (estado actual)

```
YA COMPARTIDO  @grana/money-logic
               ├─ buildCategorySlices(input, {topN, othersLabel}) → { slices }
               ├─ computeCategoryNet(aggRows) → netByCategory (por moneda)
               └─ tipos CategoryAggRow, CategorySliceInput, CategorySlice

WEB-ONLY HOY   apps/web/lib/transactions/queries.ts
               └─ getMonthCategoryBreakdown(month)  ← I/O Supabase + stitch reintegros
                  apps/web/lib/transactions/filters.ts
                  └─ resolveMonthRange(month) → { from, to }   ← date math pura

MOBILE         (nada — ni teaser ni breakdown)
```

La matemática ya cruza plataformas; lo que falta compartir es el **acceso a datos** (`getMonthCategoryBreakdown`) y su helper de rango de mes.

## Decisión 1 — Promover la query a `@grana/dashboard` (client-injected), web delega

`getMonthCategoryBreakdown` es altamente portable: sus únicos acoplamientos web son `createClient()` (el client server de Supabase) y `resolveMonthRange()`. Todo lo demás son queries PostgREST planas + `computeCategoryNet` (ya compartido). No toca DOM ni Node.

Se mueve a `@grana/dashboard` con firma client-injected, igual que el resto del package:

```ts
// @grana/dashboard
export async function getMonthCategoryBreakdown(
  supabase: SupabaseClient,
  month: string,
): Promise<MonthCategoryBreakdown> { … }   // mismo cuerpo, sin createClient interno
```

- **Web**: `apps/web/lib/transactions/queries.ts` deja de definirla y re-exporta/llama la del package pasando su client server. El desglose completo web (donut) sigue funcionando sin cambios de comportamiento.
- **Mobile**: `apps/mobile/lib/dashboard/queries.ts` agrega `useMonthCategoryBreakdown` que llama `getMonthCategoryBreakdown(supabase, month)` con el client mobile.

`resolveMonthRange` (date math pura) viaja con ella. Dos opciones de hogar: junto a la query en `@grana/dashboard`, o en `@grana/money-logic` (es lógica pura). Recomendado: que `@grana/dashboard` exponga lo que la query necesita y, si conviene, reusar/mover `resolveMonthRange` a `@grana/money-logic` para que tanto los filtros web como la query compartida tomen de una sola fuente. Decisión menor; no es contrato de spec.

### Por qué `@grana/dashboard` y no otro hogar

| Opción | Veredicto |
|---|---|
| **`@grana/dashboard` (client-injected)** ✅ | El requirement vigente ya manda que las queries de lectura del dashboard vivan ahí. El teaser es una sección del dashboard. Mínima superficie nueva (no se crea package). |
| Copia mobile-local en `apps/mobile/lib` | Duplica lógica contable no trivial (filtro off-ledger, stitch de reintegros, el TODO de tarjeta documentado) → dos lugares que mantener en sync. Contra el principio "cero duplicación de negocio". Descartada. |
| Nuevo package `@grana/transactions` | Más correcto semánticamente (es una query de Movimientos), pero crea superficie nueva por un solo consumidor. Sobredimensionado para este change. |

Tensión asumida: `@grana/dashboard` es un package de data-layer (queries + agregaciones), no de UI; que una query "de spending" viva ahí es defendible porque el dashboard es su consumidor compartido. El nombre del package es ligeramente más amplio que "dashboard" en la práctica.

## Decisión 2 — El teaser es presentación pura sobre slices ya calculadas

El componente no sabe de Supabase. Recibe (o, siguiendo el patrón mobile, fetchea via su hook y luego) renderiza `CategorySlice[]` (top 3). La barra es un `View` contenedor con un `View` hijo de `width: \`${pct}%\`` y `backgroundColor` del color de categoría (fallback gris). Sin `MaskedAmount` — no hay montos.

```
┌─ Card ──────────────────────────────────────┐
│  En qué se fue              Ver desglose →   │
│  🍔 Comida        ▓▓▓▓▓▓▓▓░░░░   42%         │
│  🚗 Transporte    ▓▓▓▓▓░░░░░░░   28%         │
│  🏠 Hogar         ▓▓▓░░░░░░░░░   18%         │
└──────────────────────────────────────────────┘
```

Filas con slots de ancho fijo para el `%` y la barra (no depender solo de `gap`), para alinear columnas entre filas (regla de listas repetidas del repo). Si `slices.length === 0`, el teaser no se renderiza (igual que web: `if (slices.length === 0) return null`).

## Decisión 3 — Carga in-card, link transitorio

El teaser carga su breakdown async y muestra su estado in-card (loading/error) sobre un alto estable, consistente con el patrón de `align-mobile-dashboard-section-loading`. Como no expone montos y suele ser corto, su loading puede ser un placeholder mínimo; el contrato es "sin layout shift abrupto", no un alto fijo grande.

Al tocar el teaser, `router.push('/transactions')`. El donut completo todavía no vive en Movimientos mobile, así que es un destino transitorio (el usuario llega a la lista, no al desglose completo). Se documenta en código como las demás decisiones transitorias del dashboard mobile. Cuando aterrice el desglose completo mobile, el destino ya es correcto sin tocar el teaser.

## Riesgos

- **Link a una vista sin donut.** El teaser promete "ver desglose" pero mobile `/transactions` aún no lo tiene. Mitigación: es el mismo patrón transitorio ya aceptado en el dashboard mobile (ítems de "Lo que viene" → `/tarjetas`); el copy "Ver desglose" sigue siendo razonable porque el desglose llegará a esa ruta. Si se prefiere, el copy mobile podría ser "Ver movimientos" hasta entonces — decisión de Producto.
- **Refactor web sin cambio de comportamiento.** Mover `getMonthCategoryBreakdown` fuera de `transactions/queries.ts` toca el módulo del desglose completo web. Mitigación: la query se mueve verbatim (solo se inyecta el client); el typecheck y los tests de agregación (`packages/dashboard/__tests__` y los de money-logic) cubren la equivalencia. Verificar que el donut web sigue idéntico.
- **Dependencia de orden con el change de loading.** Ambos tocan la capability `dashboard`. Mitigación: modifican requirements disjuntos; orden recomendado loading→teaser, sin bloqueo duro.
