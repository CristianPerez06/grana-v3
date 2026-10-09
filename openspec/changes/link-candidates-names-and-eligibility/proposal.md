## Why

La lista «¿Cuál de estos es?», que abre «Ya lo tengo cargado», no deja reconocer qué es cada
movimiento: casi todas las filas dicen «Movimiento sin descripción» y solo muestran fecha e
importe. Además ofrece movimientos que no deberían resolver un vencimiento, como las cuotas de una
compra en cuotas o el débito con que se pagó un resumen de tarjeta. Vincular el equivocado deja un
vencimiento «pagado» con datos de otra cosa, sin que el usuario pueda notarlo. Desde #185 ese botón
está en cada fila de «Vencimientos por revisar», en Inicio y en Movimientos, así que la lista ya
forma parte del uso diario (#190).

## What Changes

- Cada fila de la lista se nombra igual que el resto de las pantallas de recurrencias: descripción,
  y si no tiene, subcategoría, categoría o tipo de movimiento. Debajo muestra la cuenta y la fecha,
  por ejemplo «Comida · Visa Galicia · 18 sept».
- La lista deja de ofrecer:
  - compras en cuotas, ni la compra ni sus cuotas;
  - los débitos con que se pagó un resumen de tarjeta y su impuesto de sellos;
  - reintegros y liquidaciones de Compartido (ya excluidos de la lista, ahora también al vincular).

  Una compra con tarjeta en un solo pago sigue apareciendo.
- Vincular aplica la misma regla que la lista. Si un movimiento no elegible llega por otro camino, se
  rechaza con un mensaje propio: «Ese movimiento no puede resolver un vencimiento».
- La diferencia de importe («La regla venía de…») se calcula con el tipo de plata de la app.
- Web y app nativa cambian juntas.

Qué NO se hace:
- Los vencimientos que ya quedaron vinculados a una cuota no se tocan. Se pueden desvincular desde
  la ficha de la regla como cualquier otro.
- No se agrega búsqueda por texto ni se cambia el orden de la lista ni su ventana de fechas.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`: el requirement «El usuario puede vincular un movimiento que ya cargó a un
  vencimiento» suma qué movimientos nunca son candidatos (y que vincular los rechaza) y cómo se
  nombra cada candidato.

## Impact

- Base de datos: migración `0076` que redefine `recurrence_link_candidates` y
  `recurrence_link_movement` sobre una única definición de «movimiento vinculable», con un código
  de error nuevo (`GRN19`).
- `@grana/recurrences` (`link.ts`): los candidatos llegan con categoría, subcategoría y cuenta; nuevo
  código de rechazo `movement_not_linkable`.
- `@grana/supabase` (`types.ts`): sin cambios de firma (los RPC devuelven lo mismo).
- Web: `apps/web/lib/recurrences/components/link-candidates-drawer.tsx`.
- Nativo: `apps/mobile/components/recurrences/LinkCandidatesSheet.tsx`.
- Copy: `recurrences.link.errors.movement_not_linkable` en `es.json` y `en.json`.
