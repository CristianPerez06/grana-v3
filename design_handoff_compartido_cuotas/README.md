# Handoff: Detalle de movimiento — gasto compartido en cuotas (y con reintegro)

## Overview
El detalle de movimiento de Grana ya cubre gasto simple, en cuotas, compartido, con reintegro, recurrente, ingreso y transferencia. Faltaban dos **casos combinados** que hoy no se visualizan bien en la app:

1. **Compartido + cuotas** — un gasto dividido entre varias personas, pagado con tarjeta de crédito en N cuotas. Hoy, cuando el gasto es en cuotas, la pantalla no muestra en ningún lado que además es compartido.
2. **Compartido + cuotas + reintegro** — lo mismo, pero además con un reintegro acreditado sobre la compra.

Este bundle contiene los dos diseños en HTML, más los tres casos base ya existentes como referencia de patrón.

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML**: prototipos que muestran el look y el comportamiento buscado, **no código de producción para copiar tal cual**. La tarea es **recrear estos diseños en el entorno del codebase destino** (React Native / React / lo que use la app) usando sus patrones, componentes y tokens ya establecidos. `panel.css` está para leer valores exactos, no para importar.

Ambas pantallas reutilizan el mismo sistema de tiles que ya existe en los otros tipos de movimiento. **No hay componentes nuevos**: solo composiciones nuevas de bloques existentes, más dos micro-patrones (`.psplit`, `.share-sub`, `.infobar`) descritos abajo.

## Fidelity
**High-fidelity.** Colores, tipografía, espaciados y jerarquía son finales. Recrear pixel-perfect con las librerías del codebase. El layout está diseñado para mobile (390px) y aguanta hasta 760px (la grilla pasa de 1 a 2 columnas en `≥601px`).

---

## Screen 1 — Gasto compartido en cuotas
Archivo: `tipo-cuotas-compartido.html`

**Propósito:** el usuario entiende de un vistazo cuánto le toca pagar **a él, este mes**, y que el resto lo debe la otra persona, sin perder de vista el total de la compra.

**Regla de diseño central:** el número grande NO es el total de la compra ni el total de la cuota — es **tu mitad de la cuota del mes**. Todo lo demás es contexto.

### Orden de los bloques (mobile, una columna)
1. **Topbar** — a la izquierda "‹ Movimientos"; a la derecha dos botones circulares de 38px: **eliminar** (ghost, sin fondo ni borde, ícono muted) y **editar** (círculo sólido `--navy` con lápiz blanco). Es el patrón que ya usa la app: no hay "···", ni duplicar, ni CTA fija abajo.
2. **Hero** — ícono 88px (72 en mobile), título, monto total de la compra en terracota (`−$57.800,00`), y subtítulo `hero-flow`: **"Gasto compartido entre 2 personas · en 3 cuotas"**. Este subtítulo es la primera señal de que el movimiento es compartido y en cuotas a la vez.
3. **Chips del hero** — fecha, `2 personas` (chip tonal), `Visa Santander`, categoría, subcategoría. Todos con `white-space: nowrap` (si no, se parten adentro de la píldora).
4. **Infobar** (azul claro) — "Este consumo no afecta tu disponible hasta que pagues el resumen de julio de 2026." Solo aparece cuando el medio de pago es tarjeta de crédito.
5. **Tile "Te toca pagar"** — `$ 9.633,34` en 34px terracota; abajo "tu mitad de cada cuota de $ 19.266,68"; línea separada abajo: "Tu parte total → $ 28.900,00".
6. **Tile "Pagado con"** — badge ámbar + "Santander / Visa · pagaste el total"; meta abajo: "Te deben $ 28.900,00 en total".
7. **Tile "En cuotas"** (ancho completo) — "Cuota 1 de 3", barra de 3 segmentos (pagados en terracota, pendientes en `#ECEFF3`), leyenda de **dos filas**: fila 1 = totales de la compra (`$ 19.266,68 pagado` / `$ 38.533,32 restan`), fila 2 = lo tuyo (`De eso, $ 9.633,34 es tu parte` / `$ 19.266,66 tuyo restan`). Pie: "Próxima: 23 ago 2026 · termina 23 sept 2026" (fechas con `nowrap`).
8. **Tile "Dividido entre"** (ancho completo) — aside con "$ 28.900,00 c/u · $ 9.633,34 por cuota"; una fila por persona: avatar 38px, nombre, debajo el chip de estado (`Tu parte` tonal / `Te debe` ámbar / `Saldado` verde) + una nota corta, y a la derecha el monto total de esa persona con el desglose por cuota debajo (`$ 9.633,34 × 3`).
9. **Tile "Detalle"** — fila 1: Compra total `$ 57.800,00` / En cuotas `3 × $19.266,68`. Fila 2: Tu parte `$ 28.900,00` / Impacta en tu mes `$ 9.633,34`.
10. **Tile "Descripción"** — nota libre + botón Editar.
11. **Tile "Peso en el mes"** — anillo de categoría; el texto aclara que **se cuenta tu parte de la cuota**, no la compra entera.

---

## Screen 2 — Compartido + cuotas + reintegro
Archivo: `tipo-cuotas-compartido-reintegro.html`

**Propósito:** mismo caso, pero la compra tuvo un reintegro acreditado. El reintegro cambia la base de todos los demás números, así que va **primero**.

### Diferencias respecto de Screen 1
- **Hero flow:** "Compartido entre 2 personas · 3 cuotas · con reintegro". Se agrega un chip verde "Reintegro acreditado".
- **Tile nuevo arriba de todo: "Resultado neto"** (ancho completo, es el primer tile):
  - Ecuación en 3 columnas: `Compra −$ 57.800` **+** `Reintegro +$ 11.560` **=** `Costo neto −$ 46.240`.
  - Debajo, fila de movimiento vinculado: "Reintegro asociado / Promo tienda · acreditado el 30 jul", monto `+$ 11.560` en verde, chevron (navega al movimiento del reintegro).
  - Cierre: **"Se divide el neto, no la compra → $ 23.120,00 c/u"**. Esta línea es la regla de negocio que evita la ambigüedad.
- **"Te toca pagar"** pasa a mostrar el **neto**: `$ 23.120,00` ("tu mitad de $ 46.240,00 después del reintegro"), con "En la cuota de este mes → $ 9.633,34" y la aclaración "Antes del reintegro · ya acreditado aparte".
- **"En cuotas"**: la barra sigue midiendo el importe **bruto** de la tarjeta (lo que el banco cobra), y la segunda fila de la leyenda aclara "(antes del reintegro)" + "reintegro ya acreditado".
- **"Dividido entre"**: montos **netos** por persona (`$ 23.120,00`) con el desglose `$ 28.900 − $ 5.780` debajo.
- **"Detalle"**: fila 2 pasa a Reintegro `+$ 11.560,00` / Tu parte neta `$ 23.120,00`.
- **"Pagado con"** meta: "Te deben $ 23.120,00 netos".

### Modelo de cálculo (implementar así)
```
compra          = 57.800,00
reintegro       = 11.560,00           (20%)
neto            = compra − reintegro  = 46.240,00
tu_parte_neta   = neto / personas     = 23.120,00
cuota_bruta     = compra / n_cuotas   = 19.266,68     ← lo que cobra la tarjeta
tu_cuota_bruta  = cuota_bruta / personas = 9.633,34   ← impacto mensual en tu mes
tu_reintegro    = reintegro / personas = 5.780,00
```
Regla: **el reintegro se divide igual que el gasto**; las cuotas siempre se muestran en bruto porque es lo que efectivamente debita la tarjeta.

---

## Interactions & Behavior
- **Fila de reintegro asociado** (`.linked`): tappable, navega al movimiento del reintegro. Chevron a la derecha.
- **Fila de persona** (`.prow`): tappable → hoja de "marcar como saldado" / recordatorio (comportamiento ya existente en el caso compartido).
- **Botón Editar** de la descripción: abre edición inline de la nota.
- **Editar / Eliminar**: solo desde los dos botones circulares del topbar. Eliminar pide confirmación.
- **Chips y tiles** no tienen animaciones propias; hovers solo en desktop (`.iconbtn:hover` → `--field`).
- **Estados por persona:** `Tu parte` (tonal), `Te debe` (ámbar), `Saldado` (verde). Cuando todas las personas están saldadas, la meta de "Pagado con" debería decir "Ya te pagaron todo" (no está en el mock).

## Estados / variantes a contemplar en la implementación
- 2 o más personas (la lista crece; el aside "c/u" solo aplica si el reparto es en partes iguales — si es desparejo, ocultar el "c/u").
- Cuota N de M con N > 1 (más segmentos en terracota).
- Reintegro **pendiente** (no acreditado): el chip verde pasa a ámbar "Reintegro pendiente", el neto se muestra como estimado y "Te toca pagar" debería mostrar el bruto con la nota del neto estimado.
- Medio de pago débito/efectivo: se oculta la infobar del resumen y el tile de cuotas.

## Design Tokens (de `panel.css`)
```
--bg #F6F7F9   --card #FFFFFF   --navy #0B1A2B   --ink #142231
--muted #6B7683  --soft #8C97A4  --faint #AEB6C0
--border #E6EAEF  --border-soft #EEF1F4  --field #F1F3F6
--emerald #10B981  --emerald-deep #0E9E6E  --emerald-soft #E7F8F0
--terracota #B56A5A  --terracota-soft #FBEFEA  --terracota-deep #9A5446   ← tono "gasto"
--slate #3A6B8A  --slate-soft #EAF1F6  --slate-deep #2C5269
--plum #8C7AA0  --amber #B58A1E  --amber-soft #FBF3DE  --brand #15B981
Infobar (solo en estas pantallas): bg #EDF3FA, borde #D8E4F0, texto #41566E, ícono #6E8BAA
```
**Tipografía:** Plus Jakarta Sans (400/500/600/700/800). Montos con `font-variant-numeric: tabular-nums`.
- Hero monto 60px/800/−0.045em (46px en mobile) · Hero título 29px/800 · hero-flow 14,5px/600 muted
- Tile eyebrow 11px/800, uppercase, tracking .13em, muted
- `share-big` 34px/800/−0.04em en `--tone` (30px en mobile)
- `cuota-now` 27px/800 (24px mobile) · leyendas 13px/600
- Nombre de persona 14,5px/700 · monto de persona 15px/800 · sub-línea 11,5px/600 muted
- Chip de estado 11px/700, radio 999px

**Radios:** hero 24px · tile 20px · chip 999px · badge de cuenta 14px · ícono de hero 26px
**Espaciados:** gap de grilla 16px · padding de tile 24/26px (20/18 en mobile) · gap entre filas de persona 12px con separador `--border`

## Notas de implementación (bugs que ya pisamos)
- Las filas tipo `.source-meta` / `.cuota-next` son flex: si el texto va suelto, cada nodo se vuelve un ítem y la frase se parte con gaps raros. **Envolver la frase entera en un solo elemento de texto** y aplicar `nowrap` solo a montos y fechas.
- No aplicar `nowrap` a líneas largas (ej. la descripción del reintegro asociado): fuerza el min-content de la grilla y desborda toda la pantalla en mobile.
- En mobile la fila de persona debe ser de **3 columnas** (avatar / nombre+estado / monto). Si el chip de estado va como cuarta columna, los montos se parten en dos líneas.

## Assets
Ninguno externo. Íconos: SVG inline stroke-based (24×24, `stroke-width` 2–2.4, linecap/linejoin round) — reemplazar por el set de íconos del codebase. Emojis de categoría (📦) son placeholders del ícono de categoría real.

## Files
- `tipo-cuotas-compartido.html` — Screen 1
- `tipo-cuotas-compartido-reintegro.html` — Screen 2
- `panel.css` — tokens y clases compartidas de todo el detalle de movimiento
- `referencia/tipo-compartido.html` — caso compartido simple (patrón de "Dividido entre")
- `referencia/tipo-cuotas.html` — caso cuotas simple (patrón de barra de cuotas)
- `referencia/tipo-reintegro.html` — caso reintegro simple (patrón de "Resultado neto")
