# Propuesta — El Inicio de Grana

**Fecha:** 2026-07-31 · **Branch:** `feature/clarify-dashboard-lenses` · **Commit:** `210270d7`
**Origen:** dos meses de uso en producción · **Datos:** cuenta real `cristian.ap84@gmail.com`

> Este documento es para leer y decidir. Los artefactos formales (proposal, design, spec
> delta, tasks) están en `openspec/changes/clarify-dashboard-lenses/`.
> **No commitear este archivo** — duplica contenido de los artefactos y generaría drift.

---

## TL;DR

La app no es compleja. Es **ambigua**.

```
Ningún número del Inicio está mal calculado.
Casi todos están mal rotulados.
```

Cinco de seis rótulos nombran algo distinto de lo que el número mide, porque cada uno fue
bautizado desde la lógica que lo calcula y no desde la pregunta que el usuario trae. El
resultado es que la app **delega en el usuario la decisión contable de qué número aplica a
qué pregunta**. Eso es trabajo de la app.

**Propongo un primer change de puro rótulo y presentación**: cero features nuevas, cero
migraciones, cero queries nuevas. Después vienen tres pasos más, cada uno habilitado por el
anterior.

---

## 1. El diagnóstico

### La auditoría de rótulos

| Lo que dice en pantalla | Lo que realmente mide | El problema |
|---|---|---|
| **"Para gastar · hoy"** | saldo de cuentas propias (stock) | no es "para gastar"; es lo que tenés |
| **"Balance del mes"** + label **"Balance"** | flujo neto de caja del mes | "balance" es stock, esto es flujo |
| **"Gastos"** (dentro de Balance) | gasto de caja, **sin** tarjeta | no son todos tus gastos |
| **"¿En qué gasté este mes?"** | gasto devengado, **con** tarjeta | sí son todos — y por eso difiere del anterior |
| **"Pago de tarjeta"** | caja de este mes por consumos de meses **anteriores** | no dice de cuándo son |
| **"Comprometido"** | obligaciones futuras | este está bien |

### La demostración — julio 2026, datos reales

Cinco montos en la misma pantalla, todos hablando de plata, ninguno igual a otro, **ninguno
equivocado**:

| Monto | Qué es |
|---|---|
| `$425.151,40` | Hero "Para gastar · hoy" — stock, hoy |
| `−$2.684.140,02` | Balance del mes — flujo de caja de julio |
| `$2.726.350,40` | Balance del mes → "Gastos" — caja, **sin** tarjeta |
| `$985.201,62` | Balance del mes → "Pago de tarjeta" — caja de julio por consumos de mayo/junio |
| `$3.300.931,03` | "¿En qué gasté" — devengado, **con** tarjeta |

La brecha entre las dos cards que dicen "gasto" es **$574.580,63 (+21%)** y nada en pantalla
la explica.

La spec ya declara esa divergencia como intencional (*"son lentes distintas a propósito (...)
el rótulo de la pregunta de cada card comunica que miran cosas distintas"*), pero esos
rótulos viven en 12,5px gris debajo de títulos de 18px.

> **La prueba del problema:** el autor de la spec abrió esta conversación preguntando qué
> mide la card de Balance.

### La pregunta original, contestada

*"¿Por qué el Balance del mes está en negativo si ninguna de mis cuentas lo está?"*

Porque **la card mide un flujo y se llama como si midiera un stock**. Un mes puede cerrar
negativo —salió más de lo que entró— mientras todas las cuentas siguen en positivo, porque
la diferencia salió de plata que ya tenías. Las dos cosas son ciertas a la vez.

En tu caso concreto: julio tuvo ingresos por `$1.023.563,90` y salidas por `$3.711.552,02`
(gastos de caja + pagos de resumen). El neto de `−$2.684.140,02` es correcto.

### El dato que ninguna card dice

```
17-jun ──────────────────────────────────────▶ 31-jul
$2.850.000                                    $425.151,40

██████████████████████████████████████░░░░░░░░
quemaste $2.424.848,60  =  85% de tu plata disponible en 6 semanas
```

| Mes | Neto de caja |
|---|---|
| junio 2026 | `+$259.291,42` |
| julio 2026 | `−$2.684.140,02` |

Está todo en los datos, correctamente registrado. El Hero muestra `$425.151,40` en blanco
tranquilo sobre navy. **Ninguna card dice "te queda el 15% de lo que tenías hace seis
semanas"** — la única frase de esa pantalla que te habría hecho reaccionar.

### Por qué "se siente compleja"

```
MODO CHEQUEO                      MODO REVISIÓN
~90% de las aperturas             ~10%
dura 4 segundos                   dura 3 minutos
parado, antes de gastar           sentado, con tiempo
"¿puedo?"                         "¿cómo vengo?"
necesita UN número y respuesta    tolera densidad y desglose
```

El Inicio está diseñado **100% para revisión**: seis bloques, cinco montos, dona, barras.
No existe ninguna superficie de chequeo. Es una app que abrís veinte veces por mes,
diseñada para la única vez que te sentás a revisar.

---

## 2. Hallazgos verificados, además del rótulo

1. **Siete baldes de naturaleza distinta con tratamiento visual idéntico.** Ingresos, Gastos,
   Pago de tarjeta, Liquidaciones, Cambio de moneda, Reintegros y Ajustes usan el mismo
   `FlowRow`: mismo dot, misma barra, mismo peso. La card afirma visualmente que son lo mismo.
   Contablemente son tres naturalezas: **flujo real**, **movimiento interno** y **corrección
   de stock**.

   *Consecuencia concreta:* comprar dólares hunde el neto ARS y lo pinta de `text-expense`,
   mientras la tira USD suma en 17px. La app te felicita en chico y te reta en grande, por
   ahorrar.

2. **`totalTransfer` mueve el neto y no renderiza fila.** Agregado por la migración 0051 el
   30/07. La card **ya tiene** el patrón de filas condicionales que usan Ajustes, Pago de
   tarjeta, Liquidaciones y Cambio de moneda. `totalTransfer` es el único excluido, y por lo
   tanto el único caso donde el neto no se explica con lo visible.

3. **El aviso de ajustes es un reproche.** Hoy: *"registralos y hacelos desaparecer"*. El
   ajuste es el mecanismo de reconciliación de la app; presentarlo como falta desincentiva la
   conducta que mantiene honestos los datos. En dos meses hiciste **un** ajuste, de $3.848,10.

4. **Ninguna superficie de saldo distingue un negativo.** `hero-section.tsx` no tiene una sola
   condicional — ni `cn()`, ni `< 0`. Un `−$2.424.848` se renderiza igual que `$5.000.000`.
   Lo mismo en "Dónde está" y en `/accounts`. El único aviso existente es transaccional
   (salta una vez al registrar) y después silencio permanente.

5. **`initial_balance_date` se guarda y ningún cálculo la respeta.** Mercado Pago la tiene en
   `2026-06-17` con `+$2.344.571,85` de movimientos anteriores. La fila sintética "Saldo
   inicial" se inyecta con esa fecha, la lista se ordena por fecha, y termina apareciendo
   **después** de 16 días de movimientos mostrando el valor pre-movimientos. Muerde a todo
   usuario que carga historia retroactiva al arrancar — o sea, a todos.

6. **Un préstamo recibido se registra como `income`.** `2026-07-30, $330.000, "Prestamo
   Stella Maris"`. Un tercio de los "Ingresos" de julio es plata que hay que devolver. Sube el
   neto y se pinta de verde.

7. **Tres tarjetas sin un solo consumo tienen dos períodos generados cada una.**

---

## 3. Lo que propongo hacer ahora — Change 1

**`clarify-dashboard-lenses`** · solo `apps/web` · presentación y copy sobre datos ya
consultados.

- El **Hero** deja de prometer gastabilidad y declara su propio límite ("no descuenta lo que
  ya está comprometido").
- El Hero **distingue un disponible negativo** e invita a corregir el registro, sin acusar.
- **"Balance del mes"** deja de nombrarse como stock, en el título y en el label del número.
- Debajo del importe, una **línea de lectura** que interpreta el signo en palabras.
- Las filas **se agrupan por naturaleza**, con un encabezado en el grupo de movimiento interno
  que comunique que esa plata no se perdió.
- Cada fila **declara su asterisco en un chip** junto al label: "Gastos" sin tarjeta, pago de
  resumen de meses anteriores, transferencias fuera de las cuentas activas.
- **`totalTransfer` renderiza fila** cuando es distinto de cero.
- El **puente caja→tarjeta se muda al pie de la card** que genera la duda (hoy es una card
  suelta entre las dos que reconcilia).
- El **aviso de ajustes** se reencuadra como reconciliación.

### El puente ya existe — no hay que escribirlo, hay que moverlo

`SpentThisMonthSection` ya calcula `financiado = devengado − caja` reusando las **mismas query
keys** (TanStack dedupea, sin fetch extra). Es correcto y es gratis. Solo está en el lugar
equivocado: renderiza como card independiente **entre** las dos cards que reconcilia, en vez
de cerrar la card donde nace la confusión.

*(Bonus: `dashboard.month.financed_on_card` es una clave i18n huérfana, remanente de una
iteración anterior del mismo puente. Se elimina.)*

### El costo que asumo de frente

Este change deja el Hero **más honesto y menos accionable**. Hoy miente y responde una
pregunta; después dice la verdad y no responde ninguna.

Es deliberado. El hueco que deja —"¿y entonces cuánto puedo gastar?"— lo llena el paso 3.

> **Primero que el número sea verdad. Después que sea útil.**

---

## 4. Lo que necesito de vos

**Una sola decisión, y es bloqueante:** aprobar los strings. La spec fija *qué debe comunicar*
cada rótulo, no las palabras — así cambiarlas después no requiere tocar la spec.

> **Estado:** esta formulación ya pasó por una ronda de revisión cruzada con Codex, que
> convergió en ella. Las tablas de abajo son la versión acordada entre las dos propuestas
> — falta tu visto bueno, que es el que destraba la implementación.

### Hero

| | Hoy | Propuesta |
|---|---|---|
| eyebrow | `Para gastar · hoy` | `En tus cuentas · hoy` |
| pregunta | `¿Cuánto tengo?` | *(sin cambio)* |
| caption | `Lo que tenés disponible hoy, en pesos y dólares.` | `La suma de tus cuentas de efectivo y banco. No descuenta lo que ya está comprometido.` |
| negativo | *(no existe)* | `Tus cuentas suman en contra. Puede que falte registrar algún ingreso.` |

*La segunda oración de la caption es la pieza clave: la app declarando su propio límite.*

### Card del mes

| | Hoy | Propuesta |
|---|---|---|
| título | `Balance del mes` | `Entró y salió` |
| pregunta | `¿Cómo se movió mi plata este mes?` | *(sin cambio)* |
| label del número | `Balance` | `DIFERENCIA` |
| lectura + | — | `Entró más de lo que gastaste: la diferencia quedó en tus cuentas.` |
| lectura − | — | `Gastaste más de lo que entró: la diferencia salió de lo que ya tenías.` |

*La línea de lectura responde literalmente la pregunta que originó todo esto, en el mismo
lugar donde surge la duda. No repite el monto: lo interpreta.*

**`Movimiento del mes` fue el candidato y se descartó por colisión.** Usa vocabulario
canónico y es inherentemente una palabra de flujo — pero **"Movimientos" es un ítem del menú
principal** (`nav.movements`) y el título del módulo de transacciones. Una card del Inicio
llamada "Movimiento del mes" hace esperar la lista de transacciones del mes, que existe y
está a un click. Es el mismo modo de falla que venimos a corregir.

`Entró y salió` no colisiona con nada (cero apariciones en el catálogo) y es autosuficiente.
**El título puede tener voz propia porque nombra una card que no existe en ningún otro lado**
— no hay término con el cual ser consistente, solo hay que no colisionar. Las filas, en
cambio, nombran conceptos compartidos con cinco pantallas: ahí manda la consistencia.

### Filas

| | Hoy | Propuesta |
|---|---|---|
| Ingresos | `Ingresos` | *(sin cambio)* |
| Gastos | `Gastos` | *(sin cambio)* + chip **condicional** `sin tarjeta` |
| Pago de tarjeta | `Pago de tarjeta` | `Pago de resumen` + chip `consumos de meses anteriores` |
| Transferencias | *(no se renderiza)* | `Transferencias` + chip `fuera de tus cuentas activas` |
| Ajustes | `Ajustes` + chip `Sin registrar` | `Ajustes` + chip `diferencia` |

**Por qué las filas NO se renombran.** Se evaluó `Entró` / `Salió` y `Salió de tus cuentas`.
Ambas se descartaron con evidencia del catálogo: `Ingresos` / `Gastos` es **vocabulario
canónico con 15 apariciones** (tipos de movimiento, tabs, filtros, categorías, la dona), y
`entró` / `salió` no aparece ni una vez. Un dialecto local en una sola card, para conceptos
que el sistema ya nombra en cinco pantallas, cuesta más de lo que rinde.

Y el argumento a favor del renombre no resistió: **cada falla vive en un lugar distinto.**

```
   FALLA 1 — naturaleza (stock leído como flujo)  →  título y label del número
   FALLA 2 — alcance (¿incluye tarjeta?)          →  la fila "Gastos"
```

Nadie lee *"Ingresos $1.023.563"* como un saldo. La falla 1 nunca estuvo en las filas.
Renombrarlas la arreglaba donde no existía. Y la falla 2 la resuelve el **calificador**, que
un chip hace igual de bien que un label largo, sin costo de ancho ni de vocabulario.

**El chip es condicional.** Solo aparece cuando el mes tuvo consumo en tarjeta — la misma
señal que el puente. Para alguien sin tarjetas, advertir sobre una exclusión que no existe
crea justo la duda que el chip viene a evitar.

**Corolario deliberado:** la otra card conserva `¿En qué gasté este mes?` **sin calificar**,
porque esa sí mide todo lo que gastaste. La asimetría es intencional:

```
   "Gastos" [sin tarjeta]  = la parte que ya salió de tus cuentas
   "¿En qué gasté?"        = todo lo que gastaste, tarjeta incluida
```

### Aviso de ajustes

| Hoy | Propuesta |
|---|---|
| `🔍 ¿En qué se fue esta grana? Los ajustes son plata que se movió sin registrar — registrá esos movimientos y hacelos desaparecer.` | `Un ajuste es la diferencia entre lo que Grana calculó y lo que tenés de verdad. Ajustar seguido mantiene los números honestos.` |

### Cómo queda la card

```
┌─ Entró y salió ─────────────────────────────────────────────┐
│  ¿Cómo se movió mi plata este mes?                          │
│                                                             │
│  DIFERENCIA                                                 │
│  −$2.684.140,02                                             │
│  Gastaste más de lo que entró: la diferencia salió          │
│  de lo que ya tenías.                                       │
│                                                             │
│  ● Ingresos          ████████████       $1.023.563          │
│  ● Gastos            ██████████████     $2.726.350          │
│                      [sin tarjeta]  ← solo si hubo tarjeta  │
│  ───────────────────────────────────────────────────────    │
│  Plata que cambió de lugar                                  │
│  ● Pago de resumen   ████████             $985.201          │
│                      [consumos de meses anteriores]         │
│  ● Cambio de moneda  ██                  −$120.000          │
│  ───────────────────────────────────────────────────────    │
│  ● Ajustes           ▌                     +$3.848          │
│                      [diferencia]                           │
│  Un ajuste es la diferencia entre lo que Grana calculó      │
│  y lo que tenés de verdad. Ajustar seguido mantiene         │
│  los números honestos.                                      │
│  ───────────────────────────────────────────────────────    │
│  💳 Además gastaste $574.580 con tarjeta que todavía        │
│     no salió de tu cuenta.            Ver desglose ›        │
│  ───────────────────────────────────────────────────────    │
│  [USD]  US$0,00        Ingresos US$0 · Gastos US$0          │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. El plan completo

```
PASO 1  ─ Limpieza + hero honesto                        ← ESTE CHANGE
          rótulos que dicen lo que miden
          naturalezas distintas se ven distinto
          los fixes chicos (totalTransfer, negativos)
          → cero features, cero migraciones, cero queries nuevas

PASO 2  ─ Que la app note                                ← explorado, sin proposal
          recalibrar el detector de recurrencias
          → no es módulo nuevo: es un detector que ya existe, mal calibrado

PASO 3  ─ El hero pasa a "te queda libre"                ← bloqueado por el paso 2
          recién cuando el set de compromisos sea real

PASO 4  ─ Sobres y presupuestos                          ← tu módulo de ahorro (ya existió en v2)
          sobre una base que ya significa algo
```

Los pasos 1 y 2 son independientes y pueden ir en paralelo.
**El paso 1 hace visible el hueco; el paso 2 hace que la app ayude a taparlo.**

### Por qué el paso 3 está bloqueado

Querría poner "te queda libre" ya — es el foso convertido en número, y ninguna app
internacional puede armarlo acá. **Los datos lo descartaron:**

```
LO QUE GRANA TIENE CARGADO COMO FIJO      $296.205,48 /mes
LO QUE REALMENTE PAGÁS FIJO             $2.480.435,92 /mes
─────────────────────────────────────────────────────────
COBERTURA                                        11,9%
```

Y del lado que importa para un hero de caja es peor: de esos $296.205, **$211.254 (71%)**
están sobre tarjetas — llegan por resumen, no como obligación de caja separada.

```
Recurrencias sobre cuenta bancaria         $84.950,78 /mes
Costos fijos reales de caja             $2.269.181,22 /mes
─────────────────────────────────────────────────────────
COBERTURA DE CAJA                                 3,7%
```

Poner "te queda libre" hoy daría un número **sobreestimado en $2.184.230** (alquiler + dos
expensas, invisibles). Sería una mentira nueva, más cara que la que estamos arreglando.

### Por qué el paso 2 es más barato de lo que parece

Preguntado por qué no cargaste el alquiler como recurrencia: *"no me di cuenta, o se me pasó…
por nada en particular"*.

No es fricción. No es el modelo — `confirmRecurrenceInstance` ya acepta un monto que pisa el
estimado y **lo propaga de vuelta a la regla**, así que el monto se auto-corrige en cada
confirmación (resuelve el caso argentino: alquiler que ajusta, expensas que cambian todos los
meses). No es motivación — 54 movimientos cargados en dos meses.

**Es que la app nunca te lo pidió.** Y tiene un detector de sugerencias que debería haberlo
hecho. No lo hizo por tres gates, cualquiera de los cuales bastaba solo:

| Gate | Qué hace | Efecto |
|---|---|---|
| **1** | descarta movimientos sin categoría | invisibles para la detección, para siempre |
| **2** | exige 3 ocurrencias | el alquiler lleva 2 (junio, julio) |
| **3** | agrupa por `tipo\|cuenta\|categoría\|moneda`, sin descripción ni monto | obligaciones distintas de la misma categoría se mezclan y sus fechas intercaladas no matchean ninguna frecuencia |

El gate 2 explica por qué hoy no pasó. Los gates 1 y 3 son por qué **puede no pasar tampoco
en agosto**. Y el gate 3 tiene un efecto perverso: **cuantos más gastos fijos tenés en la
misma categoría, peor detecta.**

```
El detector optimiza CONFIANZA EN EL PATRÓN.
El producto necesita que optimice IMPACTO FINANCIERO.

Hoy trata igual a "Almuerzo $8.628 × 2" y a "Alquiler $1.505.723 × 2".
Ambos: descartados por tener solo 2 ocurrencias.

El costo de un falso positivo en el primero es un banner molesto.
El costo de un falso negativo en el segundo es que el número principal sea mentira.
```

---

## 6. Lo que descarté, y por qué

| Descartado | Razón |
|---|---|
| **Hero "te queda libre"** (paso 3) | cobertura de compromisos del 3,7% |
| **Runway** ("te alcanza hasta el 5 de agosto") | derivado de un derivado (quema estimada + fecha de cobro inferida) con dos meses de datos. Elegante, y mala apuesta cuando la confianza es justo el problema |
| **Lista de "lo que se viene" en el Hero** | requiere decidir qué cuenta como comprometido: decisión de producto, no de presentación |
| **Separar gasto fijo de variable** | requiere que lo fijo esté registrado (paso 2). *Con tus números: 2,18M fijo / 434k variable — tu margen real de julio fueron 434k, no 2,6M* |
| **"Apartar plata" como gesto de primera clase** | me equivoqué: leí tus transferencias con descripción como presupuesto por sobres. Son plomería — transferís al banco donde te van a debitar. Y apartar pertenece al módulo de ahorro, que no se monta sobre una base ambigua |

### Tres callejones donde me equivoqué

Los dejo anotados porque las correcciones informan el diseño tanto como los aciertos.

1. **"No usás el módulo de tarjetas"** — inferido de las transferencias con descripción y de
   que las tarjetas no aparecían en un export. Falso: son dos actos distintos en momentos
   distintos, y el export era un join de *transacciones* (solo lista cuentas con movimientos).
   **Realidad:** 7 tarjetas cargadas, 3 pagos de resumen registrados con período real.

2. **"Mercado Pago está en negativo"** — llamé a `get_account_balance_sums` y leí su salida
   como si fuera el saldo. **No lo es:** `saldo = initial_balance (columna) + suma de
   transacciones`, y la RPC devuelve solo la segunda parte. Encima celebré como "prueba" que
   dos cálculos de la misma cantidad coincidieran — una tautología.
   **Realidad:** `initial_balance` = $2.850.000, saldo real `+$315.151,25`. Tenías razón vos.

3. **"Ya estás presupuestando a mano"** — ver arriba.

*Lo que sí quedó validado en el camino: las reglas de signo de la migración 0051 son
correctas. La suma manual de Mercado Pago dio idéntico a la RPC.*

---

## 7. Posicionamiento — ¿hay diferencial?

*(Lectura del rubro, no relevamiento. Si algún dato puntual va a decidir algo, lo verifico.)*

**La limpieza es paridad, no ventaja.** YNAB es fanático del vocabulario ("available", no
"balance"); Monzo tiene "Summary" (*left to spend until payday*, con lo comprometido ya
descontado); Copilot y Monarch invirtieron en que cada card diga qué lente usa. Este change
paga deuda, no compra ventaja. Igual hay que hacerlo.

**El diferencial existe y son tres:**

1. **El modelo de tarjeta de crédito.** Período con dos fechas, consumos que devengan, cuotas
   repartidas a períodos futuros, pago del resumen como acto propio, sellos, deshacer un pago.
   Las apps internacionales tratan la tarjeta como una cuenta más con un saldo — **y no es que
   no puedan: es que las cuotas sin interés casi no existen en EE.UU. o UK.** Acá son *el*
   mecanismo de consumo. Tus datos tienen compromisos de tarjeta hasta **noviembre**.
2. **Bimoneda que no convierte.** Toda app internacional convierte a una moneda base. Para un
   argentino eso es una mentira.
3. **Hogar compartido dentro del mismo ledger**, con deuda derivada por moneda.

**Y el problema: el diferencial está escondido.**

```
INICIO (el lugar principal)          quién más lo tiene
─────────────────────────────        ──────────────────
Hero "Para gastar"                   todos
Balance del mes + barras             todos
Dona de categorías                   todos
Comprometido                         algunos
── tira condicional, chiquita ──
"Gastaste este mes" caja vs tarjeta  ← ACÁ vive el diferencial
```

**El punto estructural.** Las apps grandes del rubro se construyeron sobre agregación bancaria
automática (Plaid, open banking). En Argentina eso no existe. Grana es manual por obligación,
y eso cambia el contrato:

> Si el usuario hace el trabajo de cargar cada movimiento, la app le debe algo que una
> planilla no le puede dar.
>
> Cargaste 54 movimientos en dos meses. Lo que recibiste a cambio fue una dona.

Tu competencia real no es Monarch ni YNAB: es **una planilla, la vista de "Mis finanzas" de
Mercado Pago, o nada**.

---

## 8. Follow-ups fuera de alcance

| # | Hallazgo | Dónde va |
|---|---|---|
| 1 | `initial_balance_date` ignorada por el cálculo de saldo | change propio, capacidad `accounts` |
| 2 | Préstamo recibido contado como `income` | necesita modelo, no rótulo |
| 3 | Períodos fantasma en tarjetas sin consumos | change propio, capacidad `cards` |
| 4 | El aviso de saldo negativo es transaccional, no de estado | ligado al paso 3 |
| 5 | `pnpm openspec:check` no corre en Windows (one-liner POSIX que cae en `cmd.exe`) | chore |

---

## 9. Decisiones abiertas para más adelante

### Paso 2 — detector de recurrencias
- ¿Cuánto tiene que pesar un monto para que 2 ocurrencias alcancen? ¿Umbral absoluto,
  porcentaje del gasto del mes, o percentil del propio ledger?
- ¿Qué separa dos obligaciones distintas dentro de una misma categoría? ¿Descripción, monto,
  día del mes, o una combinación?
- Un movimiento sin categoría: ¿entra con `cat:null` como stream propio, o la app empuja a
  categorizarlo primero?

### Paso 3 — "te queda libre"
- **Qué cuenta como comprometido.** Cuanto más incluís, más útil y más alarmista. Si el
  usuario siente que la app sobre-asigna, deja de creerle.
- **Cuál es el horizonte.** "Hasta que cobres" requiere que la app sepa cuándo cobrás.
  Deducirlo del ledger es ruidoso; la alternativa es preguntarlo en el onboarding.
- **Bimoneda.** ¿El USD participa de "te queda libre"? Probablemente no, pero hay que
  decidirlo.
- **El estado negativo.** El 1 de julio el número habría dado `−$60.140`. Propuesta: que el
  hero cambie de **forma** según el estado, no solo de valor —
  *"Te faltan $60.140 para llegar al 12"* es un **requisito**;
  *"podés gastar −$60.140"* es un veredicto.

---

## Anexo — cómo se llegó a esto

Cuatro rondas de consultas SQL contra el proyecto `exhpnnaigjfcxcvmptxa`, todas read-only:

| Query | Qué respondió |
|---|---|
| Movimientos por mes y tipo | los netos de junio y julio; que el export previo estaba incompleto |
| Cuentas y tarjetas | 7 tarjetas cargadas — descartó "no usa el módulo" |
| Pagos de resumen | 3 pagos registrados con período real |
| Actividad por tarjeta | 4 tarjetas activas, 3 con cero consumos y 2 períodos cada una |
| Saldos por cuenta (RPC 0051) | validó la migración nueva contra suma manual |
| `initial_balance` | $2.850.000 en Mercado Pago — descartó el callejón 2 |
| Recurrencias e instancias | la cobertura del 11,9% que bloquea el paso 3 |
| Consumo de tarjeta por mes | la brecha de $574.580 entre las dos lentes |
