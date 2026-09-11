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

- [x] 1b.1 **Migración `0068`**: `recurrence_schedule_versions` suma `effective_until DATE NULL` — el último
      día, **inclusive**, en que una versión puede producir — con un `CHECK` que impida
      `effective_until < effective_from`. `NULL` = hasta que empiece la siguiente, que es el
      comportamiento de hoy, así que ninguna versión existente cambia de significado. `recurrences` suma
      `schedule_effective_from`, mantenido por el trigger: el piso que necesitan las lecturas que no
      leen versiones. Número elegido contra `main`.
- [x] 1b.2 El trigger deja de inferir la vigencia de un cambio de `start_date`: la **recibe**, y **rechaza**
      el cambio si no viene. Al aplicarla, cierra la versión saliente en
      **`least(hoy, vigencia - 1)`**: si la nueva empieza hoy la vieja termina ayer, y si empieza más
      adelante termina hoy — nunca se superponen. Ese cierre es lo que impide que el cronograma viejo
      produzca una ocurrencia más en el hueco: el `8 de octubre` que reaparecería si la versión nueva
      simplemente empezara el `10 de octubre`.
      El comportamiento para un cambio **solo de frecuencia** no cambia.
- [x] 1b.2b **RPC**: la vigencia y el patch de la regla viajan en **una sola transacción**. Un `update`
      suelto de `start_date` ya no es un camino válido, y la base es la que lo garantiza — no la
      buena voluntad del cliente. Con su `revoke` a `anon` y su `grant` a `authenticated`, como enseñó
      `0067`.
- [x] 1b.3 El walker compartido (`owedOccurrencesForRule`) cierra cada versión en el **menor** entre
      `effective_until`, el día anterior a la versión siguiente y hoy. El hueco hasta la siguiente **no
      produce nada**. Hoy el fin de una versión se deriva del comienzo de la otra, así que un hueco es
      inexpresable.
- [x] 1b.3b **Las otras lecturas también respetan el hueco.** `getNextExpectedOccurrence` (la "Próxima
      fecha" del detalle, del hub y del aviso de duplicados) y `projectUpcomingOccurrences` (la
      proyección del dashboard) caminan hoy el calendario con los campos crudos de la regla, sin mirar
      versiones. Si solo el generador respetara el corte, durante el hueco la UI proyectaría un
      vencimiento que la base decidió que no existe. Es una brecha **preexistente** —el generador y las
      pantallas derivan el calendario de fuentes distintas— que este change cierra porque el hueco la
      vuelve visible.
- [x] 1b.4 La mutación acepta la fecha elegida y la **valida contra el cronograma nuevo**: SHALL ser una
      ocurrencia real de ese cronograma y no anterior a hoy. Una fecha cualquiera abriría una vigencia
      que el calendario nunca produce.
- [x] 1b.5 El formulario pregunta **"¿Cuál querés que sea el primer vencimiento con la nueva referencia?"**
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

- [x] 2b.1 **A** — el ciclo ya resuelto: regla mensual anclada al 8, con el 8 de septiembre confirmado;
      hoy 10 de septiembre se corrige al día 10 eligiendo el **10 de octubre**. No se materializa el
      10 de septiembre **ni el 8 de octubre**, y la próxima fecha es el 10 de octubre.
- [x] 2b.2 **B** — el ciclo sin resolver: misma regla, hoy 5 de septiembre, se elige el **10 de
      septiembre**. Septiembre vence el 10 y no también el 8.
- [x] 2b.3 **C** — con atraso: julio y agosto sin resolver se materializan **el día 8**, y solo lo
      posterior a la vigencia elegida usa el 10.
- [x] 2b.4 **Cada N días**: una regla cada 3 días se corre un día y las dos fechas ofrecidas son
      ocurrencias reales del cronograma nuevo.
- [x] 2b.5 Regresión del hueco: entre `effective_until` y el comienzo de la versión siguiente **no se
      produce ninguna ocurrencia**, que es la trampa que hace insuficiente cualquier fórmula de
      vigencia automática.
      **Cuidado con dónde se para el test:** parado en el día del cambio, el caso del hueco pasa
      con y sin el corte, porque una caminata nunca va más allá de hoy y la fecha vieja del ciclo
      siguiente todavía es futuro. Prueba la ELECCIÓN, no el corte. La regresión se para **dentro
      del hueco** —el 9 de octubre— que es el único lugar donde la pregunta existe. Verificado
      quitando el corte: ahí sí falla.

## 1c. Los bordes que pidió la revisión

- [x] 1c.1 `schedule_effective_from` se inicializa desde **la versión que describe el cronograma actual**
      —misma frecuencia y mismo ancla—, no desde la más nueva a secas ni desde `start_date`. La más
      nueva puede describir un cronograma que la regla ya no tiene, y `start_date` dice cuándo empezó
      la regla, que es otra pregunta.
- [x] 1c.2 **La columna es del trigger.** Lo que mande el cliente se descarta antes de nada: un piso que
      el cliente pueda mover deja de significar algo, y este decide qué ocurrencias existen. Los
      privilegios por columna lo dirían más declarativamente, pero también bloquearían al RPC, que
      corre como el usuario a propósito.
- [x] 1c.3 El RPC **bloquea la regla con `FOR UPDATE`** y **recalcula las candidatas en la base**: la
      pregunta la dibuja el cliente, la respuesta la verifica el servidor. Una fecha que llegara sin
      verificar abriría una versión en un día que el calendario no produce, y todo lo posterior caería
      en la fase equivocada. `SECURITY INVOKER`, para que la rechace el mismo RLS que rechaza
      cualquier otra escritura.
- [x] 1c.4 **Ventana de despliegue: `0068` → código.** Probado: el cliente actual nunca manda
      `start_date` en un update, así que sigue editando importe, frecuencia, fin y descripción sin
      cambios. Una migración que rompiera la app desplegada exigiría aplicarse en el mismo segundo que
      un deploy, y ese segundo no existe.
- [x] 1c.5 **Las tres superficies coinciden dentro del hueco.** Una prueba común arma las dos
      representaciones de la misma regla —versiones para el generador, columnas para "próxima fecha" y
      la proyección— y compara las tres respuestas en tres días del hueco y en el día que arranca.
- [x] 1c.6 Tipos y validador: `types.ts` fija las dos columnas nuevas, y `validate_schema.sql` suma la
      sección **8.1K** con la columna, el `CHECK`, las dos funciones, sus permisos y el trigger. La
      sección va **fuera del bloque compartido**: ese bloque describe la expansión y el validador de
      transición lo corre en una ventana donde `0068` todavía no existe. Y se **ejecuta** en un test,
      porque un validador que nadie corre se desalinea — el de 8.1J estuvo mal dos veces.

## 1d. Lo último que pidió la revisión

- [x] 1d.1 **Sin fallback a "la versión más nueva".** Si ninguna versión describe el cronograma que la
      regla tiene hoy, la migración **aborta nombrando la regla**: ese estado es deriva —las dos
      mitades del modelo no coinciden— y elegir otra versión lo escondería congelando un piso falso
      en una columna que toda lectura cree.
- [x] 1d.2 **Una regla pausada no se pregunta.** Sus dos candidatas caerían dentro de la pausa, y
      llamar "primer vencimiento" a cualquiera de las dos sería una promesa que el calendario no va a
      cumplir. El cronograma corregido rige desde hoy, la pausa se mantiene, y el formulario dice
      "Usaremos esta referencia cuando reanudes la regla". La base lo hace cumplir: a una regla
      pausada le rechaza una fecha elegida, y a una activa le exige una.
- [x] 1d.3 **Las candidatas respetan `end_date` y `max_occurrences`.** Una fecha que la aritmética
      produce pero el fin o el tope excluyen no es un vencimiento posible, y ofrecerla sería poner
      delante del usuario una promesa que el calendario rechaza.
- [x] 1d.4 **El cliente dibuja, el servidor decide — y no pueden divergir.** Las candidatas se calculan
      en TypeScript para la pregunta y en SQL para la validación, así que hay una prueba que enfrenta
      las dos implementaciones sobre catorce cronogramas: fin de mes, febrero, un año bisiesto, cada N
      días, topes y fechas de fin. Si divergen, el formulario ofrecería una fecha que el servidor
      rechaza y corregir la referencia sería imposible justo en esos casos.

## 3. Cierre

- [ ] 3.1 QA manual en las dos plataformas, con el caso real del sueldo.
- [ ] 3.2b **Limpieza dirigida** de la ocurrencia que el QA produjo: el `10 de septiembre` pendiente de la
      regla de sueldo en la cuenta de prueba. NO se omite —una omitida deja una ocurrencia falsa en el
      historial y consume una posición de `max_occurrences`—: se identifica por id, se verifica que no
      tenga movimiento asociado y se borra, con la consulta a la vista antes y después.
- [ ] 3.2 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm lint:mobile`, `pnpm typecheck:mobile`, `pnpm build`.
- [ ] 3.3 Archivar el change y aplicar el delta al spec maestro de `transactions`.
- [ ] 3.4 `pnpm openspec:check` en verde.
