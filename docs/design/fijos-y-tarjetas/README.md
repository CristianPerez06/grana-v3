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
