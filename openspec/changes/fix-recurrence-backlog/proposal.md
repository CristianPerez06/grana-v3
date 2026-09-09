# Proposal: fix-recurrence-backlog

## Why

Una recurrencia que quedó sin revisar **corta la cadena para siempre**. No se atrasa: deja de existir.

Caso real reportado en #96: una regla de $2.500 cada 3 días, con el cursor clavado en `2026-06-10` y
**cero** instancias en julio, agosto y septiembre.

La cadena de consecuencias es indirecta y conviene decirla con precisión: al no existir la ocurrencia,
el usuario **no tiene cómo registrarla desde la recurrencia**. Si tampoco carga el movimiento a mano,
sus gastos y saldos quedan incompletos. Una ocurrencia por revisar, por sí sola, **nunca modifica un
saldo** — lo que falta no es el saldo, es la vía para registrarlo. Y todo esto sin ningún aviso.

Del uso real salieron otros tres síntomas que **no son #96**. Los dos primeros los resuelve este
change; el tercero se difiere:

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
  usuario termina duplicando el gasto u omitiéndolo a mano. **Sale de esta entrega**: es
  `recurrence-early-payment` junto con `recurrence-link-movement`.

El relevamiento completo, con los quince defectos y su evidencia, está en
`docs/qa/relevamiento-recurrencias-2026-09-03.md`.

**Se conserva el enfoque propuesta + confirmación; se reemplaza el invariante de una sola pendiente.**
La base caja es más conservadora que el auto-posteo de otras apps y es lo que hace coherente el módulo
Compartido: eso no se toca. Lo que se va es "una sola ocurrencia sin resolver por regla", y con él
llega la válvula de escape que faltaba: **resolver en cualquier orden**.

> **Alcance de esta entrega.** El change se recortó al mínimo que cierra el #96 con una experiencia
> usable, más el doble conteo del #118 que ese mismo arreglo elimina. Pagar antes del vencimiento,
> vincular un movimiento ya cargado, resolver en bloque, deshacer (#104) y el historial enriquecido
> **quedan para changes posteriores**, listados al final. El motivo es de tamaño: la entrega llevaba
> seis mil líneas sin producir todavía ningún cambio visible, y un arreglo que no se puede probar
> contra el uso real no se puede dar por bueno.

## What Changes

Seis comportamientos. Cada uno dice **qué vas a ver**, **qué vas a poder hacer** y **cómo lo
comprobamos**. El ejemplo que los atraviesa: el alquiler de $450.000 que vence todos los 23, con la
ocurrencia de junio sin revisar, mirado un 8 de septiembre.

**La prueba de aceptación de la entrega, en términos de uso:** una regla con varios vencimientos sin
revisar los muestra **todos**, uno sin resolver **no traba** a los siguientes, no aparece **ninguno
duplicado**, se ven en **web y en nativo**, y cada uno se resuelve **por separado y en cualquier
orden**.

### 1. Un vencimiento sin revisar no traba los siguientes

**Hoy:** solo existe el alquiler del 23 de junio. Julio y agosto **no existen** — ni pendientes, ni
pagos, ni omitidos. Julio lee $0 en gastos fijos. Y mientras nadie toque junio, esto no se destraba.

**Vas a ver:** los tres vencimientos —junio, julio y agosto— cada uno por su cuenta.

**Vas a poder:** resolver el de agosto sin haber tocado el de junio. El de junio sigue accesible.

**Se comprueba:** con junio sin revisar, registrar el pago de agosto. Junio queda pendiente, agosto
queda registrado, y septiembre se genera cuando llega su fecha.

**Hasta dónde mira hacia atrás:** los últimos **12 meses**. Lo anterior no se reconstruye —serían
cientos de filas de reglas abandonadas—. El límite es de lo que la app reconstruye sola; vos siempre
podés registrar un pago más viejo.

**Y cuando son muchos:** la reconstrucción va por **tandas de 50**, con el vencimiento vigente
siempre en la primera. Mientras queden, la pantalla lo dice y ofrece **"Continuar reconstrucción"**,
que procesa la siguiente tanda ahí mismo. Sin esa acción, una regla diaria con un año de atraso
obligaría a abrir y cerrar la app unas ocho veces para terminar de ver el propio historial, que no es
una tarea que se le pueda pedir a nadie.

Los vencimientos reconstruidos son elementos por revisar: **no son movimientos ni tocan ningún
saldo** hasta que los resuelvas.

> **Lo que falta:** el cartel que nombra desde cuándo reconstruyó (*"esta recurrencia tiene historial
> anterior a septiembre de 2025"*) queda para `recurrence-review-ux`. Es el borde áspero conocido de
> este mínimo: quien arrastre más de un año ve doce meses sin que nada explique el corte. Lo que sí
> vale desde ahora es la regla negativa — la app **no** afirma que esos meses tengan información
> incompleta, porque esos pagos podés haberlos cargado a mano en su momento.

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

### 3. El vencimiento deja de pisarse con la fecha de pago

**Hoy:** confirmar **pisa** el vencimiento con la fecha que elijas. La ocurrencia pierde para siempre
el vencimiento que le dio origen. Ese borrado no es un problema estético: sin el vencimiento no hay
forma de saber qué ocurrencia era cuál, y por eso hoy el atraso no se puede materializar sin correr
riesgo de duplicar.

**Vas a ver:** que registrar el pago de junio con fecha 3 de septiembre deja el vencimiento en el
**23/06** y el movimiento en el **03/09**, y que junio **no vuelve a aparecer** como pendiente.

Son cuatro instantes y cada uno vive en su propio campo:

| Dato | Qué contesta |
|---|---|
| **Vencimiento** | Cuándo tocaba. Lo fija el calendario de la regla y no cambia nunca. |
| **Fecha de pago** | Cuándo salió la plata. La elegís vos; es la fecha del movimiento. |
| **Fecha de carga** | Cuándo quedó registrado en la app. |
| **Fecha de resolución** | Cuándo se resolvió el vencimiento. |

Una ocurrencia **sin resolver** tiene vencimiento y nada más: todavía no hubo pago, así que no puede
tener fecha de pago.

**Vas a poder:** en **web**, corregir importe, fecha y cuenta al registrar, sin que eso reescriba la
regla ni el vencimiento. En **nativo** el registro usa los valores de la regla: lo que esta entrega
lleva a nativo es que el vencimiento exista, se vea y se pueda resolver, no el formulario editable.
Lo que **no** cambia por plataforma es la garantía: el vencimiento se conserva y el importe de la
regla no se toca, se registre desde donde se registre.

**Se comprueba:** registrar el pago de junio con fecha de septiembre; el vencimiento sobrevive, junio
no se regenera, y el importe de la regla no cambia.

> **Lo que esta entrega guarda pero todavía no muestra.** Los cuatro instantes quedan **registrados**
> desde ahora —es lo que hace posible todo lo demás—, pero el historial que los presenta por separado
> (*vencía el 23/06 · lo pagaste el 03/09 · lo cargaste el 08/09*) se construye en
> `recurrence-history`. Guardar el dato es del mínimo; exhibirlo, no.

### 4. Cambiar la frecuencia no inventa vencimientos viejos

**Vas a ver:** si cambiás una regla de mensual a quincenal, la app te dice **desde cuándo** rige el
cambio y no toca nada anterior.

**Por qué:** el generador nuevo compara el calendario de la regla contra los vencimientos que ya
existen. Sin esta regla, al cambiar la frecuencia leería el calendario viejo como si fueran huecos y
fabricaría vencimientos que nunca existieron.

**Se comprueba:** cambiar una regla mensual con seis meses de historial a quincenal; no aparece
ningún vencimiento nuevo con fecha anterior al cambio.

### 5. Si la app no puede actualizar tus vencimientos, te lo dice

**Hoy:** si la materialización falla, el error se descarta en silencio. La pantalla queda igual que si
no tuvieras nada por revisar — indistinguible de estar al día.

**Vas a ver:** un aviso de que no se pudieron actualizar los vencimientos, con un botón para
reintentar. Nunca un vacío que parezca "no tenés nada".

**Se comprueba:** forzar el fallo; la pantalla lo dice y el reintento funciona.

### 6. Pausar no te acumula una deuda para después

**Vas a ver:** al pausar el gimnasio en enero y reanudarlo el 5 de septiembre, la app vuelve con el
**próximo vencimiento futuro** —el 23 de septiembre— y no con los ocho meses de la pausa.

**Vas a poder:** los vencimientos que ya existían **antes** de pausar siguen ahí, por si querés
registrarlos u omitirlos. Los que caían durante la pausa no existen. (El sello visual "Pausada" sobre
esas filas queda para `recurrence-review-ux`; lo que no se difiere es que sigan estando y se puedan
resolver.)

**Por qué:** pausar significa "esto no está corriendo", no "esto se sigue devengando y te lo cobro
todo junto después". Nadie pausa el gimnasio esperando que al volver le aparezcan las cuotas de los
meses que no fue.

**Se comprueba:** pausar una regla mensual del día 23 en junio, reanudarla el 5 de septiembre; el
próximo vencimiento es el 23 de septiembre y no aparece ninguno de junio, julio ni agosto.

### Y en las dos plataformas

Los seis comportamientos SHALL ser observables en **web y en la app nativa**. Hoy no lo están: el
feed nativo muestra el bloque de pendientes pero **ni siquiera dispara la generación**, así que las
ocurrencias dependen de haber abierto el hub. La lógica vive en `@grana/recurrences` y
`@grana/money-logic`; lo que cambia por plataforma es la UI.

Lo que esta entrega lleva a nativo es la **materialización** y el **bloque de vencimientos por
revisar**: que un vencimiento exista, se vea y se pueda resolver deja de depender de la plataforma.

Lo que **sigue siendo distinto** —y conviene decirlo acá, porque los seis comportamientos no lo
tapan—: el formulario de resolución nativo no deja editar importe, fecha ni cuenta, y no muestra la
advertencia de saldo negativo que sí tiene web. Quien necesite corregir algo al registrar lo hace
desde web. La paridad completa es `recurrence-review-ux`.

### Y los clientes que no se actualizan

Un usuario que se quede en una versión vieja de la app nativa nunca ejecuta el generador nuevo: su
atraso no se materializa y el #96 **sigue vivo para él** — ahora sin el índice que lo contenía. Por
eso esta entrega incluye un **gate de versión mínima** en el cliente nativo, que se despliega
**antes** de retirar el índice. La alternativa que además cubre a quien no abre la app —generar del
lado del servidor— es mejor, pero es un change aparte: `recurrence-server-generation`.

### Orden de despliegue

No es un detalle de implementación, porque un orden mal elegido deja un intervalo peor que el bug
actual —la base admitiendo varias pendientes mientras la app todavía muestra una sola o duplica
importes—:

1. **Migración de expansión** (`0064`): identidad, piso de reconstrucción, guardas. No cambia ningún
   comportamiento; el índice de pendiente única sigue vivo.
2. **Código**: generador con tandas continuables, versiones de cronograma y pausas, reads adaptados,
   dashboard y proyección leyendo las ocurrencias existentes, dejar de escribir el cursor, superficies
   de web y nativo, copy, error de materialización visible, gate de versión.
3. **Migración de activación**, al final: retira `recurrence_instances_one_pending_per_rule`.

Los pasos 1 y 2 comparten **una sola ventana de producción**: la verificación transaccional de `0064`
corre una única vez, y una edición hecha entre ambos despliegues podría desfasar el dato después de
verificarlo y antes de que exista el anclaje que lo vuelve inofensivo.

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
     no corresponde y deja de bloquear las siguientes. **Deshacer** (#104) no está acá: va en
     `recurrence-undo`.
  5. **MODIFIED** "El modulo Movimientos muestra pendientes recurrentes separados del historial" —
     lenguaje "por revisar", el aviso llega al dashboard y deja de plegarse cuando hay vencidos.
  6. **ADDED** "Cada ocurrencia recurrente tiene una identidad estable".
  7. **ADDED** "El sistema materializa las ocurrencias vencidas sin depender de la navegación" —
     incluye el horizonte de 12 meses, las tandas continuables, el error visible con reintento y la
     vigencia de los cambios de calendario.
  8. **ADDED** "Una regla pausada no acumula vencimientos durante la pausa".

## Impact

- **Migraciones (dos, en dos pasos)**: la de **expansión** agrega la identidad de ocurrencia
  (`due_date`) protegida en todos los estados, el piso de reconstrucción, las versiones de cronograma
  y las pausas, y no cambia ningún comportamiento. La de **activación**, al final de la entrega,
  elimina `recurrence_instances_one_pending_per_rule`. `scheduled_date` **no se retira acá**: queda
  como columna legada de compatibilidad que el código nuevo no lee, y su retiro es la migración C,
  fuera de esta entrega.
- `packages/money-logic/src/recurrences.ts` — `decideRecurrenceInstance` devuelve una **lista** de
  ocurrencias en vez de una decisión única; una sola definición de `max_occurrences`.
- `packages/recurrences/src/queries.ts` — el generador camina el calendario; los reads dejan de
  asumir una pendiente por regla (`getPendingInstancesByRecurrenceId` devuelve hoy un
  `Map<string, RecurrenceInstance>`, uno solo por regla).
- `packages/recurrences/src/types.ts` — `RecurrenceSummary.pending_instance` es singular y pasa a
  colección.
- `packages/recurrences/src/mutations.ts` — confirmar y omitir dejan de escribir
  `last_generated_date`.
- `packages/dashboard` — el dashboard, el "próximo" y la proyección pasan a leer los vencimientos
  existentes en vez de proyectarlos desde el cursor. **Es lo que elimina el doble conteo de #118.**
- `apps/web` — bloque de vencimientos por revisar en el dashboard, materialización a nivel layout,
  error visible con reintento.
- `apps/mobile` — las mismas superficies, más la generación en el feed y el gate de versión mínima.
- **Datos existentes**: las reglas hoy trabadas van a materializar su atraso. Es el efecto buscado, y
  hay que anticiparlo: usuarios que hoy ven un pendiente van a ver varios.
- `recurrence_instances` gana **cómo se resolvió** cada ocurrencia (movimiento creado por la
  recurrencia vs. movimiento del usuario vinculado). El dato se **registra** en esta entrega —lo
  escribe la migración de expansión— aunque quien lo consume, deshacer, llegue después: sin él,
  `recurrence-undo` no puede distinguir borrar de desvincular.
- **Alcance**: cierra **#96** y **#118**. **#104 ya no cierra acá**: pasa a `recurrence-undo`.

## Diferido a changes posteriores

Nada de esto se descarta: se saca de esta entrega para que el arreglo del #96 llegue a producción y
se pueda probar contra el uso real. Cada fila conserva su análisis; el texto completo de los
comportamientos que salieron vive en el historial de este archivo.

| Qué sale | Por qué puede esperar | Change |
|---|---|---|
| **Pago anticipado** ("ya lo pagué"), y que pagar antes no corra el calendario | Es una comodidad. Sin él, el usuario espera al vencimiento —que es lo que hace hoy— | `recurrence-early-payment` |
| **Vinculación** ("ya lo cargué"), incluida la de reglas compartidas | Sin él, el camino sigue siendo confirmar u omitir. Es el diferido más caro: quien ya cargó el gasto a mano queda sin salida limpia | `recurrence-link-movement` |
| **Deshacer**, cerrando **#104** | Hoy tampoco se puede deshacer: el diálogo falla siempre. No empeora nada | `recurrence-undo` |
| **Historial enriquecido** (vencimiento / pago / carga por separado) | El dato ya se guarda; falta mostrarlo | `recurrence-history` |
| **Resolución masiva** "ponerse al día" y "usar este importe de acá en más" | Con el backlog visible ya se puede resolver uno por uno. La pasada en bloque es velocidad, no capacidad | `recurrence-catch-up` |
| **UX avanzada**: aviso de historial no reconstruido, sello "Pausada", paridad nativa del formulario de resolución, agrupar por regla, y el diseño cuidado del error de materialización | Ninguno cambia lo que se puede hacer, solo cuán cómodo es | `recurrence-review-ux` |
| **Generación del lado del servidor** | El gate de versión resuelve el caso bloqueante con menos trabajo | `recurrence-server-generation` |
| **Retiro de `scheduled_date`** (migración C) | Ya estaba fuera: exige que ningún cliente viejo quede escribiéndola | — |

Lo que **no** se difirió, aunque se propuso: el error de materialización visible con reintento (en su
versión básica), y las versiones de cronograma y las pausas leídas por el generador. Los tres son
condición para que el mínimo sea correcto, no mejoras — sin los dos últimos, editar la frecuencia o
pausar fabrica vencimientos que nunca existieron.

## Fuera de esta primera entrega

Identificadas, no incluidas: recordatorios y notificaciones push/mail · registro automático de
débitos · ajuste de importes por índice (IPC/ICL) · importes estimados para servicios variables ·
calendarios tipo "segundo jueves" (#35) · pausa con fecha · historial de importes por regla ·
proyección a 12 meses.
