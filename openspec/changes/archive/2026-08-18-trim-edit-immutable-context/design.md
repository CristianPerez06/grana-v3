# Design: trim-edit-immutable-context

## Decisión 1 — Sacar contenido, no comprimir el contenedor

Ante "seis filas de datos inertes antes del primer campo editable", el reflejo es comprimir: una línea en vez de una card, chips en vez de filas, un acordeón. Se probaron las dos primeras y las dos fallaron (ver "Intentos descartados" en el proposal), por la misma razón: **el problema no era cuánto espacio ocupaba cada dato, sino que la mitad de los datos no hacía falta**.

El criterio que quedó es "¿está esto a la vista en otro lado de la misma pantalla?":

| Dato | ¿Ya visible? | Queda |
|---|---|---|
| Monto | Es el héroe | como héroe (read-only si está bloqueado) |
| Tipo | El signo y el color del monto lo dicen (`−$58.000` terracota = gasto) | no |
| Moneda | Es el chip del bloque del monto | no |
| Cuenta / las dos puntas de una transferencia | En ningún lado | **sí** |
| Cantidad de cuotas | En ningún lado | **sí** |
| Fecha bloqueada | En ningún lado | **sí** |

De seis filas se pasa a una en el caso común (la cuenta) y a tres en el peor (madre de cuotas con una cuota paga). Y como el formato vuelve a ser filas etiquetadas, se conserva lo que la línea había perdido: cada valor con su etiqueta, en una card como el resto del panel, sin texto huérfano flotando.

## Decisión 2 — El monto nunca deja de ser el héroe

`show-locked-fields-as-context` había descartado el héroe read-only por costo ("obliga a construir una variante de un bloque complejo por duplicado") y mandó el monto bloqueado a una fila. El costo real resultó menor de lo estimado: la variante no necesita input, calculadora ni chip operable, así que es una card corta por plataforma. Y el ahorro no compensaba: un monto bloqueado no dibujaba héroe, así que la pantalla abría con metadata en vez de con el número del movimiento.

La regla final no tiene excepciones, que es lo que la hace fácil de sostener: **el monto siempre está en el héroe**. Bloqueado, el héroe es read-only y lo dice con su propio caption.

## Decisión 3 — El escritorio entra

El resto de la serie de simplificación se gateó en `isMobile` para no tocar el escritorio. Acá no: la card de contexto era idéntica en los dos viewports, así que un gate significaría **dos** presentaciones de los mismos datos, mantenidas a mano. El argumento que motiva el cambio (alto muerto antes del primer campo editable) vale igual en una ventana ancha. Es una excepción deliberada al gate, no un descuido.

## Nota de proceso

Este bloque se rediseñó tres veces sobre la misma branch, y las dos primeras se descubrieron mirando la app, no el diff. `apps/web` no tiene tests de componente ni Storybook para este formulario: la única red de seguridad de una decisión visual es abrirla. Vale tenerlo presente antes de estimar una pasada de superficie como "un rato".
