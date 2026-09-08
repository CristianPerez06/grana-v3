# Tasks: fix-recurrence-backlog

Cinco etapas. La 1 son cimientos y no tiene nada visible: existe porque sin ella la 2 fabrica
duplicados. Las etapas 2-4 entregan los once comportamientos de `proposal.md`. El **#104** se
implementa acá (tarea 3.4) y cierra con esta entrega; el **#118** es independiente y no entra.

## 1. Cimientos: modelo persistente

Ver "Modelo persistente" en `design.md`. Son **dos migraciones con un despliegue en el medio**
(decisión 17): la expansión es aditiva y no cambia el comportamiento; la activación —tarea 2.8— es la
que habilita el backlog.

- [x] 1.1 Migración: agregar `recurrence_instances.due_date` (**nullable**) y `due_date_is_unknown`.
      `pending` y `skipped` conservan un vencimiento exacto; las `confirmed` históricas quedan en
      `NULL` + marca, porque su vencimiento es irrecuperable y una fecha dudosa ocuparía la identidad
      del vencimiento verdadero (decisión 23).
- [x] 1.2 **Política de colisiones** (decisión 18): detectar duplicados de `(recurrence_id, due_date)`
      **solo entre vencimientos exactos** —las desconocidas tienen `NULL` y no compiten por ninguna
      identidad— y, si hay alguno, **abortar la transacción** con un informe de la regla, las
      instancias en conflicto y el `due_date` derivado. Nunca adivinar. Recién en una corrida limpia,
      agregar el índice **parcial** `UNIQUE (recurrence_id, due_date) WHERE due_date IS NOT NULL`.
- [x] 1.2b Crear `recurrence_schedule_versions` con una versión por regla, marcada
      **`is_assumed = true`** y con **`effective_from = reconstruct_from`, no `start_date`**: la marca
      sola no cambia el cálculo, y anclar en `start_date` proyectaría la frecuencia actual sobre un
      pasado que pudo tener otra (decisión 21). `anchor_date` sí queda en `start_date`: es el ancla
      del clamping de fin de mes, no una afirmación sobre cuándo empezó.
      `recurrences.interval_*` queda como la versión vigente para la UI y el `CHECK` de 0053.
- [x] 1.2c Crear `recurrence_pauses` (`paused_from`, `resumed_at` nullable) con una fila abierta por
      cada regla hoy pausada. El `status = 'paused'` se conserva; el intervalo es lo que impide que
      el período pausado se lea como huecos al reanudar.
- [x] 1.2d Agregar `recurrences.reconstruct_from` (decisión 21):
      `last_generated_date` en activas con cursor, **`start_date - 1`** en activas sin cursor —el
      contrato genera estrictamente después, y sin cursor la primera ocurrencia cae EN `start_date`—,
      y **fecha de la migración** en pausadas.
      **Contrato:** el generador reconstruye las ocurrencias POSTERIORES a `reconstruct_from` dentro
      del horizonte, descontando las que ya existan — eso ES el arreglo del #96. Solo lo anterior al
      cursor queda fuera.
- [x] 1.2f Constraints `(recurrence_id, user_id)` compuestas en las dos tablas nuevas, contra
      `recurrences(id, user_id)`. Con FK independientes y un RLS que solo mira `user_id = auth.uid()`,
      la base aceptaría una fila con mi usuario y la recurrencia de otro.
- [x] 1.2f2 **Dual-write en la base**: triggers en `recurrences` que crean la versión inicial al
      insertar, agregan una versión vigente desde hoy al cambiar el cronograma, y abren/cierran el
      intervalo al pausar/reanudar. Sin esto el backfill solo cubre lo preexistente y las reglas más
      nuevas quedan sin versión. **La base es el dueño único**: el código nuevo no debe escribir esas
      tablas — y no puede: quedan **sin políticas de escritura**, así que son de solo lectura para
      `authenticated` y los triggers son `SECURITY DEFINER` con `search_path` cerrado. Al editar el
      cronograma se **reemplazan las versiones futuras** aún no vigentes y la nueva rige desde
      `GREATEST(hoy, start_date)`: sin eso, una regla que empieza en el futuro y se edita antes de
      arrancar resucita su cronograma viejo el día de inicio. Incluye el `BEFORE INSERT` que deriva
      `reconstruct_from`, sin el cual la expansión rompía el alta de recurrencias.
- [x] 1.2e Instalar el **trigger de compatibilidad** para clientes nativos viejos (decisión 17):
      `BEFORE INSERT OR UPDATE` que deriva `due_date` de `scheduled_date` y pone
      `resolution_kind = 'created'` al confirmar, cuando no vienen provistos.
- [x] 1.3 **NO** eliminar todavía `recurrence_instances_one_pending_per_rule`: va al final (tarea
      2.8), con todos los reads ya aceptando colecciones. Sacarlo antes dejaría a la base acumulando
      backlog mientras la app sigue mostrando una sola ocurrencia — invisible, y peor que hoy.
- [ ] 1.4 `confirmRecurrenceInstance` deja de escribir `scheduled_date`. `due_date` es inmutable; la
      fecha de pago vive en `transactions.date`, la de carga en `transactions.created_at` y la de
      resolución en `resolved_at`. `scheduled_date` queda como **columna legada de compatibilidad**,
      no como alias: un cliente viejo la pisa con la fecha de pago al confirmar, y en las históricas
      `due_date` es `NULL` mientras ella guarda un valor que no es vencimiento. El código nuevo no la
      lee ni como vencimiento ni como fecha de pago; el trigger solo la refleja al insertar.
- [x] 1.4b Agregar `resolution_kind` (`created` | `linked`) y `linked_conversion`, poblar
      `resolution_kind = 'created'` en las confirmadas, y **agregar sus constraints en esta misma
      migración, después del trigger**: el trigger completa el campo antes de que el `CHECK` corra,
      así que no hay incompatibilidad con clientes viejos. `skipped` lleva `NULL`.
- [x] 1.4d `due_date_is_unknown` (decisión 23): `pending` y `skipped` exactas; **todas** las
      `confirmed` anteriores a la migración con `due_date NULL` y la marca en true. Sin inferencias
      —caer en el cronograma no prueba exactitud— y **sin ocupar identidad**: una fecha dudosa
      guardada bloquearía el vencimiento verdadero e reproduciría el #96. Índice parcial
      (`WHERE due_date IS NOT NULL`), colisiones solo entre exactas, y `CHECK` que mantiene
      `(due_date is null) = due_date_is_unknown`.
- [x] 1.4e **Inmutabilidad de la identidad** por trigger: un `CHECK` valida el estado final y no la
      transición, así que dejaba mover o borrar una identidad exacta por `UPDATE`. Permitidas solo:
      exacta→igual, desconocida→desconocida, desconocida→exacta (una vez). El flag se deriva en el
      trigger. Tests: mover una exacta rechaza · convertirla en desconocida rechaza · corregir una
      desconocida funciona y no se puede repetir · un cliente viejo confirma sin tocar `due_date`.
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
- [ ] 1.9 **`scheduled_date` NO se elimina en esta entrega** (decisión 17): se sigue escribiendo en
      paralelo como columna legada de compatibilidad. Su retiro es una entrega posterior, cuando
      no queden clientes nativos instalados que lo usen.
- [ ] 1.12 Tests de migración con el **caso exacto del #96** (regla cada 3 días, cursor 2026-06-10,
      pendiente del 13/06, hoy 2026-09-08): `reconstruct_from` queda en el cursor y las ocurrencias a
      reconstruir son 29 — julio 11, agosto 10, septiembre 3 — con la del 13/06 deduplicada. Y un
      test con una regla cuya frecuencia fue editada, que no debe producir fechas anteriores a
      `effective_from`. Y los tres casos de regla directa: sin cursor con inicio hoy (genera hoy),
      sin cursor con inicio vencido (incluye `start_date`), y nacida de un movimiento (no repite la
      semilla). Y el de identidad: regla mensual del día 10 con agosto confirmado el 10/09 — el
      vencimiento exacto del 10/09 se materializa igual.
- [ ] 1.12b Regresión de la transición, hoy verificada a mano y sin exigir por ninguna tarea:
      **(a)** editar una regla que empieza en el futuro **antes** de que arranque deja una sola
      versión de cronograma — la anterior no resucita el día de inicio; **(b)** bajo el rol
      `authenticated`, `INSERT`/`UPDATE`/`DELETE` sobre `recurrence_schedule_versions` y
      `recurrence_pauses` no alteran nada, mientras `SELECT` sigue funcionando y crear, editar,
      pausar y reanudar una regla siguen manteniendo ambas tablas.
- [x] 1.10 Reescribir el caminante para **posicionarse en el borde del horizonte por aritmética de
      fechas**, sin recorrer desde `start_date` (decisión 19). Medido: una regla diaria de hace tres
      años agota los 750 pasos el `2024-09-26`, **347 días antes** del horizonte, sin llegar nunca a
      hoy. Test de regresión con ese caso exacto. El cap queda como red de seguridad.
      `occurrenceAt(schedule, n)` es forma cerrada y equivale a caminar porque el clamping se ancla
      en `start_date` y no acumula deriva; `occurrenceIndexAt` estima la posición y corrige en un
      paso acotado.
- [ ] 1.10b **A decidir antes del generador:** el caminante ancla las ocurrencias en `start_date`,
      mientras `decideRecurrenceInstance` hace hoy `addInterval(cursor, …)`. Coinciden mientras el
      cursor caiga sobre el cronograma —el caso normal—, y divergen por unos días cuando no.
      Anclar en el calendario es lo correcto (no depende de cuándo se resolvió la última ocurrencia),
      pero hay que confirmar que ninguna regla de producción tenga hoy el cursor fuera de cronograma
      antes de cambiar la semántica. Documentado en `walk-positioning.test.ts`.
- [ ] 1.11 Regenerar los tipos de Supabase y actualizar `supabase/validate_schema.sql` (una tabla
      modificada, dos nuevas).

## 2. El backlog existe y se puede resolver

- [ ] 2.1 `generateDueRecurrenceInstances` materializa las ocurrencias vencidas dentro del horizonte
      de **12 meses inclusive**, calculado con `getTodayAR()` (nunca `current_date`: Supabase corre en
      UTC), en orden de calendario y **por tandas acotadas** — abrir una pantalla no dispara cientos
      de escrituras; la tanda se completa en sucesivas aperturas y **la ocurrencia vigente entra
      siempre en la primera**. El horizonte limita solo la reconstrucción automática: registrar a
      mano un pago más viejo sigue siendo posible.
- [ ] 2.1e Tanda operativa (decisión 20): **50 ocurrencias por corrida**, **un solo `insert` en
      lote** —hoy el generador inserta de a una dentro de un `for`— y la ocurrencia vigente siempre en
      la primera corrida. Mientras queden, indicarlo en pantalla **y ofrecer "Continuar
      reconstrucción"**, que procesa otra tanda sin cerrar la app: una regla diaria son ~8 tandas y
      nadie va a abrir y cerrar la app ocho veces para ver su propio historial.
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
      dejar sin resolver). **Atómica de verdad** (decisión 22): RPC de Postgres `SECURITY INVOKER`,
      no orquestador con rollback compensatorio — la compensación también puede fallar y deja
      movimientos creados con ocurrencias sin resolver.
- [ ] 2.4b Acción separada "Usar este importe de acá en más", aplicada una sola vez y tomando el
      importe de la ocurrencia más reciente del grupo.
- [ ] 2.5 Resumen previo a aplicar: movimientos que se van a crear y efecto sobre el saldo de cada
      cuenta involucrada.
- [ ] 2.6 Copy: **"vencimientos por revisar"** — ni "pagos" (afirmaría que hubo pago) ni lenguaje de
      deuda. Actualizar `es.json` y `en.json`.
- [ ] 2.8 **Migración B · activación**, en archivo aparte
      (`00XY_recurrence_backlog_activate.sql`), y solo con los reads del paso 2.2 ya desplegados en
      web y nativo: eliminar `recurrence_instances_one_pending_per_rule`. Desde acá existe el
      backlog. Las constraints de `resolution_kind` ya entraron en la expansión (tarea 1.4b).
- [ ] 2.8b **Requisito para activar**, no una mejora: un usuario que solo conserve el cliente viejo
      nunca ejecuta el generador nuevo, así que su atraso no se materializa y el #96 sigue vivo para
      él. Hace falta **una de dos**: gate de versión mínima al arrancar la app nativa, o generación
      del lado del servidor (etapa 2 de la decisión 8), que además cubre a quien no abre la app.
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
- [ ] 3.3b Vinculación en reglas **compartidas**, tres casos: reparto compatible → directo; movimiento
      personal → explicar la conversión, pedir confirmación y marcar `linked_conversion`; movimiento
      con **otro hogar u otro reparto** → **excluir de los candidatos**, para no reemplazar una deuda
      que el otro miembro ya ve. Conversión + vinculación en una **sola RPC transaccional**. Test: la deuda del hogar queda igual que registrando desde la
      recurrencia, y un fallo no deja el movimiento convertido a medias.
- [ ] 3.4 Deshacer, **cerrando #104 en esta misma entrega**: devuelve la ocurrencia a *sin resolver*
      (nunca a omitida) y actúa según cómo se resolvió — `created` elimina el movimiento; `linked` lo
      conserva y desvincula; `linked` que además había **convertido** el movimiento a compartido
      revierte también la conversión y la deuda, en una **sola RPC transaccional**. Con `one_pending_per_rule` eliminado desaparece la restricción que
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
- [ ] 5.4 Dejar anotado para la **migración C** (fuera de esta entrega): al retirar `scheduled_date`,
      **no** eliminar `trg_recurrence_instance_compat` entero. Contiene la inmutabilidad de
      `due_date`, que es permanente; borrarlo reabre el agujero. Quitar solo las ramas de
      compatibilidad, o reemplazarlo por un guard con nombre propio.
- [ ] 5.5 Cerrar **#96** y **#104** con esta entrega. **#118** queda abierto: es independiente.
