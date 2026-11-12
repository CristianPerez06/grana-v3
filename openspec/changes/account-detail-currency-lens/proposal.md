## Why

`account-running-balance-both-currencies` mostró los saldos en pesos y en dólares uno abajo del otro en cada fila. Probado con datos reales, la lista se lee peor: cada fila carga números de las dos monedas aunque el movimiento sea de una sola. Las apps que manejan varias monedas (Wise, Revolut, el resumen del propio Santander) muestran una moneda por vez, cada una con su lista y su saldo.

## What Changes

- En el detalle de una cuenta que usa pesos y dólares aparece un selector **ARS | USD** arriba de la lista, con el mismo aspecto que el de «¿En qué gasté?».
- Cada moneda muestra solo sus movimientos y un único saldo por fila, el de esa moneda. Arranca en ARS.
- Un cambio de moneda dentro de la misma cuenta aparece en las dos: en ARS como salida (`−$ 3.859.133,55`) y en USD como entrada (`+US$ 2.482,00`).
- El selector usa la misma moneda que la hoja de filtros: elegir USD en uno lo elige en el otro. Elegir la moneda **no** oculta el saldo, porque no saltea filas de ese libro; los demás filtros y la búsqueda sí lo ocultan, como antes.
- Una cuenta de una sola moneda no muestra el selector.
- Igual en las tres versiones: web en compu, web en celular (saldo debajo del monto) y app nativa.
- Se quita el saldo doble por fila y las dos patas en una misma fila.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `transactions`: el saldo corriente del listado de una cuenta pasa a mostrarse de a una moneda, con el selector ARS | USD.
- `accounts`: el detalle de cuenta nativo sigue la misma regla.

## Impact

- `@grana/money-logic`: `legInCurrency` (la parte de un movimiento en una moneda, desde una cuenta).
- Web: `MovementRow`, `MovementList`, contenedor de la lista del detalle de cuenta.
- Mobile: `MovementsSection`, `MovementRow` y `applyAccountFilters` del detalle de cuenta.
- Sin migraciones ni consultas nuevas.
