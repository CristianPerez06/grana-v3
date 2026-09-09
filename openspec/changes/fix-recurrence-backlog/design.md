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

> **Este documento conserva las 24 decisiones completas, incluidas las de lo que se difirió.** El
> alcance de la entrega se recortó el 2026-09-09 y vive en `proposal.md` y `tasks.md`; las decisiones
> que quedaron fuera se señalan donde corresponde, con el change que las va a tomar. Se conservan a
> propósito: el análisis costó más que el código y no tiene por qué repetirse.

## Goals / Non-Goals

**Goals** *(recortados el 2026-09-09 — ver `proposal.md`)*

- Que un vencimiento sin revisar no bloquee los siguientes, y que se pueda resolver cualquiera en
  cualquier orden, sin duplicados.
- Que vencimiento, fecha de pago, fecha de carga y fecha de resolución sean cuatro instantes
  distintos y sobrevivan los cuatro.
- Que editar la frecuencia o pausar no fabrique vencimientos que nunca existieron.
- Que un fallo al materializar se vea, en vez de parecer "estás al día".
- Materialización y bloque de "vencimientos por revisar" en web **y** en nativo.

**Movidos a changes posteriores** (el análisis de cada uno sigue acá, en las decisiones que se
indican, para que el change que lo tome no empiece de cero):

- Registrar un pago antes del vencimiento, sin correr el calendario — decisión 4 →
  `recurrence-early-payment`.
- Vincular un movimiento ya cargado, sin duplicar el gasto — decisiones 13 y 14b →
  `recurrence-link-movement`.
- Deshacer, distinguiendo lo creado de lo vinculado — decisiones 14 y 15 → `recurrence-undo`.
- Resolver el atraso en bloque, corrigiendo cada fila — decisiones 9, 11 y 22 →
  `recurrence-catch-up`.
- Paridad completa web ↔ nativo del formulario de resolución → `recurrence-review-ux`.

**Non-Goals**

- Recordatorios, push y mail. Necesitan la generación del lado del servidor, que **no entra acá**: el
  mínimo cubre al cliente viejo con un gate de versión, y generar del lado del servidor es
  `recurrence-server-generation`. El sistema de avisos es su propio change, encima de aquél.
- Registro automático de débitos. Ver decisión 6.
- Ajuste de importes por índice, importes estimados, calendarios avanzados, pausa con fecha.
- Crear movimientos históricos automáticamente, o reconstruir vencimientos anteriores al horizonte.
  Ver decisión 7.
- **Retirar `scheduled_date`.** Se conserva escribiéndose en paralelo; su eliminación es una entrega
  posterior, cuando ya no queden clientes nativos instalados que lo usen. Ver decisión 17.
No es non-goal, aunque una versión anterior lo listaba como tal: **el doble conteo de Compromisos
(#118) se cierra en esta entrega**. El arreglo es el mismo código —que el dashboard, el "próximo" y la
proyección lean los vencimientos existentes en vez de proyectarlos desde el cursor, tarea `2.2b`—, así
que dejarlo afuera obligaba a tocar dos veces las mismas funciones.

## Decisions

### 1. El invariante correcto es "una instancia por ocurrencia", no "una pendiente por regla"

**Recomendación.** Reemplazar el invariante. Lo que hay que impedir es que la **misma ocurrencia**
exista dos veces; "una pendiente por regla" era una aproximación grosera de eso que además rompe el
calendario.

**Un índice parcial sobre `(recurrence_id, scheduled_date) WHERE status = 'pending'` NO alcanza**, y
conviene decirlo porque fue la primera propuesta: al confirmarse, la fila sale del índice parcial y
la ocurrencia queda desprotegida. La restricción tiene que valer en **todos** los estados.

**Recomendación concreta:** una columna `due_date` que guarda el vencimiento **derivado del
calendario** —nunca lo que el usuario elija al pagar— con `UNIQUE (recurrence_id, due_date)`.

Ese índice terminó siendo **parcial**, pero por una razón distinta de la que lo hacía insuficiente
arriba: `WHERE due_date IS NOT NULL`. No excluye estados —sigue protegiendo pendientes, resueltas y
omitidas por igual— sino las ocurrencias históricas cuyo vencimiento se **desconoce** y por lo tanto
no pueden reservar ninguna identidad (decisión 23).

`scheduled_date` **se retira**. Una versión anterior de este documento decía que "pasa a ser la fecha
del movimiento", y eso no cierra: una ocurrencia sin resolver todavía no tiene pago, así que no puede
tener fecha de pago.

Durante la transición queda como **columna legada de compatibilidad**, y conviene no llamarla "alias
de lectura de `due_date`" —como decía una versión anterior— porque no lo es en ninguno de los dos
casos que importan:

- un cliente viejo que confirma **pisa** `scheduled_date` con la fecha de pago mientras `due_date`
  conserva el vencimiento: las dos divergen;
- en las confirmadas históricas `due_date` es `NULL` y `scheduled_date` guarda un valor legado que no
  es un vencimiento confiable.

El código nuevo NO debe leerla como vencimiento ni como fecha de pago. Al **insertar**, el trigger la
refleja desde `due_date` para que los clientes viejos sigan funcionando; a partir de ahí esos mismos
clientes pueden sobrescribirla al confirmar, y eso es esperado. Se elimina en la migración C.

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

> **Fuera de esta entrega** — `recurrence-early-payment`. La decisión se conserva porque es la que impide que el calendario se corra.

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

> **Parcial.** El horizonte de 12 meses está en esta entrega. El **aviso** que nombra desde cuándo reconstruyó va en `recurrence-review-ux`; es el borde áspero conocido del mínimo.

**Recomendación.** No reconstruir automáticamente los meses cerrados: usaría los montos de hoy,
perdería las reglas retiradas e inventaría las creadas después.

Lo que sí corresponde es decirlo **en la recurrencia** — *"esta recurrencia tiene historial anterior
a septiembre de 2025 que Grana no reconstruyó"* — y dejar que el usuario complete lo que quiera con
datos reales. El aviso NO habla del mes: afirmar que un mes tiene información incompleta sería falso
si el usuario cargó esos pagos a mano en su momento.

Dentro del horizonte de 12 meses (decisión 5) las ocurrencias sí se materializan, y conviene ser
explícito sobre qué son: **elementos por revisar, no movimientos**. No tocan ningún saldo ni el gasto
del mes hasta que el usuario las resuelva. Más allá del horizonte no se materializa nada; **señalarlo
va en `recurrence-review-ux`**, no en esta entrega. Hasta que ese aviso exista, quien arrastre más de
un año ve doce meses sin explicación del corte — el borde áspero conocido del mínimo. Lo que sí rige
desde ahora es la mitad negativa de esta decisión: el sistema no afirma que esos meses tengan
información incompleta.

**Precisión contable que conviene no perder:** crear una instancia pendiente **no mueve ningún
saldo**. El saldo se mueve al crear un movimiento confirmado. Lo que una pendiente sí cambia es la
vista de compromisos, y para meses cerrados el cambio es real, porque bajo el lente `snapshot` el
total cuenta las instancias materializadas `pending` **y** `confirmed`.

### 8. La generación deja de depender de por dónde navegaste — en su forma mínima

**Recomendación en dos etapas, de las cuales acá entra la primera:**

- **Etapa 1 (en este change):** que la materialización corra en cualquier pantalla de la app, en web y
  en nativo, en vez de solo en `/transactions` y el hub. Es chico y tapa la mayor parte del síntoma.
- **Etapa 2 (fuera, `recurrence-server-generation`):** un proceso del lado del servidor (`pg_cron` o
  equivalente) que corra sin que nadie abra la app. Es condición para los avisos y para que las recurrencias compartidas del hogar
  se materialicen sin depender de qué miembro entró. `pg_cron` es *una* arquitectura posible, no un
  requisito; la elección es del change que lo traiga.

### 9. Corregir un importe afecta un vencimiento, no la regla

> **Parcial.** Que corregir el importe al registrar no reescriba la regla **sí** está en esta entrega (tarea 1.4c, ya hecha). La acción separada "usar este importe de acá en más" va en `recurrence-catch-up`.

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

> **Fuera de esta entrega** — `recurrence-catch-up`. Es el cómo de la decisión 11.

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

> **Fuera de esta entrega** — `recurrence-catch-up`.

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

> **Fuera de esta entrega** — `recurrence-link-movement`.

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

> **Parcial.** El **dato** que hace posible la distinción (`resolution_kind`, `linked_conversion`) lo escribe esta entrega, porque no se puede reconstruir después. Deshacer se implementa en `recurrence-undo`.

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

> **Fuera de esta entrega** — `recurrence-link-movement`.

**Recomendación.** Un movimiento que existía antes de la recurrencia NO SHALL mostrarse como
"originado en esta recurrencia": no lo originó, el usuario lo cargó por su cuenta. El rótulo correcto
es **"vinculado a esta recurrencia"**. La distinción es la misma que gobierna deshacer (decisión 14)
y tiene que ser visible, no solo interna.

### 15. Deshacer y omitir son dos operaciones, no una

> **Parcial.** Que omitir signifique "este período no corresponde" y no bloquee las siguientes está en esta entrega. Deshacer va en `recurrence-undo`, junto con el #104.

**Recomendación.** Definirlas acá aunque el #104 las implemente:

- **Deshacer la resolución** — "me equivoqué". La ocurrencia **vuelve a estar por revisar**, y qué
  pasa con el movimiento depende de cómo se había resuelto (decisión 14): si lo **creó** la
  recurrencia se elimina; si el usuario había **vinculado** uno suyo, se conserva y solo se
  desvincula. Deshacer NO es sinónimo de eliminar.
- **Omitir un vencimiento** — "este período no corresponde". La ocurrencia queda resuelta sin pago y
  no se espera ninguno.

El plan actual del #104 convierte siempre el pago borrado en `skipped` para esquivar el índice
`one_pending_per_rule`. Con ese índice eliminado la restricción desaparece.

**El #104 salió de esta entrega con el recorte de alcance (2026-09-09) y va en `recurrence-undo`.**
El argumento original —escribir el arreglo del #104 contra un modelo que este change está por
reemplazar obliga a reescribirlo enseguida— sigue en pie, y por eso lo que este change **sí** entrega
es el dato del que depende: `resolution_kind` y `linked_conversion`, escritos por la migración de
expansión. La distinción entre borrar y desvincular no se puede reconstruir después, así que se
registra desde ahora aunque quien la consuma llegue en otro change. Lo que se difiere es la
implementación de deshacer, no su modelo.

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
| `due_date` DATE **NULL** | Identidad de la ocurrencia (decisión 1) | `UNIQUE (recurrence_id, due_date) WHERE due_date IS NOT NULL` |
| `due_date_is_unknown` BOOLEAN NOT NULL DEFAULT false | El vencimiento histórico se desconoce (`due_date` NULL) | Ver decisión 23 |
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

**Orden dentro de la expansión**: las constraints van **después** del trigger de compatibilidad. Una
versión anterior las postergaba a la activación por miedo a que un cliente viejo las violara al
confirmar — pero el trigger completa `resolution_kind` **antes** de que la constraint se evalúe (un
`BEFORE` trigger corre antes que el `CHECK`), así que esa incompatibilidad no existe. Postergarlas
solo dejaría la base sin proteger durante toda la transición.

`linked_conversion` es un booleano y no un snapshot del estado anterior a propósito: la decisión 13
(revisada abajo) restringe la conversión al caso **personal → compartido con el reparto de la regla**,
así que revertir es "volver a personal", no "restaurar un reparto arbitrario". Esa restricción es
justamente lo que evita tener que persistir un estado compartido complejo.

### `recurrence_schedule_versions` — el calendario a lo largo del tiempo

Un cambio de frecuencia rige desde una fecha y no reinterpreta el pasado (decisión 10). Eso obliga a
que la regla deje de tener **un** cronograma y pase a tener una **historia** de cronogramas:

```
recurrence_schedule_versions
  recurrence_id    ┐
  user_id          ┴→ recurrences(id, user_id)  FK COMPUESTA
  effective_from   DATE NOT NULL      -- desde cuándo rige (= reconstruct_from en la asumida)
  interval_count   INT  NOT NULL
  interval_unit    TEXT NOT NULL
  anchor_date      DATE NOT NULL      -- ancla del clamping de fin de mes
  is_assumed       BOOLEAN NOT NULL   -- la creó la migración; nada se afirma sobre antes
  UNIQUE (recurrence_id, effective_from)
```

**La FK es compuesta a propósito, y esto es una corrección de seguridad.** Con dos referencias
independientes —la regla por un lado, el usuario por otro— y un RLS que solo comprueba
`user_id = auth.uid()`, la base aceptaría una fila con **mi** usuario y la recurrencia de **otro**:
la política valida el dueño de la fila, no que la regla le pertenezca. `FOREIGN KEY (recurrence_id,
user_id) REFERENCES recurrences(id, user_id)` lo hace imposible en la base, sin depender de que cada
política se acuerde de comprobarlo. Requiere declarar `UNIQUE (id, user_id)` en `recurrences` como
clave candidata. Lo mismo aplica a `recurrence_pauses`.

El caminante resuelve, para cada fecha, la versión vigente en ese momento.

La migración crea **una versión por regla existente**, y su `effective_from` es **`reconstruct_from`,
no `start_date`**. Una versión anterior usaba `start_date`, y marcarla `is_assumed` no arreglaba nada:
la marca no cambia el cálculo. Si una regla mensual fue editada a semanal en algún momento —y no hay
historial de ediciones para saberlo—, proyectar el cronograma actual desde `start_date` haría que el
caminante produzca, después del cursor, fechas que la regla nunca produjo.

Anclada en `reconstruct_from`, la versión **no hace ninguna afirmación sobre el pasado**: solo dice
"de acá en adelante, este cronograma".

`anchor_date` sí se conserva en `start_date`, y no es una contradicción: es el ancla del **clamping de
fin de mes** —lo que hace que una regla del 31 vuelva al 31 después de febrero—, no una afirmación
sobre cuándo empezó el cronograma. Es exactamente lo que hace hoy el generador
(`addInterval(cursor, unit, count, { anchorDate: start_date })`), así que la versión asumida reproduce
el comportamiento actual sin inventar nada.

Las columnas `interval_count` / `interval_unit` / `frequency` se conservan en `recurrences` como la
versión **vigente** —las lee la UI, y el `CHECK` de coherencia preset↔intervalo (migración 0053)
sigue aplicando— pero dejan de ser la fuente de verdad del generador.

### `recurrence_pauses` — los intervalos de pausa

Un vencimiento que cae durante una pausa no existe (decisión 16). Para que el generador lo sepa,
la pausa tiene que ser un **intervalo persistido**, no un `status` que solo dice "ahora está pausada":

```
recurrence_pauses
  recurrence_id  ┐
  user_id        ┴→ recurrences(id, user_id)  FK COMPUESTA, misma razón
  paused_from    DATE NOT NULL
  resumed_at     DATE NULL           -- NULL = pausa abierta
```

`recurrences.status = 'paused'` se conserva para la UI y para el filtro del generador; el intervalo es
lo que impide que el período pausado se lea como huecos al reanudar.

### Dual-write: la base es el dueño único de estas dos tablas

El backfill cubre solo las filas que existían al aplicar la expansión. **Entre la expansión y la
activación la app sigue escribiendo con el modelo viejo**, así que sin nada más: una recurrencia
creada desde cualquier cliente quedaría sin versión, editar la frecuencia dejaría la versión vieja, y
pausar o reanudar no abriría ni cerraría ningún intervalo. Cuando llegara el generador nuevo, las
reglas **más recientes** serían las peor cubiertas.

La expansión instala triggers en `recurrences` que mantienen las dos tablas:

| Evento | Qué escribe la base |
|---|---|
| `INSERT` | Versión inicial (`effective_from = start_date`, `is_assumed = false`) |
| Cambia `interval_*` o `start_date` | Versión nueva vigente desde hoy |
| `active → paused` | Abre el intervalo de pausa |
| `paused → active` | Cierra el intervalo abierto |

**El dueño de estas escrituras es la base, no la app.** El código nuevo NO debe insertar en
`recurrence_schedule_versions` ni en `recurrence_pauses`: duplicaría lo que hacen los triggers. Vivir
en la base las hace además atómicas con la escritura de la regla, sin depender de que cada cliente se
acuerde — que es exactamente el problema durante una transición con clientes viejos instalados. La migración crea una fila
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
| **A · Expansión** | `0064_recurrence_identity_expand.sql` | Columnas, tablas nuevas, backfill, trigger de compatibilidad | **Sin cambios.** El índice de pendiente única sigue vivo. |
| — | *(despliegue de web y nativo con el modelo nuevo)* | | |
| **B · Activación** | `<próximo libre>_recurrence_backlog_activate.sql` | Elimina el índice de pendiente única | El backlog empieza a existir. |
| **C · Retiro** | entrega posterior | Retira `scheduled_date` y las **ramas de compatibilidad** del trigger | — |

**"Nativo desplegado" no significa "todos actualizaron".** Una app instalada no se actualiza porque
apliquemos una migración, y los clientes viejos dependen de `last_generated_date` y de una pendiente
singular. Dos mecanismos, complementarios:

- **Compatibilidad por trigger (obligatorio).** La expansión instala un `BEFORE INSERT OR UPDATE` en
  `recurrence_instances` que, cuando el cliente no los provee, deriva `due_date` de `scheduled_date`
  y pone `resolution_kind = 'created'` al pasar a `confirmed`. Una escritura de un cliente viejo
  produce así una fila válida en el modelo nuevo sin que el cliente sepa nada. Se retira en C.
- **Versión mínima (requisito para activar, no una mejora).** Una versión anterior la llamaba
  "recomendada, para la experiencia". Es más que eso: **un usuario que solo conserve el cliente viejo
  nunca ejecuta el generador nuevo**, así que su atraso no se materializa nunca y sigue sin backlog —
  el #96 sigue vivo para él. El trigger protege la integridad de lo que ese cliente escribe; no hace
  que ejecute lógica que no tiene.

  Por eso, antes de activar hace falta **una de dos**: un gate de versión mínima al arrancar la app
  nativa, o **generación del lado del servidor**, que materializa el atraso sin depender de qué
  cliente abrió la app. La segunda es la que además resuelve el caso de quien no abre la app en
  absoluto, y es la etapa 2 de la decisión 8.

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
| Activa **con** cursor | `last_generated_date` — el cursor es, por definición, "hasta acá ya está cubierto" |
| Activa **sin** cursor | `start_date - 1` |
| Pausada | la **fecha de la migración** — nada anterior se reconstruye |

**El `- 1` no es un truco: corrige una pérdida real.** El contrato genera ocurrencias
*estrictamente posteriores* a `reconstruct_from`, y el motor actual dice que **sin cursor la primera
ocurrencia cae EN `start_date`**, sin sumar intervalo (`decideRecurrenceInstance`). Con
`COALESCE(last_generated_date, start_date)` —lo que decía una versión anterior— una regla creada
directamente y todavía nunca materializada **perdería su primera ocurrencia**.

Para esa regla, la versión de calendario lleva `effective_from = start_date`, no `start_date - 1`:
el `- 1` es un piso de generación, no una fecha en la que el cronograma haya regido.

**El contrato, con precisión, porque una versión anterior de este documento lo decía al revés y así
dejaba el #96 sin arreglar:**

> `reconstruct_from` es el **último punto conocido**. Las ocurrencias **posteriores** a él, dentro del
> horizonte, **SÍ se reconstruyen**, descontando las instancias que ya existan por `due_date`.

Eso **es** el arreglo del #96 y tiene que serlo. En el caso del ticket el cursor quedó clavado en
junio porque la pendiente sin resolver no lo avanzó: al reconstruir desde ahí, la de junio ya existe y
se deduplica, pero **julio, agosto y septiembre aparecen**. Medido sobre la migración real, con la
regla de cada 3 días del ticket: **29 ocurrencias a reconstruir** (julio 11, agosto 10, septiembre 3),
que son exactamente los meses que hoy leen $0. Si esto no reconstruyera hacia atrás, el bug seguiría
vivo.

Lo que **no** se reconstruye es lo anterior al cursor —la regla ya lo dio por cubierto— y, en las
pausadas, nada previo a la migración, porque no sabemos desde cuándo están pausadas.

### Decisión 23 · El `due_date` histórico se marca cuando no es exacto

Una versión anterior de este documento decía que el backfill "deriva `due_date` del cronograma". El
SQL hacía `due_date = scheduled_date`, que **no es lo mismo** y en un caso concreto es directamente
falso: si el alquiler vencía el 23/06 y se confirmó el 03/09, `scheduled_date` quedó en 03/09 —
`confirmRecurrenceInstance` lo pisa con la fecha elegida— y ese 03/09 pasaría a ser el "vencimiento".
La detección de colisiones no lo agarra: solo ve dos fechas iguales, no una fecha equivocada.

La confiabilidad depende del estado, y conviene decirlo por estado:

| Estado | `scheduled_date` es… | Por qué |
|---|---|---|
| `pending` | **exacto** | Lo escribió el generador y nadie más lo tocó. |
| `skipped` | **exacto** | `skipRecurrenceInstance` solo toca `status` y `resolved_at`. |
| `confirmed` | **sospechoso** | Confirmar escribe `payload.date ?? instance.scheduled_date`. |

**Para las confirmadas no hay forma de demostrar cuál era el vencimiento.** Una versión anterior de
esta decisión proponía deducirlo comprobando si la fecha "cae sobre el cronograma", y ese
razonamiento es **inválido**: caer en el cronograma es necesario, no suficiente. Una cuota que vencía
el **10 de agosto** y se confirmó tarde, el **10 de septiembre**, cae perfecto en un cronograma
mensual del día 10 — y pertenece a otra ocurrencia. La comprobación sirve para sospechar de algunas
fechas, nunca para probar que las demás son exactas. Y si la frecuencia fue editada, comparar contra
el cronograma **actual** tampoco dice qué calendario regía cuando se creó la instancia.

**Y una fecha incierta no puede ocupar una identidad.** Una versión anterior guardaba la fecha dudosa
igual, marcada como aproximada — y eso **reproduce el #96 por otro camino**:

1. El vencimiento de agosto era el 10/08.
2. Se confirmó tarde, el 10/09; el código viejo dejó `scheduled_date = 10/09`.
3. La migración copiaba eso a `due_date = 10/09` — marcado, pero **presente**.
4. El cursor real seguía en 10/08.
5. El generador intenta crear el vencimiento **verdadero** del 10/09…
6. …y el índice único lo rechaza: la fila dudosa ya ocupa esa identidad.

Septiembre desaparece. Exactamente el bloqueo que este change existe para eliminar.

**Política: lo desconocido se declara desconocido, no se aproxima.**

| | `due_date` | `due_date_is_unknown` |
|---|---|---|
| `pending` y `skipped` existentes | **exacto** | false |
| `confirmed` **anterior** a la migración | **NULL** | **true** |
| `confirmed` **posterior** a la migración | exacto por construcción | false |

`scheduled_date` conserva el único dato legado disponible durante la transición, sin pretender que
sea un vencimiento. El índice de identidad es **parcial** (`WHERE due_date IS NOT NULL`) y el
generador deduplica **solo** contra vencimientos exactos, así que una identidad desconocida nunca
reserva el lugar de una conocida. Si algún día el usuario corrige el histórico a mano, se completa
`due_date` y la fila deja de ser desconocida.

Un `CHECK` mantiene los dos campos en acuerdo: `(due_date is null) = due_date_is_unknown`.

**Y la identidad es inmutable, lo que un `CHECK` no puede garantizar.** Un `CHECK` valida el estado
final de la fila, no la transición, así que por sí solo deja pasar dos escrituras que rompen el
contrato: mover una identidad ya establecida (`set due_date = otra fecha`) y borrarla
(`set due_date = null`), que además devolvería la ocurrencia al pozo de las materializables. El
trigger compara `OLD` contra `NEW` y admite solo estas transiciones:

| De | A | |
|---|---|---|
| exacta | la misma | ✅ |
| desconocida | sigue desconocida | ✅ |
| desconocida | exacta | ✅ una sola vez — el usuario corrige el histórico |
| exacta | otra fecha, o desconocida | ❌ rechazado |

`due_date_is_unknown` se **deriva** en el trigger en vez de declararse, para que una corrección de
histórico que complete `due_date` no falle por olvidarse de bajar el flag.

**La política de colisiones cambia en consecuencia** (decisión 18): solo se comparan vencimientos
exactos. Una confirmada desconocida que "coincidía" con un vencimiento exacto no es motivo para
abortar — pueden ser dos ocurrencias distintas, y esa era justamente la trampa.

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
  dato real apareciendo. Lo que el mínimo pone del lado del usuario es el rótulo **"vencimientos por
  revisar"**, que no afirma deuda, y que cada uno se resuelva por separado. Agrupar por regla y la
  resolución en bloque **no llegan con esta entrega**: son `recurrence-review-ux` y
  `recurrence-catch-up`. **El riesgo queda asumido, no mitigado**: un atraso largo se va a ver como
  una lista larga, y ponerse al día va a ser vencimiento por vencimiento. Es el precio explícito de
  entregar el arreglo antes que la comodidad.
- **Migración con datos vivos.** El vencimiento original de las instancias ya confirmadas **no es
  recuperable**, así que no se deriva ni se aproxima: quedan con `due_date = NULL` y
  `due_date_is_unknown` (decisión 23), conservando `scheduled_date` como único dato legado. Afecta
  solo al historial, no a montos ni saldos, y **no bloquea** la materialización del vencimiento
  verdadero.
- **Colisión con #104.** Los dos tocan la misma restricción. Se ordenan explícitamente: este change
  retira el índice y deja escrito `resolution_kind`; `recurrence-undo` implementa deshacer encima.
- **Superficie amplia.** Toca money-logic, el paquete de recurrencias, dos apps y dos migraciones.
  **El recorte de alcance del 2026-09-09 la redujo**: la entrega quedó en los seis comportamientos
  que cierran el #96 y el #118, y pago anticipado, vinculación, resolución en bloque, deshacer,
  historial enriquecido y la UX avanzada pasaron a changes posteriores. Una versión anterior de este
  documento sostenía que los once comportamientos eran un solo entregable indivisible; era falso, y
  el costo de creerlo fueron 51 commits sin ningún cambio visible. Lo que sí es indivisible es el
  mínimo: los cimientos solos no le sirven a ningún usuario.

## Migration Plan

**Dos migraciones con un despliegue en el medio** (decisión 17). Cada una corre en su propia
transacción; no hay una sola transacción que abarque las dos.

### A · Expansión — `0064_recurrence_identity_expand.sql`

Aditiva. Al terminar, **el comportamiento de la app es idéntico**: el índice de pendiente única sigue
vivo y nada genera backlog todavía.

1. Agregar `due_date` (**nullable**) y `due_date_is_unknown`. `pending` y `skipped` conservan un
   vencimiento exacto; las `confirmed` históricas quedan en `NULL` + marca (decisión 23).
2. **Detectar colisiones solo entre vencimientos exactos** (decisión 18). Si hay alguna, **abortar**
   emitiendo el informe; el resto de la migración no corre.
3. Índice **parcial** `UNIQUE (recurrence_id, due_date) WHERE due_date IS NOT NULL`, y `CHECK` que
   mantiene `(due_date is null) = due_date_is_unknown`.
4. Agregar `resolution_kind` y `linked_conversion`. Poblar `resolution_kind = 'created'` en las
   confirmadas: hasta hoy la única forma de resolver con movimiento era creándolo.
5. Agregar `recurrences.reconstruct_from` con la política de la decisión 21 —`last_generated_date` en
   activas con cursor, **`start_date - 1`** en activas sin cursor, fecha de la migración en pausadas—
   más el trigger que lo deriva en `INSERT`, sin el cual la columna `NOT NULL` rompería el alta.
6. Crear `recurrence_schedule_versions` (versión por regla, `effective_from = reconstruct_from`
   salvo sin cursor, donde es `start_date`; `is_assumed = true`) y `recurrence_pauses` (una fila
   abierta por regla pausada). Ambas con FK compuesta `(recurrence_id, user_id)` y **sin políticas de
   escritura**: son de solo lectura para el cliente.
7. Instalar los triggers: **dual-write** que mantiene las dos tablas nuevas al crear, editar el
   cronograma y pausar/reanudar (`SECURITY DEFINER`, porque las tablas son de solo lectura), y
   **compatibilidad** para clientes viejos, que deriva `due_date` en `INSERT` y completa
   `resolution_kind` al confirmar, además de imponer la **inmutabilidad de la identidad**.
8. Constraints de `resolution_kind` y `linked_conversion`, **después** del trigger: éste completa el
   campo antes de que el `CHECK` se evalúe, así que no hay incompatibilidad con clientes viejos.

`scheduled_date` y `last_generated_date` se siguen escribiendo. Nada se elimina acá.

### Despliegue

Web y nativo con el modelo nuevo: reads que aceptan colecciones, escrituras que proveen `due_date` y
`resolution_kind`. Confirmar y omitir dejan de escribir `last_generated_date`.

### B · Activación — `<próximo número libre>_recurrence_backlog_activate.sql`

Recién cuando el despliegue está hecho. Es la migración que **cambia el comportamiento**.

**El número se elige contra `main` en el momento de crearla**, no se reserva ahora: entre la
expansión y la activación hay un despliegue de por medio y `main` puede haber avanzado — es lo que
ya pasó con esta misma expansión, que nació `0061` y terminó `0064`. `AGENTS.md` lo pide
explícitamente en su pre-flight, y hubo una colisión de `0057` por saltearlo.

1. Eliminar `recurrence_instances_one_pending_per_rule`. Desde acá existe el backlog.

Las constraints de `resolution_kind` ya entraron en la expansión, después del trigger.

### C · Retiro — entrega posterior

Retirar `scheduled_date` y `last_generated_date` cuando ya no queden clientes nativos instalados que
los usen.

**El trigger NO se elimina entero, y conviene dejarlo escrito antes de que alguien lo intente.** Su
nombre —`trg_recurrence_instance_compat`— engaña: además de la compatibilidad temporal, contiene una
regla **permanente** de negocio, la inmutabilidad de `due_date` (decisión 23). Borrarlo completo
reabriría exactamente el agujero que ese guard cierra: mover o borrar una identidad exacta por
`UPDATE`, y con ello volver a permitir que una ocurrencia ya resuelta se materialice de nuevo.

Al retirar `scheduled_date`, una de dos:

- quitar **solo** las ramas de compatibilidad —la derivación de `due_date` en `INSERT` y el relleno
  de `resolution_kind`—, conservando el guard; o
- reemplazarlo por un trigger de guard permanente, con un nombre que diga lo que hace.

Supabase es online-only: se aplica desde el SQL Editor y se regeneran los tipos. El "hoy" de
cualquier cálculo va con `(now() at time zone 'America/Argentina/Buenos_Aires')::date` —
`current_date` a secas está prohibido.


## Decisiones de producto cerradas

**No queda ninguna abierta.** Estas cuatro estuvieron listadas como preguntas mientras ya estaban
decididas en el spec o en las tareas —lo que dejaba al implementador sin saber qué regía—, así que
quedan cerradas acá con su respuesta:

- **Horizonte hacia atrás** → 12 meses (decisión 5). Antes de eso, período señalado como incompleto.
- **¿La primera carga cuenta como pago?** → **Sí.** "12 pagos en total" incluye el movimiento que
  creó la regla; el sistema materializa 11 más. Y el rótulo en pantalla dice "en total", sin
  ambigüedad.
- **¿Se muestra el vencimiento de una regla pausada?** → **Sí, con sello "Pausada".** Esconderlo
  sacaría de la vista algo que el usuario todavía puede querer resolver.
- **¿Qué pasa durante una pausa?** → decisión 16.
