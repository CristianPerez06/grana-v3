# Handoff: Editar tarjeta (grana · módulo Tarjetas)

## Overview
Pantalla para **editar una tarjeta de crédito ya existente** en grana (finanzas personales, español rioplatense). No es alta de tarjeta: la tarjeta ya existe y se llega desde su detalle. Permite cambiar la identidad (nombre, banco, red/marca), el ciclo de facturación (cierre / vencimiento), la moneda principal y el límite (opcional), además de **archivar** o **eliminar** la tarjeta.

**Dirección elegida:** drawer lateral derecho con **vista previa en vivo** — el mismo patrón que el drawer de "Registrar movimiento" de grana, más una tarjeta de preview que refleja los cambios mientras se editan.

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML/CSS/JS vanilla** — prototipos que muestran el look & feel y el comportamiento buscado, **no código de producción para copiar tal cual**. La tarea es **recrear este diseño en el codebase real de grana** (React / Vue / lo que use el proyecto) reutilizando sus componentes, tokens y patrones ya existentes. Si todavía no hay un entorno, elegir el framework más adecuado e implementarlo ahí.

En particular, este formulario **debe reutilizar los componentes del drawer de "Registrar movimiento"** (header, filas de campo, segmented control, footer sticky, scrim), que ya existen en el sistema.

- **Archivo de implementación final:** `Grana - Editar tarjeta.html` (autocontenido, en la raíz de este bundle).
- **Referencia de la exploración:** `referencia/Grana - Editar tarjeta (estilos).html` (compara las 3 direcciones A/B/C) + `referencia/editar-estilos/` (las 3 variantes y su CSS compartido).

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado e interacciones son finales y siguen el sistema de grana. Recrear pixel-perfect con los componentes del codebase. Los datos (Visa Galicia, Banco Galicia, montos) son **mock**.

---

## Screens / Views

### 1. Contexto: detalle de la tarjeta (atenuado)
Solo contexto. El drawer se abre **encima del detalle de la tarjeta** (ver `Grana - Tarjeta (detalle)` del módulo Tarjetas). Detrás hay un **scrim** `rgba(11,26,43,.34)` con `backdrop-filter: blur(2px)`. No hace falta reconstruir el detalle: ya existe.

### 2. Drawer · Editar tarjeta
**Layout:** panel fijo a la derecha, **540px** de ancho, alto completo de viewport, `box-shadow: -24px 0 60px -20px rgba(11,26,43,.34)`. Estructura en columna flex:
- **Header** (`flex: none`): fondo blanco, borde inferior `1px var(--border)`, padding `22px 28px 20px`.
  - Eyebrow "EDITAR TARJETA" (11px, 700, uppercase, `letter-spacing:.15em`, color `--muted`).
  - Título = nombre de la tarjeta (25px, 800, `letter-spacing:-0.03em`).
  - Botón cerrar a la derecha: ícono X, 38×38, `border-radius:11px`, borde `--border`.
- **Body** (`flex:1; overflow-y:auto`): padding `22px 28px 28px`. Contiene, en orden: preview, Identidad, Red/marca, Ciclo, Moneda, Límite, Acciones.
- **Footer** (`flex:none`): fondo blanco, borde superior, padding `16px 28px`, `display:flex; gap:12px`. Botón "Cancelar" (ghost, `flex:none`, alto 52) + "Guardar cambios" (`flex:1`, alto 52, fondo `--navy`, sombra).

#### Componentes del body (en orden)

**A) Vista previa (live preview)**
- Caption "VISTA PREVIA" (11px/800/uppercase, color `--soft-text`) con dot emerald 6px.
- Tarjeta `.cc`: fondo blanco, borde `--border`, `border-radius:20px`, padding `22px 24px 20px`, con **franja izquierda de 4px** del color de acento (`::before`, `background: var(--cc-accent)`).
  - **Head:** avatar cuadrado 44×44 (`border-radius:12px`, fondo `--cc-accent`, inicial blanca derivada del banco) + nombre (17px/700) + meta "Crédito · {red} · {banco}" (13px, `--muted`) + badge de estado a la derecha.
  - **Línea de límite:** "Límite **$ 2.000.000**" + barra de progreso 8px (`--cc-accent`). Si el límite está vacío → "sin cargar".
  - **Mini-diagrama de ciclo** (separado por borde dashed superior): `Cierra ●28 → Vence ●10` (dot cierre = `--cc-accent`, dot vencimiento = `--terracota`). Si "mismo día" está destildado → texto "Cierre y vencimiento **variables** — se cargan por resumen".
- **Se actualiza en vivo** con cada cambio del form (ver State Management).

**B) Identidad** (`form-section-label` "IDENTIDAD")
- `field-group` (borde redondeado 15px, filas divididas por borde):
  - Fila **Nombre de la tarjeta**: ícono tarjeta + label uppercase + input de texto inline (`.fr-input`, 15px/600, sin borde). Valor mock "Visa Galicia".
  - Fila **Banco / emisor**: ícono banco + input inline. Valor mock "Banco Galicia". **La inicial del avatar del preview se deriva de la 1ª letra del banco.**

**C) Red / marca** (`form-section-label` "RED / MARCA")
- **Chips** (`.pills`, wrap, gap 8px). Lista completa: **Visa · Mastercard · American Express · Cabal · Naranja · Maestro · Otra**. Chip seleccionado: fondo `--navy`, texto blanco. Selección única. Ampliable según las redes que soporte el backend.

**D) Ciclo de facturación** (`form-section-label`)
- **Checkbox row** `.check-row` "Cierra y vence el mismo día todos los meses" (**tildado por default**). Caja 22×22, check emerald cuando activo. Helper: "Destildá esto si tu cierre / vencimiento cambia mes a mes."
- **Cuando está tildado:** `field-group` con dos filas — "Día de cierre" (input numérico 1–31, mock 28) y "Día de vencimiento" (mock 10). Inputs `.day-num` (52px, centrado, tabular-nums).
- **Cuando se destilda:** se ocultan los dos días y aparece un `hint`: "Sin día fijo: vas a cargar el cierre y el vencimiento en cada resumen."

**E) Moneda principal** (`form-section-label`)
- **Segmented control** `.seg`: "ARS — Pesos" / "USD — Dólares". Selección única, default ARS.

**F) Límite total · opcional** (`form-section-label`, con sufijo "· opcional" en gris)
- **Campo plano** `.limit-field` (NO es toggle): prefijo "$" + input numérico (tabular-nums) + sufijo "ARS". Placeholder "Sin límite cargado". Puede quedar **vacío**.
- `hint`: "Dejalo vacío si no lo conocés."

**G) Acciones** (`form-section-label`)
- `action-block` con dos filas:
  - **Archivar tarjeta** (habilitada): título + sub "Sale de tu billetera; se conserva todo el historial. Podés reactivarla cuando quieras." + botón ghost "Archivar".
  - **Eliminar tarjeta** (**deshabilitada en este caso**): título con ícono candado + sub "Solo se pueden eliminar tarjetas sin movimientos. Esta ya tiene consumos registrados — archivala." + botón `.btn-del` disabled.

---

## Interactions & Behavior
- **Apertura:** desde el detalle de la tarjeta (botón "Editar" / lápiz). Drawer entra desde la derecha; transición sugerida `.34s cubic-bezier(.32,.72,0,1)`; scrim con blur aparece detrás.
- **Cierre:** botón X, tecla `Esc`, o click en el scrim. Si hay cambios sin guardar, confirmar descarte.
- **Guardar:** valida → persiste → cierra drawer → toast "Tarjeta actualizada". Deshabilitar "Guardar" mientras haya un campo requerido inválido.
- **Preview en vivo:** nombre, inicial (del banco), red, ciclo y límite se reflejan al instante. El color es fijo (institución). El badge de estado (due/soon/ok) es ilustrativo (lo calcula el backend).
- **Checkbox "mismo día":** al destildar oculta los dos días y cambia el mini-diagrama del preview a "variables".
- **Chips de red:** selección única; al cambiar, actualiza la meta del preview.
- **Límite vacío:** el preview muestra "sin cargar" y la tarjeta queda sin barra de disponible.
- **Eliminar vs. Archivar (regla clave):** son mutuamente excluyentes según si la tarjeta tiene/tuvo movimientos:
  - **Sin movimientos (ni históricos):** Eliminar **habilitado** (definitivo, con confirmación). Archivar disponible pero innecesario.
  - **Con movimientos / cuotas:** Eliminar **deshabilitado** (con copy explicativo); Archivar es la acción recomendada (suave, reversible, conserva historial).
- No usar `scrollIntoView`.

## State Management
Estado del formulario (modo edición, prellenado con la tarjeta actual):
```
{
  id,                    // id de la tarjeta
  nombre,                // string (requerido, máx ~32)
  banco,                 // string (requerido) → inicial del avatar = banco[0]
  red,                   // 'visa'|'mastercard'|'amex'|'cabal'|'naranja'|'maestro'|'otra'
  // accent: lo define el backend según la institución — NO es campo del form
  cicloMismoDia,         // bool (default true) → si false no hay días fijos
  diaCierre,             // 1–31  (solo si cicloMismoDia)
  diaVencimiento,        // 1–31  (solo si cicloMismoDia)
  monedaPrincipal,       // 'ARS' | 'USD'
  limite,                // number | null  (opcional; null = sin cargar)
  tieneMovimientos,      // bool (del backend) → gobierna eliminar(false) vs archivar(true)
  dirty                  // hay cambios sin guardar → habilita Guardar / confirma descarte
}
```
**Derivados que recalculan el preview:** `nombre`, `banco` (→ inicial), `red` (→ meta), `cicloMismoDia` + `diaCierre`/`diaVencimiento` (→ mini-diagrama), `limite` (→ línea de límite). El color sale de `accent`, asignado por el backend según la institución.

### Validaciones
- Nombre y banco no vacíos.
- Si `cicloMismoDia`: `diaCierre` y `diaVencimiento` enteros **1–31** (para meses cortos el backend hace clamp: 31 → último día). Si no, no se piden.
- Si se carga `limite`: > 0 (puede quedar vacío = sin límite).
- `diaVencimiento` ≤ `diaCierre` → se interpreta como el **mes siguiente**.

---

## Design Tokens

### Colores
| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#F6F7F9` | fondo app / drawer |
| `--card` | `#FFFFFF` | superficies |
| `--navy` | `#0B1A2B` | texto principal, botón primario, chip activo |
| `--muted` | `#6B7683` | texto secundario |
| `--soft-text` | `#8A94A3` | labels de sección |
| `--faint` | `#AEB6C0` | placeholders, sufijos |
| `--border` | `#E6EAEF` | bordes |
| `--divider` | `#F1F3F6` | divisores internos |
| `--field-bg` | `#FAFBFC` | fondo de íconos / inputs num |
| `--emerald` | `#10B981` | check activo, dot "ok" |
| `--emerald-deep` | `#0E9E6E` | texto estado ok |
| `--terracota` | `#B56A5A` | montos negativos, dot vencimiento, eliminar |
| `--slate` | `#3A6B8A` | avatar usuario |
| `--brand` | `#15B981` | logo grana |

**Colores de acento por institución** (los asigna el backend, NO se eligen en el form): `#F4A024` naranja, `#3A6B8A` slate, `#8C7AA0` plum, `#0E9E6E` emerald, `#B56A5A` terracota, `#C99A2E` amber, `#5E8CA8` steel.

**Estados (badges):** due → bg `#F6E7E2` / text `#9A4B38`; soon → bg `#FBF3DE` / text `#9A7B22`; ok → bg `#DEF1E7` / text `#0E9E6E`.

### Tipografía
- Familia: **Plus Jakarta Sans** (400/500/600/700/800).
- Título drawer 25px/800/-0.03em · sección-label 11px/800/uppercase/.09em · label de campo 11px/700/uppercase/.05em · valor de campo 15px/600 · monto límite 17px/700 · chip 13.5px/700.
- `tabular-nums` en todos los números (días, montos).

### Radios
Drawer/cards 20–22px · field-group / check-row / límite 14–15px · íconos de campo / inputs num 9–11px · chips 999px · botones 10–14px.

### Sombras
- Drawer: `-24px 0 60px -20px rgba(11,26,43,.34)`.
- Botón Guardar: `0 8px 20px -4px rgba(11,26,43,.30)`.
- Chip/segment activo: `0 1px 3px rgba(11,26,43,.10)`.

### Espaciado
Body padding `22px 28px 28px` · gap entre filas por bordes · `form-section-label` margin-top 22px entre bloques · gap chips 8px.

## Assets
- **Íconos:** SVG line inline (stroke 2, round join/cap). Reemplazar por el set del codebase (Lucide / Feather mapean 1:1: card, building/bank, calendar, clock, bar-chart, lock, trash, x, info, check, chevron-left).
- **Tipografía:** Google Fonts "Plus Jakarta Sans" (o la del sistema si ya está).
- No hay imágenes raster ni logos externos.

## Files
- `Grana - Editar tarjeta.html` — **implementación final** (drawer B + mini-ciclo), autocontenido. Fuente de verdad.
- `referencia/Grana - Editar tarjeta (estilos).html` — comparativa de las 3 direcciones (canvas).
- `referencia/editar-estilos/dir-a.html` — A · drawer canónico.
- `referencia/editar-estilos/dir-b.html` — B · drawer + preview (base del final).
- `referencia/editar-estilos/dir-c.html` — C · página dos columnas (de acá salió el mini-diagrama de ciclo).
- `referencia/editar-estilos/shared.css` — tokens + primitivas de form compartidas.

> Para el sistema completo del módulo Tarjetas (listado, detalle, tokens), ver `design_handoff_tarjetas/README.md` en el proyecto.
