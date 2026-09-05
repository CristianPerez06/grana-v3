## Why

La card "En qué se fue" y la card "Cuánto gastaste" del Inicio mostraban dos números distintos para el mismo mes sin ninguna forma de conciliarlos: 2.211.312,91 contra 2.064.327,84 en agosto de 2026. Ninguno está mal, pero el de la dona no significa nada por sí solo: es la suma de las porciones **dibujadas**, y una dona no puede dibujar una porción negativa, así que la categoría que quedó en crédito (Salud, −146.985,07 por un reintegro de julio) salió del anillo y se llevó su parte del total. El resultado es un número que no es ni bruto ni neto, con la etiqueta "Gastado" al lado de un "Gastaste" del Inicio que sí es el neto.

Medido sobre los datos reales del usuario: en cinco meses con actividad, la brecha aparece en uno. Es ocasional, no permanente — por eso la respuesta es una línea de cierre y no un rediseño de la card.

## What Changes

- Cuando hay categorías en crédito, la card "En qué se fue" cierra con una línea **"Te costó"** = total del centro − créditos. Sin créditos la línea no aparece, porque el centro ya es ese número.
- La resta usa aritmética de dinero (`netAfterCredits` en `@grana/money-logic`), no resta de floats: la card no puede inventar un centavo.
- Web y nativo en la misma entrega.

### Alternativas descartadas

- **Que el centro pase a mostrar el neto.** Rompe los porcentajes del ranking: hoy cada fila muestra su parte del centro, y si el centro deja de ser la suma de las porciones, o los porcentajes dejan de referirse a él o pasan a sumar más de 100 %.
- **Que la dona pese por bruto y los reintegros sean una fila que resta.** Es lo más legible de las tres, pero cambia la lente: la spec define el peso de cada categoría como el neto, y la lista drilleada promete que su suma iguala ese peso. No es presentación.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `spending-by-category`: el requirement del neto por categoría suma la línea de cierre cuando hay créditos, nombra las dos causas de divergencia con el Inicio que la línea NO explica, y agrega dos escenarios.

## Impact

- `@grana/money-logic`: `netAfterCredits` en `category-breakdown.ts`, con tests en `apps/web/lib/transactions/__tests__/net-after-credits.test.ts`.
- `@grana/i18n-messages`: `transactions.spending.net_total_label` en `es` y `en`.
- Web: `apps/web/lib/transactions/components/category-spending-overview.tsx` (línea + `labels.netTotalLabel`) y su container.
- Nativo: `apps/mobile/components/transactions/CategorySpendingOverview.tsx`.
- Ninguna lectura cambia: los números que la card ya mostraba siguen siendo los mismos.
