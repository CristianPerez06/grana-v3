# Tasks: fix-recurrence-backlog

Cinco etapas. La 1 son cimientos y no tiene nada visible: existe porque sin ella la 2 fabrica
duplicados. Las etapas 2-4 entregan los once comportamientos de `proposal.md`. El **#104** se
implementa acá (tarea 3.4) y cierra con esta entrega; el **#118** es independiente y no entra.

## 1. Cimientos: identidad de ocurrencia y fechas separadas

- [ ] 1.1 Migración: agregar `recurrence_instances.due_date` (DATE NOT NULL) y poblarla derivando el
      vencimiento del cronograma de cada regla. Para instancias ya confirmadas cuyo `scheduled_date`
      fue pisado al confirmar, el vencimiento original no es recuperable: se deriva del cronograma y
      se acepta la aproximación (afecta historial, no montos).
- [ ] 1.2 Verificar que el paso 1.1 no produce colisiones antes de agregar
      `UNIQUE (recurrence_id, due_date)` **sin** cláusula `WHERE` — la identidad vale en todos los
      estados, no solo en `pending`.
- [ ] 1.3 Eliminar el índice `recurrence_instances_one_pending_per_rule`.
- [ ] 1.4 `confirmRecurrenceInstance` deja de escribir `scheduled_date`. `due_date` es inmutable; la
      fecha de pago vive en `transactions.date`, la de carga en `transactions.created_at` y la de
      resolución en `resolved_at`. `scheduled_date` queda como alias de lectura de `due_date` durante
      la transición y **nunca** pasa a ser fecha de pago (una ocurrencia sin resolver no tiene pago).
- [ ] 1.4b Agregar a `recurrence_instances` **cómo se resolvió** (`created` | `linked`), sin lo cual
      deshacer no puede distinguir eliminar de desvincular.
- [ ] 1.4c Quitar de `confirmRecurrenceInstance` la propagación del importe a la regla
      (`mutations.ts:446`): con resolución en bloque el resultado dependería del orden.
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

- [ ] 2.1 `generateDueRecurrenceInstances` materializa las ocurrencias vencidas dentro del horizonte
      de **12 meses inclusive**, calculado con `getTodayAR()` (nunca `current_date`: Supabase corre en
      UTC), en orden de calendario y **por tandas acotadas** — abrir una pantalla no dispara cientos
      de escrituras; la tanda se completa en sucesivas aperturas y **la ocurrencia vigente entra
      siempre en la primera**. El horizonte limita solo la reconstrucción automática: registrar a
      mano un pago más viejo sigue siendo posible.
- [ ] 2.1c Aviso de historial no reconstruido **en la recurrencia** ("tiene historial anterior a
      <mes> que no se reconstruyó"), no como "este mes tiene información incompleta": esos pagos
      pueden haberse cargado a mano.
- [ ] 2.1d Pausa: no materializar los vencimientos que caen durante la pausa ni recuperarlos al
      reanudar; al reanudar tomar el próximo vencimiento futuro con el calendario original. Test:
      regla del 23 pausada en junio y reanudada el 5/9 vuelve con el 23/9, sin junio, julio ni agosto.
- [ ] 2.1b Vigencia de los cambios de cronograma: editar frecuencia/intervalo/día no reinterpreta
      ocurrencias anteriores a la fecha de vigencia. Test: una regla mensual con historial editada a
      quincenal no fabrica vencimientos viejos.
- [ ] 2.2 Adaptar los reads que asumen una pendiente por regla:
      `getPendingInstancesByRecurrenceId` (hoy `Map<string, RecurrenceInstance>`) y
      `RecurrenceSummary.pending_instance` (hoy singular) pasan a colección.
- [ ] 2.3 Agrupar por regla en las superficies de "por revisar", con el resto colapsado cuando el
      grupo es largo, sin que ninguna ocurrencia deje de ser accesible.
- [ ] 2.4 Acción "Ponerse al día": resolución en bloque con fila por ocurrencia, cada una con fecha,
      importe y cuenta editables, y las cuatro salidas (registrar · vincular · no corresponde ·
      dejar sin resolver). **Atómica**: orquestador con rollback en `@grana/transactions-mutations`,
      como el alta de cuotas.
- [ ] 2.4b Acción separada "Usar este importe de acá en más", aplicada una sola vez y tomando el
      importe de la ocurrencia más reciente del grupo.
- [ ] 2.5 Resumen previo a aplicar: movimientos que se van a crear y efecto sobre el saldo de cada
      cuenta involucrada.
- [ ] 2.6 Copy: **"vencimientos por revisar"** — ni "pagos" (afirmaría que hubo pago) ni lenguaje de
      deuda. Actualizar `es.json` y `en.json`.
- [ ] 2.7 Tests: tres meses resueltos en una pasada con importes distintos y una cuenta distinta, sin
      que cambie el importe de la regla; un fallo en el tercero no deja los dos primeros guardados;
      dejar uno sin resolver no bloquea los demás.

## 3. Pago anticipado, vinculación y deshacer

- [ ] 3.1 "Ya lo pagué": materializar la próxima ocurrencia bajo demanda y abrir el formulario de
      resolución con la fecha de pago en hoy, editable. Disponible en el hub y en el detalle de la
      regla. No ofrecerla en reglas pausadas.
- [ ] 3.2 Verificar que el pago anticipado no desplaza el cronograma — test de tres meses seguidos
      pagados unos días antes, con el vencimiento sin moverse.
- [ ] 3.3 "Ya lo cargué": vincular un movimiento existente. No crea transacción; marca el movimiento
      como **"vinculado a esta recurrencia"** —no "originado en", que existía antes—; filtra por
      moneda y tipo compatibles; excluye los ya vinculados; registra la resolución como `linked`.
- [ ] 3.3b Vinculación en reglas **compartidas**: aceptar directo solo con reparto compatible; si no,
      explicar la conversión a gasto compartido y pedir confirmación. Conversión + vinculación en una
      sola operación atómica. Test: la deuda del hogar queda igual que registrando desde la
      recurrencia, y un fallo no deja el movimiento convertido a medias.
- [ ] 3.4 Deshacer, **cerrando #104 en esta misma entrega**: devuelve la ocurrencia a *sin resolver*
      (nunca a omitida) y actúa según cómo se resolvió — `created` elimina el movimiento; `linked` lo
      conserva y desvincula; `linked` que además había **convertido** el movimiento a compartido
      revierte también la conversión y la deuda, de forma atómica. Con `one_pending_per_rule` eliminado desaparece la restricción que
      obligaba a marcarlo `skipped`.
- [ ] 3.5 Historial de la regla: mostrar vencimiento, fecha de pago y fecha de carga por separado.
- [ ] 3.6 Tests: vincular no cambia el total del mes; deshacer un `created` elimina el movimiento;
      deshacer un `linked` lo conserva y el total del mes no cambia; en ambos casos la ocurrencia
      queda resoluble de nuevo.

## 4. Visibilidad y paridad

- [ ] 4.1 Subir la materialización al layout de la app en web, para que corra en cualquier pantalla.
- [ ] 4.2 Agregarla al feed nativo, que hoy muestra las ocurrencias pero no las materializa.
- [ ] 4.3 Bloque de "por revisar" en el inicio, en web y en nativo.
- [ ] 4.4 El bloque arranca expandido siempre que haya al menos una ocurrencia vencida (hoy hace lo
      contrario: se pliega con 2 o más).
- [ ] 4.5 Cada fila explicita qué va a pasar al resolverla: qué movimiento, con qué fecha, en qué
      cuenta.
- [ ] 4.5b Un fallo de materialización se muestra con opción de reintentar, distinguible de "no hay
      vencimientos por revisar". Reemplaza los `catch` vacíos de los disparadores actuales.
- [ ] 4.5c Señalar los períodos anteriores al horizonte como de información incompleta, con la vía
      para completarlos a mano.
- [ ] 4.6 Paridad nativa del formulario de resolución: importe, fecha y cuenta editables, más la
      advertencia de saldo negativo que hoy solo existe en web.
- [ ] 4.7 Sellar como "Pausada" las ocurrencias anteriores a una pausa, que siguen resolubles.
- [ ] 4.8 Recorrer los once comportamientos de `proposal.md` en web y en nativo antes de cerrar.

## 5. Cierre

- [ ] 5.1 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm lint:mobile`, `pnpm typecheck:mobile`.
- [ ] 5.2 Archivar el change y aplicar los deltas al spec maestro de `transactions`
      (`RENAMED` + `MODIFIED` + `ADDED`), sin dejar secciones delta en el maestro.
- [ ] 5.3 `pnpm openspec:check` en verde.
- [ ] 5.4 Cerrar **#96** y **#104** con esta entrega. **#118** queda abierto: es independiente.
