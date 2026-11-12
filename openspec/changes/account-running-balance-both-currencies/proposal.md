## Why

En el detalle de una cuenta que tiene pesos y dólares, cada fila muestra el saldo solo en la moneda de ese movimiento. Un cambio de moneda dentro de la misma cuenta (pesos → dólares en el mismo banco) muestra solo la parte en pesos: no se ve cuántos dólares entraron ni con cuántos dólares quedó la cuenta, así que no se puede distinguir lo que se cambió hoy de lo que ya había. Además, en el celular (web y app) la columna de saldo no existe: solo se ve el total arriba.

## What Changes

- En el detalle de una cuenta que usa (o usó) las dos monedas, cada fila muestra el saldo después de ese movimiento **en pesos y en dólares, uno abajo del otro** (pesos arriba, dólares abajo y más chico). Una cuenta de una sola moneda se ve como hoy: un solo saldo.
- La decisión de mostrar uno o dos saldos es de la **cuenta entera**, no de cada fila: todas las filas de esa cuenta muestran lo mismo, en cualquier mes.
- Un **cambio de moneda dentro de la misma cuenta** muestra las dos partes en el monto: lo que salió (`−$ 3.859.133,55`) y, abajo, lo que entró (`+US$ 2.650,00`).
- **El saldo por fila pasa a verse en el celular**: en la web en pantalla angosta (hoy se oculta debajo de 760px) y en la app nativa (hoy no lo tiene). En pantalla angosta va debajo del monto, porque no entra como columna aparte. Las tres versiones muestran lo mismo.
- Sin cambios: los filtros de contenido siguen ocultando el saldo; `/transactions` y el detalle de tarjeta no muestran saldo por fila; ningún número cambia, solo qué se muestra.

No se hace: mostrar las dos partes del cambio en el listado global (`/transactions`), ni tocar el detalle del movimiento.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `transactions`: el saldo corriente por fila muestra ambas monedas cuando la cuenta usa las dos; el cambio de moneda dentro de la misma cuenta muestra ambas patas; el saldo deja de ocultarse debajo de 760px y pasa debajo del monto.
- `accounts`: el detalle de cuenta en la app nativa muestra el saldo corriente por fila (antes lo excluía explícitamente) con las mismas reglas que la web.

## Impact

- `@grana/money-logic`: vista por perspectiva de cuenta (pata recibida del cambio) y la regla de qué monedas muestra el saldo de la cuenta. Puras, con tests.
- Web: `MovementRow`/`MovementList` y el contenedor del detalle de cuenta.
- Mobile: `components/accounts/MovementRow` y `MovementsSection`, y la pantalla `accounts/[id]` (le pasa el saldo inicial por moneda).
- Sin migraciones, sin cambios de datos ni de consultas.
