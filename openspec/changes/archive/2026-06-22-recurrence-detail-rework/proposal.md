## Why

El usuario reportó (2026-06-05) que `/transactions/recurring/[id]` debería tener la misma UX que el detalle de un movimiento (`/transactions/[txId]`): una vista read-only del resumen con las acciones en el header y la edición en un drawer — no el form siempre-editable inline que tiene hoy. La pantalla actual abre directo en modo edición, mezcla acciones de estado (pausar/eliminar) con campos de formulario, y usa un `confirm()` nativo para borrar. Toda la capa de mutaciones ya existe; esto es puramente un rework de presentación.

## What Changes

- **Vista detail read-only**: reemplazar `RecurrenceDetailForm` (form inline siempre visible) por un resumen de solo lectura — chip de frecuencia, monto protagonista, cuenta/destino, categoría, próxima fecha y end-date cuando aplique — en el lenguaje visual del detalle de movimiento.
- **Acciones en el header (patrón A1)**: tres icon-buttons arriba a la derecha — ✏️ Editar · ⏸️/▶️ Pausar/Reactivar · 🗑️ Eliminar — replicando `TxActionsMenu` (icon-buttons directos, no dropdown), extendido a la tercera acción de estado propia de las recurrencias.
- **Edit en drawer**: la edición pasa a un `Drawer` (mismo primitivo que el detalle de movimiento) con un **field set reducido** — amount / frequency / end_date / description. Account, categoría y movement_type quedan fijos (se setean al crear, no son editables), así que el drawer NO reusa el form de creación completo.
- **Delete con AlertDialog**: reemplazar el `confirm()` nativo por un Radix `AlertDialog` con copy contextual, alineado al patrón del detalle de movimiento.
- **`RecurrenceInstancesList` se mantiene** debajo del detail, sin cambios.
- **Sin cambios de backend**: `updateRecurrence`, `pauseRecurrence`, `resumeRecurrence`, `deleteRecurrence` ya existen como server actions y se reusan tal cual.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `transactions`: **ADD** un requirement que define la UX de la pantalla de detalle de una regla recurrente (`/transactions/recurring/[id]`) — vista read-only + acciones en header (editar / pausar-reactivar / eliminar) + edición en drawer con field set reducido + confirmación de borrado por diálogo. El requirement existente "El usuario puede gestionar, pausar y eliminar reglas recurrentes" (que cubre la **lista** `/transactions/recurring` y los comportamientos de pausa/baja) no cambia.

## Impact

- **Código**:
  - `app/(app)/transactions/recurring/[id]/page.tsx` — renderiza el nuevo detail component en vez de `RecurrenceDetailForm`.
  - **Nuevos** `_components`: detail read-only view, header actions (icon-buttons + AlertDialog de delete), edit drawer con el form reducido.
  - **Borrado/reemplazo** de `recurrence-detail-form.tsx` (su lógica de mutación se reparte entre el drawer de edición y las header actions).
  - `recurrence-instances-list.tsx` — sin cambios.
- **Backend / mutaciones / SQL**: ninguno — las 4 server actions ya existen.
- **i18n**: posibles claves nuevas para labels del detail read-only y copy del AlertDialog; reusar las existentes de `recurrences.*` donde apliquen.
- **Spec**: delta ADDED en `transactions`.
