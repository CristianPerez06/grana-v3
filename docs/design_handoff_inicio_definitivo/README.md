# Handoff: Inicio (definitivo) — grana

## Overview
Pantalla **Inicio** de **grana**, app de finanzas personales bimonetaria (ARS + USD). Rediseño de la home basado en la propuesta "Opción C (cajas de categoría)", pasada al design system de grana v3. Orden de lectura:

1. **Saldo disponible total** (hero oscuro, ARS + USD).
2. **Resumen del mes** (Ingresos / Pagado / En tarjeta + Ritmo de gasto).
3. **Distribución del ingreso** — con **toggle de dos vistas** (ver abajo).
4. **Próximos compromisos del mes** — entra vs. sale + neto a cubrir.
5. **Economía compartida** (card condicional).

Principio rector: que lo visual comunique el dato sin leer en detalle (dona de 3 tramos, barra de ritmo, columnas entra/sale, banda de neto).

## About the Design Files
Son **referencias de diseño en HTML/CSS/JS** — prototipos de look & feel y comportamiento, **no** código de producción. La tarea es recrear el diseño dentro del codebase de grana con sus componentes y convenciones.

- `Inicio Definitivo (Web).html` — desktop responsive (sidebar 248px + main). Redimensionar a ≤680px para ver el fallback mobile.
- `Inicio Definitivo (Mobile).html` — diseño **mobile standalone** (mobile-first ~430px, top bar + bottom nav con FAB). Autónomo: no depende del de desktop.

Mismo contenido, datos y tokens en ambos.

## Fidelity
**Alta fidelidad.** Fuente **Plus Jakarta Sans** (400–800). Formato AR: miles `.`, decimales `,`. Todos los números con `font-variant-numeric: tabular-nums`.

## Datos de ejemplo (mock) — reemplazar por datos reales
- **Saldo disponible total:** `$ 850.420,00` · `US$ 654,17`.
- **Resumen del mes (agosto 2026):** Ingresos `$ 2.100k` / USD 1.615 · Pagado `$ 1.350k` / USD 1.038 · En tarjeta `$ 480k` / USD 369. **Ritmo de gasto 64%** (= pagado / ingresos).
- **Distribución del ingreso** (base: ingresos `$ 2.100k`):
  - Gastado (= pagado) `$ 1.350k` → **64%**
  - Comprometido (= en tarjeta, aún sin pagar) `$ 480k` → **23%**
  - Libre real `$ 270k` → **13%** · Libre "simple" (sin descontar comprometido) `$ 750k` → **36%**
- **Próximos compromisos:** Entra `$ 468.960` / USD 360,73 (Honorarios `$ 350k` + Hogar J|CP `$ 118,9k`). Sale `$ 788.891,43` / USD 606,83 (Resumen Visa `$ 743.691,43` vence 10/08 + Recurrencias `$ 45.200,00`, 4 débitos automáticos). **Neto a cubrir `−$ 319.931,43`** / USD 246,10.
- **Compartido:** grupo Hogar J|CP → `Te deben $ 118.960` / USD 91,50.

> Nota: los porcentajes de Distribución se derivan de los mismos datos del Resumen (1.350 + 480 + 270 = 2.100k). **No hardcodear**: calcular tramos, anchos y neto desde los datos.

## Componente clave: Distribución del ingreso con toggle
Segmented control de 2 opciones (`.dist-tog`, ancho completo, pill blanca activa con sombra `0 1px 3px rgba(11,26,43,.1)`), cada botón con label + sublabel:

| Vista | Label / sublabel | Dona (conic-gradient) | Centro | Leyenda |
|---|---|---|---|---|
| `real` (default) | **Libre real** / "descuenta comprometido" | terracota `0–64%`, amber `64–87%`, emerald `87–100%` | `13%` / "LIBRE REAL" | Gastado 64% · Comprometido 23% · **Libre real 13%** (destacada) |
| `simple` | **Solo gastado** / "sin comprometido" | terracota `0–64%`, `--line` `64–100%` | `36%` / "LIBRE" | Gastado 64% · **Libre 36%** |

- El pie de la card cambia con la vista: `real` → "Del 36% que parecía libre, **23% ya está comprometido** en tarjeta. Te queda **$ 270k** sin asignar." · `simple` → "Solo lo que ya salió de tu caja. Los **$ 480k en tarjeta** todavía no se pagaron."
- La dona tiene `transition: background .35s ease`; el `.ctr` necesita `z-index:2` para quedar sobre el círculo interior (`::after`, `inset:28px` desktop / `25px` mobile).
- **Persistencia:** la elección se guarda por usuario (en el prototipo, `localStorage['grana.inicio.distView']` con valores `real` | `simple`). Default `real`.
- Accesibilidad: `role="tablist"` / `role="tab"` + `aria-selected`; los paneles se muestran/ocultan (no reemplazar el DOM para no perder foco).

## Componente clave: Próximos compromisos (entra vs. sale)
- Dos columnas (`grid 1fr 1fr`, gap 12): **Entra** (`background:#F6FCF9; border:#CFEEE0`) y **Sale** (`background:#FCF7F5; border:#EEDBD4`). Cada una: eyebrow uppercase 11/800, monto 23/800 (`--emerald-deep` / `--terracota`), sub USD 11/600 `--faint`, y lista de hasta 2–3 ítems (12/600) separada por `border-top:1px solid --line`.
- **Banda de neto** (`.netbar`): fondo `--navy`, radius 14, eyebrow "NETO A CUBRIR" + monto 25/800 con USD debajo. Signo `−` cuando sale más de lo que entra; si el neto es positivo, mostrar `+` y monto en `--emerald`/verde claro (`#4FD6A4`) sobre navy.
- **Pie de alerta** (`.hint.warn`): compara neto contra el libre real → "Con **$ 270k libres** no alcanza: faltan **$ 49.931** antes del 10/08." Si el libre real cubre el neto, mostrar mensaje positivo en `--emerald-deep` en vez de terracota.
- En mobile las columnas pasan a 1 sola (`grid-template-columns:1fr`).

## Layout
### Desktop
`grid-template-columns: 248px 1fr` (sidebar + main). `.main` padding `30px clamp(20px,3.2vw,42px) 64px`, `.content` `max-width:1080px`.
- **Topbar:** `h1` "Hola, Julieta." (`clamp(24px,3.2vw,30px)`/800/`-0.035em`) + fecha con el % del ritmo en verde. Derecha: selector de mes, botón ojo 42×42, botón primario "Nuevo movimiento".
- **Fila 1** (`.r-top`, `1.1fr 1.35fr`): hero **Saldo disponible total** + **Resumen del mes**.
- **Fila 2** (`.r-two`, `1fr 1.15fr`): **Distribución del ingreso** + **Próximos compromisos**.
- **Full width:** **Economía compartida** (solo si hay actividad).

### Mobile (≤680px o archivo standalone)
Top bar sticky con blur ("grana." + ojo + avatar "JL"), greeting + selector de mes full width, cards en columna (gap 14, padding 18, radius 18), bottom nav fijo con FAB central (Inicio activo, Cuentas, +, Movim., Compart.). Hit targets ≥44px. La dona se centra y la leyenda pasa abajo full width.

### Breakpoints
- **≤980px:** se oculta la sidebar, `.r-top` y `.r-two` → 1 columna.
- **≤680px:** aparecen top bar y bottom nav, se oculta el botón "Nuevo movimiento" (lo reemplaza el FAB), `.scalebox` → 1 columna, `.dist` → columna.

## Interacciones & comportamiento
- **Selector de mes** (‹ ›): recarga Resumen del mes, Distribución y Compromisos (todo es mensual). El Saldo disponible es de hoy y no cambia.
- **Toggle Libre real / Solo gastado:** ver arriba, con persistencia.
- **Toggle ARS/USD** en Distribución: alterna la moneda de la dona y la leyenda.
- **Ojo:** oculta/revela todos los montos (`••••`).
- **Nuevo movimiento / FAB:** abre alta de movimiento.
- **Compromisos → "Ver todos":** calendario / listado de compromisos. Cada ítem de las listas es tocable (lleva a la tarjeta o a la recurrencia).
- **Compartido:** navega a la sección Compartido; la card no se renderiza sin actividad.
- **Ritmo de gasto:** barra amber; si supera el 100% de los ingresos, pasar a `--terracota` y ajustar el copy.

## State management
- `montosOcultos: bool`
- `mesSeleccionado: Date`
- `distView: 'real' | 'simple'` (persistido)
- `monedaDist: 'ARS' | 'USD'`
- Datos: `saldo{ars,usd}`, `resumen{ingresos,pagado,enTarjeta,usd}`, `distribucion` (derivada de `resumen`), `compromisos{entra[],sale[],usd}`, `compartido?{grupo,miembros[],neto,direccion}`.
- Condicionales: card Compartido solo si hay actividad; pie de alerta según `neto` vs `libreReal`.

## Design tokens
- **Fondos/texto:** `--bg:#EEF1F4`, `--card:#FFFFFF`, `--ink:#142231`, `--navy:#0B1A2B`, `--muted:#6B7683`, `--soft:#8A94A3`, `--faint:#AEB6C0`, `--border:#E8ECF1`, `--line:#EEF1F5`, `--hair:#E4E8EE`.
- **Marca / positivo:** `--emerald:#11B981`, `--emerald-deep:#0E9E6E`, `--emerald-soft:#E7F8F0`.
- **Semánticos:** gastado/negativo `--terracota:#C2705C` (soft `#F7ECE7`), comprometido `--amber:#E79A2B` (deep `#B9791B`, soft `#FBF0DD`), acentos `--slate:#3A6B8A`, `--violet:#7C5CD6`, `--blue:#2F7FD1`, `--cyan:#15A8C4`, `--rose:#C95C86`.
- **Radios:** cards 20 (desktop) / 18 (mobile), sidebar `0 26px 26px 0`, tiles y columnas 14, botones 12–13, chips 999, dots 2–3, barras 6–7.
- **Sombras:** botón primario `0 8px 18px -6px rgba(17,185,129,.5)`; FAB `0 8px 18px -5px rgba(17,185,129,.55)`; pill activa del toggle `0 1px 3px rgba(11,26,43,.1)`.
- **Espaciado:** gap entre secciones 16 (desktop) / 14 (mobile); padding de card 22/24 (desktop), 18 (mobile).

## Assets
- Tipografía: **Plus Jakarta Sans** (Google Fonts).
- Íconos: SVG inline stroke, viewBox 24×24 (nav, ojo, "+", flechas, tarjeta, recurrencia, compartido, engranaje). Reemplazables por el set del codebase.
- Sin imágenes raster. Isotipo = wordmark + punto verde (texto + CSS). Avatares = círculos con iniciales.

## Files
- `Inicio Definitivo (Web).html` — desktop responsive.
- `Inicio Definitivo (Mobile).html` — mobile standalone (~430px).
- `cards/` — **una card por archivo, para implementar de a poco.** `cards/index.html` es el índice; `cards/cards.css` tiene tokens + estilos por card + el breakpoint ≤680px (es la misma CSS que usan las pantallas completas, recortada a las 5 cards). Cada HTML trae la card aislada y una nota con sus clases y comportamiento:
  1. `01 - Saldo disponible.html`
  2. `02 - Resumen del mes.html`
  3. `03 - Distribucion del ingreso.html` (incluye el JS del toggle)
  4. `04 - Proximos compromisos.html`
  5. `05 - Economia compartida.html`

Orden sugerido de implementación: 1 → 2 → 4 → 5 → 3 (la 3 es la única con estado propio).
