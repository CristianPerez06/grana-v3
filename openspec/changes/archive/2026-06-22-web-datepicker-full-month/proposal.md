## Why

En QA de producción se detectó que completar una fecha cuesta dos clicks: al tocar el campo se abre primero un paso intermedio (en alta de movimiento y recurrencias, un popover con botón "Hoy" + un `<input type="date">` nativo; en el resto, el campo nativo con su iconito de calendario), y recién con un segundo click sobre el ícono de calendario se despliega el mes. Es fricción innecesaria en una de las acciones más repetidas de la app, y el comportamiento varía según navegador/OS (no es controlable con el input nativo). Queremos que tocar cualquier campo de fecha abra **directamente** el calendario de mes completo, igual en toda la web.

## What Changes

- Nuevo primitivo de UI web `DatePicker` (`apps/web/components/ui/date-picker.tsx`): `Popover` (Radix, ya en uso) anclado que despliega un **grid de mes completo** al hacer click, con botón "Hoy", navegación de mes, y soporte de `min`/`max`. El "hoy" por defecto se computa con `getTodayAR()` (zona horaria financiera), nunca `new Date()`.
- Se suma la dependencia `react-day-picker` a `apps/web` para el grid de mes.
- Barrido en TODA la web: reemplazar los `<input type="date">` (y el popover intermedio con botón "Hoy") por el nuevo `DatePicker` en los 10 sitios de consumo: alta y edición de movimiento, alta y edición de tarjeta, pago de resumen, edición de fechas de período, alta y edición de recurrencia, bloque de reintegros pendientes, bloque de recurrencias pendientes.
- El contrato de valor se mantiene: las fechas siguen siendo strings ISO `YYYY-MM-DD` (fecha contable sin timezone), para no tocar la lógica de submit/validación existente.

## Capabilities

### New Capabilities
- `web-date-picker`: primitivo de selección de fecha en web que, al abrirse, muestra el mes completo de una; valor ISO `YYYY-MM-DD`, "hoy" en zona financiera, `min`/`max` opcionales, y reemplaza todo `<input type="date">` de la web.

### Modified Capabilities
<!-- Ninguna capability de dominio cambia sus requisitos: el barrido sustituye el control de UI sin alterar el contrato de datos (string ISO) ni las reglas de negocio de cada formulario. -->

## Impact

- **Dependencia nueva:** `react-day-picker` en `apps/web/package.json`.
- **Componente nuevo:** `apps/web/components/ui/date-picker.tsx` (+ story de Storybook).
- **Archivos tocados (consumo):**
  - `apps/web/lib/transactions/components/movement-form.tsx` (popover de fecha intermedio → DatePicker)
  - `apps/web/app/(app)/cards/_components/card-form-ui.tsx` (`DateField`) y sus consumidores `create-card-form.tsx`, `[id]/_components/edit-card-form.tsx`
  - `apps/web/app/(app)/cards/[id]/periods/[periodId]/pay/_components/pay-card-period-form.tsx`
  - `apps/web/app/(app)/cards/[id]/periods/[periodId]/_components/edit-dates-sheet.tsx`
  - `apps/web/app/(app)/transactions/recurring/_components/create-recurrence-modal.tsx`
  - `apps/web/app/(app)/transactions/recurring/[id]/_components/recurrence-edit-drawer.tsx`
  - `apps/web/lib/recurrences/components/pending-recurrences-block.tsx`
  - `apps/web/lib/transactions/components/pending-reimbursements-block.tsx`
- **Scope:** solo web (responsive). Mobile lo maneja el tech lead; este change no toca `apps/mobile`.
- **Sin migraciones, sin cambios de RPC, sin cambios de contrato de datos.**
