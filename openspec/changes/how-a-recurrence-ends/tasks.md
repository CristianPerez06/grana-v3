# Tareas

Ver `design.md` para el porqué de cada decisión y `specs/transactions/spec.md` para lo que cada paso tiene que cumplir.

## 1. La derivación, una sola vez y sin base de datos

- [ ] 1.1 En `@grana/money-logic`, agregar la función pura que recibe la condición de fin de una regla, sus posiciones gastadas y sus vencimientos sin resolver, y devuelve el estado mostrado (`activa` / `pausada` / `finalizada` / `finalizada con pendientes`) más el avance (`gastadas`, `restantes`). Verificar con tests de tabla que cubran: sin límite, límite con posiciones por delante, límite agotado, límite agotado con un pendiente sin resolver, y regla pausada con calendario por delante — esta última NO finalizada (decisión 1 de `design.md`).
- [ ] 1.2 Agregar al mismo módulo el cálculo del **último vencimiento previsto**, usando `walkOccurrences` / `forEachComposedOccurrence` y no una fórmula nueva. Verificar contra una regla mensual anclada al 10 de septiembre de 2026 con `max_occurrences = 11`: tiene que dar `2027-07-10`. Agregar un caso con una corrección de ancla en el medio y comprobar que la fecha se mueve con el cronograma corregido.
- [ ] 1.3 Verificar en negativo que el avance NO se puede calcular contando instancias: un test con una regla sembrada por un movimiento (primera ocurrencia sin fila en `recurrence_instances`) y `max_occurrences = 3` tiene que dar `1 de 3`. Comprobar que el test falla si se le pasa el conteo de filas.

## 2. Pedir las posiciones gastadas de muchas reglas de una vez

- [ ] 2.1 Escribir la migración que agrega la función SQL batch: recibe el conjunto de reglas y devuelve sus posiciones gastadas, llamando internamente a `recurrence_positions_spent` por fila — sin reescribir su lógica (decisión 2). Elegir el número de migración **contra `main`**, no contra el árbol de trabajo. Verificar con una regresión en el harness PGlite que, para un conjunto de reglas de formas distintas (sembrada, con ancla corregida, pausada, sin límite), devuelve exactamente lo mismo que llamar a la función individual una por una.
- [ ] 2.2 Exponer esa lectura en `@grana/recurrences` y usarla en la consulta del hub de recurrencias. Verificar con una regresión que listar N reglas hace **una** llamada a la base por ese dato, no N.
- [ ] 2.3 Aplicar la migración a Supabase y validar el esquema. Paso manual del usuario; no avanzar sin su confirmación.

## 3. La pregunta «¿Cómo termina?»

- [ ] 3.1 Modelar la condición de fin en un lugar compartido: las tres respuestas excluyentes y la función que traduce la respuesta elegida al par `(end_date, max_occurrences)` (decisión 3). Verificar con tests que «sin límite» produce `(null, null)`, «en una fecha» produce `(fecha, null)` y «después de N» produce `(null, N)` — **cualquiera sea el valor que quedó escrito en los otros campos**.
- [ ] 3.2 Web — formulario de creación directa: reemplazar el bloque «Tiene fecha de fin» por la pregunta con tres respuestas, con el límite siempre visible cuando corresponde y un campo que sólo acepta dígitos y no reacciona a la rueda ni a las flechas. Verificar con una regresión que escribir `11` y después elegir «sin límite» guarda `max_occurrences = NULL` — el escenario que originó este cambio.
- [ ] 3.3 Nativo — formulario de creación directa: misma pregunta. El campo ya filtra dígitos y ya está fuera del bloque de fecha de fin; lo que cambia es que las tres respuestas sean excluyentes y que el envío se derive de la elegida. Verificar el mismo caso del 3.2.
- [ ] 3.4 «Hacer recurrente»: agregar la condición de fin a `useMovementForm` y al envío de los dos caminos (`createRecurrenceDirect` y `createRecurrenceFromMovement`), que hoy nunca mandan `max_occurrences`. Verificar con una regresión que registrar un gasto, marcarlo recurrente mensual y responder «después de 11 vencimientos» crea la regla con `max_occurrences = 11`.
- [ ] 3.5 Web y nativo: dibujar ese control en los dos formularios de movimiento. Verificar abriendo los dos y comprobando que la pregunta aparece con las mismas tres respuestas.
- [ ] 3.6 Edición de la regla: agregar la condición de fin al cajón de edición en web y en nativo, permitiendo **cambiar y quitar** el límite. Verificar con una regresión que quitar el límite manda `max_occurrences = null` y que ampliarlo manda el número nuevo.

## 4. Mostrar el límite y el final

- [ ] 4.1 Detalle de la regla, web y nativo: mostrar el avance (`1 de 11`), los restantes y el último vencimiento previsto cuando la regla tiene límite, y no mostrarlos cuando no lo tiene. Verificar con regresiones de render en web sobre los dos casos.
- [ ] 4.2 Listado de recurrencias, web y nativo: agrupar por el estado **mostrado** y no por `recurrences.status`, de modo que una regla agotada no se cuente entre las activas. Verificar con una regresión sobre una regla con `status = 'active'` y su límite gastado.
- [ ] 4.3 Comprobar que ampliar el límite devuelve la regla a activa y que quitarlo la vuelve indefinida, sin ninguna otra operación. Verificar con una regresión que recorra la mutación real, no sólo el cálculo.
- [ ] 4.4 Comprobar que `recurrences.status` NO se reescribe en ninguno de los caminos anteriores. Verificar leyendo la columna antes y después en la regresión del 4.3.

## 5. Cierre

- [ ] 5.1 `pnpm verify` en verde, y la suite de recurrences también con `TZ=America/Argentina/Buenos_Aires`.
- [ ] 5.2 QA manual en las dos plataformas: crear una regla con límite por cada uno de los tres caminos de alta, ver el avance en la ficha, ampliar el límite y comprobar que vuelve a activa.
- [ ] 5.3 Archivar el change y aplicar el delta al spec maestro de `transactions`.
- [ ] 5.4 `pnpm openspec:check` en verde.
- [ ] 5.5 Avisar al usuario que ya puede corregir `Plan de pago - 11 cuotas` desde la app, cambiando su límite de 1 a 11 — sin borrarla ni recrearla, para que el plan conserve una sola historia.
