# Handoff: Selector Egresos / Ingresos en el gráfico de Movimientos

## Overview
El módulo **Movimientos** de Grana tiene una tarjeta de resumen con un gráfico de dona
("En qué se fue") que hoy muestra **solo egresos**, desglosados por categoría, con un
toggle de moneda **ARS / USD**.

Esta entrega agrega un **selector Egresos / Ingresos** a esa misma tarjeta. Al cambiar
de modo, todo el contenido del gráfico se actualiza: el título, el monto central de la
dona, el subtítulo, los colores de la dona y la lista (ranking) de categorías.

- **Egresos** → título "En qué se fue", paleta multicolor, ranking por categoría de gasto.
- **Ingresos** → título "De dónde vino", tonos verdes, ranking por **categoría de ingreso**
  (Sueldo, Freelance, Reintegros, Intereses).

El toggle **ARS / USD** ya existente sigue funcionando y ahora filtra los datos dentro de
cada modo.

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML/CSS/JS** —
prototipos que muestran el aspecto y el comportamiento buscados, **no** código de
producción para copiar tal cual. La tarea es **recrear este diseño en el entorno del
codebase de Grana** (React, React Native, etc.) usando sus patrones, componentes y
librerías ya establecidos. Si todavía no existe un entorno, elegí el framework más
apropiado e implementá ahí.

La función de gráfico (la dona) en el prototipo está hecha con un `conic-gradient` de CSS
+ una máscara radial; en el codebase real probablemente convenga usar la librería de
charts que ya estén usando (Victory, Recharts, react-native-svg, etc.). Lo importante es
respetar proporciones, colores y comportamiento, no la técnica del prototipo.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciados y estados son los definitivos.
Recrear la UI de forma pixel-perfect con las librerías y patrones existentes del codebase.

## Screens / Views

### Tarjeta "Resumen del mes" (dentro de la pantalla Movimientos)
- **Nombre**: Tarjeta de resumen / `spend-card`.
- **Propósito**: que el usuario vea de un vistazo, para el mes seleccionado, en qué se le
  fue la plata (egresos) o de dónde le entró (ingresos), desglosado por categoría y por
  moneda.
- **Layout**:
  - Card blanca: `background #FFFFFF`, `border 1px solid #E6EAEF`, `border-radius 22px`,
    `padding 34px 38px 38px`, `margin-bottom 38px`.
  - **Header** (`.spend-head`): `display:flex; align-items:flex-start;
    justify-content:space-between; gap:24px; margin-bottom:28px`.
    - **Izquierda** (`.spend-head-left`), apilado verticalmente:
      1. **Título dinámico** (`.eyebrow#spendTitle`): texto en mayúsculas, `font-size 12px`,
         `font-weight 700`, `letter-spacing 0.16em`, `text-transform:uppercase`,
         `margin-bottom 12px`. Color = color de acento del modo (ver abajo).
         Texto: `"En qué se fue"` (egresos) / `"De dónde vino"` (ingresos).
      2. **Selector de modo** (`.mode-tabs#modeTabs`) — ver "Componentes".
      3. **Subtítulo** (`.spend-sub#spendSub`): `margin-top 12px`, `font-size 14px`,
         `font-weight 500`, `color #6B7683`.
         Texto: `"Gastos de mayo · no incluye tarjeta sin pagar"` (egresos) /
         `"Ingresos de mayo · acreditados"` (ingresos).
    - **Derecha**: toggle de moneda (`.seg#curSeg`) — ver "Componentes".
  - **Body** (`.spend-body`): `display:flex; align-items:center; gap:56px`. A la izquierda
    la dona (ancho fijo), a la derecha el ranking (flex:1).

## Componentes

### 1. Selector de modo — Egresos / Ingresos (NUEVO)
Control segmentado tipo "pill" (misma familia visual que el toggle ARS/USD).
- Contenedor `.mode-tabs`: `display:inline-flex; gap:4px; background:#EEF1F5;
  border-radius:12px; padding:4px`.
- Botones: `font-size:15px; font-weight:700; padding:9px 22px; border-radius:9px;
  background:transparent; color:#6B7683; cursor:pointer; transition:background .18s, color .18s`.
- Hover (no activo): `color:#0B1A2B`.
- **Botón activo (`.on`)**: `color:#fff` y `background` = **color de acento del modo**:
  - Egresos activo → `#0B1A2B` (navy).
  - Ingresos activo → `#0E9E6E` (emerald oscuro).
- Por defecto arranca en **Egresos**.
- Opciones: `Egresos`, `Ingresos`.

### 2. Toggle de moneda — ARS / USD (YA EXISTE)
- Contenedor `.seg`: `display:flex; gap:4px; background:#EEF1F5; border-radius:11px;
  padding:4px`.
- Botones: `font-size:14px; font-weight:700; padding:8px 18px; border-radius:8px;
  color:#6B7683`.
- Activo (`.on`): `background:#0B1A2B; color:#fff`. Siempre navy (no cambia con el modo).
- Por defecto arranca en **ARS**.

### 3. Dona (donut chart)
- Tamaño: `248px × 248px`, anillo (ring) — grosor del anillo ≈ 42% del radio
  (en el prototipo: máscara `radial-gradient(circle, transparent 58%, #000 58.5%)`).
- Los segmentos se ordenan empezando arriba (12 en punto) en sentido horario, en el orden
  del ranking, con porcentajes `pct` (suman 100).
- Colores por segmento = paleta del modo (ver "Design Tokens").
- **Centro de la dona** (`.donut-center`), apilado y centrado:
  - `#dcLabel` (`.dc-eyebrow`): mayúsculas, `font-size 11px`, `letter-spacing 0.16em`,
    `font-weight 700`. Color = acento del modo. Texto: `"Gastado"` / `"Ingresó"`.
  - `#dcAmount` (`.dc-amount`): `font-size 38px; font-weight 800; letter-spacing -0.035em;
    line-height 1; white-space:nowrap`. Color navy `#0B1A2B`.
  - `#dcSub` (`.dc-sub`): `font-size 13px; font-weight 500; color #6B7683`.
    Texto: `"en 8 categorías"`, etc.

### 4. Ranking (lista de categorías)
- Contenedor `.ranking`: `flex:1; display:flex; flex-direction:column`.
- Fila `.rank-row`: `display:grid; grid-template-columns:auto 1fr auto; align-items:center;
  gap:16px; padding:13px 0`. Separador entre filas: `border-top:1px solid #E6EAEF`.
- Izquierda (`.rank-left`, `gap:14px`):
  - `.dot`: círculo `11px`, `border-radius:50%`, color = color del segmento correspondiente
    en la paleta (mismo índice que en la dona).
  - `.rank-emoji`: `font-size:20px` (el emoji de la categoría). En la fila "+ N categorías
    más" no hay emoji (se oculta con `opacity:0; width:0`).
  - `.rank-name`: `font-size:16.5px; font-weight:700; letter-spacing:-0.01em`.
  - `.rank-cap`: `font-size:13px; font-weight:500; color:#6B7683` (ej. `"40% · 8 movimientos"`).
- Derecha (`.rank-amt`): `font-size:18px; font-weight:700; letter-spacing:-0.025em;
  text-align:right`. Color navy `#0B1A2B`.

## Interactions & Behavior
- **Cambiar modo (Egresos/Ingresos)**: actualiza, en una sola pasada, `#spendTitle` (texto
  + color), `#spendSub`, la dona (colores + segmentos), `#dcLabel` (texto + color),
  `#dcAmount`, `#dcSub` y el `#ranking` completo. También recolorea el botón activo del
  selector con el acento del modo.
- **Cambiar moneda (ARS/USD)**: re-renderiza la dona, el centro y el ranking con el dataset
  de esa moneda dentro del modo activo. El conteo de categorías y los montos cambian.
- **Animación de entrada del body**: al cambiar modo o moneda, el `.spend-body` reproduce
  un `fadeUp` (`opacity 0→1`, `translateY 6px→0`, `0.32s ease`) y la dona un `donutIn`
  (`rotate(-12deg) scale(.94)`, `opacity .4` → normal, `0.4s ease`). Es opcional pero le da
  pulido; replicar si es barato en el target.
- **Estado por defecto**: modo `egresos`, moneda `ARS`.
- **Sin datos**: si una combinación modo/moneda no tiene movimientos, mostrar un estado
  vacío corto (no incluido en este prototipo; coordinar con el patrón de empty-state del
  resto del módulo — ver `EmptyIllustration` en `movimientos.jsx`).

## State Management
- `mode: 'egresos' | 'ingresos'` (default `'egresos'`).
- `cur: 'ARS' | 'USD'` (default `'ARS'`).
- Datos derivados: `data[mode][cur]` → `{ label, amount, count, rows[] }`, más
  metadatos por modo `{ title, accent, palette, sub }`.
- En producción, estos datos vienen del backend/estado del mes seleccionado. El prototipo
  usa datos mock (ver tabla abajo). La estructura sugerida por fila:
  `{ emoji, name, cap, amt, pct }` donde `pct` es el porcentaje (entero) para la dona.

## Datos mock usados (para validar el render)
Egresos · ARS — label "Gastado", monto "$ 854K", "en 8 categorías":
| emoji | categoría | cap | monto | pct |
|---|---|---|---|---|
| 🛒 | Supermercado | 40% · 8 movimientos | $ 341K | 40 |
| 🛋️ | Hogar | 25% · cuotas Sofá Sofías | $ 213K | 25 |
| 🍷 | Comida y bebida | 15% · 14 movimientos | $ 128K | 15 |
| 🎧 | Suscripciones | 11% · 3 recurrentes | $ 94K | 11 |
| — | + 4 categorías más | 9% · transporte, salud, otros | $ 78K | 9 |

Egresos · USD — "Gastado", "US$ 712", "en 3 categorías":
| 🎧 Suscripciones | 57% · 4 recurrentes | US$ 406 | 57 |
| ✈️ Viajes | 28% · 2 movimientos | US$ 199 | 28 |
| 💻 Software | 15% · 5 movimientos | US$ 107 | 15 |

Ingresos · ARS — "Ingresó", "$ 2,38M", "en 4 categorías":
| 💼 Sueldo | 58% · Banco Galicia | $ 1.380K | 58 |
| 💻 Freelance | 27% · 3 cobros | $ 640K | 27 |
| 💳 Reintegros | 9% · 5 movimientos | $ 210K | 9 |
| 📈 Intereses | 6% · plazo fijo | $ 150K | 6 |

Ingresos · USD — "Ingresó", "US$ 1.480", "en 2 categorías":
| 💻 Freelance | 81% · 2 cobros | US$ 1.200 | 81 |
| 📈 Intereses | 19% · caja de ahorro USD | US$ 280 | 19 |

## Design Tokens
Colores base (ya en uso en Grana):
- `--bg #F6F7F9` · `--card #FFFFFF` · `--navy #0B1A2B` · `--muted #6B7683` ·
  `--border #E6EAEF` · `--emerald #10B981` · `--terracota #B56A5A` · `--slate #3A6B8A`.

Paletas de la dona / ranking:
- **Egresos (multicolor)**: `#10B981`, `#2A8F7B`, `#3A6B8A`, `#B56A5A`, `#8C7AA0`.
- **Ingresos (verdes)**: `#0E9E6E`, `#16B981`, `#4FC79A`, `#86D9B8`.

Color de acento por modo (título + label + botón activo):
- Egresos → `#0B1A2B` · Ingresos → `#0E9E6E`.

Tipografía: **Plus Jakarta Sans** (400/500/600/700/800). Números con
`font-variant-numeric: tabular-nums` (clase `.tnum`).

Radios: card 22px · pills/segmentos 11–12px · botones internos 8–9px · dot 50%.

## Screenshots (referencia visual)
En `screenshots/` están los 4 estados de la tarjeta, ya renderizados:
- `01-egresos-ARS.png` — modo Egresos, moneda ARS (estado por defecto).
- `02-ingresos-ARS.png` — modo Ingresos, moneda ARS.
- `03-egresos-USD.png` — modo Egresos, moneda USD.
- `04-ingresos-USD.png` — modo Ingresos, moneda USD.
Notar cómo cambian: título, color del título/label, paleta de la dona, monto central,
subtítulo y la cantidad de filas del ranking según modo y moneda.

## Assets
- Sin assets nuevos. Emojis nativos como íconos de categoría (mismo criterio que ya usa el
  módulo en las filas de movimientos `.tx-icon`).
- Logo / íconos de Grana: ver carpeta `grana-logo/` del proyecto si hace falta.

## Files
- `Grana - Movimientos v3.html` — **pantalla completa del módulo con el selector ya
  integrado y funcional** (referencia principal). El JS de la tarjeta está al final del
  archivo, en un `<script>` IIFE comentado.
- `Grana - Selector Egresos-Ingresos (variaciones).html` — comparación de las 2
  variaciones de selector que se exploraron (A = pill, elegida; B = subrayado). Solo como
  contexto de diseño.
- `spend-card.jsx` — componente React del prototipo de variaciones (lógica de datos +
  render). Útil como pseudo-código de referencia para la implementación.

## Notas de implementación
- La variación elegida es **A (pestañas pill)**, por consistencia con el toggle ARS/USD.
- El selector vive **a la izquierda** del header de la card; el toggle de moneda queda a la
  derecha. Ambos en la misma fila superior.
- El detalle de "botón activo adopta el color del modo" (navy/emerald) es intencional para
  reforzar la lectura egreso vs. ingreso; mantenerlo.
