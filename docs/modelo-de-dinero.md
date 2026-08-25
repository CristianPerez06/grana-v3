# El modelo de dinero de Grana

> Modelo conceptual de producto. **No es una spec ni un change de OpenSpec** — es la capa de
> pensamiento que va antes, y la referencia para decidir dónde vive cada pieza nueva.
>
> Complementa `docs/grana-en-una-pagina.md` (qué es Grana hoy) y precede a los changes que
> incorporen ahorro, propósito, posiciones y valor.
>
> Sustituye al borrador `docs/plans/ahorro-e-inversion-modelo.md`, que quedó desactualizado.

> **Estado, agosto 2026.** Las fases 1 y 2 están **implementadas** en la branch
> `feature/add-savings-set-aside` (changes `add-savings-set-aside` y `add-savings-purpose`), con QA de
> web terminado y el QA nativo pendiente (issue #58). **Todavía no están en producción**: el producto
> decidió no subir la fase 1 sola. De la fase 3 en adelante, este documento describe una intención,
> no algo construido — donde el texto habla en presente de algo que aún no existe, lo dice.
>
> Lo que ya se construyó **corrigió al modelo** en un punto grande: el propósito no es una etiqueta
> sobre lo guardado, es un **reparto por monto**. Está explicado en §3 y en la regla 8.

---

## 1. Las dimensiones

El dinero **no recorre pasos**. En todo momento está en un lugar, con ciertos atributos, y sobre él
ocurren hechos o decisiones que los cambian. Modelarlo como una secuencia sugiere una dependencia
que no existe: una meta puede existir sin valuación, una posición sin propósito, un propósito sin
inversión.

```
                                 DINERO
                                   │
        ┌───────────────┬──────────┴──────────┬───────────────┐
        ↓               ↓                     ↓               ↓
    POSICIÓN          VALOR            DISPONIBILIDAD      PROPÓSITO
  ¿dónde está?    ¿cuánto vale?        ¿puedo gastarlo?     ¿para qué?
      hecho           hecho                derivada          decisión
     siempre         siempre               siempre           OPCIONAL
```

**Lo que las cambia**

| | Cambia |
|---|---|
| **Hechos** — los movimientos del ledger | Posición y valor |
| **Decisiones** — guardar/volver a usar, destinar/quitar destino | Disponibilidad y propósito |

**Lo que las interpreta, sin cambiarlas**

La **vara** (pesos, dólares, poder de compra) · el **horizonte** (derivado de compromisos, metas y
gasto histórico) · las **agrupaciones** (por vehículo, por propósito, por disponibilidad) · la **meta**,
que agrupa repartos y no contiene plata.

### La disponibilidad tiene dos fuentes independientes

Es la dimensión sobre la que se apoya toda la fase 1, y no se deriva de una sola cosa:

- **La posición** — esta cuenta no participa del disponible (un plazo fijo, la caja de seguridad).
- **La decisión** — guardé este monto de una cuenta que sí participa.

Ninguna implica la otra. **Guardar produce plata no disponible, pero no toda la plata no disponible
fue guardada**: un FCI puede estar fuera del circuito diario sin que el usuario lo haya "guardado",
y puede ser patrimonio de largo plazo sin ningún propósito declarado.

### Proteger no es lo mismo que crecer

En Argentina el escalón que importa no es hacer crecer la plata: es **que no pierda valor**. Comprar
dólares o hacer un plazo fijo no se siente como invertir — se siente como cubrirse.

| | Qué busca | Instrumentos típicos |
|---|---|---|
| **Proteger** | Que no pierda valor | Dólares · plazo fijo · cuenta remunerada |
| **Crecer** | Que valga más, asumiendo riesgo | Acciones y CEDEARs · cripto |

Consecuencia de producto: **una superficie llamada "Invertir" deja afuera al acto de protección más
común del país**, que es comprar dólares. Y consecuencia de modelo: la etiqueta de un movimiento que
saca plata del disponible sale del **instrumento** elegido, no de la mecánica de la transferencia.

### Ahorro e inversión no son dimensiones

Son **resultados** de ejercer las otras:

- **Ahorrar** = ejercer una decisión (*guardar*) sobre plata disponible.
- **Invertir** = una propiedad de la **posición** donde esa plata quedó.

Por eso nunca fueron dos módulos, y por eso mover plata de una caja de ahorro a un FCI no es
"pasar de ahorro a inversión": es la misma plata cambiando de posición.

## 2. Las cuatro naturalezas

Todo lo que el modelo toca cae en una de estas cuatro. **Saber en cuál cae decide dónde vive,
qué reglas tiene y quién lo puede cambiar.** Es el criterio para admitir cualquier pieza futura.

### ① Hechos del ledger — *qué le pasó a la plata*

Los siete tipos de movimiento que ya existen. Se registran, no se opinan.

- Pueden ser incómodos: un saldo negativo es un hecho válido.
- Tienen fecha contable y se cortan a hoy.
- Los saldos se derivan de ellos y **nunca se persisten**.
- Candidato futuro a sumarse acá: la **valuación** ("hoy esto vale $X"), que es un hecho fechado.

### ② Decisiones del usuario — *qué decidió sobre la plata*

**Guardar / volver a usar. Destinar / quitar destino.**

Los nombres de arriba son los que **dice la app**. El modelo, internamente, los llamó *reservar /
liberar* y *asignar / desasignar*, y esas palabras siguen en el código (`availability_reserve`,
`savings_purpose_allocation`, `write_reserve`). No cruzan a la interfaz, por la misma regla que
mantiene *posición* y *valuación* fuera de la pantalla.

- **No son movimientos.** No mueven plata: cambian su función.
- **No entran al ledger.** Grana nunca inventa un movimiento financiero para representar una intención.
- **No admiten ser inválidas.** Guardar más de lo que tenés no es un estado incómodo: es un input erróneo.
- Son **reversibles** por definición.
- Se derivan de sus entradas; el total guardado nunca se persiste.

### ③ Atributos de las posiciones — *cómo es el lugar donde está la plata*

Propiedades de la cuenta o del vehículo, no de la plata ni del usuario.

- ¿Participa del disponible?
- ¿Está inmovilizada, y hasta cuándo?
- ¿Genera renta, o su valor fluctúa?
- ¿En qué moneda vive?

### ④ Capas de lectura — *cómo se mira todo lo anterior*

No agregan datos: reinterpretan los que ya hay.

- La **vara** (pesos corrientes, dólares, poder de compra).
- Las **agrupaciones** (por vehículo, por propósito, por disponibilidad).
- El **horizonte** derivado de compromisos, metas y gasto histórico.
- La **meta**, que agrupa repartos y no contiene plata.

> **Regla de admisión:** una pieza nueva que no cae limpio en una de las cuatro está mal planteada.

---

## 3. Los dos verbos

| | **Guardar** *(⇄ Volver a usar)* | **Destinar** *(⇄ Quitar destino)* |
|---|---|---|
| Qué hace | Saca un monto del disponible | Reparte un monto de lo guardado hacia un propósito |
| Ojo | Es **una** de las dos fuentes de no-disponibilidad, no la única (ver §1) | No dice nada sobre la disponibilidad |
| Opera sobre | Plata que **hoy está** en el disponible | Lo guardado en esa moneda. *(Fase 3: también lo que esté fuera del disponible)* |
| Tope | El disponible. No puede excederlo | Lo guardado **sin destino** en esa moneda |
| Efecto en el disponible | **Lo reduce** | **Ninguno** |
| Efecto en el ledger | Ninguno | Ninguno |
| Obligatorio | No | No |
| Por moneda | Sí, siempre | Sí, siempre |

**Cómo se combinan:**

- *Guardar sin destinar* → válido, y es **el caso normal**. "Guardé $200.000, todavía no sé para qué."
- *Guardar y destinar juntos* → una sola acción de cara al usuario.
- *Destinar sin guardar* → **todavía no existe**. Va a ser válido cuando la plata pueda estar fuera del
  disponible sin haber sido guardada: los $500.000 del plazo fijo no se guardan —ya no son
  disponibles— pero se van a poder destinar a Japón. Eso llega con las posiciones, en la fase 3.

**En la interfaz son dos conceptos y una sola acción**, cuando la plata está en el disponible:
*Guardar $200.000* → *¿para qué?* (con "todavía no sé" como respuesta legítima).

### El propósito se reparte por monto; no se le cuelga a una fila

Es la corrección más grande que trajo la implementación, y vale como regla de modelo.

La primera versión ató el propósito a la **decisión de guardar**: cada fila de reserva llevaba un
`purpose_id`. Es el mismo error de categoría que atarle una **cuenta**: la plata guardada es
**fungible**. Si guardaste $300.000 el 15 de julio y $200.000 el 3 de agosto, no existe la fila de
"$150.000 para Japón" — y ninguna validación arregla eso, porque el problema no es que el dato esté
mal cargado, es que la pregunta no se puede contestar con esa forma.

Lo que se reparte es un **monto**, en una tabla propia (`savings_purpose_allocation`), independiente
de cuándo y en cuántos actos se guardó. De ahí salen tres cosas:

- **«Sin destino» es el resto derivado**: `guardado − lo repartido`. No es un propósito, no es una
  fila, y no se puede editar ni borrar. Es lo que sobra.
- **El invariante es que ningún propósito quede negativo y que el reparto nunca exceda lo guardado**,
  por propósito y moneda. Se puede romper desde los dos lados: repartiendo de más, o **volviendo a
  usar plata que ya estaba repartida** sin tocar ningún reparto. Por eso vive en un trigger que
  dispara desde **las dos tablas**, no en la pantalla.
- **Guardar y destinar juntos son dos filas en dos tablas**, y se escriben en **una transacción**
  (`write_reserve`). Escribirlas por separado deja la mitad si se corta la red entre una y otra.

---

## 4. Reglas del modelo

1. **Guardar no mueve plata: cambia su función.** No hay transferencia bancaria detrás.
2. **Ninguna decisión del usuario entra al ledger.** El ledger registra hechos; las decisiones viven aparte.
3. **Lo guardado se deriva de sus entradas.** Nunca se persiste un total, igual que los saldos.
4. **Guardar se topea al disponible.** El ledger admite negativos porque registra hechos; una decisión imposible no es un hecho incómodo, es un error.
5. **Todo por moneda.** Nunca existe un guardado ni una meta en un total mezclado ARS+USD.
6. **Las decisiones tienen fecha** y se cortan a hoy como todo lo demás.
7. **Una meta no contiene plata: agrupa repartos**, que pueden estar en distintas cuentas y monedas.
8. **El propósito es opcional, y una meta es un propósito que ganó un objetivo.** No son dos entidades: `propósito` = un nombre al que se le **reparte** un monto de lo guardado, sin cuantificar el objetivo; `meta` = ese mismo propósito con `target_amount`, `target_date` y `target_currency`. El fondo de emergencia deja así de ser una excepción del modelo — es simplemente **un propósito que nunca se cuantifica**. Lo que sí es propio de él es que Grana **no lo puede inferir**: sin que el usuario lo diga, es indistinguible de "plata sin destino", y exige exactamente lo contrario (liquidez por encima de rendimiento).
9. **Un propósito es bimoneda por construcción.** Como guardar es por moneda, un mismo propósito puede tener pesos y dólares a la vez ("Japón: $200.000 + US$ 500"). Nunca se suman.
10. **Grana describe hechos sobre la plata del usuario; no recomienda instrumentos.** "Tenés $2.000.000 sin rendir hace cuatro meses" es un hecho. "Poné eso en un FCI" es asesoramiento.
11. **Lo que Grana no puede saber, lo declara.** Un diagnóstico sobre información parcial puede ser peor que ningún diagnóstico.
12. **El propósito se reparte por monto, no se le cuelga a una fila.** La plata guardada es fungible: no existe "la reserva de Japón", existe cuánto de lo guardado está repartido a Japón (§3).
13. **Lo que sobra tiene nombre pero no entidad.** «Sin destino» es `guardado − lo repartido`: se deriva, no se persiste, y no se puede editar ni borrar como si fuera un propósito.
14. **El invariante del reparto vive en la base, y dispara desde las dos tablas.** Se rompe repartiendo de más y también volviendo a usar plata ya repartida; una defensa que solo mire una de las dos operaciones no es una defensa.

---

## 5. Fases

Cada fase se sostiene sola y prepara la siguiente. Ninguna obliga a deshacer la anterior: todas las
columnas nuevas son nullable o tienen default.

| Fase | La pregunta | Qué agrega | Estado |
|---|---|---|---|
| **1 · Guardar** | *¿Cuánto puedo gastar?* | Guardar y volver a usar, por moneda, fuera del ledger | Construida · QA nativo pendiente |
| **2 · Propósito** | *¿Para qué lo conservo?* | Reparto opcional de lo guardado — **sin objetivo ni fecha** | Construida · QA nativo pendiente |
| **3 · Posiciones** | *¿Dónde está y qué está haciendo?* | `positions`: plazo fijo, FCI, tenencia en dólares — con custodio, vencimiento y valuación | Sin empezar |
| **4 · Metas** | *¿Estoy llegando?* | El propósito gana objetivo, fecha y moneda. Progreso respaldado por posiciones | Sin empezar |
| **5 · Patrimonio** | *¿Estoy mejor que antes?* | La vara, el consolidado y el rendimiento real | Sin empezar |
| **Transversal** | *¿Está donde corresponde para cuándo la necesito?* | Horizonte y adecuación. Se puede empezar en la 3 | Sin empezar |

**Ninguna fase se archiva sin QA en la app nativa.** La paridad web/mobile es política del producto, y
la vista mobile del navegador comparte el código de web: no ejerce nada de React Native. Una fase
probada solo ahí está probada a medias.

**Las tres primeras no necesitan ningún dato externo.** Recién la 5 requiere inflación — y hasta eso
arranca con datos propios: el `fx_rate` de los `exchange` del usuario ya permite decir "compraste a
$1.100, hoy a $1.250".

### La fase 3 no pasa por "cuentas que no cuentan"

Hubo una versión intermedia de la fase 3: marcar ciertas cuentas como fuera del disponible con un
`counts_as_available`, y recién después construir posiciones. **Esa escala se elimina**, y no por
ahorrar trabajo: porque el problema que resolvía es un problema que ella misma crea.

Un plazo fijo **no es una cuenta**. Tiene capital, tasa, fecha de inicio y vencimiento, y un mismo
banco puede tener cinco a la vez — como cuentas serían cinco cuentas nuevas cada mes, con nombres que
el usuario tiene que inventar. Es el mismo agujero que ya estaba anotado como *el problema del
comitente*: un broker tiene **una** cuenta y **muchas** tenencias adentro.

Y el flag existía solo porque el vehículo era una cuenta. Si el vehículo es una **posición**, la plata
sale de la cuenta con un movimiento real, el saldo de la cuenta ya baja, y **el disponible sale bien
sin ningún flag**: no hay nada que descontar porque no hay nada de más. El booleano no era una
simplificación, era el parche de haber elegido mal la entidad.

Eliminarlo además borra la consecuencia que ya nos había complicado el dashboard: con cuentas fuera
del disponible, una transferencia entre cuentas propias deja de ser neutra y la card del mes necesita
una segunda línea —*"pasaste a otras cuentas"*— que no significa nada para el usuario. Sin el flag,
las transferencias siguen siendo neutras y la card sigue cerrando con una sola línea nueva.

Lo que la fase 3 **sí** tiene que resolver es la contrapartida del movimiento: hoy la plata que sale
de una cuenta va a otra cuenta, y ahí tendrá que poder ir a una posición. Es trabajo real y es de esa
fase; lo que no hay que hacer es pagarlo dos veces, primero con un flag y después de nuevo.

### Por qué Propósito va antes que Posiciones

Porque son de precio muy distinto y el barato compra retención temprana. *"Guardaste $200.000"* es
una abstracción; *"Guardaste $200.000 para Japón"* es una razón para volver — y no requiere saber
dónde está esa plata ni cuánto rinde.

Lo que **no** se adelanta es la meta completa (objetivo, fecha, progreso): esa sí gana muchísimo con
las posiciones, porque la enseñanza argentina de verdad —*"tu objetivo está en dólares y tu ahorro en
pesos"*— necesita saber en qué está parada cada parte.

### La forma del hub de la fase 3: dos cortes del mismo número

El hub que aparece en la fase 3 —"Mi plata" / "Dónde está"— existe para cruzar dos preguntas que hoy
no se pueden cruzar sin mentir: **qué función cumple** la plata y **dónde está**. Su requisito duro
es que los dos cortes sean **dos descomposiciones del mismo total**, por moneda:

```
Total en pesos                      $ 8.441.212
├─ Por función
│    Para gastar        $ 7.541.212
│    Guardado           $   200.000
│    Puesto a trabajar  $   700.000
└─ Por ubicación
     Mercado Pago       $ 6.741.212
     Galicia            $ 1.000.000
     Plazo fijo Galicia $   700.000
```

Si los dos cortes no suman lo mismo, el hub hace exactamente lo que el modelo viene evitando: mostrar
dos totales que no reconcilian. Es fácil que no cierre —una cuenta olvidada en el corte por función
alcanza— así que el hub SHALL derivar los dos del mismo conjunto y no de dos lecturas independientes.

**El corte por función NO se desglosa por cuenta. El corte por ubicación sí.** "Para gastar" es un
monto y nada más: colgarle las cuentas debajo cuenta el guardado dos veces —una adentro de cada saldo
y otra en su propia línea— y además afirma una disponibilidad por cuenta que no existe. Una
**posición** se puede desglosar en los dos cortes, porque tiene custodio; el **guardado**, solo en el
de función. Esa asimetría no es un detalle de presentación: es la consecuencia directa de que una
reserva sea una decisión y una posición sea un lugar.

Y ahí se ve por qué el **detalle de una cuenta** no puede dar esta respuesta ni siquiera en fase 3:
Mercado Pago aparece en un corte y no en el otro. La ubicación no puede contestar por la función.

### El orden de construcción no es el mapa del producto

Las fases son un **orden de obra**: qué se puede construir sin deshacer lo anterior. Leerlas como la
estructura que ve el usuario sería repetir el error que ya cometimos una vez en este documento —
dibujar el dinero como una cadena cuando es un conjunto de dimensiones simultáneas.

El usuario no recorre `Ahorro → Propósito → Posición → Meta → Patrimonio`. Lo que va a ver, a medida
que las fases lo habilitan, son **tres capas**:

| Capa | Lo que contesta | Piezas |
|---|---|---|
| **Qué puedo usar** | *¿Cuánto puedo tocar hoy?* | Disponible · Guardado · Comprometido |
| **Dónde está y qué hace** | *¿En qué está parada mi plata?* | Cuentas · Plazos fijos · Dólares · Fondos |
| **Para qué y cómo voy** | *¿Estoy llegando y estoy mejor?* | Propósitos · Metas · Evolución |

Cada fase le agrega piezas a una de las tres, no una etapa nueva a un camino. Y ninguna palabra
interna cruza a la interfaz: nunca se lee *"reserva de disponibilidad"*, *"posición"* ni *"valuación"*.
La UI dice **Para gastar**, **Guardado**, **Dónde está**, **Para qué**.

### Las ocho preguntas, y dónde se cierran

El norte del producto es que Grana pueda contestar ocho preguntas. Antes de la fase 1 contestaba dos
completas; con las fases 1 y 2 construidas son tres, y la sexta quedó a mitad de camino — se sabe para
qué es lo guardado, pero todavía no si eso alcanza.

| | Pregunta | Hoy | Se cierra en |
|---|---|:--:|---|
| 1 | ¿Cuánto tengo? | 🟡 | Fase 3 |
| 2 | ¿Dónde está? | 🟢 | — |
| 3 | ¿Cuánto puedo gastar? | 🟢 | **Fase 1** — construida |
| 4 | ¿Qué pasó este mes? | 🟢 | — |
| 5 | ¿Cuánto estoy acumulando? | 🔴 | Fase 3 |
| 6 | ¿Para qué estoy guardando? | 🟡 | Fase 2 (construida, parcial) · Fase 4 |
| 7 | ¿Estoy protegiendo mi plata? | 🔴 | Fase 5 |
| 8 | ¿Estoy avanzando? | 🔴 | Fase 5 |

## 6. Lo que la fase 1 aprovechó sin construir

Quedó como está escrito, y sirve de patrón para las que vienen: cada fase se apoya en lo que ya
existe y no toca el ledger.

- `transfer` y `exchange` ya existían y ya estaban fuera de la analítica de gastos.
- **Cuentas** ya era, en la práctica, la vista de "lo que tengo".
- El corte temporal, la bimoneda, el aviso no bloqueante y los primitivos de overlay ya estaban hechos.
- El ledger, las reglas de signo y la analítica del mes **no se tocaron**.

---

## 7. Lo que queda abierto

1. ~~**El nombre del verbo.**~~ **Cerrado en la fase 1.** La UI dice **Guardar** y **Volver a usar**; el modelo sigue llamándolo *reserva* adentro. La vuelta se llamó *Liberar* hasta que quedó claro que "liberar" describe lo que le pasa a la plata y no lo que hace el usuario. Y *Apartar* quedó descartado como verbo propio: la fase 1 ya lo usa como **sinónimo** de guardar en la tira de sugerencia ("podés apartar $10.000 de este ingreso"), así que darle un significado distinto lo rompía. Por eso el segundo par se llama **Destinar / Quitar destino**.
2. **¿Un guardado se ancla a una cuenta o es por moneda a secas?** Por moneda es más simple y no cierra puertas; anclarlo permite decir "esos $200.000 están en tu Billetera sin rendir", pero reintroduce la imputación de retiros parciales (¿esos $50.000 que sacaste salieron del guardado o del disponible?).

   Lo que está en juego es concreto: **mientras la reserva sea por moneda, el detalle de una cuenta no puede contestar "cuánto puedo gastar de acá"**. Los compromisos sí se podrían repartir por cuenta —el pago de un resumen sale de una cuenta conocida—, pero el guardado no sale de ninguna. Ninguna fase resuelve eso hoy, y probablemente esté bien así: el detalle de cuenta es una pantalla de **ubicación** y la disponibilidad es otro lente. La pregunta *"dónde está mi plata y cuánta puedo tocar"* se contesta en el **hub de la fase 3**, que junta cuentas, guardado y posiciones en una sola lectura — no cuenta por cuenta.
3. **Prorrateo entre repartos** cuando una posición compartida cambia de valor o sufre un retiro parcial. Es de fase 3, pero conviene no cerrar la puerta antes.
4. **Tratamiento del fondo de emergencia** como propósito con reglas propias (tamaño derivable del gasto mensual; liquidez por encima de rendimiento).
5. **Qué hace Grana con el drift** de las cuentas que rinden solas, hoy leído como "plata movida sin registrar" — una alarma que se enciende justo cuando al usuario le fue bien.
6. **El interés y el rescate no son ingresos.** Cuando vence un plazo fijo y vuelven $730.000 sobre un capital de $700.000, lo que toca la cuenta es un hecho — pero registrarlo como `income` metería $730.000 en "Entró" y en la tira de ritmo, plata que nunca fue sueldo. El capital que vuelve es la contrapartida del que salió; la ganancia es la **realización de una valuación**, no un ingreso. Es el agujero que grana-v2 dejó anotado (la ganancia invisible del rescate) y hay que cerrarlo **en la fase 3**, cuando aparece la primera posición que vence, no en la 5.
7. **Una cuenta remunerada no es una posición**, aunque rinda. Esa plata está disponible: se puede gastar mañana sin rescatar nada. Modelarla como posición rompería el disponible del caso **más común del país**. Es una cuenta con rendimiento, y qué hacer con ese rendimiento es el punto 5.
