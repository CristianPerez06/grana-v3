# Tasks: fix-recurrence-backlog

Cuatro etapas. La 1 son cimientos y no tiene nada visible: existe porque sin ella la 2 fabrica
duplicados. Las etapas 2-4 entregan los ocho comportamientos de `proposal.md`.

## 1. Cimientos: identidad de ocurrencia y fechas separadas

- [ ] 1.1 Migración: agregar `recurrence_instances.due_date` (DATE NOT NULL) y poblarla derivando el
      vencimiento del cronograma de cada regla. Para instancias ya confirmadas cuyo `scheduled_date`
      fue pisado al confirmar, el vencimiento original no es recuperable: se deriva del cronograma y
      se acepta la aproximación (afecta historial, no montos).
- [ ] 1.2 Verificar que el paso 1.1 no produce colisiones antes de agregar
      `UNIQUE (recurrence_id, due_date)` **sin** cláusula `WHERE` — la identidad vale en todos los
      estados, no solo en `pending`.
- [ ] 1.3 Eliminar el índice `recurrence_instances_one_pending_per_rule`.
- [ ] 1.4 `confirmRecurrenceInstance` deja de escribir `scheduled_date` con la fecha elegida:
      `due_date` es inmutable y `scheduled_date` pasa a ser la fecha del movimiento.
- [ ] 1.5 Quitar de `confirmRecurrenceInstance` y `skipRecurrenceInstance` la escritura de
      `last_generated_date` (`mutations.ts:443` y `:500`). Conservar la columna durante la
      transición; deja de ser fuente de verdad del generador.
- [ ] 1.6 `decideRecurrenceInstance` pierde el parámetro `hasPending` y pasa a devolver la **lista**
      de ocurrencias faltantes, derivada de `walkOccurrences` y del conjunto de `due_date` ya
      existentes.
- [ ] 1.7 Unificar `max_occurrences`: el generador cuenta contra el cronograma, no filas de
      `recurrence_instances`. Test que fija el número único (regla creada desde movimiento con
      límite 3 ⇒ 3 ocurrencias totales, 2 materializadas, 2 proyectadas).
- [ ] 1.8 Tests de resolución fuera de orden: resolver agosto y después julio no regenera agosto, no
      saltea junio, y no mueve el cronograma.
- [ ] 1.9 Regenerar los tipos de Supabase y actualizar `supabase/validate_schema.sql`.

## 2. El backlog existe y se puede resolver

- [ ] 2.1 `generateDueRecurrenceInstances` materializa todas las ocurrencias vencidas, en orden de
      calendario, con tanda si el atraso es grande — **garantizando que la ocurrencia vigente entra
      en la primera tanda**.
- [ ] 2.2 Adaptar los reads que asumen una pendiente por regla:
      `getPendingInstancesByRecurrenceId` (hoy `Map<string, RecurrenceInstance>`) y
      `RecurrenceSummary.pending_instance` (hoy singular) pasan a colección.
- [ ] 2.3 Agrupar por regla en las superficies de "por revisar", con el resto colapsado cuando el
      grupo es largo, sin que ninguna ocurrencia deje de ser accesible.
- [ ] 2.4 Acción "Ponerse al día": resolución en bloque con fila por ocurrencia, cada una con fecha,
      importe y cuenta editables, y las cuatro salidas (registrar · vincular · no corresponde ·
      dejar sin resolver).
- [ ] 2.5 Resumen previo a aplicar: movimientos que se van a crear y efecto sobre el saldo de cada
      cuenta involucrada.
- [ ] 2.6 Copy: "pagos por revisar", nunca lenguaje de deuda. Actualizar `es.json` y `en.json`.
- [ ] 2.7 Tests: tres meses resueltos en una pasada con importes distintos y una cuenta distinta;
      dejar uno sin resolver no bloquea los demás.

## 3. Pago anticipado, vinculación y deshacer

- [ ] 3.1 "Ya lo pagué": materializar la próxima ocurrencia bajo demanda y abrir el formulario de
      resolución con la fecha de pago en hoy, editable. Disponible en el hub y en el detalle de la
      regla. No ofrecerla en reglas pausadas.
- [ ] 3.2 Verificar que el pago anticipado no desplaza el cronograma — test de tres meses seguidos
      pagados unos días antes, con el vencimiento sin moverse.
- [ ] 3.3 "Ya lo cargué": vincular un movimiento existente. No crea transacción; marca el movimiento
      como originado en la regla; filtra por moneda y tipo compatibles; excluye los ya vinculados.
- [ ] 3.4 Deshacer un pago: borra el movimiento y devuelve la ocurrencia a **sin resolver**, distinto
      de omitir. Coordinar con **#104** — con `one_pending_per_rule` eliminado desaparece la
      restricción que obligaba a marcarlo `skipped`.
- [ ] 3.5 Historial de la regla: mostrar vencimiento, fecha de pago y fecha de carga por separado.
- [ ] 3.6 Tests: vincular no cambia el total del mes; deshacer deja la ocurrencia resoluble de nuevo.

## 4. Visibilidad y paridad

- [ ] 4.1 Subir la materialización al layout de la app en web, para que corra en cualquier pantalla.
- [ ] 4.2 Agregarla al feed nativo, que hoy muestra las ocurrencias pero no las materializa.
- [ ] 4.3 Bloque de "por revisar" en el inicio, en web y en nativo.
- [ ] 4.4 El bloque arranca expandido siempre que haya al menos una ocurrencia vencida (hoy hace lo
      contrario: se pliega con 2 o más).
- [ ] 4.5 Cada fila explicita qué va a pasar al resolverla: qué movimiento, con qué fecha, en qué
      cuenta.
- [ ] 4.6 Paridad nativa del formulario de resolución: importe, fecha y cuenta editables, más la
      advertencia de saldo negativo que hoy solo existe en web.
- [ ] 4.7 Sellar las ocurrencias de reglas pausadas, en vez de mostrarlas sin distinción.
- [ ] 4.8 Recorrer los ocho comportamientos de `proposal.md` en web y en nativo antes de cerrar.

## 5. Cierre

- [ ] 5.1 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm lint:mobile`, `pnpm typecheck:mobile`.
- [ ] 5.2 Archivar el change y aplicar los deltas al spec maestro de `transactions`
      (`RENAMED` + `MODIFIED` + `ADDED`), sin dejar secciones delta en el maestro.
- [ ] 5.3 `pnpm openspec:check` en verde.
