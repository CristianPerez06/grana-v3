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
| B1.2 | Generador que materializa **la lista** de vencidos, **en tandas de 50 que el usuario puede continuar sin cerrar la app** (`2.1e`) | Es el arreglo del #96. La tanda no alcanza sola: una regla diaria con un año de atraso son ~8 tandas, y nadie va a abrir y cerrar la app ocho veces para ver su propio historial. El mínimo incluye **indicar en pantalla cuánto falta** y una acción **«Continuar reconstrucción»** que procesa la siguiente tanda en el momento; sin eso, «mostrarlos todos» no se cumple |
| B1.3 | **Versiones de cronograma y pausas leídas por el generador** (`2.1b`, `2.1d`) | Sin esto, editar la frecuencia o pausar fabrica vencimientos que nunca existieron. Ver «Simplificación rechazada» |
| B1.4 | Adaptar los reads que asumen una pendiente por regla | Si no, la base tiene varias y la app muestra una |
| B1.5 | Mover **dashboard, «próximo», proyección y deshacer** a leer los vencimientos existentes | Es el requisito de **«sin duplicados»**, y **cierra #118** — ver abajo |
| B1.6 | Dejar de escribir `last_generated_date` (`1.5`) + el test real de orden (`1.8`) | **Acá se completa «resolver fuera de orden»**, no antes |
| B1.7 | Materialización y bloque «por revisar» en **web y nativo** (`4.1`, `4.2`, `4.3`) | El requisito de visibilidad en las dos plataformas |
| B1.8 | Copy: **«vencimientos por revisar»** (`2.6`) | Behaviour 2: lo que falta revisar no puede afirmar que se debe esa plata. Es texto, cuesta poco y evita mentirle al usuario |
| B1.9 | **Error de materialización visible, con reintento** (`4.5b`, versión básica) | No es UX avanzada: hoy `queries.ts:367` hace `if (!insertError) created += 1` y descarta **cualquier** fallo en silencio. Si uno ocurre, Julieta ve «ningún vencimiento» y concluye que el #96 sigue roto. El mínimo tiene que **distinguir «falló» de «no hay nada»** y ofrecer reintentar; el diseño elaborado puede esperar |
| B1.10 | **Gate de versión mínima en el cliente nativo** (`2.8b`) | Requisito para activar, no una mejora. Un usuario que se quede en la app vieja nunca ejecuta el generador nuevo: su atraso no se materializa y el #96 **sigue vivo para él**, ahora sin el índice que lo contenía. `tasks.md` da dos opciones — gate de versión mínima o generación del lado del servidor (etapa 2 de la decisión 8); **para este recorte el gate es la más chica**, y la generación en servidor queda para un change posterior |
| B1.11 | **Migración de activación** (retira `recurrence_instances_one_pending_per_rule`) | Sin esto la base sigue admitiendo una sola pendiente por regla. **Va última, y solo cuando B1.2–B1.10 están desplegadas**: el índice es lo único que hoy impide el estado intermedio en que la base tiene varias pendientes y el software todavía muestra una sola o duplica importes |

> **Por qué la activación es la ÚLTIMA fila y no la cuarta.** Retirar el índice es irreversible en la
> práctica: en cuanto se retira, la base empieza a admitir varias pendientes por regla. Todo lo que las
> lea sin estar adaptado —reads, dashboard, «próximo», proyección, web, nativo, y el cliente viejo que
> nunca se actualizó— pasa a mostrar una sola o a duplicar importes. Ese estado es el que la cabecera
> de `0064` describe como **peor que el bug actual**. El orden correcto es: primero todo el software
> capaz de convivir con varias pendientes, incluido el gate que garantiza que no queden clientes
> incapaces, y recién entonces se retira el índice.

### Resolver fuera de orden todavía NO funciona de punta a punta

`confirmRecurrenceInstance` y `skipRecurrenceInstance` operan **por instancia**, pero las dos siguen
escribiendo un **cursor global** (`last_generated_date`). Mientras eso siga, resolver agosto antes que
julio mueve el cursor más allá de julio y el flujo real no se comporta como el núcleo puro. La
propiedad está probada en `owedOccurrences` (`out-of-order-resolution.test.ts`), pero **el
comportamiento se completa recién en B1.6**, y su test de punta a punta depende de eso — por eso
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

**B1.5 es, en la práctica, el arreglo de #118.** Mover el dashboard a leer los vencimientos existentes
es exactamente lo que elimina el doble conteo. Recomendación: **#118 forma parte del mínimo** y se
cierra con esta entrega, en vez de arreglarse aparte y volver a tocarse.

*Alternativa, si se quiere alivio antes:* hacer #118 primero como parche independiente. Es válido,
pero B1.5 vuelve sobre el mismo código, así que el trabajo se hace dos veces y hay riesgo de conflicto
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
| UX avanzada: aviso de historial incompleto, sellado de pausadas, paridad nativa del form de resolución, y el **diseño elaborado** del error de materialización | `2.1c`, `4.4`–`4.7`, `4.5c` | idem |
| Generación del lado del servidor (etapa 2 de la decisión 8) | `2.8b`, opción larga | `recurrence-server-generation` |
| Retiro de `scheduled_date` (migración C) | `5.4` | ya estaba fuera |

`2.1b` y `2.1d` **no** están acá: quedaron en el mínimo. `4.5b` tampoco, en su versión básica —
mostrar que falló y poder reintentar—; lo que se difiere es la presentación cuidada. De `2.8b` se
difiere **solo** la generación en servidor: el gate de versión mínima queda en el mínimo (B1.10),
porque sin él no se puede activar. La generación en servidor sigue siendo deseable —cubre además a
quien no abre la app—, pero no es lo más chico que cierra el #96.

---

## Cómo dividir la branch en entregas revisables

51 commits y +6.740 líneas en una sola revisión no es revisable. **Cuatro PRs encadenados**, en un
orden que separa lo aditivo de lo que cambia comportamiento **y respeta las dependencias de
despliegue**. Son cuatro PRs pero **tres ventanas de producción**: PR 1 por su cuenta, **PR 2 y PR 3
juntos** (ver abajo), y PR 4.

> **El orden importa más que el tamaño.** Una versión anterior de este documento ponía el cambio de
> anclaje ANTES de `0064`, y eso es inseguro: la verificación transaccional que protege ese cambio
> —§4b, que aborta si alguna regla se desfasó— **vive dentro de esa migración**. Desplegar el cambio
> primero deja una ventana sin guarda alguna. La guarda va antes de lo que guarda.

### PR 1 — Aditivo puro *(~1.000 líneas)*
`owedOccurrences` y sus tests, los tests de resolución fuera de orden, y **toda la documentación**
(`design.md`, `proposal.md`, el relevamiento, la auditoría, los deltas de spec).
**Nada de esto lo llama nadie todavía**, así que la afirmación «no cambia comportamiento» es
verificable: la única función nueva no tiene callers.

### PR 2 — Modelo persistente *(~1.900 líneas)* · **va antes que el PR 3**
`0064`, los tipos, `8.1J`, el harness PGlite y las regresiones de migración, transición y guarda de
fase. **Se aplica y no cambia ningún comportamiento** — es la mitad «expansión» del par, y eso es
verificable: la migración deja vivo el índice de pendiente única.
Va acá, y no después, porque **trae la guarda §4b** que el PR 3 necesita: revalida en su propia
transacción que ninguna regla quedó desfasada, y aborta si eso cambió desde la auditoría.

### PR 3 — Cambios de comportamiento en el núcleo *(~700 líneas)*
Lo que **sí cambia lo que el usuario ve**, y se revisa como tal — no como refactor:

| Cambio | Efecto observable | Evidencia |
|---|---|---|
| Caminante sin el techo de 750 pasos | Una regla diaria de tres años proyectaba hasta `2024-09-26`, 347 días antes del horizonte; ahora llega a hoy | `walk-positioning.test.ts` |
| `max_occurrences` por ordinal | Una regla nacida de un movimiento con tope 3 producía **4** ocurrencias; ahora produce 3 | `max-occurrences.test.ts` |
| Próxima fecha anclada en el calendario | Sin efecto en producción (auditoría: 0 de 61 divergentes); cambia para reglas desfasadas futuras | auditoría + §4b del PR 2 |
| Se retira `materializedCount` y su consulta | Una consulta menos por corrida del generador | `queries.ts` |

Los cuatro son **arreglos**, no regresiones, pero ninguno es neutro.

> **Los PR 2 y 3 se revisan por separado, pero se despliegan juntos.** No es una preferencia: la
> guarda §4b corre **una sola vez**, dentro de la transacción de `0064`. Verifica que ninguna regla
> esté desfasada *en ese instante* y no vuelve a mirar. Si alguien edita una recurrencia entre el
> despliegue del PR 2 y el del PR 3, el dato puede volver a desfasarse **después** de la verificación
> y **antes** de que exista el anclaje en el calendario que la vuelve inofensiva — y en esa ventana
> nada lo detecta. Partirlos para revisar está bien; partirlos para desplegar, no. **Una sola ventana
> de producción**, y dentro de ella `0064` primero.

### PR 4 — El arreglo visible *(a escribir)* · **no se parte antes de la activación**
Bloque 1 completo, **en el orden de la tabla B1**: generador con tandas continuables, versiones y
pausas, reads, las cuatro superficies del cursor, error visible con reintento, web y nativo, copy,
gate de versión nativa, y **al final** la migración de activación. Termina en la prueba de aceptación.

**Se mantiene unido.** Activar el backlog en una parte y dejar las pantallas para otra crea un
intervalo en el que la base tiene varias pendientes y la app **muestra una sola o duplica importes** —
exactamente el estado que la cabecera de `0064` describe como «peor que el bug actual», y el doble
conteo de #118 encima.

Si por tamaño hubiera que partirlo igual, **la activación queda en la ÚLTIMA parte** (B1.11), después
de adaptar lectores, dashboard, web y nativo y de que el gate de versión (B1.10) esté desplegado:
primero todo el software capaz de convivir con varias pendientes, y recién entonces se retira el
índice.

**Lo ya mergeado a `main`: cero.** La branch está entera sin mergear, así que la división es mecánica:
`git checkout -b` desde `main` y cherry-pick por área, sin reescribir historia ajena.
