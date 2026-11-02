## Why

En «Compromisos de noviembre» del Inicio, Galicia mostraba $357.180 y en Tarjetas $63.772. La diferencia era real en los datos: Visa Galicia tenía **dos resúmenes que vencían en noviembre** — el cerrado, que vence el 02/11, y el que cierra el 19/11, cuyo vencimiento se había estimado para el 30/11. El vencimiento de un resumen futuro se proyecta sumando días promedio al cierre, y nada impedía que cayera en el mismo mes que el anterior.

En la vida real un banco emite un resumen por mes: una tarjeta no puede vencer dos veces en el mismo mes. Con dos vencimientos estimados en noviembre, noviembre aparecía inflado y diciembre vacío.

## What Changes

- **Un solo vencimiento por mes y por tarjeta en las estimaciones.** Si el vencimiento proyectado de un resumen futuro cae en el mismo mes que el del resumen anterior (o antes), pasa al **día 1 del mes siguiente**. En el caso de Galicia: 30/11 → 01/12.
- **Solo afecta fechas estimadas.** Una fecha que el usuario carga desde un resumen real (al crear la tarjeta, al pagar o al editar un período) se guarda tal cual. La sugerencia que precarga el pago sí sigue la regla, y el usuario la puede corregir.
- **Los estimados ya guardados se corrigen** con la migración `0076_one_due_date_per_month.sql`: solo los períodos estimados y sin pago, solo su vencimiento. El cierre no cambia, así que ningún consumo cambia de resumen.
- **Qué ve el usuario:** en Compromisos de noviembre, Galicia muestra solo el resumen que vence el 02/11; el que cierra el 19/11 pasa a Compromisos de diciembre. Las fechas de vencimiento que se muestran en Tarjetas para resúmenes estimados también se corren.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `cards`: el algoritmo de sugerencia de fechas garantiza un vencimiento por mes calendario.

## Impact

- `packages/money-logic/src/cards.ts` — `suggestNextPeriodDates` y la nueva `dueAfterPreviousDueMonth`. Todas las proyecciones (alta de tarjeta, pago de resumen, edición de período, rolling de consumos futuros) pasan por ahí, en web y en nativo.
- `supabase/migrations/0076_one_due_date_per_month.sql` — corrección de datos, se pega en el SQL Editor. No cambia el contrato público.
