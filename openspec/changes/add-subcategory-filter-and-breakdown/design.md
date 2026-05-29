# Diseño técnico — Filtro y breakdown por subcategoría

## Contexto

`/transactions` tiene hoy:

- Filtros en `apps/web/lib/transactions/components/movement-filters.tsx` (462 líneas): tipo, categoría, cuenta, moneda, monto. La forma se serializa al URL via `apps/web/lib/transactions/filters.ts` (`parseMovementFilters`).
- Donut + ranking en `apps/web/lib/transactions/components/category-spending-overview.tsx` (296 líneas), alimentado por `buildCategorySlices` del paquete compartido `@grana/money-logic`.
- Página orquestadora en `apps/web/app/(app)/transactions/page.tsx` que lee filtros, hace fetch, y arma las props del overview.
- La query (`apps/web/lib/transactions/queries.ts`) ya trae la subcategoría en el join (`subcategory:subcategories(id, name, canonical_name, category_id)`) — solo falta aplicarla como filtro.
- Desde el PR previo `feature/show-subcategory-in-list`, el `FinancialMovement` ya carga `subcategory_id` y `subcategory_name`.

Este change agrega la dimensión subcategoría en filtros, breakdown y drill-down, sin tocar el detalle ni el form.

## Decisiones técnicas

### 1. Shape de `MovementFilters` y URL

Se agrega un campo opcional al filtro:

```ts
export type MovementFilters = {
  // ... existentes (query, month, from, to, type, accountId, categoryId, currency, amountMin, amountMax)
  subcategoryId?: string  // ID de subcategoría, o el marker '__none__' para "sin subcategoría"
}
```

URL: `?subcategory=<uuid>` o `?subcategory=__none__`.

`parseMovementFilters` SOLO acepta `subcategoryId` cuando también hay `categoryId` (defensa contra URLs malformadas — el filtro no tiene sentido sin categoría). Si llega `subcategory` sin `category`, se descarta silenciosamente.

`hasContentFilters` incluye `subcategoryId` (es un filtro de contenido — esconde rows, por lo que el running balance per-row debe desactivarse).

`buildMovementLimitHref` preserva `subcategory` al cambiar el limit.

### 2. UI del filtro en `movement-filters.tsx`

El select de subcategoría se renderea **debajo** del de categoría, en el mismo grupo. Aparece SOLO cuando hay `categoryId` activo. Las opciones se cargan a partir de la lista de subcategorías de esa categoría (`subcategories.filter(s => s.category_id === filters.categoryId)`).

Comportamiento de cambio de categoría: al setear o cambiar `categoryId`, `setParams({ category, subcategory: null })` — se limpia la subcategoría porque las subcategorías son hijas de la categoría.

Chip activo en la barra de chips: cuando `subcategoryId` está seteado, se renderea un chip "Subcategoría: <nombre>" (o "Subcategoría: Sin subcategoría" si es el marker `__none__`), con `clear: () => setParams({ subcategory: null })`.

Las **subcategorías** se cargan en `page.tsx` (server) — el page hace fetch de todas las subcategorías del user (o solo las de la categoría filtrada, ver §6) y las pasa como prop al componente cliente de filtros.

### 3. `buildSubcategorySlices` en `@grana/money-logic`

Paralelo a `buildCategorySlices`, con el mismo shape de output (`{ total, slices: Array<Slice> }`):

```ts
export type SubcategorySliceInput = {
  subcategoryId: string | null  // null = "Sin subcategoría"
  label: string
  color: string  // heredado del color de la categoría madre
  icon: string | null
  value: number
}

export const buildSubcategorySlices = (input: SubcategorySliceInput[]): {
  total: number
  slices: Array<SubcategorySliceInput & { percentage: number }>
}
```

Reglas:
- Suma de `percentage` debe dar 100 (con misma tolerancia que `buildCategorySlices`).
- Sort por `value` desc.
- El slice "Sin subcategoría" (subcategoryId=null) entra en la lista normal, ordenado por su `value`. NO se fuerza al final; si tiene mucho valor, va arriba (es información válida).

El **agrupado** vive en el caller (apps/web), no en money-logic. money-logic solo hace `total + percentage + sort`. Razón: money-logic no conoce `FinancialMovement`; el caller arma el input ya agregado por `subcategoryId`.

Tests en `packages/money-logic/src/__tests__/build-subcategory-slices.test.ts`:
- Slices ordenados por value desc.
- Percentages suman 100.
- Slice "Sin subcategoría" se incluye cuando hay value > 0.
- Edge cases: input vacío, todo en una subcat, todo "Sin subcategoría".

### 4. Switch del mode en `CategorySpendingOverview`

El componente acepta un prop nuevo:

```ts
mode: 'category' | 'subcategory'
categoryContext?: { id: string; name: string }  // requerido cuando mode='subcategory'
```

Cuando `mode='subcategory'`:
- El título cambia a "En qué se fue dentro de **<categoryContext.name>**".
- El input al `buildSubcategorySlices` viene ya agregado por el caller (page.tsx). Para no romper la API actual, el componente acepta `slicesInput: SubcategorySliceInput[] | CategorySliceInput[]` y llama a la función correspondiente según `mode`.
- El ranking lateral muestra los nombres de subcategoría. Si `subcategoryId === null`, label = "Sin subcategoría", color = neutral gris.
- El href de cada slice se arma con `subcategoryHref(month, currency, categoryId, subcategoryId)` (ver §5).

Cuando `mode='category'`: comportamiento idéntico al actual, ningún cambio observable.

### 5. Drill-down: href de slice

Helper actual (`categoryHref`):

```ts
const categoryHref = (month, currency, categoryId) =>
  categoryId ? `/transactions?month=${month}&category=${categoryId}&currency=${currency}` : null
```

Nuevo helper `subcategoryHref`:

```ts
const subcategoryHref = (month, currency, categoryId, subcategoryId: string | null) =>
  `/transactions?month=${month}&category=${categoryId}&subcategory=${subcategoryId ?? '__none__'}&currency=${currency}`
```

El slice "Sin subcategoría" usa el marker `__none__`. Ese marker se preserva en `parseMovementFilters` y se traduce a `.is('subcategory_id', null)` en la query.

### 6. Resolver `mode` en `page.tsx`

En `apps/web/app/(app)/transactions/page.tsx`:

```ts
const isSingleCategoryFilter = filters.categoryId && !filters.subcategoryId
const breakdownMode: 'category' | 'subcategory' = isSingleCategoryFilter ? 'subcategory' : 'category'

const categoryContext = isSingleCategoryFilter
  ? categories.find(c => c.id === filters.categoryId) ?? null
  : null
```

Y la agregación del input del overview se hace por `subcategory_id` cuando `mode='subcategory'`:

```ts
const sliceInput = breakdownMode === 'subcategory'
  ? aggregateBySubcategory(filteredMovements, filters.categoryId, allSubcategories)
  : aggregateByCategory(filteredMovements, categories)  // ya existe
```

Donde `aggregateBySubcategory` agrupa por `subcategory_id` (null incluido), suma `amount`, y hereda el color de la categoría madre.

**Subcategorías a fetch**: para evitar over-fetch, page.tsx solo trae las subcategorías de la categoría activa cuando hay `categoryId`. Cuando no hay filtro de categoría, no se necesitan subcategorías (el filtro no se muestra).

### 7. Query con marker `__none__`

En `queries.ts`, dentro del builder de filtros:

```ts
if (filters.subcategoryId === '__none__') {
  query = query.is('subcategory_id', null)
} else if (filters.subcategoryId) {
  query = query.eq('subcategory_id', filters.subcategoryId)
}
```

Esto se aplica EN ADICIÓN al filtro de categoría (que es prerrequisito por el guard en `parseMovementFilters`).

### 8. i18n

Nuevas claves en `packages/i18n-messages/src/{es,en}.json`:

```json
{
  "transactions": {
    "filters": {
      "subcategory": "Subcategoría",
      "no_subcategory": "Sin subcategoría",
      "active_chip_subcategory": "Subcategoría: {name}"
    },
    "breakdown": {
      "title": "En qué se fue",
      "title_with_category": "En qué se fue dentro de {category}",
      "no_subcategory_slice": "Sin subcategoría"
    }
  }
}
```

(Las claves existentes de `transactions.breakdown.title` ya están — se reusan; solo `title_with_category` y `no_subcategory_slice` son nuevas.)

## Trade-offs evaluados

1. **Auto-switch vs toggle manual** — descarto toggle. Argumento: el filtro de categoría ya expresa el intent del user; agregar un control "ver por categoría / por subcategoría" duplica esa decisión. Si en el futuro hay pedido real (ej. "quiero el filtro de Comida pero seguir viendo el donut por categoría"), se puede sumar sin romper este contrato.

2. **`buildSubcategorySlices` en money-logic vs en apps/web** — va en money-logic porque mobile va a necesitarla idéntica. La agregación (de movements → input shape) sí queda en el caller porque mobile y web tienen schemas de fetch distintos.

3. **Marker `__none__` vs `null` literal en URL** — `__none__` gana. `null` se parsea ambiguamente (puede venir como string "null" o vacío), y `subcategory=` (vacío) es indistinguible de "no filtro". `__none__` es explícito, googleable y feo a propósito (no hay riesgo de colisión con UUIDs).

4. **Mostrar "Sin subcategoría" como slice vs ocultarlo** — gana mostrarlo. Argumento: si el bucket es grande, es señal de que el user no clasifica suficiente, y el donut lo evidencia. Ocultarlo deformaría las percentages restantes.

5. **¿Filtrar movements antes de pasar a `buildSubcategorySlices` o filtrar adentro?** — afuera. El componente recibe `slicesInput` ya construido. Le quita responsabilidades y mantiene el componente como "renderer puro" sobre slices.

## Alternativas descartadas

- **Hacer el filtro de subcategoría independiente de categoría** (p. ej. "filtrar por 'Almuerzo' sin elegir 'Comida' primero"). Descartado: subcategorías de distintas categorías madre pueden tener el mismo nombre canónico ("Otros", "Varios"), y un filtro global por nombre rompería el modelo. La dependencia categoría → subcategoría es deliberada.

- **Mostrar SIEMPRE el donut por subcategoría cuando hay categoryId, incluso si también hay subcategoryId**. Descartado: si el user ya filtró a 1 subcat, el donut "100% Almuerzo" es ruido. En ese caso, el donut vuelve al modo categoría (que va a tener 1 sola slice — Comida — pero al menos es coherente con el resto del módulo).

- **Mantener el donut por categoría incluso con categoryId filtrado y agregar un segundo donut chiquito por subcategoría al lado**. Descartado: dos donuts compiten visualmente y duplican el real estate. El switch es más limpio.

## Riesgos y mitigaciones

- **Riesgo**: el caching de Next/SWR sobre `/transactions?...` puede no invalidar bien cuando cambia `subcategoryId`. **Mitigación**: el helper `setParams` ya construye URLs consistentes y dispara navegación → no requiere cambios en la capa de caching, pero hay que verificar manualmente en la sesión de QA.

- **Riesgo**: rendimiento del breakdown cuando hay muchas tx (>1000) en la categoría — `aggregateBySubcategory` itera todas. **Mitigación**: ya pasa con `aggregateByCategory` y nadie se quejó; misma cota de complejidad. Si en el futuro se vuelve un problema, se puede precalcular del lado del server.

- **Riesgo**: `parseMovementFilters` silenciosamente descarta `subcategory` sin `category` — un user podría pegar un link incompleto y no entender por qué no se aplica. **Mitigación**: aceptable porque (a) los links se generan desde la app, no a mano; (b) un log silencioso es mejor que un crash; (c) el chip activo no aparecerá, dándole feedback visual.
