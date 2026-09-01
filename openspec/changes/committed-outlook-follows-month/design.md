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

esMesActual   = (year, month) === mes de todayISO
snapshotDate  = esMesActual ? todayISO : últimoDía(year, month)
window        = [1º, último día] del mes siguiente a (year, month)
lens          = esMesActual ? 'live' : 'snapshot'
windowElapsed = window.end < todayISO
```

`{ year, month }` y no una fecha ISO: el dashboard piensa en `DashboardMonth`, y ya hay precedente en `getMonthBalanceSeries(supabase, year, month)`. Una fecha que significa "el mes de esa fecha" es la misma ambigüedad que estamos sacando.

**`lens` y `windowElapsed` son dos hechos ortogonales, y un solo campo no puede cargar los dos.** Hay tres posiciones del navegador, no dos:

| | Mes seleccionado | `snapshotDate` | `lens` | `windowElapsed` |
|---|---|---|---|---|
| **1** | el mes en curso | hoy | `live` | `false` |
| **2** | el mes anterior | su cierre | `snapshot` | `false` (la ventana es el mes en curso) |
| **3** | dos meses atrás o más | su cierre | `snapshot` | `true` |

Los dos lados de la card parten esas tres posiciones **por lugares distintos**:

- **Tarjetas** distinguen 1 de {2, 3}: en `live` el estado de pago es el de hoy y hay arrastre de vencidos; en `snapshot` el pago se evalúa al corte y no hay arrastre. La posición 2 y la 3 se leen idéntico.
- **Gastos fijos** distinguen {1, 2} de 3: la proyección de reglas activas sigue siendo válida mientras la ventana no haya terminado (el cursor `last_generated_date` todavía no la pasó), y deja de servir cuando sí.

Un campo único `mode: 'current' | 'past'` derivado de `window.end < todayISO` colapsaba mal esas dos particiones: el 1/9, mirando agosto, la ventana es septiembre y todavía no terminó, así que el campo daba `'current'` y la lectura descartaba el `snapshotDate` del 31/8 que ella misma había calculado. Por eso son dos campos.

## Decisión 3 — El pago deja de ser un filtro y pasa a ser un atributo

Es la decisión que resuelve "¿y cuando lo que era próximo mes ya está pago?".

- **Lente `live`** (mirando el mes en curso): la pregunta es *"¿cuánto me va a salir?"*. Lo ya pagado no va a salir → se filtra. Sin cambios.
- **Lente `snapshot`** (mirando cualquier mes anterior): la pregunta es *"¿qué tenía que pagar ese mes?"*. Que lo hayas pagado después del corte es el desenlace, no cambia el compromiso → **entra igual**.

La propiedad que valida el modelo: **el número de un mes pasado queda estable**. No cambia porque pagues algo hoy. Con la regla actual, la foto de julio iría encogiendo a medida que se paga — una foto que cambia cuando la mirás no es una foto.

Con la query actual la lente `snapshot` da **todo cero**, y por cuatro razones acumuladas, no una:

| Dónde | Qué hace | Bajo la lente `snapshot` |
|---|---|---|
| `queries.ts` `unpaid = candidatos − pagados` | filtra por estado de hoy | el resumen pagado ni entra al read |
| `aggregations.ts` `aggregateCardDebt` | suma sólo `status === 'pending'` | `pay-card-period.ts` dejó los consumos en `'paid'` → 0 |
| `queries.ts` instancias `.eq('status','pending')` | sólo pendientes | en julio ya están resueltas → 0 |
| `recurrences.ts` `projectRuleOccurrences` | `cursor: last_generated_date` | el cursor ya pasó la ventana → 0 |

La causa raíz es una sola: **toda la query está escrita en lente DEUDA ("qué me falta pagar") y la lente `snapshot` necesita lente COMPROMISO ("qué había que pagar")**.

## Decisión 4 — Casi ningún predicado as-of sobrevive, y se puede demostrar cuáles

Bajo A, `snapshotDate < window.start` **por construcción** (el snapshot es el último día del mes seleccionado; la ventana abre al día siguiente). De ahí sale una regla general que evita discutir predicado por predicado:

> **Todo predicado as-of sobre eventos que ocurren en o después de la apertura de la ventana es inerte. Sólo sobreviven los predicados sobre eventos anteriores a la ventana.**

Aplicada:

- `resolved_at > snapshotDate` sobre `recurrence_instances` — **inerte**. El único insert de instancias es el generador (`recurrences/src/queries.ts`), gateado por `decideRecurrenceInstance`, que devuelve `not_due` si `nextDate > today`. Entonces no existe instancia con `scheduled_date` futuro, de donde `resolved_at ≥ created_at ≥ scheduled_date ≥ window.start > snapshotDate`, siempre.
- `due_date < snapshotDate` aplicado **a los resúmenes de la ventana** — **inerte**, por el mismo motivo: sus `due_date` son todos posteriores al snapshot. De ahí se sigue algo que la primera versión de este design leyó al revés: como ningún resumen de la ventana puede estar vencido al corte, el arrastre de vencidos **necesariamente** se compone de resúmenes **anteriores** a la ventana — y sobre ésos el predicado no es inerte en absoluto. Ver Decisión 8.
- **Pago anticipado de un resumen** — **sobrevive**. `pay-card-period.ts` sólo exige que el período esté `closed` u `overdue` (`today > end_date`); **no** exige que haya vencido. Un resumen que cierra el 20/6 y vence el 5/7, pagado el 25/6, es un flujo soportado: al 30/6 ya estaba pago y no debe entrar en la foto de junio.
- **Acumulación de consumos** — **podría morder** (un resumen que vence el 31/7 cierra alrededor del 15/7, y al 30/6 contenía sólo lo acumulado hasta ahí), pero se descarta por un motivo distinto: rompe las compras en cuotas. Ver Decisión 5.

El teorema deja entonces **un solo** predicado as-of en pie —el pago anticipado—: los otros dos candidatos caen, uno por inerte y otro por incorrecto. Sirve igual como filtro de diseño: dice de antemano cuáles ni vale la pena evaluar.

## Decisión 5 — El snapshot gobierna el PAGO, no el contenido del resumen

Una versión anterior de este design pedía cortar también los consumos (`transactions.date <= snapshotDate`), por simetría: si el snapshot decide el estado de pago, que decida todo. **Está mal, y las compras en cuotas son la prueba.**

`registerInstallments` inserta las N cuotas **en el momento de la compra**, cada una fechada `fechaCompra + i meses` (`installmentDates.push(addMonthsToISO(data.date, i))`) y asignada al período que cubre esa fecha. Una compra de mayo en 12 cuotas ya tiene, desde mayo, un hijo fechado en julio dentro del resumen de julio. Al 30/6 ese consumo **existía y el usuario lo conocía**: es precisamente el tipo de compromiso que la card está para anticipar. Un corte por `date` lo dejaba afuera, y para un usuario que financia en cuotas —el caso normal en este mercado— vaciaba el número.

El campo que separaría "ya existía al corte" de "todavía no había pasado" no es `date` sino `created_at`. Se descarta igual: ataría un monto de plata al momento de **carga en la app**, que es exactamente el acoplamiento que este mismo change rechaza cuando elige `transactions.date` por sobre `period_payments.created_at` para fechar un pago.

Queda entonces: **el resumen aporta su contenido completo**; el snapshot decide únicamente si a esa fecha seguía siendo un compromiso pendiente.

El error de razonamiento que había detrás era tratar las dos cosas como el mismo tipo de hecho. No lo son:

- El **pago** es el evento que resuelve el compromiso. Si había ocurrido al corte es literalmente la pregunta "¿esto todavía se debía?".
- El **contenido** es lo que el compromiso *es*. Truncarlo no responde la pregunta de la card, responde otra: qué píxeles había en pantalla ese día.

Y decide el mismo criterio de la Decisión 3: con el contenido completo el monto de una ventana pasada queda **estable** —fijo para siempre una vez que los resúmenes de esa ventana cerraron—; con el corte pasaba a depender de cuándo cerró cada resumen.

Consecuencia asumida y explícita: para un resumen que al corte todavía no había cerrado, la foto muestra **más** de lo que la pantalla mostraba ese día. Es deliberado. La card responde "qué hubo que pagar en julio", no "qué decía la pantalla el 30/6" — y del lado gastos fijos esa segunda pregunta no es reconstruible de todos modos (Decisión 6).

## Decisión 6 — Los gastos fijos del pasado son REGISTRO, no foto

Acá el modelo as-of **no se puede sostener**, y conviene que quede escrito antes de que alguien lo intente:

El generador materializa **una** instancia pendiente por regla y **sólo cuando la fecha ya llegó** (`decideRecurrenceInstance`: `has_pending` → no genera; `nextDate > today` → `not_due`). Al 30/6 **no existía ninguna instancia de julio**: lo que la card mostraba en gastos fijos era 100% proyección de las reglas activas, y esa proyección no se persiste en ningún lado.

Las alternativas y por qué se descartan:

- **Reproyectar las reglas de hoy sobre la ventana pasada**: usa montos actuales (`confirmRecurrenceInstance` propaga a la regla el monto corregido), pierde las reglas dadas de baja e inventa las creadas después. Peor que no reconstruir.
- **Tabla de snapshots mensuales**: tabla nueva + job, y sólo sirve desde que se implemente — los meses anteriores siguen sin foto igual. Mucho costo, poca ganancia. **No se hace ahora.**

Queda entonces: en la lente `snapshot` la fuente son las instancias materializadas de la ventana, que sí traen snapshot de monto, cuenta y descripción al momento de generarse (`updateRecurrence` "no toca instancias pendientes ya generadas"). Es el **registro** de lo que efectivamente hubo que pagar, no un replay de la pantalla del 30/6.

Las dos perillas del lado gastos fijos no son la misma:

| | filtro de status de las instancias | ¿proyecta reglas activas? |
|---|---|---|
| `lens: 'live'` | `pending` | sí |
| `lens: 'snapshot'`, `windowElapsed: false` | `confirmed` + `pending` | **sí** |
| `lens: 'snapshot'`, `windowElapsed: true` | `confirmed` + `pending` | no |

El filtro de status lo decide la **lente**, no si la ventana terminó, y ahí hay un agujero que la partición binaria no ve. En la posición 2 (mirando agosto el 1/9, ventana septiembre) las instancias de septiembre se van confirmando a lo largo del mes; con el filtro `pending` de la lente `live`, el total de esa foto **iría encogiendo día a día** — justo lo contrario de la estabilidad que exige la Decisión 3. Con `confirmed + pending` se mantiene fijo.

La proyección la decide `windowElapsed`, no la lente: mientras la ventana no haya terminado el cursor `last_generated_date` todavía no la pasó y la proyección sigue devolviendo las ocurrencias que aún no se materializaron. Las dos fuentes no se pisan por la misma razón de siempre: la proyección arranca después del cursor, así que una instancia ya confirmada nunca vuelve a emitirse.

Residuo aceptado: si el usuario corrigió el monto al confirmar una instancia, el total de esa ventana se mueve un poco. Es correcto —es lo que se pagó de verdad— y no se compensa.

Consecuencia asumida: **la card queda as-of del lado tarjetas y registro del lado gastos fijos.** No por elección de diseño sino por disponibilidad del dato, y por eso va dicho acá y en el spec.

### `skipped` no entra

`skipRecurrenceInstance` no crea transacción y avanza el cursor de la regla: es el usuario diciendo "esto no ocurrió". Con el copy de ventana pasada siendo *"lo que hubo que pagar"*, esa plata nunca tuvo que salir y contarla infla el registro. Entra `confirmed` + `pending`; `pending` en un mes pasado es un compromiso que quedó sin resolver y sigue siendo algo que había que pagar.

## KNOWN GAPs (aceptados)

1. **La foto de gastos fijos no es reconstruible as-of.** Al corte eran proyección no persistida, y las reglas no tienen versionado histórico: una regla editada o dada de baja después no se puede volver a su estado de entonces. Ver Decisión 6.

2. **El registro materializado tiene agujeros, y no son raros.** El índice `recurrence_instances_one_pending_per_rule` permite **una sola** instancia pendiente por regla, y el generador no produce mientras haya una (`has_pending`). Una regla trabada en una instancia de julio que el usuario nunca resolvió **no generó nada para agosto ni para septiembre**: la foto de agosto muestra $0 de esa regla aunque estuviera comprometida. Afecta justo a quien no confirma sus recurrencias al día. Se acepta: taparlo requeriría reproyectar con montos de hoy, que es el remedio peor que la enfermedad.

3. **Herencia del gap ya documentado.** Los reads de la ventana siguen sin `.range()`, igual que antes de este change. Acotados por la ventana, que es una observación sobre los datos y no una propiedad del código. Mismo tratamiento que en `fix-balance-read-path-defects`.

## Decisión 7 — El label sale del dato, no de `new Date()`

Hoy `committed-section-container.tsx` y `CommittedSection.tsx` calculan el mes cada uno por su lado con `new Date()` + 1 mes. Esa duplicación **es** la causa de clase del bug: dos relojes independientes que ninguno mira el navegador.

`CommittedOutlook` pasa a devolver `window { start, end }`, `snapshotDate`, `lens` y `windowElapsed`, y las dos plataformas rotulan desde ahí. El copy tiene **tres** estados, uno por posición del navegador:

| Posición | Título |
|---|---|
| `lens: 'live'` | "Compromisos del próximo mes" — es un pronóstico |
| `lens: 'snapshot'`, `windowElapsed: false` | lo que tenías por delante al cierre de ese mes — la ventana todavía transcurre |
| `windowElapsed: true` | lo que hubo que pagar en esa ventana — ya no anticipa nada |

La nota al pie reusa **el mismo slot de una línea** —el spec es tajante con que la card no cambie de alto, porque comparte fila con "Cuánto gastaste" y todo lo que crece acá aparece como hueco allá— y conserva **un solo significado** en las tres posiciones: el arrastre de resúmenes vencidos e impagos **al `snapshotDate`**. Con `lens: 'live'` el snapshot es hoy y la regla se reduce al comportamiento actual.

## Decisión 8 — Una función parametrizada, no dos queries paralelas

La forma de las lecturas es la misma en las tres posiciones (accounts credit → card_periods → transactions → recurrence_instances); lo que cambia son predicados. Dos funciones espejo serían exactamente el patrón "Mirror of … keep in sync" que AGENTS.md prohíbe, y con un tipo de retorno compartido el riesgo de que diverjan es real.

| | `lens: 'live'` | `lens: 'snapshot'` |
|---|---|---|
| `card_periods` | `.lte('due_date', window.end)` | `.lte('due_date', window.end)` — igual: el arrastre existe en las dos lentes |
| ¿pagado? | existe `period_payment` hoy | existe con `transactions.date <= snapshotDate` |
| consumos | todos los del período | **todos los del período** (Decisión 5) |
| agregación | `aggregateCardDebt` (Σ `pending`) | `aggregateCardDebtAsOf` (Σ consumos de cualquier status − reintegros recibidos) |
| vencido | `due_date < snapshotDate` e impago al snapshot (con `snapshotDate` = hoy) | `due_date < snapshotDate` e impago al snapshot — **la misma regla** |
| instancias | status `pending` | status `confirmed` + `pending` |

| | `windowElapsed: false` | `windowElapsed: true` |
|---|---|---|
| proyección de reglas activas | sí | no |

### La primitiva compartida va a `@grana/money-logic`, no se importa de `@grana/cards`

`computePeriodAmounts` (hoy en `packages/cards/src/period-amounts.ts`) es la pieza que ya resuelve la parte difícil: de qué lado —pendiente o pagado— se descuenta el reintegro "en resumen" según si el resumen está pago. `aggregateCardDebtAsOf` la necesita y NO SHALL re-derivarla.

Nota sobre la partición: con `.lte('due_date', window.end)` en las dos lentes, el read trae la ventana **más** todo lo anterior, y se parte en dos conjuntos disjuntos — ventana (`due_date` dentro) y arrastre (`due_date < snapshotDate` e impago al corte). Bajo `snapshot` la partición además es **exhaustiva**, porque `window.start = snapshotDate + 1 día` no deja ningún resumen en el medio; el KNOWN GAP de un resumen que vence entre hoy y la apertura de la ventana existe sólo en la lente `live`.

Pero `@grana/dashboard` **no puede importar `@grana/cards`**: el grafo actual es `@grana/cards → @grana/transactions → @grana/dashboard`, así que la arista nueva cerraría el ciclo `dashboard → cards → transactions → dashboard`.

La primitiva se **promueve a `@grana/money-logic`**, que es donde correspondía: es pura, no toca I/O, y sus únicas dependencias (`sumMoneyValues`, `subtractMoneyValues`) ya viven ahí. El movimiento no agrega ninguna arista al grafo —`money-logic` sólo depende de `@grana/validation`, y tanto `dashboard` como `cards` ya dependen de `money-logic`—. `@grana/cards` la reexporta para no tocar a sus consumidores actuales.

## Riesgo conocido

El mes en curso muestra **exactamente lo mismo que hoy** —la rama `current` es el comportamiento actual sin tocar—, así que el cambio es invisible para quien no navega. El riesgo está en el offset: parado en junio, la card habla de julio mientras sus dos vecinas hablan de junio. Se mitiga con el copy (Decisión 7), no con el modelo: es el precio de que los dos números de la pantalla no se pisen.
