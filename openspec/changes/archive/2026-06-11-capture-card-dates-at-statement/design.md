# Design — capture-card-dates-at-statement

## Context

El banco anuncia las fechas del ciclo siguiente recién al cerrar el ciclo actual: el extracto de P(n) trae cierre+vencimiento de P(n) **y** los de P(n+1). El sistema hoy pide las fechas un período antes de ese anuncio en ambos flujos: el alta exige P1 **y P2**, y el pago de P(n) exige **P(n+2)**. Toda fecha futura entra adivinada por el usuario y se persiste con `is_estimated=false`.

La maquinaria para hacerlo bien ya existe y no se toca:

- **Generación lazy** de períodos al vuelo con `is_estimated=true` cuando un consumo cae fuera de los períodos conocidos (spec cards, requirement "al menos un período abierto").
- **`suggestNextPeriodDates`** (`packages/money-logic/src/cards.ts:125`): proyección por promedio de hasta 3 ciclos previos, fallback +30/+45 días.
- **UPSERT sobre `(account_id, start_date)`** en `payCardPeriod`: ya pisa un período auto-generado con fechas del usuario.
- **Cascada de edición de fechas** con reasignación de transacciones entre períodos vecinos.

`start_date` nunca es dato del usuario: siempre es `end_date` del período anterior + 1 día (conocido con certeza). Lo único estimable es `end_date`/`due_date`.

## Goals / Non-Goals

**Goals:**

- El alta pide únicamente las 2 fechas que el usuario tiene en mano (cierre y vencimiento del resumen actual).
- Cada fecha real se captura en el único momento en que el banco la anunció: el pago de P(n) **confirma** las fechas de P(n+1), no inventa las de P(n+2).
- Entre el cierre de P(n) y su pago, los consumos caen en el período estimado sin intervención del usuario.
- El estado "estimado" se vuelve visible donde se gestiona la tarjeta (detalle y edición) e invisible donde solo se lee (hero, dashboard).
- Invariante de UI preservado: siempre existe el período siguiente al en-curso (el paso "Próximo" del timeline nunca desaparece).

**Non-Goals:**

- No se migra ningún dato de producción: períodos con fechas adivinadas y `is_estimated=false` quedan como están (corregibles por edición o por el nuevo flujo de pago).
- No se cambia el modelo de períodos explícitos por una "regla de ciclo" (día del mes); el modelo actual es más preciso para deuda real.
- No se toca el `start_date = cierre − 30 días` de P1 en el alta (limitación conocida: consumos previos a esa ventana no caen en P1; fuera de alcance).
- No se toca el algoritmo de sugerencia ni la generación lazy.
- Mobile: sin trabajo (cards es web-only).

## Decisions

### D1 — El período siguiente al en-curso existe siempre, estimado (eager, no lazy)

En el alta se crea P2 con `is_estimated=true` proyectado desde P1; en cada pago se crea P(n+2) estimado proyectado desde P(n+1) confirmado. Alternativa considerada: dejar todo a la generación lazy. Se descarta porque el timeline del detalle renderiza el paso "Próximo" y el orden de cards usa el cierre del período activo — con lazy puro esas superficies quedan con huecos hasta el primer consumo del ciclo. El costo del eager es una fila por evento y la lazy sigue cubriendo el resto de los casos (consumos lejanos, etc.).

### D2 — El pago confirma P(n+1) vía la ruta de edición de fechas, no un insert nuevo

El form de pago muestra las fechas estimadas del ciclo en curso pre-llenadas y el usuario las corrige con el extracto en mano. La persistencia reusa la semántica de edición de fechas de período (la misma cascada y validaciones ya especificadas):

- Confirmar = actualizar `end_date`/`due_date` de P(n+1) + `is_estimated=false`.
- Si el cierre real es **anterior** al estimado, los consumos de P(n+1) que quedan fuera del rango se reasignan al período siguiente (cascada existente; si no existe, la generación del P(n+2) eager de esta misma operación los recibe).
- Si P(n+2) ya existía estimado y sin movimientos/pago, y el nuevo cierre lo invadiera, se **re-proyecta** (start = nuevo cierre + 1, end/due re-estimados) en lugar de rechazar — el rechazo del spec de edición protege períodos con datos reales, no proyecciones vacías.

Alternativa considerada: mantener el upsert por colisión de `start_date`. Funciona para el caso feliz pero no reubica transacciones cuando el cierre real difiere del estimado; la ruta de edición ya resuelve eso.

### D3 — Validación del pago re-anclada al período que se confirma

`payCardPeriodSchema` conserva `next_end_date`/`next_due_date` (nombres y shape) pero su semántica pasa a ser "fechas de P(n+1)". La action valida `next_end_date > P(n).end_date` (el inicio de P(n+1) es fijo) y `next_due_date > next_end_date`, en lugar del actual `> max(end_date)` que presupone P(n+2).

### D4 — Señalización "estimado" discreta y solo en superficies de gestión

Badge/nota "fechas estimadas" en el timeline del detalle (`lifecycle-timeline.tsx`) y en el drawer de edición (`edit-card-form.tsx`), más el copy de confirmación en el form de pago. No se señaliza en el hero de `/cards` ni en el dashboard: son superficies de lectura y el ruido no ayuda a decidir nada ahí.

### D5 — Sin migración de datos

No hay forma de distinguir qué fechas futuras existentes son reales y cuáles adivinadas. Marcar retroactivamente `is_estimated=true` a todo período futuro sin pago calumniaría fechas bien cargadas. Las tarjetas existentes convergen solas: al pagar su próximo resumen, el nuevo form les confirma las fechas del ciclo en curso.

## Risks / Trade-offs

- [La primera proyección de P2 en el alta es gruesa (un solo ciclo de historial, con P1.start sintético de −30d)] → Aceptable: es explícitamente estimada, el consumo nunca queda huérfano, y se confirma con fechas reales en el primer pago. Mejora sola con historial.
- [Usuarios que SÍ conocen las fechas del próximo ciclo en el alta ya no pueden cargarlas ahí] → Pueden corregir el estimado desde el drawer de edición (flujo ya existente); es el trade-off correcto para optimizar el caso común.
- [Cambio de semántica de `payCardPeriod` sobre tarjetas viejas: el form pasa de pedir P(n+2) a confirmar P(n+1) ya cargado como real] → Es el comportamiento deseado: brinda la oportunidad de corregir la fecha adivinada. El pre-llenado muestra lo persistido, no una proyección nueva.
- [Re-proyección silenciosa de P(n+2) estimado al confirmar P(n+1)] → Solo aplica a períodos estimados sin movimientos ni pago; cualquier dato real activa la cascada/rechazo existente.

## Open Questions

(ninguna — decisiones cerradas en sesión de explore del 2026-06-11)
