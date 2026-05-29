# Handoff: Registrar / Editar movimiento (Grana · Movimientos — Desktop)

## Overview
Formulario de **carga y edición de movimientos** del módulo Movimientos de Grana (app de finanzas personales, AR). Es la pantalla que el usuario va a usar más seguido, así que el objetivo principal es **mínima fricción**: el monto toma foco al abrir, lo avanzado está oculto hasta que se necesita, y se puede cargar un movimiento atrás de otro sin cerrar.

Se presenta como un **drawer lateral derecho** que se desliza sobre la lista de Movimientos (mantiene contexto, entra rápido). Cubre los **4 tipos** de movimiento: **Gasto, Ingreso, Transferencia y Ajuste de saldo**. La UX hereda de los forms mobile de Grana (monto hero + tabs de tipo + filas + progressive disclosure), traducida al lenguaje desktop de v3.

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML/CSS/JS vanilla** — un prototipo que muestra el look y el comportamiento buscados, **no** código de producción para copiar tal cual. La tarea es **recrear este diseño en el codebase real de Grana** (React/Vue/etc.) usando sus patrones, su design system y los componentes que ya existen en las pantallas de v3 (Movimientos, Cuentas, Recurrencias). El shell desktop (sidebar 300px + main 1040px) ya existe en v3: **no reconstruirlo**, reutilizarlo. Implementar acá el drawer + el formulario.

## Fidelity
**Alta fidelidad (hi-fi).** Colores, tipografía, spacing, tamaños e interacciones son finales y deben recrearse fielmente, respetando los tokens de v3 (ver "Design Tokens"). El prototipo usa Plus Jakarta Sans (Google Fonts) — usar la del design system si difiere.

## Alineación con las funcionalidades reales de v3 (IMPORTANTE)
Este form fue ajustado para reflejar **solo** lo que v3 tiene hecho hoy:
- ✅ **Subcategorías**: las categorías son *drillables* (mismo modelo que el donut "En qué se fue"). El selector de categoría entra a la subcategoría.
- ✅ **Cuotas**: existen (tarjetas de crédito). Aparecen automáticamente al elegir una cuenta de crédito en un Gasto.
- ✅ **Reintegro**: existe (en la lista aparece "Reintegro Coto / A confirmar"). Va **dentro del Gasto** como toggle (NO como flujo aparte).
- ✅ **Repetir / Recurrencia**: módulo completo en v3 ("Grana pregunta, vos confirmás"). Las frecuencias coinciden con el modal de Recurrencias: Semanal · Quincenal · Mensual · Anual · Personalizado.
- ✅ **Ajuste de saldo**: existe (acción "Ajustar saldo" en Cuentas).
- ❌ **Compartido / dividir gastos**: **eliminado** — el módulo no está implementado. No incluirlo.

---

## Layout general

### Shell (ya existe en v3 — reutilizar)
Frame `1440px`, grid `sidebar 300px + main 1fr`, contenido a `max-width 1040px`. La lista de Movimientos (header con mes, banner de recurrencia sugerida, card "En qué se fue" con donut, filtros, grupos por día con `.tx-row`) es la pantalla existente. El drawer se monta encima.

### Drawer
- `position: fixed; top:0; right:0; bottom:0; width: 528px;` full-height.
- Fondo `#F6F7F9` (page). Sombra `-24px 0 60px -20px rgba(11,26,43,.30)`.
- Entra con `transform: translateX(100% → 0)`, transición `.34s cubic-bezier(.32,.72,0,1)`.
- **Scrim** detrás: `rgba(11,26,43,.30)` + `backdrop-filter: blur(2px)`, fade `.28s`. Click en scrim cierra.
- Estructura vertical: **Header (fijo)** → **Body (scroll)** → **Footer (fijo)**.

---

## Header (fijo, fondo blanco, borde inferior `1px #E6EAEF`)
Padding `22px 28px 0`.
1. **Fila superior** (flex space-between):
   - Izquierda: eyebrow "NUEVO" (11px/700, uppercase, tracking .15em, color muted) + título "Registrar movimiento" (25px/800, −0.03em, navy, `white-space:nowrap`). En **edición**: eyebrow "EDITAR" + título "Editar movimiento".
   - Derecha: botón **eliminar** (solo en edición — icono tacho, 38×38, radius 11px, borde 1px; hover fondo terracotta-soft + color terracotta) + botón **cerrar** (icono ✕, mismo estilo).
2. **Type tabs** (segmented): contenedor `#EEF1F5`, radius 13px, padding 4px, margin-bottom 18px. 4 botones flex iguales (14px/700): **Gasto · Ingreso · Transferencia · Ajuste**. Activo = fondo blanco + `box-shadow: 0 1px 3px rgba(11,26,43,.10), 0 0 0 .5px rgba(11,26,43,.04)`, color navy. Inactivo color muted. (En **edición**, cambiar de tipo está deshabilitado.)

---

## Body (scroll) — orden vertical y comportamiento por tipo

### 1. Amount hero (siempre)
Card blanca, radius 18px, padding `20px 22px 22px`, margin-bottom 16px. En focus: borde `#C9CFD7` + `box-shadow: 0 0 0 4px rgba(11,26,43,.05)`.
- Fila top: label "MONTO" (11px/700 uppercase, color soft-text) + **pill de moneda** a la derecha (clickeable, alterna `ARS`/`USD`): fondo field-bg, borde 1px, radius 9px, 12px/700 + chevron-down.
- Fila monto: `[signo opcional] $ [input grande]`. Símbolo "$" 27px/600 opacity .5. **Input** 46px/700, `letter-spacing:-0.045em`, tabular-nums, placeholder "0". Es el campo que **toma foco al abrir** (autofocus tras 360ms para no chocar con la animación).
- Helper debajo (12.5px): solo en Ingreso ("+ Entra a tus cuentas", verde) y Ajuste ("Positivo aumenta el saldo · negativo lo reduce", muted). Oculto en Gasto/Transferencia.
- **Color del monto por tipo**: Gasto/Transferencia = navy (ink); Ingreso = `#059669` (verde, incluye el input y el signo); Ajuste = navy con signo +/−.
- **Formato en vivo**: separador de miles `.` (es-AR). Decimales tras `,` (máx 2). Ej: tipea `8450` → `8.450`; `8450,5` → `8.450,5`.

### 2. Sign toggle (SOLO Ajuste)
Dos opciones flex: **Sumar (+)** / **Restar (−)**. Activo = fondo navy, texto blanco. Default: Restar. Cambia el signo del hero y recalcula el preview.

### 3. Context banner (SOLO Ajuste)
Banner ámbar (`#FCF5E0`, borde `#F2E3B8`, radius 13px): icono balanza + "**Ajuste manual.** Corregí la diferencia entre tu saldo real y el de Grana. No crea un ingreso ni un gasto."

### 4. Grupo principal de campos (`field-group` — card con filas divididas)
Filas según tipo (ver tabla). Cada **fila** (`.field-row`): icono 36×36 (radius 11px, fondo field-bg, color muted) + bloque (label uppercase 11px/700 soft-text + valor 15px/600 navy) + chevron-right faint a la derecha. Clickeable → abre **popover** anclado a la fila. Hover fondo `#FBFCFD`.

| Fila | Gasto | Ingreso | Transferencia | Ajuste |
|---|---|---|---|---|
| **Cuenta** (label) | "Desde" | "A la cuenta" | "Desde" | "Cuenta a ajustar" |
| **Cuenta destino** "Hacia" | — | — | ✅ (+ botón swap) | — |
| **Categoría** | ✅ (drillable) | ✅ | — | — |
| **Fecha** | ✅ | ✅ | ✅ | ✅ |

- **Fila Cuenta**: dot de color + nombre + (badge "CRÉDITO" si aplica) + saldo a la derecha (muted, tabular). El **icono cambia** a tarjeta si la cuenta es de crédito, billetera si no. Si es crédito en Gasto, muestra subtexto "Consume saldo disponible · próximo resumen 15 jun".
- **Fila Hacia** (transferencia): mismo formato; **botón swap** circular navy flotante (32px) entre las dos filas → invierte origen/destino (hover rota 180°).
- **Fila Categoría**: dot 14px + nombre + (`›` + subcategoría si hay) + chip **"SUGERIDA"** (fondo emerald-soft, color emerald-deep, icono sparkle) cuando la categoría fue auto-sugerida (se oculta al elegir manualmente).
- **Fila Fecha**: valor tipo "Hoy · mié 28 may".

### 5. Cuotas card (SOLO Gasto + cuenta de crédito) — aparece/desaparece automáticamente
Card con: header (icono tarjeta terracotta + "Cuotas") + fila horizontal de **pills** `1× 2× 3× 6× 9× 12× 18× 24×` (scroll-x; activo = navy/blanco) + **línea de breakdown** (fondo field-bg): "**N** cuotas de **$X** · primera vence **15 jun**" (X = monto / N, redondeado).

### 6. Grupo Descripción (`field-group`, una fila, no clickeable)
Icono texto + label + **input de texto** inline (15px/600). En Ajuste el label cambia a "Motivo del ajuste", placeholder "Ej: Había menos efectivo del registrado", y muestra subtexto "Requerido — ayuda a entender el ajuste después".

### 7. Preview de saldo (SOLO Ajuste)
Fila: label "SALDO QUEDARÁ" + "`$saldo_actual →` `$saldo_resultante`". Recalcula con el monto y el signo: `restar` → actual − monto; `sumar` → actual + monto.

### 8. Toggles (progressive disclosure) — `toggle-group`
Cada toggle: icono 36px + label + helper + **switch iOS** (40×23, on = verde, knob 19px). Al activar (`.on`): el icono se tinta verde y se despliega un panel (`tr-panel`, borde superior divisor).

| Toggle | Aparece en | Panel al activar |
|---|---|---|
| **Tiene reintegro** | Gasto | "Monto del reintegro" (mini-field "Esperás recuperar" + input) + nota "Lo vas a confirmar cuando impacte en tu cuenta." |
| **Repetir** | Gasto, Ingreso, Transferencia | "¿Cada cuánto?" + **freq-pills**: Semanal · Quincenal · **Mensual (default)** · Anual · Personalizado (selección única; activo = navy/blanco) + nota "Grana te va a pedir confirmar antes de registrarlo cada mes." |

> Nota: "Repetir" crea una **recurrencia** en el módulo de Recurrencias (modelo "Grana pregunta, vos confirmás"). Reutilizar el modelo/endpoint de recurrencias de v3.

---

## Footer (fijo, fondo blanco, borde superior)
Padding `16px 28px`, flex gap 12px:
- **Botón submit** (flex:1, 52px, radius 14px): label dinámico "Registrar gasto / ingreso / transferencia / ajuste" + `kbd ⌘↵`. Color: Ingreso = verde (`#10B981` + sombra verde); resto = navy. En **edición** el label es "Guardar cambios" (sin kbd).
- **Botón "+ Otro"** (52px, ghost, borde 1px): **guardar y cargar otro** — guarda, limpia monto + descripción, mantiene cuenta/fecha/tipo, y vuelve a poner foco en el monto. Oculto en edición.

---

## Selector de Categoría con drill de subcategorías (clave)
El popover de Categoría replica la interacción de drill del card "En qué se fue" de v3.
- **Nivel 0**: lista de categorías. Las **drillables** (con subs) muestran `›` a la derecha; las no drillables muestran check de selección.
  - Click en categoría **no drillable** → selecciona y cierra.
  - Click en categoría **drillable** → entra al nivel 1 (NO selecciona aún).
- **Nivel 1** (subcategorías de la categoría): fila "‹ {emoji} {Categoría}" (volver) + ítem **"Toda la categoría"** (selecciona la categoría sin subcat) + una fila por subcategoría (dot del color de la categoría). Click → selecciona `categoría + subcategoría` y cierra.
- Al seleccionar manualmente, se quita el chip "SUGERIDA".

### Popovers (genérico)
`position: fixed`, min-width 280px (o ancho de la fila), max-width 340px, radius 16px, sombra fuerte, `max-height 60vh` con scroll. Aparece con fade + `translateY(-6px)→0` + scale. Se posiciona debajo de la fila ancla (clamp dentro del viewport; si no entra abajo, va arriba). **Cierra** con click afuera, scroll del body, o Esc. Tipos: cuenta-origen, cuenta-destino, categoría (con drill), fecha.

---

## Interactions & Behavior
- **Abrir (crear)**: FAB `+` o botón "Registrar movimiento" → `resetForm()` + abre drawer. Autofocus en monto a los 360ms.
- **Abrir (editar)**: click en una `.tx-row` de la lista → precarga tipo/monto/descripción/categoría/cuenta, muestra botón eliminar, oculta "+ Otro", título "Editar movimiento", deshabilita cambio de tipo. (En el prototipo los datos se infieren de la fila; en producción usar el objeto real del movimiento.)
- **Cambiar tipo** (tab): reconfigura campos visibles, color del monto, helper, label de cuenta, toggles disponibles, CTA. Vuelve a enfocar el monto.
- **Moneda**: pill alterna ARS/USD.
- **Cuenta de crédito en Gasto** → muestra Cuotas. Cambiar a débito/efectivo → oculta Cuotas.
- **Swap** (transferencia): invierte origen/destino.
- **Submit** (`⌘/Ctrl+Enter` o botón): toast de confirmación + cierra (o, con "+ Otro", limpia y sigue).
- **Eliminar** (edición): toast + cierra.
- **Teclado**: `Esc` cierra el popover (si hay) o el drawer; `⌘/Ctrl+Enter` envía.
- **Transiciones**: drawer `.34s cubic-bezier(.32,.72,0,1)`; scrim `.28s`; switches/pills `.14–.18s`.

### Validación (a implementar en producción)
- Monto > 0 requerido para habilitar submit.
- Transferencia: origen ≠ destino.
- Ajuste: motivo requerido.
- Cuotas: 1–36 (pill "Otro" → input numérico con −/+ y máx 36; el prototipo lo muestra de forma estática).

---

## State Management
Estado del formulario (mapear a estado del componente):
```
type:        'gasto' | 'ingreso' | 'transferencia' | 'ajuste'
mode:        'create' | 'edit'
currency:    'ARS' | 'USD'
sign:        '+' | '−'        // solo ajuste
amount:      number
fromId:      accountId        // origen / cuenta destino-ingreso / cuenta a ajustar
toId:        accountId        // solo transferencia
catId:       categoryId       // gasto/ingreso
subId:       string | null    // subcategoría (label) o "toda la categoría"
catSuggested:boolean          // muestra chip "Sugerida"
date:        string|Date
cuotas:      number           // solo gasto+crédito
reintegro:   { on, monto }
repetir:     { on, frecuencia }
```
Estado de UI: `drawerOpen`, `popOpen` + tipo + ancla, `catDrill` (categoría en la que se está drilleando dentro del popover), toggles on/off.
Data del backend: lista de cuentas, árbol de categorías + subcategorías, (al editar) el movimiento; al guardar "Repetir" se crea una recurrencia.

---

## Data Model (del prototipo — reemplazar por el del backend)
```js
// Cuentas
{ id, name, dot /*color*/, bal /*saldo*/, kind: 'debito'|'credito'|'efectivo'|'ahorro', sub? }
// ej: Galicia · Débito (slate, débito) · Galicia Visa (terracotta, crédito) ·
//     Billetera / Efectivo · Chanchito · Viaje 2026 (ahorro) · Galicia · Caja USD

// Categorías (gasto) — drillable si subs != null
{ id:'super',  name:'Supermercado',    dot:'#10B981', emoji:'🛒', subs:['Diario','Almacén','Limpieza','Bebidas'] }
{ id:'comida', name:'Comida y bebida', dot:'#2A8F7B', emoji:'🍷', subs:['Restaurantes','Cafeterías','Delivery','Mercado'] }
{ id:'hogar',  name:'Hogar',           dot:'#C98A3A', emoji:'🛋️', subs:['Muebles','Servicios','Mantenimiento'] }
{ id:'subs',   name:'Suscripciones',   dot:'#8C7AA0', emoji:'🎧', subs:['Streaming','Software','Música'] }
{ id:'transp', name:'Transporte',      dot:'#B56A5A', emoji:'🚌', subs:null }
{ id:'salud',  name:'Salud',           dot:'#5E8CA8', emoji:'💊', subs:null }
{ id:'tecno',  name:'Tecnología',      dot:'#3A6B8A', emoji:'💻', subs:null }
// Categorías (ingreso): Sueldo 💼, Freelance 💻, Reintegros ↩️, Intereses 📈, Regalo 🎁 (sin subs)
```

---

## Design Tokens
> Usar los tokens canónicos de v3. El prototipo difiere en un par de verdes/ámbar — **snapear a v3** al implementar.

| Token | v3 (canónico) | Notas |
|---|---|---|
| Fondo página | `#F6F7F9` | fondo del drawer también |
| Card / superficie | `#FFFFFF` | header, footer, cards de campos |
| Field bg | `#FAFBFC` | iconos de fila, mini-fields, pills |
| Texto navy / ink | `#0B1A2B` | |
| Texto muted | `#6B7683` | |
| Texto soft | `#8A94A3` / `#8C97A4` | labels uppercase |
| Texto faint | `#AEB6C0` | chevrons, placeholders, separador `›` |
| Borde | `#E6EAEF` | |
| Borde soft / divisor | `#EEF1F4` / `#F1F3F6` | |
| Emerald | `#10B981` | switch on, CTA ingreso |
| Emerald deep | `#0E9F73` | texto verde (el prototipo usó `#059669`) |
| Emerald soft | `#E4F5EE` | chip "Sugerida", icono toggle on (prototipo `#ECFDF5`) |
| Terracotta | `#B56A5A` | gastos, crédito, eliminar |
| Terracotta soft | `#FBEFEA` | |
| Amber | `#B58A1E` | banner ajuste (prototipo `#D9A21B`) |
| Amber soft | `#FBF3DE` | banner ajuste (prototipo `#FCF5E0`) |
| Slate | `#3A6B8A` | acentos, links |
| Plum | `#8C7AA0` | |
| Teal | `#2A8F7B` | |
| Brand | `#15B981` | logo |

**Tipografía**: Plus Jakarta Sans (400–800). Números con `font-variant-numeric: tabular-nums`. Moneda AR: miles `.`, decimales `,`. Signos: ingreso `+`, gasto `−` (U+2212), transferencia sin signo.
**Radios**: cards grandes 18px · field-group 15px · iconos de fila 11px · pills 9–10px · botones 11–14px · popover 16px · switch 12px.
**Sombras**: drawer `-24px 0 60px -20px rgba(11,26,43,.30)`; popover `0 20px 50px -12px rgba(11,26,43,.30)`; CTA verde `0 8px 20px -4px rgba(16,185,129,.35)`; CTA navy `0 8px 20px -4px rgba(11,26,43,.30)`; FAB `0 14px 30px -8px rgba(11,26,43,.45)`.

## Assets
- **Iconos**: todos inline SVG (stroke, currentColor) — sin archivos. Glifos usados: billetera, tarjeta, chanchito, tag, calendario, texto, repeat, reintegro (círculo $), swap, balanza (ajuste), sparkle, check, ✕, tacho, chevron-right/down, info.
- **Emojis de categoría**: 🛒 🍷 🛋️ 🎧 🚌 💊 💻 · ingreso 💼 ↩️ 📈 🎁. En producción decidir si se mantienen emojis o se usa el set propio (v3 ya usa emojis, es consistente mantenerlos).
- **Fuente**: Plus Jakarta Sans (Google Fonts).

## Files
- `Grana - Registrar movimiento (desktop).html` — pantalla completa: lista de Movimientos (v3) + drawer del formulario. Incluye todo el CSS del drawer en el `<style>`.
- `registrar-form.js` — toda la lógica del formulario (estado, tabs, formato de monto, popovers + drill de subcategorías, cuotas, toggles, edición, atajos de teclado). Revisar para los detalles exactos de comportamiento y datos de ejemplo.

> En el prototipo, el drawer **abre automáticamente al cargar** (línea `openCreate()` al final de `init()` en `registrar-form.js`) solo para facilitar la review — en producción arranca cerrado y se abre desde el FAB / botón / click en un movimiento.
