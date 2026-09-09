# Recorte de alcance — versión definitiva

**Estado: para aprobar.** No modifica todavía `proposal.md` ni `tasks.md`. Aprobado esto, se aplica
sobre esos dos y este archivo se borra.

El motivo del recorte es el tamaño: la branch lleva **51 commits y +6.740 líneas**, y todavía no
produce **ningún cambio visible**. El #96 sigue abierto. Una entrega que no termina en comportamiento
no se puede validar contra el uso real, que fue de dónde salió todo esto.

---

## Bloque 1 — Lo estrictamente necesario para cerrar #96

**Prueba de aceptación, en términos de uso:** una regla con varios vencimientos sin revisar los
muestra **todos**, uno sin resolver **no traba** a los siguientes, no aparece **ninguno duplicado**,
se ven en **web y en nativo**, y cada uno se resuelve **por separado y en cualquier orden**.

| # | Qué | Por qué es indispensable |
|---|---|---|
| B1.1 | Aplicar `0064` (identidad `due_date` + piso `reconstruct_from`) | Sin identidad no hay forma de saber cuál vencimiento es cuál, y sin piso el generador no sabe desde dónde reconstruir |
| B1.2 | Generador que materializa **la lista** de vencidos, en tandas acotadas | Es el arreglo del #96 |
| B1.3 | **Versiones de cronograma y pausas leídas por el generador** (`2.1b`, `2.1d`) | Sin esto, editar la frecuencia o pausar fabrica vencimientos que nunca existieron. Ver «Simplificación rechazada» |
| B1.4 | **Migración de activación** (retira `recurrence_instances_one_pending_per_rule`) | Sin esto la base sigue admitiendo una sola pendiente por regla |
| B1.5 | Adaptar los reads que asumen una pendiente por regla | Si no, la base tiene varias y la app muestra una |
| B1.6 | Mover **dashboard, «próximo», proyección y deshacer** a leer los vencimientos existentes | Es el requisito de **«sin duplicados»**, y **cierra #118** — ver abajo |
| B1.7 | Dejar de escribir `last_generated_date` (`1.5`) + el test real de orden (`1.8`) | **Acá se completa «resolver fuera de orden»**, no antes |
| B1.8 | Materialización y bloque «por revisar» en **web y nativo** (`4.1`, `4.2`, `4.3`) | El requisito de visibilidad en las dos plataformas |
| B1.9 | Copy: **«vencimientos por revisar»** (`2.6`) | Behaviour 2: lo que falta revisar no puede afirmar que se debe esa plata. Es texto, cuesta poco y evita mentirle al usuario |

### Resolver fuera de orden todavía NO funciona de punta a punta

`confirmRecurrenceInstance` y `skipRecurrenceInstance` operan **por instancia**, pero las dos siguen
escribiendo un **cursor global** (`last_generated_date`). Mientras eso siga, resolver agosto antes que
julio mueve el cursor más allá de julio y el flujo real no se comporta como el núcleo puro. La
propiedad está probada en `owedOccurrences` (`out-of-order-resolution.test.ts`), pero **el
comportamiento se completa recién en B1.7**, y su test de punta a punta depende de eso — por eso
`1.8` sigue abierta.

### Simplificación del piso: RECHAZADA

Se propuso que `reconstruct_from` absorbiera ediciones y pausas, para evitar componer segmentos de
calendario. **Se rechaza**, por tres razones:

1. **Pierde vencimientos legítimos.** Julio y agosto quedan ocultos por el bug; la regla se pausa en
   septiembre y se reanuda en octubre. Si el piso salta a octubre, **julio y agosto desaparecen para
   siempre**.
2. **Contradice la aceptación** y la regla de que lo anterior a la pausa siga disponible y resoluble.
3. **Exigiría desarmar la inmutabilidad de `reconstruct_from`**, que `0064` ya garantiza por trigger
   y que tiene 10 casos de regresión bajo el rol `authenticated`.

En consecuencia, `2.1b` y `2.1d` **quedan dentro del mínimo** (B1.3).

### #118 se cierra dentro de esta entrega

**B1.6 es, en la práctica, el arreglo de #118.** Mover el dashboard a leer los vencimientos existentes
es exactamente lo que elimina el doble conteo. Recomendación: **#118 forma parte del mínimo** y se
cierra con esta entrega, en vez de arreglarse aparte y volver a tocarse.

*Alternativa, si se quiere alivio antes:* hacer #118 primero como parche independiente. Es válido,
pero B1.6 vuelve sobre el mismo código, así que el trabajo se hace dos veces y hay riesgo de conflicto
entre ramas.

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

| Qué | Tareas actuales | Change propuesto |
|---|---|---|
| Pago anticipado («ya lo pagué») | `3.1`, `3.2` | `recurrence-early-payment` |
| Vinculación («ya lo cargué»), incluida la compartida | `3.3`, `3.3b` | `recurrence-link-movement` |
| Deshacer, cerrando **#104** | `3.4` | `recurrence-undo` |
| Historial enriquecido (vencimiento / pago / carga por separado) | `3.5`, `3.6` | `recurrence-history` |
| Resolución masiva «ponerse al día» | `2.4`, `2.5` | `recurrence-catch-up` |
| «Usar este importe de acá en más» | `2.4b` | idem |
| Agrupar por regla y colapsar el resto | `2.3` | `recurrence-review-ux` |
| UX avanzada: aviso de historial incompleto, reintento de materialización, sellado de pausadas, paridad nativa del form de resolución | `2.1c`, `4.4`–`4.7`, `4.5b`, `4.5c` | idem |
| Retiro de `scheduled_date` (migración C) | `5.4` | ya estaba fuera |

`2.1b` y `2.1d` **no** están acá: quedaron en el mínimo.

---

## Cómo dividir la branch en entregas revisables

51 commits y +6.740 líneas en una sola revisión no es revisable. **Cuatro PRs encadenados.** La
división separa lo aditivo de lo que cambia comportamiento, en vez de agrupar por carpeta.

### PR 1 — Aditivo puro *(~1.000 líneas)*
`owedOccurrences` y sus tests, los tests de resolución fuera de orden, y **toda la documentación**
(`design.md`, `proposal.md`, el relevamiento, la auditoría, los deltas de spec).
**Nada de esto lo llama nadie todavía**, así que la afirmación «no cambia comportamiento» es
verificable: la única función nueva no tiene callers.

### PR 2 — Cambios de comportamiento en el núcleo *(~700 líneas)*
Acá va lo que **sí cambia lo que el usuario ve**, y se revisa como tal — no como refactor:

| Cambio | Efecto observable | Evidencia |
|---|---|---|
| Caminante sin el techo de 750 pasos | Una regla diaria de tres años proyectaba hasta `2024-09-26`, 347 días antes del horizonte; ahora llega a hoy | `walk-positioning.test.ts` |
| `max_occurrences` por ordinal | Una regla nacida de un movimiento con tope 3 producía **4** ocurrencias; ahora produce 3 | `max-occurrences.test.ts` |
| Próxima fecha anclada en el calendario | Sin efecto en producción (auditoría: 0 de 61 divergentes); cambia para reglas desfasadas futuras | auditoría + `max-occurrences.test.ts` |
| Se retira `materializedCount` y su consulta | Una consulta menos por corrida del generador | `queries.ts` |

Los cuatro son **arreglos**, no regresiones, pero ninguno es neutro. Van juntos porque el tercero es
lo que vuelve inalcanzable el fallback del segundo.

### PR 3 — Modelo persistente *(~1.900 líneas)*
`0064`, los tipos, `8.1J`, el harness PGlite y las regresiones de migración, transición y guarda de
fase. **Se aplica y no cambia ningún comportamiento** — es la mitad «expansión» del par, y eso sí es
verificable: la migración deja vivo el índice de pendiente única.

### PR 4 — El arreglo visible *(a escribir)*
Bloque 1 completo. Termina en la prueba de aceptación. Si queda grande, se parte en **4a** (base:
generador con versiones y pausas + activación + reads) y **4b** (superficie: dashboard y las otras
tres lecturas, web, nativo, copy) — con el corte en B1.6, que es donde entra #118.

**Lo ya mergeado a `main`: cero.** La branch está entera sin mergear, así que la división es mecánica:
`git checkout -b` desde `main` y cherry-pick por área, sin reescribir historia ajena.
