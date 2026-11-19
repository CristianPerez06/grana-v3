## Why

`account-running-balance-both-currencies` mostró los saldos en pesos y en dólares uno abajo del otro en cada fila. Probado con datos reales, la lista se lee peor: cada fila carga números de las dos monedas aunque el movimiento sea de una sola. Las apps que manejan varias monedas (Wise, Revolut, el resumen del propio Santander) muestran una moneda por vez, cada una con su lista y su saldo.

## What Changes

- En el detalle de una cuenta que usa pesos y dólares aparece un selector **ARS | USD** al lado del título «Movimientos», con el mismo aspecto que el de «¿En qué gasté?». En el celular (web y app) el encabezado y la barra de herramientas ocupan dos filas en lugar de cuatro: «Movimientos [ARS | USD] [+]» y «‹ Nov 2026 ›» con la lupa, recurrencias y filtros. En la app, «Buscar / Recurrencias / Filtros» pasan a íconos, como en la web, también en la pestaña Movimientos.
- Cada moneda muestra solo sus movimientos y un único saldo por fila, el de esa moneda. Arranca en ARS.
- Un cambio de moneda dentro de la misma cuenta aparece en las dos: en ARS como salida (`−$ 3.859.133,55`) y en USD como entrada (`+US$ 2.482,00`).
- La moneda elegida **no es un filtro**: no aparece como chip, no cuenta en el botón de filtros, la hoja no la ofrece y «Limpiar todo» no la cambia. Tampoco oculta el saldo, porque no saltea filas de ese libro; los demás filtros y la búsqueda sí lo ocultan, como antes.
- En todas las filas de movimientos (web y app) se quita la etiqueta «USD» debajo de un monto en dólares: `US$` ya lo dice.
- Una cuenta de una sola moneda no muestra el selector.
- Igual en las tres versiones: web en compu, web en celular (saldo debajo del monto) y app nativa.
- Se quita el saldo doble por fila y las dos patas en una misma fila.
- **Lista corrida, sin selector de mes**, en las tres versiones: todos los movimientos de la cuenta, del más nuevo al más viejo, con «Cargar más» al final, como el resumen de un banco. Para un tramo puntual, la hoja de filtros ofrece «Desde / Hasta». El selector de mes queda en la pestaña Movimientos, que responde «¿cuánto gasté este mes?».
- **Todo en una fila:** «Movimientos [ARS | USD]» con la lupa y los filtros (y el «+ Agregar» en la web). En un teléfono angosto, ARS | USD baja debajo del título. **Se quita el acceso a recurrencias** del detalle de cuenta: lleva al listado general, que no tiene que ver con la cuenta, y sigue en la pestaña Movimientos.
- **La app usa en el detalle de cuenta las mismas filas que la pestaña Movimientos** (ícono, «Ajuste», «Cambio», «Transferencia», agrupadas por día, y tocar abre el detalle). Antes tenía una fila propia que mostraba «12 nov» o «CU» como título.
- El mes se lee «Noviembre 2026» / «Nov 2026» y los días «Viernes, 13 de noviembre», sin el «De» en mayúscula, en la web y en la app.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `transactions`: el saldo corriente del listado de una cuenta pasa a mostrarse de a una moneda, con el selector ARS | USD.
- `accounts`: el detalle de cuenta nativo sigue la misma regla.
- `cards`: los montos en dólares de la lista de movimientos del período dejan la etiqueta «USD» extra.
- `spending-by-category`: en la pestaña Movimientos de la app, los botones de búsqueda y filtros pasan a ícono.

## Impact

- `@grana/money-logic`: `legInCurrency` (la parte de un movimiento en una moneda, desde una cuenta).
- Web: `MovementRow`, `MovementList`, contenedor de la lista del detalle de cuenta.
- Mobile: `MovementsSection`, `MovementRow` y `applyAccountFilters` del detalle de cuenta.
- Sin migraciones ni consultas nuevas.
