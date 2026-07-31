# Exploration — El Inicio muestra cinco lentes y no elige cuál mirar

> Status: **exploration** (no autoritativo). Capacidad tocada: `dashboard`.
> Fecha: 2026-07-31. Origen: dos meses de uso en producción.
> Datos: cuenta real de `cristian.ap84@gmail.com`, consultada vía SQL editor de Supabase.

## Por qué existe este documento

La queja que originó la exploración fue:

> *"Ya llevamos 2 meses de uso en producción y no nos está llenando como esperábamos.
> Sentimos que la app está compleja al uso. Más que nada en cómo te muestra la
> información. Ejemplo: la card de Balance del mes (...) el usuario tiene el balance
> en negativo y no tiene ninguna de sus cuentas en negativo, ¿cómo se da eso?"*

La respuesta corta a la pregunta puntual es que **la card mide un flujo y se llama como
si midiera un stock**. La respuesta larga —y la que motiva el change— es que ese no es
un problema de una card, sino el síntoma de un patrón que se repite en casi todo el Inicio.

Este documento guarda el razonamiento completo, incluidos **tres callejones donde el
análisis se equivocó**, porque las correcciones informan el diseño tanto como los aciertos.

---

## El diagnóstico

```
Ningún número del Inicio está mal calculado.
Casi todos están mal rotulados.
```

Auditoría de rótulo contra lo que cada número realmente mide:

| Lo que dice en pantalla | Lo que realmente mide | El problema |
|---|---|---|
| **"Para gastar · hoy"** | saldo de cuentas propias (stock) | no es "para gastar"; es lo que tenés |
| **"Balance del mes"** + label **"Balance"** | flujo neto de caja del mes | "balance" es stock, esto es flujo |
| **"Gastos"** (dentro de Balance) | gasto de caja, **sin** tarjeta | no son todos tus gastos |
| **"¿En qué gasté este mes?"** | gasto devengado, **con** tarjeta | sí son todos — y por eso difiere del anterior |
| **"Pago de tarjeta"** | caja de este mes por consumos de meses **anteriores** | no dice de cuándo son |
| **"Comprometido"** | obligaciones futuras | este rótulo está bien |

Cinco de seis rótulos mienten sobre lo que hay debajo. No por descuido: **cada uno fue
nombrado desde la lógica que lo calcula, no desde la pregunta que el usuario trae.**

### La demostración con datos reales — julio 2026

Cinco montos en la misma pantalla, todos hablando de plata, ninguno igual a otro,
ninguno equivocado:

| Monto | Qué es |
|---|---|
| `$425.151,40` | Hero "Para gastar · hoy" — stock, hoy |
| `−$2.684.140,02` | Balance del mes — flujo de caja de julio |
| `$2.726.350,40` | Balance del mes → "Gastos" — caja, **sin** tarjeta |
| `$985.201,62` | Balance del mes → "Pago de tarjeta" — caja de julio por consumos de mayo/junio |
| `$3.300.931,03` | "¿En qué gasté" — devengado, **con** tarjeta (incluye `pending`) |

La brecha entre las dos cards que dicen "gasto" es de **$574.580,63 (+21%)** y no hay
nada en pantalla que la explique. La spec `dashboard` declara la divergencia como
intencional (*"son lentes distintas a propósito (...) el rótulo de la pregunta de cada
card comunica que miran cosas distintas"*), pero esos rótulos viven en 12,5px gris debajo
de títulos de 18px. Se le está pidiendo a una línea de texto secundario que sostenga sola
una distinción contable que no es intuitiva ni para un contador.

**Prueba del problema:** el autor de la spec abrió esta conversación preguntando qué
muestra la card de Balance.

### El dato que ninguna card dice

```
17-jun ──────────────────────────────────────▶ 31-jul
$2.850.000                                    $425.151,40

██████████████████████████████████████░░░░░░░░
quemó $2.424.848,60  =  85% de su plata disponible en 6 semanas
```

| Mes | Neto de caja |
|---|---|
| junio 2026 | `+$259.291,42` |
| julio 2026 | `−$2.684.140,02` |

Todo eso está en los datos, correctamente registrado. El Hero muestra `$425.151,40` en
blanco tranquilo sobre navy. La card de Balance muestra `−$2.684.140,02`. Las dos son
correctas. **Ninguna dice "te queda el 15% de lo que tenías hace seis semanas"** — la
única frase de esa pantalla que habría provocado una reacción.

### Por qué se siente "compleja"

La complejidad no está en la cantidad de datos: está en que la app **delega en el usuario
la decisión contable de qué número aplica a qué pregunta**. Eso es trabajo de la app.

```
MODO CHEQUEO                      MODO REVISIÓN
~90% de las aperturas             ~10%
dura 4 segundos                   dura 3 minutos
parado, antes de gastar           sentado, con tiempo
"¿puedo?"                         "¿cómo vengo?"
necesita UN número y respuesta    tolera densidad y desglose
```

El Inicio está diseñado 100% para **revisión**: seis bloques, cinco montos, dona, barras
proporcionales. **No existe ninguna superficie de chequeo.** Es una app que se abre veinte
veces por mes, diseñada para la única vez que uno se sienta a revisar.

---

## Hallazgos verificados (además del rótulo)

### En la card "Balance del mes"

1. **Siete baldes de naturaleza distinta con tratamiento visual idéntico.** Ingresos,
   Gastos, Pago de tarjeta, Liquidaciones, Cambio de moneda, Reintegros y Ajustes usan
   todos el mismo `FlowRow` (`month-balance-section.tsx:48-87`): mismo dot, misma barra,
   mismo peso. Visualmente la card afirma que son lo mismo. Contablemente son tres
   naturalezas distintas:
   - **flujo real** — Ingresos, Gastos (plata que entró o salió del patrimonio)
   - **movimiento interno** — Pago de tarjeta, Cambio de moneda, Liquidaciones
     (plata que cambió de lugar o canceló deuda ya devengada; no se "perdió")
   - **corrección de stock** — Ajustes

   Consecuencia concreta: comprar dólares hunde el neto ARS y lo pinta de `text-expense`,
   mientras la tira USD suma en 17px. La app felicita en chico y reta en grande, por ahorrar.

2. **`totalTransfer` mueve `finalBalance` y no renderiza fila.** Agregado por la
   migración 0051 (`fix-balance-read-path-defects`, 2026-07-30). La spec lo justifica
   porque vale cero en el caso normal, pero la card **ya tiene** el patrón de filas
   condicionales (`.filter((row) => row.amount !== 0)`, `month-balance-section.tsx:121`)
   usado por Ajustes, Pago de tarjeta, Liquidaciones y Cambio de moneda. `totalTransfer`
   es el único balde excluido de ese patrón, y por lo tanto el único caso donde el neto
   no se explica con lo que se ve. El residuo sin explicación no desapareció: se mudó del
   código a los ojos del usuario.

3. **El aviso de ajustes está encuadrado como reproche.** `dashboard.month.adjustment_note`
   dice *"los ajustes son plata que se movió sin registrar — registralos y **hacelos
   desaparecer**"*. El ajuste es el mecanismo de reconciliación de la app; presentarlo
   como una falta desincentiva exactamente la conducta que mantiene honestos los datos.

### Fuera de la card

4. **Ninguna superficie de saldo distingue un negativo.** `hero-section.tsx:32-34` no
   tiene una sola condicional — ni `cn()`, ni ternario, ni `< 0`. `−$2.424.848,60` se
   renderiza en el mismo blanco, peso y tamaño que `$5.000.000`. Lo mismo en
   `accounts-card.tsx` y en `accounts/_components/`. El único aviso que existe es
   **transaccional** (`balance.ts:348`, *"Esta operación deja el disponible en negativo"*):
   salta una vez al registrar, no bloquea, y después silencio permanente. No hay aviso
   **de estado**.

5. **`initial_balance_date` se guarda y ningún cálculo la respeta.** Se escribe en
   `mutations.ts:79` (= `today` al crear la cuenta) y solo se usa como fecha de display de
   una fila sintética en el detalle de cuenta (`movement-list-account-container.tsx:170`).
   El saldo es `initial_balance + suma de TODAS las transacciones`, sin filtrar por fecha.

   En los datos reales: Mercado Pago tiene `initial_balance_date = 2026-06-17` y
   `+$2.344.571,85` de movimientos **anteriores** a esa fecha. Como la fila sintética se
   inyecta con esa fecha y la lista se ordena por fecha, en el detalle de cuenta aparece
   *"Saldo inicial · 17 jun · $2.850.000"* **después** de 16 días de movimientos, mostrando
   siempre `initial` (`snapshots.set(..., initial)`) y contradiciendo la columna de saldo
   que tiene al lado.

   El gap muerde a **todo usuario que carga movimientos retroactivos al arrancar**, que
   es el caso normal.

6. **Un préstamo recibido se registra como `income`.** En los datos: `2026-07-30,
   income, $330.000, "Prestamo Stella Maris"`. De los $1.023.563,90 de "Ingresos" de julio,
   un tercio es plata que hay que devolver. Sube el neto y se pinta de verde. No existe un
   tipo de movimiento para "plata que entró y tiene dueño".

7. **Tres tarjetas sin un solo consumo tienen dos períodos generados cada una**
   (Amex Santander, Mastercard ICBC, Visa ICBC). Seis períodos fantasma.

---

## Los tres callejones — dónde el análisis se equivocó

Valen tanto como los hallazgos: cada error revela una trampa real del sistema.

### Callejón 1 — "no usa el módulo de tarjetas"

**La inferencia:** las transferencias de julio con descripciones *"Para pago - Visa
Galicia"*, *"Para pago - Mastercard Galicia"* sugerían que el usuario esquivaba el flujo
de pago de resumen. Reforzado por que esas tarjetas no aparecían en el export de
movimientos.

**Por qué era falsa:** transferir al banco donde se va a debitar el resumen y registrar
el pago del resumen son **dos actos distintos en dos momentos distintos**, y Grana los
modela bien así. Y el export era un join de *transacciones* con cuentas: solo lista
cuentas con movimientos en la ventana. Ausencia de evidencia, no evidencia de ausencia.

**La realidad:** 7 tarjetas cargadas, 3 pagos de resumen registrados en julio con período
real (`is_estimated = false`). El módulo se usa, y bien.

### Callejón 2 — "Mercado Pago está en negativo / el saldo inicial nunca se cargó"

**El error:** se llamó a `get_account_balance_sums` (RPC de la migración 0051) desde el
SQL editor y se leyó su salida como si fuera el saldo. **No lo es.**

```
saldo real = account_currencies.initial_balance  +  suma de transacciones
             └──── columna, la RPC NO la incluye ────┘  └── esto devuelve la RPC ──┘
```

Quien arma el saldo es `packages/accounts/src/queries.ts:127` (`addMoneyAmounts(
initial_balance, txSums)`) y `getDashboardHero`, que traen `initial_balance` aparte.

**Agravante:** se celebró como "smoking gun" que la suma de transacciones coincidiera
exactamente con la salida de la RPC. Es una **tautología** — la misma cantidad calculada
dos veces. No probaba nada sobre saldos iniciales.

**Lo que sí quedó validado:** las reglas de signo de la RPC nueva son correctas. La suma
manual de Mercado Pago dio idéntico a la RPC ($−2.534.848,75). La migración 0051 funciona.

**La realidad:** `initial_balance` de Mercado Pago = `$2.850.000`. Saldo real
`+$315.151,25`. Ninguna cuenta en negativo. La premisa original del usuario era correcta.

→ Registrado como memoria permanente para que no vuelva a pasar.

### Callejón 3 — "el usuario ya está presupuestando a mano"

**La inferencia:** las transferencias con descripción (*"Para pago - Visa Galicia"*) se
leyeron como presupuesto por sobres hecho a mano, y se propuso convertir "apartar plata"
en un gesto de primera clase.

**Por qué era falsa:** son plomería, no intención. Uno transfiere al banco donde le van a
debitar. No hay decisión de presupuesto ahí, hay logística.

**Y era fuera de alcance:** "apartar plata" pertenece a un módulo de ahorro con sobres
—que ya existió en versiones anteriores de Grana— que no se puede montar sobre una capa
base ambigua. Montar sobres encima de un "disponible" que no significa nada da sobres que
tampoco significan nada.

**La regla que sale de acá:** *primero que el número sea verdad; después que sea útil.*

---

## Qué se gana el lugar principal — la discusión

Criterios acordados para que un número se gane el hero:

1. Responde en 4 segundos (modo chequeo)
2. Es verdad sin asteriscos
3. Usa el foso, o al menos no lo desperdicia
4. No depende del módulo de ahorro
5. Sobrevive al mes malo

| Candidato | 4seg | verdad | foso | hoy | mes malo |
|---|---|---|---|---|---|
| **A** ¿Cuánto tengo? (saldo) | ✅ | ✅ | ❌ | ✅ | ✅ |
| **B** ¿Cuánto ya tiene dueño? (disponible − comprometido) | ✅ | ⚠️ | ✅✅ | ✅ | ❌ |
| **C** ¿Hasta cuándo llego? (runway) | ✅✅ | ⚠️⚠️ | 🟡 | ✅ | ✅ |
| **D** ¿Qué se viene? (calendario) | ❌ | ✅✅ | ✅✅✅ | ✅ | ✅ |

**B era el favorito** — es el foso convertido en número, y ninguna app internacional
puede armarlo acá. **Los datos lo descartaron para esta iteración:**

```
LO QUE GRANA TIENE CARGADO COMO FIJO      $296.205,48 /mes
LO QUE EL USUARIO REALMENTE PAGA FIJO   $2.480.435,92 /mes
─────────────────────────────────────────────────────────
COBERTURA                                        11,9%
```

Y del lado que importa para un hero de caja es peor: de esos $296.205, **$211.254 (71%)
están sobre tarjetas** — llegan por resumen, no como obligación de caja separada.

```
Recurrencias sobre cuenta bancaria         $84.950,78 /mes
Costos fijos reales de caja             $2.269.181,22 /mes
─────────────────────────────────────────────────────────
COBERTURA DE CAJA                                 3,7%
```

Poner "te queda libre" hoy daría un número **sobreestimado en $2.184.230** (alquiler +
dos expensas, invisibles). Sería una mentira nueva, más cara que la que este change viene
a arreglar.

**Decisión: gana A** (saldo honesto), con la utilidad recuperándose en el change siguiente.

### Por qué el usuario no cargó el alquiler

Preguntado directamente: *"no me di cuenta, o se me pasó… por nada en particular"*.

No es fricción (no dijo "es pesado"). No es el modelo (ver abajo). No es motivación
(54 movimientos cargados en dos meses, con descripción, cuenta correcta, pagos de resumen
atados a su período, y hasta un ajuste de $3.848,10).

**Es que la app nunca se lo pidió.**

```
El usuario más motivado que esta app va a tener —el que la construyó— no cargó
su gasto fijo más grande porque la app nunca creó el momento de pedírselo.
```

Y hay un huevo-y-gallina: el valor de tener el alquiler cargado no es el recordatorio (nadie
se olvida del alquiler) — es que **hace verdadero al "te queda libre"**. Pero ese valor
todavía no existe, porque la feature que lo consumiría es la que no se puede construir sin
el dato.

### El motor de recurrencias soporta monto variable (y no lo sabíamos)

`confirmRecurrenceInstance` acepta un `payload.amount` que pisa el estimado
(`packages/recurrences/src/mutations.ts:312`) y **lo propaga de vuelta a la regla**
(`:399-403`). El monto se auto-corrige en cada confirmación. Es un buen diseño y resuelve
el caso argentino (alquiler que ajusta, expensas que cambian todos los meses).

El problema no es el modelo. Es que la app no avisa.

### Por qué el detector de sugerencias no lo detectó — tres gates

`packages/money-logic/src/recurrences.ts` → `detectRecurrenceSuggestions()`

| Gate | Línea | Qué hace | Efecto |
|---|---|---|---|
| **1** | 411 | `if (type !== 'transfer' && !category_id) continue` | un movimiento **sin categoría** se descarta antes de entrar a ningún stream |
| **2** | 425 | `if (bucket.length < 3) continue` | necesita **3 ocurrencias**; el alquiler lleva 2 (junio, julio) |
| **3** | 313-318 | `streamKey = type \| account_id \| category_id \| currency_code` | **ni descripción ni monto**: obligaciones distintas de la misma categoría caen en un solo stream y sus fechas intercaladas producen gaps que no matchean ninguna banda |

El Gate 2 explica por qué hoy no pasó. Los Gates 1 y 3 son por qué **puede no pasar
tampoco en agosto**.

El Gate 3 tiene un efecto perverso: **cuantos más gastos fijos hay en la misma categoría,
peor detecta.** Y si llegara a detectar algo de un stream mezclado, el monto sale de
`median()` sobre todos y la descripción de `latest.description` — sugeriría un
Frankenstein que no existe.

**El diagnóstico del detector:**

```
El detector optimiza CONFIANZA EN EL PATRÓN.
El producto necesita que optimice IMPACTO FINANCIERO.

Hoy trata igual a "Almuerzo Ayacucho $8.628 × 2" y a "Alquiler $1.505.723 × 2".
Ambos: descartados por tener solo 2 ocurrencias.

El costo de un falso positivo en el primero es un banner molesto.
El costo de un falso negativo en el segundo es que el número principal sea mentira.
```

---

## Posicionamiento — ¿hay diferencial?

*(Lectura del rubro, no relevamiento. Verificar antes de decidir sobre datos puntuales.)*

**La limpieza es paridad, no ventaja.** YNAB es fanático del vocabulario ("available", no
"balance"); Monzo tiene "Summary" (*left to spend until payday*, con lo comprometido ya
descontado); Copilot/Monarch invirtieron en que cada card diga qué lente usa. Este change
paga deuda, no compra ventaja. Igual hay que hacerlo: no se construye sobre rótulos que mienten.

**El diferencial existe y son tres:**

1. **El modelo de tarjeta de crédito.** Período con dos fechas, consumos que devengan,
   cuotas repartidas a períodos futuros, pago del resumen como acto propio, impuesto de
   sellos, deshacer un pago. Las apps internacionales tratan la tarjeta como una cuenta más
   con un saldo — y no es que no puedan: es que **las cuotas sin interés casi no existen
   en EE.UU. o UK**. Acá son *el* mecanismo de consumo. En los datos reales hay
   compromisos de tarjeta hasta **noviembre**.
2. **Bimoneda que no convierte.** *"ARS y USD nunca se combinan ni convierten"*. Toda app
   internacional convierte a una moneda base. Para un argentino eso es una mentira.
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

El mejor espacio está dedicado a competir donde no se puede ganar.

**El punto estructural:** las apps grandes del rubro se construyeron sobre agregación
bancaria automática (Plaid, open banking). En Argentina eso no existe. Grana es manual por
obligación, no por elección — y eso cambia el contrato:

```
Si el usuario hace el trabajo de cargar cada movimiento, la app le debe algo que
una planilla no le puede dar.

Cargó 54 movimientos en dos meses. Lo que recibió a cambio fue una dona.
```

La competencia real no es Monarch ni YNAB: es **una planilla, la vista de "Mis finanzas"
de Mercado Pago, o nada**.

---

## El plan en cuatro pasos

```
PASO 1  ─ Limpieza + hero honesto                        ← ESTE CHANGE
          rótulos que dicen lo que miden
          naturalezas distintas se ven distinto
          los fixes chicos (totalTransfer, negativos)
          → cero features nuevas, cero migraciones, cero queries nuevas

PASO 2  ─ Que la app note                                ← explorado, sin proposal
          gate 1: sin categoría no puede ser invisible
          gate 2: 2 ocurrencias bastan cuando el monto pesa
          gate 3: separar obligaciones distintas dentro de una categoría
          → no es módulo nuevo: es un detector que ya existe, mal calibrado

PASO 3  ─ El hero pasa a "te queda libre" (candidato B)  ← bloqueado por el paso 2
          recién cuando el set de compromisos es real

PASO 4  ─ Sobres y presupuestos                          ← módulo de ahorro, ya existió en v2
          sobre una base que ya significa algo
```

Los pasos 1 y 2 son independientes y pueden ir en paralelo. **El paso 1 hace visible el
hueco; el paso 2 hace que la app ayude a taparlo.**

### Decisiones abiertas del paso 2 (para tomar con los números adelante)

- ¿Cuánto tiene que pesar un monto para que 2 ocurrencias alcancen para sugerir?
  ¿Umbral absoluto, porcentaje del gasto del mes, o percentil del propio ledger?
- ¿Qué separa dos obligaciones distintas dentro de una misma categoría? ¿Similitud de
  descripción, magnitud de monto, día del mes, o una combinación?
- Un movimiento sin categoría: ¿entra a la detección con `cat:null` como stream propio,
  o la app empuja a categorizarlo primero?

### Decisiones abiertas del paso 3

- **Qué cuenta como "comprometido".** Resúmenes con vencimiento en el horizonte, seguro.
  ¿Recurrencias sin confirmar? ¿Cuotas de meses futuros, ya decididas pero no vencidas?
  Cuanto más se incluye, más útil y más alarmista — y si el usuario siente que la app le
  sobre-asigna, deja de creerle.
- **Cuál es el horizonte.** "Hasta que cobres" es lo natural pero requiere que la app sepa
  cuándo se cobra. Deducirlo del ledger es ruidoso (junio: un ingreso el día 1; julio:
  cuatro, uno de ellos un préstamo). La alternativa es preguntarlo en el onboarding.
- **Bimoneda.** Si el hero pasa a "te queda libre", ¿el USD participa? Probablemente no
  —los dólares no son plata de gastar— pero hay que decidirlo explícitamente.
- **El estado negativo.** El 1 de julio el candidato B habría dado `−$60.140`. Un número
  que no se puede gastar, en rojo, arriba de todo, es desmoralizante y frecuente justo en
  quien más lo necesita. La salida propuesta es que el hero cambie de **forma** según el
  estado, no solo de valor: *"Te faltan $60.140 para llegar al 12"* es un **requisito**;
  *"podés gastar −$60.140"* es un veredicto.

## Follow-ups fuera de alcance de este change

| # | Hallazgo | Dónde va |
|---|---|---|
| 1 | `initial_balance_date` ignorada por el cálculo de saldo | change propio, capacidad `accounts` |
| 2 | Préstamo recibido contado como `income` | necesita modelo, no rótulo |
| 3 | Períodos fantasma en tarjetas sin consumos | change propio, capacidad `cards` |
| 4 | El aviso de saldo negativo es transaccional, no de estado | ligado al paso 3 |
