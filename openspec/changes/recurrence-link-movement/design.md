## Context

Ver `proposal.md` § Why para la motivación. Lo que sigue son las restricciones del código
en vigor que condicionan el enfoque, verificadas leyendo los archivos citados.

**No hay fila que resolver antes del vencimiento.** `owedOccurrencesForRule`
(`packages/money-logic/src/recurrences.ts`) camina el calendario con `to: today`, así que el
3 de septiembre el vencimiento del 23 no existe en `recurrence_instances`. Y
`confirmRecurrenceInstance` (`packages/recurrences/src/mutations.ts`) arranca exigiendo
`status === 'pending'`. Esas dos cosas juntas son la razón de que el hub no tenga botón: no
es que falte, es que no hay sobre qué operar.

**El dato de U4 ya está en la base.** La migración `0064` creó `resolution_kind` con un
CHECK que sólo admite `created` y `linked`, más `linked_conversion`. Grep sobre todo el
repo: ningún código de la app escribe `linked`. La columna existe, el consumidor no.

**La identidad de una ocurrencia es `(recurrence_id, due_date)`**, con un índice único
parcial sobre las exactas (`0064`). Nada en el esquema impide que un `due_date` sea futuro.

**El repo resuelve las operaciones compuestas con rollback compensatorio**, y la decisión 22
de `fix-recurrence-backlog` lo declara insuficiente para exactamente dos de las operaciones
de este change —convertir a compartido + vincular, y revertir + desvincular—, porque la
compensación también puede fallar y lo que queda es la deuda de un hogar movida por una
operación que el usuario no aprobó.

**La guarda de liquidaciones.** `trg_block_unshare_with_settlement` (`0049`) es un trigger
`BEFORE UPDATE` inmediato que lanza `GRN01`. Su predicado **no filtra por
`settlement.status`** —cero referencias a `s.status`—, y `reverse_settlement` (`0044`)
conserva la original marcada `reversed` y además inserta una fila `contra` cuyo
`payer_movement_id` está fechado **hoy**. Leído en las migraciones; **no probado contra la
base online**.

## Goals / Non-Goals

**Goals:**

- Que resolver un vencimiento no dependa de que su fecha haya llegado.
- Que las dos formas de resolver —crear un movimiento y señalar uno existente— dejen estados
  distinguibles, porque deshacerlas significa cosas distintas.
- Que ninguna operación de este change pueda dejar la deuda de un hogar movida a medias.
- Una sola implementación de la lógica para web y nativo.

**Non-Goals:**

- Deshacer un pago que la recurrencia creó (#104) — ver `proposal.md`.
- Arreglar la guarda de liquidaciones — decisión abierta en `proposal.md`.
- Vincular desde la ficha del movimiento.

## Decisions

### 1. Registrar anticipado inserta la ocurrencia ya resuelta; nunca una pendiente futura

El movimiento se crea primero con los orquestadores existentes, y después se **inserta** la
fila de `recurrence_instances` directamente en `confirmed`, con su `due_date` real (el 23) y
`resolution_kind = 'created'`.

**Alternativa descartada: materializar la ocurrencia como `pending` y después confirmarla.**
Reusaría `confirmRecurrenceInstance` sin tocarlo, pero entre los dos pasos existe una
ocurrencia pendiente **fechada en el futuro**, y el bloque de vencimientos por revisar la
muestra: el usuario acaba de pagar algo y la app se lo pide. Si el segundo paso falla, esa
fila queda ahí.

Insertando ya resuelta, ese estado no existe en ningún momento. El modo de falla que queda
—movimiento creado y ocurrencia sin insertar— es **el mismo que hoy** tiene confirmar
(`mutations.ts` borra el movimiento para no dejar un huérfano), así que no agrega una clase
de error nueva.

Los CHECK de `0064` lo admiten: `confirmed` exige `resolution_kind` y
`confirmed_transaction_id`, los dos se escriben en el mismo INSERT, y
`chk_recurrence_instances_unresolved_has_due_date` sólo restringe a las no confirmadas.

### 2. Vincular y desvincular son RPC de Postgres, no orquestadores que compensan

Es la decisión 22 de `fix-recurrence-backlog` aplicada donde ella misma la nombra.
`SECURITY INVOKER`, para que RLS siga siendo la frontera de autorización.

**Un solo RPC para vincular**, que cubra el caso simple y el compartido, en vez de dos
caminos. El caso simple es el compartido sin conversión; separarlos duplicaría la validación
de elegibilidad y dejaría dos lugares donde escribir `resolution_kind`.

### 3. Desvincular atrapa `GRN01` en una subtransacción y sigue

El RPC de desvincular intenta la reversión dentro de un bloque `BEGIN … EXCEPTION WHEN
sqlstate 'GRN01'`. Si la guarda la rechaza, la subtransacción revierte **sólo esa parte** y
el RPC continúa rompiendo el vínculo. Devuelve qué pasó, para que la app diga la verdad en
lugar de un error genérico.

Funciona porque `trg_block_unshare_with_settlement` es un trigger **inmediato**: lanza dentro
del bloque y es atrapable. **Ojo con no confundirlo** con `trg_no_splits_when_unshared`
(`0048`), que es `deferrable initially deferred` y se evalúa recién en el COMMIT, fuera del
alcance de cualquier `EXCEPTION`. No hace falta atraparlo: al revertir la subtransacción, los
cambios que lo dispararían dejan de existir.

**Alternativa descartada: chequear la guarda antes y no ofrecer desvincular.** Deja al
usuario con un vencimiento resuelto por un movimiento que sabe que no corresponde, y no cubre
el caso real —que la liquidación se registre **después** de haber vinculado—, que ninguna
comprobación previa puede evitar.

### 4. Los candidatos salen de un RPC de lectura

La lista necesita tres cosas que PostgREST no da bien juntas: "no vinculado a **ninguna**
ocurrencia" (un `NOT EXISTS`), la ventana derivada del calendario de la regla, y el orden por
proximidad. Además, un `.select()` de filas de detalle queda silenciosamente recortado por
`max-rows`, y acá eso no produce un número mal sino **un candidato que no aparece** — el
usuario concluye que su movimiento no está y lo carga de nuevo, que es el duplicado que este
change existe para evitar.

Ya hay una migración en esta entrega, así que el RPC de lectura no agrega un paso de
despliegue.

### 5. La ventana se deriva del calendario y se acepta que se superponga

De vencimiento anterior a vencimiento siguiente. Un número fijo de días no sirve: quince deja
afuera el caso que motiva el change y sería absurdo en una regla semanal.

Dos vencimientos consecutivos ven ventanas que se solapan, y **se acepta**. La app no sabe a
qué período correspondió un pago; el usuario sí. Un movimiento ya vinculado sale de toda otra
lista, así que la superposición no puede producir una doble resolución.

### 6. El conteo de posiciones es una unión, y se cambia en los dos lados a la vez

La regla nueva —una posición se consume al llegar su fecha **o** al resolverse antes, una
sola vez— vive hoy en dos implementaciones que tienen que seguir coincidiendo:
`recurrence_positions_spent` (`0068`, la normativa, que además corta la generación) y
`occurrencePositionsSpent` (`packages/money-logic`).

Se implementa como unión de conjuntos de **posiciones**, nunca como suma de dos conteos: una
posición cuya fecha llegó y que además está resuelta tiene que contar una. Sumar es el error
que haría desaparecer un vencimiento del plan.

La equivalencia entre las dos se fija con un test de paridad, como ya se hace con
`calculateTransactionSums` y su espejo SQL.

### 7. Una sola entrada, desde el vencimiento

Es donde la app tiene el contexto para ordenar candidatos y donde el duplicado está por
fabricarse. Desde la ficha del movimiento habría que buscar entre todas las reglas del
usuario, que es el buscador que el usuario pidió evitar — y costaría una superficie más en
cada plataforma.

## Risks / Trade-offs

- **El conteo de posiciones es normativo y corta la generación.** Un error ahí no se ve como
  un número raro: le agrega o le saca cuotas a un plan. → Test de paridad SQL↔TS sobre los
  mismos casos, y los escenarios del spec como casos de prueba. Se toca una sola vez, en los
  dos lados, en el mismo commit.
- **Registrar anticipado puede dejar un movimiento sin ocurrencia si falla el INSERT.** →
  Mismo modo de falla y misma compensación que confirmar hoy; no se introduce una clase nueva.
- **Atrapar `GRN01` deja al usuario con un gasto compartido que quería personal.** → Es la
  única respuesta verdadera: la plata cambió de manos y la deuda se saldó. La app lo dice; el
  vencimiento vuelve a revisión igual, que es lo que el usuario fue a buscar.
- **La guarda que atrapamos tiene un defecto de fondo que este change no arregla.** Mientras
  siga sin filtrar por estado, un hogar que liquidó y revirtió no puede descompartir nada
  anterior, ni desde acá ni desde el toggle que ya existe. → Decisión abierta en el proposal;
  si se elige el camino acotado, queda ticket propio y el change no repite el consejo falso.
- **La ventana en una regla `custom` de intervalo largo** (cada 2 años) ofrece una ventana
  enorme. → El orden por proximidad pone lo relevante arriba y la lista se muestra acotada.
- **La conversión a compartido mueve deuda que la otra persona ve.** → Confirmación explícita
  antes, atomicidad de base durante, y el aviso previo cuando ya se sabe que no va a poder
  revertirse.

## Migration Plan

**`0072`** — el número se eligió mirando `origin/main`, cuya migración más alta es
`0071_pause_looks_forward.sql`, no el working tree. Una sola migración, una sola transacción:

1. RPC de **candidatos** (lectura, `SECURITY INVOKER`).
2. RPC de **vincular**, con la rama de conversión a compartido.
3. RPC de **desvincular**, con la reversión y el `EXCEPTION WHEN sqlstate 'GRN01'`.
4. `create or replace` de **`recurrence_positions_spent`** con la unión. `recurrence_positions_spent_batch` (`0070`) la llama y no se toca: hay una sola definición de qué cuenta `max_occurrences` y el batch es otra forma de preguntarla, no otra forma de calcularla.
5. `revoke`/`grant` explícitos en cada función nueva. Postgres concede EXECUTE a PUBLIC por
   defecto y Supabase además expone `anon`; una función que no dice nada sobre sus privilegios
   queda abierta. Es lo que la migración `0067` existió para reparar.
6. Self-check antes del COMMIT, como `0068` y `0070`.

**No es destructiva**: agrega funciones y reemplaza una por su versión corregida. No borra
filas, no cambia tipos, no elimina columnas.

**Orden de despliegue.** La migración va primero y es compatible hacia atrás: las funciones
nuevas no las llama nadie hasta que se despliega la app, y el conteo corregido sólo mueve el
avance de una regla que tenga un vencimiento futuro ya resuelto — algo que hoy no puede
existir, porque resolver un vencimiento futuro es justamente lo que este change introduce. En
la base actual el cambio del punto 4 es un no-op verificable.

**Rollback.** Revertir el punto 4 es volver a `create or replace` la versión de `0068`. Las
funciones nuevas quedan sin llamadores si se revierte la app; no hace falta borrarlas.

## Open Questions

- **La elección entre el camino acotado y el ampliado de la decisión abierta** (`proposal.md`
  § Decisión abierta). No bloquea escribir las tareas del camino acotado, que hay que
  construir en los dos casos; el camino ampliado agrega tareas y una capability.
