# Proposal: add-savings-purpose

> **Estado: implementado, sin archivar y sin mergear.** Fase 2 del modelo de dinero.
>
> Vive en `feature/add-savings-set-aside`, la **branch de integración del modelo**: todas las fases
> se construyen ahí y suben juntas. El nombre quedó de la fase 1 y ya no la describe entera — se
> mantiene igual porque renombrarla rompería las referencias del issue #58 y de las dos changes, y
> el nombre de una branch que va a colapsar en un solo commit no vale ese costo.
>
> Las dos compuertas son las mismas que las de la fase 1: **no se archiva** hasta el QA nativo
> ([#58](https://github.com/CristianPerez06/grana-v3/issues/58)), y **no se mergea** hasta que las
> fases completen el modelo.

## Why

La fase 1 dejó al usuario pudiendo decir *"esto no lo voy a gastar"*. Esta le deja decir
**para qué**.

La diferencia de precio entre las dos frases es enorme y va toda para el mismo lado:

> *"Guardaste $200.000"* es una abstracción.
> *"Guardaste $200.000 para Japón"* es una razón para volver.

Y no requiere saber dónde está esa plata ni cuánto rinde — por eso va **antes** que las
posiciones, que son caras. Es la fase que compra retención temprana con el trabajo más
barato del roadmap.

## What Changes

Una tabla, una columna, un selector y un `group by`:

- **`savings_purpose`** — nombre e ícono, propiedad del usuario.
- **`availability_reserve.purpose_id`** — nullable, sin backfill. Lo de la fase 1 queda
  como *«Sin destino»*.
- **`get_purpose_sums(date)`** — el guardado por (propósito, moneda). Alimenta el detalle
  agrupado y, sobre todo, el **piso** del write path.
- El drawer gana una fila y un selector; el detalle se agrupa.

## Lo que NO cambia, y es lo que la hace barata

- **`get_available_sums` y `get_reserve_flow_sums` quedan idénticas.** El propósito no
  participa de ningún número.
- **El dashboard no se toca.** La fila sigue diciendo lo mismo: el propósito vive un nivel
  más adentro.
- **Ninguna ruta nueva, ninguna entrada de menú.** Igual que la fase 1.
- **La plata sigue sin moverse de ninguna cuenta.** Ponerle nombre a un guardado no es un
  hecho contable.

## Lo que NO hace

Objetivo, fecha, progreso y barra. Eso es una **meta** y es de la fase 4, cuando existan
las posiciones que la respalden. Adelantarla acá dejaría una barra de progreso que no sabe
en qué moneda está parada la plata — que en Argentina es exactamente lo que no hay que
hacer.

## Impact

- **Specs:** `savings` (requirements nuevos; ninguno modificado).
- **Migración:** `0058_savings_purpose.sql`.
- **Código:** `packages/savings`, `packages/validation`, `packages/i18n-messages`,
  el drawer de web y su espejo nativo.
- **Riesgo:** bajo. Todo lo que agrega es aditivo y ninguna lectura de plata cambia.
