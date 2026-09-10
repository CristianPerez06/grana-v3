# Tareas

Cierra **#121**. Empezó como un campo en dos formularios; el QA del 10/9 encontró que corregir el ancla a
mitad de ciclo **duplica el vencimiento del ciclo en curso**, y eso amplió el alcance a una migración y a
una pregunta en el formulario. El detalle está en `proposal.md`; acá va el trabajo.

## 1. El campo

- [x] 1.1 Agregar el campo **día de vencimiento** al drawer de edición web, precargado con el `start_date`
      actual, y mandarlo en el `updateRecurrence` que el drawer ya arma.
- [x] 1.2 Mismo campo en el formulario nativo, en el **mismo commit** — es la política de paridad, no una
      tarea de seguimiento. Usa el date field nativo que ya usan los otros formularios.
- [x] 1.3 Etiqueta y ayuda en `es.json` y `en.json`. Queda **"Fecha de referencia"**, no "día de
      vencimiento" ni "fecha de inicio": lo primero sería incorrecto para una regla semanal o cada N
      días —no hay un día del mes— y lo segundo suena a un dato histórico que no se puede tocar.
- [x] 1.4 La ayuda dice lo que el usuario no puede deducir: "Usamos esta fecha para calcular los próximos
      vencimientos. Los que ya existen conservan su fecha." Sin esa línea, una ocurrencia vieja en el
      día viejo parece un bug. Y NO dice qué hacer con ella: confirmarla u omitirla es decisión del
      usuario, no una instrucción del formulario.

## 1b. La vigencia se elige, no se adivina

- [ ] 1b.1 **Migración `0068`**: `recurrence_schedule_versions` suma `effective_until DATE NULL` — el último
      día en que una versión puede producir. `NULL` = hasta que empiece la siguiente, que es el
      comportamiento de hoy, así que ninguna versión existente cambia de significado. Número elegido
      contra `main`.
- [ ] 1b.2 El trigger deja de inferir la vigencia de un cambio de `start_date`: la **recibe**. Al aplicarla,
      cierra la versión saliente con `effective_until = hoy`. Eso es lo que impide que el cronograma
      viejo produzca una ocurrencia más en el hueco — el `8 de octubre` que reaparecería si la versión
      nueva simplemente empezara el `10 de octubre`.
      El comportamiento para un cambio **solo de frecuencia** no cambia.
- [ ] 1b.3 El walker compartido (`owedOccurrencesForRule`) respeta el corte: una versión termina en
      `effective_until` cuando lo tiene, y el hueco hasta la siguiente **no produce nada**. Hoy el fin
      de una versión se deriva del comienzo de la otra, así que un hueco es inexpresable.
- [ ] 1b.4 La mutación acepta la fecha elegida y la **valida contra el cronograma nuevo**: SHALL ser una
      ocurrencia real de ese cronograma y no anterior a hoy. Una fecha cualquiera abriría una vigencia
      que el calendario nunca produce.
- [ ] 1b.5 El formulario pregunta **"¿Cuál querés que sea el primer vencimiento con la nueva referencia?"**
      con las dos primeras fechas del cronograma nuevo, en web y en nativo. Sin la palabra "mes" ni
      "período": una regla cada N días no tiene ninguno.

## 2. Que no se rompa lo que ya está

- [x] 2.1 Regresión: cambiar el ancla de una regla mensual del 8 al 10 mueve la próxima fecha al 10 y
      **no** materializa nada anterior al cambio.
- [x] 2.2 Regresión: una ocurrencia sin resolver del día viejo conserva su vencimiento después del cambio
      —el vencimiento es inmutable— y las siguientes salen en el día nuevo.
- [x] 2.3 Regresión: la edición funciona con la regla **pausada**, y no la reactiva.
- [x] 2.4 Verificar contra la base real (PGlite con el SQL de `0064` tal cual) que el trigger hace lo que
      el proposal afirma: versión nueva con `effective_from = greatest(hoy, start_date)`. Si el trigger no
      se comportara así, el campo no se expone hasta arreglarlo.
      **Verificado**, y con dos comprobaciones que el ticket no pedía: la versión vieja **sobrevive**
      para el tramo que gobernó —borrarla reinterpretaría meses que ya pasaron— y `reconstruct_from`
      **no baja**, así que corregir una fecha por dos días no puede fabricar un año de ocurrencias.

## 2b. Los cuatro casos del borde

- [ ] 2b.1 **A** — el ciclo ya resuelto: regla mensual anclada al 8, con el 8 de septiembre confirmado;
      hoy 10 de septiembre se corrige al día 10 eligiendo el **10 de octubre**. No se materializa el
      10 de septiembre **ni el 8 de octubre**, y la próxima fecha es el 10 de octubre.
- [ ] 2b.2 **B** — el ciclo sin resolver: misma regla, hoy 5 de septiembre, se elige el **10 de
      septiembre**. Septiembre vence el 10 y no también el 8.
- [ ] 2b.3 **C** — con atraso: julio y agosto sin resolver se materializan **el día 8**, y solo lo
      posterior a la vigencia elegida usa el 10.
- [ ] 2b.4 **Cada N días**: una regla cada 3 días se corre un día y las dos fechas ofrecidas son
      ocurrencias reales del cronograma nuevo.
- [ ] 2b.5 Regresión del hueco: entre `effective_until` y el comienzo de la versión siguiente **no se
      produce ninguna ocurrencia**, que es la trampa que hace insuficiente cualquier fórmula de
      vigencia automática.

## 3. Cierre

- [ ] 3.1 QA manual en las dos plataformas, con el caso real del sueldo.
- [ ] 3.2b **Limpieza dirigida** de la ocurrencia que el QA produjo: el `10 de septiembre` pendiente de la
      regla de sueldo en la cuenta de prueba. NO se omite —una omitida deja una ocurrencia falsa en el
      historial y consume una posición de `max_occurrences`—: se identifica por id, se verifica que no
      tenga movimiento asociado y se borra, con la consulta a la vista antes y después.
- [ ] 3.2 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm lint:mobile`, `pnpm typecheck:mobile`, `pnpm build`.
- [ ] 3.3 Archivar el change y aplicar el delta al spec maestro de `transactions`.
- [ ] 3.4 `pnpm openspec:check` en verde.
