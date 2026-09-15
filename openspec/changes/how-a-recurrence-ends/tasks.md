# Tareas

Ver `design.md` para el porqué de cada decisión y `specs/transactions/spec.md` para lo que cada paso tiene que cumplir.

## 0. Antes de escribir código: saber qué hay en la base

- [x] 0.1 **Auditar las reglas que tienen fecha de fin Y límite a la vez.** El modelo lo permitía y la generación cortaba por la primera condición que se cumpliera; las tres respuestas excluyentes rigen de acá en adelante, pero no pueden descartar en silencio lo que ya está guardado. Correr como lectura sobre la base real —sin importes ni descripciones— y anotar el resultado acá: cuántas reglas tienen las dos, y en qué estado están.

  **Resultado (2026-09-15, base de producción): ninguna.** La consulta agrupada por `status` sobre `end_date is not null and max_occurrences is not null` no devolvió filas. Eso es todo lo que el resultado permite afirmar: **no se encontró ninguna regla con las dos condiciones**. No dice que fueran inalcanzables — el formulario nativo mostraba `maxOccurrences` siempre y lo enviaba aunque hubiera `end_date`, así que la combinación se podía producir y simplemente nadie la produjo. Por eso el camino se construye igual (tarea 3.8).

  ```sql
  select r.status,
         count(*) as reglas,
         min(r.start_date)::text as mas_vieja,
         max(r.start_date)::text as mas_nueva
    from public.recurrences r
   where r.end_date is not null
     and r.max_occurrences is not null
   group by r.status
   order by r.status;
  ```
- [x] 0.2 Según ese resultado, redactar con el usuario **el texto** de lo que se le muestra a quien edite una de esas reglas. Lo que NO se decide acá es si el camino se construye: mientras la base permita las dos condiciones a la vez, el formulario tiene que sostenerlas siempre, encuentre o no el 0.1 un caso hoy — una fila creada mañana por cualquier camino que no sea el formulario vuelve a ponerlas. La única alternativa a construirlo es **prohibir la combinación en la base** con un CHECK, y eso es otro cambio: obliga a decidir qué pasa con las filas que ya la tienen. El 0.1 dice con cuánto cuidado hay que redactar el mensaje, no si hace falta.

  **Decidido**: como no hay ninguna regla en esa forma, el aviso es breve y no necesita explicar una historia que nadie vivió. Dice qué tiene la regla, qué queda y pide confirmación:

  > Esta regla tiene una fecha de fin **y** un límite de vencimientos. Ahora se guarda una sola condición: va a quedar **{la elegida}**, y **{la otra}** se quita. ¿Seguimos?

  Sin confirmación no se guarda nada. El camino se implementa igual (tarea 3.8) y su regresión arma la regla con las dos condiciones a mano, porque en la base no hay ninguna de donde sacarla.

## 1. La derivación, una sola vez y sin base de datos

- [ ] 1.1 En `@grana/money-logic`, agregar la función pura que decide el estado mostrado y el avance. **La pregunta que decide el final es si el calendario produce alguna ocurrencia a partir de hoy**, no si el tope se agotó: la función recibe esa respuesta del caminante, más las posiciones gastadas y los vencimientos sin resolver, que dicen *cómo* terminó y qué queda por hacer. Verificar con tests de tabla: sin límite; límite con posiciones por delante; límite agotado; **terminada por `end_date` sin límite**; **terminada por `end_date` con un pendiente sin resolver**; agotada con un pendiente sin resolver; y pausada con calendario por delante — esta última NO finalizada.
- [ ] 1.2 Verificar que una regla `deleted` NO se deriva a ningún estado: la derivación se aplica sólo a activas y pausadas. Comprobar con un test que pasarle una eliminada no la convierte en finalizada.
- [ ] 1.3 Agregar al mismo módulo el cálculo del **último vencimiento previsto**, usando `walkOccurrences` / `forEachComposedOccurrence` y no una fórmula nueva. Verificar contra una regla mensual anclada al 10 de septiembre de 2026 con `max_occurrences = 11`: tiene que dar `2027-07-10`. Agregar un caso con una corrección de ancla en el medio y comprobar que la fecha se mueve con el cronograma corregido.
- [ ] 1.4 Verificar que una regla con una **pausa abierta** NO devuelve fecha: el resultado tiene que distinguir «no se puede saber todavía» de una fecha concreta, para que la UI diga que se calcula al reanudar en vez de mostrar una estimación como si fuera cierta. Comprobar en negativo que devolver una fecha ahí hace fallar el test.
- [ ] 1.4b **Y que esa misma pausa abierta NO la dé por finalizada.** Son dos preguntas distintas: «¿cuándo termina?» no tiene respuesta, pero «¿le queda algo?» sí — se contesta evaluando el calendario como si la regla se reanudara hoy. Verificar con dos reglas pausadas de la misma forma: una con posiciones por delante (pausada, sin fecha) y otra con el límite gastado (finalizada). Comprobar en negativo que preguntarle al caminante sin ignorar la pausa da finalizadas las dos.
- [ ] 1.5 Verificar en negativo que el avance NO se puede calcular contando instancias: un test con una regla sembrada por un movimiento (primera ocurrencia sin fila en `recurrence_instances`) y `max_occurrences = 3` tiene que dar `1 de 3`. Comprobar que el test falla si se le pasa el conteo de filas.

## 2. Pedir las posiciones gastadas de muchas reglas de una vez

- [ ] 2.1 Escribir la migración que agrega la función SQL batch: recibe el conjunto de reglas y devuelve sus posiciones gastadas, llamando internamente a `recurrence_positions_spent` por fila — sin reescribir su lógica (decisión 2). Elegir el número de migración **contra `main`**, no contra el árbol de trabajo. Verificar con una regresión en el harness PGlite que, para un conjunto de reglas de formas distintas (sembrada, con ancla corregida, pausada, sin límite), devuelve exactamente lo mismo que llamar a la función individual una por una.
- [ ] 2.2 **La frontera de esa función, declarada y verificada.** `SECURITY INVOKER` —una `DEFINER` que recibe una lista de ids devolvería posiciones de reglas ajenas—, `REVOKE ALL` para `PUBLIC` y para `anon`, `GRANT EXECUTE` sólo para `authenticated`. Verificar con regresiones en el harness, que ya corre con los roles reales: un usuario que pide ids de **otro** usuario recibe vacío, no sus posiciones; `anon` no puede ejecutarla.
- [ ] 2.3 Fijarla en `validate_schema.sql`: firma, cuerpo y privilegios, con el mismo patrón con que ya está fijada `recurrence_positions_spent`. Verificar en negativo que cambiar cualquiera de los tres hace fallar el validador.
- [ ] 2.4 Exponer esa lectura en `@grana/recurrences` y usarla en la consulta del hub de recurrencias. Verificar con una regresión que listar N reglas hace **una** llamada a la base por ese dato, no N.
- [ ] 2.5 Aplicar la migración a Supabase y validar el esquema. Paso manual del usuario; no avanzar sin su confirmación.

## 3. La pregunta «¿Cómo termina?»

- [ ] 3.1 Modelar la condición de fin en un lugar compartido: las tres respuestas excluyentes y la función que traduce la respuesta elegida al par `(end_date, max_occurrences)` (decisión 3). Verificar con tests que «sin límite» produce `(null, null)`, «en una fecha» produce `(fecha, null)` y «después de N» produce `(null, N)` — **cualquiera sea el valor que quedó escrito en los otros campos**.
- [ ] 3.2 Web — formulario de creación directa: reemplazar el bloque «Tiene fecha de fin» por la pregunta con tres respuestas, con el límite siempre visible cuando corresponde y un campo que sólo acepta dígitos y no reacciona a la rueda ni a las flechas. Verificar con una regresión que escribir `11` y después elegir «sin límite» guarda `max_occurrences = NULL` — el escenario que originó este cambio.
- [ ] 3.3 Nativo — formulario de creación directa: misma pregunta. El campo ya filtra dígitos y ya está fuera del bloque de fecha de fin; lo que cambia es que las tres respuestas sean excluyentes y que el envío se derive de la elegida. Verificar el mismo caso del 3.2.
- [ ] 3.4 «Hacer recurrente»: agregar la condición de fin a `useMovementForm` y al envío de los dos caminos (`createRecurrenceDirect` y `createRecurrenceFromMovement`), que hoy nunca mandan `max_occurrences`. Verificar con una regresión que registrar un gasto, marcarlo recurrente mensual y responder «después de 11 vencimientos» crea la regla con `max_occurrences = 11`.
- [ ] 3.5 Web y nativo: dibujar ese control en los dos formularios de movimiento. Verificar abriendo los dos y comprobando que la pregunta aparece con las mismas tres respuestas.
- [ ] 3.6 Edición de la regla: agregar la condición de fin al cajón de edición en web y en nativo, permitiendo **cambiar y quitar** el límite. Verificar con una regresión que quitar el límite manda `max_occurrences = null` y que ampliarlo manda el número nuevo.
- [ ] 3.7 **Rechazar un límite menor que las posiciones ya gastadas**, diciendo cuántas son; aceptar el que las iguala. Sin esto, una regla que recorrió cinco posiciones y recibe un límite de tres muestra «3 de 3» — un avance saturado contra su propio tope, que además la presenta como terminada por un motivo falso. **El rechazo va en el camino de escritura autoritativo** —donde ya se rechaza un `end_date` anterior al `start_date`— y cuenta las posiciones con la lectura normativa, no con un número que mande el cliente; el formulario puede anticiparlo para el mensaje inmediato, pero no es la garantía. Verificar con regresiones los tres casos **contra la mutación, sin pasar por el formulario**: menor (rechaza), igual (acepta y la regla pasa a finalizada), mayor (acepta); y una más que compruebe que el formulario también lo anticipa.
- [ ] 3.8 **Editar una regla que tiene fecha de fin Y límite**: nombrar la situación y pedir confirmación antes de guardar, en vez de descartar una de las dos en silencio. **Esto se construye siempre**, encuentre o no el 0.1 un caso — la base permite la combinación, así que el formulario tiene que saber recibirla; el 0.1 sólo informa el texto del 0.2. Verificar con una regresión, sobre una regla armada con las dos condiciones, que sin confirmación no se descarta nada.

## 4. Mostrar el límite y el final

- [ ] 4.1 Detalle de la regla, web y nativo: mostrar el avance (`1 de 11`), los restantes y el último vencimiento previsto cuando la regla tiene límite, y no mostrarlos cuando no lo tiene. Verificar con regresiones de render en web sobre los dos casos.
- [ ] 4.1b Regla **pausada** con límite: mostrar el avance y, en lugar de la fecha, que el final se calcula al reanudar. Verificar con una regresión de render que no aparece ninguna fecha.
- [ ] 4.2 Listado de recurrencias, web y nativo: agrupar por el estado **mostrado** y no por `recurrences.status`, de modo que una regla agotada no se cuente entre las activas. Verificar con una regresión sobre una regla con `status = 'active'` y su límite gastado.
- [ ] 4.3 Comprobar que ampliar el límite devuelve la regla a activa y que quitarlo la vuelve indefinida, sin ninguna otra operación. Verificar con una regresión que recorra la mutación real, no sólo el cálculo.
- [ ] 4.4 Comprobar que `recurrences.status` NO se reescribe en ninguno de los caminos anteriores. Verificar leyendo la columna antes y después en la regresión del 4.3.
- [ ] 4.5 Comprobar que una regla **eliminada** no aparece como finalizada en el listado ni en ninguna superficie de reglas vivas. Verificar con una regresión sobre una regla `deleted` sin futuro.

## 5. Cierre

- [ ] 5.1 `pnpm verify` en verde, y la suite de recurrences también con `TZ=America/Argentina/Buenos_Aires`.
- [ ] 5.2 QA manual en las dos plataformas: crear una regla con límite por cada uno de los tres caminos de alta, ver el avance en la ficha, ampliar el límite y comprobar que vuelve a activa.
- [ ] 5.3 Archivar el change y aplicar el delta al spec maestro de `transactions`.
- [ ] 5.4 `pnpm openspec:check` en verde.
- [ ] 5.5 Avisar al usuario que ya puede corregir `Plan de pago - 11 cuotas` desde la app, cambiando su límite de 1 a 11 — sin borrarla ni recrearla, para que el plan conserve una sola historia.
