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

## 2c. BLOQUEANTES de la revisión del 11/9 — nada se aplica hasta cerrarlos

La causa común de los tres primeros: **los tests construían las versiones y las reglas a mano**, así
que probaban el cálculo y nunca el cableado. En producción la columna nueva no llega a quien la usa.
Coincidir no es estar bien — la prueba de paridad TS↔SQL coincide porque las dos mitades comparten el
mismo dato incorrecto.

- [x] 2c.1 **El generador no lee `effective_until`.** La query de versiones no lo selecciona y el mapper
      no lo copia, así que el walker lo recibe `undefined` y el cronograma viejo sigue produciendo
      dentro del hueco. `queries.ts:656`.
- [x] 2c.2 **Las lecturas reales no reciben `schedule_effective_from`.** "Próxima fecha" arma el objeto
      sin la columna (`queries.ts:72`), el detector de duplicados no la selecciona, y el dashboard ni
      la selecciona ni la propaga (`dashboard/queries.ts:918`, `aggregations.ts:713`). La prueba de las
      tres superficies usa objetos a mano y no cubre nada de esto.
- [x] 2c.3 **El trigger cierra TODAS las versiones históricas.** El `update` no se limita a la vigente,
      así que una segunda edición durante un hueco extiende una versión ya cerrada hasta hoy y vuelve
      a producir fechas que la primera edición había excluido. Falta la regresión de "editar otra vez
      durante el hueco". `0068:227`.
- [ ] 2c.4 **La migración está partida en tres transacciones.** Si falla la segunda o la tercera, la
      primera ya quedó aplicada, y existe una ventana donde la columna está instalada sin sus
      triggers. Tiene que ser una sola.
- [x] 2c.5 **`max_occurrences` se cuenta por filas**, y la semántica que cerró el #96 es por posiciones
      del calendario: una ocurrencia semilla no tiene fila, y una posición gastada puede no tenerla.
      Está mal en los dos lados —cliente y SQL— y por eso la paridad no lo detecta.
  - [x] El recorrido compuesto del generador se extrae a `forEachComposedOccurrence` y se expone como
        `occurrencePositionsSpent`: una sola implementación en TS, no una segunda que contaría otra cosa.
  - [x] `recurrence_positions_spent(uuid, date)` en SQL, que es la que usan **producción** y el RPC: el
        formulario le pregunta a la base en vez de contar `instances.length`, así que la oferta y la
        validación salen del mismo número y no pueden rechazarse entre sí.
  - [x] Paridad TS↔SQL sobre doce historias —dos versiones, un hueco, pausas abierta y cerrada, tope,
        `end_date`, cada N días, fin de mes, semanal, anual— con el valor esperado **calculado a mano**
        y no copiado de una corrida: coincidir no alcanza, que es justamente cómo pasó este bug.
## 2e. Tercera vuelta de revisión — el conteo por posiciones, afinado

Los tres salieron de revisar 2c.5 ya implementado. Los dos primeros son del mismo tipo: un número que
se queda corto **en silencio**, que es la forma en que un tope deja de ser un tope.

- [x] 2e.1 **La semilla futura podía superar `max_occurrences`.** La ocurrencia que cubre el movimiento
      semilla se contaba sólo si alguna versión la producía — y al corregir la referencia ninguna la
      produce: su fecha cae en el hueco. Reproducido: tres cuotas, tres generadas **más** el movimiento
      que ya estaba = cuatro. Ahora es una posición gastada desde que la regla existe, contada una sola
      vez (el prefijo aritmético de la primera versión ya puede contenerla), en TS y en SQL.
- [x] 2e.2 **El conteo TS cortaba en 750.** `MAX_WALK_STEPS` era una red de seguridad para una ventana
      acotada; contar la vida entera de una regla no está acotado, y una regla diaria de tres años
      devolvía 750 en vez de 1096 — un tope que parece sin gastar. El presupuesto ahora es explícito y
      cada tramo pide el suyo; quedarse sin presupuesto **lanza**, porque el fallo que esto reemplaza
      era devolver de menos sin decirlo. De paso: `occurrenceIndexAt` acotaba el ÍNDICE en vez de las
      correcciones, así que para posiciones más allá de 750 devolvía la estimación sin corregir.
- [x] 2e.3 **Los tests movían fechas un día fuera de UTC.** Dos mocks de `getTodayAR` devolvían un
      instante UTC, y `formatDateISO` lee partes LOCALES: al este de UTC el drawer corría las
      candidatas un mes entero. Ahora devuelven medianoche local, la forma que devuelve la función
      real. Verificado en Auckland, Los Ángeles, UTC y Buenos Aires.

### Fuera de alcance, anotado

- `apps/web/lib/savings/__tests__/savings-mutations.test.ts` falla con `TZ=Pacific/Auckland` — tres
  casos de `reserveAvailability`/`releaseAvailability`. Es **previo** a esta rama: lo comprobé en
  `ad049843` sin ninguno de estos cambios. No lo toqué; es de otro módulo.
- Los tests de los paquetes **no se typechequean**: `pnpm typecheck` es sólo `--filter web`, y de los
  quince paquetes sólo `movement-form` tiene script propio. Por eso un fixture sobrevivió a un
  renombre de campo y propagó `NaN`.

- [ ] 2c.6 **Cambiar frecuencia y referencia juntas falla.** Los dos formularios calculan las opciones
      con `rule.interval_count/unit` —lo guardado— mientras el servidor valida contra la frecuencia
      nueva del patch, así que rechaza la fecha que el formulario ofreció.
- [ ] 2c.7 **La elección queda obsoleta.** Al cambiar después la referencia, la frecuencia o el fin, el
      formulario conserva la selección anterior y la manda aunque ya no esté entre las opciones.
- [ ] 2c.8 **El estado `exhausted` promete algo que no pasa.** El texto dice que la referencia "queda
      guardada", pero el formulario manda `null` y el RPC rechaza toda regla activa sin fecha efectiva.
- [ ] 2c.9 Endurecer además: exigir una elección vigente en vez de tomar la primera en silencio;
      `schedule_effective_from` como invariante persistente (`NOT NULL` con un default fail-closed que
      el trigger pise); y `validate_schema.sql`, que hoy acepta un `CHECK` equivalente a `... OR true`
      y un trigger deshabilitado o apuntando a otra función.
  - [x] `NOT NULL` + default `'9999-12-31'`, que suprime en vez de proyectar: sólo se alcanza cuando
        el trigger está ausente, deshabilitado o esquivado, que es justo cuando un valor equivocado
        pasa inadvertido. Es además lo que vuelve honesto el `Insert` opcional de los tipos.
  - [x] `validate_schema.sql` deja de preguntar si el cuerpo *menciona* `seed_occurrence_date`: compara
        la EXPRESIÓN, sobre el cuerpo con los comentarios quitados, así que una frase sobre la columna
        no puede hacerse pasar por el código. El comportamiento se prueba aparte y completo contra
        Postgres real en `seeded-anchor-correction.test.ts`; este archivo responde la otra pregunta,
        si eso probado es lo que está desplegado. Pinea también el trigger habilitado (`tgenabled`).
  - [ ] Falta: exigir una elección vigente, y el `CHECK` equivalente a `... OR true`.

## 2d. La identidad de la ocurrencia semilla (revisión del 11/9, segunda vuelta)

Descubierto al cerrar 2c.2: el ancla dejó de ser inmutable y **tres** lugares seguían leyendo de ella
la ocurrencia que cubre el movimiento semilla. El peor no era un número mal mostrado sino una regla
que el usuario ya no puede deshacer.

- [x] 2d.1 **`recurrences.seed_occurrence_date`**, derivada en el INSERT y congelada después. Antes esa
      ocurrencia se leía de `start_date`, lo cual era seguro sólo mientras `start_date` no se movía.
      Con el ancla corregida: `coveredOccurrences` marcaba como cubierta la ocurrencia NUEVA y la
      escondía de toda proyección; y 0065 liberaba el piso desde el ancla corregida mientras el guard
      de 0064 exigía el que estableció la semilla — no coinciden, la transición se rechaza y **el
      movimiento ya no se puede borrar**. 0068 redefine ambas funciones para nombrar la columna nueva.
- [x] 2d.2 **El par vínculo/fecha, como invariante persistente.** `chk_recurrences_seed_pair` prohíbe
      una regla vinculada sin fecha semilla, y el guard rechaza introducir o reemplazar el vínculo: con
      la fecha congelada, un vínculo agregado después nombraría una ocurrencia que la regla nunca
      cubrió. La única transición abierta sigue siendo la que hace 0065: cortarlo.
- [x] 2d.3 **La regresión recorre la secuencia entera** contra Postgres real: crear desde un movimiento
      futuro → corregir el ancla por el RPC → borrar la semilla por el RPC → atomicidad (probada con un
      fallo que produce la base misma) y la fecha corregida materializada una sola vez.

## 3. Cierre

- [ ] 3.1 QA manual en las dos plataformas, con el caso real del sueldo.
- [ ] 3.2b **Limpieza dirigida** de la ocurrencia que el QA produjo: el `10 de septiembre` pendiente de la
      regla de sueldo en la cuenta de prueba. NO se omite —una omitida deja una ocurrencia falsa en el
      historial y consume una posición de `max_occurrences`—: se identifica por id, se verifica que no
      tenga movimiento asociado y se borra, con la consulta a la vista antes y después.
- [ ] 3.2 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm lint:mobile`, `pnpm typecheck:mobile`, `pnpm build`.
- [ ] 3.3 Archivar el change y aplicar el delta al spec maestro de `transactions`.
- [ ] 3.4 `pnpm openspec:check` en verde.
