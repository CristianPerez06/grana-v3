# Teaser "En qué se fue" en el dashboard mobile

## Why

La spec de `spending-by-category` ya exige, de forma **neutral a la plataforma**, que *"El dashboard SHALL mostrar un teaser con las 3 categorías que más pesan del mes, que enlaza al desglose completo en Movimientos."* Web lo implementa (`CategoryTeaser`, commit `9b929db`), pero **mobile no** — es la única sección del dashboard web que nunca tuvo contraparte mobile. Mobile está, hoy, en incumplimiento de un requirement vigente.

El teaser es deliberadamente liviano: muestra las **3 categorías top como barras de proporción + %**, sin montos, por lo que **no necesita eye-mask** (no expone dinero). Es un gateway al desglose completo (donut + ranking), que vive en Movimientos. La parte de presentación es trivial en RN (la barra = un `View` con ancho %). La lógica pura de slices ya está compartida: `buildCategorySlices` vive en `@grana/money-logic`.

El trabajo real es la **data**: la query `getMonthCategoryBreakdown` vive web-only en `apps/web/lib/transactions/queries.ts` y no es un simple GROUP BY — netea reintegros recibidos contra la categoría derivada de su gasto de origen (segundo query de stitch), excluye la madre de cuotas (off-ledger) y los consumos en tarjeta sin pagar y los pagos de resumen. Duplicar esa lógica en mobile arriesga drift de reglas contables sensibles. En su lugar se **promueve a `@grana/dashboard`** (client-injected, RN-safe), siguiendo el requirement vigente *"Las queries y agregaciones del dashboard viven en un package compartido"* y el principio del repo de **cero duplicación de negocio**.

## What Changes

### A — La query de breakdown se promueve a `@grana/dashboard`

- **MODIFIED** "Las queries y agregaciones del dashboard viven en un package compartido": `getMonthCategoryBreakdown` (y el helper de rango de mes que necesita) se suman a la lista de queries compartidas en `@grana/dashboard`, con firma client-injected `getMonthCategoryBreakdown(supabase, month)`. La app web deja de tener una copia local en `apps/web/lib/transactions/queries.ts` y delega en el package (pasando su client server). El `getMonthSubcategoryBreakdown` (drill de subcategorías, solo usado por el desglose completo en Movimientos web) **queda fuera de este change** — se comparte cuando el desglose completo aterrice en mobile.

### B — `CategoryTeaser` mobile

- **ADDED** componente `CategoryTeaser` (RN) en `apps/mobile/components/dashboard/`, espejo del web a nivel de nombre: título + "Ver desglose", y una lista de hasta 3 filas con `icon + label`, una **barra de proporción** (`View` con ancho `%` y color de categoría) y el `%`. Sin montos, sin eye-mask. Usa las keys i18n existentes (`dashboard.spending.*`, `transactions.spending.uncategorized`/`.others`).
- **ADDED** hook `useMonthCategoryBreakdown(today)` en `apps/mobile/lib/dashboard/queries.ts`, consumiendo la query compartida; alimenta el teaser con `buildCategorySlices(..., { topN: 3 }).slices.slice(0, 3)`, igual que web.

### C — El teaser entra al dashboard mobile

- **MODIFIED** la spec del teaser para hacer explícita la paridad web + mobile, con su scenario nativo: el teaser se renderiza al final del dashboard mobile (después de "Balance del mes") y al tocarlo navega a Movimientos mobile (`/transactions`). Carga in-card con alto estable, siguiendo el patrón de las demás secciones (ver dependencia).

## Dependencies & ordering

- Depende (orden recomendado, no bloqueante duro) de **`align-mobile-dashboard-section-loading`**: ese change instala el patrón "shell + sección que posee su query y su loading/error in-card sobre alto estable". El teaser nace siguiéndolo. Si por orden de merge este change aterrizara antes, el teaser igual implementa su propio loading in-card.
- Ambos changes tocan la capability `dashboard` pero **requirements disjuntos**: el de loading modifica *"La pantalla `(app)/dashboard` mobile…"*, este modifica *"Las queries y agregaciones del dashboard viven en un package compartido"*. No hay conflicto al archivar.

## Out of scope

- **El desglose completo (donut + ranking) en Movimientos mobile.** Mobile no tiene la vista completa de `spending-by-category`; este change trae solo el teaser del dashboard. Por eso el teaser linkea a `/transactions` (lista de movimientos mobile) aunque el donut completo todavía no viva ahí — **decisión transitoria documentada**, en línea con el patrón ya usado en el dashboard mobile (p. ej. ítems de "Lo que viene" que enrutan a `/tarjetas` mientras no existe el detalle de período). El donut completo en mobile es un change futuro y, cuando llegue, compartirá también `getMonthSubcategoryBreakdown`.
- El TODO contable ya documentado en el código de `getMonthCategoryBreakdown` (atribuir el gasto de tarjeta cuando el resumen se paga, en vez de nunca) — se respeta el comportamiento actual tal cual; no se corrige acá (está trackeado aparte).
- Eye-mask sobre el teaser: no aplica (no muestra montos).

## Stakeholders

- **Mobile**: implementación RN del teaser.
- **Web** (tech lead): valida el refactor de delegar `getMonthCategoryBreakdown` a `@grana/dashboard` sin cambiar el comportamiento del desglose completo web.
- **Producto/Diseño** (Cristian/Julieta): el teaser es presentación simple (barras de proporción); el componente web es spec suficiente para traducir a tokens RN. Confirmar si requiere pasada de Paper o se traduce directo.
