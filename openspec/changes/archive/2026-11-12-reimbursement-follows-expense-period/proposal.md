## Why

En producción, un consumo de PedidosYa con la Mastercard BBVA se cargó con fecha de hoy (12/11) por error, con un reintegro "en resumen" ya recibido. Al editar la fecha al 30/09, el gasto pasó al resumen que cerró el 22/10, pero el reintegro se quedó en el resumen en curso. Su fecha sí se corrió al 30/09, pero el resumen no. Resultado: el resumen a pagar mostraba $81.851,24 en vez de $72.033,55, y el resumen en curso arrancaba en −$9.817,69, con un crédito solo y sin consumos.

La regla existente ya arrastraba la **fecha** del reintegro cuando cambiaba la del gasto, pero nunca decía nada del **resumen**, que para un reintegro "en resumen" es lo que define dónde descuenta.

## What Changes

- Al editar la fecha de un consumo de tarjeta y moverlo a otro resumen, los reintegros "en resumen" que lo venían siguiendo (mismo resumen y misma fecha que el gasto antes del cambio) se mueven al resumen nuevo.
- Los que el usuario imputó a mano a otro resumen, o con otra fecha, no se tocan, con la misma lógica que ya tenía la fecha.
- **Qué ve el usuario:** el reintegro aparece en el mismo resumen que su gasto y el total a pagar ya viene neto.
- Los datos ya afectados en producción no se corrigen con una migración: el período al que el usuario confirmó un reintegro puede ser deliberado, así que no hay una regla segura para todos. Se corrigen caso por caso con una consulta en el SQL Editor.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `transactions`: la "Fecha contable del reintegro" también arrastra el resumen de los reintegros "en resumen".

## Impact

- `packages/transactions-mutations/src/thin-mutations.ts` — `updateTransaction`, que usan web y nativo para editar un movimiento.
- Las compras en cuotas no se ven afectadas: su fecha no se edita (`updateInstallmentParent` no la toca).
- Sin migraciones ni cambios en el contrato público.
