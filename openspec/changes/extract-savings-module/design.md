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
