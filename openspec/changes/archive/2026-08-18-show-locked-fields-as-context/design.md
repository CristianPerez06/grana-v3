# Design: show-locked-fields-as-context

## Decisión — fila de contexto, no héroe deshabilitado

Para mostrar un monto que no se puede editar había dos caminos:

1. **Fila de contexto read-only**, junto al tipo / moneda / cuenta.
2. **Héroe deshabilitado**: el número grande de siempre, sin input, sin calculadora y sin chip de moneda operable.

(2) preserva mejor la jerarquía —el monto es la identidad del movimiento y merece el tamaño— pero obliga a construir una variante read-only de un bloque complejo (layout mobile y escritorio, signo, color por tipo, chip de moneda, disparador de calculadora) **por duplicado**, una en cada plataforma. Mucha superficie nueva para un caso de borde.

Se eligió (1): usa el renderer de filas que ya existe en las dos plataformas, es literalmente lo que pide el spec ("como contexto read-only") y agrupa los cinco hechos inmutables —monto, tipo, moneda, cuenta, fecha— con un tratamiento único en vez de dos. Se compensa la pérdida de jerarquía formateando el valor con signo y símbolo (`−$200.000`), que es como el monto se lee en el detalle: reconocible aun a tamaño de fila.

Si más adelante el bloque inmutable se colapsa en una sola línea bajo el héroe (idea anotada como posible siguiente pasada de simplificación), esta decisión no estorba: las cinco filas ya son un conjunto homogéneo, fácil de colapsar de una.

## Por qué el monto arriba y la fecha abajo

El bloque inmutable se lee como una ficha. El monto va primero porque ocupa el lugar donde habría estado el héroe si fuera editable — la pantalla no pierde su cabeza. La fecha va última porque es el más accesorio de los cinco y porque, cuando **sí** es editable, su fila vive al final del grupo: mantener la posición evita que el campo salte de lugar según el estado del movimiento.

## Sobre el signo

`MovementEditContext.amount` es el valor **sin signo** (`signedAmount` va aparte). El signo se deriva del tipo, igual que lo hace el héroe: `+` para ingreso, `−` para gasto y, en un ajuste, según `adjustmentDirection`. Transferencia y cambio de moneda no llevan signo — el movimiento no es ni suma ni resta por sí mismo.

## Fuera de alcance

- `getEditableFields` y las reglas de editabilidad. No se tocan.
- El resto del bloque inmutable (colapsarlo a una línea) y el estado *dirty* del formulario, ambos identificados en la misma revisión pero independientes de este arreglo.
