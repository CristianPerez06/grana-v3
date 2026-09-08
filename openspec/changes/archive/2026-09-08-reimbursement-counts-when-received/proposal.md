## Why

La spec dice de qué cajón resta un reintegro, pero nunca dijo **en qué mes**. La app cuenta lo percibido —el reintegro baja el mes en que entró la plata— y eso es una decisión tomada, no un descuido; pero al no estar escrita, cada vez que alguien mira los números vuelve a preguntarse si está bien. Pasó en la auditoría del 5/9 y volvió a pasar hoy.

La pregunta es real: en julio hubo un gasto de Salud y la prepaga devolvió en agosto. Julio muestra el gasto entero, como si no hubieran devuelto nada, y agosto absorbe una devolución que no le corresponde — al punto de dejar esa categoría en crédito.

## What Changes

Solo documentación. Ningún cambio de comportamiento ni de código.

- El requirement de "Cuánto gastaste" pasa a decir que el reintegro cuenta en el mes en que se percibió, con el porqué y la alternativa descartada.
- Queda escrito que la consecuencia —una categoría en crédito— es asumida y se explica donde aparece, en vez de corregirse moviendo el reintegro de mes.

### Alternativa descartada

**Que el reintegro siga a su gasto vinculado** (base devengado): bajaría el mes del gasto y el cajón donde ese gasto se pagó. Es más contable y haría que el caso de "categoría en crédito" casi desaparezca, pero vuelve mutable un mes ya cerrado y separa más la lente de gasto de la de caja, que conviven en la misma pantalla. Decisión del dueño del producto, 8/9.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `dashboard`: el requirement de "Cuánto gastaste" nombra la base temporal de los reintegros y la alternativa que se descartó.

## Impact

- Ninguno en código. `aggregateMonthSpending` ya se comporta así.
