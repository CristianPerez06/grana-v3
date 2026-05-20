## Why

El spec actual de `transactions` exige una operación `reverseCardPayment` que revierte un pago de resumen (vuelve las cuotas a pending, borra el `period_payment` y el expense). El action existe en el código y el componente `ReversePaymentDialog` también — pero ningún caller jamás lo importa.

Más todavía: el formulario de pago tiene un copy explícito que le dice al usuario lo contrario: *"Una vez confirmado, el pago no se puede revertir. Si registraste un monto o cuenta incorrectos, podés corregirlo con un ajuste de saldo."*

O sea, el spec, el código y la UX están desalineados. La decisión de producto vigente es **mantener los pagos como irreversibles**: errores se corrigen con un `adjustment` manual. Este change deja el repo coherente con esa decisión.

## What Changes

- **BREAKING (a nivel API interna)**: eliminar el server action `reverseCardPayment` de `apps/web/app/_actions/credit-cards.ts`.
- Eliminar el componente huérfano `apps/web/app/(app)/cards/[id]/periods/[periodId]/_components/reverse-payment-dialog.tsx` (no tiene callers).
- Marcar el requirement *"El usuario puede revertir un pago de resumen"* como REMOVED en `specs/transactions/spec.md`, con su `**Reason**` (decisión de UX: pagos irreversibles) y su `**Migration**` (usar un ajuste de saldo).
- Limpiar también el scenario en `specs/cards/spec.md` que asumía la reversión como flujo válido ("Revertir un pago muestra nuevamente el período con deuda").

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`: se elimina el requirement de `reverseCardPayment` y sus scenarios.
- `cards`: se elimina (o reformula) el scenario que dependía de la reversión.

## Impact

- Spec: `openspec/specs/transactions/spec.md` y `openspec/specs/cards/spec.md`.
- Código: `apps/web/app/_actions/credit-cards.ts` (función `reverseCardPayment` ~70 LOC) y `apps/web/app/(app)/cards/[id]/periods/[periodId]/_components/reverse-payment-dialog.tsx` (archivo entero).
- No hay callers en el código, así que no hay regresiones de runtime.
- No hay cambios de DB ni de tipos generados.
