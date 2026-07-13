## Why

En `/transactions`, el donut "En qué se fue" usa la lente **CONSUMO / devengado** (`getMonthCategoryBreakdown`): cada cuota cuenta en su mes de vencimiento, los compartidos cuentan **tu parte**, los reintegros netean. Al tocar una categoría, el listado de abajo se filtra por esa categoría — pero se alimenta de `get_movements_page`, que es la lente **CAJA / ledger**: monto entero, la compra madre por fecha de compra (las cuotas hijas ocultas), y todos tus movimientos (incluidos los compartidos 100% del otro).

El resultado: **el gesto de clickear una categoría promete "estos son los movimientos que forman esos $100.000", y la lista no lo cumple.** Un mes con una cuota de tarjeta muestra la slice con valor pero la lista vacía; un súper 50/50 cuenta $5.000 en el donut y lista $10.000; un gasto 100% del otro no aparece en el donut pero sí en la lista filtrada.

Es el ítem #1 del backlog de `shared-followups-2026-07`, el más grande. La decisión de producto (validada con el usuario) es **reconciliar, no rotular**: la lista drilleada tiene que sumar exactamente el número del donut. Esto es viable y de tamaño acotado porque **las filas ya existen en la base**: cada cuota hija es una transacción real con su fecha de vencimiento, su monto de cuota, su categoría heredada, su `installment_n/total` y su propio split compartido (`register-installments.ts:155-178`). Hoy la lista general simplemente las esconde (`t.parent_id is null`).

Alcance: **solo el drill** (cuando hay una categoría activa en `/transactions`). El listado general de Movimientos (feed global, filtros por cuenta, búsqueda, paginación, toggle "mostrar compartidos") NO cambia de semántica. `apps/mobile` lo lleva el tech lead y no se toca.

## What Changes

- **Nueva query devengada por categoría** (`@grana/dashboard`): una hermana de `getMonthCategoryBreakdown` que, en vez de sumar y tirar las piezas, **retiene las líneas** que componen el neto de una categoría/moneda en el mes, con metadata de render. Reusa exactamente la misma lente contable (mismas reglas de cuota, tu parte, exclusión de parte 0, exclusión de pago de resumen, reintegros que netean) para que **por construcción sume igual que el donut**.
  - Cada línea apunta a un `txId` **real** (la cuota hija, el gasto, el reintegro), de modo que el detalle/drawer al clickear funciona sin costurón.
  - Metadata por línea: título, fecha (la contable/devengada), monto a mostrar (**tu parte** en compartidos), badge de cuota (`3/6`), flags `esCompartido` / `esReintegro`.
- **La lista drilleada se alimenta de esta query** en `/transactions` cuando el usuario está en el **drill puro** (solo categoría activa —vía donut o barra de filtros—, opcionalmente subcategoría + moneda, sin otro filtro), en lugar de `get_movements_page`. Reusa la fila de movimiento existente apuntando al `txId` real, con override de monto (tu parte) y badge de cuota. Si el usuario superpone otro filtro (cuenta, tipo, monto, búsqueda), el listado vuelve a la lente CAJA general que respeta todos los filtros.
- **Cuotas**: en un mes de cuota, la lista muestra la **cuota de ese mes** ("Notebook 3/6 · $100.000"), no la compra madre. Suma con el donut.
- **Compartido**: la fila muestra **tu parte** ("Súper · $5.000"), no el ticket entero. Los compartidos sin parte propia (100% del otro) **no aparecen** en el drill (el donut tampoco los cuenta).
- **Reintegros — dos filas que netean**: la lista muestra el gasto **y** el reintegro recibido como filas separadas; su suma neta iguala el peso de la categoría en el donut (ej. gasto $10.000 + reintegro −$3.000 = $7.000). Decisión de diseño confirmada: dos filas, no una fila ya neteada.
- **Drill por subcategoría**: al tener una categoría activa el donut ya muestra sus subcategorías (lente devengada, `getMonthSubcategoryBreakdown`); la lista drilleada respeta ese mismo filtro (categoría, o subcategoría si se navega a una).

## Non-goals

- **No** se cambia la semántica del listado general `get_movements_page` (sigue siendo caja / ledger / monto entero / madre por fecha). No hay migración.
- **No** se toca `apps/mobile` (tech lead).
- **No** se agrega reconciliación al dashboard ni a otras superficies — solo al drill de `/transactions`.
- **No** entra el ítem #3 del backlog (agregar reintegro a un gasto existente).

## Capabilities

### Modified Capabilities

- `spending-by-category`: el requirement "Tocar una categoría abre sus movimientos" pasa de "abre el listado filtrado" (que hoy usa la lente caja y no reconcilia) a "abre la **lista devengada** de esa categoría, que suma exactamente el peso del donut" — con las reglas explícitas para cuotas, compartidos (tu parte), parte 0, y reintegros en dos filas.

## Impact

- **Código**:
  - `packages/dashboard/src/queries.ts` — nueva query `getMonthCategoryLines` (o equivalente), reusando la lógica de `getMonthCategoryBreakdown` (`aggRows`) pero reteniendo líneas + metadata + `txId`.
  - `packages/dashboard/src/index.ts` — export.
  - `apps/web/lib/transactions/queries.ts` — wrapper/cliente.
  - `apps/web/app/(app)/transactions/_components/` — el contenedor de la lista drilleada consume la query nueva cuando hay categoría activa; la fila reusa el componente de movimiento con override de monto + badge de cuota.
  - i18n para el badge de cuota y etiquetas de compartido/reintegro si faltan.
- **Datos / migraciones**: ninguna. Todo el dato requerido ya existe (cuotas hijas, splits, reintegros linkeados).
- **Riesgo**: medio-bajo. No toca la RPC general ni el esquema. El riesgo está en la paridad exacta de la lente entre la query nueva y `getMonthCategoryBreakdown` — se mitiga derivando ambas del mismo helper de agregación (una sola fuente de verdad para "qué compone una categoría").
- **Fuera de alcance**: `apps/mobile`; el listado general; dark mode (diferido).
