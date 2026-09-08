# Proposal: fix-recurrence-backlog

## Why

Una recurrencia que quedó sin revisar **corta la cadena para siempre**. No se atrasa: deja de existir.

Caso real reportado en #96: una regla de $2.500 cada 3 días, con el cursor clavado en `2026-06-10` y
**cero** instancias en julio, agosto y septiembre.

La cadena de consecuencias es indirecta y conviene decirla con precisión: al no existir la ocurrencia,
el usuario **no tiene cómo registrarla desde la recurrencia**. Si tampoco carga el movimiento a mano,
sus gastos y saldos quedan incompletos. Una ocurrencia por revisar, por sí sola, **nunca modifica un
saldo** — lo que falta no es el saldo, es la vía para registrarlo. Y todo esto sin ningún aviso.

Del uso real salieron otros tres síntomas que **no son #96**, y que este change también resuelve:

- **"Tengo recurrencias que no veo."** La generación no existe del lado del servidor: es un efecto de
  cliente que corre al entrar a `/transactions` o al hub. La app abre en `/dashboard`. Quien entra y
  se queda ahí no materializa nada, nunca. En la app nativa el feed muestra el bloque de pendientes
  pero **no** dispara la generación — solo el hub lo hace.
- **"La veo en Recurrencias pero no me aparece el aviso."** El aviso existe en Movimientos y en el
  hub, pero **no en Inicio** —que es donde empieza la sesión— y arranca **plegado** cuando hay 2 o
  más pendientes: cuantas más cosas hay para revisar, más escondido está.
- **"Vence en 20 días, lo pagué hoy, y no tengo manera de marcarlo."** Confirmar exige una instancia
  pendiente, y esa instancia solo nace cuando llegó la fecha. El único camino disponible —cargar el
  gasto a mano— es peor que no hacer nada: queda sin vincular, la regla lo va a proponer igual, y el
  usuario termina duplicando el gasto u omitiéndolo a mano.

El relevamiento completo, con los quince defectos y su evidencia, está en
`docs/qa/relevamiento-recurrencias-2026-09-03.md`.

**Se conserva el enfoque propuesta + confirmación; se reemplaza el invariante de una sola pendiente.**
La base caja es más conservadora que el auto-posteo de otras apps y es lo que hace coherente el módulo
Compartido: eso no se toca. Lo que se va es "una sola ocurrencia sin resolver por regla", y con él
llegan las válvulas de escape que faltaban: resolver fuera de orden, pagar antes, y decir "esto ya lo
cargué".

## What Changes

Once comportamientos. Cada uno dice **qué vas a ver**, **qué vas a poder hacer** y **cómo lo
comprobamos**. El ejemplo que los atraviesa: el alquiler de $450.000 que vence todos los 23, con la
ocurrencia de junio sin revisar, mirado un 8 de septiembre.

### 1. Un vencimiento sin revisar no traba los siguientes

**Hoy:** solo existe el alquiler del 23 de junio. Julio y agosto **no existen** — ni pendientes, ni
pagos, ni omitidos. Julio lee $0 en gastos fijos. Y mientras nadie toque junio, esto no se destraba.

**Vas a ver:** los tres vencimientos —junio, julio y agosto— cada uno por su cuenta.

**Vas a poder:** resolver el de agosto sin haber tocado el de junio. El de junio sigue accesible.

**Se comprueba:** con junio sin revisar, registrar el pago de agosto. Junio queda pendiente, agosto
queda registrado, y septiembre se genera cuando llega su fecha.

**Hasta dónde mira hacia atrás:** los últimos **12 meses**. Lo anterior no se reconstruye —serían
cientos de filas de reglas abandonadas—, y el aviso lo dice **de la recurrencia, no del mes**:

> *Esta recurrencia tiene historial anterior a septiembre de 2025 que Grana no reconstruyó.*

La diferencia importa: decir que el mes tiene información incompleta sería falso si esos pagos los
cargaste a mano en su momento. El límite es de lo que la app reconstruye sola; vos siempre podés
registrar un pago más viejo.

Los vencimientos reconstruidos son elementos por revisar: **no son movimientos ni tocan ningún
saldo** hasta que los resuelvas.

> ⚠️ **Esto hace que la app se vea más cargada, no menos.** Hoy se ve prolija porque está escondiendo
> trabajo sin hacer. Es el dato real apareciendo, no una regresión.

### 2. Lo que falta revisar no afirma que debés esa plata

**Hoy:** no aplica, porque el atraso no existe.

**Vas a ver:** un grupo rotulado **"3 vencimientos por revisar"**. Ni "3 pagos pendientes", ni
"pagos por revisar" —la app todavía no sabe si hubo pago—, ni "debés $1.350.000".

**Por qué:** tres vencimientos sin confirmar **no son** tres alquileres impagos. Pueden ser tres
pagos que hiciste y no registraste. La app sabe que le falta información; no sabe que debés esa
plata. El total se muestra como referencia de lo que hay para revisar, nunca como deuda.

**Se comprueba:** el rótulo y el copy no usan lenguaje de deuda en ninguna de las dos plataformas.

### 3. Podés registrar un pago antes del vencimiento

**Hoy:** el alquiler vence el 23, lo pagaste el 3, y **no hay ningún botón**. El hub lo lista con
"Próximo: 23 de septiembre" y nada más.

**Vas a ver:** en la fila de la recurrencia, un botón **"Ya lo pagué"**.

**Vas a poder:** registrarlo el 3, con el formulario de confirmación de siempre.

**Se comprueba:** con hoy = 3 de septiembre y el alquiler venciendo el 23, registrar el pago. Se crea
el gasto con fecha 3 de septiembre y el vencimiento del 23 queda resuelto.

### 4. Pagar antes no corre el calendario

**Vas a ver:** después de pagar el 3 lo que vencía el 23 de septiembre, el próximo vencimiento sigue
siendo el **23 de octubre**.

**Por qué:** el ritmo es del alquiler, no de cuándo pagaste. Si el ciclo se recalculara desde el pago
real, la fecha se correría hacia atrás mes a mes hasta desfasarse del alquiler de verdad.

**Se comprueba:** pagar tres meses seguidos unos días antes; el vencimiento sigue cayendo el 23.

### 5. Vencimiento, fecha de pago y fecha de carga son datos distintos

**Hoy:** confirmar **pisa** el vencimiento con la fecha que elijas. La ocurrencia pierde para siempre
el vencimiento que le dio origen, y el historial no puede contestar "¿qué vencimiento pagué el 3?".

**Vas a ver:** en el historial, cada cosa por separado: *vencía el 23/06 · lo pagaste el 03/09 · lo
cargaste el 08/09*.

Son cuatro instantes y cada uno vive en su propio campo:

| Dato | Qué contesta |
|---|---|
| **Vencimiento** | Cuándo tocaba. Lo fija el calendario de la regla y no cambia nunca. |
| **Fecha de pago** | Cuándo salió la plata. La elegís vos; es la fecha del movimiento. |
| **Fecha de carga** | Cuándo quedó registrado en la app. |
| **Fecha de resolución** | Cuándo se resolvió el vencimiento (registrando o vinculando). |

Una ocurrencia **sin resolver** tiene vencimiento y nada más: todavía no hubo pago, así que no puede
tener fecha de pago.

**Vas a poder:** registrar cada caso como fue, sin que la app elija por vos:

| Lo que pasó | Qué queda registrado |
|---|---|
| Pagaste el 23/06 y lo cargás en septiembre | Pago el **23/06**. Junio se corrige, y está bien que se corrija. |
| Vencía el 23/06 y pagaste el 03/09 | Pago el **03/09**, asentando que corresponde al vencimiento de junio. |
| Vencía el 23/09 y pagaste el 03/09 | Pago el **03/09**. El próximo sigue siendo el 23/10. |

**Se comprueba:** los tres casos, verificando que el vencimiento original sobrevive en los tres.

### 6. Podés vincular un pago que ya cargaste

**Hoy:** no existe. Si ya cargaste el alquiler a mano, tus opciones son confirmarlo (y tenerlo dos
veces) u omitirlo (y perder el rastro).

**Vas a ver:** en la fila del vencimiento, la opción **"Ya lo cargué"**, que te deja elegir entre tus
movimientos.

**Vas a poder:** decir "este gasto del martes es el alquiler de septiembre". El vencimiento queda
resuelto y **no se crea ningún gasto nuevo**.

La app recuerda **cómo** se resolvió cada vencimiento —con un movimiento que ella creó, o con uno
tuyo que vinculaste—, porque deshacer no significa lo mismo en los dos casos (ver 8).

**Si la recurrencia es compartida con el hogar**, vincular un gasto tuyo no puede cambiar en silencio
lo que le debe el otro: solo se acepta si el movimiento ya tiene un reparto compatible, y si no lo
tiene la app te explica que va a convertirlo en compartido y te pide confirmación. La conversión y la
vinculación pasan juntas o no pasa ninguna.

**Cómo se rotula:** el movimiento queda marcado como **"vinculado a esta recurrencia"**, no como
"originado en" — existía antes, la recurrencia no lo creó.

**Se comprueba:** cargar un gasto suelto, vincularlo, y verificar que el total del mes no cambió y
que el rótulo dice "vinculado". En una regla compartida, que la deuda del hogar quede igual que si el
gasto se hubiera registrado desde la recurrencia.

### 7. Podés revisar varios juntos, corrigiendo cada uno

**Vas a ver:** una acción **"Ponerse al día"** sobre el grupo, con una fila por vencimiento.

**Vas a poder:** para cada fila, corregir **fecha, importe y cuenta**, y elegir entre cuatro salidas:
registrar el pago · vincular uno existente · indicar que no corresponde · dejarlo pendiente. Antes de
guardar, un resumen de lo que va a pasar.

**Por qué corregir es parte del funcionamiento básico y no una opción:** si estás registrando pagos
reales, el importe puede no ser el que la regla suponía —un alquiler que ajustó— y la cuenta puede no
ser la de siempre.

**Corregir un importe afecta solo a ese vencimiento.** Hoy no es así: confirmar con otro importe
reescribe el de la regla, de modo que resolver junio, julio y agosto con importes distintos dejaría
la regla con el que se haya guardado último — un resultado que depende del orden. Si además querés
que el importe nuevo valga para adelante, hay una acción aparte, **"Usar este importe de acá en
más"**, que se aplica una sola vez y toma el del vencimiento más reciente.

**La pasada es todo o nada.** Si algo falla a mitad de camino, no queda medio grupo resuelto: o se
guardan todos los cambios o no se guarda ninguno, y la pantalla dice qué pasó.

**Se comprueba:** resolver tres meses en una pasada, con importes distintos entre sí y uno pagado
desde otra cuenta; el importe de la regla no cambia. Y forzar un error en el tercero: los dos
primeros tampoco quedan guardados.

### 8. Podés deshacer, y deshacer no es lo mismo que omitir

**Hoy:** ningún movimiento creado al confirmar una recurrencia se puede borrar (#104). El diálogo
falla siempre con "Algo salió mal".

**Vas a ver:** dos salidas distintas, con nombres distintos.

**Vas a poder:** elegir la que corresponde:

| Lo que quisiste decir | Qué queda |
|---|---|
| **"Me equivoqué al cargar este pago"** (lo creó la recurrencia) | El movimiento se borra y el vencimiento **vuelve a estar por revisar**. |
| **"Me equivoqué al vincular"** (el movimiento era tuyo) | El movimiento **se conserva** —vuelve a ser un gasto suelto— y el vencimiento vuelve a estar por revisar. Si al vincularlo la app lo había convertido en compartido, deshacer **también revierte eso**: vuelve a ser personal y la deuda del hogar se deshace. |
| **"Este período no corresponde"** | El vencimiento queda **omitido**. No se espera ningún pago. |

**Por qué la primera fila y la segunda no son la misma:** si vinculaste un gasto que habías cargado
vos, deshacer no puede borrarlo — la recurrencia no lo creó y no le corresponde destruirlo.

**Por qué la tercera es distinta de las dos anteriores:** el plan actual del #104 convierte
**siempre** el pago borrado en "omitido". Eso resuelve una restricción de la base, pero le hace decir
al dato algo que quizá no quisiste: que ese mes no correspondía, cuando solo te equivocaste al
cargarlo.

**El #104 se implementa dentro de este change**, no después: depende del modelo nuevo y de un índice
que este change elimina. Los dos tickets cierran con la misma entrega.

### 9. Cambiar la frecuencia no inventa vencimientos viejos

**Vas a ver:** si cambiás una regla de mensual a quincenal, la app te dice **desde cuándo** rige el
cambio y no toca nada anterior.

**Por qué:** el generador nuevo compara el calendario de la regla contra los vencimientos que ya
existen. Sin esta regla, al cambiar la frecuencia leería el calendario viejo como si fueran huecos y
fabricaría vencimientos que nunca existieron.

**Se comprueba:** cambiar una regla mensual con seis meses de historial a quincenal; no aparece
ningún vencimiento nuevo con fecha anterior al cambio.

### 10. Si la app no puede actualizar tus vencimientos, te lo dice

**Hoy:** si la materialización falla, el error se descarta en silencio. La pantalla queda igual que si
no tuvieras nada por revisar — indistinguible de estar al día.

**Vas a ver:** un aviso de que no se pudieron actualizar los vencimientos, con un botón para
reintentar. Nunca un vacío que parezca "no tenés nada".

**Se comprueba:** forzar el fallo; la pantalla lo dice y el reintento funciona.

### 11. Pausar no te acumula una deuda para después

**Vas a ver:** al pausar el gimnasio en enero y reanudarlo el 5 de septiembre, la app vuelve con el
**próximo vencimiento futuro** —el 23 de septiembre— y no con los ocho meses de la pausa.

**Vas a poder:** los vencimientos que ya existían **antes** de pausar siguen ahí, con sello
"Pausada", por si querés registrarlos u omitirlos. Los que caían durante la pausa no existen.

**Por qué:** pausar significa "esto no está corriendo", no "esto se sigue devengando y te lo cobro
todo junto después". Nadie pausa el gimnasio esperando que al volver le aparezcan las cuotas de los
meses que no fue.

**Se comprueba:** pausar una regla mensual del día 23 en junio, reanudarla el 5 de septiembre; el
próximo vencimiento es el 23 de septiembre y no aparece ninguno de junio, julio ni agosto.

### Y en las dos plataformas

Los once comportamientos SHALL estar disponibles en **web y en la app nativa**. Hoy no lo están: el
bloque de pendientes nativo no deja editar importe ni fecha, no muestra la advertencia de saldo
negativo que sí tiene web, y el feed nativo ni siquiera dispara la generación. La lógica vive en
`@grana/recurrences` y `@grana/money-logic`; lo que cambia por plataforma es la UI.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`:
  1. **RENAMED + MODIFIED** "El sistema genera instancias recurrentes de forma secuencial" →
     "El sistema genera todas las ocurrencias vencidas de una regla". El invariante "una sola
     pendiente por regla a la vez" se reemplaza por "una instancia por ocurrencia".
  2. **MODIFIED** "La generación de instancias recurrentes usa intervalo+unidad y corta por la
     primera condición de fin" — sale el invariante de pendiente única; se define de una sola forma
     el conteo de `max_occurrences`.
  3. **MODIFIED** "El usuario puede confirmar una instancia recurrente" — vencimiento y fecha de pago
     como datos separados; resolver un pago deja de mover el cursor de generación.
  4. **MODIFIED** "El usuario puede omitir una instancia recurrente" — omitir declara que el período
     no corresponde, y se distingue de deshacer.
  5. **MODIFIED** "El modulo Movimientos muestra pendientes recurrentes separados del historial" —
     lenguaje "por revisar", el aviso llega al dashboard y deja de plegarse cuando hay vencidos.
  6. **ADDED** "Cada ocurrencia recurrente tiene una identidad estable".
  7. **ADDED** "El usuario puede registrar el pago de una ocurrencia antes de su vencimiento".
  8. **ADDED** "El usuario puede vincular un movimiento existente a una ocurrencia".
  9. **ADDED** "El usuario puede resolver en bloque las ocurrencias sin revisar".
  10. **ADDED** "El sistema materializa las ocurrencias vencidas sin depender de la navegación" —
      incluye el horizonte de 12 meses, el error visible con reintento y la vigencia de los cambios
      de calendario.

## Impact

- **Migración**: se elimina el índice `recurrence_instances_one_pending_per_rule`; se agrega la
  identidad de ocurrencia (`due_date`) protegida en todos los estados; `scheduled_date` deja de ser
  pisado al confirmar y **se retira**; durante la transición queda como columna legada de
  compatibilidad, que el código nuevo no lee.
- `packages/money-logic/src/recurrences.ts` — `decideRecurrenceInstance` devuelve una **lista** de
  ocurrencias en vez de una decisión única; una sola definición de `max_occurrences`.
- `packages/recurrences/src/queries.ts` — el generador camina el calendario; los reads dejan de
  asumir una pendiente por regla (`getPendingInstancesByRecurrenceId` devuelve hoy un
  `Map<string, RecurrenceInstance>`, uno solo por regla).
- `packages/recurrences/src/types.ts` — `RecurrenceSummary.pending_instance` es singular y pasa a
  colección.
- `packages/recurrences/src/mutations.ts` — confirmar y omitir dejan de escribir
  `last_generated_date`; nacen registrar-anticipado, vincular y deshacer.
- `apps/web` — bloque de pendientes en el dashboard, "Ponerse al día", "Ya lo pagué", "Ya lo cargué".
- `apps/mobile` — las mismas superficies, más la generación en el feed.
- **Datos existentes**: las reglas hoy trabadas van a materializar su atraso. Es el efecto buscado, y
  hay que anticiparlo: usuarios que hoy ven un pendiente van a ver varios.
- `recurrence_instances` gana **cómo se resolvió** cada ocurrencia (movimiento creado por la
  recurrencia vs. movimiento del usuario vinculado), sin el cual deshacer no puede distinguir borrar
  de desvincular.
- **Alcance**: **#104 se implementa dentro de este change** y cierra con él. #118 (doble conteo en
  Compromisos) es **independiente** y no espera a esto.

## Fuera de esta primera entrega

Identificadas, no incluidas: recordatorios y notificaciones push/mail · registro automático de
débitos · ajuste de importes por índice (IPC/ICL) · importes estimados para servicios variables ·
calendarios tipo "segundo jueves" (#35) · pausa con fecha · historial de importes por regla ·
proyección a 12 meses.
