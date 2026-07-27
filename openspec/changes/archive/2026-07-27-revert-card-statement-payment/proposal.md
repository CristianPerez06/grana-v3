# Deshacer el pago de un resumen de tarjeta

## Why

Hoy un pago de resumen mal cargado es **irreversible**, y la app promete lo contrario.

En el detalle del movimiento, "Eliminar" sobre un pago de resumen falla con "Algo salió mal": `deleteTransaction` (`apps/web/app/_actions/transactions.ts:131`) hace un `delete` plano, pero `period_payments.transaction_id` referencia esa transacción con **FK `RESTRICT`** (`0010_credit_cards.sql:214`), así que la base rechaza el borrado. El diálogo de confirmación, en cambio, afirma textualmente (`es.json:966`):

> *"Al eliminar este pago, las cuotas del período volverán a pendientes. ¿Continuar?"*

La UI promete una reversión que el backend nunca implementó. Y aunque el `delete` pasara, sería peor: los consumos y cuotas del período quedarían en `paid` para siempre (nada los revierte), el impuesto de sellos quedaría huérfano dentro de un resumen impago, y el resumen volvería a figurar como pagado sin pago.

El usuario que cargó un pago con el monto o la fecha equivocados queda hoy en un callejón sin salida. (La **cuenta** de débito ya se puede corregir sin borrar, desde el change `card-payment-debit-account`; el resto no.)

## What Changes

- **Nueva operación de dominio: deshacer un pago de resumen.** Revierte de forma atómica todo lo que `payCardPeriod` escribió del lado de la **plata**: borra la fila de `period_payments`, borra el gasto-débito de la cuenta de pago, borra el movimiento de impuesto de sellos, y devuelve los movimientos del período de `paid` a `pending`. El resumen vuelve a estar impago (cerrado o vencido, según la fecha) y la deuda reaparece donde corresponde.
- **La reversión NO toca el calendario.** El pago también confirma las fechas del ciclo en curso, puede crear el período estimado siguiente y puede reasignar consumos entre períodos. Nada de eso se deshace: son hechos del mundo real leídos del resumen en papel, y desandarlos rompería períodos ya materializados. Ver `design.md`, Decisión 1.
- **La reversión NO borra la alícuota aprendida** (`accounts.stamp_tax_rate`). Ver Decisión 2.
- **Vínculo explícito del sello.** Hoy el movimiento de impuesto de sellos no tiene ninguna referencia al pago que lo creó: solo se lo puede identificar por heurística (período + subcategoría `impuesto-de-sellos`), que borraría el movimiento equivocado si el usuario cargó un sello a mano. Se agrega `period_payments.stamp_tax_transaction_id` (nullable, `ON DELETE SET NULL`), que `payCardPeriod` completa. Para pagos anteriores a la migración la heurística queda como **fallback**.
- **El punto de entrada se mueve a la tarjeta.** Deshacer un pago se hace desde el detalle del período (`/cards/[id]/periods/[periodId]`), donde el usuario ve la magnitud de lo que revierte. "Eliminar" en el detalle del movimiento pasa a **bloquear con un mensaje que redirige** al período, igual que ya hace con las cuotas hijas y con las liquidaciones del hogar. Se corrige el copy que hoy miente.
- **Orden cronológico.** No se puede deshacer el pago de un resumen si un resumen **posterior** de la misma tarjeta ya está pagado: hay que deshacer del más nuevo al más viejo.

## Capabilities

### Modified Capabilities

- `cards`: nueva operación "deshacer pago de resumen" (contrato neutral en `@grana/cards`, atómica en base), su punto de entrada en el detalle de período, la guarda de orden cronológico, y el vínculo persistido entre el pago y su movimiento de impuesto de sellos.
- `transactions`: eliminar un movimiento que es un **pago de resumen** queda bloqueado con un mensaje que redirige al período, en línea con las guardas ya existentes (cuota hija, consumo pagado, liquidación).

## Impact

- **Base de datos**: migración `0050` — columna `period_payments.stamp_tax_transaction_id` + RPC `revert_card_period_payment(p_period_id UUID)` `SECURITY INVOKER` (gemela de `unshare_movement`, mig 0048), con guarda de orden cronológico que lanza `SQLSTATE GRN02`.
- **Código**: `packages/cards/src/pay-card-period.ts` (persistir el vínculo del sello), nueva mutación en `packages/cards/src/` + export en `mutations.ts`, acción web en `apps/web/app/(app)/cards/_actions/`, UI en el detalle de período, guarda + copy en `apps/web/app/_actions/transactions.ts`, mensajes en `packages/i18n-messages`.
- **Riesgo**: medio. Es una operación destructiva sobre plata. Se mitiga con atomicidad en base (RPC, no orquestación en el cliente), guarda de orden cronológico, y confirmación explícita que enumera qué se va a revertir.
- **Fuera de alcance**: `apps/mobile` (lo lleva el tech lead; el contrato neutral queda listo para que lo consuma). Revertir la confirmación de fechas del ciclo. Editar un pago "en el lugar" (el camino es deshacer y volver a pagar).
