## Contexto

El home de Compartido tiene dos superficies que hablan de plata:

1. **Franja de deuda** (arriba, fija en "hoy") — responde *"¿quién le debe a quién?"*: "le debés a X" / "X te debe" por moneda, con Saldar y Ver el detalle. Es el termómetro del saldo.
2. **Últimos movimientos** (abajo, gobernado por el navegador de mes) — un **log de gastos** del hogar.

El defecto reportado nace de que la lista intentó también contestar la pregunta de la deuda, en cada fila, y lo hizo de forma inconsistente.

## Los dos modelos posibles

```
  MODELO A — "Mi consumo"          MODELO B — "El saldo entre nosotros"
  ─────────────────────────        ──────────────────────────────────
  Número = ownShare (siempre)      Número = el delta que se mueve
  Siempre − (es gasto)             Firmado: + si te deben, − si debés
  Consistente, simple              Verde/rojo según dirección
  La deuda vive en la franja       El log ES el estado de la deuda
```

La implementación actual tomaba la **cantidad** del Modelo B (`youPaid ? total−tuParte : tuParte`) pero el **signo** del Modelo A (siempre `−`). De ahí la contradicción: un cobro a favor (el otro te debe) pintado de rojo con `−`.

## Decisión: Modelo A (log de gastos), con el total como protagonista

**El listado es un log de gastos, no la pantalla de saldo.** La deuda ya está resuelta, sin ambigüedad y en un solo lugar, en la franja de arriba. Duplicarla por fila (Modelo B) agrega ruido y, mal firmada, miente.

Cada fila muestra **dos cifras fijas, invariantes a quién pagó**: el **total del movimiento** (protagonista, grande) y la **parte propia** (detalle, "Tu parte: $X"). Así todas las filas son comparables de un vistazo y el signo `−`/rojo es honesto: es el gasto del hogar.

**Iteración registrada:** la primera implementación hacía protagonista a la parte propia (`ownShare`) y mostraba el total como secundario ("de $total"). Evaluándolo en la app, el usuario pidió invertirlo: como log de gastos, primero quiere ver *cuánto salió el movimiento* y luego su parte. El principio (dos cifras estables, sin significado dependiente del pagador) se mantiene; solo cambió cuál va grande.

**Por qué no Modelo B:** requeriría firmar y colorear por dirección de deuda en cada fila (más complejo), y competiría con la franja de deuda que ya cumple ese rol. Reservamos el "estado de la deuda" para la franja y la cuenta corriente, que lo hacen bien.

## Coherencia con el resto del home

`ownShare` es exactamente la base que ya usan el hero neto y el desglose por categoría (`spending-breakdown.ts:44` netea gasto y reintegro por `ownShare`). Al mostrar `ownShare` por fila, **la suma de las filas cuadra con el desglose y el hero**. El Modelo B nunca cuadraba con esos números.

## Bordes

- **Reintegro** → total del reintegro como protagonista (verde si recibido), "Tu parte" debajo. Mismo criterio que el gasto.
- **`ownShare = 0`** (split 100/0, pagaste todo del otro) → con el total como protagonista el borde se disuelve: la cifra grande nunca fue la parte propia, así que no hay `−$0`. La línea "Tu parte: $0" se muestra como en cualquier fila con reparto. (El alta de un gasto 100% del otro miembro es otro tema, fuera de este change.)
