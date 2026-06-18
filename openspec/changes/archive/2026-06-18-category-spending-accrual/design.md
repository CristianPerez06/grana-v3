## Context

Este cambio implementa el primer paso de una decisión de dominio más amplia, surgida del debate de producto + investigación de mercado (resumen durable en la memoria [[spending-accrual-and-lenses]]). La decisión madre:

**Grana separa tres lentes, cada una responde una pregunta distinta y usa su propia base contable.**

```
   CONSUMO                      CAJA                      COMPROMISO
   "¿en qué se me fue?"         "¿cuánto tengo?"          "¿qué debo / se viene?"
   base DEVENGADO              base CAJA                  proyección
   impacta al COMPRAR          impacta cuando             deuda tarjeta +
   (consumo y cuota            la plata toca              cuotas futuras +
    por fecha+categoría)       tu cuenta                  recurrencias
   pago resumen = NO gasto     pago resumen = sale        pago resumen = baja
   (cancela deuda)             de tu cuenta               el compromiso
   → "En qué se fue"           → Disponible + Balance     → bloque "Comprometido"
```

Este change toca **solo la lente CONSUMO** ("En qué se fue"). Las otras lentes son cambios posteriores del roadmap.

El estado actual: `getMonthCategoryBreakdown` está en base caja a medias — excluye el gasto de tarjeta vía `card_period_id IS NULL` y netea reintegros capeando el neto por categoría a 0. El gasto de tarjeta queda invisible por categoría (ni al consumir ni al pagar). El dato necesario para devengado **ya existe**: cada consumo y cada cuota hija tienen `date`, `category_id` y `card_period_id`; el padre de cuotas es off-ledger (`is_parent`, `account_id=null`).

## Goals / Non-Goals

**Goals:**
- "En qué se fue" refleja el consumo real por categoría en base devengado (incluye tarjeta por fecha de compra/devengo de cada cuota).
- Reintegros netean honestamente (sin capeo), habilitando categorías en crédito visibles.
- Cero migraciones; reusar el dato existente y la matemática de `@grana/money-logic`.

**Non-Goals:**
- No tocar la lente CAJA (Balance del mes / Disponible). El pago de resumen sigue como está en Balance del mes en este change (su relabeling = N1, va aparte).
- No construir el bloque "Comprometido" ni el hero ajustado ni la tarjeta como pasivo (roadmap posterior).
- No cambiar cómo se cargan/almacenan consumos, cuotas o reintegros.

## Decisions

**Q1 — Cuotas: devengan mes a mes (no todo al comprar).**
Dos lecturas válidas de "devengado": (a) económico puro (YNAB: todo el monto al comprar) vs (b) financiero/LatAm (Mobills/Organizze: una cuota por mes). Se elige **(b)**: es el modelo de datos actual, lo que hace el mercado regional, y el modelo mental argentino ("este mes me caen estas cuotas"). El beneficio de (a) —ver el compromiso total para no sobre-endeudarse— lo cubre la lente COMPROMISO (cola de cuotas futuras), no inflando el consumo del mes.

**Q2 — Reintegros: agnósticos al target, netean por categoría con créditos, prospectivo.**
Para la lente CONSUMO, el `reimbursement_target` (a-cuenta vs statement) es **irrelevante**: ambos son "te volvió $X en categoría Y". El target solo decide dónde cae la plata (a-cuenta → CAJA ahora; statement → baja el COMPROMISO). Regla: todo reintegro recibido (no cancelado) netea contra su categoría derivada (del gasto linkeado) **por su `date`**, sin capeo. Si el neto de una categoría queda negativo, es un **crédito** ("te devolvieron"). Netea **prospectivo** (en el mes del reintegro), no retroactivo (no reescribe meses pasados).

**Q3 — Multimoneda: devengado la simplifica.**
Cada consumo queda en el desglose de su moneda a su monto nativo, sin conversión. La cotización-al-pagar (resumen USD pagado en ARS) es un problema **puramente de CAJA**, no de CONSUMO. "En qué se fue" USD = consumos USD por fecha/categoría, limpio.

**Créditos fuera de la dona.**
Una dona no puede dibujar una porción negativa. Las categorías con neto positivo van a la dona + leyenda (normal). Las que quedan en crédito se muestran como **fila(s) aparte abajo**, en verde, tipo "↩ Te devolvieron · Comida $X". El total del centro = gasto neto positivo; los créditos no distorsionan la geometría.

**Reusar `computeCategoryNet`.**
La matemática de neto por categoría ya vive en `@grana/money-logic`. El cambio acá es: (1) que el set de gastos incluya consumos/cuotas de tarjeta (no filtrarlos), (2) que el reintegro sea agnóstico al target, (3) que el consumidor NO descarte `neto <= 0` sino que separe positivos (dona) de negativos (créditos).

**Reusar al máximo el diseño actual del dashboard (restricción dura).**
Este change NO rediseña la card "En qué se fue". Reutiliza tal cual la anatomía existente: `SpendingSection` (web `spending-section.tsx` / mobile `SpendingSection.tsx`), `SpendingDonut`, la leyenda, el toggle `Segmented` ARS/USD, los colores de categoría, el eye-mask y los skeletons. El cambio es de **datos** (la query devengada) + **dos agregados mínimos de UI**, encajados dentro de la card actual sin tocar el layout del dashboard:
1. La **fila(s) de créditos** ("↩ Te devolvieron · Comida $X"), debajo de la leyenda, reusando el patrón de fila existente (dot + label + monto) en tono verde — NO una card ni sección nueva.
2. Una **nota mínima opcional** "incluye tarjeta (aún no pagada)" al pie, en el estilo de notas que ya tiene la card.
Cualquier cosa que requiera card nueva, layout nuevo o reordenar el dashboard queda **fuera de scope** (eso vive en los changes #2/#3 del roadmap). Paridad web/mobile sin divergencia de diseño.

## Risks / Trade-offs

- **[El total de "En qué se fue" sube y difiere de "Gastos" de Balance del mes]** → Es el objetivo, no un bug. Se mitiga con rótulos claros (N2): CONSUMO devengado vs CAJA. Sin esto, reaparece la confusión original.
- **[Tensión "gastaste pero tu disponible no bajó"]** → El consumo de tarjeta aparece por categoría aunque la plata no haya salido. Se resuelve con la lente COMPROMISO (roadmap #2), no en este change. Mientras tanto, conviene una nota/rótulo que aclare "incluye tarjeta (aún no pagada)".
- **[Categoría en crédito puede confundir]** → Raro en la práctica; el display "te devolvieron" fuera de la dona lo hace explícito en vez de esconderlo.
- **[Reintegro cuyo gasto original es de otro mes]** → Bajo el modelo prospectivo, aparece como crédito en el mes del reintegro. Correcto: el gasto ya impactó en su mes, el reintegro impacta en el suyo.

## Migration Plan

Sin migraciones de datos. Es un cambio de lectura/agregación + presentación. Rollback = revertir el commit. Como cambia números visibles que el usuario ya conoce, conviene comunicar el cambio (o al menos tenerlo presente en QA con datos reales).

## Open Questions

- ¿La nota de "incluye tarjeta (aún no pagada)" va en este change o espera al bloque Comprometido (#2)? (Tiende a ir mínima acá para no confundir.)
- N1 (relabel del pago de resumen en Balance del mes): ¿se hace junto a #2 (Comprometido) o como mini-change adyacente?
