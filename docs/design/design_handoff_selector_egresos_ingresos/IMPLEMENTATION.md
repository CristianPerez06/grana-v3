# Implementación — Selector Egresos / Ingresos

Registro de cómo se llevó el handoff al codebase (web). El README de este bundle es
la fuente de diseño; este archivo documenta las decisiones de implementación.

## Qué se hizo

Se agregó el **selector Egresos / Ingresos** (variante "pill", consistente con el
toggle ARS/USD) a la tarjeta de resumen del módulo Movimientos. Al cambiar de modo se
actualiza, en una sola pasada: título, color de acento, subtítulo, label y monto central
de la dona, paleta de la dona, los dots y el ranking de categorías.

- **Egresos** → "En qué se fue", acento navy `#0B1A2B`.
- **Ingresos** → "De dónde vino", acento emerald `#0E9E6E`, paleta verde por posición.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `apps/web/lib/transactions/queries.ts` | Nueva `getMonthIncomeBreakdown(month)`: agrega `type='income'` por categoría y moneda (gemela de la de egresos). |
| `apps/web/app/(app)/transactions/page.tsx` | Parseo de `?overview=ingresos`, ramas de datos por modo, hrefs que preservan modo/moneda, labels i18n por modo. |
| `apps/web/lib/transactions/components/category-spending-overview.tsx` | Props `mode`/`egresosHref`/`ingresosHref`, selector pill, accent por modo, paleta verde posicional en ingresos, empty-state dashed, nota al pie solo en egresos. |
| `packages/i18n-messages/src/{es,en}.json` | Keys `mode_egresos/ingresos`, `subtitle_egresos`, `income_eyebrow/center_label/subtitle/empty`. |

## Decisiones (donde el prototipo difiere de la realidad)

1. **Datos reales, no mock.** Ingresos sale de transacciones `type='income'` del mes
   seleccionado (ARS/USD por separado). Nada hardcodeado.
2. **"Reintegros" NO es ingreso.** El mock lo listaba como categoría de ingreso, pero el
   dominio (AGENTS.md) es taxativo: un reintegro es `type='reimbursement'`, deriva la
   categoría del gasto y **nunca** es income. La query de ingresos **no** los incluye
   (ya están netados en el donut de egresos; incluirlos los contaría dos veces).
3. **Colores de egresos sin cambios.** Egresos sigue usando el color por-categoría de la
   DB (decisión "lo más limpio/eficiente"); la paleta fija del handoff se aplica solo a
   **ingresos** vía una sola prop opcional. El acento del título/label central sí pasó a
   navy en egresos para seguir el handoff.
4. **URL-driven.** El modo vive en `?overview=ingresos` (default egresos), igual que el
   toggle de moneda. El toggle de moneda preserva el modo y viceversa.
5. **Drill-down y "in-category" son de egresos.** El prototipo no tiene drill en ingresos;
   se mantiene el comportamiento existente solo en egresos. Ingresos es ranking plano.
6. **Empty-state** por combinación modo/moneda sin datos, con el patrón de caja dashed
   del módulo.

## Notas

- La card real ya tenía navegación de mes (‹ mes ›), drill-down a subcategorías y nota al
  pie, que el prototipo no muestra; se preservaron. Por eso el header no es 100% idéntico
  al prototipo (que no tiene month-nav).
- No se siguió el ceremonial OpenSpec formal (decisión acordada); el cambio queda
  documentado acá y en los mensajes de commit.
