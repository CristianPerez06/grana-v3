## Context

Ver `proposal.md`. Estado actual:

- `computeRunningBalances` (`@grana/money-logic`) ya devuelve, por cada movimiento, el saldo de la cuenta en ARS **y** en USD. La web (`MovementRow`) elige uno solo: el de la moneda del movimiento.
- `resolveMovementView` proyecta un cambio de moneda desde la cuenta: si la cuenta es el origen devuelve solo la pata que sale, aunque también sea el destino.
- La web oculta la columna de saldo debajo de 760px (`hidden md:block`). La app nativa no tiene saldo por fila, pero ya carga el historial ascendente completo de la cuenta (`useAccountMovements`) y el detalle con el saldo inicial por moneda (`useAccountDetail`).

## Goals / Non-Goals

**Goals:** las tres superficies (web ancha, web angosta, nativa) muestran los mismos saldos y las mismas patas, derivados de las mismas funciones puras.

**Non-Goals:** cambiar el cálculo de saldos, las consultas o el listado global.

## Decisions

**1. Qué monedas muestra el saldo: una función pura nueva en `@grana/money-logic`.**
`runningBalanceCurrencies(rows, accountId, initial): BalanceCurrency[]` devuelve `['ARS']`, `['USD']` o `['ARS','USD']` (siempre en ese orden). Una moneda entra si su saldo inicial ≠ 0 o si alguna fila del historial completo la mueve desde esta cuenta (incluida la pata de destino de un cambio). Si no entra ninguna (cuenta vacía), devuelve las monedas de la cuenta tal como las tiene configuradas, en orden ARS→USD, para no mostrar un saldo vacío. Se calcula sobre el historial completo, que ya está cargado en las dos apps: la cantidad de saldos no cambia entre meses. Vive junto a `computeRunningBalances` porque lee lo mismo; web y mobile la llaman, no la reescriben.

**2. La pata recibida del cambio: un campo opcional en `MovementView`.**
`resolveMovementView` agrega `receivedLeg?: { amount, currencyCode }` solo cuando la perspectiva es de cuenta, el movimiento es un cambio y la cuenta es origen y destino a la vez. El resto de los campos no cambia, así que `/transactions`, el detalle y los cambios entre dos cuentas quedan iguales. La app nativa lo recibe gratis porque su `accountMovementView` ya delega en esta función.

**3. Layout angosto: el saldo va debajo del monto, en la misma columna.**
En pantalla angosta no entra una tercera columna sin dejar la descripción ilegible. Debajo del monto, separado por un pequeño espacio y en texto chico atenuado, van las líneas del saldo (ARS y, si corresponde, USD más chico). En la web el mismo `MovementRow` hace las dos cosas: columna aparte `md:` y bloque debajo del monto por debajo de `md`. La app nativa replica el bloque angosto. Que la web ancha tenga columna y el celular no es una diferencia de ancho, no de plataforma: web angosta y nativa se ven iguales.

**4. El contrato de la fila cambia de "un saldo" a "una lista de saldos".**
`MovementRow` (web) recibe el snapshot y la lista de monedas a mostrar en lugar de leer `snapshot[view.currencyCode]`. Se mantiene un solo saldo cuando la lista tiene una sola moneda. `MovementList` pasa la lista; el contenedor del detalle la calcula una vez con `runningBalanceCurrencies`. La fila sintética "Saldo inicial" sigue la misma regla que el resto.

**5. Mobile: mismas funciones, mismos filtros.**
`MovementsSection` calcula los snapshots con `computeRunningBalances` sobre `movements` (ya ascendente) y el saldo inicial por moneda de `account.currencies`, y las monedas con `runningBalanceCurrencies`. Oculta el saldo si hay filtros de contenido activos o una búsqueda. Para que la web haga lo mismo, el contenedor web también oculta el saldo con búsqueda activa, como ya dice la spec (hoy solo mira `hasActiveContentFilters`, que no incluye la búsqueda).

## Risks / Trade-offs

- [Filas más altas en celular para cuentas bimoneda] → El bloque de saldo es chico y atenuado; una cuenta de una sola moneda agrega solo una línea.
- [El tono de la pata recibida difiere entre web y nativa] → Cada plataforma usa para la segunda línea el mismo tono que ya usa para el monto del cambio; unificar el tono del cambio queda fuera de este cambio.
- [La app nativa no tiene filas de "Saldo inicial"] → No cambia: el saldo arranca desde el saldo inicial igual que en la web, solo que sin esa fila.
