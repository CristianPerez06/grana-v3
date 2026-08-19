# Gastos fijos y Tarjetas — handoff visual

## Por qué estas dos pantallas

Feedback de la PO: *"al usuario hoy le sirve más una planilla sencilla de Excel que nuestra app."*

Desmenuzando la planilla de referencia (`Gastos`, cuenta real), tiene cuatro bloques:

| Bloque de la planilla | ¿Grana lo responde? |
|---|---|
| 1 · Lista de gastos fijos con su total | 🟡 Existe en `/transactions/recurring`, a 2 taps dentro de un módulo que no lo nombra, **sin total** |
| 2 · Una columna por tarjeta con sus consumos y total | 🟡 Existe, pero **una ruta por tarjeta** — hay que entrar a cada una y sumar de cabeza |
| 3 · Bloque USD | 🟢 Bimoneda nativa, mejor que la planilla |
| 4 · Tres números arriba (entra / sale / queda) | 🟢 Resuelto en `design_handoff_inicio_definitivo` (card "Próximos compromisos") |

**Los bloques 3 y 4 ya están.** Este bundle ataca **1 y 2** — que son exactamente donde Excel
todavía gana.

## Base visual

`shared.css` es **copia literal** de `docs/design_handoff_inicio_definitivo/cards/cards.css`
(tokens y componentes ya aprobados) más un bloque acotado al final con las clases nuevas.
Cero paletas nuevas, cero tipografías nuevas. Los componentes reusados son `.card`, `.hero`,
`.netbar`, `.scalebox`, `.seg`, `.hint` y `.link`.

## Pantalla 1 · Gastos fijos — `/fijos`

Es el hub de recurrencias **sacado de Movimientos y renombrado por lo que el usuario piensa
que es**: "mis gastos fijos", no "reglas recurrentes".

Lo que agrega respecto de `/transactions/recurring` actual:

- **Total mensual** (`.netbar`), en bimoneda. Hoy no existe: el hub lista reglas y no las suma.
- **División caja vs. tarjeta** (`.scalebox`). Es la distinción que decide si un fijo te pega en
  el disponible o te llega por resumen. Ya está en los datos (`account.type`), no se muestra.
- **Pill Exacto / Estimado** — el campo `amount_is_estimated` propuesto en
  `ui-readability-simplification.md` §4bis.3. Expensas y luz cambian todos los meses; hoy hay
  que corregirlas a mano cada vez.
- **El cierre que la planilla no da**: *"Tus gastos fijos son el 89% de tus ingresos."*

### Datos: todos existen

`getRecurrences` ya trae las reglas con monto, moneda, cuenta, categoría y frecuencia.
El total es una suma; el corte caja/tarjeta es un `join` a `accounts.type`. **Sin queries
nuevas, sin migraciones** (salvo `amount_is_estimated`, que es una columna).

## Pantalla 2 · Tarjetas — `/cards`

El hero "A pagar / En curso" **ya existe y se conserva tal cual** (`cards-month-hero.tsx`).
Lo nuevo son dos bloques:

- **Cuotas en curso, global.** Hoy `CuotasEnCursoPane` suma las cuotas **por tarjeta**, dentro
  del detalle. Falta la vuelta global: cuánto debés en cuotas en total, cuántas compras, hasta
  cuándo. Es la pregunta argentina por excelencia y hoy cuesta 4 taps por tarjeta.
- **Mis tarjetas con su resumen del mes.** Cada tarjeta con su total en curso, cierre y
  vencimiento, en una sola vista. **Es literalmente el bloque 2 de la planilla**, sin tener que
  armarlo a mano.

### Datos: todos existen

`getCreditCards` + `computePeriodAmounts` (`@grana/cards`) ya calculan todo por tarjeta.
Falta agregarlos, no calcularlos.

## Comparación con lo que Grana muestra HOY

_Leído del código, ruta por ruta (`route-ui-system.md` lo exige antes de diseñar). Esta
sección corrige la propuesta original, que sobrevendía la novedad de `/cards`._

### `/cards` — hoy

`cards/page.tsx` compone tres secciones: `CardsMonthHeroContainer` → `WalletContainer` →
`ArchivedCardsContainer`.

| Bloque | ¿Existe hoy? | Dónde |
|---|---|---|
| Hero "A pagar" + "En curso", bimoneda | ✅ **Sí** | `cards-month-hero.tsx` |
| "Próximos cierres" (capado en 3) | ✅ **Sí** | mismo hero, columna derecha |
| **Lista de tarjetas con total del mes, cierre, vence y % de uso** | ✅ **Sí — y mejor que mi mock** | `cards-compact-view.tsx`: agrupa por banco, con subtotal "A pagar" por grupo y pill de vencimiento |
| Tarjetas archivadas | ✅ Sí | `archived-cards-container.tsx` |
| **Cuotas en curso, total global** | ❌ **No** | solo `CuotasEnCursoPane`, **dentro** del detalle de cada tarjeta |

**Corrección:** la card "Mis tarjetas" de mi mockup **ya existe**. Lo que hoy hace
`CardsCompactView` cubre el bloque 2 de la planilla mejor de lo que yo lo dibujé — agrupa por
banco y muestra el uso del límite, cosas que mi mock ni tenía.

**El único hueco real en `/cards` es el bloque de cuotas global.** Todo lo demás está.
En el mock, la card "Mis tarjetas" queda como **contexto**, no como propuesta.

### `/transactions/recurring` — hoy

`recurring/page.tsx` compone: `PendingRecurrencesBlock` → `UpcomingRecurrences` →
`RecurringTabs`.

| Bloque | ¿Existe hoy? | Dónde |
|---|---|---|
| Pendientes de confirmar, con edición inline | ✅ Sí | `pending-recurrences-block.tsx` |
| "Próximos 7 días" / "Más adelante este mes" | ✅ Sí | `upcoming-recurrences.tsx` |
| Tabs Activas / Pausadas / Finalizadas con contador | ✅ Sí | `recurring-tabs.tsx` |
| Monto por regla | ✅ Sí | dentro de las tabs |
| **Total mensual de los fijos** | ❌ **No** | — |
| **Corte "sale de tu caja" vs. "va a tarjeta"** | ❌ **No** | el dato está en `accounts.type`, no se usa |
| **Exacto vs. Estimado** | ❌ **No** | requiere `amount_is_estimated` |
| **Comparación contra los ingresos** | ❌ **No** | — |
| **Nombre que el usuario reconozca** | ❌ No | se llama "Recurrencias", no "Gastos fijos" |

**El hub existe y está bien construido — pero lista reglas sin sumarlas.** Esa es la
diferencia con la planilla: Excel te da el total abajo de la columna. Grana te da 20 filas.

### El delta real de este bundle

Sacando lo que ya está, lo que estas pantallas realmente proponen es:

| # | Propuesta | Costo |
|---|---|---|
| 1 | **Total mensual de fijos** + corte caja/tarjeta + comparación contra ingresos | Bajo — suma sobre `getRecurrences` + join a `accounts.type` |
| 2 | **Cuotas en curso global** (total, cantidad, hasta cuándo) | Bajo — `CuotasEnCursoPane` ya suma por tarjeta; falta la vuelta global |
| 3 | **Pill Exacto / Estimado** | Una columna: `amount_is_estimated` |
| 4 | **Renombrar y sacar de Movimientos** ("Gastos fijos", ruta propia) | Ruteo y copy |

Cuatro cosas, ninguna con query nueva. **El resto del mockup es Grana como ya es.**

## Lo que estas pantallas NO hacen

- **No proyectan el mes que viene.** Muestran lo que ya está cargado y comprometido. La
  proyección está bloqueada por cobertura de datos (11,9%) — ver
  `ui-readability-simplification.md` §6bis.
- **No tocan Inicio.** Ese handoff está cerrado.
- **No tocan reglas contables.** Bimoneda sin sumar, tarjetas off-ledger, cuotas por su mes.

## Preguntas abiertas

1. **¿"Gastos fijos" es ruta propia o vive dentro de otro módulo?** Como ruta propia gana
   acceso pero suma un ítem de navegación.
2. **¿El total mensual debería descontar lo pausado?** Hoy el hub separa activas / pausadas /
   finalizadas; el total del mock cuenta solo activas.
3. **¿"Cuotas en curso" va en `/cards` o merece su propia superficie?** Está creciendo.
4. **La línea "89% de tus ingresos" necesita un ingreso de referencia.** ¿Recurrencias de tipo
   `income`, o el promedio de los últimos 3 meses?

## Archivos

- `shared.css` — base copiada del handoff de Inicio + clases nuevas al final
- `index.html` — las dos pantallas, con su ruta declarada
