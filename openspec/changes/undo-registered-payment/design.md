## Context

Ver proposal.md para el porqué. Esto es lo que hay hoy y condiciona el cómo:

- **Por qué falla el borrado (#104).** `recurrence_instances.confirmed_transaction_id` es `ON DELETE SET NULL` (0011). Al borrar el movimiento, la base intenta dejar la ocurrencia en `confirmed` con `confirmed_transaction_id NULL`, y `chk_recurrence_instances_pending_unresolved` lo rechaza. Le pasa a todo movimiento que resuelve una ocurrencia: tanto `resolution_kind = 'created'` como `'linked'`. `deleteTransaction` (`@grana/transactions-mutations`) ni siquiera mira `recurrence_instances`.
- **Por qué desvincular deja los datos del movimiento (#186).** Hay dos escrituras que copian la foto del movimiento sobre la ocurrencia:
  - al resolver registrando, `confirmRecurrenceInstance` copia importe, cuenta, categoría, subcategoría y descripción;
  - al vincular, `recurrence_link_movement` (0074) hace lo mismo.

  `recurrence_unlink_movement` (0072) solo pone `status = 'pending'` y limpia el vínculo, así que la foto queda.
- **Lo que la ocurrencia no guarda.** No guarda los datos que tenía antes de resolverse. La única fuente para restaurar es la regla (`recurrences`: `description`, `category_id`, `subcategory_id`, `account_id`, `amount`). Moneda, destino de transferencia, hogar y reparto nunca se sobrescriben: 0074 lo dice explícitamente.
- **Ocurrencias de antes de 0064.** Las confirmadas antes de 0064 tienen `due_date NULL` + `due_date_is_unknown`. `chk_recurrence_instances_unresolved_has_due_date` impide devolverlas a `pending`.
- **El límite ya se acomoda solo.** `recurrence_positions_spent` (0072) suma como gastadas las ocurrencias `confirmed`/`skipped` con `due_date > hoy`, y las que tienen fecha pasada las cuenta el calendario. Una ocurrencia que vuelve a `pending` deja de sumar si era futura y sigue contando si era pasada. No hay que tocar el conteo.
- **Las guardas de liquidación ya viven en la base.** `trg_fn_block_shared_delete_with_settlement` (0049 → 0072 → 0073) levanta `GRN01`. `describeBlockingSettlements` (`@grana/recurrences`) arma el mensaje correcto, «revertí» o «cancelá», y es el que usa desvincular.
- **El detalle del movimiento** ya pregunta por la ocurrencia: `getRecurrenceLinkForTransaction` alimenta el rótulo «Generado por…» / «Vinculado a…».
- **Dependencias entre paquetes.** `@grana/recurrences` depende de `@grana/transactions-mutations`, nunca al revés. `deleteTransaction` no puede llamar a `describeBlockingSettlements`.
- **Mobile hoy pierde los mensajes del borrado.** `deleteMovement` (`apps/mobile/lib/transactions/mutators.ts`) convierte todo error en `transactions.errors.generic`, incluidos `paid` y `GRN01`. En web, `GRN01` dice siempre «Revertí esa liquidación», aunque la liquidación esté pendiente.

## Goals / Non-Goals

**Goals:**

- Una sola definición en la base de «qué le pasa a la ocurrencia cuando se borra el movimiento que la resuelve», que valga para cualquier camino de borrado.
- Una sola definición de «volver a revisión con los datos de la regla», compartida por desvincular y por el borrado.
- Las dos puertas de deshacer (ficha y detalle) usan el mismo mutator, con las mismas guardas y los mismos mensajes, en web y en nativo.

**Non-Goals:**

- Acciones sobre las filas pendientes del historial (entrega 1b del #162).
- Deshacer una omisión.
- Mapear `23514` en `translate-error.ts`. El ticket lo proponía, pero con este arreglo ese error deja de ocurrir en el caso conocido.
- Agregar confirmación a «Desvincular»: hoy no la tiene, y no es parte de este change.

## Decisions

### 1. Un trigger `BEFORE DELETE` en `transactions` reabre la ocurrencia

La migración 0075 agrega `trg_reopen_occurrence_on_delete` sobre `public.transactions`. Antes de borrar la fila, si alguna ocurrencia tiene `confirmed_transaction_id = OLD.id`, la trata así:

- **Con `due_date` conocido y regla no eliminada:** la reabre con los datos de la regla (decisión 2).
- **Con `due_date` desconocido (anterior a 0064), o con la regla en `status = 'deleted'`:** borra la fila de la ocurrencia.

Para cuando el `SET NULL` de la FK se evalúa, la ocurrencia ya no apunta al movimiento, así que no hay nada que poner en NULL y el CHECK nunca se viola. La FK queda como está.

**Por qué un trigger y no una RPC que llame cada cliente:** la regla tiene que valer para cualquier borrado: el detalle web, el nativo, la puerta de la ficha y SQL manual. Es el mismo argumento que llevó a 0053 a poner la garantía de la semilla en la base: que no dependa de que cada frontend se acuerde. Con una RPC, un `DELETE` directo seguiría fallando con el CHECK.

**Por qué no `ON DELETE RESTRICT`:** volvería terminal el movimiento, y hay una decisión de producto en contra: deshacer existe y borra el movimiento.

**Por qué no una ocurrencia `skipped`:** el spec prohíbe que deshacer deje la ocurrencia omitida. El índice «una pendiente por regla» que motivaba esa idea se borró en 0066.

Sobre el trigger:

- Es `SECURITY INVOKER`: el usuario solo puede borrar sus propios movimientos, y RLS ya le deja escribir sus ocurrencias.
- No atrapa errores. Si la guarda de liquidaciones levanta `GRN01`, se cae todo el `DELETE` y la ocurrencia no cambia. Todo o nada, igual que desvincular.

### 2. `recurrence_reopen_occurrence(instance_id)`: una sola definición de «volver a revisión»

Es una función interna de 0075, sin `EXECUTE` para `authenticated`. Pone `status = 'pending'`, limpia `confirmed_transaction_id`, `resolution_kind`, `linked_conversion` y `resolved_at`, y copia de la regla `description`, `category_id`, `subcategory_id`, `account_id` y `amount`.

La usan:

- el trigger de la decisión 1;
- `recurrence_unlink_movement`, que 0075 reemplaza entero, igual que hizo 0074 con vincular. Lo único que cambia en desvincular es el `update` final, que pasa a llamar a esta función. Lo demás queda idéntico a 0072: el chequeo `not_linked`, revertir la conversión y no atrapar `GRN01`.

**Alternativa descartada:** copiar el `update` en los dos lugares. Es exactamente cómo divergieron vincular y crear en 0072 → 0074.

La migración termina con un self-check, en el estilo de 0071/0072:

- el trigger existe;
- desvincular llama a la función;
- `recurrence_positions_spent` no se tocó.

### 3. Las dos puertas pasan por `deleteTransaction`

- **«Eliminar» en el detalle** llama a `deleteTransaction(txId)`, como hoy. Las guardas existentes (cuota hija, `paid`, liquidación, pago de resumen, semilla) ya cubren lo que bloquea deshacer. El trigger hace el resto.
- **«Deshacer» en la ficha** llama a la misma acción o el mismo mutator de borrado con el `confirmed_transaction_id` de la fila. No se crea una RPC aparte: así las dos puertas no pueden dar resultados distintos.

`deleteTransaction` no necesita lógica nueva para la ocurrencia. Sí cambia el **mensaje**, en el shell de cada app, que es donde se pueden componer los dos paquetes:

- **`GRN01`:** se describe con `describeBlockingSettlements`, el mismo texto de desvincular. Vale para todo borrado, no solo el de recurrencias, porque es el mismo error con el mismo arreglo, y el mensaje de web hoy es falso sobre una liquidación pendiente.
- **`paid`:** el texto pasa a decir dónde se resuelve: «primero deshacé el pago del resumen desde Tarjetas». Lo exige el spec de eliminar.
- **Mobile** pasa a localizar cada `DELETE_GUARD_CODES` y `GRN01` en lugar de caer siempre en `generic`. Si no, la puerta nativa no podría «decir qué resolver primero».

### 4. Qué sabe la UI antes de confirmar

`getRecurrenceLinkForTransaction` (detalle) suma a lo que devuelve:

- `due_date`, que puede ser `null` en un pago viejo;
- el nombre de la regla, resuelto con `recurrenceTitle`;
- el estado de la regla.

Con eso el diálogo de eliminar agrega una línea: «El vencimiento del 10 sep de *Celular* vuelve a quedar por revisar». En un pago viejo o de regla eliminada, la línea dice que esa fila sale del historial.

En la ficha, `canUndo(instance)` vive en `packages/recurrences/src/review-surface.ts` junto a `canUnlink`, y devuelve `status === 'confirmed' && resolution_kind === 'created'`. La confirmación se arma con la fila misma: fecha, importe y cuenta.

- **Web:** `AlertDialog`, igual que el detalle.
- **Nativo:** `Alert.alert` con botón destructivo, el patrón que ya usa el detalle nativo.
- **El botón:** en web usa el primitivo `Button` y en nativo el `Button` de la app. Va en el mismo lugar que «Desvincular».

### 5. Invalidación

Después de deshacer o de eliminar un movimiento que resolvía una ocurrencia, cambian saldos, movimientos, «por revisar», la ficha, el dashboard y Compartido.

- **Web:** la acción corre `revalidateAfterMovementMutation()` y `revalidateAfterRecurrenceMutation()`. En el cliente, `invalidateAfterMovementMutation`.
- **Nativo:** las dos puertas usan `invalidateAfterRecurrenceResolution`, que es la que refresca todo, Compartido incluido. El test de cableado (`invalidation-wiring.test.ts`) suma a sus llamadores el mutator de borrado, para fijar que no se use la invalidación angosta.

## Risks / Trade-offs

- **[Un borrado masivo futuro reabre ocurrencias sin que nadie lo pida]** → Es lo correcto: si el movimiento ya no existe, la ocurrencia no puede seguir «pagada». Ningún camino actual borra movimientos en masa salvo el `CASCADE` de la cuenta del usuario, donde la ocurrencia también se borra.
- **[El orden de los triggers `BEFORE DELETE`]** → La guarda de liquidaciones y el reabridor son triggers `BEFORE DELETE` sobre la misma tabla. Si la guarda falla, la transacción entera se revierte, así que el orden no cambia el resultado. Un test lo fija con el caso compartido bloqueado.
- **[Se pierde una corrección manual del vencimiento]** → Aceptado por el usuario y escrito en el spec.
- **[La fila de un pago viejo desaparece del historial]** → Aceptado por el usuario. La confirmación lo avisa antes.
- **[El harness PGlite no modela el schema entero]** → Antes de arreglar se reproduce #104 en el harness: un `DELETE` de un movimiento confirmado falla con el CHECK sin 0075 y pasa con ella.

## Migration Plan

1. Pegar `0075_undo_reopens_occurrence.sql` en el SQL Editor del proyecto online, después de 0074. El self-check aborta si algo no quedó.
2. `packages/supabase/src/types.ts`: 0075 no cambia el contrato público (no hay RPC nueva expuesta ni columnas), así que no se espera cambio. Se verifica contra el SQL.
3. **Rollback:** recrear `recurrence_unlink_movement` desde 0072 y hacer `DROP TRIGGER` + `DROP FUNCTION`. Los datos que el trigger ya reabrió quedan correctos igual.
