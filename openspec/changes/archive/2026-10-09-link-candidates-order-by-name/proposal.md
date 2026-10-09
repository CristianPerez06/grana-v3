## Why

En el QA de #190, con la lista «¿Cuál de estos es?» ya mostrando qué es cada movimiento, aparecieron
dos cosas:

- **El orden no ayuda a encontrar el gasto.** Hoy van primero los movimientos de la misma cuenta que
  la regla, después el importe más parecido y después la fecha. Lo que el usuario reconoce de su
  gasto es qué fue («Gimnasio»), no desde qué cuenta lo pagó.
- **Se cuela un impuesto de sellos de un resumen** («Impuesto de sellos · Visa Galicia · 20 jun»).
  Es el sello de un pago registrado antes de que la app atara cada sello a su pago (migración 0050),
  así que la regla de #190 no lo reconoce. La base tiene 15 sellos en esa situación, todos de junio y
  julio de 2026.

## What Changes

- La lista ordena: primero lo que coincide por nombre con la regla (la descripción, y si la regla no
  tiene, su subcategoría o categoría), después el importe más parecido, después la fecha más cercana.
  La cuenta deja de contar para el orden.
- El impuesto de sellos que la app cargó en una tarjeta para un pago anterior al vínculo deja de
  ofrecerse, y vincularlo se rechaza igual que el resto de lo excluido.
- Un impuesto de sellos cargado a mano en una cuenta bancaria sigue apareciendo.

Qué NO se hace: no se toca qué entra en la ventana de fechas, ni «Ampliar la búsqueda», ni cómo se
nombra cada fila.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`: el requirement «El usuario puede vincular un movimiento que ya cargó a un
  vencimiento» cambia el criterio de orden y suma los sellos de pagos anteriores al vínculo a lo que
  nunca es candidato.

## Impact

- Base de datos: migración `0077` que redefine `recurrence_movement_linkable` (sellos viejos) y
  `recurrence_link_candidates` (orden). Firmas sin cambios: ni `types.ts` ni las apps cambian.
- Tests: arnés PGlite (`transactions.card_period_id`, `period_payments.stamp_tax_link_known`) y los
  tests de candidatos.
