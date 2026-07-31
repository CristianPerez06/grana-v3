# Diseño — Clarificar las lentes del Inicio

## Principio

> **El rótulo tiene que sostener la verdad solo.** Si el título miente y el subtítulo
> aclara, el usuario ya se fue con la lectura equivocada — nadie lee el 12,5px gris.

Corolario operativo: cada monto del Inicio comunica **qué mide** y **qué no incluye** en
el mismo nivel jerárquico en el que se lee el número.

---

## 1. Decisiones de copy — PENDIENTES DE APROBACIÓN

Los strings concretos son decisión de producto. Estas son propuestas con su razón; el
requirement en `specs/dashboard/spec.md` fija **qué debe comunicar** cada rótulo, no las
palabras exactas, para que cambiarlas después no requiera tocar la spec.

### Hero

| | Hoy | Propuesta |
|---|---|---|
| eyebrow | `Para gastar · hoy` | `En tus cuentas · hoy` |
| pregunta | `¿Cuánto tengo?` | *(sin cambio — ya es correcta)* |
| caption | `Lo que tenés disponible hoy, en pesos y dólares.` | `La suma de tus cuentas de efectivo y banco. No descuenta lo que ya está comprometido.` |

**Por qué.** "Para gastar" promete gastabilidad que el número no tiene: el 1 de julio de
2026 el Hero habría mostrado ~$3.109.291 cuando el 100% ya estaba asignado a alquiler,
expensas y resúmenes con vencimiento antes del día 13 — la plata realmente libre era
`−$60.140`. "En tus cuentas" es literal y no promete nada.

La segunda oración del caption es la pieza importante: **la app declarando su propio
límite**. No finge tener el cuadro completo, y prepara el terreno para que el paso 3
("te queda libre") se lea como una mejora y no como una corrección.

### "Balance del mes"

| | Hoy | Propuesta |
|---|---|---|
| título | `Balance del mes` | `Entró y salió` |
| pregunta | `¿Cómo se movió mi plata este mes?` | *(sin cambio — ya es correcta)* |
| label del número | `Balance` | `Diferencia del mes` |
| lectura (nueva) | — | positivo: `Entró más de lo que gastaste: la diferencia quedó en tus cuentas.` <br> negativo: `Gastaste más de lo que entró: la diferencia salió de lo que ya tenías.` |

**Por qué.** "Balance", en las dos apariciones, es vocabulario de stock sobre un número de
flujo. El subtítulo actual ya describe correctamente un flujo — la propuesta es
**promoverlo**: que el título haga el trabajo y la pregunta quede como refuerzo.

La línea de lectura es lo que convierte el número en una respuesta. **Responde
literalmente la pregunta que originó esta exploración** ("¿cómo puede estar en negativo si
ninguna cuenta lo está?") en el mismo lugar donde surge la duda. No repite el monto: lo
interpreta.

### Filas de flujo

| | Hoy | Propuesta |
|---|---|---|
| Gastos | `Gastos` | `Gastos` + chip `sin tarjeta` |
| Pago de tarjeta | `Pago de tarjeta` | `Pago de resumen` + chip `consumos de meses anteriores` |
| Transferencias (nueva) | *(no se renderiza)* | `Transferencias` + chip `fuera de tus cuentas activas` |
| Ajustes | `Ajustes` + chip `Sin registrar` | `Ajustes` + chip `diferencia` |

El chip ya existe como patrón (`month-balance-section.tsx:66-71`, hoy solo en Ajustes).
Se generaliza: **es el lugar donde cada fila declara su asterisco**, al lado del label y no
en un pie de card.

### Aviso de ajustes

| Hoy | Propuesta |
|---|---|
| `🔍 ¿En qué se fue esta grana? Los ajustes son plata que se movió sin registrar — registrá esos movimientos y hacelos desaparecer.` | `Un ajuste es la diferencia entre lo que Grana calculó y lo que tenés de verdad. Ajustar seguido mantiene los números honestos.` |

**Por qué.** El ajuste es el mecanismo de reconciliación de la app. El copy actual lo
presenta como una falta a eliminar, desincentivando la única conducta que mantiene el
ledger sincronizado con la realidad. En los datos reales: dos meses de uso, un solo ajuste
de $3.848,10 — el usuario conoce la herramienta y la usó para lo chico.

### Hero en negativo (estado nuevo)

| | Propuesta |
|---|---|
| tono | el monto deja el blanco liso; tono de alerta legible sobre `bg-surface-dark` |
| línea | `Tus cuentas suman en contra. Puede que falte registrar algún ingreso.` |

**Por qué.** `hero-section.tsx:32-34` no tiene una sola condicional: `−$2.424.848,60` se
renderiza en el mismo blanco, peso y tamaño que `$5.000.000`. La única diferencia entre
"estás bárbaro" y "esto es imposible" es un guion de tres píxeles. Y el copy **invita a
corregir** en vez de acusar: un disponible negativo sostenido casi siempre significa que
falta registrar algo, no que la persona esté en descubierto.

> ⚠️ El hero tiene fondo navy (`bg-surface-dark text-white`). `text-expense` puede no
> tener contraste suficiente ahí. Definir el tono contra el token que corresponda y
> verificar contraste; no reusar el de las cards claras sin chequear.

---

## 2. Agrupar por naturaleza, no listar por balde

Hoy los siete baldes usan el mismo `FlowRow`: mismo dot, misma barra, mismo peso
tipográfico. La card afirma visualmente que Ingresos, Cambio de moneda y Ajustes son la
misma clase de cosa. No lo son.

```
┌─ Entró y salió ─────────────────────────────────────────────┐
│  ¿Cómo se movió mi plata este mes?                          │
│                                                             │
│  DIFERENCIA DEL MES                                         │
│  −$2.684.140,02                                             │
│  Gastaste más de lo que entró: la diferencia salió          │
│  de lo que ya tenías.                                       │
│                                                             │
│  ● Ingresos          ████████████       $1.023.563          │
│  ● Gastos            ██████████████     $2.726.350          │
│                                        [sin tarjeta]        │
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

**Tres naturalezas:**

| Grupo | Baldes | Qué significa |
|---|---|---|
| **flujo real** *(sin subhead: es el default)* | Ingresos, Gastos | plata que entró o salió de tu patrimonio |
| **movimiento interno** — subhead `Plata que cambió de lugar` | Pago de resumen, Cambio de moneda, Liquidaciones, Transferencias | cambió de lugar o canceló deuda ya devengada; **no se perdió** |
| **corrección de stock** | Ajustes | no es flujo: es la app admitiendo una diferencia |

El subhead del segundo grupo es la pieza de mayor valor. Resuelve el caso perverso
detectado en la exploración: **comprar dólares hunde el neto ARS y lo pinta de
`text-expense`** mientras la tira USD suma en 17px. La app felicita en chico y reta en
grande, por ahorrar. Con el agrupamiento, el usuario ve que ese monto está en la sección
de "no se perdió".

Las reglas existentes se preservan: los grupos 2 y 3 mantienen el patrón de **fila
condicional** (`.filter((row) => row.amount !== 0)`), los anchos siguen derivándose de
`maxFlow` sobre las filas presentes, y los baldes signados siguen mostrando su signo.

---

## 3. El puente entre lentes: mover, no escribir

`SpentThisMonthSection` **ya calcula exactamente el puente** y lo hace bien:

```ts
const cash     = balanceQuery.data?.ARS.totalExpense ?? 0   // "Gastos" de esta card
const accrued  = (breakdownQuery.data?.ARS ?? []).reduce(...) // total de "¿En qué gasté?"
const financed = accrued - cash                              // lo que la card no ve
if (financed <= 0) return null
```

Reusa las **mismas query keys** que las otras dos secciones, así que TanStack dedupe y no
hay fetch extra. Es correcto, es gratis, y renderiza como card independiente **entre las
dos cards que reconcilia**.

**Decisión: relocalizar ese bloque al pie de "Entró y salió"**, como cierre de la card
—donde nace la duda— en vez de como card hermana. La card que dice "Gastos $2.726.350"
pasa a admitir en el mismo lugar que hay $574.580 que no está contando, y ofrece el paso
a la otra lente.

Consecuencias:
- Se elimina la card suelta `SpentThisMonthSection` del stack del Inicio (un bloque menos
  compitiendo por atención, sin perder información).
- El copy `dashboard.spent.caption` se adapta al nuevo contexto (ya no es el título de una
  card, es el cierre de otra).
- **Alternativa considerada y descartada:** duplicar la mención en las dos cards. Se
  descartó porque el usuario no está en "¿En qué gasté?" preguntándose por qué el número
  es *más grande* — la confusión nace en la card de caja, viendo un número más chico de lo
  que gastó.

> **Cleanup adjunto:** `dashboard.month.financed_on_card` es una clave i18n **huérfana**
> (grep sin resultados fuera de `es.json`) — remanente de una iteración anterior de este
> mismo puente. Se elimina en este change.

---

## 4. Lo que este change NO hace, y por qué

| No se hace | Por qué |
|---|---|
| Hero "te queda libre" (candidato B) | el set de compromisos cubre el **3,7%** de los costos fijos de caja reales. Ver `exploration.md` |
| Runway / "hasta cuándo llego" | derivado de un derivado (quema estimada + fecha de cobro inferida) con dos meses de datos. Mala apuesta cuando la confianza es el problema |
| Lista de "lo que se viene" en el Hero | necesita decidir qué cuenta como comprometido — decisión de producto, no de presentación |
| Separar gasto fijo de variable | requiere que lo fijo esté registrado (paso 2) |
| Calibrado del detector de recurrencias | change propio; los umbrales son decisión de producto |
| `initial_balance_date` | capacidad `accounts`, no `dashboard` |
| Préstamo recibido como `income` | necesita modelo nuevo, no rótulo |
| `apps/mobile` | lo lleva el tech lead; esta capa es web |

---

## 5. Riesgo asumido explícitamente

Este change deja el Hero **más honesto y menos accionable**. Hoy miente y responde una
pregunta; después dice la verdad y no responde ninguna.

Es deliberado, y el orden importa: los sobres y presupuestos del paso 4 solo funcionan
encima de un disponible que significa algo. **Primero que el número sea verdad; después
que sea útil.**

El hueco es visible y temporal — lo llena el paso 3, y el caption del Hero ya lo nombra
("No descuenta lo que ya está comprometido") para que el usuario sepa que la app conoce
su propia limitación en vez de descubrirla él.
