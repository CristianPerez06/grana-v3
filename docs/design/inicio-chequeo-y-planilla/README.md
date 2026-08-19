# Inicio — chequeo y planilla en una sola superficie

## El problema

Dos hallazgos convergentes que apuntan en direcciones opuestas:

- **`PROPUESTA-INICIO-2026-07-31.md`**: ~90% de las aperturas duran **4 segundos** y traen una
  sola pregunta ("¿puedo?"); ~10% son revisión. El Inicio está diseñado 100% para revisión y
  **no existe ninguna superficie de chequeo**.
- **Feedback de usuario**: lo que sirve es **una planilla de Excel** — el mes entero legible de
  una vez.

Decisión de la PO: **las dos cosas van en Inicio**, no en pantallas separadas (que era la
propuesta de Codex, con `Inicio` + `Resumen del mes` como tabs distintas).

## La regla que lo resuelve

Las dos zonas no compiten porque **responden a tiempos distintos**:

```
ZONA A · CHEQUEO     siempre hoy      →  "¿puedo?"        4 segundos
ZONA B · PLANILLA    el mes elegido   →  "¿cómo vengo?"   3 minutos

El selector de mes gobierna B. A es siempre hoy.
Al moverte a otro mes, A se colapsa a una línea — tu disponible no
cambia por mirar julio — y la planilla ocupa la pantalla.
```

Esto no inventa un patrón: aprovecha el selector de mes que ya existe y lo convierte en el
divisor natural entre las dos lecturas. **Sin tabs, sin modos de usuario** (prohibidos por
`AGENTS.md`), sin que el usuario elija nada.

## Las tres opciones

| | Cómo | A favor | En contra |
|---|---|---|---|
| **A** | Scroll progresivo: una página, dos zonas | Cero navegación, cero estados, la más barata | La planilla siempre a un scroll; desperdicia el ancho en desktop |
| **B** | La planilla se abre desde una card | Inicio realmente corto; el resumen asoma en el propio expander | Suma un estado; lo plegado se descubre menos |
| **C** | Desktop dos columnas (chequeo sticky \| planilla scroll), mobile = A | **Todo visible sin scrollear**; enseña la separación sin explicarla | Dos layouts; la más cara |

**Recomendada: C**, con A como su versión mobile. Es la única que cumple literal "que esté todo
en el Inicio" sin castigar al que entra 4 segundos, y usa el grid de dos columnas que
`design_handoff_inicio_definitivo` ya definió.

## Correcciones que las tres incorporan

Vienen del cruce con la pantalla real de producción (19/08/2026) y con el mock de Codex:

1. **El hero muestra el disponible real** ($ 8.073.533), no la diferencia del mes. En el mock de
   Codex el hero decía "EN TUS CUENTAS HOY $ 473.883", que es la **diferencia del mes** — un
   flujo rotulado como stock, exactamente el error que este pase viene a corregir.
2. **"Salidas por bloque" separa pago de resúmenes de gastos de caja.** Hoy la card "Balance del
   mes" los pone como barras hermanas, y "Pago de tarjeta" ($ 698.998,87) llena la barra al
   100% — dominando visualmente una card que pretende contar el mes, cuando es cancelación de
   deuda vieja.
3. **"Gastaste este mes" declara su lente** y muestra qué parte todavía no salió de las cuentas
   ($ 388.873 en tarjeta, 82% del consumo del mes).
4. **USD va aparte**, sin convertir ni sumar (invariante Bimoneda).

## Datos

Reales, de la pantalla de producción del 19/08/2026. Agosto muestra muy poco ingreso
($ 20.000,38) porque es lo que hay cargado — no se maquillaron los números para que el mock
quede lindo.

## Costo

**Ninguna opción agrega una query.** Todos estos números ya se consultan:
`getDashboardHero`, `getMonthBalanceSeries`, `getMonthCategoryBreakdown`,
`getCommittedOutlook`, `getCreditCards`. Lo que cambia es la composición y el rotulado.

La excepción es "Salidas por bloque" si se quisiera abrir a **Fijos vs. Variables** (como
proponía Codex): eso **no** es dato existente. Se podría derivar de "¿tiene recurrencia
asociada?", que sí lo es — pero hay que decidirlo, no darlo por hecho.

## Preguntas abiertas

1. **¿Qué pasa con las cards de tu `Inicio Definitivo` que acá no aparecen?** "Distribución del
   ingreso" (toggle Libre real) y "Economía compartida" no están en estos mocks. La primera
   encaja natural en la zona B; la segunda es condicional y podría ir al pie.
2. **¿"Lo que pide atención" reemplaza a "Comprometido"?** Acá muestra solo lo accionable
   (vencido + recurrencia atrasada). El total comprometido pasaría a la zona B.
3. **En desktop chico (~1000px), ¿C cae a una columna o achica?**
4. **¿Los últimos movimientos van en la zona A?** Están en B y C pero no en A por espacio.

## Archivos

- `shared.css` — base de `design_handoff_inicio_definitivo/cards/cards.css` + comparador
- `index.html` — las tres opciones con la regla arriba
