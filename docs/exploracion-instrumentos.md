# Exploración — Instrumentos, o dónde está parada la plata

> **Documento exploratorio. No es un change, no propone schema y no toca nada.** Piensa cómo entraría
> la capa de instrumentos dentro de «Ahorro e inversión» sin romper Guardado ni Propósitos.
>
> Se apoya en `docs/modelo-de-dinero.md` (canónico) y en el razonamiento contable de
> `docs/design/modelo-de-dinero/fase-3-posiciones.html`. Donde este documento contradiga al modelo,
> gana el modelo — o hay que corregir el modelo primero, en su propio lugar.
>
> **Estado de lo construido, para no confundir planos:** el módulo `/savings` está implementado en
> web y en nativa, con QA visual nativo bloqueado por acceso. Nada de acá se implementa antes de eso.

---

## 0. La pregunta, en una línea

Grana hoy contesta **cuánto puedo gastar**. Lo que no contesta es **qué está haciendo el resto**.

Y no es una pregunta de inversores. Un usuario con $2.000.000 en la caja de ahorro y $500.000 en un
plazo fijo no se pregunta cuál fue su rendimiento anualizado: se pregunta cuánto de eso puede tocar
si mañana se le rompe el auto. Esa es la pregunta que abre esta capa, y es de liquidez antes que de
rentabilidad.

---

## 1. Taxonomía de dinero

### 1.1 La corrección de entrada: no son seis cajones, son dos ejes

La lista que motivó este documento —para gastar, guardado, rescate rápido, bloqueado a fecha, USD,
posiciones variables— parece una taxonomía de seis categorías paralelas. **No lo es**, y tratarla
como tal es el primer error que hay que evitar: dos de sus miembros no son del mismo tipo que los
otros cuatro.

Lo que hay son **dos ejes independientes**, más una dimensión que ya existe y que no pertenece a
ninguno de los dos.

**Eje A — Disponibilidad: ¿puedo gastarlo hoy?**

El modelo ya dice que la no-disponibilidad tiene **dos fuentes independientes**, y esto es lo que
esta capa tiene que respetar sin colapsarlo:

| Fuente | Qué la produce | Reversible | Ejemplo |
|---|---|---|---|
| **Decisión** | El usuario *guardó* | Sí, de un tap | «Aparté $200.000» |
| **Posición** | La plata **no está** en una cuenta que participe del disponible | Sí, pero con un acto y a veces con un plazo | Un plazo fijo |

Ninguna implica la otra. Guardar produce plata no disponible, pero **no toda la plata no disponible
fue guardada**.

**Eje B — Certeza del valor: ¿sé cuánto vale?**

| Grado | Qué significa | Ejemplo |
|---|---|---|
| **Nominal cierto** | Vale lo que dice, sin depender de nadie | Plata en una cuenta |
| **Contractual** | Vale lo que dice **un contrato** con fecha | Plazo fijo: el banco ya te dijo cuánto vas a cobrar |
| **De mercado** | Vale lo que alguien pague hoy | CEDEARs, acciones, cripto |

**Lo que NO es un eje: la moneda.** Y acá está la segunda corrección importante. «USD como protección
de valor» aparece intuitivamente como una categoría, pero en Grana **la moneda es una dimensión de
todo**: hay disponible en pesos y en dólares, guardado en pesos y en dólares, propósitos bimoneda. La
regla 5 del modelo —*nunca existe un total mezclado ARS+USD*— ya lo resuelve.

Tener dólares no es tener un instrumento: es tener plata en otra moneda. Lo que es un **hecho** es el
acto de comprarlos, y ese hecho ya existe en el ledger como `exchange`, con su `fx_rate`. Modelar
«dólares» como instrumento crearía una tercera representación de la misma plata —cuenta, moneda,
posición— y las tres tendrían que reconciliar.

### 1.2 El mapa

Cruzando los dos ejes, con la moneda como atributo transversal:

```
                          ¿PUEDO GASTARLO HOY?
                    sí                        no
                    │                          │
  ┌─────────────────┼──────────────────────────┼──────────────────┐
  │  NOMINAL        │  Para gastar             │  Guardado        │
  │  CIERTO         │  (cuentas, en su moneda) │  (decisión)      │
  │                 │                          │                  │
  │  CONTRACTUAL    │  —                       │  Plazo fijo      │
  │                 │                          │  (posición)      │
  │                 │                          │                  │
  │  DE MERCADO     │  —                       │  FCI · CEDEARs   │
  │                 │                          │  (posición)      │
  └─────────────────┴──────────────────────────┴──────────────────┘
       ↑ ledger: hechos            ↑ decisión          ↑ posición: un lugar
```

Tres lecturas que salen del mapa y que conviene fijar:

1. **La fila de arriba es todo lo que Grana hace hoy.** Las dos de abajo son esta capa entera.
2. **La columna izquierda no tiene instrumentos, y eso es correcto.** Un instrumento que se puede
   gastar hoy sin ningún acto previo **no es un instrumento: es una cuenta** (ver §2).
3. **«Guardado» y «posición» comparten columna pero no naturaleza.** Uno es una decisión reversible
   de un tap; el otro es plata que físicamente no está. Colapsarlos en una sola línea —«fuera de lo
   disponible»— cierra la aritmética y le miente al usuario, que deja de saber cuánto puede recuperar
   hoy. Ya está descartado en el mock de fase 3 y vale la pena repetirlo acá.

### 1.3 Lo que el mapa deja ver

**«Instrumentos con rescate rápido» y «bloqueados a fecha» no son dos categorías: son un atributo del
mismo tipo de cosa.** Los dos son posiciones; lo que los separa es **cuánto tarda el rescate**, que es
un dato de la posición, no una familia aparte. Diseñarlos como dos entidades duplicaría el circuito de
alta, de valuación y de rescate para no ganar nada.

El atributo que sí hace falta es **la liquidez**, y es un espectro corto:

| Liquidez | Qué significa para el usuario | Ejemplos |
|---|---|---|
| **Inmediata** | Lo tenés mañana si lo pedís | FCI money market, cuenta remunerada* |
| **A fecha** | Lo tenés el día que vence | Plazo fijo tradicional, UVA |
| **De mercado** | Lo tenés cuando vendas, y no sabés a cuánto | CEDEARs, acciones, cripto |

\* La cuenta remunerada aparece acá para mostrar que **no llega a ser posición**: su rescate no
existe, porque no hay nada que rescatar.

---

## 2. Qué entra y qué no entra como «instrumento»

### 2.1 El test de admisión

Antes de discutir caso por caso conviene tener un criterio, porque sin él cada instrumento nuevo se
discute desde cero. Se propone uno, de una sola pregunta:

> **¿Para gastar esa plata mañana hace falta un acto previo?**
>
> - **No** → es una **cuenta**. Vive en el disponible, en su moneda.
> - **Sí** → es una **posición**. Sale del disponible, y ese acto previo es su rescate.

El test es bueno porque es la pregunta que el usuario se hace, no una clasificación financiera. Y
porque se apoya en lo único que el modelo ya considera duro: la disponibilidad.

Tiene un borde incómodo y conviene nombrarlo antes de que aparezca: **un FCI money market se rescata
en el día**. El test lo manda a posición por poco. Se sostiene igual —hay que pedir el rescate, la
plata no está en la cuenta, la tarjeta no se debita de ahí— pero es el caso donde el criterio se apoya
en un acto casi instantáneo, y por eso es el caso que hay que mirar con el usuario, no resolver en un
documento.

### 2.2 Caso por caso

| Caso | Veredicto propuesto | Por qué |
|---|---|---|
| **Cuenta remunerada** | **Cuenta, no posición.** Ya decidido en el modelo (§7.7) | Esa plata se gasta mañana sin rescatar nada. Modelarla como posición rompería el disponible del caso **más común del país**. Es una cuenta con rendimiento |
| **USD en cuenta o en caja** | **Cuenta, en otra moneda** | Gastar dólares es gastar dólares. Comprarlos es un `exchange`, que ya existe. Ver §1.1 |
| **FCI money market** | **Posición, liquidez inmediata** — con reserva | Pasa el test por poco. Es el borde del criterio, y el más común entre usuarios jóvenes |
| **Plazo fijo (tradicional o UVA)** | **Posición, liquidez a fecha** | El caso canónico: capital, plazo, tasa, vencimiento. El contrato da los números |
| **Broker: CEDEARs, acciones, bonos** | **Posición, liquidez de mercado** — y **no en la primera fase** | Trae la valuación, que es una capa entera. Y trae *el problema del comitente*: un broker es **una** cuenta con **muchas** tenencias adentro |
| **Cripto** | **Fuera, por ahora** | No por prejuicio: por costo. Valuación 24/7, custodia propia vs. exchange, y una fiscalidad que el usuario espera que la app entienda. Nada de eso mejora la pregunta de liquidez que abre esta capa |

### 2.3 Dos cosas que no entran, y que van a pedir entrar

- **Deudas y créditos que no son tarjeta.** Un préstamo personal es lo simétrico de una posición
  —plata que no está, pero al revés— y va a tentar entrar por la misma puerta. Es otra capa: acá se
  modela dónde está lo que tenés, no lo que debés.
- **Bienes.** El auto, el departamento. Son patrimonio, no plata, y no tienen liquidez ni rescate.
  Entran, si entran, en la fase 5 y con otra vara.

---

## 3. Impacto contable

Es la parte donde una decisión equivocada contamina números que hoy están bien, así que conviene
tratarla antes que la pantalla.

### 3.1 Qué mueve el ledger y qué no

| Acto | ¿Toca el ledger? | Por qué |
|---|---|---|
| **Guardar / volver a usar** | No | Es una decisión: cambia la función de la plata, no su lugar (regla 2) |
| **Destinar / quitar destino** | No | Ídem |
| **Poner plata en un instrumento** | **Sí** | La plata **sale de la cuenta**. El saldo baja de verdad |
| **Rescatar / cobrar el vencimiento** | **Sí** | La plata vuelve a la cuenta |
| **Que la posición cambie de valor** | **No, o sí como hecho fechado** | Ver §3.4 |

La primera fila de este cuadro es lo que hace que esta capa **no rompa** lo construido: guardar y
destinar siguen sin tocar el ledger, y las posiciones lo tocan porque efectivamente mueven plata. No
hay que reconciliar dos mecánicas: hay dos naturalezas distintas, y cada una hace lo suyo.

### 3.2 Lo que NO puede contaminarse

**Ni «Gasto» ni «Ingreso».** Es la regla dura de esta capa, y tiene dos caras:

- **Poner $700.000 en un plazo fijo no es un gasto.** Si entrara como `expense`, la card diría que
  gastaste $905.433 en un mes en que gastaste $205.433 — y ese número alimenta la tira de ritmo, la
  comparación con el mes pasado y «En qué se fue». *El error no queda ahí: se propaga.*
- **Cobrar $730.000 al vencimiento no es un ingreso.** Metería en «Entró» plata que nunca fue sueldo,
  y encima $700.000 de eso son **los mismos pesos que salieron**, contados dos veces.

Hay una tercera salida tentadora, y también está descartada: **una sola línea «Fuera de lo
disponible»** que junte guardado y posiciones. Cierra la aritmética y colapsa una decisión reversible
con plata inmovilizada por un mes. El usuario que ve un solo número **no sabe cuánto puede recuperar
hoy**, que es justamente la pregunta que esta capa vino a contestar.

Y la peor de todas, porque no se nota: **no poner ninguna línea**. La identidad de la card se despeja
—`Tenías = disponible − (entró − se fué − guardado)`— así que cualquier plata que salga sin término
propio la absorbe «Tenías» en silencio. La suma da, y el pasado queda reescrito. Una suma que no
cierra el usuario la puede agarrar; un pasado reescrito no.

### 3.3 Stock y flujo: la distinción que decide qué se ve en meses pasados

Es la pieza más fina del razonamiento y la que más fácil se pierde.

|  | **Guardado** | **Puesto a trabajar** |
|---|---|---|
| Naturaleza | **Stock** — una postura de hoy | **Flujo** — algo que pasó en un mes |
| ¿Saca plata de las cuentas? | No | **Sí** |
| Término en la card | El stock **entero**, meses anteriores incluidos | Solo **lo del mes** |
| En un mes cerrado | **No se dibuja** | **Se queda para siempre** |

El porqué: guardar no saca plata de las cuentas, así que el saldo con el que abrió el mes todavía
contiene lo guardado y hay que restarlo completo. Poner a trabajar **sí** la saca: lo que salió en
julio ya no está en el saldo de apertura de agosto, y restar el stock lo contaría dos veces.

Que sea flujo es lo que la hace **pertenecer a su mes**. Y es por eso que la card puede ganar esta
línea sin romperse: no compite con «Guardado», hace lo contrario.

### 3.4 Rendimiento: cobrado, capitalizado y pérdida

Tres casos que la gente vive distinto y que el modelo tiene que separar:

**Rendimiento cobrado** — vence el plazo fijo y vuelven $730.000 sobre $700.000 de capital.

- Los $700.000 son **la contrapartida** del movimiento que salió. No son ingreso, son el mismo dinero.
- Los $30.000 son **la realización de una valuación**. Es plata nueva en la cuenta, y es lo primero de
  esta capa que se parece a un ingreso — pero llamarlo `income` lo mete en «Entró» junto al sueldo, y
  ahí el usuario deja de poder leer cuánto cobró por trabajar.
- **Decisión propuesta:** el rendimiento tiene término propio, separado del ingreso, desde el día uno.
  Cómo se llame y dónde se muestre es de la fase; que no sea `income` es de modelo.

**Rendimiento capitalizado** — el FCI que sube todos los días sin que nada toque la cuenta.

- No hay hecho en el ledger porque **no pasó nada en ninguna cuenta**.
- Lo que cambia es cuánto vale la posición: es una **valuación**, que el modelo ya tiene anotada como
  candidata a hecho fechado del ledger («hoy esto vale $X»).
- **Consecuencia incómoda y honesta:** mientras no haya valuación, una posición vale lo que costó. Es
  preferible a inventar un número, y hay que decirlo en pantalla, no dejarlo implícito (regla 11: *lo
  que Grana no puede saber, lo declara*).

**Pérdida** — el CEDEAR que vale menos que lo que pagaste.

- Simétrica del rendimiento y ninguna app argentina la muestra bien. No es un gasto: no gastaste nada.
- Es la razón más fuerte para **dejar la valuación de mercado fuera de la primera fase**: una capa que
  solo sabe sumar está incompleta de una forma que se nota justo el mes que al usuario le fue mal.

### 3.5 Una consecuencia que ya está anotada y conviene no perder

Las cuentas que rinden solas producen **drift**: el saldo real se aleja del calculado sin que el
usuario haya registrado nada, y Grana hoy lo lee como «plata movida sin registrar». Es una alarma que
se enciende **justo cuando al usuario le fue bien**. Esta capa lo agrava —más plata rindiendo, más
drift— así que conviene resolverlo con ella y no después.

---

## 4. Relación con propósitos

### 4.1 El error que no hay que repetir

La fase 2 ya aprendió esto y costó una migración: **el propósito no se le cuelga a una fila**. La
plata guardada es fungible, así que no existe «la reserva de Japón» — existe cuánto de lo guardado
está repartido a Japón. Por eso el reparto vive en su propia tabla, por monto.

**Exactamente el mismo error, en su versión nueva, sería ponerle un `purpose_id` a una posición.** Y
es más tentador, porque una posición *parece* individualizable: el plazo fijo de $500.000 «es» para
Japón. Pero se rompe igual, y el caso que lo rompe es común: un plazo fijo de $500.000 del que
$300.000 son para Japón y $200.000 son el fondo de emergencia. Con `purpose_id` en la posición eso no
se puede decir, y la única salida sería hacer dos plazos fijos — la app dictándole al usuario cómo
contratar en el banco.

### 4.2 Lo que el modelo ya dejó preparado

El modelo dice que *destinar sin guardar* **todavía no existe** y que **va a ser válido** cuando la
plata pueda estar fuera del disponible sin haber sido guardada: los $500.000 del plazo fijo no se
guardan —ya no son disponibles— pero se van a poder destinar a Japón.

O sea: la puerta está abierta y el reparto por monto es la forma correcta. Lo que cambia no es la
mecánica sino **el techo**.

### 4.3 La consecuencia que sí hay que decidir (y no ahora)

Hoy el invariante es: *el reparto de una moneda no puede exceder **lo guardado** en esa moneda*.

Cuando entren las posiciones, el techo natural pasa a ser **lo guardado + lo colocado**, y eso abre
una pregunta que no se puede contestar sin ver la pantalla:

> ¿«Japón: $300.000» es un solo número contra un pozo único de plata no disponible, o son dos
> —«$100.000 guardado + $200.000 en el plazo fijo»— que el usuario puede distinguir?

- **Pozo único**: más simple, un solo invariante, y el propósito sigue siendo un monto. Pero pierde
  la respuesta a *«¿cuánto de lo de Japón puedo tocar hoy?»*, que en una app argentina es la pregunta
  útil.
- **Distinguible**: contesta eso, y a cambio el reparto necesita saber contra qué se reparte — que es
  justo el borde donde se cuela el `purpose_id` en la posición por la ventana.

**No hay que decidir esto ahora.** Es la pregunta central de la fase, y lo único que hay que cuidar
hasta entonces es no cerrarla sin querer.

### 4.4 Qué se puede hacer hoy sin comprometer nada

Casi nada, y eso es una buena noticia:

- **No agregar `position_id` a `savings_purpose_allocation`.** Hoy no existe y no debe existir.
- **No agregar `purpose_id` a nada nuevo.**
- Mantener el invariante donde está —en la base, disparando desde las dos tablas— porque el día que el
  techo cambie, cambia **en un solo lugar**.
- La regla operativa: **esta capa no toca la fase 2.** Si un diseño de instrumentos obliga a
  modificar `savings_purpose_allocation`, es señal de que el diseño está mal planteado, no de que la
  fase 2 se quedó corta.

---

## 5. UX y navegación

### 5.1 Dónde vive

Dentro de **«Ahorro e inversión»**, como un tercer bloque de la misma pantalla, después del total y
del desglose por propósito. No como pestaña, no como ruta propia.

El argumento es el mismo que ya se aplicó a la fase 2: son **cortes del mismo dinero**, y separarlos
en dos pantallas obliga a recordar un número mientras se mira el otro. Y el argumento negativo, que
ya está escrito en el modelo: **no puede colgar del detalle de una cuenta**, porque una lista de
productos financieros colgando de cada cuenta es un home banking, que es exactamente lo que Grana no
es. La cuenta podrá tener un **atajo contextual** cuando el instrumento exista; no es su casa.

### 5.2 El nombre

| Candidato | A favor | En contra | |
|---|---|---|---|
| **«Puesto a trabajar»** | Lenguaje del usuario, no del sistema. Describe la **función**, que es el corte de esta pantalla. Ya se usa en el hub del modelo | Levemente informal | **Propuesto** |
| «Instrumentos» | Preciso | Jerga. Nadie dice «mis instrumentos» | Descartado |
| «Inversiones» | Conocido | **Deja afuera comprar dólares y el plazo fijo**, que no se sienten como invertir sino como cubrirse. Es la objeción que el modelo ya tiene escrita | Descartado |
| «A resguardo» | Suena a protección, que es el escalón real en Argentina | Sugiere que **no se puede tocar**, y buena parte de esto se rescata en el día | Descartado |
| «Plata colocada» | Correcto y neutro | Suena a banco. Es la palabra del que vende el producto | Descartado |

**Y lo que se muestra no es el nombre de la categoría sino el de la cosa**: «Plazo fijo Comafi»,
«FCI Mercado Pago». El rótulo del bloque se lee una vez; las filas se leen siempre.

### 5.3 Sin nada, no hay bloque

Con cero posiciones, la sección **no existe**. Ni card vacía, ni CTA gris, ni «todavía no tenés
inversiones».

Es la regla E8 del módulo, ya aplicada y ya QA-eada: *un módulo no se estrena mostrando lo que no
hace*. Un usuario que entra y ve un bloque apagado esperando que él haga algo **aprende a ignorar la
pantalla**, y esa lección no se revierte cuando la funcionalidad llega.

La puerta de entrada, entonces, no es un estado vacío: es **el acto**. Aparece donde el usuario ya
está haciendo algo con esa plata — al registrar la transferencia que la saca de la cuenta.

### 5.4 Cómo no parecer un home banking, un broker ni un marketplace

Cuatro reglas, cada una contra un fracaso concreto:

1. **Grana no ofrece productos.** No hay lista de plazos fijos disponibles, ni tasas comparadas, ni
   «invertí acá». La regla 10 del modelo ya lo dice: *describe hechos sobre la plata del usuario; no
   recomienda instrumentos*. El día que Grana sugiera un instrumento, cambia de negocio.
2. **No hay precios en vivo, ni gráficos de cotización.** Eso es un broker. Acá el número que importa
   es cuánto tenés y cuándo lo podés tocar.
3. **No hay rendimiento proyectado como titular.** «Vas a cobrar $730.000» es legítimo **porque es un
   contrato** —el banco ya dio ese número, Grana lo repite—. «Tu cartera rendiría 8% anual» es otra
   cosa: es una promesa.
4. **El alta la abre el movimiento, no un catálogo.** El usuario transfiere plata a un plazo fijo; el
   destino de esa transferencia gana un grupo nuevo. No se entra por una vidriera de productos.

### 5.5 El usuario que solo quiere controlar gastos

Es la mayoría, y es a quien esta capa puede arruinarle la app. Tres defensas:

- **El bloque no existe hasta que hay algo adentro** (§5.3).
- **El dashboard no cambia.** La card del mes gana una línea **solo en los meses en que pasó algo** —
  por ser flujo, no stock (§3.3). Quien nunca puso plata a trabajar no ve la línea nunca.
- **El módulo se puede apagar entero**, y esa decisión ya está tomada y normada en E10. Esta capa
  hereda ese borde en vez de crear uno nuevo.

---

## 6. Recorte de una primera fase

### 6.1 Los cuatro puntos de partida posibles

| Empezar por | Qué habilita | Riesgo |
|---|---|---|
| **Solo el modelo conceptual** | Nada para el usuario | Un modelo sin un caso real que lo ejerza es un modelo sin probar. Se descubre que está mal recién cuando se implementa |
| **USD** | Casi nada: ya existe como moneda y como `exchange` | **Es una trampa barata.** Parece un instrumento y no lo es (§1.1). Se haría trabajo para no mover ninguna pregunta |
| **FCI money market** | Mucho: es lo más común entre usuarios jóvenes | Es el **borde** del criterio de admisión (§2.1) y encima trae valuación diaria. Empezar por el caso ambiguo es empezar discutiendo la excepción |
| **Plazo fijo** | El circuito completo: sale, vence, vuelve | Diseñar todo alrededor de un instrumento con vencimiento **obligatorio** |

### 6.2 La propuesta

**Empezar por plazo fijo, pero construyendo el mecanismo, no el instrumento.**

El plazo fijo tiene una propiedad que ninguno de los otros tiene, y es la razón de elegirlo: **el
contrato da todos los números**. Capital, plazo, tasa y lo que vas a cobrar salen del banco, no de una
valuación. Eso permite ejercer el circuito contable entero —salida, tenencia, vuelta, rendimiento
separado del capital, stock vs. flujo, la línea nueva del mes— **sin construir la capa de valuación**,
que es la más cara y la que trae la pérdida (§3.4).

O sea: es el instrumento que más enseña por unidad de trabajo.

**Y el riesgo que trae es real**, es el que el propio pedido de este documento nombra, y hay que
atacarlo explícitamente:

> Si se diseña alrededor del plazo fijo, el vencimiento termina siendo obligatorio y el FCI no entra
> sin rehacer.

Tres mitigaciones concretas, todas de diseño y ninguna de código:

1. **Dibujar la lista con dos instrumentos desde el primer mock**, aunque solo se implemente uno: un
   plazo fijo con fecha y un FCI sin fecha. Una lista que nunca vio una fila sin vencimiento va a
   asumir que todas lo tienen.
2. **Tratar el vencimiento como un atributo opcional de la posición**, no como parte de su identidad.
   Una posición sin fecha no es un caso raro: es la mitad del mundo.
3. **Escribir el circuito de rescate antes que el de vencimiento.** «Saqué la plata» es el caso
   general; «venció» es un caso particular del plazo fijo que además puede renovarse.

### 6.3 Qué NO entra en esa primera fase

- **Valuación de mercado.** Sin ella no hay CEDEARs ni acciones, y está bien: es la capa que trae la
  pérdida, y la pérdida bien mostrada es un problema de diseño propio.
- **Repartir posiciones a propósitos.** El techo del reparto es la pregunta abierta de §4.3.
- **Cualquier cosa que toque `savings_purpose_allocation`.**
- **Cripto** (§2.2) y **el problema del comitente** —un broker con muchas tenencias adentro—, que es
  el que va a pedir que la posición tenga cuenta padre.

---

## 7. Decisiones: lo que se puede cerrar ahora y lo que no

### 7.1 Se puede decidir ahora

| # | Decisión | Apoyo |
|---|---|---|
| 1 | **USD no es un instrumento**: es la moneda, que ya es dimensión de todo | Regla 5 del modelo |
| 2 | **La cuenta remunerada no es una posición**: es una cuenta con rendimiento | Ya escrito en el modelo (§7.7) |
| 3 | **El test de admisión** es «¿hace falta un acto previo para gastarlo mañana?» | Propuesto acá (§2.1) |
| 4 | **Rescate rápido y bloqueado a fecha no son dos entidades**: son el atributo *liquidez* de la misma | Propuesto acá (§1.3) |
| 5 | **Poner a trabajar no es un gasto y cobrar no es un ingreso** | Mock de fase 3 · modelo §7.6 |
| 6 | **La card del mes gana una línea de FLUJO**, que se queda en los meses pasados, a diferencia de Guardado que es stock | Mock de fase 3 |
| 7 | **Ninguna posición lleva `purpose_id`** | Lección de la migración 0059 (§4.1) |
| 8 | **El bloque vive dentro de `/savings`**, no en el detalle de cuenta | Modelo §1 y E4 del módulo |
| 9 | **Sin nada, no hay bloque** | E8 del módulo, ya QA-eado |
| 10 | **Grana no recomienda instrumentos** | Regla 10 del modelo |
| 11 | **La primera fase es plazo fijo como caso, mecanismo genérico como entrega** | Propuesto acá (§6.2) |
| 12 | **Cripto queda fuera** de esta vuelta | Propuesto acá (§2.2) |

### 7.2 No decidir todavía

| # | Pregunta abierta | Por qué esperar |
|---|---|---|
| A | **¿El techo del reparto pasa a ser «guardado + colocado», y el propósito distingue las dos partes?** | Es la pregunta central de la fase. Se contesta con la pantalla delante, no antes (§4.3) |
| B | **¿El FCI money market es posición o cuenta?** | Es el borde del criterio. Se mira con usuarios, no se argumenta |
| C | **Cómo se llama el término del rendimiento** en la card del mes | Depende de cómo quede la línea nueva |
| D | **Qué hace Grana con una posición sin valuación**: ¿vale lo que costó, y cómo lo dice? | Es copy y es honestidad; necesita la pantalla |
| E | **El drift de las cuentas que rinden solas** | Ya está abierto en el modelo (§7.5) y esta capa lo agrava |
| F | **Prorrateo entre repartos** cuando una posición compartida cambia de valor o sufre un retiro parcial | Ya anotado en el modelo (§7.3). Depende de A |
| G | **¿La posición tiene cuenta padre?** (el problema del comitente) | Aparece con brokers, que no entran en la primera fase |

### 7.3 Lo que este documento NO decide, a propósito

No propone nombres de tablas, ni columnas, ni migraciones, ni rutas, ni componentes. Cuando esto sea
un change, lo primero que hay que hacer **no es escribir schema**: es dibujar el circuito de alta y el
de rescate con dos instrumentos distintos en pantalla, y recién ahí ver qué datos hacen falta.

Es la misma secuencia que funcionó en la fase 2 —dibujar antes de construir— y es la que evitó que el
propósito naciera colgado de una fila.

---

## 8. Cómo sigue

1. **Nada de esto se implementa antes del QA visual nativo de `extract-savings-module`.** Es la
   compuerta vigente.
2. Cuando se retome: **redibujar `fase-3a-plazo-fijo.html`** con la navegación del módulo ya
   construido —la cuenta como atajo contextual, no como puerta— y **con un segundo instrumento sin
   vencimiento en la lista**, aunque no se implemente.
3. Con esos dos mocks, decidir A y B de §7.2. Recién después, un change.
