# Recorte de alcance — propuesta

**Estado: PROPUESTA, sin aprobar.** No modifica todavía `proposal.md` ni `tasks.md`. Si se aprueba,
se aplica sobre esos dos y este archivo se borra.

El motivo es el tamaño: la branch lleva **51 commits y +6.740 líneas**, y todavía no produce **ningún
cambio visible** para el usuario. El #96 sigue abierto. Una entrega que no termina en comportamiento
no se puede validar contra el uso real, que fue de dónde salió todo esto.

---

## Bloque 1 — Lo estrictamente necesario para cerrar #96

**La prueba de aceptación, en términos de uso:** una regla con varios vencimientos sin revisar los
muestra **todos**, uno sin resolver **no traba** a los siguientes, no aparece **ninguno duplicado**,
se ven en **web y en nativo**, y cada uno se resuelve **por separado y en cualquier orden**.

| # | Qué | Por qué es indispensable |
|---|---|---|
| B1.1 | Aplicar `0064` (identidad `due_date` + piso `reconstruct_from`) | Sin identidad no hay forma de saber cuál vencimiento es cuál, y sin piso el generador no sabe desde dónde reconstruir |
| B1.2 | Generador que materializa **la lista** de vencidos, en tandas acotadas | Es el arreglo del #96 |
| B1.3 | **Migración de activación** (retira `recurrence_instances_one_pending_per_rule`) | Sin esto la base sigue admitiendo una sola pendiente por regla |
| B1.4 | Adaptar los reads que asumen una pendiente por regla | Si no, la base tiene varias y la app muestra una |
| B1.5 | Mover **dashboard, «próximo», proyección y deshacer** a leer los vencimientos existentes | Es el requisito de **«sin duplicados»**: si la proyección sigue avanzando desde el cursor, cuenta dos veces lo ya materializado (familia de #118) |
| B1.6 | Dejar de escribir `last_generated_date` (`1.5`) + el test real de orden (`1.8`) | Cierra la cadena; sin esto conviven dos fuentes de verdad |
| B1.7 | Materialización y bloque «por revisar» en **web y nativo** (`4.1`, `4.2`, `4.3`) | El requisito de visibilidad en las dos plataformas |
| B1.8 | Copy: **«vencimientos por revisar»** (`2.6`) | Behaviour 2: lo que falta revisar no puede afirmar que se debe esa plata. Es texto, cuesta poco y evita mentirle al usuario |

Resolver individualmente y fuera de orden **ya funciona**: `confirmRecurrenceInstance` y
`skipRecurrenceInstance` operan por instancia. Lo único que falta es que haya varias y que se vean.

### Simplificación propuesta, a decidir

`2.1b` (versiones de cronograma) y `2.1d` (pausas) están en el mínimo **solo si el generador tiene que
componer varios segmentos de calendario**. Propongo evitarlo: que **el piso absorba la edición y la
pausa**.

- Al editar frecuencia / intervalo / `start_date`, el trigger mueve `reconstruct_from` a la fecha de
  la edición.
- Al reanudar una pausa, lo mueve a la fecha de reanudación.

El generador sigue leyendo **un** cronograma, el vigente, y **nunca camina a través de una edición o
de una pausa**. Es estrictamente conservador: nunca fabrica atraso, y a lo sumo pierde atraso
legítimo del tramo anterior a la edición. Es el mismo criterio de la decisión 21 («no reconstruir
nada anterior al último punto conocido, porque suponerlo fabrica atraso que quizá nunca existió») y
cumple la decisión 16 («pausar no acumula deuda») sin leer la tabla de pausas.

Las tablas `recurrence_schedule_versions` y `recurrence_pauses` **se siguen escribiendo** —`0064` ya
lo hace— y quedan como cimiento del change posterior que sí componga segmentos. No se tira nada.

**Costo del recorte:** un usuario que edita la frecuencia con atraso pendiente pierde ese atraso en
vez de verlo con el calendario viejo. Hoy lo pierde igual, porque el bug lo traba entero.

---

## Bloque 2 — Trabajo ya hecho que este arreglo necesita

Nada de esto se descarta: es exactamente el cimiento del Bloque 1.

| Qué | Dónde |
|---|---|
| Migración `0064`: identidad, piso, guardas, dual-write del historial, verificación transaccional §4b | `supabase/migrations/0064_…` |
| Caminante por aritmética, sin el techo de 750 pasos | `packages/money-logic/src/recurrences.ts` |
| `owedOccurrences`: qué vencimientos debe una regla sobre un segmento | idem + `owed-occurrences.test.ts` |
| `max_occurrences` unificado contra el calendario, sin conteo de filas | idem + `max-occurrences.test.ts` |
| Decisión de anclaje resuelta con la auditoría (61 reglas, 0 desfasadas) | `docs/qa/auditoria-fase-cursor.sql` |
| Harness PGlite + regresiones de migración, transición y guarda de fase | `packages/recurrences/__tests__/` |
| Tipos de Supabase y sección `8.1J` de `validate_schema.sql` | `packages/supabase/`, `supabase/` |
| Relevamiento de los 15 defectos | `docs/qa/relevamiento-recurrencias-2026-09-03.md` |

---

## Bloque 3 — A changes posteriores

| Qué | Tareas actuales | Nuevo change propuesto |
|---|---|---|
| Pago anticipado («ya lo pagué») | `3.1`, `3.2` | `recurrence-early-payment` |
| Vinculación («ya lo cargué»), incluida la compartida | `3.3`, `3.3b` | `recurrence-link-movement` |
| Deshacer, cerrando **#104** | `3.4` | `recurrence-undo` |
| Historial enriquecido (vencimiento / pago / carga por separado) | `3.5`, `3.6` | `recurrence-history` |
| Resolución masiva «ponerse al día», con fila por ocurrencia | `2.4`, `2.5` | `recurrence-catch-up` |
| «Usar este importe de acá en más» | `2.4b` | idem |
| Composición de segmentos: versiones de cronograma y pausas leídas por el generador | `2.1b`, `2.1d` | `recurrence-schedule-history` |
| Agrupar por regla y colapsar el resto | `2.3` | UX, con el anterior |
| UX avanzada: aviso de historial incompleto, reintento de materialización, sellado de pausadas, paridad nativa del form de resolución | `2.1c`, `4.4`–`4.7`, `4.5b`, `4.5c` | `recurrence-review-ux` |
| Retiro de `scheduled_date` (migración C) | `5.4` | ya estaba fuera |

**#118** (doble conteo del dashboard) sigue como arreglo independiente. Ojo: **B1.5 lo toca de
cerca**, así que conviene coordinarlos o hacer #118 primero.

---

## Cómo dividir la branch en entregas revisables

51 commits y +6.740 líneas en una sola revisión no es revisable. Propongo **tres PRs encadenados**,
cada uno con una propiedad clara: los dos primeros **no cambian ningún comportamiento**, y el tercero
es el que se ve.

### PR 1 — Núcleo puro, sin migración *(~1.100 líneas, todo `packages/`)*
El caminante, `owedOccurrences`, `max_occurrences` por ordinal, el anclaje en el calendario, y sus
tests. **No toca la base ni ninguna pantalla.** Se revisa como lógica pura y se mergea solo.

### PR 2 — Modelo persistente *(~1.500 líneas, `supabase/` + tipos + harness)*
`0064`, los tipos, `8.1J`, el harness PGlite y las regresiones de migración. **Se aplica y no cambia
ningún comportamiento** — es la mitad «expansión» del par. Se puede desplegar y dejar reposar.

### PR 3 — El arreglo visible *(a escribir)*
Bloque 1 completo: generador, activación, reads, las cuatro superficies del cursor, web y nativo.
Termina en el comportamiento de la prueba de aceptación. Si queda grande, se parte en **3a** (base:
generador + activación + reads) y **3b** (superficie: web, nativo, copy).

Los documentos (`design.md`, `proposal.md`, el relevamiento, la auditoría) van con el **PR 1**, para
que el contexto entre primero.

**Lo ya mergeado a `main`, cero.** La branch está entera sin mergear, así que la división es
mecánica: `git checkout -b` desde `main` y cherry-pick por área, sin reescribir historia ajena.
