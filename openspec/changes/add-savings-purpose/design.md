# Design: add-savings-purpose

Decisiones cerradas de la fase 2, con su porqué. El modelo conceptual completo está en
`docs/modelo-de-dinero.md`; las decisiones de la fase 1 están en `add-savings-set-aside/design.md`
y esta change no las revisa.

## D0 — Un propósito es un nombre y un ícono, y nada más

Sin monto objetivo, sin fecha, sin progreso. Eso es una **meta**, y es de la fase 4.

La separación es lo que mantiene barata la fase, pero el motivo de fondo no es el costo: una meta
sin posiciones detrás es una barra de progreso que **no sabe en qué está parada la plata**. En
Argentina esa es precisamente la enseñanza que hay que dar —*tu objetivo está en dólares y tu ahorro
en pesos*— y una barra que mide el número nominal enseña lo contrario.

## D1 — El propósito no participa de ningún número

`get_available_sums` y `get_reserve_flow_sums` quedan **idénticas**, y el dashboard no se toca.

Es la propiedad que hace que la fase no pueda romper la fase 1: si ninguna lectura de plata cambia,
ninguna identidad de la card puede dejar de cerrar. El propósito es un corte del guardado, no un
término de ninguna resta.

## D2 — El piso pasa a ser por (propósito, moneda); el tope NO

La asimetría es deliberada.

Con propósitos, *"no podés volver a usar más de lo que tenés guardado"* deja de alcanzar. Con
Emergencia en $50.000 y *Sin destino* en $140.000, volver a usar $80.000 parado en Emergencia pasa
cualquier control sobre el total de $190.000 y deja ese grupo en **−$30.000**: afirmaría que se puede
gastar plata que el grupo no tiene, mientras todos los números de la pantalla siguen cerrando.

Guardar, en cambio, **no se topea por propósito**: sin objetivo no hay contra qué toparlo. El tope
sigue siendo el disponible de la moneda.

La suma por propósito vive en SQL (`get_purpose_sums`) y no se recompone en TS. Es la lección de la
migración 0051 un nivel más abajo: ahí el criterio de "cuenta propia" estaba replicado a mano en cada
call site y ya había divergido en producción.

## D3 — «Sin destino» es un grupo, no una ausencia

`purpose_id` en null tiene **las mismas reglas que cualquier propósito**, incluido el piso.

Tratarlo como "las que todavía no tienen nombre" sería justo por donde se escaparía el control de D2:
el grupo sin etiqueta es, para casi todos los usuarios, el que más plata tiene.

El rótulo es copy y vive en i18n. La base devuelve `purpose_name` en null: no habla castellano.

## D4 — Borrar un propósito no puede cambiar ningún número

`ON DELETE SET NULL`, con un `do $check$` que **falla la migración** si alguien lo cambia.

Las tres opciones y por qué:

| Regla | Qué haría | Por qué no |
|---|---|---|
| `CASCADE` | Borra las reservas | Le baja el guardado al usuario sin que nadie lo haya decidido. Y todas las lecturas seguirían cerrando — con menos plata. Ninguna suite lo notaría |
| `RESTRICT` | Obliga a vaciar el propósito antes | Es pedirle que devuelva plata al disponible para poder renombrar una idea |
| **`SET NULL`** | La plata vuelve a *Sin destino* | Borrar una **etiqueta** no toca ningún **número** |

La app avisa cuánta plata se mueve antes de borrar, con el monto por moneda.

## D5 — Nombre único por usuario, normalizado

Índice único sobre `(user_id, lower(btrim(name)))`.

Dos *Emergencia* no se distinguen mirándolos, y el problema no aparece al crearlos: aparece meses
después, cuando el usuario no entiende por qué su plata quedó partida en dos.

**Límite conocido:** no pliega acentos, así que *Japon* y *Japón* conviven. `unaccent` no es
`IMMUTABLE` y no entra en un índice sin un wrapper propio. Si molesta, se resuelve con un
`canonical_name` como el de `categories`.

## D6 — Sin propósitos de sistema: las sugerencias viven en la app

`categories` siembra filas de sistema (`user_id` nulo) y sería el precedente obvio. **No se copia.**

Una categoría de sistema no se puede renombrar y está bien: *Comida* le sirve igual a todos. Un
propósito de sistema tampoco se podría renombrar, y ahí el costo es la fase entera: si *Viaje* viene
de fábrica, no se puede convertir en **Japón** — y el nombre personal *es* el valor de esta fase.

Las sugeridas (**🚑 Emergencia · ✈️ Viaje · 🚗 Auto · 🏠 Casa · 🎓 Estudio**) son copy en i18n. Tocar
una **crea el propósito y sigue** — no abre un formulario a confirmar lo que ya está escrito.

Esa pantalla intermedia existió en la primera versión y se sacó: el nombre y el ícono ya son los que
el usuario eligió **al tocar**, así que no decidía nada y cobraba dos toques por confirmarse a sí
misma. Quien quiere otro nombre tiene *«Nuevo propósito»* al lado, que es la puerta correcta para
eso. El propósito creado sigue siendo suyo, renombrable y borrable.

*Emergencia* va primero a propósito. Es la única con contenido financiero real detrás, y ponerla a la
vista es lo más parecido a un consejo que Grana puede dar sin dar consejos.

Una sugerencia cuyo nombre el usuario ya tiene **no se ofrece**: el atajo pensado para ahorrar tipeo
sería, si no, la forma más fácil de chocar contra D5.

## D7 — Un solo campo de texto, no nombre + descripción

Se evaluó que el propósito tuviera **nombre** (de una lista) y **descripción** libre —*Viaje* +
*Japón*— y se descartó.

- **Choca con D5.** *Viaje → Japón* y *Viaje → Bariloche* son dos propósitos **llamados igual**: el
  índice los rechaza. Y sacando el índice, el selector muestra dos chips que dicen *Viaje* y *Viaje*,
  que es el problema de D5 entrando por la otra puerta.
- **No entra en pantalla.** El nombre aparece en el selector, en el detalle y —en fase 4— en la card.
  *"para Japón"* entra; *"para Viaje · Japón"* es casi el doble en filas que ya se pelean por una
  línea en el teléfono. Y mostrar solo una de las dos convierte a la otra en un campo que se llena y
  no se ve nunca.
- **Lo que se buscaba se resuelve con prefill** (D6), que da el mismo ahorro de tipeo con un campo.

No hace falta un estado *"Personalizada"*: ese estado supone una lista cerrada de la que uno se salió,
y acá **todos los propósitos son del usuario desde el primer momento**.

Si en fase 4 aparece la necesidad de una **nota** (*"marzo 2027, con Ana"*), la pantalla de detalle de
la meta tiene lugar de sobra y la columna es aditiva.

## D8 — Los propósitos son planos; la jerarquía se revisa en fase 4

Se evaluó una estructura de dos niveles al estilo `categories`/`subcategories` —*Viaje* como grupo,
*Japón* y *Bariloche* adentro— y se difiere.

**El precedente no aplica: una categoría no tiene saldo.** *Comida* etiqueta un gasto que ya ocurrió;
el número vive en la transacción. Un propósito tiene un **stock derivado que debe respetar un piso**
(D2), y ahí la jerarquía abre una pregunta que la etiqueta nunca tuvo que contestar: **¿la plata se
guarda en el grupo o en el subgrupo?**

Si se permite en los dos, el grupo tiene plata que no es de ningún subgrupo —un *Sin destino* dentro
de cada grupo— y volver a usar parado en el padre exige **imputar**: ¿sale de lo suelto, de Japón,
repartido? Esa pregunta ya se contestó que no en la fase 1, y es la razón por la que una reserva no
tiene `account_id`: imputar retiros parciales es exactamente lo que el modelo se niega a inventar.

**Y el costo lo paga todo el mundo.** La jerarquía rinde a partir de muchos ítems por grupo; con uno o
dos viajes es un selector de dos pasos y un detalle de dos niveles para agrupar dos cosas. En una lista
plana, ✈️ *Japón* y ✈️ *Bariloche* ya se leen como familia: el **ícono** hace ese trabajo sin schema.

**Si alguna vez se hace, la única versión que cierra** es que la plata viva **solo en las hojas** y el
padre sea rótulo puro que suma lo de abajo: sin plata suelta en el padre no hay nada que imputar y el
piso sigue siendo por hoja. La versión que no funciona es la que deja guardar en los dos niveles.

**Fase 4 es el momento natural para revisarlo**, porque ahí los propósitos ganan objetivo y la suma de
un grupo significa algo: *"entre Japón y Bariloche tengo US$ 3.000 de los US$ 5.000 que necesito"*. Hoy
sumaría números sin nada contra qué compararlos. Agregar un `parent_id` nullable es aditivo y los
propósitos existentes quedan como raíces, sin migrar nada.

## D9 — El propósito se hereda de dónde se tocó, no se pregunta

Al volver a usar plata desde un propósito, **no hay campo de propósito**: se llegó tocando ese grupo,
así que Grana ya sabe de dónde sale — igual que el drawer de la fase 1 hereda la moneda.

El único caso en que sí pregunta es abrir *Volver a usar* desde el total teniendo **más de un grupo con
saldo**. Ahí la primera pantalla es elegir cuál, con los montos a la vista. **No hay una tercera
opción**: repartirlo automáticamente sería inventar una imputación (D8).

## D10 — La pertenencia del propósito se valida contra la base

RLS impide **leer** el propósito de otro usuario, pero el FK **no mira dueños**: sin un chequeo
explícito, un cliente modificado podría colgar una reserva propia de una etiqueta ajena. No filtra
datos —el otro usuario nunca la vería— pero si esa persona borra su propósito, la reserva se mueve
sola por D4.

Se valida en la mutación, como el tope y el piso, y por la misma razón: un schema valida la **forma**;
el estado del servidor lo valida el servidor.

## D11 — El propósito se REPARTE, no se etiqueta (corrige a 0058)

Primero se implementó como una columna `purpose_id` en `availability_reserve`: cada fila del
historial llevaba su propósito, y se etiquetaba tocando un movimiento. **Está mal**, y la migración
`0059` lo corrige.

**El motivo es el mismo por el que una reserva no tiene `account_id`: la plata guardada es
fungible.** No existen "los $300.000 guardados el 15/7"; existe "hay $190.000 guardados". Si de esos
$300.000 el usuario ya volvió a usar parte, etiquetar esa fila afirma que hay $300.000 apartados —
y deja al grupo sin etiqueta en **negativo** mientras el total sigue cerrando. Es exactamente el
estado que el piso de D2 existía para impedir, entrando por la puerta de atrás.

**Y no se arregla validando.** Con filas de 300.000, 600.000, 10.000 y 200.000 no hay forma de
expresar *"150.000 son para Japón"*: haría falta una fila de exactamente 150.000. El etiquetado por
fila no puede expresar la mayoría de los repartos posibles. El problema no es el control, es la
unidad.

La pregunta correcta no es *¿para qué fue este guardado viejo?* —una pregunta sobre el pasado, que
ya no se puede contestar— sino **de lo que tengo guardado hoy, ¿cuánto es para Japón?**, que se
contesta con un monto.

Cada verbo con su tabla:

| Tabla | Verbos | Efecto |
|---|---|---|
| `availability_reserve` | guardar ⇄ volver a usar | mueve el disponible |
| `savings_purpose_allocation` | destinar ⇄ quitar destino | **no mueve ningún total** |

**«Sin destino» deja de ser filas y pasa a ser el resto**, derivado en SQL: `guardado − lo
repartido`. Que es lo que honestamente es — no un propósito, sino lo que sobra. Para el usuario
sigue siendo un grupo, con las mismas reglas.

Tres cosas se acomodan solas, y ninguna es un efecto lateral menor:

- **Borrar un propósito ya no puede tocar plata, y no porque lo cuidemos.** La plata vive en
  `availability_reserve`, que los propósitos ni rozan. El self-check de D4 sobre la regla de borrado
  deja de hacer falta porque el peligro deja de existir; `0059` lo reemplaza por uno que impide
  reintroducir `purpose_id` en la reserva.
- **La fase 4 pide montos**, no filas: *"US$ 3.000 de los US$ 5.000 para Japón"*.
- **La fase 3 no queda encajonada**: *"este plazo fijo respalda Japón"* es una fila más, y con la
  columna en las reservas habría sido imposible sin inventar una reserva falsa para plata que ya
  salió de la cuenta.

## D12 — El invariante vive en la base, y se dispara desde las dos tablas

```
por moneda:     lo repartido  <=  lo guardado
por propósito:  lo repartido  >=  0
```

En un trigger, no en el write path, y el motivo es que **el invariante lo pueden romper dos tablas
distintas**. Apartar de más lo rompe por arriba. Volver a usar plata que ya estaba repartida lo rompe
por abajo — **sin tocar una sola fila de reparto**. Un control en la mutación tendría que estar en
los dos lados y acordarse para siempre, que es exactamente la forma del bug que 0051 sacó de
producción.

El control del write path se queda igual, pero cambia de rol: existe para **dar un mensaje con el
número**, no para ser la única defensa.

Sin corte temporal a propósito: el invariante es sobre todas las filas, no sobre las vigentes a una
fecha. Si no, el estado dependería de qué día se lo mire.

## D13 — Guardar "para Japón" son dos filas, y van juntas o no van

`write_reserve` escribe la reserva y su reparto **en una transacción**. Con dos llamadas desde el
cliente, entre una y otra puede fallar la red y quedar la mitad: plata guardada que el usuario pidió
apartar y quedó sin apartar, sin que nada avise. No corrompe ningún total, pero es un estado que
nadie pidió.

El orden **no es simétrico**, y esto es lo que haría fallar una implementación descuidada:

- **guardar** → reserva primero: sube el techo, después se reparte.
- **volver a usar** → reparto primero: baja lo repartido, después baja el techo.

Al revés, cada operación se cruzaría con su propio invariante a mitad de camino.

La pertenencia del propósito se chequea con `user_id` **explícito** dentro de la función. En el resto
del repo repetir el criterio de RLS es duplicación; acá no: no es un filtro de listado, es la
decisión de seguridad de la función, y hacerla depender de qué rol la ejecute la vuelve
silenciosamente permisiva para cualquier caller privilegiado.

## D14 — El verbo del reparto es **Destinar**, no "Apartar"

La primera versión de la UI lo llamó *Apartar*. **Choca con la fase 1**: el copy de la tira de
sugerencia ya dice *"Podés **apartar** $10.000 de este ingreso"* usando "apartar" como sinónimo de
**guardar**. Dos operaciones distintas con la misma palabra, en la misma pantalla, es la confusión
que el modelo entero viene a evitar.

Candidatos y por qué caen:

| Candidato | Por qué no |
|---|---|
| Apartar | Ya significa *guardar* en el copy de la fase 1 |
| Mover a Japón | "Mover" es exactamente lo que la operación NO hace, y es la creencia que el modelo combate |
| Sacar de Japón | "Sacar" está descartado desde D10: es el verbo de retirar plata del banco |
| Asignar ⇄ desasignar | Correcto y neutro, pero "desasignar" no es una palabra que nadie diga |

**Destinar** gana por tres razones:

1. **No choca con nada.** Ningún otro acto de la app lo usa.
2. **Es el verbo del sustantivo que ya está en pantalla.** El resto se llama *«Sin destino»*, así que
   la acción y el grupo se explican mutuamente: destinás algo, y lo que no destinaste queda sin
   destino.
3. **No dice nada sobre movimiento.** Ni sugiere que la plata cambie de lugar.

El inverso es **Quitar destino**, que se lee solo por la misma razón.

Los nombres técnicos siguen siendo `allocateToPurpose` / `unallocateFromPurpose`, como
`releaseAvailability` sigue llamándose así mientras la UI dice *Volver a usar*: el repo nombra en
técnico preciso lo que el producto llama distinto.

## D15 — «Sin destino» no tiene vista propia: la fila ES la acción

Tocar el resto en el desglose lleva **directo a elegir para qué**, sin pasar por una vista de grupo.

El resto no es un propósito: no tiene nombre que editar, no tiene historial propio —no hay actos
suyos que listar— y **lo único que se hace con él es darle destino**. Una pantalla intermedia para
mostrar un número que ya estaba en la fila que se tocó no es una vista, es un peaje: cobraba un toque
por no decidir nada.

Los propósitos sí abren su grupo: ahí hay historial de repartos, renombre, borrado y cuatro acciones.

El resto **no va en la lista**: va separado abajo, con sus dos acciones a la vista. Ver D22bis.

De paso, esto hace que **la puerta sea una sola**: con cero repartos, la fila dice *"Decir para qué
es"*; con repartos, el desglose muestra «Sin destino» — y las dos llevan al mismo lugar. El usuario
no aprende dos caminos para lo mismo según cuánto tenga hecho.

**Guardar tampoco iría en esa vista**, y esa fue la observación que la destapó: guardar desde el
resto no agrega nada sobre el botón del nivel de arriba, y es una versión *peor* del mismo botón —
arriba se puede elegir propósito, ahí quedaría clavado en "ninguno".

## D16 — La moneda es el eje de la OPERACIÓN; el propósito, el de la LECTURA

El detalle arrancó partido por moneda —un bloque para pesos y otro para dólares— y después con un
selector entre los dos. Las dos versiones son técnicamente correctas y las dos esconden la pregunta
de la fase: *¿para qué tengo guardada la plata?*

Con la moneda como eje, un propósito bimoneda **no existe en ninguna pantalla**: para saber cuánto
hay para «Japón» había que mirar pesos, recordar el número, cambiar a dólares y sumar de cabeza — que
es exactamente la operación que el modelo prohíbe hacer.

Entonces:

- **Leer** es por propósito. Cada fila muestra sus montos en las dos monedas, **sin sumarlos**. Y la
  fila crece solo cuando el dato lo pide: un propósito con pesos únicamente ocupa una línea.
- **Operar** es por moneda, porque una operación es sobre una plata concreta. El chip vive en los
  formularios —guardar, destinar, volver a usar— que es donde la moneda es un dato y no una
  estructura.

El detalle queda con lo que la fase existe para contestar: **cuánto hay guardado**, **para qué es**,
y las dos acciones.

**Un solo número protagonista.** *Para gastar* estuvo un rato como tarjeta gemela y se sacó: dos
tarjetas iguales no dejan protagonista a ninguna, y esta pantalla contesta *"cuánto tengo guardado y
para qué"*. El disponible es el número del **dashboard**, que está literalmente detrás del drawer, y
acá aparece donde significa algo — como resultado de la resta, adentro del puente.

### Lo explicativo se pliega, no se borra

*«Cómo se ve en tu banco»* —el puente, la nota y el neto del mes— pasa a un desplegable. Fue el
centro de la fase 1, cuando la idea nueva era *"tu banco muestra otro número"*. Ya no lo es.

Pero **no se elimina**: es lo que evita que alguien abra su home banking, vea otra cifra y le crea al
banco. Una explicación que se entiende una vez no tiene que cobrar altura todos los días — y tampoco
puede desaparecer el día que alguien la necesita.

El historial se pliega por lo mismo, y pasa a ser bimoneda en **una sola consulta**: dos listas de 25
mezcladas a mano dan hasta 50 filas y un "hay más" que ya no significa nada.

## D17 — El verbo lleva la dirección; el número, no

*«Volviste a usar este mes −$110.000»* es una doble negación: el rótulo ya dice que la plata salió
del guardado, y el signo lo dice otra vez. Se lee como *"des-volviste a usar"*.

El neto del mes va **sin signo**. El rótulo dice para dónde y el número dice cuánto.

En el historial el signo **se queda**, y no es incoherencia: ahí es el dato que hace escaneable la
columna, y el verbo es la etiqueta de cada fila. Roles invertidos, tratamiento distinto.

## D18 — Guardar vive un nivel arriba de los propósitos

La vista de un propósito llegó a tener **cuatro** acciones: Guardar, Volver a usar, Destinar y Quitar
destino. Son demasiadas, y una de ellas está en el nivel equivocado.

**Guardar cambia el TOTAL guardado.** No es una acción sobre un grupo: es una acción sobre la plata,
que después cae en un grupo. Vive donde el total está a la vista — el detalle — con los propósitos
como chips para elegir destino en el mismo acto.

Dentro de un propósito, las acciones son sobre **ese grupo**:

| Acción | Qué hace |
|---|---|
| **Destinar más** | suma al grupo desde el resto — no cambia ningún total |
| **Volver a usar** | saca del guardado, desde este grupo — cambia el disponible |
| **Quitar destino** | devuelve al resto — no cambia ningún total |

*Destinar más* pasa a ser el botón principal y reemplaza al enlace *Destinar*, que decía lo mismo con
menos peso: parado en Casa, lo que se hace es **sumarle a Casa**.

## D19 — Elegir propósito al guardar es un chip, no una pantalla

Decir *"guardo $10.000 para Casa"* costaba tres pantallas: el formulario, el selector y la vuelta. Los
propósitos son **pocos por naturaleza** —no son categorías, son metas de una persona— así que entran
como chips en el propio formulario, con *«Sin destino»* como una opción más y un `+` para crear.

El selector como pantalla aparte queda **solo para crear uno nuevo**, que sí necesita nombre e ícono.

Al volver a usar no hay chips **ni fila**: el propósito viene **heredado** del grupo desde el que se
entró. La primera versión mostraba una fila *«Para qué → Viaje»* de solo lectura, y se sacó: no dejaba
decidir nada, no cambiaba nada, y repetía lo que el bloque de abajo ya dice (*«Tenés guardado en
Viaje»*). **Una sección que no decide es una sección de más.** El origen lo dice el título: *«Volver a
usar de Viaje»*.

## D20 — La fecha es secundaria en estos formularios

Ocupaba una card entera, con el mismo peso visual que el monto. En guardar, destinar y volver a usar
la fecha es **casi siempre hoy**: el foco es cuánto y para qué.

Pasa al control compacto que el alta de movimientos ya usa en ancho de teléfono — ícono, fecha corta,
y los atajos **Hoy / Ayer** — reutilizando su copy en vez de duplicarlo, porque dos traducciones del
mismo botón divergen sin que nadie lo note.

## D21 — El puente explica una cosa sola

*«Cómo se ve en tu banco»* mezclaba dos preguntas: **por qué los dos números no coinciden** y
**cuánto me moví este mes**. Mezcladas, la explicación deja de explicar.

El plegable queda como conciliación pura, y sus rótulos nombran **los dos sistemas** en vez de las
entidades de Grana — porque la pregunta no es *"cuánto tengo en cuentas"* sino *"por qué mi banco dice
otra cosa"*, y para contestarla hay que decir de quién es cada número:

```
ARS
Tu banco muestra          $ 5.085.748,17
Guardado en Grana        −$   190.000,00
Para gastar en Grana      $ 4.895.748,17
```

El título pasa a ser **la pregunta**: *«Por qué tu banco muestra otro número»*. Nombrar la sección por
lo que contesta, y no por su categoría, es lo que hace que alguien la abra el día que la necesita.

El neto del mes se muda al **historial**, arriba de la lista: es el mismo flujo contado de dos
maneras, y ahí sí se acompañan.

## D22 — El resto no tiene historial, y no es una omisión

«Sin destino» aparece en la lista como una fila más, pero **no es un grupo de filas: es lo que
sobra**. Su saldo se deriva (`guardado − lo repartido`), así que no tiene actos propios que listar.

Los actos que lo mueven pertenecen a otros dos lados, y **todos ya están listados**:

| Lo hace subir | Dónde se ve |
|---|---|
| Guardaste | historial del drawer |
| Quitaste el destino a un propósito | historial de ese propósito |

| Lo hace bajar | Dónde se ve |
|---|---|
| Destinaste a un propósito | historial de ese propósito |
| Volviste a usar | historial del drawer |

Un historial del resto sería una vista derivada de esos mismos actos **con el signo dado vuelta para
la mitad** —*"Destinaste $150.000 a Japón"* tendría que aparecer ahí como −$150.000— y obligaría a
devolverle una pantalla propia, que es justamente lo que D15 sacó.

**Lo que sí cuesta hoy dos lugares** es la pregunta *"¿por qué me quedan $35.000 y no $40.000?"*. Si
aparece en el uso, la forma que menos rompe no es darle vista al resto: es **unificar el historial del
drawer** para que muestre los cuatro verbos en una sola línea de tiempo, con el propósito nombrado en
cada fila. Ahí se contesta leyendo hacia abajo.

## D22bis — Si el resto no es un propósito, que no se disfrace de propósito

«Sin destino» pasó por tres formas antes de quedar bien, y las dos primeras fallan por lo mismo:

1. **Fila igual a las demás, con chevron** → prometía una vista de propósito que no existe.
2. **Fila igual pero sin chevron, que abre destinar** → no miente con la flecha, pero sigue pareciendo
   un par de *Viaje* y *Casa* mientras se comporta distinto. Y su segunda acción —volver a usar— queda
   escondida en el botón de arriba, donde hay que saber buscarla.

El problema de las dos es el mismo: **comportarse "casi igual pero no igual"**. Esa asimetría es
justamente la que genera la pregunta *"¿por qué este no tiene X?"* — una y otra vez.

La tercera forma —bloque aparte con borde punteado y dos botones— decía la verdad pero **pesaba más
que los propósitos reales**, y ahí invertía la jerarquía: el sobrante gritaba más que los destinos. Y
sus dos botones competían con los dos globales de abajo, que hacen otra cosa.

La forma final es un **pie de lista**: fila especial, no card.

```
  ✈️ Viaje                                  $ 45.000  ›
  🚑 Emergencia                             $ 50.000  ›
  ─────────────────────────────────────────────────────
  🫙 Sin destino                            $ 65.000
     Destinar · Volver a usar
```

Sin caja, sin borde punteado, con el monto **apagado** y las acciones como **enlaces** —que es el peso
que les corresponde al lado de los botones globales—. Distinto de un propósito, **sin ser más
importante que un propósito**.

La regla que separa los dos:

| | Propósito | El resto |
|---|---|---|
| Navega a una vista | sí | no |
| Historial propio | sí | no (D22) |
| Se edita y se borra | sí | no |
| Acciones | 3, adentro | **2, como enlaces en la fila** |
| Peso visual | fila normal | **apagado, al pie** |

Ni pantalla completa, ni chevron igual, ni comportamiento distinto escondido. Se ve como lo que es:
plata que todavía no tiene etiqueta, que se puede destinar o volver a usar.

## D23 — Cuando la misma pregunta vuelve, la respuesta no es un argumento mejor

«Sin destino» generó la misma pregunta tres veces —*"¿por qué este no tiene historial?"*, *"¿por qué
no tiene botón de volver a usar?"*— y las tres veces la respuesta fue una explicación correcta. El
modelo estaba bien. **La pantalla no estaba haciendo su trabajo.**

La regla, que vale para todo el producto y no solo para esta fase:

> Cuando la misma pregunta vuelve, la respuesta no es un argumento mejor: es revisar si la excepción
> está mal dibujada.

Grana tiene muchas decisiones conceptualmente finas —el disponible no es el saldo, guardar no mueve
plata, un propósito no es una meta— y todas se pueden defender por escrito. Ese es justamente el
riesgo: **una pantalla que necesita que le expliquen la excepción tiene la excepción mal dibujada.**

Los tres corolarios, útiles como criterio de revisión:

1. Si hay que **explicar** por qué algo se comporta distinto, probablemente tenga que **verse**
   distinto.
2. Si dos cosas **se ven iguales**, tienen que **prometer lo mismo**. Un chevron promete una pantalla.
3. Si algo **no es una entidad real**, no debería tener **forma visual de entidad real**.

## D24 — El que cede es el nombre, nunca el monto

En una fila de plata conviven un **nombre** de largo libre y un **monto** de largo acotado. Cuando no
entran, el navegador encoge lo que puede: sin instrucciones, encoge el monto — lo parte en dos líneas
o lo corta.

**Un monto cortado no es un detalle de layout.** En una app de plata se lee como un número poco
confiable, y la confianza en los números es lo único que Grana tiene. El que cede es el **nombre**,
que trunca con puntos suspensivos y sigue siendo reconocible por su principio.

Los montos van `shrink-0` y `whitespace-nowrap`; los nombres, `truncate`.

De la misma familia: **las filas sin chevron compensan su ancho con padding**. La del resto no tiene
flecha, así que sin compensar, su monto se corría 26 px a la derecha y la lista dejaba de leerse como
una columna. Una columna de números que no está alineada se lee mal aunque cada número esté bien.
