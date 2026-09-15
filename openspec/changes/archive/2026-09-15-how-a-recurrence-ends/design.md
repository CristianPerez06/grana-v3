## Context

Ver `proposal.md` — Why para la motivación, y `specs/transactions/spec.md` para lo que el sistema tiene que hacer.

Lo que condiciona el cómo:

- **El límite ya se guarda y ya corta la generación.** `max_occurrences` funciona; lo que falta es preguntarlo bien, mostrarlo y derivar el final de él. Ninguna fila se reescribe: la única migración del cambio es aditiva y es la función SQL de la decisión 2.
- **Ya existe la forma correcta de contar.** `recurrence_positions_spent(p_id, p_today)` (migración `0068`) devuelve las posiciones gastadas de **una** regla. Hoy la llama sólo el detalle (`packages/recurrences/src/queries.ts:295`) y el RPC que valida la fecha de referencia.
- **El caminante de calendario es compartido y ya compone todo.** `walkOccurrences` / `forEachComposedOccurrence` (`@grana/money-logic`) honra versiones de cronograma, pausas, el piso de reconstrucción y el offset del tope. Es el mismo que produce las fechas reales.
- **Nativo ya resolvió la mitad de la UI.** `RecurrenceForm.tsx` tiene el campo en su propia sección y filtra dígitos. Web tiene que alinearse, no rediseñar.
- **Los dos caminos «Hacer recurrente» comparten un hook.** `useMovementForm` (`@grana/movement-form`) es el mismo en web y nativo, así que la condición de fin entra una sola vez para las dos plataformas.

## Goals / Non-Goals

**Goals:**

- Que el estado mostrado y el avance de una regla tengan **una sola definición**, consumida por el detalle, el listado y cualquier superficie futura.
- Que el listado resuelva el estado de N reglas **sin N llamadas** a la base.
- Que la condición de fin entre una vez por camino de alta, no una vez por plataforma.

**Non-Goals:**

- No se toca la generación de instancias: el corte por límite ya existe y funciona.
- No se agrega una columna ni un estado nuevo a `recurrences`.
- No se rediseña el formulario de alta más allá de la pregunta de fin.

## Decisions

### 1. El estado mostrado se deriva en TypeScript puro, en `@grana/money-logic`

La función recibe **si el calendario de la regla tiene alguna ocurrencia por delante** —la respuesta del caminante, evaluada **como si una regla pausada se reanudara hoy**, porque una pausa abierta hace que no produzca ninguna fecha y preguntarle sin más daría por finalizada a toda regla pausada—, más la condición de fin de la regla, las posiciones gastadas y los vencimientos sin resolver. Devuelve el estado mostrado y el avance. No consulta nada: recibe.

Ese primer dato es el que **decide** el final; los otros dicen **cómo** terminó y qué queda por hacer.

**Por qué ahí y no en SQL**: el spec exige que ampliar o quitar el límite recalcule el estado *sin operación adicional*, y que el caminante que calcula el último vencimiento previsto sea el mismo que produce las fechas reales. Ese caminante ya vive en `@grana/money-logic` y no tiene gemelo en SQL — mover la derivación a la base obligaría a escribirlo dos veces, que es exactamente el patrón que `AGENTS.md` prohíbe («No duplicate, hand-synced logic»).

**Por qué no en cada app**: sería el mismo cálculo en web y en nativo, sincronizado a mano.

**Alternativa considerada — una vista SQL que devuelva el estado**: resuelve el listado de una, pero necesita reimplementar el caminante en PL/pgSQL para el último vencimiento previsto. Descartada por lo anterior.

### 2. Las posiciones gastadas de muchas reglas se piden en UNA llamada

`recurrence_positions_spent` responde por una regla. El detalle puede seguir llamándola así; el listado no, o pagaría una ida a la base por fila.

**Decisión**: agregar una función SQL que reciba el conjunto de reglas del usuario y devuelva sus posiciones gastadas en una sola respuesta, implementada **llamando a `recurrence_positions_spent` por fila internamente** — no reescribiendo su lógica. Una sola definición del conteo, dos formas de pedirlo.

**La frontera es la misma que la de la función individual, y no se hereda sola.** La nueva función SHALL ser `SECURITY INVOKER`, de modo que la RLS del llamador siga siendo la autorización: una función `DEFINER` que recibe una lista de ids devolvería las posiciones de reglas de **otro** usuario a quien las pida. Sus privilegios SHALL declararse explícitamente —`REVOKE` para `PUBLIC` y para `anon`, `GRANT EXECUTE` sólo para `authenticated`—, porque Postgres otorga EXECUTE a `PUBLIC` por defecto y Supabase además le da `anon` acceso directo: no declararlo deja la función abierta sin que nada lo indique. Eso ya nos pasó y por eso existe la migración `0067`.

`validate_schema.sql` SHALL fijar la firma, el cuerpo y esos privilegios, como ya hace con `recurrence_positions_spent` — una función que se puede reemplazar sin que nadie lo note es una frontera que no existe.

**Por qué no contar en el cliente**: es el error que el spec prohíbe explícitamente y que ya costó dos rondas en #121 — una regla sembrada no tiene fila para su primera ocurrencia.

**Por qué no aceptar el N+1**: el hub lista todas las reglas del usuario (64 en la base real). Sesenta y cuatro llamadas por pantalla es una regresión de rendimiento que además crece con el uso.

**Alternativa considerada — traer las instancias y contar en TS**: descartada por lo mismo que arriba. El conteo por filas está mal por definición.

### 3. La pregunta de fin es un componente por plataforma sobre un modelo compartido

El modelo —tres respuestas excluyentes y qué envía cada una— vive en un lugar compartido, con su propia función que traduce la respuesta elegida al par `(end_date, max_occurrences)` que la mutación espera. El dibujo es propio de cada plataforma, como manda la política web↔nativo.

**Esto es lo que hace cumplible «lo que no se ve no se guarda»**: hoy el bug existe porque el formulario arma el payload campo por campo, y un campo oculto sigue teniendo valor. Si el payload se deriva de *cuál respuesta está elegida*, un valor escrito y después descartado no tiene por dónde colarse — deja de ser un descuido posible y pasa a ser imposible por construcción.

**Alternativa considerada — mantener los campos sueltos y limpiar el estado al cambiar de opción**: funciona, pero deja la corrección a cargo de que alguien se acuerde de limpiar. Es el mismo tipo de arreglo que ya falló.

### 4. Para los caminos «Hacer recurrente», la condición de fin entra en `useMovementForm`

Es un hook compartido: agregar ahí el estado y el envío lo resuelve en web y en nativo a la vez. Cada app dibuja su control.

`create-recurrence-from-movement.ts:154` ya acepta `max_occurrences` y lo pasa a la regla, así que del orquestador para abajo no hay nada que cambiar.

## Risks / Trade-offs

**La función batch se desincroniza de la individual** → se implementa llamando a la individual por fila, no copiando su cuerpo. Si la definición del conteo cambia, cambia en un solo lugar.

**El estado derivado se calcula en cada lectura y el listado tiene muchas reglas** → el caminante ya tiene un horizonte acotado y un presupuesto de pasos; el trabajo por regla es el mismo que el hub ya hace hoy para calcular la próxima fecha.

**Reglas que hoy figuran como activas van a pasar a finalizadas sin que el usuario haya hecho nada** → es el efecto buscado, pero puede leerse como que la app «apagó» algo. El detalle explica el porqué mostrando el avance y el último vencimiento previsto, y ampliar el límite la devuelve a activa de inmediato.

**Cambiar la forma del alta puede romper reglas que se creaban bien** → la pregunta de fin entra con regresiones que cubren las tres respuestas en los tres caminos, y el caso que originó el ticket (escribir un límite y después elegir «sin límite») queda pinchado explícitamente.

## Migration Plan

**Una migración, ninguna migración de datos.** Ninguna fila se reescribe: `max_occurrences` ya existe y las reglas guardadas conservan el valor que tienen. El estado derivado cambia lo que se muestra desde el primer despliegue, sin escribir nada.

La migración es la función SQL batch de la decisión 2, aditiva: crea una función nueva, con sus `REVOKE`/`GRANT`, y no toca ninguna existente. Su número se elige contra `main` al momento de escribirla, no contra el árbol de trabajo.

Orden del despliegue, como en `0068`: aplicar la migración a mano en el dashboard, validar el esquema, y recién después desplegar el código que la consume.

La regla real del usuario (`Plan de pago - 11 cuotas`, con límite 1) se corrige **desde la app** una vez desplegado esto, no con SQL: así conserva su historia en una sola regla.
