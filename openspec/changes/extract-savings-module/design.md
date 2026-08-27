# Design: extract-savings-module

Las decisiones de este change son de **arquitectura de información**, no de modelo de plata. El
modelo no se toca: se le da una casa a lo que ya existe, y un borde.

## E1 — La frase que bloqueaba esto era sobre el schema, no sobre la app

`docs/modelo-de-dinero.md` dice *"ahorro e inversión no son dimensiones… por eso nunca fueron dos
módulos"*, y esa frase se venía usando para rechazar una entrada de navegación.

Lee bien lo que dice: **no construyas dos universos de tablas que dupliquen el modelo de plata**.
Mover plata de una caja de ahorro a un FCI no es "pasar de ahorro a inversión": es la misma plata
cambiando de posición, y hay **un** modelo. Eso sigue valiendo entero.

Un lugar en la app donde conviven las dos cosas es **compatible** con esa frase — un solo modelo, un
solo lugar, dos verbos. Lo que la frase prohíbe es lo contrario: dos lugares con dos modelos.

La confusión tiene una consecuencia que conviene dejar escrita: **un documento de modelado no decide
navegación.** Argumenta desde la corrección conceptual, que es otra pregunta.

## E2 — El borde es el entregable, no la pantalla

Una pantalla nueva se puede hacer sin este change: alcanzaría con una ruta. Lo que no se puede hacer
sin él es **tener un límite**.

Hoy el ahorro está cosido al dashboard (una fila en la card), al alta de movimientos (la tira
post-ingreso) y —si la fase 3 seguía como iba— al detalle de cuenta. Cosido así:

- no se puede **ocultar** para quien solo quiere anotar gastos;
- no se puede **poner detrás de un plan**;
- no se puede **apagar** para depurar ni para un rollout parcial.

Deja de ser funcionalidad y pasa a ser estructura. Y no se decide de una: se decide **una fila por
vez**, sin que nadie lo note, hasta que sacarlo es una refactorización.

El criterio operativo que deja este change: **una superficie ajena puede LEER del módulo; no puede
ser su casa.** Una fila que muestra un número está bien. Un formulario que opera, no.

## E3 — El dashboard conserva la lectura y pierde la operatoria

La fila *Guardado* de la card de saldo **se queda**, y no por costumbre: la card tiene una identidad
que cierra —`Tenías + Entró − Se fué − Guardado = Para gastar`— y sacarla rompería la aritmética que
la hace auditable a ojo. La fila **explica el disponible**; ese es su trabajo ahí.

Lo que cambia es a dónde lleva: hoy abre el overlay con el detalle y los formularios; pasa a llevar
**al módulo**. La card explica; el módulo opera.

La **tira post-ingreso** (*"¿guardás una parte?"*) también se queda donde está: vive sobre
`guidance`, aparece después de cargar un ingreso, y su valor es justamente estar **fuera** del
módulo, en el momento en que hay plata nueva. Es una lectura que invita, no una casa.

## E4 — Cuentas no gana nada, y ese es el punto

El detalle de cuenta es una pantalla de **ubicación**. El propio modelo lo dice: *"el detalle de
cuenta es una pantalla de ubicación y la disponibilidad es otro lente"*.

El mock de la fase 3 aplicó esa regla para negarle lugar a «Guardado» —correcto, una reserva no vive
en ninguna cuenta— y la violó dos párrafos después poniendo ahí la acción de hacer un plazo fijo. La
misma pantalla, la misma regla, dos criterios.

Y el argumento de que *"escala sin pestañas: mañana la misma cuenta ofrece comprar dólares o
suscribir un FCI"* estaba escrito como ventaja. Es el defecto: **una lista de productos financieros
colgando de cada cuenta es un home banking**, que es exactamente lo que Grana no es.

Cuando exista el plazo fijo, la cuenta lo va a **mostrar** —tiene banco, es ubicación— y podrá tener
un atajo contextual. No va a ser su casa.

## E5 — Por moneda, siempre, y sin sumarlas

El módulo opera por moneda. ARS y USD nunca se suman ni se convierten, acá tampoco.

Lo que este change **no** decide es si el corte es un selector, dos tabs o dos bloques apilados. La
fase 2 ya aprendió algo pertinente (D16): **la moneda es el eje de la OPERACIÓN, no el de la
LECTURA** — partir el detalle en dos pantallas obliga a recordar un número mientras se mira el otro.
Eso se resuelve al dibujar, con las dos versiones al lado.

## E6 — No se reescribe nada: se recompone

Se reutiliza tal cual todo lo que ya está bien:

- `availability_reserve` y `savings_purpose_allocation`, con sus invariantes y su trigger;
- `write_reserve` y las validaciones de tope y piso;
- los formularios de guardar, volver a usar, destinar y quitar destino;
- `Drawer` / `BottomSheet`, `FormSheetBody`, `MoneyAmountInput`.

Lo que cambia es **dónde se montan**. Si este change termina tocando SQL, algo se entendió mal.

## E7 — El origen preseleccionado al volver a usar: lo que hay, y lo que falta decidir

La regla pedida es: *sin prioridad silenciosa* — con un solo grupo con saldo va directo al monto, con
varios se pregunta de dónde sale, y desde un propósito se hereda.

**Lo construido cumple la forma y hay que mirar el default.** Con varios grupos con saldo, el
formulario muestra los chips *De dónde sale* con todos los orígenes que tienen plata en esa moneda, y
**preselecciona «Sin destino»** si tiene saldo. Con uno solo no hay chips. Desde un propósito, el
origen viene heredado y no se pregunta.

Así que el origen **se pregunta, en el mismo formulario** (no en una pantalla aparte, que fue lo que
la fase 2 borró). Lo que queda por decidir es más chico: **si preseleccionar cuenta como elegir.**

- A favor de dejarlo: el chip está a la vista, rotulado, y cambiarlo es un tap. Sin preselección el
  CTA arranca deshabilitado y el caso más común paga un tap de más.
- En contra: quien tipea rápido y confirma toma de «Sin destino» sin haber elegido nada.

No se resuelve discutiendo. Se mira en el QA del módulo, con las dos versiones.

## E8 — Un módulo no se estrena mostrando lo que no hace

Nada de CTAs deshabilitados, placeholders de inversiones ni un bloque «A resguardo» apagado
esperando la fase 3.

Un usuario que entra y ve tres cosas grises que no funcionan **aprende a ignorar la pantalla**, y esa
lección no se revierte cuando la funcionalidad llega. El módulo se estrena con lo que hace hoy —
guardar y decir para qué— y crece cuando hay algo que mostrar.

Es la misma razón por la que la fase 2 sacó la sección «Para qué» heredada que no decidía nada: **una
sección que no hace nada es una sección de más**, y una que además promete es peor.

## E9 — El nombre

**«Ahorro e inversión»**, aunque hoy solo haga ahorro.

*«Invertir»* solo deja afuera comprar dólares, que es el acto de protección más común del país — el
modelo ya lo tenía anotado. *«Mi plata»* nombra lo que mirás, no lo que hacés, y este módulo existe
para hacer. *«Ahorro»* solo se queda corto el día que entre el plazo fijo, y renombrar un destino de
navegación cuesta más que nombrarlo bien la primera vez.

Que el nombre prometa un poco más de lo que hay hoy es aceptable **mientras la pantalla no lo
prometa** (E8).

## E10 — Apagar el módulo nunca puede secuestrar plata

> **Estado: decidido, no cableado.** Apagar el módulo solo tiene sentido cuando exista el sistema de
> planes —monetización y Play Store—, y hoy el repo no tiene ni banderas ni suscripciones. Lo que se
> construyó es la decisión, no la superficie: `packages/savings/src/module-access.ts` (13 tests)
> responde en qué estado está el módulo y qué se puede hacer en cada uno; ninguna pantalla lo consume.
> Este entry queda como la norma que ese cableado tendrá que cumplir cuando llegue (tasks 4b).

El borde es el entregable (E2), así que hay que decir **qué pasa cuando el módulo está apagado** — por
un plan vencido, un rollout parcial o una bandera de depuración.

La trampa está en el caso del medio, y no la cubre ninguna regla simple:

**El guardado sigue restando del disponible esté el módulo prendido o apagado.** Es un hecho sobre la
plata, no una función: `disponible = cuentas − guardado`. Entonces alguien con $ 180.000 guardados y
el módulo apagado tiene **$ 180.000 menos para gastar y ninguna forma de recuperarlos**. Su plata
queda rehén de una bandera.

Los tres estados:

| | Menú y ruta | Fila del dashboard | Qué se puede hacer |
|---|---|---|---|
| **Prendido** | Sí | Navega al módulo | Todo |
| **Apagado, guardado = 0** | No | No se dibuja | Nada, y no falta nada |
| **Apagado, guardado > 0** | No | **Se queda y navega** | **Leer y volver a usar** |

En el tercer estado el módulo entra en un **estado degradado**: la grilla, la lista de grupos en solo
lectura y **una sola acción, volver a usar**. Sin chevrones, sin crear propósitos, sin destinar y sin
guardar más.

**La lectura sobrevive porque la acción la necesita.** El invariante de la fase 2 no deja sacar de un
propósito sin nombrarlo, así que la lista tiene que estar para poder elegir el origen. No es
decoración: es el mínimo para que la plata salga.

### Esto NO es volver al drawer viejo

Un fallback al drawer obligaría a mantenerlo montado en el dashboard **para siempre**, que es
exactamente el acoplamiento que este change viene a sacar. El estado degradado es el **mismo módulo**
con menos cosas, no una superficie paralela que hay que seguir manteniendo.

### La bandera controla la superficie, nunca los números

Apagar el módulo no puede cambiarle el disponible a nadie. Una bandera que reescribe la plata del
usuario es peor que cualquier acoplamiento — y sería, además, la primera vez que un número de Grana
depende de algo que no es un hecho.

## E11 — La ruta en inglés, el rótulo en castellano

`/savings`, y el menú dice **«Ahorro e inversión»**.

Las rutas de la app son en inglés —`/accounts`, `/cards`, `/transactions`, `/shared`, `/settings`— con
una sola excepción, `/shared/cuenta-corriente`, que es un término del dominio sin equivalente limpio.
*Ahorro* sí lo tiene, y es además el nombre del módulo en la tabla de `AGENTS.md` (`16 savings`).

Los **rótulos**, en cambio, son todos en castellano, como el resto de la interfaz. Que la ruta y el
rótulo no coincidan literalmente es lo normal en la app: `/shared` se llama *Compartido* y
`/transactions`, *Movimientos*.

## E12 — El rediseño llega después del modelo, y por eso no lo toca

El handoff de diseño (`design_handoff_ahorro/`) reemplaza la pantalla entera. Vale la pena decir qué
**no** reemplaza, porque es casi todo lo que costó: las dos lecturas normativas, los pisos por grupo,
la tabla de repartos, la identidad de la card del mes y `module-view.ts`. El rediseño es piel y
pantallas nuevas sobre el mismo modelo.

Tres cosas del handoff sí eran modelo, y se resolvieron antes de dibujar nada:

**La cascada de «Volver a usar» no entra.** El handoff proponía: *"primero sale de lo que no tiene
propósito; si querés más, elegís de cuál sacarlo"*. Eso es una operación que toca dos grupos, y en la
que **nadie eligió vaciar Sin destino** — lo decidió el orden de la regla. El historial de un
propósito terminaría con un renglón que su dueño no puede explicar mirándolo. Es la misma imputación
automática que el modelo se niega a hacer entre cuentas.

Queda: **un origen por operación**. La app sugiere —preselecciona «Sin destino» si tiene saldo, con
el tope a la vista— pero no imputa. Si el monto supera ese origen, no reparte: lo dice y ofrece la
salida.

Lo notable es que **esto ya estaba construido**. Lo único que faltaba era el final del mensaje: decía
*"No podés volver a usar más de lo que tenés sin destino: $55.000"* —que solo niega— y pasa a decir
*"Sin destino tiene $55.000. Para volver a usar más, elegí un propósito."* Con un solo grupo con
saldo no hay propósito que elegir, así que ahí el mensaje se queda en la primera oración: ofrecer una
salida que no existe es peor que no ofrecer ninguna.

**La fecha del propósito espera a Metas.** El handoff agrega *«¿Para cuándo?»*, *«Julio 2027»*,
*«Sin fecha»*. `savings_purpose` no tiene fecha y no es un olvido: el modelo define que *una meta es
un propósito que ganó un objetivo*, con `target_amount`, `target_date` y `target_currency` **juntos**,
en fase 4. Agregar sola la fecha deja la mitad decorativa —una fecha sin objetivo no calcula ningún
progreso— y borra el límite que hizo que la fase 2 fuera chica. Sin fecha, el subtítulo de la card no
tiene nada que decir, así que no hay subtítulo.

**«Para gastar» sale de la pantalla, y está bien.** El disponible aparece donde significa algo: como
tope del formulario de guardar. Es la misma conclusión a la que había llegado el detalle del overlay.

## E13 — La paleta del handoff se traduce, no se importa

El handoff trae su propio set de tokens: fondo crema `#F5F2EC`, bordes cálidos `#EAE5DC`, un ink
`#1B2A33` y un ámbar completo. Grana es fría: `--page #F6F7F9`, `--border #E6EAEF`. Importarla tal
cual deja dos opciones malas —un módulo que parece otro producto, o repintar la app entera desde una
pantalla— así que se traduce a los tokens que ya existen.

Dos traducciones no son obvias:

**La card oscura del total usa `--navy`, el que ya viste.** Grana ya tiene una superficie oscura: la
card de saldo del dashboard. Que el total de Ahorro sea *esa* superficie y no un segundo oscuro
parecido es lo que hace que las dos se lean como el mismo sistema. El `#1B2A33` del handoff se
descarta.

**«Sin destino» se diferencia por FORMA, no por color.** El handoff lo resuelve con un bloque ámbar
entero, y Grana no tiene ámbar: lo más cercano es `--cat-6`, que es un color de categoría y lo ataría
a un significado ajeno. Agregar un token al sistema para una sola caja es caro, y el sistema se
defiende mejor si el color se gana. Queda: **borde punteado, contorno del ícono, copy y ubicación** —
el punteado ya dice «esto está incompleto» sin gastar un color. Si en el QA se pierde claridad, ahí
se evalúa sumar el token; no de entrada.

## E14 — Lo que el handoff da por hecho y no se construye así

Tres cosas del handoff son trabajo dado por resuelto que choca con reglas del repo. Se listan acá
para que la desviación sea explícita y no una omisión.

**El teclado numérico 3×4 no se dibuja.** `MoneyAmountInput` es obligatorio y por una razón concreta
(un `type="number"` enfocado convierte `3000` en `2999.99` con la rueda del mouse). Y en un teléfono,
un `inputMode="decimal"` ya abre el teclado numérico del sistema: dibujar uno propio es reconstruir
peor lo que el SO da gratis, con su propia accesibilidad y su propio manejo de decimales. Si más
adelante se quiere el teclado propio, va **encima** del parseo, nunca en lugar de él.

**El emblema conserva el emoji.** El handoff reemplaza el ícono por un set de SVG con cinco tintes.
Los propósitos que ya existen tienen un emoji guardado en `icon`, así que cambiar el glifo es una
migración de datos. Lo que sí se adopta es el **contenedor**: el emoji entra en el cuadro de 42 px con
tinte ciclado por posición. Se gana la prolijidad visual sin tocar datos. El set de SVG, si se quiere,
es su propio change con su propia migración.

**«Ver todos» a partir de 8 propósitos queda afuera de esta pasada.** Es una pantalla más, y el orden
por monto descendente ya sostiene la escala hasta bastante más arriba de lo que hay hoy.

## E15 — El chrome no vuelve

El handoff dibuja el desktop con el sidebar y «Ahorro e inversión» activo. Pero `/savings` es
`CHROMELESS_SECTIONS`, como Cuentas, Tarjetas y Ajustes: en esas rutas la app esconde el chrome y la
pantalla se queda con su propia cabecera y su flecha de volver.

Gana la convención de la app. Una sola pantalla con chrome distinto al de sus tres hermanas se lee
como un error de la app, no como una decisión del módulo — y el handoff no estaba mirando esas tres
cuando dibujó el sidebar.

## E16 — La jerarquía no es responsive

> En responsive se puede cambiar la cantidad de columnas. **No se puede cambiar la jerarquía
> conceptual.** Guardado total es siempre el bloque padre; «Sin destino» y los propósitos son
> siempre su desglose.

Es la regla más fácil de romper sin darse cuenta, porque se rompe por comodidad de layout: hay ancho
de sobra en desktop, la card del total queda corta, y poner algo al lado parece aprovechar el espacio.
Pero el ancho no es el problema que la pantalla resuelve. Lo que resuelve es que alguien lea *«tengo
tanto guardado, y está repartido así»* y no *«acá hay varias cajas: Guardado, Sin destino, Viaje»*.
Una card al lado del total la convierte en una hermana, y ahí el total deja de ser el total.

Dos consecuencias que no se negocian:

- **Si hay dos columnas, van adentro del desglose.** Nunca entre el total y sus partes. La card del
  total no comparte fila con nada — ni con la botonera, ni con un propósito, ni con «Sin destino».
- **El panel lateral es solo para el detalle del propósito seleccionado.** Nunca para poner Guardado
  al lado de un propósito.

El orden del DOM es el mismo en los tres tamaños y es una columna: total → botonera pegada a él →
desglose (Sin destino, después los propósitos). Lo único que cambia con el ancho es cuántas columnas
tiene la grilla **de propósitos**.

Esto ya estaba respetado en el código y en los dos archivos `FINAL` del handoff. Lo que no lo
respetaba era `Grana - Guardado V1 compacta.html` —un estudio previo que quedó en el bundle— cuyo
frame de tablet pone la card del total y la botonera lado a lado en `1.35fr 1fr`. Quedó marcado como
superado adentro del propio archivo: un mock que contradice el invariante y no lo dice es una trampa
para el próximo que lo abra.

## E17 — «Sin destino» necesitaba color, y por qué el gris decía otra cosa

E13 resolvió «Sin destino» solo con la forma —círculo punteado, borde punteado,
ubicación— para no agregar tokens. **No alcanzó, y el modo en que falló vale más que el
resultado.**

Un bloque gris con borde punteado no es neutro: ya significa algo en cualquier interfaz, y
ese algo es **«deshabilitado»**. La caja terminó diciendo lo contrario de lo que es —acá hay
plata, y hay una decisión para tomar— y encima lo decía con más fuerza que el copy, porque el
tratamiento se lee antes que el texto.

La lección no es «hacía falta color». Es que **la ausencia de color no es la ausencia de
significado**: el gris es una decisión de diseño como cualquier otra, y en este lugar era la
equivocada. «Resolver por forma para no gastar un token» era ahorrar en el lado equivocado.

**Los tokens son propios, no `--warning`.** El sistema ya tiene un ámbar (`--warning: #C49A3C`),
pero su semántica es alerta: algo está mal y hay que corregirlo. Esto no está mal. Es un estado
normal que puede durar meses, y con semántica de alerta el bloque le reclama al usuario por algo
que nadie le pidió. Tampoco un `--cat-*`: esos identifican categorías de gasto, y reusarlos haría
que el mismo tono signifique dos cosas en la misma app.

Así que `--savings-unassigned-{bg,border,text,deep,on-deep}`, derivados del ámbar del sistema para
que sea EL cálido de Grana y no el del mock — que venía de una paleta crema y sobre la página fría
de la app se veía sucio.

**El fondo no se separa por luminancia, y no puede.** Sobre un `--page` casi blanco, un cálido que
se separara por brillo dejaría de ser suave: medido, `#F8EFDA` contra `#F6F7F9` da 1.07:1. Se separa
por MATIZ y por un borde bastante más marcado que el de una card normal. Y la comparación que
importa no es contra la página: es contra las **cards blancas de los propósitos**, que están al
lado, donde sí hay diferencia (1.14:1 más el matiz).

**El botón «Destinar» es cálido oscuro y no navy.** En navy competía con el total de arriba —el
navy es la superficie del total— y ponía «ordenar un pendiente» al mismo peso que la acción global.
El cálido lo mantiene adentro de su bloque: es la acción DE este estado, no una acción de la
pantalla. Contraste verificado: 5.91:1 en claro, 8.47:1 en oscuro.

Y hay tokens de modo oscuro desde el día uno, aunque hoy nada los encienda: el cálido se aclara y
el botón invierte —fondo ámbar, texto navy— porque un cálido oscuro sobre una página oscura
desaparece.

## E18 — El overlay se quedó sin lectura, y eso lo cambia de naturaleza

Podar la vista de detalle no fue borrar una pantalla: fue sacarle al overlay la única parte que
**no** era un acto. Lo que queda son un formulario, un grupo y un reparto — todos empiezan por algo
que el usuario tocó, y ninguno es un lugar al que «ir a mirar».

Tres consecuencias, y ninguna es cosmética:

**`initialView` pasa a ser obligatorio.** Antes era opcional porque había una raíz de la que colgar
todo; ahora abrir el overlay sin decir a qué es una contradicción, y el tipo lo dice.

**La flecha del fondo de la pila CIERRA.** Antes caía en el detalle: entrabas desde la lista del
módulo, volvías, y aparecía otra lista — la misma, peor dibujada, encima de la que ya estaba atrás.
Era el síntoma más visible de la duplicación y desaparece solo al sacar la raíz.

**Cada apertura hace dos consultas menos.** El historial y el flujo del mes eran del detalle. No se
borraron: se mudaron a `/savings`, plegados al pie, donde son lectura entre lectura. El overlay se
quedó con las tres que son topes de operación — cuánto hay, cómo está repartido, y qué propósitos
existen.

Y una que se decidió al pasar: **el dashboard ya no monta el overlay.** Su fila navega. El estado
vacío paga un tap de más —antes iba derecho al formulario— y a cambio «Ahorro e inversión» deja de
tener dos puertas que abren cosas distintas, con la de más a mano llevando a la que no es el módulo.
Es exactamente lo que 4b.5 pide para el estado apagado, adelantado: no hay drawer viejo al que caer.

**Mobile queda como está**, con el overlay montado en su card de saldo. No es una omisión: sin módulo
nativo no hay a dónde navegar, y cambiar la fila antes de que exista el destino sería romper la única
puerta que tiene.

## E19 — La pasada de coherencia antes del QA

Antes de mirar la pantalla se revisó el rediseño contra sí mismo y contra el resto de la app. Salieron
ocho cosas, y ninguna se veía leyendo un archivo solo: todas aparecen al comparar piezas entre sí.

**El pie era más angosto que todo lo demás.** El desglose y la card del total van a todo el ancho del
stage; el pie había heredado un `sm:max-w-[34rem]` de la versión anterior. En desktop cortaba a la
mitad y desalineaba el borde derecho de la página. Los tres bloques ahora comparten el ancho del
shell, que es lo que E16 pide sin decirlo.

**Los radios venían de otra escala.** El handoff traía 22/20/18/15/13/11 px, y el sistema tiene
12/16/18/20/24 (`--radius-lg` … `--radius-4xl`). Cada diferencia sola es invisible; juntas hacen que
la pantalla se sienta de otro producto sin que se pueda señalar por qué. Todo mapeado a los tokens.

**La escala tipográfica estaba mezclada.** Convivían dos series —la del handoff, con medios puntos, y
una entera— y producían pares casi idénticos dentro de una misma sección: 10.5 contra 11 en dos
rótulos, 12 contra 12.5 en dos textos de apoyo, 14 contra 14.5 en dos montos. Eso no se lee como
jerarquía, se lee como descuido. Unificados, y los cuatro rótulos del módulo comparten cuerpo y
tracking.

**Dos círculos punteados con un «+», a dos bloques de distancia.** El ícono de «Sin destino» y el de
«nuevo propósito» eran el mismo glifo con significados distintos. «Sin destino» pasa a una etiqueta:
lo que falta ahí no es sumar plata, es ponerle nombre a la que ya está.

**El desglose sin propósitos era un título sobre una lista vacía.** Se resuelve con la card punteada
de crear al final de la grilla: con cero propósitos es una sola card que invita, con propósitos es la
última de la fila. De paso da la puerta para crear, que la página no tenía —solo se llegaba desde el
«+» del formulario de guardar.

**Los colores sobre el oscuro no usaban los tokens** (`text-white/55`, `/66`) teniendo
`--navy-muted` y `--navy-soft` a mano.

**El divisor de la botonera dependía de `[&+&]`**, que exige que las dos clases sean idénticas
carácter por carácter: envolver un botón o cambiarle una clase a uno solo borraba los divisores sin
error. Ahora quién lleva borde lo decide quien arma la barra.

**`shortDate` estaba escrito dos veces**, con dos APIs distintas, en dos historiales que se ven en la
misma sesión. Daban lo mismo hoy; el día que una cambiara, serían dos formatos de fecha en la misma
app sin que ningún test se enterara.

## E20 — Las tres salidas de un propósito, y por qué no pesan igual

El detalle de un propósito ofrece tres cosas, y dos de ellas se parecen tanto que hubo que escribir
una nota al pie para distinguirlas. Una nota al pie suele ser el síntoma de que la pantalla ofrece
algo con el peso equivocado.

| Acción | Qué mueve | Peso |
|---|---|---|
| **Destinar más** | El reparto. El total guardado NO cambia | Botón |
| **Quitar destino** | El reparto, al revés. El total tampoco cambia | Botón |
| **Volver a usar** | El TOTAL: la plata vuelve a ser gastable | Enlace |

El handoff proponía sacar «Volver a usar» de esta pantalla y mandar a Ahorro. El argumento era bueno
—una acción por nivel— pero el costo era real: parado en «Viaje», querer usar esos pesos es un caso
común, y volver a Ahorro cobra dos taps y obliga a re-elegir con un chip un propósito que ya estaba
en pantalla.

Lo que estaba mal no era que estuviera: era que fuera **un botón al lado de «Destinar más»**. Con ese
peso la pantalla se contradecía sola — excluía «Guardar» por cambiar el total (D18) e incluía, con
el mismo tratamiento, otra que también lo cambia.

Bajarla a enlace resuelve las dos cosas a la vez. Los botones quedan para lo que es del propósito y
no toca el total; lo que sí lo toca queda abajo, tras un divisor, con la nota justo encima y el
enlace justo debajo — el orden en que se lee la diferencia antes de tocarla. El atajo sigue a un tap.

Y las dos que se confundían dejan de competir: ahora una es botón y la otra enlace, que es la
distinción que la nota tenía que hacer con palabras.

## E21 — El monto inicial al crear un propósito, y el camino que ya existía

El handoff pide una cuarta card en «nuevo propósito»: *«¿Le destinás algo ahora?»*. Son **dos
escrituras en dos tablas** —`savings_purpose` y `savings_purpose_allocation`— sin transacción entre
ellas, y sus modos de fallar no son simétricos:

- **Falla por tope.** Con $55.000 sin destino, crear «Notebook» con $70.000 crea el propósito y
  rechaza el reparto. Queda un propósito en cero y un error. Se puede validar antes de enviar, pero
  entre leer el tope y confirmar, otra pestaña pudo destinar.
- **Falla por red.** Se crea el propósito, se corta antes del reparto. Al reintentar: *«Ya existe un
  propósito llamado Notebook»* — uno que el usuario nunca vio creado. Este es el que no se arregla
  con validación.

Y no hace falta correr ese riesgo, porque **el camino ya existe y es mejor**: entrando por
**Destinar**, el selector de destino tiene un «+» que crea el nombre y vuelve al formulario **con el
monto ya escrito**. Una sola escritura de reparto, y el monto se escribe donde el tope está a la
vista — que es justo lo que le falta al campo del handoff.

El handoff pide el campo porque no conocía ese camino, y él mismo lo trata como accesorio: dice que
el monto arranca en cero y que se puede crear tocando solo nombre y CTA.

Así que crear un propósito crea un nombre. Ponerle plata es destinar, y destinar tiene su pantalla.
Agregar el campo inventa un tercer acto —«crear-con-plata»— que no existe en el modelo.

**Si algún día hace falta**, la forma correcta no es componer dos llamadas desde el cliente: es una
función SQL que haga las dos en una transacción, como el resto del write path. Eso elimina el estado
intermedio en vez de administrarlo.

**Lo que sí se hizo**, que ataca el mismo dolor sin acoplar escrituras: crear un propósito **desde la
página** ya no cierra el overlay dejando una fila en cero — sigue a destinarle, con el destino
elegido. Con «Sin destino» en cero no: ahí destinar tendría tope cero, y mandar a una pantalla que no
puede hacer nada es el error que ya se corrigió en el formulario de volver a usar.

## E22 — Crear un propósito tiene que decir que lo creó

Encontrado en QA: se crea «Prueba», la pantalla pasa a «Destinar a Prueba», un clic afuera cierra el
overlay, y el usuario vuelve a crear «Prueba» — donde la app contesta *«ya tenés un propósito llamado
Prueba»*. Una respuesta correcta a una pregunta que nunca debió hacerse.

**En ningún momento la app dijo que el propósito se había creado.** La pantalla siguiente daba por
sabido que existía: su título lo nombra como si el usuario ya lo supiera.

Es exactamente el escenario que E21 usó para descartar el monto inicial —«un propósito que el usuario
nunca vio creado»— entrando por otra puerta: no por dos escrituras acopladas, sino por un paso que
confirma sin acusar.

**El acuse va en la pantalla siguiente, no en un toast.** La regla del repo es que el cambio de
pantalla ES el acuse; lo que faltaba es que la pantalla dijera qué pasó. Recién creado, la cabecera
pasa a «Listo, creaste "Prueba"» y debajo dice lo que todavía le falta: está en la lista, sin plata,
y la pregunta que sigue es si quiere destinarle algo.

**Y una salida explícita, «Ahora no».** La flecha cierra igual, pero bajo un título que dice «Listo,
creaste…» se lee como «volver a crear», no como «terminé». Destinar es opcional —un propósito en cero
es un estado válido— y hay que poder llegar a él diciéndolo, no abandonando.

Queda un caso sin acuse propio y está bien: cuando «Sin destino» está en cero, crear cierra el
overlay directamente. Ahí el acuse es la card nueva que aparece en la lista, que es el cambio de
pantalla de siempre.

## E23 — Lo que el QA cambió sobre lo que estaba definido

El change se planificó antes de tocar la pantalla, y el QA lo movió bastante. Esto es el registro de
qué se corrigió y por qué, para que la distancia entre lo escrito al empezar y lo que quedó no haya
que reconstruirla leyendo commits.

### Los cinco bugs, y qué tenían en común

Ninguno lo habría encontrado un test, y cuatro de los cinco eran **estado o formato mal ubicado**:

| Síntoma | Causa |
|---|---|
| «Guardo, creo un propósito, y el monto vuelve a cero» | El borrador vivía en `SavingsForm`, que se desmonta al cambiar de vista en la pila |
| «Creé el propósito y no lo veo» | La lista salía solo de `get_purpose_sums`, que es la tabla de repartos: uno sin reparto no figura |
| «Prueba » con un espacio no se podía crear | El schema es `.strict()`, y ahí el `.trim()` de Yup deja de recortar y pasa a EXIGIR que ya venga recortado |
| `Cannot update a component while rendering another` | `onClose()` metido dentro del updater de `setStack`: React lo ejecuta durante el render |
| El tope negaba sin ofrecer la salida que existía | El origen venía `locked` desde el enlace del resto, escondiendo los propósitos que sí tenían plata |

El del nombre tenía un segundo problema encima: el formulario **descartaba los `fieldErrors`** y mostraba
un genérico. Un rechazo del nombre terminaba diciendo «probá de nuevo» —que invita a repetir lo
mismo— sobre un campo problemático que estaba a la vista y sin marcar.

### El patrón que se repitió: el módulo se apartaba del sistema

Tres veces, en decisiones distintas, y cada una parecía razonable sola:

- **El chip de moneda.** Se había reemplazado por un segmentado «Pesos / Dólares», más grande y con
  las dos opciones visibles. No era peor: era OTRO. Estas pantallas piden un monto igual que las de
  movimientos, y dos controles distintos para la misma decisión obligan a aprenderla dos veces.
- **La escala del monto.** Había TRES: movimientos a 30px, guardar a 46, destinar a 27. Los dos
  formularios de ahorro ni siquiera coincidían entre sí.
- **Los radios.** El handoff traía 22/20/18/15/13/11 px y el sistema tiene 12/16/18/20/24. Cada
  diferencia sola es invisible; juntas hacen que la pantalla se sienta de otro producto.

La regla que queda: **la consistencia con el sistema gana sobre la mejora local.** Optimizar una
pantalla y desalinear el conjunto es un mal negocio, y no se nota hasta que se ven dos pantallas
juntas.

### Ajustes de densidad, todos por la misma razón

El drawer pedía scroll y la página pedía scroll, y en los dos casos el alto se iba en cosas que no lo
justificaban: el recuadro de 36px del ícono de la fecha fijando el alto de una fila de una línea; los
44px reales de cada chip cuando el área táctil puede salir de un pseudo-elemento; la botonera a 60px;
la grilla pidiendo 330px por card y entrando dos columnas de 474px en una notebook.

De ahí sale un recurso que el módulo usa en todos lados y conviene conocer: **el alto táctil por
`::after`**. Un control puede medir 38px y seguir teniendo 44 de área. Lo decía el handoff en una
línea que no se había aplicado.

### Dos techos, y la lección de ponerlos

Los chips de propósito y el historial de un propósito crecían sin límite y empujaban fuera de
pantalla justo lo que la pantalla existe para hacer. Poner un techo trajo tres problemas propios:

1. **El criterio de qué se pliega no estaba pensado.** La lista venía alfabética, así que se plegaban
   los últimos del abecedario: «Viaje» con $45.000 antes que «Prueba» con $0. Ahora ordenan por saldo.
2. **El control de overflow al final de la fila quedaba huérfano** en su propio renglón cuando la
   última fila estaba llena, y ahí no se lee como acción sino como algo cortado. Vive en la fila del
   rótulo, donde no puede quedar solo.
3. **Un techo tan alto que nunca se alcanza no es un techo.** Se subió de 6 a 8 «por las dudas» y con
   diez opciones dejó de plegarse nada: el control desapareció, y con él la única señal de que la
   lista sigue.

Y el techo cuenta **propósitos**, no chips: «Sin destino» va siempre visible y fuera del conteo.
Contándolo, guardar mostraba cinco propósitos y destinar seis con el mismo techo y la misma lista.
La consecuencia aceptada es que las dos pantallas tienen distinta cantidad de CHIPS —guardar suma
«Sin destino»— y eso está bien: coinciden en lo que importa, que es qué propósitos se ven.

## E24 — Un monto cortado, y las tres formas de que el ancho lo corte

La única prueba del guion que quedaba sin correr era el teléfono chico: **360px con montos de ocho
cifras en las dos monedas**. Se corrió sobre la pantalla real, midiendo cajas y no mirando capturas,
y de las tres zonas que llevan plata, **las tres se rompían** — cada una a su manera, y ninguna se
notaba con los montos del QA anterior.

**1. La card del total cortaba el monto de dólares, en silencio.** Las dos mitades daban 130px cada
una para un número que mide 200. El de pesos se desbordaba sobre el divisor; el de dólares se salía
de la card, y como la sección recorta lo que se sale, quedaba «US$ 12.» contra el borde. Sin scroll
horizontal, sin ninguna señal: el número simplemente no estaba.

Esa es la falla que D24 nombra: *un monto cortado no es un detalle de layout, se lee como un número
poco confiable*. Y era la peor de las tres, porque el número cortado era el TOTAL.

**2. La card de un propósito deja el nombre en 66px, y así se queda.** Se probó ponerle un piso al
nombre —«Vacaciones en Japón con la familia» truncado a «Vacaci…» ya no es reconocible por su
principio, que es lo que el truncado promete a cambio de recortar— y que los montos bajaran a una
segunda línea cuando no entraran al lado. **Se descartó en QA, y con razón**: con montos normales las
cards pasaban de 79 a 96px y algunas se partían y otras no, así que la grilla quedaba con tres altos
distintos y dejaba de leerse como grilla. El ritmo de la lista vale más que los caracteres que se
recuperan.

Acá vale D24 tal cual, sin piso: el que cede es el nombre, hasta donde haga falta. Un nombre truncado
se recupera abriendo el propósito; un monto cortado no se recupera con nada. Y el nombre no es la
información que se viene a buscar a esta pantalla: el ícono ya identifica al propósito, y el número
es lo que se lee.

**3. El bloque «Sin destino» metía el monto debajo del botón.** A 320px, con `min-w-0`, el bloque de
texto se encogía por debajo de su propio número; como los montos van `nowrap`, lo que no entra no se
parte: se superpone. El monto pasaba por atrás de «Destinar».

### Lo que se corrige, y por qué no es un breakpoint

Las tres se arreglan con la misma regla, y la regla es la que ya estaba escrita en la tarea: **el
quiebre lo decide el CONTENIDO, no el ancho de la pantalla.** Un `@media` acierta y erra al mismo
tiempo — apila «$ 1.150.000 / US$ 900» en un teléfono donde entraban al lado, y deja cortado
«$ 12.345.678 / US$ 12.345.678» en una tablet donde no entran.

Se expresa con flexbox: cada pieza pide como mínimo lo que mide su propio número (`min-w-max`, o
`min-width: auto`), y la fila se parte cuando esos mínimos no entran juntos. Nada sabe el ancho de la
pantalla; cada fila sabe cuánto miden sus cosas.

Tres detalles que costaron y conviene no volver a descubrir:

- **`truncate` es `nowrap`, así que el min-content de un nombre es el nombre ENTERO.** Quitarle el
  `min-w-0` al contenedor de «Sin destino» para proteger su monto está bien —ahí el rótulo es una
  palabra corta—, pero hacerlo donde vive un nombre libre lo dejaba sin truncar y desbordando la
  card. El nombre necesita poder encogerse; el que necesita piso es el monto. Son contenedores
  distintos y la respuesta es distinta en cada uno.
- **El divisor no puede ser un elemento** si la fila se parte: al apilarse quedaba como una rayita
  vertical al costado del monto de abajo. Pasa a ser el borde de cada mitad —`border-l` y `border-t`—
  con el contenedor recortando el que daría contra el marco. La línea aparece siempre entre las dos y
  nunca alrededor, en las dos direcciones, sin que nadie tenga que saber cuál se dibujó.
- **Partir por contenido tiene un costo que no se ve midiendo una fila sola: la lista pierde el
  ritmo.** Cuando el quiebre depende del contenido, dos cards vecinas quedan de altos distintos —una
  se partió y la otra no—, y una grilla con tres altos deja de leerse como grilla. Vale la pena
  donde el bloque es único (la card del total, «Sin destino»); no vale donde hay una lista.

Verificado de 320 a 1280 con montos de ocho cifras en las dos monedas: ningún desborde en ninguna
caja y ningún scroll horizontal. Y con los montos reales del QA, las cards de propósito miden las
tres 72px, como antes.

Vale anotar que la card del total se rompía **también con montos normales**: con $195.000,00 y
US$900,00 —los del QA— el de dólares quedaba en «US$ 900,0» contra el borde. No hacía falta el caso
extremo para perder un número.

### Lo que esto destapó y no se corrige acá

Con centavos siempre encendidos, «$ 150.000,00» y «US$ 900,00» tampoco entran lado a lado en 360px:
la card del total queda apilada en el teléfono para casi cualquier monto real. **El módulo formatea
con centavos fijos y la app tiene una preferencia de usuario para eso** (`showCents`, que el
dashboard respeta vía `MaskedAmount`: pesos según la preferencia, dólares siempre con centavos). La
fila «Guardado» del dashboard y el total del módulo son EL MISMO número mostrado con dos formatos
distintos.

Es la deriva de E23 otra vez, y tiene tres copias: `_components/money.ts`, y sendas definiciones
locales dentro de `savings-drawer.tsx` y `purpose-picker.tsx`. Respetar la preferencia además
devolvería las dos mitades al teléfono. No se toca en este change —cambia todos los números del
módulo, incluidos los de los formularios y los mensajes de tope, y el QA nativo está por correr—,
pero queda dicho acá y en el backlog.


## E25 — La tira ofrecía guardar solo en pesos, y nadie lo había visto

Salió del QA de 6.7, de rebote: para probar la card del total con dos monedas hacía falta cargar un
ingreso en dólares, y al cargarlo **no apareció la tira** — con el mismo importe en pesos sí.

La causa era mecánica y estaba a la vista: `save-suggestion-strip.tsx` tenía `'ARS'` escrito en seis
lugares —el historial, el último ingreso, el disponible, el ingreso del último guardado, la moneda con
la que guarda y el formateo del copy—. La consulta de abajo, `getLatestIncome`, **siempre** recibió la
moneda por parámetro; el que nunca se la pasaba era el componente.

Vale anotar por qué no se notó: la tira es la única superficie del módulo que no está en el módulo.
Vive sobre `guidance`, aparece en el dashboard después de un ingreso (E3), y por eso quedó afuera de
todas las pasadas que se hicieron sobre la pantalla de ahorro. **Un componente que ninguna pantalla
del módulo contiene no se revisa cuando se revisa el módulo.**

### Con dos monedas hay que elegir, y elegir mal es peor que no ofrecer

Tres opciones, y solo una sirve:

- **Dos tiras, una por moneda.** No: la tira es una sugerencia parada arriba de la card que el usuario
  vino a leer. Dos apiladas son dos cosas para resolver antes de mirar el saldo, que es exactamente lo
  que la tira promete no ser.
- **La moneda con más disponible.** No: es el mismo error de origen con otro disfraz. Decide por el
  usuario en base a algo que él no hizo.
- **La moneda del ingreso más reciente.** Sí. Es lo único que la tira ya prometía —«acabás de cobrar
  esto, ¿guardás una parte?»— y lo que la hace aparecer en el momento en que hay algo que decidir.

Se compara `created_at` y no la fecha contable, por la misma razón que la consulta ya ordenaba así: lo
que la tira persigue es **el acto de cargar**, no qué día se cobró. Un ingreso de la quincena pasada
que se carga hoy es plata que hoy está en el disponible.

Y el porcentaje se deriva **dentro de la misma moneda**: lo guardado en dólares sobre el ingreso en
dólares del que salió. Cruzarlo —un hábito de pesos dictando un monto en dólares— sería mezclar dos
monedas que en todo el resto del modelo no se mezclan, y el número que saldría no tendría ningún
significado.

La regla del anti-nagging no cambia y no hacía falta tocarla: es **una vez por ingreso**, y el ingreso
más reciente es uno solo, sea de la moneda que sea. Cargar pesos y después dólares vuelve a habilitar
la tira porque el segundo ingreso es posterior al `seen_at`, que es lo que ya hacían dos sueldos en
pesos.

`pickLatestIncome` vive en el paquete y no en el componente: es la única decisión de la tira que se
puede probar sin montar nada.


### Y dos cosas más que la tira arrastraba, visibles recién con el monto en pantalla

**El monto estaba dos veces.** «Podés apartar US$ 10.000,00 de este ingreso» arriba y «Guardar
US$ 10.000,00» en el botón, a dos renglones de distancia. El mismo número repetido tan cerca no se
lee como énfasis: se lee como dos datos, y el lector se para a comparar si dicen lo mismo.

Se queda en el **texto**, y el botón vuelve a ser «Guardar». La propuesta es una frase —cuánto, de
dónde sale y qué le pasa a la plata—, y el botón es la respuesta a esa frase; poner el número en el
botón lo convertía a él en la propuesta y dejaba al texto repitiéndola.

**Las tres acciones no entraban en una línea de teléfono**, y sacar el monto del botón NO alcanzó: lo
que se salía era el tercer control. Se probó partirlas en dos filas y se descartó — la tira crece
hacia abajo, y cuanto más alta más se parece a algo que hay que resolver antes de mirar el saldo, que
es justo lo que promete no ser.

Lo que sobraba era el copy: **«Suficiente por este mes» → «No más este mes»**. Y queda mejor de lo que
estaba, porque las dos salidas pasan a arrancar igual —«Ahora no» / «No más este mes»— y lo único que
las separa es el alcance: una posterga hasta el próximo ingreso, la otra hasta el mes que viene. El
texto largo lo explicaba; el corto lo muestra.

El botón también adelgaza —`px-3` en vez del `px-4` del sistema—, y no por ganar píxeles: **el aire de
un botón se calibra contra lo que dice**, y el padding que aguantaba «Guardar US$ 10.000,00» le queda
enorme a «Guardar». Que además sea lo que termina de hacer entrar la fila es la consecuencia, no el
motivo.

Medido de 320 a 430, con un monto de ocho cifras en el texto: las tres acciones entran en una línea y
nada se sale de la pantalla.

Y una lección de método, porque casi se me pasa: **medir «hijo contra padre» no encuentra un desborde
cuando el que se sale es el padre**. La fila de acciones es `shrink-0`, así que crecía ella y sus
hijos entraban perfectos adentro; el chequeo daba limpio y la captura mostraba el texto cortado. Lo
que hay que medir es contra el ANCHO DE LA PANTALLA.

## E26 — Un supuesto disfrazado de decisión dejó el módulo a medias

El change se implementó **solo en web**, y la tarea 4.4 lo justificaba así: *"en mobile sigue montado
en la card de saldo, y así queda hasta que exista el módulo nativo — ahí no hay a dónde navegar
todavía"*.

Es circular: **este change es el que crea el módulo**. La frase describe el estado del que se parte
como si fuera el estado al que se llega.

Y no venía de ningún lado. El `proposal.md` no saca a mobile del alcance —lo que declara fuera es
plazo fijo, FCI, bróker, comprar dólares y los placeholders de inversiones, todo funcional y ninguna
plataforma—, y la paridad web/mobile es política del producto: el propio ticket de QA nativo la
enuncia para explicar por qué la fase no está terminada sin él.

**Nadie decidió dejar mobile afuera. Se asumió, y después se escribió como si se hubiera decidido**,
que es la forma más difícil de detectar un faltante: el documento que tendría que delatarlo lo
explica.

La señal que lo delató no fue leer el documento sino una pregunta: *"¿por qué no lo implementaste en
la app mobile? Tiene que estar todo listo para el QA"*. Un QA que corre sobre menos de lo que el
change dice haber hecho no es un QA parcial: es un QA que **valida una cosa distinta** de la que se
va a mergear.

### Qué es igual y qué es distinto en la nativa

Igual, porque es lo que hace que sea el mismo producto: la ruta y su entrada de navegación, la card
oscura del total con las dos monedas y su zócalo de tres acciones, «Sin destino» cálido y punteado
con sus dos salidas, la lista de propósitos con emblema y monto, el pie con el puente bancario y el
historial plegados, la fila del dashboard que navega en vez de operar, y el overlay que abre directo
a lo que se tocó y perdió su vista de detalle.

Distinto, y a propósito:

- **No hay grilla.** La web pasa a dos y tres columnas porque en desktop sobra ancho; en un teléfono
  nunca sobra, así que es una columna siempre. El componente no "se convierte" en nada: nunca tuvo
  otra forma.
- **El área táctil es alto real, no un pseudo-elemento.** En nativo no hay `::after`, así que los
  controles de 38px con 44 de área pasan a medir 44.
- **La entrada va en el menú, no en el tab bar.** El tab bar son los cuatro destinos del día a día y
  un quinto les saca ancho a los cuatro. En el sidebar de la web, «Ahorro e inversión» vive en el
  mismo grupo que Cuentas y Tarjetas; en la nativa ese grupo ES el menú.
- **Una sola consulta para la pantalla**, no tres con Suspense por sección: sin streaming, partirla
  solo agregaría estados de carga que nadie ve.

### Dos cosas que la paridad destapó

**El emblema del propósito estaba en `apps/web`.** `purposeTint` y `purposeGlyph` decidían color y
glifo, y la nativa iba a necesitar exactamente los mismos: la promesa del emblema es que el mismo
propósito se vea igual **siempre y en todas partes**, y con la función de un solo lado la copia se
hacía sola. Se mudó a `packages/savings`. Devuelve clases de Tailwind, que es lenguaje común — los
tokens salen de `@grana/ui-tokens` y nativewind los resuelve igual que la web.

**El codegen de tokens no se había corrido.** Los `--savings-unassigned-*` que el rediseño agregó
viven en `theme.css`, que la web lee directo; la nativa lee un archivo **generado** a partir de él, y
ese archivo estaba viejo. El bloque cálido habría salido sin color y sin ningún error: una clase que
no existe no rompe nada, simplemente no pinta. Es el modo de falla más caro que tiene un sistema de
tokens con dos consumidores y un solo generador.

### Lo que NO se puede afirmar

**El módulo nativo no se ejecutó nunca.** Typecheck y lint en verde es todo lo que hay: no hay Expo
en este entorno. Lo escrito es un espejo cuidadoso, y un espejo cuidadoso no es una app corriendo.

Los tres lugares donde más chances hay de que rompa, en orden: el envoltorio por contenido de las dos
monedas del total —Yoga y el navegador no deciden el quiebre de línea con las mismas reglas—, los
bordes que hacen de divisor, que dependen de `overflow: hidden` con margen negativo, y el efecto que
corre el origen cuando el grupo elegido no tiene saldo.
