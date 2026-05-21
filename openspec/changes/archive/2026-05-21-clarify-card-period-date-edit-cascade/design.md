## Context

El módulo `cards` ya está en producción local con la UI de "Editar fechas" implementada (sheet en `apps/web/app/(app)/cards/[id]/periods/[periodId]/_components/edit-dates-sheet.tsx`). El requirement original sobre edición de fechas describía qué fechas son editables y qué pasa con transacciones huérfanas, pero no formalizó la cascada del borde entre el período editado y el siguiente.

Durante testing manual surgieron dos casos:
- Extender `end_date` más allá del `start_date` del próximo período dejaba ambos solapados en el día de overlap, generando un caso anómalo (la asignación de transacciones a período ya tiene un requirement que rechaza el INSERT si una fecha cae en dos períodos).
- Achicar `end_date` dejaba un hueco de días entre el período editado y el próximo, dejando potencialmente transacciones huérfanas (con `card_period_id` apuntando al período editado pero `date` fuera de su rango).

Este change documenta y especifica el comportamiento correcto, que ya está implementado en la branch `bugfix/cards-installments-and-institution-selector` (commits `6cfb88d` y `cf25174`).

## Goals / Non-Goals

**Goals:**
- Dejar explícito en el spec que el borde P1/P2 se mantiene contiguo via cascada.
- Especificar el comportamiento de reasignación de transacciones en ambas direcciones.
- Especificar los bloqueos (próximo pagado, próximo colapsaría).
- Especificar el preview de UI antes de guardar.

**Non-Goals:**
- Cambiar la API ni los nombres de columnas.
- Resolver el caso del período **previo** (cuando editar `start_date` del actual chocaría con el `end_date` del anterior) — `start_date` no es editable hoy.
- Manejar gaps preexistentes en datos legacy (la cascada los normaliza al primer save siguiente, pero no se hace un fix retroactivo automático).

## Decisions

**Decisión 1: Cascada automática del borde en ambas direcciones, sin confirmar.**
Cuando el usuario edita `P1.end_date`, el sistema mueve `P2.start_date` a `P1.new_end + 1` sin pedir confirmación intermedia. El preview ámbar en el sheet ya cumple la función de "avisar antes". Alternativas consideradas:
- *Modal de confirmación de dos pasos*: descartado por agregar fricción a un caso común (corrección de fecha por un día).
- *Rechazar y obligar a editar el próximo primero*: descartado porque obliga al usuario a hacer 2 ediciones para algo que conceptualmente es un solo cambio (el banco corrió el cierre).

**Decisión 2: Reasignación automática de transacciones afectadas.**
Al cascadear el borde, las transacciones cuyo `date` queda en el rango cambiado se reasignan al período al que ahora pertenecen (extender: del próximo al actual; achicar: del actual al próximo). Sin esto, la cascada de fechas solo dejaría transacciones huérfanas. Alternativa: mostrar lista de tx a reasignar en el preview y pedir confirmación explícita. Descartado por la misma razón que arriba (fricción) y porque las tx se mueven a un período que las cubre por fecha, no es ambiguo a dónde van.

**Decisión 3: Bloquear cuando el próximo está pagado.**
Un período pagado tiene un `period_payment` asociado (que a su vez referencia un expense en una cuenta cash/debit). Mover `P2.start_date` no rompería el pago directamente, pero sí sería confuso semánticamente: cambiarías el rango de un período cuyo monto ya está fijado. El bloqueo se aplica al borde, no a `end_date` o `due_date` del próximo. Alternativa: permitir la cascada igual y advertir. Descartado por seguridad accounting-first (el principio de Grana es "los números son correctos, nada oculto").

**Decisión 4: Bloquear cuando new_end_date >= next.end_date.**
Si el período editado tragaría todo el próximo, lo correcto no es borrar el próximo silenciosamente — es pedir al usuario que primero edite (o elimine) el próximo. El mensaje del error reusa el wording del scenario original "Edición que reubica a un período inexistente es rechazada".

## Risks / Trade-offs

- **Risk**: Una edición que cascadea puede mover transacciones que el usuario no recordaba que existían en el otro período → **Mitigation**: el preview ámbar en el sheet describe explícitamente "consumos con fecha hasta X se van a mover". El usuario que no quiere ese efecto, cancela.
- **Risk**: Si el usuario tiene datos legacy con gaps u overlaps preexistentes, la primera cascada los normaliza pero también puede mover transacciones que originalmente estaban "donde estaban" por accidente histórico → **Mitigation**: aceptable, normalizar el estado es lo correcto. No hay rollback automático.
- **Trade-off**: No se hace migration retroactiva para arreglar overlaps existentes (los hubo en testing manual antes de tener la cascada implementada). El usuario los corrige con una re-edición del período. La alternativa (script de fix) se descartó por scope.
