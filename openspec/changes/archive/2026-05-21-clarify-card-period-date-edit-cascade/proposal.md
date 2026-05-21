## Why

El requirement existente sobre edición de fechas de un `card_periods` describe qué fechas son editables y qué pasa si una transacción cae fuera de período, pero no especifica qué pasa con el **borde entre el período editado y el siguiente**. La implementación inicial dejaba que el borde quedara solapado (si extendías) o con un hueco (si achicabas), y testing manual de un usuario funcional detectó ambos casos como bugs.

Necesitamos dejar explícito en el spec el comportamiento correcto: el borde se mantiene contiguo cascadeando `next.start_date = new_end_date + 1` y las transacciones afectadas se reasignan automáticamente entre los dos períodos.

## What Changes

- Aclaración del requirement `Las fechas de un período open se pueden editar; las de un período paid no` con escenarios nuevos:
  - Extender `end_date` cascadea el `start_date` del próximo período hacia adelante y mueve los consumos del próximo al actual.
  - Achicar `end_date` cascadea el `start_date` del próximo período hacia atrás y mueve los consumos del actual al próximo.
  - Si el próximo período ya está `paid`, se rechaza cualquier edición que mueva el borde.
  - Si el nuevo `end_date` colapsaría todo el próximo período (`>= next.end_date`), se rechaza con mensaje pidiendo editar primero el próximo.
- Aclaración del requirement existente sobre UI del detalle de período: el sheet "Editar fechas" SHALL mostrar preview ámbar de la cascada antes de guardar, y bloquear el botón guardar si el próximo está pagado.

No hay cambios de comportamiento que no estuvieran ya implementados en `bugfix/cards-installments-and-institution-selector` — esta propuesta documenta y formaliza esa decisión.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `cards`: el requirement de edición de fechas se amplía con la regla de cascada bidireccional del borde y los dos bloqueos (próximo pagado, próximo colapsaría); el requirement de UI del detalle de período se amplía con el preview ámbar y el bloqueo del botón.

## Impact

- Spec `openspec/specs/cards/spec.md`: dos requirements modificados con escenarios nuevos.
- Código ya implementado en `apps/web/app/_actions/credit-cards.ts` (`updatePeriodDates`) y `apps/web/app/(app)/cards/[id]/periods/[periodId]/_components/edit-dates-sheet.tsx`.
- Sin cambios de DB ni de tipos generados.
