# Proposal: fix-card-consumo-period-assignment

## Why

Un consumo cuya fecha cae en un resumen **ya pagado** no se rechaza: se le fabrica en silencio un resumen estimado en la frontera (meses en el futuro) y el consumo queda imputado al resumen equivocado.

Caso real (Visa ICBC, ago-2026): un gasto recurrente "Finquality" con fecha `2026-06-25` quedó imputado al resumen `2026-10-24 → 2026-11-23`, cuatro meses adelante. El `2026-06-25` es el día de cierre del resumen `2026-05-26 → 2026-06-25`, que ya estaba **pagado**. El resumen del banco confirma que ese consumo pertenece al que vence el `2026-08-04` (`2026-06-26 → 2026-07-23`), el siguiente abierto.

El defecto es que la implementación **contradice un requirement que ya está en el spec**: "El sistema rechaza registrar un consumo con fecha dentro de un período pagado" (`period_already_paid`). La asignación de período (`getOrCreatePeriodForDate`) usa `assignTransactionToPeriod`, que filtra los períodos pagados (`!has_payment`); cuando el único período que cubre la fecha está pagado, la función no lo "ve", cae a la rama de rolling y **crea un período nuevo en la frontera**, asignándole el consumo. El guard que debería rechazar (`register-card-purchase.ts`, "No podés registrar consumos en un período ya pagado") es **código muerto**: nunca se alcanza, porque la función ya devolvió un período recién creado (sin pagar) antes de llegar ahí.

La misma laxitud afecta la rama de rolling en general: hoy se crea un período nuevo **cada vez que ningún período _sin pagar_ cubre la fecha**, en lugar de solo cuando la fecha es **genuinamente posterior al último resumen conocido**. Cualquier fecha no cubierta que no sea estrictamente futura (un período pagado, un hueco) termina en un resumen fabricado que no la contiene.

Entra por tres caminos que comparten `getOrCreatePeriodForDate`: consumo simple, consumo en cuotas y **confirmación de una instancia recurrente** (el caso real: la instancia mensual se confirmó cuando su resumen ya estaba pagado).

## What Changes

- **`getOrCreatePeriodForDate` honra el requirement de período pagado.** Antes de hacer rolling, distingue los casos que hoy están mezclados:
  - período **sin pagar** que cubre la fecha (cierre incluido) → usarlo (sin cambios);
  - período **pagado** que cubre la fecha → **rechazar** con error tipado `period_already_paid` (el cartel que el usuario ve);
  - fecha **anterior** al primer resumen → error `predates history` (sin cambios);
  - fecha **estrictamente posterior** al último resumen conocido → crear período por rolling (roll-forward legítimo, sin cambios);
  - cualquier otra fecha no cubierta (hueco entre resúmenes) → rechazar, **nunca** fabricar un período en la frontera.
- **El rechazo llega a los tres entry points.** Consumo simple y cuotas devuelven el `formError` explicativo; la confirmación de una instancia recurrente falla con el mismo mensaje, y el usuario puede editar la fecha de la instancia antes de confirmar (flujo ya existente). El guard muerto de `register-card-purchase` se consolida en `getOrCreatePeriodForDate`.
- **El día de cierre sigue siendo inclusive.** Un consumo con `date = end_date` de un resumen **abierto** entra en ese resumen. No cambia; se preserva y se cubre con un escenario explícito para que no se rompa.
- **Sin migración de esquema.** Es una corrección de código. La data pre-existente mal asignada (consumos imputados a un resumen que no contiene su fecha, con un resumen pagado cubriéndola) se detecta con una query de diagnóstico y se revisa a mano — no se auto-mueve (mismo criterio que `fix-recurrence-projection-and-orphans`: hacer visible, no decidir por el usuario). Los resúmenes futuros vacíos que el bug fabricó son inofensivos (estimados) y se dejan.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`:
  1. "El sistema rechaza registrar un consumo con fecha dentro de un período pagado" — pasa a ser el enunciado normativo de la disciplina de asignación de período: el rechazo se aplica en el punto de asignación (no se fabrica un resumen para una fecha cubierta por un período pagado), el roll-forward ocurre **solo** cuando la fecha supera el último resumen conocido, y el rechazo cubre consumo simple, cuotas y confirmación de recurrencia. Suma escenarios para el día de cierre pagado, el roll-forward legítimo y la confirmación de recurrencia backdated.
  2. "El usuario puede registrar un consumo en cuotas en una tarjeta de crédito" — acota la cláusula de rolling: el período se auto-genera **solo** cuando la fecha supera el último resumen; una cuota que cae en un resumen pagado se rechaza en vez de fabricar un resumen.

## Impact

- `packages/transactions-mutations/src/internal/card-periods.ts` (`getOrCreatePeriodForDate`): nueva ramificación pagado / frontera / hueco; nuevo error tipado `CardConsumoInPaidPeriodError`.
- `packages/transactions-mutations/src/register-card-purchase.ts`: capturar el nuevo error → `formError`; eliminar el guard muerto `has_payment` posterior a la asignación.
- `packages/transactions-mutations/src/register-installments.ts`: capturar el nuevo error para el mismo mensaje en la ruta de cuotas.
- `packages/recurrences/src/mutations.ts` (`confirmRecurrenceInstance`): el `formError` del delegado ya se propaga; verificar que el mensaje de período pagado llega a la UI de confirmación.
- `apps/web` / `apps/mobile`: sin lógica nueva — el `formError` se muestra como cartel en el formulario de consumo y en la confirmación de recurrencia. Copy en `packages/i18n-messages` si el mensaje se estandariza.
- **Datos existentes**: consumos ya mal asignados por el bug (incl. el "Finquality" del `2026-06-25`, ya corregido a mano por el usuario). Query de detección incluida; revisión manual, sin auto-reasignación. Resúmenes estimados vacíos fabricados por el bug se dejan.
- **UX**: un consumo con fecha en un resumen pagado deja de guardarse en silencio en un resumen equivocado; ahora muestra un cartel y el usuario elige otra fecha. Una confirmación de recurrencia backdated a un resumen pagado falla de forma visible en vez de imputar mal.
