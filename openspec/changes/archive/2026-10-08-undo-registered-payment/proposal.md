## Why

Hoy un pago registrado desde una recurrencia («Ya lo pagué», o Confirmar en «Vencimientos por revisar») no se puede deshacer de ninguna forma: borrar ese movimiento desde su detalle falla siempre con «Algo salió mal» (#104), y la ficha de la regla no ofrece ninguna salida. Lo mismo pasa al borrar un movimiento que el usuario vinculó con «Ya lo tengo cargado». Además, cuando un vencimiento vuelve a «por revisar» al desvincularlo, se queda con el nombre, la cuenta y el importe del movimiento que tenía, no con los de la regla (#186): el usuario no reconoce la fila, y si la confirma crea algo que la regla no dice.

Los dos problemas devuelven un vencimiento a «por revisar», así que se resuelven juntos y con una sola regla.

## What Changes

- **Deshacer un pago registrado.** Borra el movimiento que creó la recurrencia, y el vencimiento vuelve a «por revisar». Nunca queda «omitido»: omitir afirma que ese período no correspondía, y deshacer dice que el usuario se equivocó. Esto reemplaza la decisión del comentario del 06-10 en el #104, que lo pasaba a omitido.
- **Dos puertas, una sola operación.** Se puede deshacer desde dos lugares, y los dos hacen exactamente lo mismo:
  - eliminando el movimiento desde su detalle, que hoy falla;
  - con un botón «Deshacer» en la fila del historial de la ficha de la regla, en el mismo lugar donde está «Desvincular» para los vinculados.

  Las dos piden confirmación, avisan que el saldo cambia y nombran el vencimiento que vuelve a quedar por revisar.
- **Borrar un movimiento vinculado** desde su detalle también deja de fallar. El movimiento se borra y el vencimiento vuelve a «por revisar», igual que al desvincular.
- **Al volver a «por revisar» el vencimiento recupera los datos de la regla**: nombre, cuenta, categoría, subcategoría e importe. Vale para deshacer, para desvincular y para borrar un movimiento vinculado. Cierra el #186. La fecha del vencimiento no cambia nunca.
  - Consecuencia aceptada: una corrección hecha a mano solo sobre ese vencimiento (importe, cuenta, descripción o categoría) se pierde.
  - Vincular sigue copiando los datos del movimiento: el historial muestra lo que pasó de verdad. Lo que cambia es la vuelta.
- **El límite de vencimientos** se comporta como ya se comporta al desvincular. Si la fecha todavía no llegó (un pago anticipado), la posición vuelve a estar disponible. Si ya llegó, sigue gastada.
- **Pagos registrados antes de septiembre de 2026.** Son de antes de que se guardara la fecha de cada vencimiento, así que no se sabe cuál cubrían. Deshacer uno borra el movimiento y saca esa fila del historial: no vuelve a «por revisar» ni queda omitida. La confirmación lo avisa.
- **Lo que sigue bloqueado, y dice qué resolver primero:**
  - un gasto compartido con una liquidación vigente posterior: revertirla si está completada, cancelarla si está pendiente (mismo criterio que desvincular);
  - un consumo de tarjeta en un resumen ya pagado: primero hay que deshacer el pago del resumen desde la tarjeta.

  El botón «Deshacer» aparece igual en esas filas, y al tocarlo explica el bloqueo.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `transactions`:
  - eliminar un movimiento que resuelve un vencimiento pasa a estar permitido y lo devuelve a revisión;
  - se agrega deshacer un pago registrado;
  - desvincular devuelve los datos de la regla;
  - el requirement de acciones por estado pasa a ofrecer «Deshacer» sobre lo resuelto registrando. Va como REMOVED + ADDED con nombre nuevo, porque su escenario «Lo resuelto registrando no ofrece deshacer» deja de valer.

## Impact

- **Base de datos:** migración `0075`. Hace que borrar un movimiento que resuelve un vencimiento, venga de donde venga, devuelva el vencimiento a revisión con los datos de la regla en la misma operación. Cualquier vuelta de un vencimiento a revisión, incluido desvincular, trae los datos de la regla.
- **`@grana/transactions-mutations`:** `deleteTransaction` deja de fallar en estos movimientos.
- **`@grana/recurrences`:** la lectura de la ficha dice qué filas ofrecen «Deshacer».
- **Web y nativo, en el mismo commit:**
  - el diálogo de eliminar en el detalle del movimiento;
  - el botón «Deshacer» con su confirmación en el historial de la ficha;
  - los mensajes de bloqueo;
  - la invalidación de lo que cambia: saldos, movimientos, por revisar y ficha.
- **Fuera de alcance:**
  - acciones sobre las filas pendientes del historial: entrega 1b del #162;
  - deshacer una omisión;
  - mapear el error genérico de restricciones de la base (`23514`) a un mensaje propio.
