# Handoff: Módulo Tarjetas (grana)

## Overview
Módulo **Tarjetas** de la app grana (finanzas personales, español rioplatense). Cubre dos pantallas:

1. **Listado de tarjetas** (`Grana - Tarjetas.html`) — wallet con todas las tarjetas de crédito del usuario, un hero "A pagar este mes" que agrega todas las tarjetas, y el timeline de próximos vencimientos.
2. **Detalle de una tarjeta** (`Grana - Tarjeta (detalle).html`) — el resumen de una tarjeta puntual, organizado según el **ciclo de vida del resumen**: lo que hay que pagar, lo que está en curso y lo que viene, más sus movimientos y el cronograma de cuotas.

El módulo está pensado para el mercado argentino: tarjetas de crédito con **cierre y vencimiento mensuales**, **compras en cuotas**, y consumos en **ARS y USD** en simultáneo.

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML/CSS/JS vanilla** — prototipos que muestran el look & feel y el comportamiento esperado. **No son código de producción para copiar tal cual.** La tarea es **recrear estos diseños en el entorno del codebase real** (React, Vue, etc.) usando sus patrones, componentes y librerías ya establecidos. Si no hay entorno aún, elegir el framework más apropiado e implementarlos ahí.

Los datos en los archivos (montos, comercios, fechas) son **datos de ejemplo (mock)** para ilustrar estados; deben venir del backend real.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado e interacciones son finales y siguen el sistema visual de grana (es consistente con la pantalla de Movimientos v3 ya existente). Recrear pixel-perfect usando las librerías del codebase. Reutilizar componentes existentes de grana donde apliquen (sidebar, chips de categoría, filas de movimiento, botones).

---

## Sistema visual (tokens)

### Colores
| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#F6F7F9` | Fondo de la app |
| `--card` | `#FFFFFF` | Fondo de cards |
| `--navy` | `#0B1A2B` | Texto principal, botón primario, tab activo, item de nav activo |
| `--muted` | `#6B7683` | Texto secundario |
| `--border` | `#E6EAEF` | Bordes y divisores |
| `--emerald` | `#10B981` | Punto "en vivo", positivo |
| `--emerald-deep` | `#0E9E6E` | Texto de disponible/al día |
| `--terracota` | `#B56A5A` | Montos negativos (gastos), estado "a pagar"/urgente |
| `--slate` | `#3A6B8A` | Acento secundario, avatar usuario, acento marca Amex |
| `--brand` | `#15B981` | Verde grana (logo) |
| `--amber` | `#9A7B22` | Estado "cierra pronto" (texto); fondos amber `#FBF3DE` / `#F4E3B8` |

**Acentos por marca de tarjeta** (color de la franja izquierda en el listado y de los acentos en el detalle):
| Tarjeta | Acento |
|---|---|
| Visa Galicia | `#F4A024` (naranja) |
| American Express | `#3A6B8A` (slate) |
| Naranja X | `#8C7AA0` (plum) |

> El acento es **por tarjeta**, configurable. Se inyecta como variable CSS `--cc-accent` y tiñe: franja lateral, avatar/inicial, barra de límite, ring de selección, dots de progreso de cuotas.

**Tints de ícono de categoría** (fondo del cuadrado del ícono en filas de movimiento):
`--ic-food #F6EBDD` · `--ic-subs #ECE6F3` · `--ic-home #DEEAF3` · `--ic-market #DEF1E7` · `--ic-tech #E1E9F2` · `--ic-fuel #F6E7E2` · `--ic-health #E8F0F5` · `--ic-shop #F1ECE4`

**Estados (pills):**
- `due` (vence pronto): fondo `#F6E7E2`, texto `#9A4B38`, dot `#B56A5A`
- `soon` (cierra pronto): fondo `#FBF3DE`, texto `#9A7B22`, dot `#C99A2E`
- `ok` (al día): fondo `#DEF1E7`, texto `#0E9E6E`, dot `#10B981`
- `a pagar` (zona urgente): fondos `#FAF0EC`/`#FBF1ED`, borde `#EEDAD2`, texto `#6E3325`/`#9A4B38`

### Tipografía
- Familia: **Plus Jakarta Sans** (Google Fonts), pesos 400/500/600/700/800. Fallback `system-ui, sans-serif`.
- Todos los montos y fechas usan `font-variant-numeric: tabular-nums` (clase `.tnum`).
- Escala usada:
  - H1 título de pantalla: 30px / 800 / letter-spacing -0.03em
  - Monto hero "a pagar": 56px / 800 / -0.045em
  - Monto "en curso": 40px (52px cuando es hero) / 800 / -0.04em
  - Montos de card en listado: 19px / 800
  - Títulos de sección (H2): 19-20px / 800
  - Eyebrow/labels: 11-12px / 700-800 / UPPERCASE / letter-spacing .1-.16em
  - Body: 14-15px / 500-600
  - Captions: 12.5-13.5px / 500

### Espaciado / formas
- Radios: cards grandes `22px`, cards medianas `16-20px`, pills `999px`, íconos `11-15px`, botones `11-12px`.
- Sombra de hover en cards: `0 8px 22px -14px rgba(11,26,43,.28)`.
- Ancho de contenido: columna central `max-width: 1040px`, centrada, padding lateral 40px.
- Layout general: sidebar fija `300px` + main fluido. Diseñado a `1440px`.

---

## Pantalla 1 — Listado de tarjetas

**Archivo:** `Grana - Tarjetas.html` · **Ruta sugerida:** `/tarjetas`

### Layout (de arriba a abajo, en la columna central)
1. **Header**: H1 "Tarjetas" + subtítulo ("N tarjetas de crédito · resúmenes de <mes>"). A la derecha: botón ghost "Resúmenes anteriores" + botón primario "Agregar tarjeta" (con ícono +).
2. **Hero "A pagar este mes"** (card, grid de 3 columnas `1fr / 1px / 380px`):
   - Izquierda: eyebrow "A PAGAR ESTE MES", monto grande en ARS (52px), línea con el total en USD aparte (los consumos en dólares **no se convierten**, se muestran separados), y una caja amber con el próximo vencimiento destacado.
   - Divisor vertical.
   - Derecha: eyebrow "PRÓXIMOS VENCIMIENTOS" + lista de filas (día/mes + nombre + caption "cierra/vence" + monto).
3. **Sección "Mis tarjetas"**: H2 + hint "Tocá una para ver el resumen".
4. **Wallet** (grid 2 columnas, gap 20px): una card por tarjeta (ver abajo).

### Card de tarjeta (wallet) — **dirección elegida: "A · Sobrio"**
- Card blanca, borde `--border`, radio 20px, padding `22px 24px 20px`, **franja vertical de 4px** en el borde izquierdo con el color de marca (`--cc-accent`).
- **Header**: avatar cuadrado 44px (radio 12px, fondo = acento, inicial del banco en blanco 19px/800) + nombre (17px/700) + meta ("Crédito · Visa" — **sin número de tarjeta**, la app no lo guarda) + pill de estado a la derecha (due/soon/ok).
- **Stats** (grid 3 col, borde-top): "Resumen <mes>" (monto 19px/800 + sub USD si aplica) · "Cierra" (fecha 16px) · "Vence" (fecha 16px).
- **Límite**: label "Límite usado <b>$X</b> de $Y" + "%" a la derecha + barra de progreso (fill = acento). El límite es **opcional** (ver detalle).
- **Footer** (borde-top punteado): ícono tarjeta + "N compras en cuotas" (o "Sin cuotas activas") + link "Ver resumen ›" a la derecha.
- **Interacción**: hover sube la card (`translateY(-2px)` + sombra). Click → navega al **detalle** de esa tarjeta. Estado seleccionado: borde `--navy` + ring.

### Comportamiento
- Click en una card → `/tarjetas/:id` (detalle).
- "Agregar tarjeta" → flujo de alta (fuera de alcance de este handoff).
- El hero agrega los montos de **todas** las tarjetas; ARS y USD se muestran por separado, nunca sumados.

---

## Pantalla 2 — Detalle de tarjeta

**Archivo:** `Grana - Tarjeta (detalle).html` · **Ruta sugerida:** `/tarjetas/:id` · **dirección elegida: "C · Foco en pago"**

### Concepto de datos clave (IMPORTANTE)
En una tarjeta de crédito argentina conviven **varios resúmenes en distintos estados** al mismo tiempo. El detalle los modela como **períodos**:

- **A pagar** — un resumen que **ya cerró pero todavía no venció** → es lo que el usuario **debe pagar ahora**, con fecha de vencimiento. Puede no existir (si está todo pagado).
- **En curso** — el resumen **abierto, que todavía no cerró** → sigue sumando consumos. Su monto "acumulado hasta hoy" **incluye las cuotas que caen en ese ciclo**.
- **Próximo** — proyección del siguiente ciclo → normalmente solo lo ya comprometido en cuotas (puede ser $0 / "sin movimientos").

> Una compra en cuotas reparte sus cuotas a lo largo de estos períodos: p.ej. "Cuota 1 de 3" cae en el resumen a pagar, "Cuota 2 de 3" en el en curso, "Cuota 3 de 3" en el próximo.

### Layout (de arriba a abajo)
1. **Back link** "‹ Tarjetas".
2. **Header**: avatar de marca (54px) + H1 nombre + pill de estado; subtítulo = banco/emisor.
   A la derecha, **switcher** de tarjetas (segmented control con dot de color por marca) — en la app real esto puede ser navegación entre tarjetas o no existir; acá sirve para demostrar las 3.
3. **Timeline del ciclo de vida** (horizontal): pasos `Pagado → [A pagar] → En curso → Próximo`, cada uno con dot de color (verde=pagado, terracota=a pagar, acento=en curso, gris=próximo), label y fecha ("vence 10/06" / "cierra 28/06"). El paso "A pagar" solo aparece si existe ese resumen. Los pasos (menos "Pagado") son **clickeables** y seleccionan qué período se ve abajo. La línea entre "Pagado" y el siguiente va en verde.
4. **Zona de resúmenes** (jerarquía = el foco está en lo que hay que pagar):
   - **Si hay "a pagar"**: card hero terracota con eyebrow "RESUMEN A PAGAR", monto 56px (+ USD aparte), "Cerró el X · vence el Y", y a la derecha **cuenta regresiva** ("10 días para el vencimiento") + botón terracota **"Registrar pago"**. Debajo, la card "En curso" (ver abajo) con cuerpo completo pero subordinada.
   - **Si NO hay "a pagar"** (tarjeta al día): la card "En curso" pasa a ser el **hero** (monto 52px, ring de acento).
   - **Card "En curso"**: grid `1fr / 290px`. Izquierda: eyebrow "RESUMEN EN CURSO" + badge "● Sumando consumos" (dot verde con pulso), monto (40/52px), "Acumulado hasta hoy · incluye cuotas del período", y stats (N movimientos · $ en cuotas este ciclo). Derecha: **panel de ciclo** (caja gris): "CIERRA", fecha (20px), "en N días" (acento), barra de progreso del ciclo, y "Día X del ciclo / N días".
   - **Mini "Próximo"** (fila con borde punteado): "PRÓXIMO · cierra X · ya comprometido en cuotas" + monto a la derecha + chevron. Clickeable.
5. **Límite (opcional)** — card:
   - Si está cargado: "Límite usado <b>$X</b> de $Y" + "%" + barra (fill=acento) + "Disponible <b>$Z</b>".
   - Si **no** está cargado: CTA con ícono + texto "Cargá el límite para ver cuánto te queda disponible." + botón "Cargar límite". (El límite **no siempre se conoce**; es dato opcional que el usuario carga manualmente.)
6. **Tabs**: "Movimientos del período" | "Cuotas en curso · N".
7. **Pane** según tab:
   - **Movimientos del período**: título "Movimientos · <período>" + contador. Movimientos **agrupados por fecha/rango**, en listas con borde. Cada fila: ícono de categoría (con tint) + nombre + chips (cuota "Cuota X de Y" / "Recurrente") + caption "Categoría › Subcategoría" + monto (terracota si ARS gasto; navy + sub "USD" si dólar). Estado vacío "Sin movimientos" cuando el período no tiene consumos.
   - **Cuotas en curso**: card intro con "Tenés N compras en cuotas… Total restante $X". Luego una card por compra: ícono + nombre + sub ("Comprado el X · Categoría") + "cur/total" + **fila de dots de progreso** (pagadas en acento, próxima en acento .4, futuras gris) + footer (Por cuota / Restante / Próxima cae). Estado vacío si no hay cuotas.

### Interacciones & comportamiento
- Click en paso del timeline / card a pagar / card en curso / mini próximo → cambia el período mostrado en "Movimientos del período" (y vuelve a ese tab). El elemento activo recibe ring de acento.
- Click en tab → cambia el pane.
- **Período por defecto al entrar**: "A pagar" si existe; si no, "En curso".
- Botón "Registrar pago" → flujo de pago (fuera de alcance). `stopPropagation` para no disparar la selección de la card.
- Badge "Sumando consumos": dot verde con animación de pulso (2s infinite).
- Sin `scrollIntoView`. Sin animación de entrada en el pane (causaba un bug de opacidad; mantenerlo simple).

### Estado (state)
- `tarjetaActiva` (id de tarjeta).
- `periodo`: `'apagar' | 'curso' | 'prox'`.
- `tab`: `'movs' | 'cuotas'`.
- Reglas: al cambiar de tarjeta, `periodo = apagar ?? curso`, `tab = movs`. Si la tarjeta no tiene "a pagar" y el período activo era `apagar`, caer a `curso`.

### Datos requeridos (forma sugerida por tarjeta)
- Identidad: nombre, banco/emisor, marca/red (Visa/Amex/Mastercard), inicial, color de acento, estado (due/soon/ok + texto).
- Límite: `{ cargado: bool, usado, total, pct, disponible }`.
- Por período (`apagar` opcional, `curso`, `prox`): fechas de cierre/vencimiento, días restantes, monto ARS, monto USD (separado), y movimientos agrupados.
- `curso` además: día del ciclo / total días, nº de movimientos, total en cuotas del ciclo.
- Cuotas en curso (nivel tarjeta): por compra → nombre, categoría, fecha de compra, cuota actual/total, monto por cuota, restante, próxima fecha. Total restante agregado.
- Movimiento: ícono/categoría, comercio, categoría›subcategoría, monto, flag USD, flag recurrente, info de cuota ("X de Y") si aplica.

---

## Assets
- **Tipografía:** Plus Jakarta Sans (Google Fonts) — usar la del design system del codebase si ya está.
- **Íconos:** todos SVG inline, estilo line (stroke 2, linecap/linejoin round), 16-24px. Reemplazar por el set de íconos del codebase (Lucide/Feather son equivalentes 1:1 a los usados acá).
- **Íconos de categoría en movimientos:** emojis como placeholder. En la app real usar el set de íconos de categoría existente de grana.
- **Logo grana:** marca cuadrada verde con "g" + wordmark. Usar el asset real del proyecto (carpeta `grana-logo/`).
- Sin imágenes raster. Sin números de tarjeta (la app no los almacena).

## Files (en este bundle)
- `Grana - Tarjetas.html` — listado de tarjetas (wallet, dirección A).
- `Grana - Tarjeta (detalle).html` — detalle de tarjeta (dirección C). Toda la lógica de estados está en el `<script>` al final, con los datos mock en el objeto `CARDS`.
- `Grana - Movimientos v3.html` — pantalla existente de referencia, para igualar el sistema visual (sidebar, filas de movimiento, chips, botones).

### Material de exploración (opcional, no para implementar)
- `Grana - Tarjetas (estilos).html` — comparativa de las 3 direcciones del wallet (se eligió A).
- `Grana - Detalle (estilos).html` — comparativa de las 3 direcciones del detalle (se eligió C).
