## Why

Una regla creada a partir de un movimiento hereda la fecha de ese movimiento, y esa fecha puede no ser la que corresponde. El caso que lo disparó es real y salió en el QA del #96: un sueldo que ese mes se acreditó el **8** por un fin de semana largo —cuando el vencimiento es el **10**— dejó la regla anclada al 8. Todos los meses, para siempre, el recordatorio llega dos días antes.

No es grave y no rompe nada: desde `fix-recurrence-backlog` el vencimiento y la fecha de pago son datos separados, así que confirmar el movimiento con su fecha real no mueve el calendario de la regla. Pero la única forma de corregirlo hoy es **borrar la regla y crearla de nuevo**, perdiendo su historial de ocurrencias — un precio desproporcionado para un día de diferencia.

El backend ya lo soporta. Lo verificamos, no lo suponemos:

- `updateRecurrenceSchema` acepta `start_date` opcional (`packages/validation/src/recurrences.ts:260`).
- `updateRecurrence` lo mergea contra el valor actual y lo propaga al patch (`packages/recurrences/src/mutations.ts:586` y `:654`).
- El trigger `recurrence_sync_schedule_and_pauses` (migración `0064`) borra las versiones futuras del cronograma e inserta una nueva con `effective_from = greatest(hoy, start_date)` y `anchor_date = start_date`. Es decir: rige desde el cambio y no reinterpreta el pasado.

Falta únicamente el campo en las dos UIs.

## El borde que apareció en QA, y que cambió el alcance

Corregir el ancla a mitad de un ciclo puede **duplicar el vencimiento del ciclo en curso**. Reproducido con datos reales el 10/9: una regla de sueldo anclada al 8, con el del 8 de septiembre ya confirmado, corregida al día 10 → el generador materializó **también** el 10 de septiembre. Dos sueldos el mismo mes.

No es un defecto del generador. La identidad de una ocurrencia es `(regla, vencimiento)`, y el 8 y el 10 de septiembre son dos fechas distintas: **ninguna aritmética de fechas puede saber que son el mismo sueldo.** Se probaron cuatro fórmulas de vigencia automática —`hoy + 1`, "un intervalo después de la última existente", "desde la próxima ocurrencia vieja", "desde el próximo período"— y cada una resuelve dos de estos tres casos y rompe el tercero:

| | Situación | Qué tiene que pasar |
|---|---|---|
| **A** | El vencimiento del ciclo ya se resolvió | El cambio rige desde el siguiente. El ciclo en curso NO gana un segundo vencimiento. |
| **B** | Se corrige antes de que llegue el del ciclo | El ciclo en curso vence en la fecha nueva, y NO también en la vieja. |
| **C** | La regla tiene atraso sin resolver | El atraso conserva las fechas viejas —el pasado no se reinterpreta— y el cambio rige de acá en adelante. |

Tampoco sirve razonar por "mes" o "período": una regla cada 3 días no tiene ninguno.

**Entonces la ambigüedad la resuelve el usuario, con fechas concretas.** Al cambiar la fecha de referencia, el formulario pregunta **"¿Cuál querés que sea el primer vencimiento con la nueva referencia?"** y ofrece las **dos primeras fechas del cronograma nuevo** —para el sueldo, `10 de septiembre` y `10 de octubre`—. Funciona igual para una regla semanal o cada N días, porque no nombra períodos: nombra días.

### El hueco no lo respeta nadie más que el generador — y eso ya pasaba

Auditadas las lecturas que caminan un cronograma, **ninguna mira las versiones**: `getNextExpectedOccurrence` —la "Próxima fecha" del detalle, del hub y del aviso de duplicados— y `projectUpcomingOccurrences` —la proyección del dashboard— caminan el calendario con los campos crudos de la regla. Hoy eso pasa desapercibido porque la versión vigente coincide con esos campos; con un hueco dejaría de coincidir, y la UI proyectaría un vencimiento que la base decidió que no existe.

O sea que el hueco obliga a cerrar una brecha **que ya estaba abierta**: el generador y las pantallas derivan el calendario de fuentes distintas. Se cierra dando a esas dos lecturas el piso que la base ya conoce.

### Por qué esto obliga a una migración

La elección **se persiste**, no se infiere. Y hay una trampa que la hace imposible con el modelo actual: si el usuario elige octubre, **no alcanza** con abrir la versión nueva el 10/10. El cronograma viejo gobierna hasta el día anterior a la versión siguiente, así que produciría el **8 de octubre** antes de que la nueva empiece — el duplicado vuelve, corrido un mes.

Hace falta que una versión pueda **dejar de producir antes** de que arranque la siguiente. Hoy no existe forma de decir eso: el fin de una versión se deriva del comienzo de la otra.

## What Changes

- El drawer de edición de una regla suma un campo **Fecha de referencia**, que edita el ancla del calendario (`start_date`). Va en web y en nativo, en el mismo commit, por la política de paridad.
- Al cambiarla, el formulario **pregunta desde qué vencimiento rige**, ofreciendo las dos primeras fechas del cronograma nuevo. La respuesta viaja con la mutación; no se adivina.
- **Migración `0068`**: `recurrence_schedule_versions` suma `effective_until` —el último día, **inclusive**, en que una versión puede producir— con un `CHECK` que impide `effective_until < effective_from`. `NULL` conserva el comportamiento actual, así que las versiones que ya existen no cambian de significado. `recurrences` suma `schedule_effective_from`: desde cuándo rige el cronograma vigente, mantenido por el mismo trigger, para que **toda** lectura tenga el piso sin salir de la fila que ya lee.
- Al aplicar una vigencia, la versión saliente se cierra en **`least(hoy, vigencia_elegida - 1)`**: si la nueva empieza hoy, la vieja termina ayer; si empieza más adelante, termina hoy. Nunca se superponen dos cronogramas.
- **La vigencia llega de forma atómica y obligatoria**: un RPC aplica el patch de la regla y la fecha elegida en la misma transacción, y el trigger **rechaza** un cambio de ancla que no la traiga. Una vigencia implícita es exactamente lo que produjo el duplicado.
- El walker compartido (`owedOccurrencesForRule`) cierra cada versión en el **menor** entre `effective_until`, el día anterior a la versión siguiente, y hoy. El hueco **no produce nada**.
- `getNextExpectedOccurrence` y `projectUpcomingOccurrences` respetan el mismo piso, así que "Próxima fecha", el aviso de duplicados y la proyección del dashboard no pueden mostrar un vencimiento que el generador nunca va a crear.
- La etiqueta es "Fecha de referencia" y no "Día de vencimiento": para una regla semanal o cada N días no hay un "día" del mes, y el nombre sería incorrecto justo en los casos donde el campo más se necesita.
- El formulario dice qué va a pasar antes de guardar: el cambio rige desde acá, y las ocurrencias que ya existen conservan su vencimiento.
- El spec de `transactions` deja de fijar el field set mutable en cuatro campos y pasa a cinco, con las tres reglas del cambio escritas: rige desde el cambio, no reconstruye el pasado, y funciona con la regla activa o pausada.

### Lo que NO cambia

- **Las ocurrencias existentes.** Ninguna se mueve, se borra ni se re-fecha: el vencimiento es inmutable, y esta entrega no lo toca ni siquiera para "corregir" el duplicado que ya se produjo en QA. Esa limpieza es dirigida, verificable y aparte.
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
- `packages/i18n-messages` — la etiqueta, la ayuda y la pregunta, en `es.json` y `en.json`.
- `supabase/migrations/0068_schedule_version_effective_until.sql` — la columna y el trigger que recibe la vigencia. Número elegido contra `main`.
- `packages/money-logic` — el walker respeta `effective_until`.
- `packages/validation` y `packages/recurrences` — el campo nuevo de la mutación, validado contra el cronograma: la fecha elegida SHALL ser una ocurrencia real del cronograma nuevo, no una fecha cualquiera.
