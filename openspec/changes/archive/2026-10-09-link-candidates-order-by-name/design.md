## Context

Ver `proposal.md`. `recurrence_movement_linkable` (0076) excluye el sello por
`period_payments.stamp_tax_transaction_id`. Los pagos anteriores a 0050 tienen ese vínculo en NULL y
`stamp_tax_link_known = false`: se sabe que el pago existió, no cuál fue su sello.

## Decisions

**1. El sello viejo se reconoce por tres condiciones juntas.** El movimiento está dentro de un
resumen (`card_period_id`), tiene la subcategoría del sistema `impuesto-de-sellos`, y ese resumen
tiene un pago con `stamp_tax_link_known = false`. Es la heurística que 0050 evitó para BORRAR, y acá
alcanza porque solo esconde un candidato. El único caso que se pierde es un sello cargado a mano
dentro de ese mismo resumen viejo, que no es el pago de una regla. Los sellos cargados a mano en una
cuenta bancaria no tienen `card_period_id`, así que siguen entrando.

**2. El orden se calcula en el RPC, como hoy.** Una expresión booleana «coincide por nombre», y
después `abs(importe)`, `abs(fecha)` e `id`. La comparación de descripciones normaliza con `lower`,
`btrim` y un `translate` de vocales acentuadas y ñ/ü. No usa `unaccent` porque no hay garantía de que
la extensión esté instalada en el proyecto. El orden tiene que vivir en el RPC: la lectura de nombres
del paquete conserva el orden que recibe.

**3. Migración `0077_link_candidates_order_by_name.sql`.** `create or replace` de las dos funciones
con las firmas de 0076. `recurrence_link_movement` no se redefine: ya llama a
`recurrence_movement_linkable`. Lleva un autochequeo al estilo de 0076.

## Risks / Trade-offs

- [La normalización de acentos con `translate` cubre solo las vocales con tilde, la ü y la ñ] →
  alcanza para el español, que es lo que el usuario escribe. Que no coincida por nombre solo cambia
  el orden, nunca esconde un movimiento.
