## Context

El paquete de handoff vive en `docs/design/dashboard-home/`: un `README.md` con tokens, semántica y derivaciones, y dos HTML hi-fi (`Dashboard Web.html`, `Dashboard Mobile.html`) que son **referencia de diseño, no código a copiar**. Los números que traen son mock.

El dashboard existente ya resuelve buena parte de la infraestructura que este rediseño necesita, y conviene enunciarlo porque acota el riesgo:

- **La aritmética de "Cuánto gastaste" ya existe.** `SpentThisMonthSection` calcula `accrued` (devengado del mes, vía `getMonthCategoryBreakdown`), `cash` (`MonthBalanceSeries.totalExpense`) y `financed = accrued − cash`, con el comentario que documenta que los tres reconcilian. Son exactamente Gastaste / Pagaste / Te queda por pagar.
- **El patrón de render ya está fijado**: server components con `Suspense` por sección, un `container` + un `skeleton` shape-matched por sección, y un `DashboardErrorBoundary` que tolera fallas parciales. El rediseño se acomoda a ese patrón, no lo cambia.
- **La bimoneda ya tiene doctrina.** `MonthBalanceByCurrency` documenta: *"ARS and USD are never summed (bimoneda): the dashboard shows the ARS totals as the headline and the USD totals in a subordinate strip"*. La decisión de producto de este change confirma esa doctrina en vez de romperla.
- **Naming espejo web/mobile** es un requirement vigente del spec `dashboard`: `spent-this-month-section.tsx` ↔ `SpentThisMonthSection.tsx`.

Tres preguntas que el README dejaba abiertas se resolvieron con el usuario antes de escribir esto, y son el eje de las decisiones que siguen.

## Goals / Non-Goals

**Goals**

- Recrear los cuatro bloques del handoff con los componentes, tokens y patrones del codebase, en web y en mobile.
- Que todo dato derivado se calcule (nada hardcodeado), con las derivaciones en funciones puras testeables del package compartido.
- Cubrir los estados vacíos, de carga y de error, incluidos los dos que la decisión sobre el ritmo vuelve frecuentes.
- Mantener el dashboard read-only: toda interacción navega.

**Non-Goals**

- No se introduce tipo de cambio global ni conversión entre monedas.
- No se agrega configuración de usuario nueva (ingreso mensual esperado, TC).
- No se toca el módulo Movimientos ni su desglose por categoría.
- No se rediseñan el selector de mes, el eye toggle ni el sidebar; se reusan tal cual.
- No se persigue paridad pixel con los HTML: son referencia, y el sistema de estilos del repo manda donde haya conflicto.

## Decisions

### D1 — ARS y USD se muestran separados; la línea USD aparece solo si el valor es ≠ 0

El handoff pide "todos los montos en ARS y en USD con el mismo tipo de cambio", y los mocks lo confirman: cada par da el mismo cociente (≈13.456 ARS/USD), o sea **un valor mostrado dos veces**. Eso exige consolidar monedas y un TC global, y choca de frente con la invariante vigente del modelo (`packages/dashboard/src/types.ts`: *"ARS and USD are never summed"*), que además está enunciada en el master spec.

**Se resuelve a favor de la invariante.** Cada métrica tiene su valor ARS **real** y su valor USD **real**, sin conversión. La línea USD se renderiza únicamente cuando ese valor es distinto de cero.

Por qué: consolidar habría hecho que un saldo en dólares se mueva solo porque cambió una cotización, en una app cuyo modelo de datos guarda el FX **por transacción** (`transactions.fx_rate_to_ars`) precisamente para no tener un rate global. La alternativa —inventar un TC de cuenta— era una migración, una pantalla de configuración y una decisión de producto ("¿qué dólar?") a cambio de una coherencia visual con un mock.

Consecuencia de diseño: los pares de montos del handoff dejan de ser el mismo valor. Un usuario sin actividad en dólares no ve ninguna línea USD, y la pantalla se lee como monomoneda — que es el caso mayoritario y una mejora, no una pérdida.

### D2 — El ritmo es `gastaste / entró` del mes, y sus bordes son la regla, no la excepción

El handoff define ritmo = `Gastaste / ingreso mensual esperado`, con `4.000.000` de mock. Ese dato **no existe** en el schema y no hay nada de dónde derivarlo. Se resuelve usando los **ingresos reales acreditados del mes** (`MonthBalanceSeries.totalIncome`), que ya se lee para "Resumen del mes" — cero infraestructura, cero configuración.

El costo hay que asumirlo de frente: con este denominador, **dos estados que el README trataba como borde pasan a ser habituales**.

- **Denominador 0** (día 1 del mes, antes de que entre el sueldo): el ritmo es *indeterminado*, no 0%. Se muestra el mensaje en lugar del anillo, como ya pedía el README.
- **Ritmo > 100%**: normal a principio de mes, o en cualquier mes donde se gastó más de lo que entró. Anillo y barra pasan a terracota (`#C2705C`) y el copy se ajusta. Deja de ser una alarma rara y pasa a ser un estado de primera clase, con su propio test.

El ritmo se computa **por moneda**, coherente con D1.

### D3 — Un solo anillo, el de ARS; el ritmo USD no se renderiza

D1 y D2 combinados producirían dos ritmos (uno por moneda) y el handoff tiene lugar para un anillo. Se renderiza **solo el de ARS**.

Por qué no dos anillos: el ritmo USD sería casi siempre indeterminado (pocos usuarios acreditan ingresos en dólares todos los meses) y un segundo anillo mostrando "sin datos" al lado del real es ruido, no información. Por qué no un anillo consolidado: requeriría sumar monedas, prohibido por D1. El pie de la tira sí muestra los montos ARS que forman el cociente (`$ gastaste de $ entró`), de modo que el número es auditable de un vistazo.

### D4 — Las derivaciones viven en `@grana/dashboard` como funciones puras

Ritmo, porcentajes de la barra apilada de Compromisos, porcentajes de cuenta sobre el total de su moneda, `teQuedaPorPagar` y el conteo de compras pendientes se implementan como **funciones puras** en el package compartido, no en los componentes. Es el requirement vigente *"Las queries y agregaciones del dashboard viven en un package compartido"* y es lo que permite que web y mobile den el mismo número y que los estados borde (denominador 0, >100%, sin cuentas) se testeen sin montar UI.

### D5 — "Compromisos · Tarjetas" se agrega por tarjeta, no por consumo

Es el único cambio de **forma de dato** del change. `CommittedCurrency.topCard` es hoy una lista de consumos individuales (`CommittedItem`: description / date / amount). El handoff necesita una fila **por tarjeta** con su total y su próximo cierre.

Se agrega un tipo nuevo al package (una fila por tarjeta: nombre, total, fecha de próximo cierre) y `getCommittedOutlook` lo produce agrupando el conjunto "A pagar" por tarjeta. `topCard` se retira una vez que ningún consumidor lo use; mientras tanto conviven, para que el cambio de forma no obligue a reescribir la card de tarjetas en el mismo paso.

El listado muestra hasta 3 tarjetas cerrado y el resto al desplegar, con el corte calculado sobre la lista ordenada por monto desc — no un `slice` en el markup, para que el "resto" sea siempre el complemento exacto.

### D6 — Los desplegables son `<button>` + panel con `id`, con el estado en React

El prototipo hace `classList.toggle('open')` sobre un `div`. Se implementa como `<button aria-expanded aria-controls>` con el panel identificado por `id` y el estado en React (`expandedGroups: { tarjetas, gastosFijos }`), independientes entre sí. La rotación del chevron es la única transición (`transform .18s ease`), coherente con el handoff. Área táctil ≥44px en mobile.

### D7 — La card 1 es una card, no tres apiladas

Hero, "Dónde está" y "Resumen del mes" se fusionan en **un componente contenedor** con dos zonas (oscura y clara) y un solo borde exterior de radio 20px. No se conservan `HeroSection` + `AccountsCard` + `MonthBalanceSection` como cards independientes maquetadas para parecer una: el separador interno es un `border-top`, y los sub-bloques de la zona oscura van limitados a `max-width:660px` centrados para que en desktop los datos no se dispersen.

Consecuencia de streaming: las tres zonas se alimentan de **dos** lecturas distintas (saldo/cuentas, que no dependen del mes; y el balance del mes, que sí). Como ahora comparten card, el `Suspense` envuelve la card entera con un único skeleton shape-matched, en lugar de tres. Se pierde algo de streaming granular a cambio de que la card no se arme a saltos delante del usuario.

### D8 — "Cuánto gastaste" deja de ser condicional

Hoy la sección desaparece si no hubo consumo de tarjeta. Pasa a renderizarse siempre que haya gasto en el mes, con "Te queda por pagar" en cero cuando no hay tarjeta — que es información, no vacío. Sin ningún gasto en el mes, la card muestra su estado vacío en lugar de desmontarse: una card que aparece y desaparece según el mes que estás mirando es peor que una card en cero.

### D9 — La baja de "En qué se fue" es del dashboard, no de la capability

Se retiran del dashboard los componentes de la dona y su leyenda en ambas plataformas, pero `getMonthCategoryBreakdown` **sigue consumiéndose** desde el dashboard: es la fuente del devengado que alimenta "Gastaste". La capability `spending-by-category` conserva su superficie en Movimientos, así que la baja es de una duplicación, no de una funcionalidad.

## Risks / Trade-offs

- **Superficie grande, semántica estable.** El change toca casi todos los componentes del dashboard en dos plataformas, pero no redefine ningún número: los tres montos de "Cuánto gastaste" ya se calculan así y ya reconcilian. El riesgo está en la maqueta y en la paridad web/mobile, no en la contabilidad.
- **La agregación por tarjeta (D5) es el punto blando.** Es la única forma de dato nueva y depende de resolver el próximo cierre de cada tarjeta. Se mitiga con tests sobre la agregación antes de montar la UI.
- **El ritmo va a incomodar al principio.** Con `entró` como denominador, un usuario que mira el dashboard el día 2 del mes ve "sin datos" y el día 5 ve 300%. Es fiel a la realidad y es la decisión tomada, pero conviene que el copy de ambos estados lo explique en vez de limitarse a pintar de rojo.
- **Menos streaming granular en la card 1** (D7): si la lectura del mes se demora, el saldo —que ya está listo— espera. Se acepta a cambio de que la card no se arme a saltos.
- **Cards de igual altura en la fila 2** con contenido de alto variable (la lista de gastos fijos tiene scroll interno, la de tarjetas no): se resuelve con el `margin-top:auto` de la tira de ritmo, como indica el handoff, pero es frágil ante cambios de contenido y necesita verificación en los anchos de corte.

## Migration Plan

No hay migración de datos ni de schema. La secuencia es incremental y cada paso deja el dashboard funcionando:

1. Derivaciones puras y sus tests en `@grana/dashboard` (sin tocar UI).
2. Agregación por tarjeta en `getCommittedOutlook`, conviviendo con `topCard`.
3. Card por card en web, empezando por la 1 (la de mayor fusión) y terminando por la tira Compartido.
4. Espejo en mobile con el naming en PascalCase.
5. Baja de los componentes de la dona en las dos plataformas y limpieza de claves i18n huérfanas.
6. Archivo del change y sincronización de los master specs.

## Open Questions

- **Próximo cierre por tarjeta**: hay que confirmar que el dato sale del módulo Tarjetas sin una lectura extra pesada; si la sale cara, la bajada del grupo puede mostrar solo el conteo de tarjetas en la primera iteración.
- **Copy exacto de los dos estados del ritmo** (indeterminado y >100%): se propone texto en la implementación para revisión del usuario, no se decide acá.
- **Conteo de compras pendientes** del tile "Te queda por pagar": el handoff pide "5 compras con tarjeta de crédito". Hay que definir si cuenta consumos o cuotas cuando hay compras en cuotas — se propone contar **consumos** (una compra en 6 cuotas es una compra), a confirmar contra lo que muestra `/cards`.
