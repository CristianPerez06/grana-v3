# Proposal: edit-recurrence-instance-account

## Why

El bloque "Movimientos recurrentes pendientes" ya trata la instancia como una **propuesta editable**: el usuario puede ajustar monto, fecha y descripción antes de confirmar. Falta justo el campo que en la vida real cambia más seguido: **con qué cuenta o tarjeta la pagó**.

Caso real del usuario: la luz es una recurrencia mensual, pero no siempre se paga con el mismo medio. Hoy la única salida es **omitir la instancia y cargar el movimiento a mano**, lo que pierde el vínculo con la regla (la instancia queda `skipped` y el movimiento real no queda ligado a nada) y obliga a salir del flujo del recordatorio.

Hay además un callejón sin salida hoy: si la cuenta de la regla está **archivada**, `confirmRecurrenceInstance` rechaza con "Editá la regla antes de confirmar". El usuario no puede resolver la instancia desde donde está parado.

## What Changes

- **La cuenta pasa a ser un campo editable de la instancia**, al lado de monto / fecha / descripción, en el bloque de pendientes (`/transactions` y `/transactions/recurring`).
- **El cambio de cuenta es un override de la instancia puntual y NO SHALL propagarse a la regla** — a diferencia del monto, que sí la actualiza (D6). Pagar la luz una vez con otra tarjeta no debe reescribir en silencio el medio por defecto de la regla; para eso está la edición de la regla en su detalle.
- **Cambiar de familia de cuenta cambia el movimiento resultante**: elegir una tarjeta de crédito en una instancia de gasto hace que la confirmación registre un consumo de tarjeta (con su asignación de período); elegir una cuenta cash/bank registra un gasto on-ledger. El mapeo ya existe (`mapInstanceToConfirmPlan` decide por `accountType`); lo nuevo es que la cuenta que se le pasa puede no ser la de la regla.
- **Elegibilidad**: solo se ofrecen cuentas del usuario, activas, con la **moneda de la instancia activa**, y compatibles con el tipo de movimiento (ingreso y transferencia nunca en tarjeta; el origen de una transferencia nunca puede ser su destino). El servidor revalida lo mismo que filtra la UI.
- **La instancia registra la cuenta con la que se confirmó**, para que el historial de la regla no mienta.
- **Cuenta archivada deja de ser callejón sin salida**: el usuario elige otra cuenta y confirma, sin tocar la regla.

Alcance web. `apps/mobile` tiene su propio bloque de pendientes y lo lleva el tech lead; la validación y la mutación viven en `@grana/validation` / `@grana/recurrences`, así que mobile hereda el backend y solo le queda la UI.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`:
  1. "El usuario puede editar una instancia antes de confirmarla" — suma la cuenta a los campos mutables, fija la semántica de override sin propagación, las reglas de elegibilidad y el efecto de cambiar de familia de cuenta.

## Impact

- `packages/validation/src/recurrences.ts`: `confirmRecurrenceInstanceSchema` acepta `account_id`.
- `packages/recurrences/src/mutations.ts` (`confirmRecurrenceInstance`): resuelve la cuenta efectiva, la valida con `assertAccountUsable` (pertenencia + activa + moneda activa), lee su `type` para el mapper y persiste `account_id` en la instancia al confirmar.
- `apps/web/lib/recurrences/components/pending-recurrences-block.tsx`: selector de cuenta en el panel de edición; el aviso de saldo negativo se recalcula contra la cuenta elegida.
- `apps/web/app/(app)/transactions/_components/pending-recurrences-block-container.tsx`: pasa las cuentas (ya las lee para el aviso de saldo).
- `apps/web/lib/accounts/form-accounts.ts` (nuevo): proyección `getAccounts()` → lista de cuentas de formulario, hoy duplicada en `edit-context.ts` y `movement-drawer-loader.tsx`.
- `packages/i18n-messages`: claves nuevas del selector.
- Sin migración: `recurrence_instances.account_id` ya existe y ya es la fuente que usa la confirmación.

## Ordering

El change activo `fix-recurrence-projection-and-orphans` también toca la capability `transactions`, pero sus deltas son sobre proyección, borrado de movimiento semilla, generación y duplicados — no sobre el requirement de edición de instancia. Este change va **después** (aquél ya está implementado y mergeado a `main`); no hay solapamiento de requirements.
