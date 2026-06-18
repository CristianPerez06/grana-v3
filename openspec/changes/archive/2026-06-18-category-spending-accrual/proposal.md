## Why

Tras un análisis de mercado (Monarch, YNAB, Actual Budget, Mobills, Organizze — verificado 3-0 en investigación adversarial) y un debate de producto, se decidió que **"En qué se fue" (gasto por categoría) responde la pregunta "¿en qué consumí?" y debe usar base DEVENGADO**: el gasto impacta su categoría en la fecha de la compra/devengo, **no** cuando se paga.

Clave: **el spec de `spending-by-category` YA manda devengado** (requirement "El desglose pesa por el neto…": *"Cuentan los gastos con fecha contable en el mes: gastos cash/débito, consumos de tarjeta, y la cuota que devenga en el mes… Los reintegros recibidos restan, por su fecha"*, con su escenario "ese consumo cuenta en el desglose de su categoría aunque no haya tocado el disponible"). **El código es el que está atrasado respecto a su propio spec**: `getMonthCategoryBreakdown` filtra `card_period_id IS NULL`, así que excluye todo el gasto con tarjeta. Hay además un TODO en el código que apuntaba a base caja (impacto al pagar), que **contradice el spec** — y un renglón en el spec de `dashboard` ("respetar el invariante Off-ledger") que quedó ambiguo y empujó la exclusión. Este change **alinea el código con el spec de spending-by-category (devengado)** y desambigua el de dashboard. Disparador real del análisis: ver [[spending-accrual-and-lenses]].

## What Changes

- **"En qué se fue" pasa a DEVENGADO**: incluye los consumos de tarjeta y cada cuota por su **fecha + categoría**. Sigue excluyendo el padre de cuotas (off-ledger, `is_parent`) y el pago de resumen (cancelación de deuda, no gasto — `period_payments`).
- **Cuotas: devengan mes a mes** — cada cuota impacta el mes de su **transacción hija** (`date`, alineada a su período de tarjeta), **NO** la fecha de compra ni todo el total junto al comprar. La madre (`is_parent`, off-ledger) nunca cuenta. Ya es el modelo de datos (cada cuota hija tiene su `date`, `card_period_id` y `category_id`), así que no hay re-estructura.
- **El pago de resumen NUNCA aparece en "En qué se fue"** (es cancelación de deuda). PUEDE aparecer en "Balance del mes" como salida de caja (lente CAJA), pero no en CONSUMO — las dos lentes difieren a propósito porque responden preguntas distintas.
- **Reintegros: netean por categoría derivada, por su `date`, permitiendo CRÉDITOS** (sin el capeo a 0 de hoy). Agnóstico al `reimbursement_target` (a-cuenta o statement): para el consumo, el target es irrelevante; solo dice dónde cae la plata (eso vive en CAJA/COMPROMISO).
- **Categorías en crédito** (reintegro > gasto del mes → neto negativo): se muestran **fuera de la dona**, en una fila aparte tipo "Te devolvieron", en lugar de descartarse.
- Resuelve el `TODO(spec follow-up)` de `getMonthCategoryBreakdown`.
- **BREAKING (de comportamiento, no de API)**: el total y la composición de "En qué se fue" cambian (ahora incluye tarjeta) y **van a diferir del "Gastos" de Balance del mes a propósito** — son lentes distintas (CONSUMO devengado vs CAJA). La diferencia se vuelve legible, no se fuerza la igualdad.

## Capabilities

### Modified Capabilities
- `spending-by-category`: el requirement del neto se aclara para **habilitar créditos** (neto negativo) y mostrarlos aparte (fuera de la dona). La base devengado ya está en el spec; el cambio fuerte es de código (alinearlo) + el capeo/créditos.
- `dashboard`: agrega un requirement para la **fila de créditos** ("te devolvieron") fuera de la dona en la sección "En qué se fue". (El requirement del package no se toca: su "invariante off-ledger" es sobre *disponible*/CAJA, no sobre la categorización, así que un desglose devengado no lo viola.)

## Impact

- `packages/dashboard/src/queries.ts` — `getMonthCategoryBreakdown`: dejar de filtrar `card_period_id IS NULL`; incluir consumos + cuotas hijas (excluir solo `is_parent` y los que tienen `period_payments`); netear reintegros sin capeo; agnóstico al target.
- `packages/money-logic` — `computeCategoryNet` / `buildCategorySlices`: permitir netos negativos (créditos) en vez de descartar `value <= 0`; separar los créditos para que no entren a la dona.
- UI "En qué se fue" (web `spending-section.tsx` + mobile `SpendingSection.tsx`): **reusa la card actual sin rediseño** (misma dona, leyenda, toggle ARS/USD, colores, eye-mask, skeletons); único agregado = fila(s) de créditos fuera de la dona + nota mínima opcional. Nada de cards/layout nuevos.
- **Sin migraciones**: los datos (consumos, cuotas, reintegros con fecha/categoría) ya existen.

### Out of scope (roadmap, ver [[spending-accrual-and-lenses]])
- **N1** — rotular el pago de resumen como línea propia "Pago de tarjeta" en Balance del mes (lente CAJA): cambio adyacente, va con el trabajo de Balance del mes / Comprometido.
- Bloque **"Comprometido"** (deuda tarjeta + cuotas futuras + recurrencias), hero ajustado, y tarjeta como pasivo full: cambios posteriores del roadmap.
