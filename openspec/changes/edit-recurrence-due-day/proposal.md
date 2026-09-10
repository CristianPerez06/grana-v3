## Why

Una regla creada a partir de un movimiento hereda la fecha de ese movimiento, y esa fecha puede no ser la que corresponde. El caso que lo disparó es real y salió en el QA del #96: un sueldo que ese mes se acreditó el **8** por un fin de semana largo —cuando el vencimiento es el **10**— dejó la regla anclada al 8. Todos los meses, para siempre, el recordatorio llega dos días antes.

No es grave y no rompe nada: desde `fix-recurrence-backlog` el vencimiento y la fecha de pago son datos separados, así que confirmar el movimiento con su fecha real no mueve el calendario de la regla. Pero la única forma de corregirlo hoy es **borrar la regla y crearla de nuevo**, perdiendo su historial de ocurrencias — un precio desproporcionado para un día de diferencia.

El backend ya lo soporta. Lo verificamos, no lo suponemos:

- `updateRecurrenceSchema` acepta `start_date` opcional (`packages/validation/src/recurrences.ts:260`).
- `updateRecurrence` lo mergea contra el valor actual y lo propaga al patch (`packages/recurrences/src/mutations.ts:586` y `:654`).
- El trigger `recurrence_sync_schedule_and_pauses` (migración `0064`) borra las versiones futuras del cronograma e inserta una nueva con `effective_from = greatest(hoy, start_date)` y `anchor_date = start_date`. Es decir: rige desde el cambio y no reinterpreta el pasado.

Falta únicamente el campo en las dos UIs.

## What Changes

- El drawer de edición de una regla suma un campo **Fecha de referencia**, que edita el ancla del calendario (`start_date`). Va en web y en nativo, en el mismo commit, por la política de paridad.
- La etiqueta es "Fecha de referencia" y no "Día de vencimiento": para una regla semanal o cada N días no hay un "día" del mes, y el nombre sería incorrecto justo en los casos donde el campo más se necesita.
- El formulario dice qué va a pasar antes de guardar: el cambio rige desde acá, y las ocurrencias que ya existen conservan su vencimiento.
- El spec de `transactions` deja de fijar el field set mutable en cuatro campos y pasa a cinco, con las tres reglas del cambio escritas: rige desde el cambio, no reconstruye el pasado, y funciona con la regla activa o pausada.

### Lo que NO cambia

- **Ninguna migración.** Esta entrega no toca la base: la validación, la mutación y el trigger ya existen.
- **Ninguna ocurrencia se mueve.** El vencimiento es inmutable por requirement; una regla corregida del 8 al 10 puede quedar con una ocurrencia vieja en el 8 y las siguientes en el 10, y eso es lo correcto.
- **No se reconstruye historial.** Mover el ancla no materializa nada hacia atrás.

### Alternativa descartada

**Reescribir las ocurrencias pendientes al nuevo día.** Es lo que el usuario podría esperar —"corregí la regla, corregime también lo que está por revisar"— pero rompe la identidad de la ocurrencia, que es justamente lo que `fix-recurrence-backlog` acaba de establecer: una ocurrencia es única por `(regla, vencimiento)` y ese vencimiento no se mueve. Qué hacer con una pendiente que quedó en la fecha vieja es **decisión del usuario**: puede confirmarla u omitirla por separado, cuando quiera. La ayuda del formulario existe para que sepa que va a seguir ahí, no para empujarlo a resolverla de una manera.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `transactions`: el field set mutable de una regla recurrente incluye el día de vencimiento, con las reglas de vigencia del cambio.

## Impact

- `apps/web/app/(app)/transactions/recurring/[id]/_components/recurrence-edit-drawer.tsx` — el campo nuevo.
- `apps/mobile/components/recurrences/RecurrenceEditForm.tsx` — su espejo nativo.
- `packages/i18n-messages` — la etiqueta y la advertencia, en `es.json` y `en.json`.
- Sin cambios en `packages/validation`, `packages/recurrences` ni `supabase/migrations`.
