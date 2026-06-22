## Context

El hero navy de `/cards` lo alimenta `getCardsMonthSummary(supabase)` (`apps/web/lib/cards/queries.ts`), que a su vez se construye sobre `getCreditCards()`. Hoy expone una sola cifra de pago:

- `toPayARS` / `toPayUSD`: suma de resúmenes **cerrados e impagos** (`isToPay = (end_date < hoy || due_date < hoy) && tx_count > 0 && !has_payment`).
- `nextCloses`: próximos cierres (resúmenes abiertos `end_date >= hoy`), una fila por tarjeta `{ endDate, cardName }`, ordenado por cierre, capado en 3.

`getCreditCards()` carga **todos** los `card_periods` de todas las tarjetas en una sola query y precalcula los montos pendientes por período (`amountByPeriod`), pero por tarjeta solo **expone** `activePeriod` (un período elegido por prioridad: vencido → cerrado-esperando-pago → abierto → fallback). El componente `CardsMonthHero` consume el summary; cuando `hasToPay` es false, la UI muestra el texto `month_hero.empty` en vez del `$ 0` que pide el spec.

El gap: el usuario al día (sin cerrados-impagos) no ve nada útil, cuando la data para anticipar "lo que se viene" (resúmenes abiertos devengándose) ya está cargada.

## Goals / Non-Goals

**Goals:**
- Mostrar en el hero **dos cifras**: "A pagar (ahora)" (sin cambios) y "En curso" (nueva, con caption "se sigue sumando hasta el cierre"), ambas en Bimoneda.
- Alinear el empty-state de "A pagar" a `$ 0` (cerrar el drift con el spec).
- Mostrar más cierres en "Próximos cierres" (cap 6) para llenar la columna; las filas son `fecha · nombre`, sin monto.
- Resolver "En curso" **sin N+1**, reutilizando los períodos que `getCreditCards()` ya carga.

**Non-Goals:**
- Tocar el resto del listado (wallet, grupos por banco, filas, archivadas).
- Cambiar la contabilidad: "A pagar" mantiene su semántica exacta.
- Implementar el hero de dos cifras en **mobile** ahora (paridad estructural como follow-up).
- Convertir/sumar ARS con USD, o "A pagar" con "En curso".

## Decisions

### 1. "En curso" = resumen **abierto** con saldo de cada tarjeta, no `activePeriod`
Una tarjeta con un resumen "a pagar" tiene **dos** períodos vivos: el cerrado-impago (su `activePeriod`) y el siguiente **abierto** que se está devengando. "En curso" debe sumar el período **abierto** (`start_date <= hoy <= end_date`, `!has_payment`, pendiente > 0) de **cada** tarjeta activa. Por eso NO puede derivarse de `activePeriod`.

- **Alternativa considerada:** computar "En curso" dentro de `getCardsMonthSummary` a partir de `card.activePeriod`. **Rechazada**: para las tarjetas en estado "a pagar", `activePeriod` es el cerrado, no el abierto → sub-contaría.

### 2. Exponer el período en curso desde `getCreditCards()` (cero N+1)
`getCreditCards()` ya tiene **todos** los períodos + `amountByPeriod` en memoria. La decisión es que, donde hoy deriva `activePeriod`, además derive el **período en curso** (el `unpaidPeriod` con `start_date <= hoy <= end_date`) y lo exponga en `CreditCardSummary` como `inProgress: { endDate, amountARS, amountUSD } | null` (null si no hay período abierto). `getCardsMonthSummary` suma `inProgress.amount*` por moneda en `inProgressARS` / `inProgressUSD` sobre todas las tarjetas.

- **Alternativa considerada:** una query nueva que traiga los períodos abiertos. **Rechazada**: N+1 / query redundante; los datos ya están cargados.
- **Por qué un objeto y no dos números sueltos:** "Próximos cierres" necesita la **fecha de cierre** del período en curso (no solo el monto), así que se expone `{ endDate, amountARS, amountUSD }`. Es una proyección mínima, no el período completo.

### 3. "Próximos cierres" se arma desde el período en curso (no desde `activePeriod`), sin monto
Hoy `nextCloses` se deriva de `upcoming`, que se construye sobre `activePeriod`. Para una tarjeta en estado "a pagar", `activePeriod` es el cerrado (`end_date` pasado) → queda fuera del filtro `end_date >= hoy` y la tarjeta **no muestra su próximo cierre**. Se corrige construyendo `nextCloses` desde el `inProgress` por tarjeta: una fila por tarjeta con período en curso (`{ endDate, cardName }`, **sin monto**), ordenada por fecha de cierre ascendente, capada en `NEXT_CLOSES_CAP` (6). Esto alinea "Próximos cierres" con la cifra "En curso" (misma fuente) y cubre el caso de las tarjetas con dos resúmenes vivos.

- **Sin monto en las filas:** el monto por tarjeta ya vive en el detalle de cada tarjeta más abajo en el listado; repetirlo en el hero es ruido. La fila es `fecha · nombre`.
- **Cap 6 (subido desde 3):** al ampliar el hero con dos cifras, una lista de solo 3 cierres dejaba la columna derecha medio vacía cuando hay más tarjetas. Se sube a 6 (cubre la mayoría de los casos personales); es un único `const NEXT_CLOSES_CAP` fácil de ajustar.

### 4. Rótulo "En curso" + caption "se sigue sumando hasta el cierre"
Se usa **"En curso"** para alinear con el vocabulario del propio módulo (el detalle de tarjeta ya usa "RESUMEN EN CURSO" y el badge "Sumando consumos"). NO se usa "estimado/estimación": el número **no es una estimación**, es el **acumulado real** de los consumos ya hechos en el ciclo abierto — un piso que crece hasta el cierre. El caption **"se sigue sumando hasta el cierre"** comunica esa naturaleza (acumula, no proyecta) sin mentir.

- **Alternativa considerada:** "En curso (estimado)" / "Se viene (estimado)". **Rechazada**: "estimado" implica proyectar un número futuro; acá mostramos consumos reales ya devengados (incompletos porque el ciclo sigue abierto), no una estimación.
- **Alternativa considerada:** "Comprometido". **Descartada para la UI del hero**: en el módulo Tarjetas la palabra natural es "en curso"; "Comprometido" es el nombre de la lente del dashboard, no de la cifra de tarjeta.

### 5. Empty-state `$ 0`, se retira `month_hero.empty` de "A pagar"
La cifra "A pagar" siempre muestra un número (`$ 0` incluido), nunca el texto. La clave i18n `month_hero.empty` deja de usarse para "A pagar". "En curso" sigue la misma regla (`$ 0` cuando no hay resúmenes abiertos con saldo).

### 6. Mobile: paridad estructural diferida
El hero de dos cifras se implementa primero en **web**. Mobile mantiene el contrato de datos (la lógica de agregación pura puede vivir en `lib/cards/` helpers) y se actualiza en un follow-up, conservando la estructura (dos cifras + próximos cierres).

## Risks / Trade-offs

- **"En curso" es un número que se mueve** (acumula con cada consumo) → Mitigación: caption "se sigue sumando hasta el cierre" y jerarquía visual subordinada a "A pagar" (que es deuda firme).
- **Dos cifras + próximos cierres aprietan el hero en viewports angostos** → Mitigación: las dos zonas se apilan (ya contemplado en el requirement); las dos cifras de la izquierda comparten fila o se apilan según el ancho.
- **Riesgo de doble conteo** (que un período entre en "A pagar" y "En curso" a la vez) → Mitigación: la separación es por `end_date`: si ya cerró (`end_date < hoy` o vencido) → "A pagar"; si está abierto (`start <= hoy <= end`) → "En curso". Son períodos distintos; ningún período cae en ambos.
- **Confusión usuario "¿por qué el total cambia?"** → Mitigación: el caption "se sigue sumando hasta el cierre" lo explica en línea.

## Migration Plan

- 100% read-path + presentación. **NO** hay migración de base de datos.
- Orden: (1) extender `getCreditCards()` con `inProgressARS/USD`; (2) extender `getCardsMonthSummary()` con `inProgressARS/USD` + monto en `nextCloses`; (3) actualizar `CardsMonthHero` (web) a dos cifras + `$ 0`; (4) i18n.
- **Rollback**: revertir el commit; sin estado persistido, sin migraciones que deshacer.

## Open Questions

**Todas resueltas:**
- **Alcance**: **web únicamente**, incluyendo el **responsive** del hero (las dos cifras + próximos cierres se apilan bien en viewports angostos). La **app nativa mobile NO entra** en este change — queda como follow-up, manteniendo la lógica de agregación en helpers de `lib/cards/` reutilizables.
- Rótulo: **"En curso"** + caption **"se sigue sumando hasta el cierre"** (no "estimado": es acumulado real, no proyección).
- Nota/tooltip: no hace falta; el caption lo explica en línea.
