# Design: fix-recurrence-backlog

## Context

El módulo descansa hoy sobre un invariante: **una sola instancia pendiente por regla a la vez**,
escrito en el índice `recurrence_instances_one_pending_per_rule` (`0011_recurring_movements.sql`),
en `decideRecurrenceInstance` (paso 1, `has_pending`) y en el spec de `transactions`.

Ese invariante compra algo real —nunca hay dos ítems preguntando lo mismo— y paga un precio que nadie
había medido: la cadena **se corta**, no se atrasa. Y como todo el resto del módulo se apoyó en él,
sacarlo no es cambiar un índice. Tres cosas dependen de que solo pueda haber una:

1. **El cursor.** Confirmar y omitir escriben `last_generated_date = instance.scheduled_date`
   incondicionalmente (`mutations.ts:443` y `:500`). Con una sola pendiente siempre se resuelve la más
   vieja, así que el cursor solo avanza. Con backlog, resolver agosto y después julio lo hace
   **retroceder**, y el generador vuelve a proponer agosto.
2. **La identidad.** Confirmar escribe `scheduled_date: effective.scheduled_date` (`mutations.ts:415`),
   o sea la fecha que el usuario eligió. La ocurrencia pierde su vencimiento original, así que la
   fecha no sirve para identificarla.
3. **Los tipos y los reads.** `getPendingInstancesByRecurrenceId` devuelve un
   `Map<string, RecurrenceInstance>` —uno por regla— y `RecurrenceSummary.pending_instance` es
   singular. Si no se adaptan, parte del atraso existe en la base y es invisible en pantalla.

Por eso el change tiene una etapa de cimientos antes de la funcionalidad visible. No es prolijidad:
sin ella, el arreglo al #96 fabrica duplicados.

## Goals / Non-Goals

**Goals**

- Que un vencimiento sin revisar no bloquee los siguientes.
- Que se pueda registrar un pago antes del vencimiento, sin correr el calendario.
- Que se pueda vincular un movimiento ya cargado, sin duplicar el gasto.
- Que se pueda resolver el atraso en bloque, corrigiendo fecha, importe y cuenta de cada uno.
- Que vencimiento, fecha de pago y fecha de carga sean tres datos distintos y sobrevivan los tres.
- Paridad completa web ↔ nativo.

**Non-Goals**

- Recordatorios, push y mail. Necesitan la generación del lado del servidor, que acá llega en su forma
  mínima; el sistema de avisos es su propio change.
- Registro automático de débitos. Ver decisión 6.
- Ajuste de importes por índice, importes estimados, calendarios avanzados, pausa con fecha.
- Reconstruir los meses cerrados. Ver decisión 7.
- El doble conteo de Compromisos (#118): independiente, ticket propio.

## Decisions

### 1. El invariante correcto es "una instancia por ocurrencia", no "una pendiente por regla"

**Recomendación.** Reemplazar el invariante. Lo que hay que impedir es que la **misma ocurrencia**
exista dos veces; "una pendiente por regla" era una aproximación grosera de eso que además rompe el
calendario.

**Un índice parcial sobre `(recurrence_id, scheduled_date) WHERE status = 'pending'` NO alcanza**, y
conviene decirlo porque fue la primera propuesta: al confirmarse, la fila sale del índice parcial y
la ocurrencia queda desprotegida. La restricción tiene que valer en **todos** los estados.

**Recomendación concreta:** una columna `due_date` que guarda el vencimiento **derivado del
calendario** —nunca lo que el usuario elija al pagar— con `UNIQUE (recurrence_id, due_date)` sin
cláusula `WHERE`. `scheduled_date` deja de ser identidad y pasa a ser lo que siempre debió ser: la
fecha del movimiento.

### 2. El avance de la generación se separa de la resolución de un pago

**Recomendación.** Resolver un pago **no** escribe el cursor. Que hoy `confirmRecurrenceInstance` use
el `scheduled_date` original en vez de la fecha elegida es correcto pero insuficiente: el problema no
es *qué* fecha escribe, es *que escriba*.

El generador deriva qué falta materializar del cronograma de la regla y del conjunto de ocurrencias
ya existentes —que ahora tienen identidad—, no del último pago registrado. Así, resolver fuera de
orden es naturalmente seguro en vez de serlo por convención.

`last_generated_date` se conserva por compatibilidad de lectura durante la migración y deja de ser
la fuente de verdad del generador.

### 3. Tres fechas, tres campos

**Recomendación.** Separar explícitamente:

| Dato | Qué es | Quién lo fija |
|---|---|---|
| **Vencimiento** (`due_date`) | Cuándo tocaba | El calendario de la regla. Inmutable. |
| **Fecha de pago** | Cuándo salió la plata | El usuario. Es la fecha del movimiento. |
| **Fecha de carga** | Cuándo se registró en la app | El sistema (`resolved_at`). |

Sin esto no hay identidad estable (decisión 1) ni historial que pueda contestar "¿qué vencimiento
pagué el 3 de septiembre?".

### 4. Pagar antes no mueve el calendario

**Recomendación.** Registrar el pago de una ocurrencia **resuelve esa ocurrencia**; la siguiente sale
del cronograma de la regla, no del pago. Si el alquiler vence el 23 y se paga el 3, el próximo vence
el 23 del mes siguiente.

**Alternativa descartada:** recalcular el ciclo desde el pago real. Con eso, alguien que paga unos
días antes ve la fecha correrse hacia atrás mes a mes hasta desfasarse del alquiler de verdad. Puede
tener sentido como *modalidad* de otra clase de recurrencia ("cada 30 días desde el último pago"),
pero no como comportamiento por defecto y no en esta entrega.

### 5. El límite del backlog es tanda y presentación, nunca alcance del modelo

**Recomendación.** Distinguir tres cosas que una versión anterior confundía en un solo número:

| | Qué es | Quién decide |
|---|---|---|
| Tamaño de tanda | De a cuántas materializa el generador por corrida | Implementación |
| Tope visual | Cuántas se muestran antes de agrupar el resto | Diseño |
| Alcance del modelo | Cuántas ocurrencias la app reconoce | **Ninguna se pierde** |

**La ocurrencia vigente siempre entra.** Un generador que tome "las N más viejas" de un atraso largo
dejaría sin materializar la de este mes — que es exactamente el #96 otra vez, con otro número. Si hay
tanda, se ordena de modo que lo vigente nunca quede afuera.

### 6. Un débito programado no prueba que el débito ocurrió

**Recomendación.** No auto-confirmar. Un débito automático se rechaza por falta de fondos, cambia de
importe o se ejecuta otro día. Son dos funciones distintas: **avisar que esperabas un débito** es
planificación y es segura; **registrar que ocurrió** necesita confirmación del usuario o evidencia
del movimiento.

Un registro automático puede existir más adelante como opción explícita, revisable y reversible. No
es la solución al bloqueo del #96 y queda fuera de esta entrega.

### 7. El pasado no se re-proyecta; se marca como incompleto y se puede completar

**Recomendación.** No reconstruir automáticamente los meses cerrados: usaría los montos de hoy,
perdería las reglas retiradas e inventaría las creadas después.

Lo que sí corresponde es decirlo — *"estos meses tienen información incompleta, podés registrar los
pagos que falten"* — y dejar que el usuario los complete con datos reales.

**Precisión contable que conviene no perder:** crear una instancia pendiente **no mueve ningún
saldo**. El saldo se mueve al crear un movimiento confirmado. Lo que una pendiente sí cambia es la
vista de compromisos, y para meses cerrados el cambio es real, porque bajo el lente `snapshot` el
total cuenta las instancias materializadas `pending` **y** `confirmed`.

### 8. La generación deja de depender de por dónde navegaste — en su forma mínima

**Recomendación en dos etapas, de las cuales acá entra la primera:**

- **Etapa 1 (en este change):** que la materialización corra en cualquier pantalla de la app, en web y
  en nativo, en vez de solo en `/transactions` y el hub. Es chico y tapa la mayor parte del síntoma.
- **Etapa 2 (fuera):** un proceso del lado del servidor (`pg_cron` o equivalente) que corra sin que
  nadie abra la app. Es condición para los avisos y para que las recurrencias compartidas del hogar
  se materialicen sin depender de qué miembro entró. `pg_cron` es *una* arquitectura posible, no un
  requisito; la elección es del change que lo traiga.

### 9. Deshacer y omitir son dos operaciones, no una

**Recomendación.** Definirlas acá aunque el #104 las implemente:

- **Deshacer un pago** — "me equivoqué al cargarlo". El movimiento se borra y la ocurrencia **vuelve
  a estar por revisar**.
- **Omitir un vencimiento** — "este período no corresponde". La ocurrencia queda resuelta sin pago y
  no se espera ninguno.

El plan actual del #104 convierte siempre el pago borrado en `skipped` para esquivar el índice
`one_pending_per_rule`. Con ese índice eliminado la restricción desaparece, así que **este change
tiene que ir primero** o el #104 tiene que escribirse ya contra el modelo nuevo.

## Risks / Trade-offs

- **La app se va a ver más cargada.** Reglas hoy trabadas van a mostrar varios vencimientos. Es el
  dato real apareciendo. Mitigación: agrupar, rotular "por revisar" y ofrecer resolución en bloque
  desde el primer día — no después.
- **Migración con datos vivos.** Hay que derivar el `due_date` de instancias ya confirmadas cuyo
  `scheduled_date` fue pisado. Para esas, el vencimiento original **no es recuperable**: se deriva del
  cronograma de la regla y se acepta que puede no coincidir con lo que pasó. Afecta solo al historial,
  no a montos ni saldos.
- **Colisión con #104.** Los dos tocan la misma restricción. Hay que ordenarlos explícitamente.
- **Superficie amplia.** Toca money-logic, el paquete de recurrencias, dos apps y una migración. Se
  mitiga con las etapas de `tasks.md`, no partiendo el change: los ocho comportamientos son un solo
  entregable y separarlos dejaría la etapa de cimientos sin nada que un usuario pueda validar.

## Migration Plan

1. Agregar `due_date` y poblarlo derivándolo del cronograma de cada regla.
2. Agregar `UNIQUE (recurrence_id, due_date)` una vez poblado y verificado sin colisiones.
3. Eliminar `recurrence_instances_one_pending_per_rule`.
4. Dejar de escribir `last_generated_date` desde confirmar y omitir; conservar la columna durante la
   transición.

Supabase es online-only: se aplica desde el SQL Editor y se regeneran los tipos. La migración corre
en una transacción.

## Open Questions

Decisiones de **producto** que siguen abiertas. Ninguna bloquea empezar por los cimientos.

1. **¿Hasta dónde hacia atrás?** Si una regla arrancó en 2024 y nunca se usó, ¿se le muestra todo el
   historial de ocurrencias o se corta en algún punto? Recomendación: cortar, pero el punto lo define
   el uso real.
2. **¿La primera carga cuenta como pago?** Al marcar un movimiento como recurrente con un límite de
   pagos, ¿ese movimiento es el pago 1 o el 0? Hoy el código dice 0 (y genera uno de más), la
   proyección dice otra cosa. **Más que elegir entre dos comportamientos, hay que rotularlo sin
   ambigüedad en pantalla**: "12 pagos en total" o "12 repeticiones además de esta".
3. **¿Qué pasa durante una pausa?** Hoy reanudar retoma desde la última fecha resuelta y puede
   recuperar los períodos de la pausa. ¿Es lo que se espera, o una pausa debe descartarlos?
4. **¿Un pendiente de una regla pausada se muestra?** Recomendación: sí, sellado como "Pausada" —
   esconderlo sacaría de la vista algo que todavía se puede querer resolver.
