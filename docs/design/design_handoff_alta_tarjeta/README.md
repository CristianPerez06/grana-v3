# Handoff: Alta de tarjeta de crédito (Variante A — Drawer)

## Overview
Formulario de **alta de una tarjeta de crédito** dentro de Grana. Se abre como un **drawer lateral derecho** sobre la pantalla de Tarjetas. El usuario carga la institución, la red, un nombre opcional, el límite opcional y las **4 fechas del ciclo de facturación** (resumen actual + próximo resumen). Una **vista previa en vivo** arriba muestra cómo va a quedar la tarjeta a medida que completa.

Este flujo es el gemelo de *Editar tarjeta* (mismo patrón drawer, mismos componentes de formulario); alta y edición deben verse idénticos.

## About the Design Files
El archivo `Variante A - Drawer.html` de este bundle es una **referencia de diseño hecha en HTML/CSS/JS plano** — un prototipo que muestra el look & feel y el comportamiento buscado, **no es código de producción para copiar tal cual**.

La tarea es **recrear este diseño en el entorno del codebase de Grana** (React/Vue/etc., con sus componentes, tokens y convenciones ya existentes). Si ya existe el componente *Editar tarjeta*, **reutilizá su drawer y sus primitivas de formulario** y derivá esta pantalla de ahí — comparten casi todo. Donde el prototipo y el codebase difieran, gana el codebase.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciados, estados e interacciones son finales. Recrear pixel-perfect con las librerías/tokens del proyecto. Los valores exactos están en *Design Tokens*.

---

## Screens / Views

### 1. Contexto (pantalla de Tarjetas, atenuada)
Solo sirve de fondo: el drawer se abre encima con un scrim. No hace falta reimplementar nada nuevo acá — es la pantalla de Tarjetas existente. En el prototipo está difuminada (`filter: blur(1px); opacity: .5`) para dar foco al drawer.

### 2. Drawer — Alta de tarjeta
El componente a implementar.

**Layout**
- Drawer fijo a la derecha: `position: fixed; top:0; right:0; bottom:0; width: 540px`. Sombra `-24px 0 60px -20px rgba(11,26,43,.34)`. Fondo `--bg (#F6F7F9)`.
- Scrim a pantalla completa detrás: `rgba(11,26,43,.34)` + `backdrop-filter: blur(2px)`.
- Estructura en 3 zonas con **flex column**:
  - **Header** (fijo, no scrollea): fondo blanco, `border-bottom 1px --border`, padding `22px 28px 20px`.
  - **Body** (scrolleable, `flex:1; overflow-y:auto`): padding `22px 28px 28px`.
  - **Footer** (fijo): fondo blanco, `border-top 1px --border`, padding `16px 28px`.

**Header**
- Eyebrow "NUEVA TARJETA" — 11px / 700 / `letter-spacing .15em` / uppercase / color `--emerald-deep (#0E9E6E)`.
- Título "Agregá una tarjeta" — 25px / 800 / `letter-spacing -0.03em`.
- Botón cerrar (X) a la derecha: 38×38, `border-radius 11px`, `border 1px --border`, icono 18px. Cierra el drawer (acción: `onClose`).

**Body — secciones, en este orden:**

1. **Vista previa** (card en vivo) — ver sección *Componentes › Card preview*.
2. **Banco / institución** — selector desplegable (ver *Componentes › Bank selector*). Debajo, hint: *"El color de la tarjeta se toma de la institución."*
3. **Red de la tarjeta** — fila de pills (single-select): `Visa, Mastercard, American Express, Cabal, Naranja, Naranja X, Mercado Pago, Otra red`.
4. **Nombre · opcional** — un input de texto. Placeholder: *"Se auto-genera si lo dejás en blanco"*.
5. **Límite de crédito · opcional** — input numérico con prefijo `$` y sufijo `ARS`. Placeholder `Opcional`. Hint debajo: *"El límite aplica en pesos. Los consumos en dólares se convierten al TC del día."*
6. **Fechas del ciclo** — 4 inputs `type=date` en 2 grupos (ver *Componentes › Cycle dates*). Hint: *"Con el ciclo actual y el próximo, Grana ubica cada consumo en su resumen."*

**Footer**
- Botón secundario **Cancelar**: 52px alto, `border 1px --border`, fondo blanco, texto `--navy`, `border-radius 14px`. Acción `onClose`.
- Botón primario **Crear tarjeta**: `flex:1`, 52px alto, fondo `--navy`, texto blanco, `border-radius 14px`, sombra `0 8px 20px -4px rgba(11,26,43,.30)`. Hover `brightness(1.08)`. Acción `onSubmit`.

---

## Componentes

### Card preview (vista previa en vivo)
Reproduce la tarjeta tal como aparecerá en la lista de Tarjetas. Se actualiza en cada cambio del formulario.
- Caption "● VISTA PREVIA": 11px / 800 / `letter-spacing .09em` / uppercase / `--soft-text`, con un dot 6px `--emerald`.
- Card: fondo blanco, `border 1px --border`, `border-radius 20px`, padding `22px 24px 20px`, `position:relative; overflow:hidden`.
  - Barra de acento izquierda: `::before` 4px de ancho, full-height, `background: var(--cc-accent)` (color de la institución).
  - **Estado vacío (ghost):** mientras no haya institución/red/nombre, borde punteado y textos en gris `--faint`. Marca (avatar) gris `#E6EAEF` con "?".
  - **Header de la card:** avatar 44×44 `border-radius 12px` con la inicial de la institución, fondo `var(--cc-accent)`, texto blanco. Al lado: nombre (17px/700) y meta (`Crédito · {Red} · {Banco corto}`, 13px/500 `--muted`).
  - **Línea de límite:** "Límite {valor}" + barra de progreso 8px (`#EDF0F4`, fill `var(--cc-accent)`). Sin límite → "sin cargar" y fill 0%. (En el prototipo, con límite cargado el fill se muestra a 38% solo como ilustración; en producción calcular contra el saldo real, o dejar 0 si recién se crea.)
  - **Línea de ciclo (borde punteado arriba):** muestra `● Cierra {dd/mm} → ● Vence {dd/mm}` usando las fechas del **resumen actual**. Dot de cierre = `var(--cc-accent)`, dot de vencimiento = `--terracota`. Sin fechas → texto gris "Definí las fechas del ciclo".

### Bank selector (desplegable buscable)
Reemplaza al viejo selector de color: **el color de la tarjeta se deriva de la institución elegida**, no lo elige el usuario.
- **Trigger:** botón full-width, `border 1px --border`, `border-radius 15px`, padding `12px 16px`, flex con: dot 36×36 (`border-radius 11px`) + nombre + chevron. Estado por defecto: dot gris con "?", texto placeholder `--faint` *"Hacé click para ver los bancos…"*. Abierto: `border-color #C9CFD7` + `box-shadow 0 0 0 3px rgba(58,107,138,.12)`, chevron rota 180°.
- **Menú:** panel absoluto debajo del trigger, fondo blanco, `border-radius 16px`, sombra `0 22px 54px -18px rgba(11,26,43,.38)`, animación de entrada (fade + translateY 6px, 160ms).
  - **Search** arriba: input con ícono de lupa, filtra la lista por substring (case-insensitive). Placeholder *"Buscar institución…"*.
  - **Lista** scrolleable (`max-height 264px`): cada opción = dot 28×28 con inicial sobre el color de la institución + nombre (14px/700) + check (`--emerald`) si está seleccionada. Hover `--field-bg`. Seleccionada: fondo `rgba(16,185,129,.08)`.
  - Sin resultados → "Sin resultados".
- **Al seleccionar:** setea `bank`, aplica el color de marca a `--cc-accent` (cascada a la card preview y al avatar), actualiza el trigger (dot + nombre), cierra el menú.
- **Cerrar:** click fuera del componente cierra el menú.
- **Lista de instituciones y color de marca** (ver tabla en *Design Tokens › Institución → color*). Incluye **"Otra institución"** (sin color → usa el neutral `--slate #3A6B8A`).

### Network pills (red)
- Pills `border-radius 999px`, `border 1px --border`, fondo blanco, texto 13.5px/700 `--muted`, padding `9px 15px`. Hover: `border-color #C9CFD7`, texto `--navy`. **Seleccionada (single-select):** fondo `--navy`, texto blanco.
- "Otra red" seleccionada ⇒ tratar la red como vacía a efectos del auto-nombre (no inventar "Otra red Galicia").

### Text / limit inputs
- **Field group** genérico (nombre): contenedor `border 1px --border`, `border-radius 15px`; cada fila = ícono 36×36 (`--field-bg`) + label uppercase 11px/700 `--soft-text` + input sin borde (15px/600 `--navy`).
- **Limit field:** contenedor propio con prefijo `$` (16px/800 `--muted`), input tabular-nums (17px/700), sufijo `ARS` (12px/600 `--faint`).

### Cycle dates (4 fechas) — CLAVE
Modelo: **2 grupos × 2 fechas = 4 `input[type=date]`** (dd/mm/aaaa). Reemplaza al viejo esquema de "día del mes".
- Label de sección "Fechas del ciclo" (form-section-label).
- **Subgrupo "RESUMEN ACTUAL"** (subhead 11px/800 `--faint` uppercase) → grid 2 columnas (`gap 10px`):
  - **Cierre** — `id="fCloseNow"` — dot del label = `var(--cc-accent)`.
  - **Vencimiento** — `id="fDueNow"` — dot del label = `--terracota`.
- **Subgrupo "PRÓXIMO RESUMEN"** → grid 2 columnas:
  - **Cierre** — `id="fCloseNext"`.
  - **Vencimiento** — `id="fDueNext"`.
- Cada **date-field:** contenedor `border 1px --border`, `border-radius 13px`, padding `9px 14px 10px`. `:focus-within` → `border-color #C9CFD7` + `box-shadow 0 0 0 3px rgba(58,107,138,.10)`. Label uppercase 10.5px/700 con dot 7px. Input nativo `type=date`, tabular-nums, 14px/700.
- Solo las fechas del **resumen actual** alimentan la línea de ciclo de la vista previa.

---

## Interactions & Behavior
- **Abrir/cerrar drawer:** entra desde la derecha. Cerrar con la X, con "Cancelar", con click en el scrim y con `Esc` (recomendado; el prototipo no implementa Esc/scrim-click pero la UI lo sugiere).
- **Selección de institución:** abre el menú, filtra con la búsqueda, al elegir aplica color + cierra. Click afuera cierra sin elegir.
- **Selección de red:** single-select (toggle visual entre pills).
- **Live preview:** cualquier cambio en institución, red, nombre, límite o fechas re-renderiza la card.
- **Auto-nombre:** si el campo Nombre está vacío, el nombre mostrado se arma como `"{Red} {Banco sin prefijo 'Banco '}"` (ej. *"Visa Galicia"*). Si el usuario escribe un nombre, manda el escrito.
- **Formato de fecha en preview:** `yyyy-mm-dd` → `dd/mm`.
- **Color de marca:** seleccionar institución setea la CSS var `--cc-accent` en el contenedor del drawer; cascada a barra de acento, avatar y dot de cierre.

## State Management
Estado del formulario:
- `bank: string` (nombre de la institución, "" si ninguna / "Otra institución")
- `accent: string` (hex; derivado de `bank`, default `--slate #3A6B8A`)
- `red: string` ("" si "Otra red" o ninguna)
- `name: string` (opcional)
- `limit: string | number` (opcional, ARS)
- `closeNow, dueNow, closeNext, dueNext: Date | string` (las 4 fechas)
- UI: `menuOpen: boolean`, `search: string`

Derivados: `displayName = name || \`${red} ${shortBank}\`.trim()`; `cycleLine` desde `closeNow/dueNow`.

**Validación sugerida** (no implementada en el prototipo, definir con el equipo):
- Institución y red: requeridas para habilitar "Crear tarjeta".
- Las 4 fechas: requeridas (los inputs llevan `required`). Coherencia: `dueNow ≥ closeNow`, `closeNext > closeNow`, `dueNext ≥ closeNext`.
- Nombre y límite: opcionales.

**Submit:** arma el objeto tarjeta con estos campos y lo persiste; cierra el drawer y refresca la lista de Tarjetas.

## Design Tokens

**Colores base**
| Token | Hex |
|---|---|
| `--bg` | `#F6F7F9` |
| `--card` | `#FFFFFF` |
| `--navy` (texto / primario) | `#0B1A2B` |
| `--muted` | `#6B7683` |
| `--soft-text` | `#8A94A3` |
| `--faint` | `#AEB6C0` |
| `--border` | `#E6EAEF` |
| `--field-bg` | `#FAFBFC` |
| `--emerald` | `#10B981` |
| `--emerald-deep` | `#0E9E6E` |
| `--terracota` (vencimiento) | `#B56A5A` |
| `--slate` (acento neutral por defecto) | `#3A6B8A` |
| `--cc-accent` | dinámico = color de la institución |

**Institución → color de marca** (usados en el bank selector y como `--cc-accent`)
| Institución | Hex |
|---|---|
| Banco Galicia | `#F4A024` |
| Banco Santander | `#C9332E` |
| BBVA | `#1464A5` |
| Banco Nación | `#1B4D9B` |
| Banco Macro | `#0A4C8B` |
| Banco Provincia | `#159A5B` |
| Banco Ciudad | `#C9332E` |
| ICBC | `#C8102E` |
| HSBC | `#C8102E` |
| Banco Credicoop | `#1B4D9B` |
| Banco Supervielle | `#C9332E` |
| Banco Comafi | `#C9332E` |
| Banco Patagonia | `#159A5B` |
| Brubank | `#6C4BD9` |
| Ualá | `#7A4BD9` |
| Naranja X | `#E25522` |
| Mercado Pago | `#2D8FD6` |
| Otra institución | sin color → `--slate #3A6B8A` |

> La lista es la del prototipo; en producción conviene que venga del backend (id + nombre + color de marca) en vez de hardcodearla.

**Tipografía:** familia **Plus Jakarta Sans** (400/500/600/700/800). Números con `font-variant-numeric: tabular-nums` (montos y fechas).
- Título drawer: 25px / 800 / -0.03em
- Eyebrow & section labels: 11px / 700–800 / uppercase / .09–.15em
- Body/input: 15px / 600
- Meta/hint: 12–13.5px / 500–600

**Radios:** card/section 20px · field group / limit / trigger 15px · date-field 13px · menú 16px · botones 14px · pills 999px · avatares 11–12px.

**Sombras:** drawer `-24px 0 60px -20px rgba(11,26,43,.34)` · menú banco `0 22px 54px -18px rgba(11,26,43,.38)` · botón primario `0 8px 20px -4px rgba(11,26,43,.30)`.

**Espaciado:** padding header `22/28/20`, body `22/28/28`, footer `16/28`. Gap grid de fechas `10px`. Separación entre secciones del form `~22px`.

## Assets
- **Fuente:** Plus Jakarta Sans (Google Fonts). Usar la fuente ya configurada en el proyecto.
- **Íconos:** SVG inline estilo *stroke* (lucide-like), `stroke-width 2`, 18–20px. Usar la librería de íconos del codebase (ej. lucide-react) en vez de los SVG inline del prototipo.
- No hay imágenes ni logos de marca: los avatares son la **inicial** de la institución sobre su color.

## Files
- `Variante A - Drawer.html` — prototipo de referencia (este bundle). La estructura del body, los estilos y el `<script>` al final documentan exactamente el comportamiento descripto acá.
- Referencia en el proyecto Grana: `Grana - Editar tarjeta.html` (pantalla gemela; reutilizar su drawer y primitivas de formulario).

## Notas de implementación
- **Reutilizá *Editar tarjeta*.** Esta alta es la versión "vacía" de esa pantalla. Compartir el drawer, los field groups, las pills, el bank selector y el bloque de fechas evita divergencia visual.
- **Sacá lo que ya no va:** en versiones previas del diseño había un *selector de color de tarjeta* y un *toggle de moneda ARS/USD*; ambos fueron eliminados. El color sale de la institución y el límite es siempre en ARS (con la nota de conversión por TC).
- **Mejora opcional ya conversada (no implementada):** al cargar las fechas del *resumen actual*, autocompletar las del *próximo resumen* (+1 mes) para ahorrar tipeo, dejándolas editables.
