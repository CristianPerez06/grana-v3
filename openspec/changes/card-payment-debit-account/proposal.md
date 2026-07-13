## Why

Al pagar el resumen de una tarjeta, la cuenta de débito arranca en la primera de la lista (a menudo "Billetera"), y es fácil confirmar sin mirar y pagar desde la cuenta equivocada. Peor: una vez guardado, **no hay forma de corregir la cuenta** — el form de edición trata la cuenta como contexto inmutable, y "Eliminar" un pago está roto (bug aparte). Este cambio ataca la raíz (buen default) y da la salida (editar la cuenta).

## What Changes

- **Default por banco**: al pagar un resumen, la cuenta de débito por defecto es la del **mismo banco de la tarjeta** que se está pagando (si existe una cuenta activa de esa institución con ARS); si no, cae en la primera como hoy.
- **Editar la cuenta de débito**: en la edición de un **pago de resumen**, la cuenta desde donde salió el pago pasa a ser **editable** (antes era contexto inmutable). Cambiarla mueve el débito y recalcula saldos; el vínculo con el período (`period_payments`) y las cuotas pagadas no se tocan.

## Capabilities

### New Capabilities
<!-- Ninguna nueva; se modifican requisitos de capacidades existentes. -->

### Modified Capabilities
- `cards`: el pago de resumen sugiere por defecto la cuenta de débito del mismo banco de la tarjeta.
- `transactions`: la cuenta de débito de un pago de resumen es editable post-creación (excepción acotada al invariante "cuenta inmutable" del form de edición, seguro porque la cuenta de un pago es un puntero de débito sin cascadas).

## Impact

- **`apps/web` pay flow**: `pay/page.tsx` calcula la cuenta por defecto por institución y la pasa al form; `pay-card-period-form.tsx` la usa como estado inicial.
- **`packages/money-logic`**: `EditableFields.account` (nuevo), true solo para el pago de resumen (`isCardPayment`).
- **`packages/validation`**: `updateTransactionSchema` acepta `account_id` opcional.
- **`packages/transactions-mutations`**: `updateTransaction` aplica el cambio de `account_id` (guarda: solo cuando `card_period_id IS NULL` — no es un consumo de tarjeta; valida moneda activa + cuenta no-crédito en la cuenta nueva).
- **`packages/movement-form`**: la rama de `submitEdit` que actualiza el gasto envía `account_id` cuando el campo es editable.
- **`apps/web` movement-form**: en edición, cuando `editableFields.account`, renderiza un picker de cuentas de débito en vez de la fila read-only.
- **Sin migración**: es un UPDATE de columna existente.
- **Fuera de alcance**: arreglar el "Eliminar" de un pago (reversión atómica) — followup aparte.
