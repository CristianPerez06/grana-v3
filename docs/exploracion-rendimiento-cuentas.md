# Exploración — El rendimiento de las cuentas que rinden solas

> **Documento exploratorio. No es un change, no propone schema, no propone tablas y no toca código.**
> Piensa qué hace Grana con los intereses que una billetera remunerada acredita sola, que es el caso
> más común del país y hoy no tiene pantalla ni ticket.
>
> Se apoya en `docs/modelo-de-dinero.md` (canónico). Donde este documento lo contradiga, gana el
> modelo — o hay que corregir el modelo primero, en su propio lugar.
>
> **Esta capa va ANTES que FCI**, y no por prioridad de negocio: por dependencia de vocabulario. La
> pausa de `docs/exploracion-instrumentos.md` **ya se levantó**, y sirvió: dibujar las dos capas juntas
> cerró el naming de las dos y **cambió el de instrumentos**, que pasó de «En rendimiento» a
> **«Plata colocada»** (§14.1).
>
> **`extract-savings-module` sigue congelado** hasta el QA visual nativo. Nada de acá se implementa
> antes de eso.

---

## Contexto fijo, que este documento no discute

| | |
|---|---|
| **Una cuenta remunerada es una CUENTA** | Aunque rinda. Podés pagar con esa plata sin hacer nada antes |
| **No es posición, no es FCI, no requiere rescate** | Y por lo tanto **no sale del disponible**: cuenta entera para «Para gastar» |
| **No entra a la capa de instrumentos** | Ni a «En rendimiento», ni a «Plata colocada», ni a ningún nombre que salga de ahí |
| **El problema es de VISIBILIDAD, no de modelo** | El modelo ya la clasifica bien. Lo que falta es qué hacer con el interés que acredita |
| **ARS y USD nunca se suman ni se convierten** | Como en todo el resto |

Modelarla como posición **rompería el disponible del caso más común del país**. Ya está escrito en
`docs/modelo-de-dinero.md`, punto 7 de «lo que queda abierto», y este documento no lo reabre.

---

## 0. La pregunta, en una línea

**Mercado Pago te acredita intereses todos los días. ¿Dónde los ve el usuario en Grana, y cómo entran
sin que parezcan sueldo?**

El caso real que la disparó: una cuenta sueldo en un banco, una billetera remunerada, y un usuario que
transfiere todo apenas cobra para que rinda, gasta desde ahí, y **no rescata nunca nada**. No hay alta,
no hay rescate, no hay posición. Solo un saldo que sube solo y una app que no lo ve.

---

## 1. Qué ve Grana hoy, verificado en el código

### 1.1 El circuito, paso por paso

| Lo que hace el usuario | Lo que registra Grana | ¿Está bien? |
|---|---|---|
| Cobra el sueldo en el banco | `income` → suma a «Entró» | ✅ |
| Transfiere banco → billetera | `transfer`, las dos piernas propias → **neutro** | ✅ |
| Gasta desde la billetera | `expense` → suma a «Se fué» y a «En qué se fue» | ✅ |
| **La billetera le acredita intereses** | **Nada** | ❌ |

### 1.2 Por qué no lo ve, y por qué no es un bug

El saldo de una cuenta es `saldo inicial + suma neta de movimientos`
(`packages/accounts/src/balance.ts:10`). **Grana no lee ningún banco.** Es una decisión de arquitectura,
no un olvido: no hay integración bancaria y no está previsto que la haya. Si un hecho no entra como
movimiento, para Grana no ocurrió.

El interés diario es un hecho que ocurre **sin que el usuario haga nada**, y ese es exactamente el tipo
de hecho que un sistema de registro manual no puede capturar solo.

### 1.3 El síntoma, que crece

Nada avisa. El saldo de Grana simplemente queda por debajo del real, **y la diferencia se acumula**:
no se corrige nunca sola, porque no hay ningún momento en que los dos números se vuelvan a tocar.

Con un saldo promedio de ~$1.000.000 y una tasa típica de billetera, son decenas de miles de pesos por
mes que Grana no ve. A los seis meses el usuario abre su billetera, ve un número visiblemente más alto
que el de Grana, **y ninguna pantalla le explica por qué**.

> **Lo que se rompe no es la aritmética: es la confianza.** Un usuario que descubre que la app le miente
> sobre cuánto tiene deja de creerle también en lo que sí calcula bien.

---

## 2. Tres cosas que ya están mal, y hay que decirlas antes de diseñar nada

### 2.1 No existe ninguna alarma de drift. Lo que hay es un tipo de movimiento manual

`docs/modelo-de-dinero.md` y `docs/exploracion-instrumentos.md` decían que Grana «hoy lo lee como plata
movida sin registrar — una alarma que se enciende justo cuando al usuario le fue bien».

**Eso es falso, y este documento lo corrige.** No hay nada en el repo que compare saldos, detecte
diferencias ni avise. Lo que existe es el tipo de movimiento **`adjustment` («Ajuste»)**, que **el
usuario crea a mano** cuando ya se dio cuenta solo de que los números no coinciden.

La diferencia importa para diseñar: no hay que **apagar** una alarma molesta, hay que **encender** algo
que hoy no existe. El problema no es que Grana avise mal — es que **se queda callada**.

### 2.2 El copy del Ajuste promete algo que la card del mes no cumple

El drawer de Ajuste dice, textual:

> *«Corregí la diferencia entre tu saldo real y el de Grana. **No crea un ingreso ni un gasto**.»*

Es cierto para la **analítica de categorías**: un ajuste no es `income` ni `expense`, no aparece en «En
qué se fue» y no ensucia ninguna categoría.

Es **engañoso para la card del mes**: un ajuste positivo cae en **«Entró»**
(`packages/dashboard/src/month-summary.ts`, `SIGNED_BUCKETS`), al lado del sueldo. Si el usuario carga
hoy sus intereses como Ajuste —que es lo único que puede hacer— el resumen del mes va a decir que entró
el sueldo **más** los intereses, en un solo número, sin distinguirlos.

### 2.3 El puente del módulo de ahorro dice «Tu banco muestra», y no es el banco

`SavingsLedger` rotula `accountsNet` como **«Tu banco muestra»**. `accountsNet` es el total de cuentas
**calculado por Grana**, no un dato del banco.

En una cuenta sin rendimiento la afirmación es inocua, porque los dos números coinciden. **En una cuenta
remunerada con drift es directamente falsa**, y falla justo en la pantalla que existe para explicar por
qué el banco dice otra cosa.

> **Es un cambio de copy, no de modelo.** Queda anotado como hallazgo; no se toca ahora porque
> `extract-savings-module` está congelado. Algo del tipo *«En tus cuentas, según Grana»* dice lo mismo
> sin ponerle palabras al banco.

---

## 3. El hallazgo que cambia el problema: «Entró» es liquidez, no ingreso

Esto hay que entenderlo antes de proponer nada, porque **descarta la mitad de las soluciones
intuitivas**.

`MonthSummary.entro` no es «lo que ganaste». Es **todo lo que subió el saldo de tus cuentas este mes**:
`income`, reembolsos recibidos, y el lado positivo de los buckets con signo —ajuste, settlement,
exchange, transferencia con una sola pierna propia—. Y `seFue` es su espejo.

La invariante es explícita en el código:

```
   entro − seFue === el cambio del disponible en el mes
   Tenías + Entró − Se fué − Guardado === el número de la zona oscura
```

con **`Tenías` derivado** (`packages/dashboard/src/month-opening.ts`):
`venia = cierre − (entro − seFue − guardado)`.

**Tres consecuencias que mandan sobre todo lo que sigue:**

1. **Un rendimiento que suba el saldo NO puede quedar fuera de la card.** Si sube el cierre sin aparecer
   en ningún término, `Tenías` absorbe la diferencia y la card afirma que el mes abrió con más plata de
   la que abrió. **Reescribe el pasado, en silencio.** Es el mismo modo de falla que el modelo ya tenía
   documentado para las salidas sin término.
2. **La identidad NO se rompe si el rendimiento entra en «Entró».** Cierra igual. Así que el argumento
   para separarlo **no es contable, es de significado**: el problema de mezclar el interés con el sueldo
   no es que las cuentas no den — es que el usuario lee «Entró» como «lo que gané este mes».
3. **«Entró» ya es impuro por diseño**, no por accidente. Ya tiene reembolsos y ajustes adentro. Así que
   «no lo metas en Entró porque Entró es el sueldo» es un argumento que el código no respalda: hay que
   decidirlo por producto.

---

## 4. Cómo registrar un rendimiento sin tratarlo como sueldo

Las cuatro formas posibles, con lo que cada una cuesta.

| # | Forma | Qué toca | Costo |
|---|---|---|---|
| 1 | **`income` con categoría «Intereses»** | Nada nuevo | ❌ **Descartada.** Mete el interés en el mismo cajón que el sueldo, y la analítica de ingresos deja de contestar «cuánto gano» |
| 2 | **`adjustment` con motivo libre** | Nada: ya se puede hacer hoy | ⚠️ Es lo único disponible, y es lo que el usuario va a hacer igual. Pero cae en «Entró» sin distinguirse, pide un motivo escrito cada vez, y su propio copy dice que no crea un ingreso |
| 3 | **Subtipo de `adjustment`** —un ajuste marcado como rendimiento— | Un campo | 🟢 Reusa todo el circuito que ya existe. El signo, el saldo y la reversibilidad ya funcionan. Solo agrega **de qué es** la diferencia |
| 4 | **Tipo de movimiento nuevo** (`yield` / `interest`) | Ledger, formularios, filtros, analítica, las dos apps | 🔴 Es el error de categoría que el modelo ya rechazó dos veces: modelar el **motivo** como si fuera un **tipo** |

**Propuesta: la 3.** Un rendimiento acreditado **es** un ajuste —la diferencia entre lo que Grana
calculó y lo que la cuenta tiene de verdad— y lo único que le falta al ajuste es poder decir **por qué**
en un dato y no en un texto libre.

Y ahí está la ventaja escondida: **el mismo campo que distingue el rendimiento sirve para todo lo demás
que causa drift.** Un ajuste ya no es «no sé qué pasó»; es una de tres cosas concretas (§6).

---

## 5. La carga rápida desde una cuenta

Hoy registrar el interés cuesta: entrar a Movimientos, elegir la pestaña Ajuste, elegir la cuenta,
calcular la diferencia a mano, y **escribir un motivo obligatorio**. Todos los meses. Para un número que
el usuario no eligió y no controla.

**Nadie lo va a hacer doce veces al año.** Cualquier diseño que no arranque de ahí ya falló.

Lo que sugiere el caso:

- **La puerta natural es el detalle de la cuenta**, no Movimientos. El usuario está mirando su billetera
  en otra app y compara con Grana: la acción nace ahí, sobre esa cuenta, con la cuenta ya elegida.
- **El motivo obligatorio se cae** en este camino. Si el usuario ya declaró que es rendimiento, pedirle
  además que lo escriba es pedirle lo mismo dos veces.
- **Un solo campo**: cuánto. La cuenta viene del contexto, la fecha es hoy, el tipo lo dio la puerta.
- **La frecuencia la elige el usuario, no la app.** El interés se acredita a diario, pero nadie lo va a
  cargar a diario. Una carga mensual que diga «esto es lo que rindió desde la última vez» es honesta y
  suficiente — **y es la razón por la que conviene guardar la fecha de la última actualización**, que es
  lo que convierte un número suelto en un período.

---

## 6. ¿Conviene que nazca desde «tu banco muestra otro saldo»?

**Sí, y es la decisión más importante de este documento.**

Las dos puertas posibles:

| | «Registrar rendimiento» | «Poné el saldo real» |
|---|---|---|
| Qué le pide al usuario | Que sepa **cuánto rindió** | Que **lea un número** de la otra app |
| Dónde saca el dato | De un resumen que quizá no mira | De la pantalla que ya está mirando |
| Qué pasa si además se olvidó un gasto | Queda mal igual | **Se corrige solo** |
| Qué asume | Que la diferencia es rendimiento | **Nada**: pregunta |
| Riesgo | Le pide una cuenta que él no hizo | Ninguno: el saldo real es un dato que tiene delante |

**Propuesta: nace desde el saldo real.** El usuario no sabe cuánto rindió —el resumen de la billetera no
se lo dice de forma directa— pero **sí sabe cuánto tiene**, porque lo está mirando. Grana hace la resta.

Y el beneficio de fondo: **resuelve el drift entero, no solo el rendimiento.** La diferencia entre el
saldo real y el calculado puede venir de un interés, de un gasto que no registró o de una comisión.
Una puerta que arranca del saldo las cubre a todas; una que arranca del rendimiento cubre una sola y
deja las otras dos sin lugar.

> **La consecuencia de diseño:** esto **no es una función del módulo de ahorro ni de la capa de
> instrumentos**. Es una función de **Cuentas**. Y eso es lo que la hace chica.

---

## 7. Cómo Grana calcula la diferencia

```
   saldo real informado  −  saldo calculado  =  diferencia
```

El saldo calculado ya existe: `computeBalance` = `initial_balance + suma neta de movimientos`. No hay
nada que inventar.

Lo que sí hay que decidir, y son preguntas de pantalla:

- **¿A qué fecha?** El saldo real es de **hoy**; el calculado también. Si el usuario carga una diferencia
  con fecha de ayer, ¿qué saldo calculado usa? **Propuesto: la diferencia se toma siempre contra hoy**, y
  el movimiento se fecha hoy. Fechar hacia atrás abre una madriguera —el saldo de una fecha pasada
  cambia si después se carga un movimiento anterior— por un caso que casi no ocurre.
- **¿Y si la diferencia es cero?** Se dice y no se registra nada. Es el resultado más común y el más
  tranquilizador: *«Coinciden. No hay nada que ajustar.»*
- **¿Bimoneda?** Una cuenta puede tener ARS y USD. La comparación es **por moneda, siempre**, y son dos
  diferencias independientes. Nunca una sola.

---

## 8. Cómo decidir si esa diferencia es rendimiento, ajuste o movimiento faltante

**Grana no puede saberlo.** Lo sabe el usuario, y hay que preguntárselo — pero **con la respuesta
probable ya elegida**, no con un formulario en blanco.

### 8.1 El signo ya dice casi todo

| Signo | Causa abrumadoramente probable | Preselección propuesta |
|---|---|---|
| **Positivo, en cuenta que rinde** | Interés acreditado | **Rendimiento** |
| **Positivo, en cuenta que no rinde** | Una transferencia o ingreso sin registrar | **Movimiento faltante** |
| **Negativo** | Un gasto sin registrar, o una comisión | **Movimiento faltante** |

**Un positivo en una cuenta que rinde es rendimiento casi siempre.** No es una regla que Grana imponga:
es la opción que viene marcada, y se cambia con un tap.

### 8.2 Las tres opciones, en el idioma del usuario

- **«Rindió»** → la cuenta generó eso sola. Es el caso de la billetera remunerada.
- **«Me faltó registrar un movimiento»** → hubo un gasto o un ingreso que no cargó. **La salida honesta
  acá no es ajustar: es ofrecerle cargar el movimiento**, que es lo que deja los datos bien. El ajuste
  queda como la salida de escape para cuando no se acuerda.
- **«No sé»** → ajuste sin causa, que es exactamente lo que existe hoy. **Tiene que seguir estando**: un
  usuario que no sabe por qué no puede quedar trabado sin poder cerrar sus números.

> **La tercera opción es la que hace honesta a la función.** Sin ella, Grana estaría obligando a elegir
> una causa que el usuario a veces no tiene — y elegiría la preseleccionada, que es peor que «no sé»
> porque contamina el dato con una certeza falsa.

### 8.3 Lo que NO hay que hacer

- **Clasificar sola por el producto** («Mercado Pago rinde, entonces es rendimiento»). Es el mismo error
  por producto que la capa de instrumentos ya descartó: las billeteras cambiaron dos veces en dos años
  cómo funciona su saldo remunerado.
- **Registrar la diferencia sin preguntar.** Un gasto olvidado quedaría anotado como ganancia. Sería
  peor que el silencio de hoy, porque el silencio al menos no afirma nada falso.

---

## 9. Cómo se ve en el resumen del mes

Acá hay una decisión de producto real, y **la identidad cierra en las dos** (§3). Se decide por
significado, no por aritmética.

### Opción A — adentro de «Entró»

```
   Tenías        $ 1.200.000
   Entró         + $ 2.025.000     ← sueldo $2.000.000 + interés $25.000
   Se fué        − $   800.000
   Para gastar   $ 2.425.000
```

Cero pantalla nueva. Y el usuario lee «Entró $2.025.000» como lo que ganó — **que es justamente lo que
no fue**. El número más leído de la app pasa a ser un poco falso todos los meses.

### Opción B — término propio, como la línea de la fase 3

```
   Tenías        $ 1.200.000
   Entró         + $ 2.000.000     ← el sueldo, y solo el sueldo
   Se fué        − $   800.000
   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
   Rindió        + $    25.000
   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
   Para gastar   $ 2.425.000
```

**Cerrado: B.** Y la razón de fondo la dio el mock, no este texto: **la card no se mide en líneas, se
mide en zonas.** La estructura que aguanta es

```
   Inicial  →  Operativa / consumo  →  Financiera  →  Final
   Tenías      Entró · Se fué · Guardado   Interés · Colocaste   Para gastar
```

y las líneas financieras van **bajo un solo par de reglas punteadas**, compartiendo zona. Plana, con una
regla por línea, la card se parte en cinco zonas y parece dos secciones distintas; agrupada vuelve a
tener cuatro y una tercera línea financiera entra sin agregar ninguna.

**Y la consecuencia sobre los términos operativos es lo que se estaba buscando:**

- El **interés acreditado no entra en «Entró»**, que vuelve a ser el sueldo.
- La **salida hacia un FCI no entra en «Se fué»**, que vuelve a ser el consumo.
- **Las dos explican liquidez** —la identidad cierra igual— **sin contaminar sueldo ni gasto**.

Las tres razones que ya se sostenían solas:

1. **«Entró» vuelve a significar «lo que ganaste»**, que es como se lee igual.
2. **Es la misma forma que la fase 3 ya decidió** para la plata puesta en instrumentos: una línea de
   flujo financiero, separada por regla punteada, sin ícono y sin color de alerta. **Una sola gramática
   para los dos casos**, que es la razón por la que esta capa tiene que resolverse antes que FCI.
3. **Aparece solo cuando pasó algo.** Un mes sin rendimiento cargado no muestra la línea, y el 90% de
   los usuarios no la ve nunca.

**Y el argumento en contra, que es real:** son cuatro términos en una card que ya tiene cinco. Con
rendimiento **y** una colocación de FCI el mismo mes serían seis. Ese techo hay que mirarlo en pantalla
antes de cerrarlo — es la primera pregunta del mock.

---

## 10. Cómo se ve en Movimientos

Aparece —es un hecho que movió plata y ocultarlo sería mentir por omisión— **y fuera de la analítica de
gastos**, que es donde ya viven transferencia, cambio de moneda y ajuste.

```
   ↑   Rindió tu cuenta                         + $ 25.000
       Mercado Pago · 1 al 31 de agosto
```

- **El avatar es el gris azulado** que ya usan transferencia y cambio de moneda. No es un ícono de
  categoría, porque no es un gasto ni un ingreso operativo.
- **El período, no solo la fecha.** «1 al 31 de agosto» dice lo que un rendimiento acumulado es: no pasó
  ese día, pasó durante ese tiempo. Es lo que lo distingue de un ingreso puntual **sin explicar nada**.
- **Fuera de:** «En qué se fue», la tira de ritmo, el promedio del mes y la comparación contra el mes
  pasado. Igual que un ajuste hoy.

---

## 11. El copy, que es donde esto se gana o se pierde

El riesgo entero de esta capa en una frase: **no puede parecer que Grana te está ofreciendo invertir.**
Es lo contrario — es Grana admitiendo que tu plata rindió y ella no se enteró.

### Lo que sí

| Dónde | Copy propuesto | Por qué |
|---|---|---|
| La puerta, en la cuenta | **«¿Tu banco muestra otro saldo?»** | Arranca del hecho que el usuario ya tiene delante, no de un concepto financiero |
| El campo | **«Cuánto tenés según tu banco»** | Le pide leer un número, no calcular uno |
| Diferencia cero | **«Coinciden. No hay nada que ajustar.»** | El caso más común tiene que sentirse bien, no vacío |
| La pregunta | **«¿De dónde salen estos $25.000?»** | Concreta, con el número adentro |
| Opción interés | **«Interés acreditado»** | Nombra el hecho: entró plata a la cuenta. Sobrio, y **no comparte raíz con «rendimiento»** |
| Opción faltante | **«Me faltó registrar algo»** | Sin culpa. Y ofrece cargarlo |
| Opción sin causa | **«No sé»** | Literal. Nadie tiene que fingir que sabe |
| La línea del mes | **«Interés acreditado»** | Entra en la card sin problema y no se pisa con «Colocaste», el rótulo de la línea de FCI |

> **«Rindió» queda como copy secundario, no como rótulo.** Es más cálido y sirve para explicar —*«tu
> cuenta rindió sola»*— pero comparte raíz con «rendimiento», y esa palabra la necesita la capa de
> instrumentos. El rótulo canónico es **«Interés acreditado»**: menos brillante, y no se lleva por
> delante nada.

### Lo que no

- ❌ **«Ganancia», «Ganaste», «Rentabilidad», «Interés devengado», «TNA», «TEA», «Rendimiento estimado»** —
  la primera es celebratoria, las demás son de folleto de banco.
- ❌ **Cualquier porcentaje.** Grana no calculó una tasa, no la va a proyectar, y mostrar un % invita a
  comparar contra otras opciones, que es literalmente ser un broker.
- ❌ **«Poné a rendir tu plata»**, o cualquier cosa que suene a recomendación. Grana **registra** lo que
  ya pasó. No sugiere.
- ❌ **Verde de éxito con flecha para arriba.** Es un hecho, no un logro.

> **La prueba del copy:** si una pantalla de esta capa se pudiera confundir con una de una billetera
> vendiendo su cuenta remunerada, está mal escrita.

---

## 12. Decisiones

### 12.1 Se pueden tomar ahora

| # | Decisión | Por qué se puede cerrar |
|---|---|---|
| 1 | **La cuenta remunerada sigue siendo cuenta** y no sale del disponible | Ya está en el modelo (punto 7) |
| 2 | **Esto vive en Cuentas**, no en el módulo de ahorro ni en la capa de instrumentos | Es reconciliación de saldo, no colocación de plata |
| 3 | **La puerta nace del saldo real**, no del rendimiento | El usuario sabe cuánto tiene, no cuánto rindió |
| 4 | **Grana no clasifica sola**: pregunta, con la opción probable preseleccionada | Clasificar por producto envejece mal |
| 5 | **«No sé» tiene que existir** como respuesta válida | Sin ella la función miente |
| 6 | **No es `income`** y no entra a la analítica de ingresos ni de gastos | Metería en «cuánto gano» plata que no es sueldo |
| 7 | **Ningún porcentaje, ninguna tasa, ninguna proyección** | Es la línea que separa registrar de recomendar |
| 8 | **Por moneda, siempre** | Invariante de todo el proyecto |
| 9 | **La card del mes usa la versión B**: zona financiera propia, fuera de «Entró» y «Se fué» operativos | Cerrado sobre el mock. La card se mide en **zonas** —Inicial → Operativa → Financiera → Final— y no en líneas |
| 10 | **El rótulo canónico es «Interés acreditado»**; «Rindió» queda como copy secundario | Nombra el hecho sin usar la raíz de «rendimiento», que necesita la capa de instrumentos |
| 11 | **Esto es un hábito periódico, no una corrección excepcional** | En una billetera remunerada el drift **vuelve siempre**. En una cuenta que no rinde, la puerta casi no aparece |

### 12.2 No se deben tomar todavía

| # | Decisión | Por qué espera |
|---|---|---|
| A | **Cuántas líneas entran en la zona financiera** antes de que moleste | Dos aguantan. Con tres —interés, colocación y rescate el mismo mes— hay que volver a mirar |
| B | **Si la zona financiera lleva un rótulo propio** o le alcanza con las reglas punteadas | Un rótulo la hace explícita y le suma altura a una card que ya creció |
| C | **Subtipo de `adjustment` o campo aparte** | Es forma de datos. Va después de las pantallas, siempre |
| D | **Si al elegir «me faltó registrar algo» Grana abre el alta de movimiento** | Es lo correcto y es más pantalla. Se ve dibujado |
| E | **Si se recuerda cargar el rendimiento**, y con qué frecuencia | Un recordatorio mensual ayuda o molesta según cómo se vea |
| F | **Qué pasa con una cuenta en dos monedas** que rinde en las dos | Poco frecuente, pero rompe el flujo de un solo campo |

---

## 13. Preguntas abiertas para las pantallas

**La puerta**
- ¿Se descubre? Si vive en el detalle de la cuenta, ¿alguien entra ahí?
- ¿Alcanza con que exista, o Grana tiene que **ofrecerla** cuando pasó mucho tiempo sin conciliar?

**La diferencia**
- ¿«Grana dice $1.200.000, vos decís $1.225.000, hay $25.000 de diferencia» se entiende sin explicar?
- ¿Y si la diferencia es enorme porque el usuario nunca registró nada? ¿Ajuste gigante, o hay que
  frenarlo?

**La clasificación**
- ¿Tres opciones son pocas, muchas o las justas?
- ¿«No sé» se elige tanto que las otras dos no sirven? **Es lo primero que hay que medir.**

**La card del mes**
- ¿Cuatro términos más «Para gastar» sigue siendo legible?
- ¿Y un mes con rendimiento **y** colocación de FCI? Son seis.

**El tono**
- ¿Parece que Grana te está ofreciendo invertir? Es lo único que tumba la capa entera.

---

## 14. Relación con FCI, y por qué esta capa va primero

No es una carrera de prioridades: es que **una decide vocabulario de la otra**.

| | Cuenta remunerada (esta capa) | FCI (`exploracion-instrumentos.md`) |
|---|---|---|
| ¿Sale del disponible? | **No** | Sí |
| ¿Requiere rescate? | **No** | Sí |
| ¿Es posición? | **No** | Sí |
| ¿Cuándo se ve la ganancia? | Cuando el usuario concilia | Al rescatar |
| ¿A cuánta gente le pasa? | **A casi todos** | A bastantes menos |

Las dos producen **plata que apareció sin que el usuario la ganara trabajando**, y las dos reclamaban la
palabra «rendimiento». **La pausa sirvió: dibujarlas juntas cerró las dos.**

### 14.1 La colisión, y cómo se resolvió

El mock de esta capa se dibujó primero con **«Rindió»**. Puesto en el resumen del mes quedaba así:

```
   Rindió              + $ 25.000        ← lo generó una cuenta de Mercado Pago
   Pusiste a rendir    − $ 100.000       ← salió hacia un FCI

   [ sección ]  En rendimiento           ← donde los $25.000 NO se generaron
```

Tres problemas en una sola pantalla: dos conjugaciones del mismo verbo pegadas, y una sección cuyo
nombre invita a suponer que la primera línea sale de ella. **No sale — y el usuario no tiene forma de
descubrir que se equivocó.**

**Lo que quedó:**

| | Rótulo | Por qué |
|---|---|---|
| **Cuenta remunerada** (esta capa) | **«Interés acreditado»** | Nombra el hecho —entró plata a la cuenta— sin usar la raíz de «rendimiento» |
| **Sección de FCI** (`exploracion-instrumentos.md`) | **«Plata colocada»** | No promete rendimiento, no compite con las cuentas, aguanta FCI, plazo fijo y 3C |
| **Línea del mes por colocar** | **«Colocaste»** | Sale del nombre de la sección sin esfuerzo |
| **Rescate positivo de un FCI** | **«Rendimiento cobrado»** | La palabra **volvió a estar libre** al caerse «En rendimiento». Era el único costo visible que tenía |

**«En rendimiento» queda descartado**, y no por perder una comparación: la ganó, los cinco casos. Lo
tumbó una capa que no estaba sobre la mesa cuando se comparó.

### 14.2 La lección de método

La comparación A/B/C estaba bien hecha —mismos datos, cinco casos, regla de descarte fijada antes de
mirar— y **aun así eligió mal**. Un ganador solo vale contra lo que estaba sobre la mesa.

> **No cerrar el nombre de una sección mientras haya una capa adyacente sin dibujar.** Lo barato no era
> comparar mejor: era dibujar la capa de al lado antes de decidir.

---

## 15. Cómo sigue

1. **Nada de esto se implementa antes del QA visual nativo de `extract-savings-module`.** Es la compuerta
   vigente y no cambió.
2. ✅ **El mock existe**: `docs/design/modelo-de-dinero/conciliacion-saldo-rendimiento.html`. Dieciséis
   pantallas: la puerta con sus tres copys, el sheet de saldo real vacío y calculado, las tres causas
   sugeridas por signo, los casos positivo / negativo / cero, Movimientos, **las dos versiones de la card
   del mes**, el stress test con seis líneas, y las dos correcciones de copy. **Ninguna tabla, ningún SQL.**

   Dos cosas que solo aparecieron al dibujarlas:
   - **La card aguanta**, pero no plana: con dos líneas financieras bajo **un solo par de reglas
     punteadas**. El techo deja de ser el número de líneas y pasa a ser el de **zonas**, que sigue
     siendo cuatro. Plana, dos reglas seguidas leen como dos secciones.
   - **La colisión de vocabulario es peor de lo que decía §14.** Puesta en una pantalla, «Rindió
     +$25.000» arriba de una sección llamada «En rendimiento» —donde esos $25.000 **no** se
     generaron— no es una molestia de estilo: es un error de categoría que el usuario **no tiene forma
     de descubrir**.
3. ✅ **El naming quedó cerrado con las dos capas sobre la mesa**: «Interés acreditado» acá,
   «Plata colocada» para instrumentos. `exploracion-instrumentos.md` **sale de pausa** (§14.1).
4. **Aparte y en cualquier momento**, porque no depende de nada de esto: el copy de «Tu banco muestra»
   en el puente del módulo de ahorro (§2.3), que hoy le pone al banco palabras que el banco no dijo.
