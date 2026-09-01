# Design: committed-outlook-follows-month

## Contexto

La card de compromisos nació forward-looking y anclada a hoy, y eso quedó explícito en dos lugares: el comentario de `committed-section-container.tsx` ("fixed relative to today, so it ... does NOT follow the month navigator") y el design de `cut-month-lenses-at-today`, que la dejó fuera de scope ("es forward-looking por diseño — mirar justamente lo que todavía no pasó. El corte la vaciaría de sentido").

Nada de eso era falso. Lo que faltaba era que el punto de observación se pudiera mover. Este change no convierte la card en retrospectiva: mantiene la pregunta ("¿qué se viene?") y mueve el lugar desde donde se pregunta.

## Decisión 1 — La ventana es el mes siguiente al SELECCIONADO, no al mes en curso

Se evaluaron tres modelos:

| | Ventana | Problema |
|---|---|---|
| **A** | mes seleccionado **+1** | el offset de un mes hay que rotularlo bien |
| **B** | el mes seleccionado mismo | en el mes en curso mezcla lo ya pagado con lo que falta |
| **B'** | mes seleccionado, cortado en hoy | ídem, y se pisa con "Te queda por pagar" de la card vecina |

Se elige **A**, y el argumento decisivo no es de copy sino de **contigüidad**: la card de saldo corta en el último día del mes seleccionado (`balanceCutISO`) y la ventana de compromisos abre al día siguiente. En toda posición del navegador los dos números de la pantalla son **disjuntos y contiguos**: sin solape y sin hueco.

| Parado en | Saldo corta en | Ventana |
|---|---|---|
| mes actual | hoy | 1º al último día del mes siguiente |
| agosto | 31/8 | 1/9 – 30/9 |
| junio | 30/6 | 1/7 – 31/7 |

Bajo B, en el mes en curso, los resúmenes ya pagados **ya salieron del saldo**: la card diría "comprometido $X" al lado de un saldo del que parte de $X ya se descontó. Los dos números dejan de ser comparables justo en la vista donde aterriza el 90% de las sesiones.

Efecto lateral bienvenido: A **cierra el KNOWN GAP** que hoy documenta `queries.ts` (un resumen que vence más adelante este mismo mes no cae en ninguna ventana). Navegando al mes anterior, esa ventana aparece.

## Decisión 2 — `anchor` y `today` son dos parámetros, no uno

Hoy `getCommittedOutlook(supabase, todayISO)` usa un solo argumento para dos preguntas: **qué mes es la ventana** y **cuándo es ahora**. Coinciden por accidente de que la card siempre miraba desde hoy.

La tentación barata era pasarle un `todayISO` del pasado. Está mal: daría una ventana de julio con impagos evaluados a septiembre — un híbrido que no es ninguna de las dos lecturas.

```ts
getCommittedOutlookForMonth(supabase, { year, month, todayISO })

snapshotDate = esMesActual(year, month) ? todayISO : últimoDía(year, month)
window       = [1º, último día] del mes siguiente a (year, month)
mode         = window.end < todayISO ? 'past' : 'current'
```

`{ year, month }` y no una fecha ISO: el dashboard piensa en `DashboardMonth`, y ya hay precedente en `getMonthBalanceSeries(supabase, year, month)`. Una fecha que significa "el mes de esa fecha" es la misma ambigüedad que estamos sacando.

## Decisión 3 — El pago deja de ser un filtro y pasa a ser un atributo

Es la decisión que resuelve "¿y cuando lo que era próximo mes ya está pago?".

- **Ventana `current`**: la pregunta es *"¿cuánto me va a salir?"*. Lo ya pagado no va a salir → se filtra. Sin cambios.
- **Ventana `past`**: la pregunta es *"¿qué tenía que pagar ese mes?"*. Que lo hayas pagado después es el desenlace, no cambia el compromiso → **entra igual**.

La propiedad que valida el modelo: **el número de un mes pasado queda estable**. No cambia porque pagues algo hoy. Con la regla actual, la foto de julio iría encogiendo a medida que se paga — una foto que cambia cuando la mirás no es una foto.

Con la query actual una ventana pasada da **todo cero**, y por cuatro razones acumuladas, no una:

| Dónde | Qué hace | En ventana pasada |
|---|---|---|
| `queries.ts` `unpaid = candidatos − pagados` | filtra por estado de hoy | el resumen pagado ni entra al read |
| `aggregations.ts` `aggregateCardDebt` | suma sólo `status === 'pending'` | `pay-card-period.ts` dejó los consumos en `'paid'` → 0 |
| `queries.ts` instancias `.eq('status','pending')` | sólo pendientes | en julio ya están resueltas → 0 |
| `recurrences.ts` `projectRuleOccurrences` | `cursor: last_generated_date` | el cursor ya pasó la ventana → 0 |

La causa raíz es una sola: **toda la query está escrita en lente DEUDA ("qué me falta pagar") y una ventana pasada necesita lente COMPROMISO ("qué había que pagar")**.

## Decisión 4 — Sólo dos predicados as-of sobreviven, y se puede demostrar cuáles

Bajo A, `snapshotDate < window.start` **por construcción** (el snapshot es el último día del mes seleccionado; la ventana abre al día siguiente). De ahí sale una regla general que evita discutir predicado por predicado:

> **Todo predicado as-of sobre eventos que ocurren en o después de la apertura de la ventana es inerte. Sólo sobreviven los predicados sobre eventos anteriores a la ventana.**

Aplicada:

- `resolved_at > snapshotDate` sobre `recurrence_instances` — **inerte**. El único insert de instancias es el generador (`recurrences/src/queries.ts`), gateado por `decideRecurrenceInstance`, que devuelve `not_due` si `nextDate > today`. Entonces no existe instancia con `scheduled_date` futuro, de donde `resolved_at ≥ created_at ≥ scheduled_date ≥ window.start > snapshotDate`, siempre.
- `due_date < snapshotDate` para "vencido" — **inerte**, por el mismo motivo: los `due_date` de la ventana son todos posteriores al snapshot.
- **Pago anticipado de un resumen** — **sobrevive**. `pay-card-period.ts` sólo exige que el período esté `closed` u `overdue` (`today > end_date`); **no** exige que haya vencido. Un resumen que cierra el 20/6 y vence el 5/7, pagado el 25/6, es un flujo soportado: al 30/6 ya estaba pago y no debe entrar en la foto de junio.
- **Acumulación de consumos** — **sobrevive**. Un resumen que vence el 31/7 cierra alrededor del 15/7; al 30/6 contenía sólo lo acumulado hasta ahí.

Por eso el modelo se queda exactamente con esos dos y descarta los otros: no por inspección caso por caso, sino porque son los únicos que pueden morder.

## Decisión 5 — Si el snapshot gobierna el pago, gobierna también el contenido

Reconstruir el estado de pago pero no el contenido del resumen da un número que no es ninguna de las dos lecturas: as-of para pagos, registro para consumos. Por eso el corte de consumos (`transactions.date <= snapshotDate`) va junto con el de pagos, o no va ninguno.

No es un concepto nuevo: es la regla que el spec **ya** tiene para el resumen abierto —"un resumen que todavía no cerró aporta lo acumulado hasta hoy y ese monto puede crecer"— aplicada con el snapshot como "hoy". La foto de junio muestra los resúmenes de julio ya cerrados por su total, y los que al 30/6 seguían abiertos por lo acumulado hasta ese día: exactamente lo que la card mostraba ese día.

## Decisión 6 — Los gastos fijos del pasado son REGISTRO, no foto

Acá el modelo as-of **no se puede sostener**, y conviene que quede escrito antes de que alguien lo intente:

El generador materializa **una** instancia pendiente por regla y **sólo cuando la fecha ya llegó** (`decideRecurrenceInstance`: `has_pending` → no genera; `nextDate > today` → `not_due`). Al 30/6 **no existía ninguna instancia de julio**: lo que la card mostraba en gastos fijos era 100% proyección de las reglas activas, y esa proyección no se persiste en ningún lado.

Las alternativas y por qué se descartan:

- **Reproyectar las reglas de hoy sobre la ventana pasada**: usa montos actuales (`confirmRecurrenceInstance` propaga a la regla el monto corregido), pierde las reglas dadas de baja e inventa las creadas después. Peor que no reconstruir.
- **Tabla de snapshots mensuales**: tabla nueva + job, y sólo sirve desde que se implemente — los meses anteriores siguen sin foto igual. Mucho costo, poca ganancia. **No se hace ahora.**

Queda entonces: para ventana pasada la fuente son las instancias materializadas de la ventana, que sí traen snapshot de monto, cuenta y descripción al momento de generarse (`updateRecurrence` "no toca instancias pendientes ya generadas"). Es el **registro** de lo que efectivamente hubo que pagar, no un replay de la pantalla del 30/6.

Consecuencia asumida: **la card queda as-of del lado tarjetas y registro del lado gastos fijos.** No por elección de diseño sino por disponibilidad del dato, y por eso va dicho acá y en el spec.

### `skipped` no entra

`skipRecurrenceInstance` no crea transacción y avanza el cursor de la regla: es el usuario diciendo "esto no ocurrió". Con el copy de ventana pasada siendo *"lo que hubo que pagar"*, esa plata nunca tuvo que salir y contarla infla el registro. Entra `confirmed` + `pending`; `pending` en un mes pasado es un compromiso que quedó sin resolver y sigue siendo algo que había que pagar.

## KNOWN GAPs (aceptados)

1. **La foto de gastos fijos no es reconstruible as-of.** Al corte eran proyección no persistida, y las reglas no tienen versionado histórico: una regla editada o dada de baja después no se puede volver a su estado de entonces. Ver Decisión 6.

2. **El registro materializado tiene agujeros, y no son raros.** El índice `recurrence_instances_one_pending_per_rule` permite **una sola** instancia pendiente por regla, y el generador no produce mientras haya una (`has_pending`). Una regla trabada en una instancia de julio que el usuario nunca resolvió **no generó nada para agosto ni para septiembre**: la foto de agosto muestra $0 de esa regla aunque estuviera comprometida. Afecta justo a quien no confirma sus recurrencias al día. Se acepta: taparlo requeriría reproyectar con montos de hoy, que es el remedio peor que la enfermedad.

3. **Herencia del gap ya documentado.** Los reads de la ventana siguen sin `.range()`, igual que antes de este change. Acotados por la ventana, que es una observación sobre los datos y no una propiedad del código. Mismo tratamiento que en `fix-balance-read-path-defects`.

## Decisión 7 — El label sale del dato, no de `new Date()`

Hoy `committed-section-container.tsx` y `CommittedSection.tsx` calculan el mes cada uno por su lado con `new Date()` + 1 mes. Esa duplicación **es** la causa de clase del bug: dos relojes independientes que ninguno mira el navegador.

`CommittedOutlook` pasa a devolver `window { start, end }`, `snapshotDate` y `mode`, y las dos plataformas rotulan desde ahí. El copy es condicional por `mode`: en `current`, "Compromisos del próximo mes" + el mes de la ventana; en `past`, un título que diga lo que el número es ("Lo que hubo que pagar en …"), porque en esa posición ya no es un pronóstico.

La nota al pie reusa **el mismo slot de una línea** —el spec es tajante con que la card no cambie de alto, porque comparte fila con "Cuánto gastaste" y todo lo que crece acá aparece como hueco allá—: arrastre de vencidos en `current`, "todavía impago" en `past`.

## Decisión 8 — Una función parametrizada, no dos queries paralelas

La forma de las lecturas es la misma en los dos modos (accounts credit → card_periods → transactions → recurrence_instances); lo que cambia son predicados en cinco puntos. Dos funciones espejo serían exactamente el patrón "Mirror of … keep in sync" que AGENTS.md prohíbe, y con un tipo de retorno compartido el riesgo de que diverjan es real.

| | `mode: 'current'` | `mode: 'past'` |
|---|---|---|
| `card_periods` | `.lte('due_date', window.end)` (trae el arrastre de vencidos) | `.gte(window.start).lte(window.end)`, sin arrastre |
| ¿pagado? | existe `period_payment` hoy | existe con `transactions.date <= snapshotDate` |
| consumos | todos los del período | `date <= snapshotDate` |
| agregación | `aggregateCardDebt` (Σ `pending`) | `aggregateCardDebtAsOf` (normaliza `paid` a pendiente cuando el pago es posterior al snapshot) |
| vencido | `due_date < todayISO` | n/a — el slot muestra "todavía impago" |
| gastos fijos | instancias `pending` + proyección | instancias de la ventana, `confirmed` + `pending` |

`aggregateCardDebtAsOf` **no re-deriva** el tratamiento del reintegro "en resumen": esa regla ya vive en `computePeriodAmounts` (`@grana/cards`), que decide de qué lado (pendiente o pagado) se descuenta el reintegro según si el resumen está pago. La nueva agregación se apoya en ella.

## Riesgo conocido

El mes en curso muestra **exactamente lo mismo que hoy** —la rama `current` es el comportamiento actual sin tocar—, así que el cambio es invisible para quien no navega. El riesgo está en el offset: parado en junio, la card habla de julio mientras sus dos vecinas hablan de junio. Se mitiga con el copy (Decisión 7), no con el modelo: es el precio de que los dos números de la pantalla no se pisen.
