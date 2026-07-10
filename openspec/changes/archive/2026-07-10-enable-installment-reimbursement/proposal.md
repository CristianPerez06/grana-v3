## Why

Hoy el bloque "Tiene reintegro" del alta de gasto está deshabilitado cuando la compra es **en cuotas**, por un gateo de UI/wiring (`!isInstallments`), no por una limitación del dominio. La base ya soporta un reintegro vinculado a la **madre** de una compra en cuotas: el trigger `trg_fn_reimbursement_invariants` (`0018_reimbursements.sql`) tiene un branch `is_parent` hecho justo para el subtipo "en resumen" sobre cuotas. El caso motivador es real y frecuente: cargar una compra nueva en cuotas que trae un reintegro (a cuenta propia o descontado del resumen).

## What Changes

- Habilitar el bloque "Tiene reintegro" en el alta de un gasto **en cuotas** (hoy oculto). El toggle y el selector de subtipo ya existen para gastos de tarjeta; solo se levanta el gateo `!isInstallments`.
- El reintegro se vincula a la **madre** de la compra en cuotas (`linked_transaction_id = parent.id`), no a una cuota hija. La operación sigue siendo **atómica**: si el reintegro falla, no se crea la compra ni sus cuotas.
- Ambos subtipos disponibles, como en una compra de un solo pago:
  - **a cuenta**: acredita una cuenta cash/bank propia.
  - **en resumen**: cae en el resumen de la **primera cuota** (el período de la fecha de compra, el mismo que usaría una compra 1×), a confirmar luego al recibirlo. Sin picker de período.
- Ambos estados: **recibido ahora** o **pendiente** (paridad total con la compra de un pago).
- En un gasto en cuotas **compartido**, el reintegro **hereda el split** del hogar (una sola fila de reintegro con los mismos porcentajes), de modo que el motor de deuda lo netea correctamente.
- **No hay migración nueva** ni cambios de esquema en la base.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `transactions`: el requirement "El usuario puede declarar un reintegro al registrar un gasto" se extiende para cubrir explícitamente las compras **en cuotas** (vínculo a la madre; subtipo "en resumen" imputado al período de la primera cuota; herencia de split cuando la compra es compartida).

## Impact

- **Schema de validación**: `registerInstallmentsSchema` (`packages/validation/src/credit-cards.ts`) suma el campo opcional `reimbursement`, igual que `registerCardPurchaseSchema`.
- **Orchestrator**: `registerInstallments` (`packages/transactions-mutations/src/register-installments.ts`) declara el reintegro contra la madre tras insertar madre + cuotas + splits, con rollback (el reintegro cascadea vía `ON DELETE CASCADE`). Espeja `register-card-purchase.ts`.
- **Form hook**: `use-movement-form.ts` (`packages/movement-form`) deja de gatear la construcción del payload y el dispatch de cuotas por `!isInstallments`.
- **UI web**: `movement-form.tsx` deja de ocultar el toggle en cuotas. El selector de subtipo ya se muestra para tarjetas.
- **Fuera de alcance**: agregar/editar un reintegro sobre una compra en cuotas **ya existente** (flujo posterior, backlog #3); la coherencia de la **lente devengada** (la cuota cuenta por vencimiento, el reintegro por su fecha → netean en meses distintos) se documenta como comportamiento conocido y se resuelve con el backlog #1 (`spending-accrual-and-lenses`).
- **Mobile**: sin cambios; la capa compartida (`movement-form`, `transactions-mutations`, `validation`) queda lista para que el tech lead cablee la UI nativa.
