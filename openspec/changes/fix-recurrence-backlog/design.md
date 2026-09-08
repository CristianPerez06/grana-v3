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
- **Retirar `scheduled_date`.** Se conserva escribiéndose en paralelo; su eliminación es una entrega
  posterior, cuando ya no queden clientes nativos instalados que lo usen. Ver decisión 17.
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

### 3. Cuatro instantes, cuatro campos

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

Lo que sí corresponde es decirlo **en la recurrencia** — *"esta recurrencia tiene historial anterior
a septiembre de 2025 que Grana no reconstruyó"* — y dejar que el usuario complete lo que quiera con
datos reales. El aviso NO habla del mes: afirmar que un mes tiene información incompleta sería falso
si el usuario cargó esos pagos a mano en su momento.

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

### 22. "Todo o nada" significa una transacción de Postgres, no rollback compensatorio

El repo resuelve hoy las operaciones compuestas con orquestadores que **compensan** —crean, y si algo
falla borran lo creado—. Para tres operaciones de este change eso no alcanza:

- **ponerse al día** (N movimientos + N resoluciones),
- **convertir a compartido + vincular**,
- **deshacer una vinculación que había convertido** (revertir el reparto + desvincular).

El problema del rollback compensatorio es que **el rollback también puede fallar**: si la red se corta
después de crear tres movimientos, la compensación no corre y el usuario queda con movimientos
creados y ocurrencias sin resolver, sin forma de repetir la operación sin duplicar.

Las tres SHALL implementarse como **RPC de Postgres** (`SECURITY INVOKER`, para que RLS siga
aplicando), de modo que la atomicidad la dé la transacción y no el código de compensación. Es el
camino que el repo ya usa para las lecturas compuestas (`get_movements_page`,
`get_account_balance_sums`), aplicado ahora a escrituras.

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

**Recomendación.** Tres casos, y solo dos se aceptan:

| El movimiento… | Qué pasa |
|---|---|
| ya tiene un **reparto compatible** con el de la regla | Se vincula directo. |
| es **personal** (sin reparto) | Se explica que va a convertirse en gasto compartido con el reparto de la regla, y se pide confirmación explícita. |
| ya es compartido con **otro hogar u otro reparto** | **No se ofrece como candidato.** |

El tercer caso se excluye en vez de convertirse: reemplazar un reparto existente destruye una deuda
que el otro miembro ya ve, y deshacerlo exigiría persistir y restaurar un estado compartido
arbitrario. Excluirlo cuesta un candidato menos en una lista; convertirlo cuesta un modelo de
reversión entero para un caso que casi no ocurre. Si el usuario realmente quiere ese movimiento ahí,
puede arreglar su reparto primero y vincularlo después.

Esa restricción es la que permite que `linked_conversion` sea un booleano y no un snapshot (ver
"Modelo persistente").

La conversión y la vinculación SHALL ser una sola operación atómica: un movimiento convertido a
compartido pero no vinculado deja la deuda del hogar movida por algo que el usuario no aprobó.

**Alternativa descartada:** vincular sin tocar el reparto. Dejaría una ocurrencia compartida resuelta
por un gasto personal, con la deuda del hogar sin reflejarla — el módulo Compartido mostraría menos
de lo que corresponde, en silencio.

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

### 14b. Un movimiento vinculado se rotula como vinculado, no como originado

**Recomendación.** Un movimiento que existía antes de la recurrencia NO SHALL mostrarse como
"originado en esta recurrencia": no lo originó, el usuario lo cargó por su cuenta. El rótulo correcto
es **"vinculado a esta recurrencia"**. La distinción es la misma que gobierna deshacer (decisión 14)
y tiene que ser visible, no solo interna.

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

## Modelo persistente

El comportamiento estaba definido y la persistencia no. Cuatro de las once reglas nuevas no se pueden
sostener con las tablas de hoy, y dos de ellas —vigencia del calendario y pausas— **no pueden vivir
en el frontend**: el generador las necesita para decidir qué materializar, y corre del lado del dato.

### `recurrence_instances` — tres columnas nuevas

| Columna | Para qué | Nota |
|---|---|---|
| `due_date` DATE NOT NULL | Identidad de la ocurrencia (decisión 1) | `UNIQUE (recurrence_id, due_date)`, sin `WHERE` |
| `resolution_kind` TEXT NULL | `created` \| `linked` — qué hace deshacer (decisión 14) | Ver la tabla de estados |
| `linked_conversion` BOOLEAN NOT NULL DEFAULT false | Si al vincular se convirtió el movimiento a compartido | Sin esto, deshacer no sabe si debe revertir la conversión (decisión 14) |

`resolution_kind` **no aplica a `skipped`**: omitir resuelve la ocurrencia sin ningún movimiento, así
que no hay nada que deshacer. La combinación válida es una sola por estado, y va enforced en la base:

| `status` | `resolution_kind` | `linked_conversion` |
|---|---|---|
| `pending` | `NULL` | `false` |
| `confirmed` | `created` \| `linked` | `true` solo si `linked` |
| `skipped` | `NULL` | `false` |

```sql
constraint chk_recurrence_instances_resolution_kind check (
  (status = 'confirmed' and resolution_kind in ('created','linked'))
  or (status in ('pending','skipped') and resolution_kind is null)
),
constraint chk_recurrence_instances_linked_conversion check (
  linked_conversion = false or resolution_kind = 'linked'
)
```

**Ojo con el orden**: estas constraints NO pueden entrar en la migración de expansión (decisión 17).
Un cliente nativo viejo que confirme una instancia no escribe `resolution_kind` y las violaría. Entran
en la **activación**, cuando el trigger de compatibilidad ya no hace falta.

`linked_conversion` es un booleano y no un snapshot del estado anterior a propósito: la decisión 13
(revisada abajo) restringe la conversión al caso **personal → compartido con el reparto de la regla**,
así que revertir es "volver a personal", no "restaurar un reparto arbitrario". Esa restricción es
justamente lo que evita tener que persistir un estado compartido complejo.

### `recurrence_schedule_versions` — el calendario a lo largo del tiempo

Un cambio de frecuencia rige desde una fecha y no reinterpreta el pasado (decisión 10). Eso obliga a
que la regla deje de tener **un** cronograma y pase a tener una **historia** de cronogramas:

```
recurrence_schedule_versions
  recurrence_id    → recurrences(id) ON DELETE CASCADE
  effective_from   DATE NOT NULL      -- desde cuándo rige esta versión
  interval_count   INT  NOT NULL
  interval_unit    TEXT NOT NULL
  anchor_date      DATE NOT NULL      -- el ancla del clamping de fin de mes
  UNIQUE (recurrence_id, effective_from)
```

El caminante resuelve, para cada fecha, la versión vigente en ese momento. La migración crea **una
versión por regla existente**, con `effective_from = start_date` y los valores actuales: el
comportamiento no cambia para ninguna regla de hoy.

Las columnas `interval_count` / `interval_unit` / `frequency` se conservan en `recurrences` como la
versión **vigente** —las lee la UI, y el `CHECK` de coherencia preset↔intervalo (migración 0053)
sigue aplicando— pero dejan de ser la fuente de verdad del generador.

### `recurrence_pauses` — los intervalos de pausa

Un vencimiento que cae durante una pausa no existe (decisión 16). Para que el generador lo sepa,
la pausa tiene que ser un **intervalo persistido**, no un `status` que solo dice "ahora está pausada":

```
recurrence_pauses
  recurrence_id  → recurrences(id) ON DELETE CASCADE
  paused_from    DATE NOT NULL
  resumed_at     DATE NULL           -- NULL = pausa abierta
```

`recurrences.status = 'paused'` se conserva para la UI y para el filtro del generador; el intervalo es
lo que impide que el período pausado se lea como huecos al reanudar. La migración crea una fila
abierta para cada regla hoy pausada, con `paused_from` desconocido — se usa la fecha de la migración,
y se acepta: son pocas reglas y el efecto es que su período pausado previo no se descarta, que es el
comportamiento actual.

### Decisión 17 · Expansión y activación son migraciones distintas

Una versión anterior decía "todo en una transacción" y a la vez exigía desplegar web y nativo antes
de eliminar el índice de pendiente única. **Las dos cosas no pueden ser ciertas**: entre la migración
y el despliegue pasa tiempo, y durante ese tiempo la base tiene que sostener el modelo viejo.

Son dos migraciones, con un despliegue en el medio:

| | Migración | Qué hace | Comportamiento |
|---|---|---|---|
| **A · Expansión** | `00XX_recurrence_identity_expand.sql` | Columnas, tablas nuevas, backfill, trigger de compatibilidad | **Sin cambios.** El índice de pendiente única sigue vivo. |
| — | *(despliegue de web y nativo con el modelo nuevo)* | | |
| **B · Activación** | `00XY_recurrence_backlog_activate.sql` | Elimina el índice, agrega las constraints de `resolution_kind`, habilita el backlog | El backlog empieza a existir. |
| **C · Retiro** | entrega posterior | Retira `scheduled_date` y el trigger | — |

**"Nativo desplegado" no significa "todos actualizaron".** Una app instalada no se actualiza porque
apliquemos una migración, y los clientes viejos dependen de `last_generated_date` y de una pendiente
singular. Dos mecanismos, complementarios:

- **Compatibilidad por trigger (obligatorio).** La expansión instala un `BEFORE INSERT OR UPDATE` en
  `recurrence_instances` que, cuando el cliente no los provee, deriva `due_date` de `scheduled_date`
  y pone `resolution_kind = 'created'` al pasar a `confirmed`. Una escritura de un cliente viejo
  produce así una fila válida en el modelo nuevo sin que el cliente sepa nada. Se retira en C.
- **Versión mínima (recomendado).** Un gate de versión mínima al arrancar la app nativa. No hace
  falta para la integridad —de eso se ocupa el trigger— pero sí para la **experiencia**: un cliente
  viejo sigue mostrando una sola ocurrencia por regla, así que con el backlog activo el usuario vería
  una parte de su atraso sin saber que hay más.

### Decisión 17b · Retirar `scheduled_date` es gradual, no parte de esta entrega

`scheduled_date` no se puede borrar en esta migración: **hay clientes nativos instalados** que siguen
leyéndolo y escribiéndolo, y una app móvil no se actualiza cuando se aplica una migración. La
secuencia segura, y lo que entra en cada tramo:

| Paso | Qué | ¿En esta entrega? |
|---|---|---|
| 1 | Agregar y poblar `due_date` | **Sí** |
| 2 | Mantener `scheduled_date` escribiéndose en paralelo | **Sí** |
| 3 | Desplegar web y nativo leyendo y escribiendo el modelo nuevo | **Sí** |
| 4 | Quitar `recurrence_instances_one_pending_per_rule` una vez que **todos** los reads aceptan colecciones | **Sí**, al final |
| 5 | Retirar `scheduled_date` | **No** — entrega posterior |

El paso 4 va al final y no al principio: sacar el índice antes de que los reads acepten colecciones
haría que la base permita el backlog mientras la app sigue mostrando una sola ocurrencia — el atraso
existiría y sería invisible, que es peor que el bug actual.

### Decisión 21 · La migración no sabe qué cronograma rigió antes, y no lo inventa

Dos suposiciones que una versión anterior hacía calladas, y las dos fabrican atraso falso:

- Crear la versión de calendario con `effective_from = start_date` y la frecuencia **actual** afirma
  que esa frecuencia rigió desde el principio. Si la regla se editó alguna vez —y no hay historial de
  ediciones para saberlo— el generador leería como huecos las ocurrencias del calendario viejo.
- Usar la fecha de la migración como `paused_from` de una regla ya pausada deja **fuera** del
  intervalo de pausa todo lo anterior, así que al reanudar aparecería como atraso — exactamente lo
  que la decisión 16 prohíbe.

**Política conservadora: no reconstruir nada anterior al último punto conocido.** `recurrences` gana
`reconstruct_from DATE NOT NULL`, que la migración puebla así:

| Estado de la regla | `reconstruct_from` |
|---|---|
| Activa | `COALESCE(last_generated_date, start_date)` — el cursor es, por definición, "hasta acá ya está cubierto" |
| Pausada | la **fecha de la migración** — nada anterior se reconstruye |

El generador NUNCA materializa antes de `GREATEST(reconstruct_from, borde del horizonte)`. Y la
versión de calendario que crea la migración se marca **asumida**
(`recurrence_schedule_versions.is_assumed = true`), que se lee como: *no sabemos qué cronograma rigió
antes de `reconstruct_from`*. Las versiones que cree el usuario al editar no llevan esa marca.

Esto significa que **ninguna regla existente estrena backlog retroactivo con esta migración**: el
backlog se acumula desde la migración hacia adelante. Es una pérdida deliberada y menor —el atraso
que ya existía sigue sin reconstruirse— a cambio de no inventar vencimientos que quizá nunca
existieron. Reconstruir hacia atrás con certeza es imposible: el dato no está.

### Decisión 18 · El backfill aborta ante ambigüedad, no adivina

"Verificar que no haya colisiones" no es una política. Al derivar `due_date` de instancias cuyo
`scheduled_date` fue pisado al confirmar (D14), dos instancias de la misma regla **pueden** caer en el
mismo vencimiento.

La migración SHALL: derivar, **detectar** las colisiones, y si hay alguna **abortar la transacción
entera** emitiendo un informe con `recurrence_id`, las instancias en conflicto y el `due_date`
derivado. El `UNIQUE` se crea recién en una corrida sin colisiones.

Resolverlas es una decisión caso por caso —cuál instancia corresponde a qué vencimiento— y no algo
que una regla automática pueda acertar. Abortar es barato; un `due_date` mal asignado es un
movimiento atribuido al mes equivocado, y se descubre meses después.

### Decisión 19 · El caminante no puede seguir recorriendo desde el origen

`MAX_WALK_STEPS = 750` acota el paseo desde `start_date`. Con el horizonte de 12 meses eso deja de
alcanzar, y se puede medir: una regla **diaria** que arrancó hace tres años agota los 750 pasos el
`2024-09-26` — **347 días antes** del horizonte, y sin haber llegado nunca a hoy. El generador no
vería ni la ocurrencia vigente.

El algoritmo nuevo SHALL **posicionarse en el borde del horizonte sin caminar la historia**:

- para `day` y `week`, la posición se calcula por aritmética de fechas (cuántos intervalos entran
  entre el ancla y el borde);
- para `month` y `year`, por aritmética de meses, aplicando el clamping desde el ancla como hoy.

Recién desde ahí camina, y entonces el cap acota **la ventana**, no la vida de la regla. El cap se
conserva como red de seguridad.

### Decisión 20 · La tanda tiene un tamaño, se inserta en lote, y se ve que no terminó

Tres cosas concretas que "por tandas" no define:

- **Tamaño**: 50 ocurrencias por corrida. Cubre de un saque cualquier atraso mensual o semanal
  plausible, y parte el caso diario en ~8 corridas.
- **Inserción en lote**: un solo `insert` con todas las filas de la tanda, no una por ocurrencia. Hoy
  el generador inserta de a una dentro de un `for`; con 50 filas eso son 50 roundtrips.
- **La ocurrencia vigente entra en la primera corrida**, siempre. Si la tanda se llenara con las más
  viejas, la de este mes quedaría afuera — el #96 otra vez, con otro número.
- **Progreso visible y accionable**: mientras queden ocurrencias por reconstruir, la app SHALL
  decirlo y SHALL ofrecer **"Continuar reconstrucción"**, que procesa otra tanda sin cerrar la app.
  Una regla diaria son ~8 tandas: pedirle a alguien que abra y cierre la app ocho veces para ver su
  propio historial no es una opción. La primera tanda sigue siendo automática; el botón existe para
  no depender de sesiones sucesivas.

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

**Dos migraciones con un despliegue en el medio** (decisión 17). Cada una corre en su propia
transacción; no hay una sola transacción que abarque las dos.

### A · Expansión — `00XX_recurrence_identity_expand.sql`

Aditiva. Al terminar, **el comportamiento de la app es idéntico**: el índice de pendiente única sigue
vivo y nada genera backlog todavía.

1. Agregar `due_date` y poblarlo derivándolo del cronograma de cada regla.
2. **Detectar colisiones** de `due_date` derivado (decisión 18). Si hay alguna, **abortar** emitiendo
   el informe; el resto de la migración no corre.
3. Agregar `UNIQUE (recurrence_id, due_date)`, sin cláusula `WHERE`.
4. Agregar `resolution_kind` (nullable, **sin constraint todavía**) y `linked_conversion`. Poblar
   `resolution_kind = 'created'` en las confirmadas: hasta hoy la única forma de resolver con
   movimiento era creándolo.
5. Agregar `recurrences.reconstruct_from` y poblarlo con la política conservadora de la decisión 21
   (`COALESCE(last_generated_date, start_date)` en activas; la fecha de la migración en pausadas).
6. Crear `recurrence_schedule_versions` con una versión por regla, marcada `is_assumed = true`.
7. Crear `recurrence_pauses` con una fila abierta por cada regla hoy pausada.
8. Instalar el **trigger de compatibilidad** para clientes viejos (decisión 17): deriva `due_date` de
   `scheduled_date` y pone `resolution_kind = 'created'` al confirmar, cuando no vienen provistos.

`scheduled_date` y `last_generated_date` se siguen escribiendo. Nada se elimina acá.

### Despliegue

Web y nativo con el modelo nuevo: reads que aceptan colecciones, escrituras que proveen `due_date` y
`resolution_kind`. Confirmar y omitir dejan de escribir `last_generated_date`.

### B · Activación — `00XY_recurrence_backlog_activate.sql`

Recién cuando el despliegue está hecho. Es la migración que **cambia el comportamiento**.

1. Agregar las constraints de `resolution_kind` y `linked_conversion`.
2. Eliminar `recurrence_instances_one_pending_per_rule`. Desde acá existe el backlog.

### C · Retiro — entrega posterior

Retirar `scheduled_date`, `last_generated_date` y el trigger de compatibilidad, cuando ya no queden
clientes nativos instalados que los usen.

Supabase es online-only: se aplica desde el SQL Editor y se regeneran los tipos. El "hoy" de
cualquier cálculo va con `(now() at time zone 'America/Argentina/Buenos_Aires')::date` —
`current_date` a secas está prohibido.


## Decisiones de producto cerradas

Decisiones de **producto** que siguen abiertas. Ninguna bloquea empezar por los cimientos.

No queda ninguna abierta. Estas cuatro estuvieron listadas como preguntas mientras ya estaban
decididas en el spec o en las tareas —lo que dejaba al implementador sin saber qué regía—, así que
quedan cerradas acá con su respuesta:

- **Horizonte hacia atrás** → 12 meses (decisión 5). Antes de eso, período señalado como incompleto.
- **¿La primera carga cuenta como pago?** → **Sí.** "12 pagos en total" incluye el movimiento que
  creó la regla; el sistema materializa 11 más. Y el rótulo en pantalla dice "en total", sin
  ambigüedad.
- **¿Se muestra el vencimiento de una regla pausada?** → **Sí, con sello "Pausada".** Esconderlo
  sacaría de la vista algo que el usuario todavía puede querer resolver.
- **¿Qué pasa durante una pausa?** → decisión 16.
