## Context

"En qué se fue" es una de las tres preguntas centrales del modo de usuario y no tiene superficie en v3. grana-v2 tenía un desglose por categoría en el dashboard (barras rankeadas) + un donut en household. Lo portamos como **carta de presentación del módulo Movimientos**, con un donut como héroe.

Restricciones de dominio que condicionan el diseño:
- **Bimoneda**: ARS y USD nunca se suman; ARS primaria, USD subordinada.
- **Off-ledger credit cards**: los consumos no tocan `disponible`, pero **sí son gasto** en una categoría — "en qué se fue" los tiene que contar.
- **Derived balances**: el desglose se computa del historial; no se persiste.
- **Reintegros**: el peso de una categoría es el **neto** = gastos − reintegros recibidos (`computeCategoryNet`, ya en `@grana/money-logic`).

## Goals / Non-Goals

**Goals:**
- Responder "¿en qué se fue?" de un vistazo, con un donut que muestra qué categoría pesa más.
- Pesar por **neto** (reintegro-aware), por moneda.
- Drill-down a la lista de movimientos de la categoría (reusa el filtro existente).
- Un teaser top-3 en el dashboard que enganche al overview completo.

**Non-Goals (V1):** ingresos por categoría, subcategorías en el donut, comparativas mes-a-mes, presupuestos.

## Decisions

### Decisión 1: hogar — carta de presentación de Movimientos + teaser en dashboard

El desglose completo (donut + ranking) es la **carta de presentación de `/transactions`**: aparece arriba, antes del listado. El listado sigue accesible debajo / a un tap. El **dashboard** suma un **teaser** con las 3 categorías que más pesan, que linkea al overview.

- **Por qué Movimientos y no el dashboard (como v2):** "en qué se fue" es el alma del módulo, y el drill-down (la lista) ya vive ahí. El dashboard de v3 ya tiene 3 secciones; meterle el desglose completo lo recarga. El teaser top-3 da el gancho sin competir por espacio.

### Decisión 2: visual — donut SVG liviano + ranking

- **Donut** como héroe (arcos SVG con `stroke-dasharray`, sin librería de charts → cero dependencia nueva, mobile lo espeja después). Muestra el peso relativo de cada categoría.
- **Ranking** debajo como leyenda + drill-down: `emoji · categoría · monto · %` con una barrita, ordenado desc. Tap en una fila → `/transactions?category=<id>` (filtro existente).
- **"Otros"**: la cola de categorías chicas se agrupa en una tajada/fila "Otros" para que el donut sea legible (p. ej. top 6 + "Otros"). Helper puro en `money-logic` para armar las tajadas (porcentajes que suman 100 + "Otros").

### Decisión 3: métrica — neto por categoría, por moneda, sólo gastos

El peso de cada categoría = **neto por moneda** = Σ gastos − Σ reintegros recibidos de esa categoría (`computeCategoryNet`). Sólo **gastos** (ingresos no entran). Bimoneda: ARS primaria, USD subordinada, nunca sumadas.

### Decisión 4: qué cuenta como "gasto del mes" (la regla)

Cuentan los **gastos cuya fecha contable cae en el mes seleccionado**, agrupados por categoría:
- Cash/débito: el gasto completo en su fecha.
- Tarjeta, consumo simple: el consumo en su fecha.
- Tarjeta, compra en cuotas: la **cuota que devenga en el mes** (las hijas tienen fecha mensual propia → filtrar por fecha-en-el-mes da naturalmente una cuota por mes). La **madre** (`is_parent`, off-ledger) NO cuenta — cuentan las hijas.
- Reintegros **recibidos** de esa categoría (derivada) restan, por su fecha.

Es la **misma base de devengado que usa el dashboard** ("comprometido = cuotas devengadas"), lograda por simple filtro de fecha. Incluye consumos de tarjeta porque "en qué se fue" es gasto total, no sólo lo que tocó `disponible`.

### Decisión 5: bimoneda en la UI

ARS es primaria: el **donut + ranking** son de ARS. USD se muestra **subordinada** — un ranking compacto aparte (sin segundo donut, para no recargar), sólo si hay gasto en USD ese mes.

## Risks / Trade-offs

- **[Mezcla off-ledger + ledger]** → el desglose cuenta consumos de tarjeta (off-ledger) junto a gastos cash. Es correcto para "en qué se fue" (gasto total), pero NO es "lo que salió del disponible". El copy debe dejar claro que es "gastos del mes", no "lo que pagaste".
- **[Donut SVG a mano]** → sin librería, hay que calcular los arcos; mitigado con un helper puro testeado (porcentajes + offsets) y "Otros" para la cola.
- **[Carta de presentación cambia el landing de Movimientos]** → hoy `/transactions` abre en la lista; ahora antecede el overview. Mantener la lista accesible y la performance (una agregación más por carga).

## Open Questions

- **Layout del landing:** ¿overview SIEMPRE arriba del listado en la misma página, o un toggle/tab "Resumen | Lista"? (Inclinación: overview arriba, listado debajo, misma página — más simple.)
- **USD:** ¿ranking compacto subordinado (inclinación) o un segundo donut? Confirmar al implementar.
- **Cuántas tajadas** antes de agrupar en "Otros" (¿top 6? ¿top 8?) — a calibrar visualmente.
- **Teaser del dashboard:** ¿las 3 que más pesan en ARS, o un criterio bimoneda? (Inclinación: top-3 ARS, que es la primaria.)
