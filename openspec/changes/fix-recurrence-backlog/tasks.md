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
- [x] 1.4 `confirmRecurrenceInstance` deja de escribir `scheduled_date`. `due_date` es inmutable; la
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
- [x] 1.4c Quitar de `confirmRecurrenceInstance` la propagación del importe a la regla
      (`mutations.ts:446`): con resolución en bloque el resultado dependería del orden.
- [ ] 1.5 Quitar de `confirmRecurrenceInstance` y `skipRecurrenceInstance` la escritura de
      `last_generated_date` (`mutations.ts:443` y `:500`). Conservar la columna durante la
      transición; deja de ser fuente de verdad del generador.
- [ ] 1.6 `decideRecurrenceInstance` pierde el parámetro `hasPending` y pasa a devolver la **lista**
      de ocurrencias faltantes, derivada de `walkOccurrences` y del conjunto de `due_date` ya
      existentes.
- [ ] 1.7 Unificar `max_occurrences`: el generador cuenta contra el cronograma, no filas de
      `recurrence_instances`. **Hecho para las reglas alineadas; abierto hasta la auditoría de fase**
      (ver 1.10b). Medida la divergencia antes de tocar nada: con una regla creada desde movimiento y
      tope 3, el generador producía **4** ocurrencias (semilla + 3 filas) y la proyección **3**, y la
      sobrante —`2026-08-01`— aparecía como pendiente en una fecha que la proyección nunca había
      anunciado. La causa es que una ocurrencia puede existir sin fila: el movimiento semilla cubre
      `start_date` y no materializa instancia. El tope pasa a ser el **ordinal de `nextDate` sobre el
      calendario** (`occurrenceOrdinal`), que no depende de lo resuelto, de lo que escriba un cliente
      ni de que se borren filas.
      **Lo que queda abierto:** una fecha fuera del cronograma NO tiene ordinal. `occurrenceOrdinal`
      devuelve `null` en ese caso —antes devolvía el de la próxima fecha válida, que es OTRA
      ocurrencia, y con eso el tope descartaba un vencimiento que la regla sí tenía—. **Ninguna forma
      de regla es inmune**, así que el criterio es la fecha concreta y nunca la unidad ni el
      intervalo. Dos mecanismos independientes la sacan del cronograma: **(1) la fase** —`anchorDate`
      restaura el día del mes, no la fase de meses ni de años: cada 2 meses desde el `2026-01-01` con
      cursor `2026-02-10` da `2026-04-01` contra un cronograma `01/01, 01/03, 01/05…`, y una regla
      anual cuyo cursor cayó en otro mes se desfasa igual—; y **(2) el inicio movido** —`updateRecurrence`
      mueve `start_date` sin tocar el cursor, así que el cursor queda ANTES del inicio: con inicio
      nuevo `2026-06-15` y cursor `2026-01-10` la próxima es `2026-02-15`, anterior a la regla misma.
      Esto alcanza incluso a una regla mensual o diaria de intervalo 1, que por fase no se desfasarían
      nunca. Mientras la fase sea desconocida, esas reglas **conservan el conteo de filas que usan
      hoy**, así que el cambio no las toca. Regresiones fijadas: cada 3 días con cursor `2026-06-10`,
      cada 2 meses, anual desfasada, y `cursor < start_date` en mes y en día. La auditoría
      (`docs/qa/auditoria-fase-cursor.sql`) devuelve `con_tope_sin_ordinal` —reglas con tope cuya
      próxima fecha de hoy no pertenece al cronograma, **sin filtrar por unidad**—: si da 0, el
      ordinal queda como número único y el fallback se retira del generador; si da ≥1, primero hay que
      persistir la fase de esas reglas o dejar escrita una compatibilidad explícita. El generador ya no
      trae todas las instancias para el tope: pide las `pending` y, solo si hay reglas **con tope**,
      sus filas.
- [ ] 1.8 Tests de resolución fuera de orden: resolver agosto y después julio no regenera agosto, no
      saltea junio, y no mueve el cronograma.
- [ ] 1.9 **`scheduled_date` NO se elimina en esta entrega** (decisión 17): se sigue escribiendo en
      paralelo como columna legada de compatibilidad. Su retiro es una entrega posterior, cuando
      no queden clientes nativos instalados que lo usen.
- [x] 1.12 Tests de migración con el **caso exacto del #96** (regla cada 3 días, cursor 2026-06-10,
      pendiente del 13/06, hoy 2026-09-08): `reconstruct_from` queda en el cursor y las ocurrencias a
      reconstruir son 29 — julio 11, agosto 10, septiembre 3 — con la del 13/06 deduplicada. Y un
      test con una regla cuya frecuencia fue editada, que no debe producir fechas anteriores a
      `effective_from`. Y los tres casos de regla directa: sin cursor con inicio hoy (genera hoy),
      sin cursor con inicio vencido (incluye `start_date`), y nacida de un movimiento (no repite la
      semilla). Y el de identidad: regla mensual del día 10 con agosto confirmado el 10/09 — el
      vencimiento exacto del 10/09 se materializa igual.
      Hecho en `packages/recurrences/__tests__/migration-0064-backfill.test.ts` (11 casos): cada uno
      siembra el estado **pre-migración**, aplica `0064` y afirma primero lo que la migración deja
      (`reconstruct_from`, `due_date`, la versión asumida) y después lo que el caminante debe producir
      desde ahí. Los conteos del #96 verificados: **30 ocurrencias del caminante** —junio 6, julio 11,
      agosto 10, septiembre 3— y **29 nuevas** tras deduplicar la pendiente del 13/06. Ojo con leer
      "julio 11, agosto 10, septiembre 3" como fechas: son **conteos por mes**. Fechas fijas, nunca
      `today`, salvo la rama de pausadas que sí lee el reloj. **Probados en negativo**: copiar
      `scheduled_date` a `due_date` en las confirmadas (el diseño descartado) hace fallar los dos de
      identidad —incluido el que reproduce el #96 por el otro camino—; `reconstruct_from = start_date`
      en vez de `start_date - 1` hace fallar los dos de regla directa sin cursor; y anclar el piso en
      `start_date` en vez del cursor hace fallar seis.
- [x] 1.12b Regresión de la transición, hoy verificada a mano y sin exigir por ninguna tarea:
      **(a)** editar una regla que empieza en el futuro **antes** de que arranque deja una sola
      versión de cronograma — la anterior no resucita el día de inicio; **(b)** bajo el rol
      `authenticated`, `INSERT`/`UPDATE`/`DELETE` sobre `recurrence_schedule_versions` y
      `recurrence_pauses` no alteran nada, mientras `SELECT` sigue funcionando y crear, editar,
      pausar y reanudar una regla siguen manteniendo ambas tablas.
      Hecho en `packages/recurrences/__tests__/migration-0064-transition.test.ts` (9 casos, todos bajo
      `authenticated`). **(a)** tiene dos caminos distintos y el primer test que escribí solo cubría
      uno: editar la frecuencia sin mover `start_date` cae en el MISMO `effective_from` y lo resuelve
      el `on conflict do update`, así que el `delete` de versiones no vigentes nunca entraba en juego
      —el test pasaba con y sin él—. El caso que sí lo ejercita es **traer el inicio hacia atrás**:
      ahí la edición aterriza en otro `effective_from` y, sin el `delete`, quedan dos versiones y la
      futura resucita el cronograma viejo el día de arranque. Ambos caminos quedaron cubiertos, y el
      segundo afirma la **ausencia** de la versión futura en vez de compararse contra `today`, para
      que no se pudra. Los tres casos de (a) crean **su propia regla futura**, por el mismo motivo que
      los de (b). **(b)** el `SELECT` autenticado se afirma sobre **las dos** tablas y desde los dos
      lados —el dueño lee su historial, y otro usuario no ve nada—, con la regla pausada antes para
      que haya un intervalo que leer: contra una tabla vacía esa mitad pasaba sola. `INSERT` sobre
      cualquiera de las dos tablas devuelve `42501`;
      `UPDATE`/`DELETE` **no levantan error** —RLS filtra las filas y no hay ninguna visible—, así que
      se afirma sobre los datos y no sobre una excepción; y crear, editar, pausar y reanudar siguen
      manteniendo ambas tablas por encima de RLS. `UPDATE`/`DELETE` se prueban sobre **las dos**
      tablas: cubrir solo `recurrence_schedule_versions` dejaba pasar una policy de escritura puesta
      únicamente sobre `recurrence_pauses`. Para que el intento signifique algo tiene que existir un
      intervalo, y solo la base puede crearlo, así que el caso lo abre y lo cierra a través de la
      regla, que es la única puerta que tiene el usuario. Cada caso de ese bloque **crea su propia
      regla**: como pausan, reanudan y editan, compartir una sola hacía que cada aserción dependiera
      de lo que hubiera dejado la anterior —un conteo que solo vale en orden de archivo no prueba
      nada—. Verificado corriendo los seis en aislamiento. **Probados en negativo**: quitar el
      `delete` hace fallar el caso del inicio movido; una policy de escritura sobre el historial hace
      fallar tres; una policy solo sobre `recurrence_pauses` hace fallar el de `UPDATE`/`DELETE`;
      quitar la policy de `SELECT` de `recurrence_pauses` hace fallar el de lectura; y dejarla en
      `using (true)` hace fallar el de aislamiento entre usuarios. Los diez casos verificados también
      en aislamiento, uno por uno.
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
      antes de cambiar la semántica. Documentado en `walk-positioning.test.ts`. **Ninguna forma de
      regla es inmune**: `anchorDate` restaura el día del mes, no la fase de meses ni de años, y mover
      `start_date` sin tocar el cursor lo deja antes del inicio, lo que desfasa hasta una regla
      mensual o diaria de intervalo 1. La misma auditoría decide 1.7.
- [x] 1.0 **Sincronizar con `main`** antes de seguir: la branch quedó 12 commits atrás y
      redescubrió un defecto que **#114** ya había arreglado (los tests de `packages/` no corrían;
      ahora `pnpm -r test`). Colisión de migraciones resuelta: `main` ocupó `0061`–`0063`, así que la
      expansión pasa a **`0064_recurrence_identity_expand.sql`** y la activación tomará **el próximo número libre contra `main` al crearla**, no uno reservado ahora. Los tests
      nuevos viven en su paquete (`packages/recurrences/__tests__`), no en `apps/web`, y los alias
      que había agregado a `apps/web/vitest.config.ts` se revirtieron. Verificado: `pnpm test`
      (448 en `packages/` + los de web, sin fallas), esquema reconstruido en el orden real con las
      64 migraciones, y el delta revalidado contra la maestra — **#111** tocó recurrencias pero solo
      el requirement de duplicados, que este delta no modifica; los cinco que sí modifica están
      intactos.
- [x] 1.11 Regenerar los tipos de Supabase y actualizar `supabase/validate_schema.sql` (una tabla
      modificada, dos nuevas). El CLI de Supabase necesita Docker, que no hay en el entorno, así que
      los tipos se escribieron con la forma exacta del generador —orden alfabético, `Row`/`Insert`/
      `Update`/`Relationships`, opcionalidad derivada de `is_nullable` + `column_default`— y se
      validaron con `pnpm typecheck`. **Eso destapó un defecto de la migración**: `reconstruct_from`
      era `NOT NULL` sin default, así que el generador la marca REQUERIDA en `Insert` y obligaba a
      cada cliente a mandar un valor que la base es la dueña de calcular —incluidos los clientes
      viejos, que no pueden—. `createRecurrenceFromMovement` dejó de compilar. Corregido en `0064`:
      la columna lleva `DEFAULT 'infinity'::date` —un placeholder que **falla cerrado**: si el
      trigger desapareciera, el generador no materializa nada en vez de reconstruir toda la historia
      de la regla— y el trigger pasa a derivarla **incondicionalmente**, no solo cuando llega `NULL`,
      porque la base es la dueña única de la columna igual que del historial de cronogramas.
      Verificado contra el esquema reconstruido: las tres derivaciones (`start_date - 1`, cursor, hoy
      para pausadas) siguen dando lo mismo, y un cliente que manda un valor no lo impone.
      `validate_schema.sql` suma la sección **8.1J**, con las cuatro columnas nuevas, las dos tablas,
      los cinco índices, las FK compuestas, los tres triggers, `SECURITY DEFINER` + `search_path` en
      las dos funciones escritoras, la ausencia de policies de escritura sobre el historial, el
      default y el placeholder de `reconstruct_from`, los invariantes de datos, y —clave en una
      expansión— que `recurrence_instances_one_pending_per_rule` **siga vivo**. Cada aserción se
      probó también en negativo: rompiendo el objeto, la sección falla con su mensaje.
      **Segundo defecto, más grave, encontrado en la revisión:** el trigger corría solo
      `BEFORE INSERT`, y `recurrences` tiene policy de UPDATE del usuario desde `0011`, así que
      cualquier cliente autenticado podía escribir `reconstruct_from` — moverlo hacia atrás
      **fabrica meses de atraso de la nada**, y hacia adelante **oculta ocurrencias que el usuario sí
      tiene**; ninguna de las dos se ve en la UI. Ahora es `BEFORE INSERT OR UPDATE`: en INSERT
      deriva, en UPDATE rechaza cualquier cambio con `SQLSTATE 23514`. No es una policy de RLS porque
      RLS da o niega la fila entera y el usuario sí edita importe, descripción y estado en el mismo
      UPDATE: congelar UNA columna es trabajo de trigger. Se renombró a
      `trg_recurrence_reconstruct_from_guard` —la coda de esta misma migración advierte contra
      nombres que esconden una regla permanente— y una migración futura que necesite mover el piso
      puede `disable trigger` alrededor de la escritura, que es deliberado y auditable. Regresión
      persistente en `packages/recurrences/__tests__/reconstruct-from-guard.test.ts`, 10 casos sobre
      PGlite. **Ocho corren bajo el rol `authenticated`** —los seis de UPDATE (el update legítimo
      sigue andando; los cuatro ataques, atrás, adelante, `±infinity` y colado dentro de un update
      legítimo, se rechazan; reescribir el mismo valor es no-op; pausar no mueve el piso) más los dos
      de INSERT donde el que escribe importa: un cliente que manda un valor no lo impone, y el
      placeholder no sobrevive—. **Los dos restantes siembran como superusuario a propósito**: lo que
      afirman es la derivación en sí (`start_date - 1` y el cursor), que no depende de quién escribe.
      `validate_schema.sql` ahora comprueba **tabla, función y eventos** de cada trigger y las
      **columnas exactas de las dos FK compuestas**, no solo que exista algo con ese nombre: probado
      en negativo devolviendo el guard a solo-INSERT, invirtiendo las columnas de una FK y apuntando
      un trigger a otra función. Comprueba además **timing y nivel** (`BEFORE ROW` para los dos que
      escriben `NEW`, `AFTER ROW` para el sync del historial): un guard movido a `AFTER` conserva sus
      eventos y pasaría un chequeo que solo los mire, pero ya no puede derivar `NEW.reconstruct_from`
      al insertar, y uno a nivel `STATEMENT` no tiene `NEW`/`OLD`. Los tres casos, probados en
      negativo. Comprueba también **`tgenabled`** y el **schema de la función**, los dos falsos verdes
      que quedaban: `ALTER TABLE … DISABLE TRIGGER` deja el nombre, la tabla, la función y los bits
      idénticos —medido: `tgtype` sigue en 23, solo `tgenabled` pasa de `O` a `D`— y el usuario
      vuelve a mover el piso a `2020-01-01` sin resistencia; y un trigger apuntado a una función
      homónima fuera de `public` pasaba igual. El primero importa especialmente porque esta misma
      migración documenta que una migración futura PUEDE desactivar el guard alrededor de una
      escritura deliberada: lo que `validate_schema` tiene que atrapar es que alguien se olvide de
      volver a activarlo. Los mensajes de 8.1J y la excepción del guard quedaron en inglés.
      El harness (`__tests__/support/recurrence-identity-db.ts`) vive en el paquete dueño, con
      `@electric-sql/pglite` como dependencia de desarrollo suya, y `packages/recurrences` estrena
      `vitest.config.ts` con `hookTimeout` alto **solo para el hook** —el `beforeAll` levanta Postgres
      WASM—, dejando `testTimeout` en su default de 5s: la base se arma en el hook, así que un cuerpo
      de test que tarda es un cuelgue y no hay que darle cuerda. El `testTimeout` global que había
      subido en `apps/web` quedó revertido: mover el test fuera de `apps/web` saca la contención que
      yo mismo había agregado, así que la justificación desapareció con la causa.

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
      (`<próximo libre>_recurrence_backlog_activate.sql`, número elegido contra `main` al crearla),
      y solo con los reads del paso 2.2 ya desplegados en
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
