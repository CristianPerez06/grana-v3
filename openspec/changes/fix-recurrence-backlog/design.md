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
- Que vencimiento, fecha de pago, fecha de carga y fecha de resolución sean cuatro instantes
  distintos y sobrevivan los cuatro.
- Paridad completa web ↔ nativo.

**Non-Goals**

- Recordatorios, push y mail. Necesitan la generación del lado del servidor, que acá llega en su forma
  mínima; el sistema de avisos es su propio change.
- Registro automático de débitos. Ver decisión 6.
- Ajuste de importes por índice, importes estimados, calendarios avanzados, pausa con fecha.
- Crear movimientos históricos automáticamente, o reconstruir vencimientos anteriores al horizonte.
  Ver decisión 7.
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
cláusula `WHERE`.

`scheduled_date` **se retira**. Una versión anterior de este documento decía que "pasa a ser la fecha
del movimiento", y eso no cierra: una ocurrencia sin resolver todavía no tiene pago, así que no puede
tener fecha de pago. Durante la transición queda como alias de lectura de `due_date` y después se
elimina; en ningún momento se convierte en fecha de pago.

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

| Dato | Dónde vive | Quién lo fija |
|---|---|---|
| **Vencimiento** | `recurrence_instances.due_date` | El calendario de la regla. Inmutable. |
| **Fecha de pago** | `transactions.date` | El usuario. |
| **Fecha de carga** | `transactions.created_at` | El sistema. |
| **Fecha de resolución** | `recurrence_instances.resolved_at` | El sistema, al registrar o vincular. |

Son **cuatro**, no tres, y ninguno se deriva de otro. Una ocurrencia sin resolver tiene únicamente
vencimiento: los otros tres nacen al resolverla. Sin esta separación no hay identidad estable
(decisión 1) ni historial que pueda contestar "¿qué vencimiento pagué el 3 de septiembre?".

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

**El horizonte, en cambio, sí es un límite del modelo y hay que fijarlo.** Una versión anterior de
este documento dejaba el spec pidiendo "todas las ocurrencias vencidas" mientras la decisión 7 decía
que el pasado no se reconstruye: las dos reglas no se pueden cumplir a la vez.

**Recomendación: 12 meses hacia atrás desde hoy, inclusive.** Cubre un ciclo anual completo —una
regla anual entra— y evita materializar años de una regla abandonada. Tres precisiones que hacen
falta para implementarlo sin ambigüedad:

- **Inclusivo**: una ocurrencia que cae exactamente en el límite entra.
- **Calculado con la fecha financiera argentina** (`getTodayAR()`), como todo el resto del módulo.
  `current_date` a secas está prohibido: Supabase corre en UTC.
- **Aplica solo a la reconstrucción automática.** El usuario siempre puede registrar a mano un pago
  más viejo; el horizonte limita lo que la app materializa sola, no lo que la persona puede cargar.

**El horizonte no acota el volumen por sí solo, y conviene decirlo.** Doce meses de una regla diaria
son ~365 ocurrencias; una cada 3 días, ~122. Por eso el horizonte va acompañado de dos cosas
distintas: **materialización por tandas acotadas** —abrir Inicio nunca dispara cientos de escrituras;
la tanda se completa a lo largo de sucesivas aperturas, con la ocurrencia vigente siempre primero— y
**agrupación en la presentación**, para que el usuario vea un grupo y no 365 filas.

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

Dentro del horizonte de 12 meses (decisión 5) las ocurrencias sí se materializan, y conviene ser
explícito sobre qué son: **elementos por revisar, no movimientos**. No tocan ningún saldo ni el gasto
del mes hasta que el usuario las resuelva. Más allá del horizonte no se materializa nada y el período
queda señalado.

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

### 9. Corregir un importe afecta un vencimiento, no la regla

**Recomendación.** El importe que el usuario ajusta al resolver vale **solo para ese vencimiento**.

Hoy no es así: `confirmRecurrenceInstance` propaga el importe corregido a la regla
(`mutations.ts:446`). Con una sola pendiente por vez eso pasaba por conveniente; con resolución en
bloque es directamente incorrecto — resolver junio, julio y agosto con importes distintos dejaría la
regla con el que se guardó último, un resultado que **depende del orden de ejecución**.

Actualizar la regla pasa a ser una acción explícita y aparte —"Usar este importe de acá en más"—,
aplicada **una sola vez** y tomando el importe del vencimiento más reciente del grupo, no el del
último que se procesó.

### 10. Un cambio de calendario rige desde una fecha y no reinterpreta el pasado

**Recomendación.** Editar la frecuencia, el intervalo o el día de una regla SHALL tener una fecha de
vigencia, y las ocurrencias anteriores a esa fecha se leen con el calendario que regía entonces.

**Por qué importa ahora y antes no:** el generador nuevo deriva lo que falta comparando el cronograma
de la regla contra los vencimientos ya existentes. Si la frecuencia cambió, el cronograma actual
proyectado hacia atrás no coincide con el historial, y el generador leería esa diferencia como huecos
— fabricando vencimientos que nunca correspondieron. Con el invariante viejo el problema no existía
porque el generador nunca miraba hacia atrás.

**Alternativa descartada:** recalcular todo el historial con el calendario nuevo. Reescribe el pasado
y rompe la identidad de ocurrencias ya resueltas.

### 11. La resolución en bloque es atómica

**Recomendación.** Todo o nada. Un grupo a medio aplicar deja al usuario sin saber qué se guardó, con
movimientos creados y vencimientos sin resolver mezclados, y sin forma de repetir la operación sin
duplicar.

Es además coherente con cómo el repo ya trata las operaciones compuestas (alta de cuotas, compra con
tarjeta): orquestador con rollback en `@grana/transactions-mutations`.

### 12. Un fallo de materialización se muestra, no se descarta

**Recomendación.** Hoy el error se traga con un `catch` vacío y la pantalla queda idéntica a "no
tenés nada por revisar". Un fallo de lectura o de generación SHALL distinguirse de la ausencia de
vencimientos, con un aviso y la posibilidad de reintentar.

No es cosmético: es la diferencia entre "estás al día" y "no sabemos", y hoy la app dice lo primero
cuando pasa lo segundo.

### 13. Vincular a una regla compartida no puede alterar la deuda en silencio

**Recomendación.** Vincular un movimiento existente a una ocurrencia de una regla **compartida** solo
se acepta si el movimiento ya tiene un reparto compatible con el de la regla. Si no lo tiene, el
sistema explica que va a convertirlo en gasto compartido con ese reparto y pide confirmación
explícita.

La conversión y la vinculación SHALL ser una sola operación atómica: un movimiento convertido a
compartido pero no vinculado deja la deuda del hogar movida por algo que el usuario no aprobó.

**Alternativa descartada:** vincular sin tocar el reparto. Dejaría una ocurrencia compartida resuelta
por un gasto personal, con la deuda del hogar sin reflejarla — el módulo Compartido mostraría menos
de lo que corresponde, en silencio.

### 14b. Un movimiento vinculado se rotula como vinculado, no como originado

**Recomendación.** Un movimiento que existía antes de la recurrencia NO SHALL mostrarse como
"originado en esta recurrencia": no lo originó, el usuario lo cargó por su cuenta. El rótulo correcto
es **"vinculado a esta recurrencia"**. La distinción es la misma que gobierna deshacer (decisión 14)
y tiene que ser visible, no solo interna.

### 14. Deshacer distingue lo que la recurrencia creó de lo que el usuario vinculó

**Recomendación.** La ocurrencia SHALL registrar **cómo** se resolvió:

| Cómo se resolvió | Qué hace deshacer |
|---|---|
| La recurrencia **creó** el movimiento | Lo elimina y devuelve la ocurrencia a sin resolver. |
| El usuario **vinculó** uno suyo | **Conserva el movimiento** —vuelve a ser suelto— y desvincula. |

Sin ese dato, deshacer una vinculación borraría un movimiento que la recurrencia nunca creó. Es la
razón por la que "deshacer" no puede implementarse como una sola operación.

**Y el caso compartido agrega una tercera rama.** Si al vincular el sistema convirtió un movimiento
personal en compartido (decisión 13), deshacer tiene que revertir también esa conversión —devolverlo
a personal y deshacer la deuda que generó—, no solo romper el vínculo. Si el movimiento **ya era**
compartido antes de vincularse, la conversión no ocurrió y deshacer únicamente desvincula. La
reversión y la desvinculación SHALL ser atómicas: un movimiento desvinculado que quedó compartido
dejaría la deuda del hogar movida por una operación que el usuario deshizo.

| Cómo se resolvió | Qué hace deshacer |
|---|---|
| `created` | Elimina el movimiento. |
| `linked`, ya era compartido (o la regla no lo es) | Conserva el movimiento y desvincula. |
| `linked`, convertido a compartido al vincular | Conserva el movimiento, **revierte la conversión y la deuda**, y desvincula. |

### 15. Deshacer y omitir son dos operaciones, no una

**Recomendación.** Definirlas acá aunque el #104 las implemente:

- **Deshacer la resolución** — "me equivoqué". La ocurrencia **vuelve a estar por revisar**, y qué
  pasa con el movimiento depende de cómo se había resuelto (decisión 14): si lo **creó** la
  recurrencia se elimina; si el usuario había **vinculado** uno suyo, se conserva y solo se
  desvincula. Deshacer NO es sinónimo de eliminar.
- **Omitir un vencimiento** — "este período no corresponde". La ocurrencia queda resuelta sin pago y
  no se espera ninguno.

El plan actual del #104 convierte siempre el pago borrado en `skipped` para esquivar el índice
`one_pending_per_rule`. Con ese índice eliminado la restricción desaparece.

**Por eso el #104 se implementa dentro de este change y cierra con él.** Una versión anterior lo
dejaba "para después" en el design mientras el spec y las tareas ya lo incluían — una contradicción.
Separarlo obligaría a escribir el arreglo del #104 contra un modelo que este change está por
reemplazar, para reescribirlo enseguida.

### 16. Una pausa no acumula deuda: lo que pasó durante la pausa no se recupera

**Recomendación.** Pausar significa "esto no está corriendo", no "esto se sigue devengando y me lo
vas a cobrar todo junto después".

- Los vencimientos que **caen durante la pausa** NO se materializan, y al reanudar **no se recuperan**.
- Los que **ya existían antes** de pausar siguen visibles y resolubles, con sello "Pausada": son
  vencimientos reales que el usuario todavía puede querer registrar u omitir.
- Al reanudar, el sistema toma el **próximo vencimiento futuro respetando el calendario original**.
  Una regla mensual del día 23 pausada en junio y reanudada el 5 de septiembre vuelve con el 23 de
  septiembre, no con junio, julio y agosto.

**Por qué importa definirlo ahora y no después de la migración:** el generador nuevo deriva lo que
falta comparando el cronograma contra las ocurrencias existentes. Sin una regla explícita, los
períodos de una pausa se leerían exactamente como huecos —igual que un cambio de frecuencia
(decisión 10)— y al reanudar aparecería de golpe todo el período pausado como atraso. Es el mismo
defecto con otra causa.

**Alternativa descartada:** recuperar los vencimientos de la pausa. Convierte "pausar" en "diferir", y
nadie pausa un gimnasio en enero esperando que en marzo le aparezcan las cuotas de enero y febrero.

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
  mitiga con las etapas de `tasks.md`, no partiendo el change: los once comportamientos son un solo
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

No queda ninguna. La última —qué pasa durante una pausa— se cerró en la revisión funcional y está
en la decisión 16, porque afecta al modelo que se está diseñando y no podía esperar a la migración.

### Cerradas durante la revisión funcional

Cuatro preguntas que una versión anterior listaba como abiertas ya estaban decididas en el spec o en
las tareas, lo que dejaba al implementador sin saber qué regía. Quedan cerradas acá:

- **Horizonte hacia atrás** → 12 meses (decisión 5). Antes de eso, período señalado como incompleto.
- **¿La primera carga cuenta como pago?** → **Sí.** "12 pagos en total" incluye el movimiento que
  creó la regla; el sistema materializa 11 más. Y el rótulo en pantalla dice "en total", sin
  ambigüedad.
- **¿Se muestra el vencimiento de una regla pausada?** → **Sí, con sello "Pausada".** Esconderlo
  sacaría de la vista algo que el usuario todavía puede querer resolver.
- **¿Qué pasa durante una pausa?** → decisión 16.
