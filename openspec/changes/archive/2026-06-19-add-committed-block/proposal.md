## Why

El dashboard ya responde "¿cuánto tengo?" (Hero/Disponible) y "¿cómo se movió mi plata?" (Balance del mes) — ambas lente CAJA — y "¿en qué se fue?" (CONSUMO devengado). Falta la tercera lente, **COMPROMISO**: "¿qué debo / qué se viene?". Hoy la deuda de tarjeta y los gastos fijos del mes próximo no aparecen en el dashboard.

Además, en el QA quedó claro que el usuario no entiende por qué "Gastos" (caja) es menor que "En qué se fue" (devengado): la diferencia es el consumo de tarjeta del mes, que no salió de la caja porque se financió. Hace falta **explicarlo en el lugar donde nace la confusión** (la fila Gastos).

## What Changes

- **Nueva card "Lo que se viene"** (Comprometido) en el dashboard (web), a la derecha de "Balance del mes" en una fila de dos columnas (apiladas en mobile), reusando el patrón de grid de la fila del Hero. Lente COMPROMISO, **estática "desde hoy"** (NO responde al selector de mes). Bimoneda separada (ARS/USD nunca se suman). Muestra:
  - **Total comprometido** (titular) = lo que SALE = deuda de tarjeta + gastos recurrentes del mes próximo.
  - **Deuda de tarjeta**: cargos pendientes (consumos − reintegros recibidos) de TODOS los resúmenes impagos de las tarjetas (en curso + cerrados + vencidos).
  - **Gastos recurrentes (próx mes)**: proyección de reglas de recurrencia activas tipo `expense` para el mes calendario siguiente.
  - **Ingresos recurrentes (próx mes)**: proyección de reglas tipo `income`, mostrada como **contexto** ("lo que entra"), NO sumada al total.
- **Tira 💳 "financiado en tarjeta"** como elemento **full-width propio, debajo de la fila de las dos cards** (no dentro de ninguna card), visible **solo cuando hubo consumo de tarjeta en el mes**: conecta los tres números — total gastado (devengado) = gasto de caja + financiado en tarjeta — y aclara que lo financiado "se paga en los próximos resúmenes". Por construcción `financiado = total_devengado − gasto_de_caja`, de modo que la suma cierra. Sigue el navegador de mes.
- **Rename**: la card "En qué se fue" pasa a titularse **"¿En qué gasté este mes?"** (hay plata que se gastó —tarjeta— pero no se fue de la caja; "se fue" confundía). El título es la pregunta, sin subtítulo aparte.
- Se reusa el diseño actual (Card + filas con dot/monto estilo `FlowRow`, skeleton shape-matched, eye-mask), sin rediseño. Sin flecha entre cards.

## Capabilities

### New Capabilities
<!-- ninguna: todo vive dentro de la capability dashboard existente -->

### Modified Capabilities
- `dashboard`: nuevo requirement para la card "Comprometido" (lente COMPROMISO, estática desde hoy, resúmenes de tarjeta + recurrentes proyectados, bimoneda, ingreso recurrente de contexto); nuevo requirement para la tira 💳 "financiado en tarjeta" (full-width, debajo de la fila). Modificación del requirement del selector de mes (NO gobierna "Comprometido"; sí la tira). Modificación del requirement de rótulos de pregunta (la card de consumo se titula "¿En qué gasté este mes?", sin subtítulo).

## Impact

- **`@grana/dashboard`** (`packages/dashboard`):
  - Nueva query/agregación para la card Comprometido: deuda de tarjeta total (suma de `pending` consumos − reintegros recibidos sobre TODOS los períodos impagos de todas las tarjetas) + proyección de recurrencias (`expense`/`income`) al mes próximo. Reusa `projectUpcomingOccurrences` (`@grana/money-logic` recurrences.ts) y la lógica de pendientes por período de `apps/web/lib/cards/queries.ts` (hay que sumar el período en curso, no solo los "a pagar" cerrados como hace `getCardsMonthSummary`).
  - El número "financiado en tarjeta" del mensaje 💳 = total de `getMonthCategoryBreakdown` (devengado) − `totalExpense` de `getMonthBalanceSeries` (caja). Hay que tener ambos disponibles en la sección de Balance del mes.
  - Nuevos tipos en `types.ts`.
- **`apps/web/app/(app)/dashboard/_components`**: nueva card (container + section + skeleton, naming espejo); la fila Balance+Comprometido como grid de dos columnas en `dashboard-content.tsx`; el mensaje 💳 al pie de `month-balance-section.tsx`.
- **i18n** (`@grana/i18n-messages`): claves `dashboard.committed.*` y `dashboard.month.financed_on_card` (con interpolación de los tres montos).
- Mobile: DIFERIDO (paridad en un change posterior).
- `summarizePeriod`/`committed` de `@grana/money-logic`: código muerto, NO se reusa (su `committed` es accrual por-mes, no la proyección de COMPROMISO).
