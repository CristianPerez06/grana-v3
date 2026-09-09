# Tasks: fix-recurrence-backlog

La 1 son cimientos y no tiene nada visible: existe porque sin ella la 2 fabrica duplicados. Las
etapas 2 y 4 entregan los **seis comportamientos** de `proposal.md`, y la 4b los activa. Esta entrega
cierra **#96** y **#118**; el **#104** salió del alcance y va en `recurrence-undo`.

> **El alcance se recortó** (aprobado el 2026-09-09). Quedó adentro lo estrictamente necesario para
> cerrar el #96 con una experiencia usable; salieron pago anticipado, vinculación, resolución en
> bloque, deshacer (#104), historial enriquecido y la UX avanzada, listados en la **etapa 3**. El
> motivo es de tamaño: la branch llevaba 51 commits y más de seis mil líneas sin producir todavía
> ningún cambio visible.

## Orden — no es una sugerencia

Este es el orden en que las cosas se **aplican sobre datos reales**. Escribir y probar el código
contra el harness local no depende de él.

| # | Paso | Tareas |
|---|---|---|
| 1 | Migración de **expansión** (`0064`): identidad, piso, versiones, pausas, guardas | 1.1–1.4e, 1.11 |
| 2 | Generador que materializa la lista, en tandas continuables, leyendo versiones y pausas | 2.1, 2.1e, 2.1d, 2.1b, 1.6 |
| 3 | Reads que dejan de asumir una pendiente por regla | 2.2 |
| 4 | Dashboard, "próximo", proyección y deshacer leen los vencimientos existentes | 2.2b |
| 5 | Dejar de escribir `last_generated_date` + test real de orden | 1.5, 1.8 |
| 6 | Superficies: materialización y bloque "por revisar" en web y nativo, copy, error visible | 4.1–4.5b, 2.6 |
| 7 | **Gate de versión mínima** en el cliente nativo | 2.8b |
| 8 | Migración de **activación**: retira el índice de pendiente única | 2.8 |

Los pasos 1 y 2 comparten **una sola ventana de producción**: la verificación transaccional de `0064`
(§4b) corre una única vez, y una edición hecha entre ambos despliegues podría desfasar el dato después
de verificarlo y antes de que exista el anclaje que lo vuelve inofensivo.

El paso 8 va **último**, y no antes: el índice es lo único que hoy impide el estado intermedio en que
la base admite varias pendientes y el software todavía muestra una sola o duplica importes — el mismo
estado que la cabecera de `0064` describe como peor que el bug actual.

## División en PRs — cuatro revisiones, tres despliegues

La branch acumuló 51 commits y más de seis mil líneas: eso no se revisa de una sola vez. Se parte en
cuatro PRs encadenados. **No son cuatro proyectos**: son cuatro unidades de revisión sobre las tres
ventanas de despliegue de la tabla de arriba. Nada está mergeado a `main`, así que la división es
mecánica: `git checkout -b` desde `main` y cherry-pick por área.

| PR | Qué lleva | Despliegue |
|---|---|---|
| **1 — Aditivo** *(~1.000 líneas)* | `owedOccurrences` y sus tests, los tests de resolución fuera de orden, y toda la documentación. La única función nueva **no tiene callers**, y por eso "no cambia comportamiento" es verificable | Ventana A |
| **2 — Modelo persistente** *(~1.900 líneas)* | `0064`, los tipos, `8.1J`, el harness PGlite y las regresiones de migración, transición y guarda de fase. Deja vivo el índice de pendiente única | **Ventana B** |
| **3 — Núcleo** *(~700 líneas)* | Lo que sí cambia lo que el usuario ve: caminante sin el techo de 750 pasos, `max_occurrences` por ordinal, próxima fecha anclada en el calendario, y se retira `materializedCount` | **Ventana B** |
| **4 — El arreglo visible** *(a escribir)* | Etapas 2, 4 y 4b, en el orden de la tabla. Termina en la prueba de aceptación | Ventana C |

**Los PR 2 y 3 se revisan aparte pero se despliegan juntos.** La guarda §4b de `0064` corre una sola
vez: si alguien edita una recurrencia entre ambos despliegues, el dato puede volver a desfasarse
después de la verificación y antes de que exista el anclaje en el calendario que lo vuelve
inofensivo, y en esa ventana nada lo detecta. Dentro de la ventana, `0064` va primero: **la guarda va
antes de lo que guarda**.

**El PR 4 no se parte antes de la activación.** Si por tamaño hubiera que partirlo igual, la
activación queda en la última parte, después del gate de versión y de que todas las superficies
soporten varias pendientes.

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
- [x] 1.5 Quitar de `confirmRecurrenceInstance` y `skipRecurrenceInstance` la escritura de
      `last_generated_date`. Conservar la columna durante la transición; deja de ser fuente de verdad.
      **Hecho.** Las dos resoluciones ya no escriben la regla. El bloqueo que tenía esta tarea —cinco
      lectores dependían del cursor— se levantó en los pasos 2 a 4: el generador deriva lo adeudado del
      calendario menos lo que existe, y el dashboard, el «próximo», la proyección y el deshacer leen
      esas mismas ocurrencias.
      **Las dos escrituras que QUEDAN son de creación y no son cursores.** `createRecurrence` escribe
      null y `acceptRecurrenceSuggestion` escribe `start_date`; al insertar, el trigger de `0064`
      deriva de ahí el piso `reconstruct_from` —null ⇒ `start_date - 1`—, así que son lo que declara
      desde dónde la regla empieza a deber. Retirarlas haría que una sugerencia aceptada materializara
      una ocurrencia para el movimiento que le dio origen. Quedó escrito en el código, porque el
      próximo que lea «sacamos las escrituras del cursor» va a querer sacar estas también.
      Corregidos además tres comentarios que habían quedado enfrentados al código: el de
      `createRecurrence` citaba `decideRecurrenceInstance`, el de `pauseRecurrence` decía que la
      próxima generación «se computa desde `last_generated_date` como siempre», y el de
      `acceptRecurrenceSuggestion` no decía por qué esa fecha importa.
- [ ] 1.6 El generador deriva la **lista** de ocurrencias faltantes del calendario y del conjunto de
      `due_date` ya existentes, en lugar de pedir una fecha por vez.
      **Cableado y probado contra la base real.** `generateDueRecurrenceInstances` ya no llama a
      `decideRecurrenceInstance` ni lee `last_generated_date`: compone
      `owedOccurrencesForRule(versiones, pausas, piso, horizonte, hoy, existentes)` y materializa lo
      que devuelve. `owedOccurrences` sigue siendo el núcleo de **un** segmento;
      `owedOccurrencesForRule` compone los segmentos —uno por versión de cronograma, menos los
      intervalos de pausa— y es lo que cierra `2.1b` y `2.1d` del lado del cálculo.
      **`existing` son los vencimientos en CUALQUIER estado** —pendiente, omitido y confirmado—, no
      solo los resueltos: lo que decide es que la ocurrencia YA EXISTE, no cómo terminó. Una pendiente
      sin resolver no se vuelve a crear, y una omitida tampoco reaparece.
      **DECISIÓN TOMADA — cómo convive el generador múltiple con el índice todavía vivo.** Era la
      decisión abierta de `1.5`. Se eligió **(a) con degradación en runtime, no con bandera**:
      `insertReconstructedInstances` intenta **un solo insert en lote**; si la base lo rechaza
      —`recurrence_instances_one_pending_per_rule` todavía existe y una violación rechaza la sentencia
      entera— reintenta por regla, y si eso también falla inserta **solo la ocurrencia vigente**, que
      es la que no puede faltar. Ventajas sobre las otras dos opciones: no hay bandera que acordarse
      de dar vuelta, no depende de que PostgREST pueda apuntar a un índice parcial como destino de
      `on conflict` (no puede), y después de la activación los dos fallbacks dejan de dispararse solos
      —la ruta sana vuelve a ser un insert por corrida— sin desplegar nada. Está probada **con el
      índice puesto**, que es el estado real de la ventana: `generator-backlog.test.ts`, 11 casos
      sobre PGlite con `0064` aplicado.
      **Corregido — la degradación tapaba fallos reales.** La primera versión reintentaba ante
      *cualquier* error de inserción, de modo que un permiso, un CHECK del payload o una caída de red
      se trataban como «compatibilidad, seguí», y si algún insert posterior salía bien la corrida
      devolvía `error: null`. Ahora se distinguen tres casos por SQLSTATE y nombre de índice:
      **(1)** violación de `recurrence_instances_one_pending_per_rule` → es el estado de transición,
      degrada; **(2)** violación de `recurrence_instances_one_per_rule_due_date` → otra corrida creó
      esa ocurrencia primero (dos generadores en paralelo): no es error ni es nuestra, se saltea;
      **(3)** cualquier otra cosa → **se reporta**, aunque otras reglas hayan entrado. El lote fallado
      no escribe nada por ser una sola sentencia, así que el reintento por regla siempre es seguro y
      una regla rota deja de bloquear a las sanas. Regresiones: una regla que falla mientras otra
      entra, y dos generadores concurrentes.
      **Lo que queda de `1.6`:** borrar `decideRecurrenceInstance`, `RuleForDecision` y
      `GenerationDecision`, hoy sin ningún caller de producción, reescribiendo contra el caminante los
      casos de `max-occurrences.test.ts`, `custom-frequency.test.ts` y `generator.test.ts` que todavía
      los usan. Quedó marcado en el propio código.
- [x] 1.7 Unificar `max_occurrences`: el tope se cuenta contra el cronograma, no contra filas de
      `recurrence_instances`.
      **El defecto, medido antes de tocar nada:** con una regla creada desde un movimiento y tope 3,
      el generador producía **4** ocurrencias (la semilla más 3 filas) y la proyección **3**, y la
      sobrante —`2026-08-01`— aparecía como pendiente en una fecha que la proyección nunca había
      anunciado. La causa es que una ocurrencia puede existir **sin fila**: el movimiento semilla
      cubre `start_date` y no materializa instancia, así que el conteo de filas llegaba a 3 recién
      después de tres ocurrencias *más*.
      **El arreglo:** el tope es el **ordinal de `nextDate` sobre el calendario** (`occurrenceOrdinal`,
      que cuenta `start_date` como la 1ª). No depende de lo que el usuario resolvió, de lo que escriba
      un cliente, ni de que se borren filas. Fijado en `packages/money-logic/__tests__/max-occurrences.test.ts`,
      incluido el caso de que borrar instancias ya no le regala ocurrencias a la regla.
      **Por qué tuvo que esperar a 1.10b, y por qué ya no.** Una fecha fuera del cronograma no tiene
      ordinal, y `occurrenceOrdinal` devuelve `null` —antes devolvía el de la próxima fecha válida,
      que es OTRA ocurrencia, y con eso el tope descartaba un vencimiento que la regla sí tenía—.
      Mientras `nextDate` salía de `addInterval(cursor, …)` ese caso era alcanzable, así que esas
      reglas conservaban el conteo de filas como compatibilidad explícita. Al anclar la decisión en el
      calendario (1.10b), **`nextDate` pasa a ser una ocurrencia por construcción**: siempre tiene
      ordinal y el fallback quedó inalcanzable, no solo innecesario. Se eliminaron el parámetro
      `materializedCount`, la consulta que lo alimentaba y todas sus llamadas. La auditoría lo
      confirma por el otro lado: `con_tope_sin_ordinal = 0` en producción, así que tampoco había hoy
      ninguna regla que dependiera de él.

- [x] 1.8 Tests de resolución fuera de orden: resolver agosto y después julio no regenera agosto, no
      saltea junio, y no mueve el cronograma.
      **Núcleo puro:** `out-of-order-resolution.test.ts` (8 casos) fija la propiedad sobre
      `owedOccurrences` como secuencia con aserciones en cada paso, recorriendo **cuatro órdenes
      distintos**. Probado en negativo: con semántica de cursor fallan **7**.
      **Secuencia real, que era lo que faltaba:** `out-of-order-flow.test.ts`, sobre PGlite con `0064`
      aplicado y el índice de pendiente única retirado. Las ocurrencias las **materializa el
      generador**, se resuelven por las **mutaciones reales** y las recalcula el generador otra vez:
      **(1)** se materializan junio, julio y agosto; **(2)** se resuelve **agosto** primero; **(3)** se
      resuelve **julio** por `skipRecurrenceInstance`; **(4)** ninguna de las dos escribió el cursor;
      **(5)** al recorrer el generador agosto no reaparece, julio sigue omitido, junio sigue
      disponible, y en septiembre aparece el 23 — el calendario no se movió; **(6)** junio se resuelve
      al final, después de todo lo anterior.
      **Lo que falta por qué falta:** confirmar crea un movimiento real a través de
      `@grana/transactions-mutations`, que este harness no modela. El efecto de una confirmación sobre
      el modelo de recurrencias se aplica en la base, y que `confirmRecurrenceInstance` escriba
      exactamente eso **y nada en la regla** lo fija `confirm-writes.test.ts`, con una aserción nueva
      (`1.5`) enunciada como «ninguna escritura sobre la regla», no como «ningún campo cursor»: una
      escritura a nivel regla es la forma en que una resolución por ocurrencia se filtra a todas las
      demás, y el importe (`1.4c`) fue ese mismo defecto con otro nombre de columna.
      Contra el commit anterior fallan **3**: omitir julio dejaba el cursor en `2026-07-23` y omitir
      junio lo movía **hacia atrás** a `2026-06-23`, que es el mecanismo del #96 a la vista.
- [ ] 1.9 **`scheduled_date` NO se elimina en esta entrega** (decisión 17): se sigue escribiendo en
      paralelo como columna legada de compatibilidad. Su retiro es una entrega posterior, cuando
      no queden clientes nativos instalados que lo usen.
      **No es una tarea de código sino una condición permanente de toda la etapa**, y por eso queda
      abierta hasta que la entrega cierre: se verifica al final, comprobando que nada la haya violado
      en el camino. Cuenta igual en el inventario: tras cerrar `1.7` y `1.10b` con la auditoría, las
      abiertas de la etapa 1 son **cuatro** —`1.5`, `1.6`, `1.8` y esta—.
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
      Hecho en `packages/recurrences/__tests__/migration-0064-transition.test.ts` (10 casos, todos
      bajo `authenticated`). **(a)** tiene dos caminos distintos y el primer test que escribí solo cubría
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
- [x] 1.10b **Decidido con la auditoría de producción (2026-09-09): el caminante ancla en el
      calendario.** `decideRecurrenceInstance` ya no reanuda la cadencia desde el cursor con
      `addInterval(cursor, …)`; lee la primera ocurrencia estrictamente posterior al cursor sobre el
      cronograma de la regla.
      **El dato que lo autoriza**, sobre la base real: `reglas_totales = 61`, `fuera_de_cronograma = 0`,
      `con_proxima_distinta = 0`, `con_tope_sin_ordinal = 0`. Cero reglas con el cursor desalineado y
      cero que produzcan una fecha distinta de la del calendario ⇒ el cambio **no mueve ninguna fecha
      que el usuario esté viendo hoy**. Y es la definición que sigue siendo correcta mañana: el
      calendario no depende de CUÁNDO se resolvió la última ocurrencia, el cursor sí.
      La foto no se usa como garantía: `0064` §4b revalida el mismo invariante en su propia
      transacción y aborta si dejó de valer, así que las dos no pueden separarse en silencio.
      **Comportamiento nuevo para una regla que se desfase más adelante** (una edición de `start_date`
      todavía puede provocarlo): la fecha la da el calendario. Fijado en `max-occurrences.test.ts`,
      donde los cinco casos que antes pinneaban el comportamiento viejo ahora afirman el nuevo — cada
      2 meses da `2026-03-01` y no `2026-04-01`; la anual vuelve a su mes; la de 3 días vuelve a fase;
      y **un `start_date` movido hacia adelante deja de producir fechas ANTERIORES al inicio de la
      regla**, que era el peor de los casos. Documentado también en `walk-positioning.test.ts`.
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

- [x] 2.1 `generateDueRecurrenceInstances` materializa las ocurrencias vencidas dentro del horizonte
      de **12 meses inclusive**, calculado con `getTodayAR()` (nunca `current_date`: Supabase corre en
      UTC), en orden de calendario y **por tandas acotadas** — abrir una pantalla no dispara cientos
      de escrituras; la tanda se completa en sucesivas aperturas y **la ocurrencia vigente entra
      siempre en la primera**. El horizonte limita solo la reconstrucción automática: registrar a
      mano un pago más viejo sigue siendo posible.
      **Hecho.** El horizonte se calcula con `getTodayAR()` —`options.today` existe solo para fijar el
      día en una reconstrucción de varias corridas y en los tests— y la selección de la tanda vive en
      `selectReconstructionBatch`, aparte y probada como función pura.
      **Corregido — el horizonte fallaba el 29 de febrero.** Construido a mano con `new Date`, «el
      mismo día del año anterior» desde `2028-02-29` daba `2027-03-01`: JavaScript desborda en vez de
      recortar, y el 28 de febrero quedaba fuera de una ventana que el contrato declara inclusiva.
      Ahora usa `addInterval(hoy, 'month', -12)`, la misma aritmética del caminante, que recorta al
      último día válido. Regresión de año bisiesto en `reconstruction-batch.test.ts`.
      **Corregido — las cuatro lecturas se paginan hasta agotarlas.** PostgREST corta toda respuesta
      en su `db-max-rows` **en silencio**. Una lectura truncada de los vencimientos que ya existen no
      es un generador lento: es un generador que cree que faltan y los vuelve a crear. La paginación
      avanza por lo que efectivamente vino y **corta con una página vacía, nunca con una corta**: una
      página corta no significa el final, porque el tope del servidor puede ser menor que la ventana
      pedida. Además la lectura de instancias se acota con `gte(due_date, piso más viejo)`, que es lo
      máximo que se puede filtrar sin perder nada. El harness ahora simula `db-max-rows`, así que la
      regresión reproduce el corte real con 366 filas en vez de necesitar mil.
      **Corregido (2) — `OFFSET` sobre un orden no único también pierde filas.** Paginar hasta la
      página vacía no alcanza si el `ORDER BY` no distingue las filas: Postgres no promete cómo
      desempata, y entre dos pedidos puede devolver los empates en otro orden, repitiendo u omitiendo.
      Perder una **pausa** es fabricar un vencimiento de un período en que la regla no corría. Las
      cuatro lecturas ordenan ahora por columnas que identifican la fila: `id` en reglas,
      `(recurrence_id, effective_from)` en versiones —único por índice—, `(due_date, recurrence_id)`
      en instancias —único por índice— y `(recurrence_id, paused_from, id)` en pausas, donde el `id`
      hace falta de verdad: solo hay una pausa **abierta** por regla, nada impide dos cerradas el
      mismo día. El harness gana `unstableTies`, que agrega `random()` al orden: con un orden único no
      cambia nada, con uno parcial revuelve los empates, que es exactamente el permiso que Postgres
      se reserva. Regresión: 30 reglas con el mismo vencimiento y el corte de página cayendo dentro
      del empate.
- [x] 2.1e Tanda operativa (decisión 20): **50 ocurrencias por corrida**, **un solo `insert` en
      lote** —hoy el generador inserta de a una dentro de un `for`— y la ocurrencia vigente siempre en
      la primera corrida. Mientras queden, indicarlo en pantalla **y ofrecer "Continuar
      reconstrucción"**, que procesa otra tanda sin cerrar la app: una regla diaria son ~8 tandas y
      nadie va a abrir y cerrar la app ocho veces para ver su propio historial.
      **Hecho del lado del cálculo y de la escritura**, pendiente el botón: `GenerationResult` devuelve
      `created`, `remaining` y `error`, y las tres cruzan enteras hasta la acción de web y el mutator
      nativo.
      **Corregido — el tope de 50 ahora es un tope.** La primera versión dejaba pasar la ocurrencia
      vigente de cada regla «aunque eso pase el tope»; con las **61 reglas** que tiene producción, una
      tanda declarada de 50 habría escrito 61. El límite es duro, y lo que no entra queda en
      `remaining` para la corrida siguiente —la próxima pantalla que se abra, o el botón—.
      **Corregido (2) — ordenar solo por fecha dejaba reglas sin atender para siempre.** Con 61 reglas
      y tanda de 50, las 50 atendidas en la primera corrida vuelven a la segunda debiendo fechas **más
      viejas** que antes —su ocurrencia vigente era lo más nuevo que debían, y se acaba de escribir—,
      así que ganaban otra vez, y las 11 restantes no entraban nunca. Es el bloqueo del #96 entre
      reglas en vez de dentro de una. La selección ahora ordena en **tres niveles**: (1) reglas cuya
      ocurrencia vigente **todavía no existe** y que pueden recibirla —la más atrasada primero—;
      (2) las que tampoco la tienen pero ya cargan una pendiente sin resolver, que hasta la activación
      **no pueden** recibir otra: van después de las que sí se pueden escribir, y este nivel deja de
      existir solo cuando se retira el índice; (3) el resto del atraso, de la más vieja a la más
      nueva. Sin el nivel (2), una regla bloqueada por el índice se llevaba presupuesto corrida tras
      corrida con `created: 0` y `remaining > 0`. Regresiones: las 61 reglas quedan atendidas en dos
      corridas —contra la base real—, más tres casos puros de prioridad.
      Falta la superficie que muestra `remaining` y ofrece «Continuar reconstrucción» — es la etapa 4.
- [x] 2.1d Pausa: no materializar los vencimientos que caen durante la pausa ni recuperarlos al
      reanudar; al reanudar tomar el próximo vencimiento futuro con el calendario original. Test:
      regla del 23 pausada en junio y reanudada el 5/9 vuelve con el 23/9, sin junio, julio ni agosto.
      **Hecho.** El generador lee `recurrence_pauses` y resta cada intervalo `[paused_from, resumed_at)`
      de los segmentos. Lo anterior a la pausa **no** se toca, que es la razón por la que el piso no se
      mueve al pausar ni al reanudar. Casos en `owed-occurrences-for-rule.test.ts` (pausa cerrada,
      pausa abierta, varias pausas, y lo previo a la pausa que sobrevive) y en `generator-backlog.test.ts`.
- [x] 2.1b Vigencia de los cambios de cronograma: editar frecuencia/intervalo/día no reinterpreta
      ocurrencias anteriores a la fecha de vigencia. Test: una regla mensual con historial editada a
      quincenal no fabrica vencimientos viejos.
      **Hecho.** El generador lee `recurrence_schedule_versions` y camina cada tramo con el cronograma
      que rigió ahí, anclado en `anchor_date`. Un límite de versión es un corte duro: la mensual del 23
      deja de emitirse el día que entra la quincenal.
      **Corregido — el tope era por versión y `updateRecurrence` ya existe.** Lo había anotado como
      hueco a resolver "cuando exista la UI de edición"; la UI existe hoy en web y en nativo
      (`mutations.ts:618`), así que era un defecto vivo: una compra en 6 cuotas editada de mensual a
      quincenal producía **12**. `max_occurrences` pasa a contarse **una sola vez para la regla**, a
      lo largo de su línea de tiempo compuesta. Cuentan las ocurrencias que la regla produjo, aunque
      no se deban: las que ya existen, las que quedaron detrás del piso y las anteriores al horizonte.
      **No** cuentan las que cayeron dentro de una pausa, porque nunca existieron. Siete casos en
      `owed-occurrences-for-rule.test.ts`, cinco de los cuales fallan contra la versión anterior; dos
      fijan que el caso de una sola versión —el de toda regla en producción hoy— no cambió.
- [x] 2.2 Adaptar los reads que asumen una pendiente por regla:
      `getPendingInstancesByRecurrenceId` pasa de `Map<string, RecurrenceInstance>` a
      `Map<string, RecurrenceInstance[]>`, ordenadas de la más vieja a la más nueva —el orden en que
      se revisan—, y `RecurrenceSummary.pending_instance` pasa a `pending_instances: []`.
      **Lo que estaba mal no era el tipo, era lo que hacía:** el `Map` se llenaba con
      `set(recurrence_id, instance)` fila por fila, así que con varias pendientes **se quedaba con la
      última que llegara** y descartaba el resto en silencio. Con una sola por regla eso era inocuo;
      con el atraso materializado, la regla parece deber una cosa mientras debe cinco.
      **Los tres reads de instancias se paginan y ordenan de forma total**, por lo mismo que los del
      generador. Antes ninguno podía superar una página porque la base admitía una pendiente por
      regla; ahora el feed **es** la lista.
      **Ordenan por `scheduled_date`, que es la columna que las pantallas muestran**, con `id` —la
      PK— haciendo total el orden. Una primera versión ordenaba el historial por `due_date desc`, que
      suena más correcto y rompía la pantalla dos veces: `due_date` es **nulo** en toda ocurrencia
      resuelta antes de `0064` y Postgres pone los nulos **primero** en `DESC`, así que el historial
      abría con las filas más viejas ordenadas por poco más que su uuid; y en una resuelta las dos
      fechas divergen, así que una cuota de agosto pagada el 15/09 quedaba **debajo** de una de
      septiembre pagada el 10/09 — ordenado por una fecha, mostrado por otra. Mientras el historial
      enriquecido siga diferido (`recurrence-history`), el orden acompaña a lo que se ve; cuando la
      pantalla muestre el vencimiento, el orden se muda con ella.
      **Trece regresiones sobre la base real**, en dos archivos: `pending-instances-read.test.ts` (7,
      cinco fallan contra la versión anterior) e `instance-feeds-read.test.ts` (6), que cubren los
      **tres** reads: el feed global con más de una página y varias pendientes de la misma regla, y el
      detalle con confirmadas legacy de `due_date` nulo, confirmadas exactas y pendientes. Corren con
      el índice de pendiente única **retirado**, porque el estado que estos reads describen es el de
      después de la activación: con el índice puesto la fixture no podría tener dos pendientes.
      La fila legacy se construye como existe de verdad —insertada **antes** de `0064` y dejada en
      nulo por su backfill—: sembrarla después es imposible, porque el trigger de compatibilidad
      deriva `due_date` de `scheduled_date` y la guarda de inmutabilidad se niega a borrarlo.
      El harness aprendió a resolver `select` con recursos embebidos (`alias:tabla!fk(cols)`), que es
      lo que permitió ejercitar estos dos reads y no solo el que usa `select('*')`.
      **Sin consumidores rotos:** `pending_instance` no lo leía nadie fuera del paquete, así que el
      cambio de forma no arrastra UI. Mostrar varias en pantalla es la etapa 4.
- [x] 2.2b Migrar **dashboard, "próximo", proyección y deshacer** para que lean los vencimientos que
      ya existen —en **cualquier** estado: pendiente, omitido y confirmado— en vez del cursor.
      **Hecho, y con eso #118 queda cerrado.** El núcleo cambia de forma: `RuleForProjection` pierde
      `last_generated_date` y gana `covered: Iterable<string>`, y `getNextExpectedOccurrence` recibe
      ese conjunto en vez de un cursor. Sacar el campo del tipo fue deliberado: TypeScript enumeró
      las cinco superficies que había que migrar, en vez de dejarlas a la vista.
      **Las dos fuentes de cobertura, y la segunda es la fácil de olvidar:** los `due_date` de las
      instancias existentes **y** el `start_date` de una regla creada desde un movimiento, que no
      tiene fila de instancia —el movimiento semilla **es** esa ocurrencia—. El cursor codificaba eso
      implícitamente al quedar seteado en la fecha de la semilla; nombrarlo es lo que permite
      soltarlo. Vive en `coveredOccurrences`, una sola función que arman todos los llamadores.
      **Por qué el cursor era incorrecto en las dos direcciones:** cubría de más, porque resolver
      agosto lo movía más allá de julio, que la regla seguía debiendo; y cubría de menos, porque
      generar una pendiente **nunca** lo avanzaba —solo resolverla—, así que la lectura de instancias
      la contaba y la proyección, caminando desde el cursor, la emitía otra vez. La misma cuota, dos
      veces, justo para quien no se puso al día. Eso es #118.
      **La exclusión del dashboard se hace por `due_date`, no por `scheduled_date`:** en una
      ocurrencia resuelta `scheduled_date` guarda la fecha de **pago**, así que una cuota de agosto
      pagada en septiembre caería fuera de la ventana de agosto y volvería a proyectarse como debida.
      **«Próximo» también cambia, y es visible:** antes anunciaba como próxima una ocurrencia que el
      usuario ya tenía sin resolver —la misma fecha en dos lugares—. Ahora cada ocurrencia aparece en
      uno solo: en el bloque de «por revisar» si existe, en la proyección si no.
      **Deshacer deja de leer el cursor sin cambiar de criterio:** la regla se encuentra **por**
      `created_from_transaction_id`, así que es semilla por definición y el cursor solo repetía eso;
      preguntar `start_date > today` dice lo mismo y no depende de que el cursor se haya mantenido.
      Regresiones: `#118: an UNRESOLVED occurrence is not counted twice` y una omitida que no vuelve
      como compromiso. Contra el camino viejo dan **1.000.000 en vez de 500.000** y 80.000 en vez de
      0. La versión anterior del test que cubría esto tenía una fixture irreal —le ponía el cursor en
      la fecha generada, cosa que el generador nunca hacía—, y por eso el defecto sobrevivió.
      `RecurrenceSummary` gana `covered_occurrences`, acotado a hoy en adelante: como las ocurrencias
      solo se materializan hasta hoy, son una fila por regla como mucho.
      **Corregido (2) — la instancia se ubicaba por la fecha de pago.** El comentario decía
      `due_date` pero la consulta seguía filtrando y mostrando por `scheduled_date`. Una cuota que
      vencía el 10/08 y se pagaba el 15/09 quedaba **fuera** de agosto por la fecha de pago mientras su
      vencimiento **sí** tapaba la proyección de agosto: el mes mostraba $0. Ahora la ocurrencia se
      ubica y se cuenta por su vencimiento, y las dos lecturas se unificaron en **una sola**, porque
      contar y excluir tienen que coincidir en a qué ventana pertenece cada fila y dos consultas con
      dos filtros pueden discrepar en silencio. **Fallback explícito** para las históricas sin
      vencimiento recuperable: se ubican por `scheduled_date`, la única fecha que tienen.
      **Corregido (3) — un ingreso pendiente materializado desaparecía de «Ya entra».** `recurringIncome`
      sumaba solo la proyección, y la proyección ahora resta lo que ya existe. Suma las dos fuentes,
      como los gastos; `confirmed` y `skipped` siguen afuera.
      **Corregido (4) — las lecturas nuevas del dashboard no paginaban.** Con un atraso diario superan
      el `max-rows` de PostgREST, y una respuesta truncada no solo pierde importes: las filas que
      quedan afuera dejan de tapar sus fechas y la proyección las reemite — #118 volviendo por la capa
      de lectura. `selectAllPages` se movió a `@grana/supabase`, que es donde vive el contrato del
      cliente, y lo usan los dos paquetes.
      Cinco regresiones nuevas en `committed-outlook.test.ts`; cuatro fallan contra el commit anterior
      con los síntomas exactos: $0 en vez de $500.000, $600.000 en vez de $300.000, $25.000 de
      compromiso inventado, y $0 de ingreso en vez de $2.000.000.
      **Corregido (5) — un vencimiento desconocido volvía a ocupar una fecha real.** El fallback de
      ubicación se estaba usando también como cobertura, así que un pago histórico registrado el 10/09
      tapaba la ocurrencia verdadera del 10/09 y la proyección la perdía. Es el mismo defecto del #96
      un nivel más arriba, y contradice lo que `0064` garantiza en la base al declarar esos
      vencimientos desconocidos en vez de adivinarlos. Ahora las dos preguntas están separadas:
      **ubicar** usa `due_date ?? scheduled_date`; **tapar** usa **solo** `due_date` exacto. Regresión
      con un histórico desconocido y la ocurrencia real en la misma fecha: contra el commit anterior
      da $300.000 en vez de $600.000.
      **Delta de spec de `dashboard`** (`specs/dashboard/spec.md`): contiene el requirement maestro
      **completo** con los tres párrafos afectados reescritos y seis escenarios nuevos, porque un
      `MODIFIED` se integra reemplazando al requirement entero — un delta que dijera «lo demás queda
      como está» habría borrado al archivarse las reglas de tarjetas, lentes, ventanas y vencidos.
      Verificado que los 15 escenarios maestros sobreviven.
      Dos fixtures usaban estados que el sistema no puede producir —una pendiente y treinta omitidas
      con fecha futura, cuando el generador solo materializa lo ya vencido—: pasaron a `PREVIOUS_MONTH`
      con fechas vencidas, y la de paginación combina seis reglas para superar el límite simulado.
- [ ] 2.6 Copy: **"vencimientos por revisar"** — ni "pagos" (afirmaría que hubo pago) ni lenguaje de
      deuda. Actualizar `es.json` y `en.json`.
## 3. Diferido a changes posteriores

Nada de esto se descarta ni se pierde: sale de **esta** entrega para que el arreglo del #96 llegue a
producción y se pueda probar contra el uso real. Cada bloque conserva el texto con el que se analizó,
para que el change que lo tome no empiece de cero. **No son tareas de este change**, por eso van sin
casilla — y los nombres de change son destinos previstos, no changes a crear ahora: cada uno se abre
cuando se priorice.

### → `recurrence-early-payment`

3.1 "Ya lo pagué": materializar la próxima ocurrencia bajo demanda y abrir el formulario de
resolución con la fecha de pago en hoy, editable. Disponible en el hub y en el detalle de la regla.
No ofrecerla en reglas pausadas.

3.2 Verificar que el pago anticipado no desplaza el cronograma — test de tres meses seguidos pagados
unos días antes, con el vencimiento sin moverse.

### → `recurrence-link-movement`

3.3 "Ya lo cargué": vincular un movimiento existente. No crea transacción; marca el movimiento como
**"vinculado a esta recurrencia"** —no "originado en", que existía antes—; filtra por moneda y tipo
compatibles; excluye los ya vinculados; registra la resolución como `linked`.

3.3b Vinculación en reglas **compartidas**, tres casos: reparto compatible → directo; movimiento
personal → explicar la conversión, pedir confirmación y marcar `linked_conversion`; movimiento con
**otro hogar u otro reparto** → **excluir de los candidatos**, para no reemplazar una deuda que el
otro miembro ya ve. Conversión + vinculación en una **sola RPC transaccional**. Test: la deuda del
hogar queda igual que registrando desde la recurrencia, y un fallo no deja el movimiento convertido a
medias.

### → `recurrence-undo` (cierra **#104**)

3.4 Deshacer: devuelve la ocurrencia a *sin resolver* (nunca a omitida) y actúa según cómo se
resolvió — `created` elimina el movimiento; `linked` lo conserva y desvincula; `linked` que además
había **convertido** el movimiento a compartido revierte también la conversión y la deuda, en una
**sola RPC transaccional**. Con `one_pending_per_rule` eliminado desaparece la restricción que
obligaba a marcarlo `skipped`.

**Lo que esta entrega le deja preparado:** `resolution_kind` y `linked_conversion` se escriben desde
la migración de expansión (tarea 1.4b). Sin ese dato, deshacer no puede distinguir borrar un
movimiento que la recurrencia creó de desvincular uno del usuario, y la distinción no se reconstruye
después.

### → `recurrence-history`

3.5 Historial de la regla: mostrar vencimiento, fecha de pago y fecha de carga por separado.

3.6 Tests: vincular no cambia el total del mes; deshacer un `created` elimina el movimiento; deshacer
un `linked` lo conserva y el total del mes no cambia; en ambos casos la ocurrencia queda resoluble de
nuevo.

**Lo que esta entrega le deja preparado:** los cuatro instantes ya viven en campos separados y
`due_date` es inmutable. Falta mostrarlos.

### → `recurrence-catch-up`

2.4 Acción "Ponerse al día": resolución en bloque con fila por ocurrencia, cada una con fecha,
importe y cuenta editables, y las cuatro salidas (registrar · vincular · no corresponde · dejar sin
resolver). **Atómica de verdad** (decisión 22): RPC de Postgres `SECURITY INVOKER`, no orquestador
con rollback compensatorio — la compensación también puede fallar y deja movimientos creados con
ocurrencias sin resolver.

2.4b Acción separada "Usar este importe de acá en más", aplicada una sola vez y tomando el importe de
la ocurrencia más reciente del grupo.

2.5 Resumen previo a aplicar: movimientos que se van a crear y efecto sobre el saldo de cada cuenta
involucrada.

2.7 Tests: tres meses resueltos en una pasada con importes distintos y una cuenta distinta, sin que
cambie el importe de la regla; un fallo en el tercero no deja los dos primeros guardados; dejar uno
sin resolver no bloquea los demás.

### → `recurrence-review-ux`

2.1c Aviso de historial no reconstruido **en la recurrencia** ("tiene historial anterior a <mes> que
no se reconstruyó"), no como "este mes tiene información incompleta": esos pagos pueden haberse
cargado a mano. **Es el borde áspero conocido del mínimo**: quien arrastre más de un año ve doce
meses sin que nada explique el corte.

2.3 Agrupar por regla en las superficies de "por revisar", con el resto colapsado cuando el grupo es
largo, sin que ninguna ocurrencia deje de ser accesible.

4.5c Señalar los períodos anteriores al horizonte como de información incompleta, con la vía para
completarlos a mano.

4.6 Paridad nativa del formulario de resolución: importe, fecha y cuenta editables, más la
advertencia de saldo negativo que hoy solo existe en web.

4.7 Sellar como "Pausada" las ocurrencias anteriores a una pausa, que siguen resolubles.

Además, el **diseño cuidado** del error de materialización. Lo que **no** se difiere es que el error
se vea y se pueda reintentar: eso es la tarea 4.5b, y está en el mínimo.

### → `recurrence-server-generation`

La otra mitad de 2.8b: generar del lado del servidor, en vez de depender de que el cliente abra la
app. Cubre además a quien no la abre nunca. Es mejor que el gate de versión; es más grande.

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
- [ ] 4.8 Recorrer los **seis** comportamientos de `proposal.md` en web y en nativo antes de cerrar,
      terminando en la prueba de aceptación: varios vencimientos visibles, ninguno trabando al
      siguiente, sin duplicados, resolubles por separado y en cualquier orden.

## 4b. Activación — va última

Nada de esta etapa se aplica hasta que las etapas 2 y 4 estén desplegadas en web y en nativo.

- [ ] 2.8b **Requisito para activar**, no una mejora: un usuario que solo conserve el cliente viejo
      nunca ejecuta el generador nuevo, así que su atraso no se materializa y el #96 sigue vivo para
      él — ahora sin el índice que lo contenía. De las dos opciones posibles, **este recorte toma el
      gate de versión mínima al arrancar la app nativa**, por ser la más chica. La generación del lado
      del servidor (etapa 2 de la decisión 8), que además cubre a quien no abre la app, es mejor y
      queda en `recurrence-server-generation`. El gate se despliega **antes** que la tarea 2.8.
- [ ] 2.8 **Migración B · activación**, en archivo aparte
      (`<próximo libre>_recurrence_backlog_activate.sql`, número elegido contra `main` al crearla),
      y **solo con los pasos 2 a 7 del orden ya desplegados** —generador, reads, dashboard, cursor,
      superficies de web y nativo, y el gate de versión—: eliminar
      `recurrence_instances_one_pending_per_rule`. Desde acá existe el
      backlog. Las constraints de `resolution_kind` ya entraron en la expansión (tarea 1.4b).
- [ ] 2.8c **Regresión que solo se puede escribir con la activación**, y que hoy falta: la prueba de
      las 61 reglas siembra reglas **sin** pendiente previa, así que ejercita la inanición entre
      reglas pero no el caso exacto del #96. Con la migración escrita, agregar: sembrar 61 reglas
      **cada una con una pendiente vieja sin resolver**, retirar el índice, correr dos tandas y
      comprobar que las 61 terminen con su vencimiento vigente materializado. Es la única forma de
      verificar que el nivel `blocked` de `selectReconstructionBatch` deja de costar cuando la
      restricción desaparece — antes de la activación esas 61 reglas no pueden recibir nada, y el
      test solo podría afirmar que no se rompe.

## 5. Cierre

- [ ] 5.1 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm lint:mobile`, `pnpm typecheck:mobile`.
- [ ] 5.2 Archivar el change y aplicar los deltas al spec maestro de `transactions`
      (`RENAMED` + `MODIFIED` + `ADDED`), sin dejar secciones delta en el maestro.
- [ ] 5.3 `pnpm openspec:check` en verde.
- [ ] 5.4 Dejar anotado para la **migración C** (fuera de esta entrega): al retirar `scheduled_date`,
      **no** eliminar `trg_recurrence_instance_compat` entero. Contiene la inmutabilidad de
      `due_date`, que es permanente; borrarlo reabre el agujero. Quitar solo las ramas de
      compatibilidad, o reemplazarlo por un guard con nombre propio.
- [ ] 5.5 Cerrar **#96** y **#118** con esta entrega — el #118 lo cierra la tarea 2.2b, que es el
      mismo código. **#104 ya no cierra acá**: se movió a `recurrence-undo` (etapa 3).
