# Brief — Simplificación de lectura (informe de diagnóstico)

_Status: informe de diagnóstico. No hay nada implementado. Pensado para continuar en conversaciones nuevas sin depender del historial de chat — el repo es la memoria._

_Origen: sensación de la PO ("funcionalmente está tremenda, pero está todo mostrado de forma compleja; a veces ni yo entiendo cómo ver cierta información que sé que la app tiene") + feedback de un usuario real (Cristian: "la app no me da la info que en mi planilla veía fácil, por ejemplo los gastos que voy a tener el mes que viene") + comparativa con dos apps de referencia (Mobills, ya usada en `simplify-movement-form-surface`, y una app de libro contable estilo asiático con tabs Inicio/Informes/Cuentas/Mío)._

_Relación con `docs/plans/mobile-tap-reduction-redesign.md`: ese brief ataca **taps para hacer** (alta de movimientos). Este ataca **segundos para entender** (lectura). Son ejes complementarios y no se pisan: aquel bajó de ~7 a ≤3 taps el alta; este busca bajar de "3 pantallas y una relectura" a "un vistazo" la respuesta a las preguntas frecuentes._

---

## 1. Tesis

Grana no tiene un problema de funcionalidad ni de rigor contable. Tiene **tres problemas de lectura** y **un agujero de producto**:

| # | Problema | Naturaleza |
|---|----------|-----------|
| A | **Todo pesa igual.** El dashboard son 5–7 cards del mismo tamaño, cada una con título + pregunta + caption + link. Nada es "la respuesta", todo es "una sección". | Jerarquía |
| B | **Tres relojes contables conviven sin rótulo.** CAJA-hoy, CAJA-mes, DEVENGADO-mes y COMPROMISO-desde-hoy están en la misma pantalla, con etiquetas casi iguales y sin decir cuál es cuál. | Ambigüedad |
| C | **El control de mes gobierna una minoría de la pantalla.** El `MonthNavigator` del header mueve 2 de 5–7 cards; el resto lo ignora en silencio. | Contrato roto |
| D | **No existe la lente FUTURO.** La app sabe qué pasó y qué debo hoy. No sabe decir "el mes que viene te van a salir $X". | Agujero de producto |

A, B y C son **gratis**: no tocan ninguna regla contable, solo composición y copy. D es un módulo nuevo, pero **el 80% de la maquinaria ya está construida**.

---

## 2. Evidencia (leída del código, no de memoria)

### A — Todo pesa igual

`apps/web/app/(app)/dashboard/_components/dashboard-content.tsx` compone, en orden:

```
[ Para gastar · hoy ]  [ Dónde está ]
[ Balance del mes   ]  [ Comprometido ]
[ Compartido ]                          (condicional)
[ Gasté este mes ]                      (condicional)
[ ¿En qué gasté este mes? ]
```

Cada card trae **cuatro capas de chrome alrededor de un número**. El Hero, por ejemplo (`es.json → dashboard.hero`):

- eyebrow: `"Para gastar · hoy"`
- question: `"¿Cuánto tengo?"`
- caption: `"Lo que tenés disponible hoy, en pesos y dólares."`
- \+ el número

Tres líneas de texto explicando un número que ya se explica solo. Multiplicado por 7 cards, el usuario escanea ~20 líneas de copy para encontrar el dato que vino a buscar. Todas las cards preguntan; ninguna afirma.

**Comparación:** la app de referencia pone `Gastos: $13.000` / `Promedio: $684,21` como dos renglones de texto plano y abajo el gráfico. Cero card, cero pregunta retórica, cero caption.

### B — Tres relojes sin rótulo

| Card | Base contable | Corte |
|------|---------------|-------|
| Para gastar · hoy | CAJA | hoy |
| Dónde está | CAJA | hoy |
| Balance del mes | CAJA | mes seleccionado |
| Gasté este mes | DEVENGADO (incl. tarjeta) | mes actual |
| ¿En qué gasté? | DEVENGADO (incl. tarjeta) | mes seleccionado |
| Comprometido | COMPROMISO | **desde hoy, ignora el mes** |

El caso más grave está en la copy, `packages/i18n-messages/src/es.json`:

- `dashboard.month.expense` = **"Gastos"** (base CAJA — lo que salió de la caja este mes)
- `dashboard.spent.title` = **"Gasté este mes"** (base DEVENGADO — incluye consumos de tarjeta que todavía no salieron)

Dos cards adyacentes, dos etiquetas casi idénticas, **dos números distintos, ambos correctos**. Esto no es una cuestión de gusto visual: es la razón concreta por la que alguien que conoce el modelo igual duda. El modelo de tres lentes ya está bien pensado y documentado (ver `docs/design/shared/decisiones-rediseno.md`, sección "Modelo: Compartido son las tres lentes"), pero **la UI no lo nombra en ningún lado**.

### C — El control de mes gobierna una minoría

`dashboard-month-context.tsx` lo dice explícito en su propio comentario:

> `"Balance del mes" y "En qué se fue" subscriben y refetchean […]. "Para gastar" y "Dónde está" son today-based y nunca leen este contexto.`

Y `committed-section.tsx`:

> `Static "from today": it does NOT follow the month navigator.`

Resultado: el usuario mueve la flecha a "julio" y **4 de 6 cards no se enteran**. Es el equivalente a un filtro que se aplica a media tabla.

Bonus estructural: en `dashboard-month-context.tsx`,

```ts
const canGoForward = monthsBack > 0
```

→ **el navegador de mes no puede ir al futuro por diseño.** El eje temporal de la app está capado al pasado. Eso hace que la pregunta de Cristian sea literalmente innavegable hoy.

### D — No existe la lente FUTURO

En `packages/dashboard/src/queries.ts`, dentro de `getCommittedOutlook`:

> `We do NOT project next-month fixed expenses: an occurrence becomes "pending to confirm" when its time comes […] so a future projection is not a present obligation.`

La decisión es **contablemente correcta** para la lente COMPROMISO ("qué debo y no pagué"). Pero deja sin responder una pregunta que el usuario sí tiene — y, peor, deja la card `Comprometido` **mezclando dos relojes sin decirlo**.

#### Qué suma `Comprometido` exactamente

`total = debt + recurringExpense`, y cada componente toma solo su porción **presente**:

| Componente | Qué entra | Qué queda afuera |
|---|---|---|
| Resúmenes de tarjeta (`debt`) | Solo resúmenes **ya empezados** (`start_date <= hoy`) y no pagados = "A pagar" + "En curso" | Resúmenes futuros y **cuotas 2..N** — excluidos a propósito (era el bug de inflar el número) |
| Recurrencias (`recurringExpense`) | Solo instancias **ya generadas** con `status='pending'` (`recurrence_instances`) | Todo lo no generado todavía: el alquiler del 5 del mes que viene **no existe como fila** |

Hasta acá, coherente: es un **stock de deuda presente**, no un pronóstico.

#### El defecto: el tercer componente sí proyecta, y se resta contra los otros dos

`recurringIncome` se calcula con `aggregateRecurrenceProjection(rules, windowStart, windowEnd)` donde la ventana es **el primer y último día del mes siguiente**. Y `committed-section.tsx` los resta:

```ts
const net = ars.recurringIncome - totalArs   // futuro − presente
```

para renderizar (`es.json → dashboard.committed.net_surplus`):

> *"Con tu ingreso, el próximo mes arrancás con $X a favor."*

Esa frase **compara el ingreso proyectado del mes que viene contra la deuda de hoy**, y la presenta como pronóstico del mes que viene. Le faltan los gastos fijos de ese mes (alquiler, expensas, monotributo, gym…), que son precisamente lo que no se proyecta. **El "a favor" está inflado de forma sistemática** — para un perfil como el de Cristian (~$1,1M de fijos mensuales), inflado por casi todo eso.

No es un error de cálculo: cada número es correcto por separado. Es que **la resta de los dos no significa lo que la etiqueta afirma**. Es el mismo defecto de fondo que el punto B (dos relojes sin rótulo), pero dentro de una sola card y con una conclusión numérica encima.

**Corolario para el diseño:** la proyección de gasto **no** puede meterse dentro de `Comprometido` — dejaría de ser "lo que debo" para ser "lo que va a pasar". La salida limpia es separar: `Comprometido` se queda como stock presente honesto y **pierde la banda "Ya entra"** (que es la que introduce el segundo reloj); la proyección de los **dos** lados se va a F1, donde la resta sí significa algo.

#### La asimetría, en una línea

La app proyecta el **ingreso** del mes que viene y **no** el gasto. Te dice cuánto entra y no cuánto sale.

**La maquinaria ya existe:**

- `packages/dashboard/src/aggregations.ts → aggregateRecurrenceProjection(rules, windowStart, windowEnd)` ya proyecta **gasto e ingreso** a cualquier ventana. Hoy solo se le usa la mitad.
- `packages/money-logic/src/recurrences.ts → projectUpcomingOccurrences` camina el calendario.
- `card_periods` con `start_date > today` (resúmenes futuros) y las cuotas hijas 2..N ya están en la base — `getCommittedOutlook` las **excluye a propósito** de la deuda presente, pero son exactamente el insumo de la proyección.

Falta el ensamblado y la superficie, no el cálculo.

### Extra — Movimientos también arrastra el problema

`transactions-content.tsx` apila, antes de la lista:

```
sugerencia de recurrencia  →  recurrencias pendientes  →  reintegros pendientes  →  donut de categorías  →  filtros  →  lista
```

Hasta **3 avisos + un gráfico** entre el usuario y sus movimientos, en la pestaña que se llama "Movimientos".

### Extra — La navegación tiene la prioridad invertida (mobile)

`apps/mobile/app/(app)/_layout.tsx` + `TabBar.tsx`:

| Slot | Destino |
|------|---------|
| Tab 1 | Inicio |
| Tab 2 | Movimientos |
| Tab 3 | **Hogar** (Compartido) |
| Tab 4 | Menú (bottom sheet) → Cuentas · Tarjetas · Configuración |

**Tarjetas** — el diferencial declarado del producto en `AGENTS.md` ("credit card installment tracking as a first-class citizen") — está a dos taps dentro de un sheet. **Cuentas** también. Y **Hogar**, una feature que requiere dos personas y que muchos usuarios nunca van a activar, tiene tab permanente.

La app de referencia usa: `Inicio · Informes · [+] · Cuentas · Mío`. Cuentas es ciudadano de primera; todo lo secundario vive en **una sola grilla de íconos** ("Mío"), plana, sin submenús.

---

## 3. Los cuatro patrones que vale la pena robar

De los screenshots de referencia, lo que hace que "se lea al instante":

1. **El chip ⇄ en la card.** Cada card lleva su propio selector de lente (`Gastos ⇄`, `Categoría principal ⇄`, `Activos Netos ⇄`). Cambiar de lente **no navega y no duplica cards**. Grana ya tiene el primitivo (`Segmented`, en `overlay-primitives`); no lo usa como patrón de sistema.
2. **Un solo control global arriba** (`ago ▾` + `Filtrar`) que **todas** las cards obedecen. Contrato explícito, sin excepciones silenciosas.
3. **Números en texto plano antes del gráfico.** Total + promedio como dos renglones; el chart es apoyo, no protagonista.
4. **Ranking con % + barra + conteo.** `1 Teléfono · 61,5% · 1 factura · -$8.000`. Es la forma más legible de un desglose y es más barata que una dona.

Y la card "Cuentas": **tres números en una sola tarjeta** (Activos Netos / Activos / Deudas) y abajo la lista agrupada. Grana hoy parte eso en dos cards (Hero + Dónde está) y no muestra "Deudas" ni "Patrimonio neto" en ningún lado.

---

## 4. La planilla de Cristian — qué modelo es realmente

La planilla **no es un libro mayor. Es un plan mensual.** Su estructura:

```
CABECERA (3 números, arriba de todo)
  Sueldo + Adicionales   $2.795.160
  Gastos                 $2.321.276
  Sueldo − Gastos        $  473.884     ← el único número que de verdad mira

BLOQUE 1 — Gastos fijos del mes (lista de líneas, monto por línea)
  Alquiler, Expensas, TGI, Aguas, Cochera, Personal, Monotributo,
  IIBB, Seguro Bici, Gym, English, Peluquería…

BLOQUE 2 — Una columna POR TARJETA con sus consumos
  Galicia VISA   → Spotify, Smiles, Herencia          Total $78.801
  Santander VISA → seguros, ML, HBO, UCEMA, Ubers…    Total $74.667
  BBVA VISA      → Flora                              Total $34.700
  ICBC           → (vacía)

BLOQUE 3 — USD
  Sueldo USD 3.800 · Venta 600 @1.180 → $708.000 · Sobrante 3.200

BLOQUE 4 — Entradas adicionales
  Sobrante mes anterior, alquiler cobrado, devoluciones, plazo fijo
```

**Lo que la planilla le da y Grana no:**

| La planilla | Grana hoy |
|---|---|
| Todo el mes en **una** pantalla | 3 rutas (`/dashboard`, `/transactions`, `/cards`) |
| **Mira hacia adelante** (lo que voy a pagar) | Mira hacia atrás (lo que pagué) + deuda presente |
| **Un número de cierre**: "me quedan $473.884" | No existe ese número en ninguna superficie |
| Los **fijos como lista visible y editable** | Existen como reglas en `/transactions/recurring`, invisibles desde Inicio |
| **Una columna por tarjeta**, comparables de un vistazo | Una ruta por tarjeta, hay que entrar a cada una |

**Lo que Grana le da y la planilla no** (y por qué no hay que replicarla): reglas contables reales, cuotas que se devengan solas, bimoneda como dos libros separados, corte temporal, tarjetas off-ledger, reintegros, compartido. La planilla es un plan que él mantiene **a mano cada mes**. Grana puede generar ese mismo plan **solo**. Eso es lo que hay que construir: no una planilla, **la salida de la planilla sin el trabajo de la planilla**.

---

## 4bis. El modelo que ordena todo: **un mes, tres zooms**

_Sección agregada tras la discusión de producto sobre el horizonte de `Comprometido`. Es el marco conceptual del que cuelgan R1–R8 y F1–F6._

### 4bis.1 — El horizonte se ancla al mes, no a "desde hoy"

La propuesta inicial de la PO fue: *"que la card muestre siempre el mes que viene, cerrado por mes calendario — hasta el 31/7 mostrás todo agosto; el 1/8 pasás a septiembre"*. La intuición es **correcta en lo esencial** (anclar a un mes calendario en vez de a una ventana rodante sin nombre) y **cara en la mecánica**:

- **El 1/8 mostraría septiembre (vacío)** cuando la pregunta viva es agosto, el mes que se está transitando con 30 días por delante. Justo cuando la previsión más sirve, la card muestra lo menos útil.
- **La información se teletransporta en un borde de fecha.** El 31/7 la card afirma "$2,3M de agosto"; el 1/8 ese número desaparece de ahí y reaparece en otra superficie. Se lee como pérdida de datos y obliga a reaprender dónde están las cosas.

**Regla adoptada — el mes es el contenedor, `hoy` es una línea adentro:**

```
AGOSTO
  1 ──────────── 18 ──[hoy]── 31
  └─── ya pasó ───┘   └─ falta ─┘
        HECHO            PREVISIÓN
```

Una sola superficie, cuya composición cambia sola con el calendario:

| Mes que se mira | Composición | Pregunta que responde |
|---|---|---|
| Anterior | 100% hecho | "¿cómo me fue?" |
| Corriente | hecho + previsión | "¿me alcanza para lo que queda?" |
| Siguiente | 100% previsión | "¿qué se me viene?" ← el pedido de Cristian |

Una regla, cero casos especiales, cero teletransporte. Y cubre la pregunta de mitad de mes, que "siempre el mes que viene" no puede responder.

**Invariante:** la porción PREVISIÓN se rotula siempre como tal y **nunca** entra en `disponible` ni en ningún número que responda "qué tengo" / "qué gasté". El principio "el futuro no es un hecho" se mantiene intacto: cambia el envase, no la regla.

### 4bis.2 — Deuda es un STOCK; el pago es un FLUJO

La pregunta "¿y lo comprometido de agosto, a dónde pasa cuando llega agosto?" destapa una **conflación en el modelo actual**: `Comprometido` mezcla un stock con un flujo, y por eso no tiene respuesta limpia.

| Concepto | Naturaleza | Dónde debe vivir |
|---|---|---|
| **Deuda de tarjeta** | **Stock.** "Debo $980.000." Existe ahora, no pertenece a ningún mes | **Cuentas**, junto a Activos y Patrimonio Neto |
| **Pago de resumen** | **Flujo.** "En agosto pago $340.000" | Una línea del mes correspondiente |

Separados, nada se teletransporta: la deuda vive permanente en Cuentas, y cada mes muestra únicamente el pago que cae en él.

**Consecuencia:** F6 (patrimonio neto) deja de ser un "nice to have". Es **la pieza que hace coherente el modelo de meses** y debe subir de prioridad — pasa a ser prerequisito conceptual de F1.

### 4bis.3 — "Gastos fijos" vs "recurrencias": un campo, no una entidad

Referencia externa (Mobills expone ambos conceptos por separado; su implementación interna **no está verificada** y no se asume). La distinción conceptual sí es real:

- **Recurrencia** = regla que **genera un movimiento** a confirmar. Automatismo de carga. *(Lo que Grana tiene.)*
- **Gasto fijo** = **expectativa de monto mensual** para un concepto. No genera nada. Sirve para proyectar y para comparar esperado vs. real.

El caso concreto está en la planilla de Cristian: **Expensas, EPE, Litoral Gas, Aguas varían todos los meses**. Modelados como recurrencia generan un monto equivocado que hay que corregir cada mes (fricción + dato sucio). Modelados como estimación proyectan bien y nunca afirman ser un hecho.

**Decisión: NO se crea una segunda entidad.** Agregar un concepto para resolver un problema de simplicidad sale al revés — obliga a elegir entre dos cosas que se solapan ("¿esto es recurrencia o gasto fijo?"), que es más complejidad, no menos.

**En su lugar: un campo en `recurrences`.** Hoy la tabla (migración `0011_recurring_movements.sql`) tiene `amount NUMERIC(18,2) NOT NULL CHECK (amount > 0)` a secas, sin noción de exactitud. Agregar `amount_is_estimated BOOLEAN NOT NULL DEFAULT false` es una migración de una columna y habilita:

- **Monto exacto** (Netflix, alquiler) → genera la instancia con el monto, como hoy.
- **Monto estimado** (expensas, luz) → proyecta con el estimado y, al llegar la fecha, **pide el monto real** en vez de asumirlo.

Un concepto, dos comportamientos derivados de un dato. Coherente con "sin modos de usuario: la profundidad sigue a los datos, no a un flag".

### 4bis.4 — La arquitectura de información: **un mes, tres zooms**

El agujero de fondo no es "falta una pantalla". Es que **no hay una regla que diga dónde vive cada cosa**, y por eso el análisis se filtra a Movimientos, la previsión se filtra a Comprometido, y la deuda no tiene casa.

```
   [ ◀   agosto 2026   ▶ ]        ← UN selector, global (F3)

   Inicio       → el mes RESUMIDO       3 números + qué falta + tareas
   Informes     → el mes ANALIZADO      categorías, ranking, top 10
   Movimientos  → el mes en DETALLE     línea por línea
```

Regla mental para el usuario, en una frase: **"Grana siempre te muestra un mes. Elegís cuál arriba, y el nivel de detalle abajo."**

Esto elimina la pregunta "¿dónde veo X?" — la respuesta es siempre "en el mes que estás mirando, al zoom que necesites". Es el cambio conceptual de mayor impacto de todo el brief y **no requiere ninguna feature nueva**: es ruteo, un contexto compartido y mover componentes que ya existen.

Fuera del eje mes viven solo dos cosas, y por buena razón:

- **Cuentas / Tarjetas** — stocks (qué tengo, qué debo). No pertenecen a un mes.
- **Configuración** — no es información financiera.

### 4bis.5 — Movimientos es una lista. El gráfico se muda.

**Decisión: `/transactions` pierde el desglose por categoría.** Razones:

1. La pestaña se llama por la cosa; debe entregar la cosa.
2. Hoy `transactions-content.tsx` apila 3 avisos + dona + filtros **antes** de la lista: lo que se fue a buscar arranca abajo del fold.
3. La dona **duplica** el teaser del dashboard — dos puertas al mismo gráfico, ninguna autoritativa.
4. El gráfico está ahí **por ausencia de Informes**, no por diseño.

**Lo que sí hay que conservar: el drill-down.** La dona de `/transactions` es hoy el disparador del filtro por categoría (`useTransactionsFilters`). Se muda el **gráfico**, se conserva el **vínculo**: Informes es donde se explora; Movimientos es donde se aterriza filtrada, con un chip de filtro activo visible (`Súper · agosto ✕`).

**Los 3 avisos "por confirmar" no son análisis, son tareas.** No van en Movimientos ni en Informes: van a Inicio, colapsados en una línea (`3 cosas por confirmar ▸`).

### 4bis.6 — Lo que falta robar de las apps de referencia

Además del chip ⇄, el ranking y la grilla plana (§3):

- **Top 10 movimientos del mes** (su *"Clasificación de la cantidad de la factura TOP 10"*). Grana no lo tiene, es barato, y responde *"¿por qué gasté tanto?"* **más rápido que cualquier desglose por categoría** — la respuesta real casi siempre son 2 o 3 movimientos grandes, no una categoría. Candidato fuerte para Informes.
- **La card de Cuentas con tres números** (Neto / Activos / Deudas) → el hogar del stock de deuda (§4bis.2).

**Lo que NO se roba:** el gating premium con blur, la densidad decorativa, y sobre todo su **"Activos Netos" fusionando monedas** — viola el principio Bimoneda de forma directa.

---

## 5. Propuesta — rápido (sin tocar contabilidad)

Ordenado por (impacto de lectura ÷ esfuerzo). Todo es composición, copy y ruteo.

### R1 · Desambiguar los dos "gastos" del mes — **el más urgente**

Fusionar `Balance del mes` y `Gasté este mes` en **una card con chip ⇄**:

```
ESTE MES                              [ Caja ⇄ Consumo ]
Entró    $2.795.160
Salió    $2.321.276
Neto     $  473.884
▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░
```

- **Caja** = plata que se movió de verdad (base actual de `Balance del mes`).
- **Consumo** = lo que consumiste, incluida la tarjeta (base actual de `Gasté este mes`).

Una card, dos lentes, un rótulo explícito. Elimina el par de etiquetas confundibles y borra una card entera de la pantalla. **No cambia ningún cálculo** — los dos números ya se computan hoy.

### R2 · Que el selector de mes gobierne toda la pantalla

Dos opciones, hay que elegir una:

- **(a)** `Comprometido` obedece el mes seleccionado, o
- **(b)** `Comprometido` sale del dashboard y se va a la superficie "Se viene" (ver R3).

Recomendado: **(b)**. `Comprometido` es la lente COMPROMISO y mezclarla con las lentes de mes es justamente la fuente de confusión. Sacarla resuelve el contrato roto sin discutir el modelo.

**En el mismo movimiento: sacarle la banda "Ya entra".** Es el único pedazo de `Comprometido` que mira al futuro, y su frase de cierre resta futuro contra presente (ver §2.D). Mientras F1 no exista, la opción honesta es mostrar el ingreso proyectado **sin la resta** (dato de contexto, no conclusión). Cuando F1 exista, la banda se muda entera ahí.

Además: liberar `canGoForward` para poder ir a meses futuros (prerequisito de F1).

### R3 · Dashboard de 7 cards a 3 bloques

```
┌─ TENGO ─────────────────────────────┐   hoy
│  $95.000 ARS  ·  USD 3.200          │
│  ▸ Dónde está (colapsable)          │
├─ ESTE MES ──────────  [Caja ⇄ Consumo]  ← R1, obedece el selector
│  Entró / Salió / Neto + barra       │
│  Top 3 categorías (% + barra)       │
│  ▸ Ver informe completo             │
├─ SE VIENE ──────────────────────────┤   COMPROMISO + PLAN
│  A pagar ahora    $ …               │
│  Mes que viene    $ …   ← F1        │
└─────────────────────────────────────┘
```

Tres preguntas, tres bloques, tres respuestas: **tengo / me fue / se viene**. Todo lo demás baja a `/informes` (F2).

### R4 · Bajar el ruido de copy

Un título por card. Las `question` y `caption` (`"¿Cuánto tengo?"`, `"Lo que tenés disponible hoy, en pesos y dólares."`) pasan a **estado vacío / primer uso** solamente. Es puro `es.json` + borrar nodos JSX. El efecto sobre la legibilidad es desproporcionado respecto al esfuerzo.

### R5 · Reordenar la navegación mobile

```
Inicio  ·  Informes  ·  [ + ]  ·  Cuentas  ·  Más
```

- **Cuentas** sube a tab (incluye tarjetas: son cuentas `type='credit'`, ya modeladas así).
- **Hogar** baja a `Más` — o mejor, **se muestra como tab solo si el usuario tiene hogar**, que es data-driven y coherente con "sin modos de usuario" de `AGENTS.md`.
- El `QuickAddFab` (ya existe en ambas plataformas) pasa al centro del tab bar.
- `Más` = una grilla plana de íconos (Tarjetas, Recurrencias, Categorías, Compartido, Configuración), no un sheet de 3 items.

### R6 · Formalizar el chip ⇄ como patrón de sistema

Ya existe `Segmented` en `overlay-primitives`. Falta usarlo consistentemente como **el** mecanismo de lente: `ARS ⇄ USD`, `Gastos ⇄ Ingresos`, `Caja ⇄ Consumo`, `Categoría ⇄ Subcategoría`. Cada chip que se agrega borra una card duplicada o una navegación.

### R7 · Ranking legible al lado (o en vez) de la dona

`1 Teléfono · 61,5% · 1 mov. · -$8.000` + barrita. La dona queda como adorno superior; la lista es lo que se lee. Los datos ya vienen de `getMonthCategoryBreakdown`.

### R8 · Despejar `/transactions`

Los 3 avisos ("por confirmar") colapsados por defecto a **una sola línea sumarizada** (`3 cosas por confirmar ▸`). La lista de movimientos empieza arriba, no abajo del scroll.

---

## 6. Propuesta — a futuro (módulos)

### F1 · El mes como contenedor (HECHO + PREVISIÓN) ★ la respuesta a Cristian

_Reformulado según §4bis: no es "una card del mes que viene", es **el mes seleccionado mostrando su parte hecha y su parte por venir**. Mirar septiembre en agosto da 100% previsión — el pedido original — pero sin caso especial._

Con el selector en un mes futuro, responde **"¿con cuánto me quedo?"**:

```
SEPTIEMBRE — proyección
  Ya entra                      $2.795.160
    Sueldo (recurrente)          2.795.160
  Ya sale                        2.321.276
    Fijos (recurrencias)         1.100.000   ▸ ver las 14 reglas
    Resúmenes de tarjeta           980.000   ▸ por tarjeta
    Cuotas en curso                241.276   ▸ 7 cuotas
  ─────────────────────────────────────────
  Te queda                      $  473.884
  ⚠ Proyección, no un hecho. No afecta tu disponible.
```

**Decisión contable (no negociable):** es una lente **separada**, explícitamente rotulada como proyección. **No** toca el corte temporal, **no** suma al `disponible`, **no** modifica `getCommittedOutlook`. Se apoya en el principio ya escrito en `AGENTS.md` ("el futuro no es un hecho") — precisamente por eso vive en su propia superficie con su propio rótulo.

**Insumos, todos existentes:**

| Componente | De dónde sale | Estado |
|---|---|---|
| Gastos fijos proyectados | `aggregateRecurrenceProjection(rules, inicioMes, finMes)` con `movement_type='expense'` | **ya calculado, sin usar** |
| Ingresos proyectados | idem, `'income'` | **ya en uso** (banda "Ya entra") |
| Resúmenes de tarjeta futuros | `card_periods` con `start_date` dentro del mes | existe, hoy excluido a propósito |
| Cuotas 2..N | hijas `status='pending'` con `date` en el mes | existe |

Dependencia: el change activo **`fix-recurrence-projection-and-orphans`** arregla justamente `projectUpcomingOccurrences` (hoy ignora `last_generated_date` y duplica ocurrencias). **F1 debe ir después de ese change**, o proyectaría de más.

**Prerequisito de UI:** liberar `canGoForward` (R2).

### F2 · `/informes` — el mes entero en una pantalla

Absorbe lo que hoy está repartido: serie diaria, dona + ranking, top movimientos del mes, comparativa con el mes anterior, desglose por cuenta y por tarjeta. Un scroll, **un solo selector de mes**, chips ⇄ para las lentes. Es el segundo tab de la app de referencia y es lo que convierte "tengo los datos" en "veo cómo me fue".

### F3 · Selector de mes único y global

Hoy hay dos sistemas de período independientes: `dashboard-month-context.tsx` y `lib/transactions/filters-context.tsx`. Unificarlos en un contexto de app: elegís "julio" una vez y toda la app está en julio. Es el contrato del punto 2 de la sección 3, llevado a nivel aplicación.

### F4 · Presupuesto por categoría

Marcado como non-goal en `simplify-movement-form-surface` → módulo propio. Es lo que convierte "gasté $X en Súper" (dato) en "vas bien / vas mal" (respuesta). Encaja natural bajo F1 (el plan del mes) y en `/informes`.

### F5 · Vista comparada de tarjetas ("el bloque 2 de la planilla")

Todas las tarjetas del mes lado a lado, cada una con sus consumos y su total. Los datos ya están en `/cards/[id]/periods/[periodId]`; falta la vista transversal. Es literalmente lo que Cristian arma a mano cada mes.

### F6 · Patrimonio neto

La app de referencia lo pone de entrada: `Activos Netos · Activos · Deudas`. Grana tiene los tres números (disponible + deuda de tarjeta) y no muestra ninguno junto. Cabe en el bloque **TENGO** con un chip ⇄.

---

## 7. Orden sugerido

| Fase | Qué | Por qué primero |
|---|---|---|
| **1** | R1 + R4 | Máximo impacto de lectura, cero riesgo contable, todo copy y composición |
| **2** | R2 + R3 | Arregla el contrato del selector y baja el dashboard a 3 bloques |
| **3** | R5 + R8 | Navegación y despeje de Movimientos |
| **4** | R6 + R7 | Consolidan el sistema visual (habilitan F2) |
| **5** | **F1** | Después de `fix-recurrence-projection-and-orphans`. **Es el mayor salto de valor percibido** |
| **6** | F2 + F3 | La superficie de análisis y el eje temporal único |
| **7** | F4, F5 | Producto nuevo, con calma |

**Cambio de prioridad tras §4bis:** **F6 (patrimonio neto / Cuentas con Neto·Activos·Deudas) sube a la fase 4**. Deja de ser cosmético: es donde vive el *stock* de deuda, y sin esa casa el modelo de meses de F1 no cierra (§4bis.2).

---

## 8. Preguntas abiertas para la PO

1. **¿"Consumo" o "Devengado"?** El chip de R1 necesita dos palabras que un no-contador distinga al toque. Candidatos: `Caja ⇄ Consumo`, `Salió ⇄ Gastaste`, `Real ⇄ Con tarjeta`.
2. **¿`Comprometido` se va del dashboard o aprende a seguir el mes?** (R2 a vs b). Recomendación: se va.
3. **¿"Hogar" como tab siempre, o solo si hay hogar?** Data-driven es más coherente con `AGENTS.md`, pero esconde el descubrimiento de la feature.
4. **¿F1 vive en su propia ruta (`/plan`) o es el bloque "Se viene" del dashboard expandido?**
5. **¿La proyección de F1 debería ser editable?** (tocar un fijo proyectado y ajustarlo solo para ese mes, como se hace en una planilla). Es la diferencia entre "informe" y "herramienta de planificación" — y probablemente la decisión de producto más grande de todo este brief.
