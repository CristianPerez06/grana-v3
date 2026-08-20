# Handoff: Dashboard (Inicio) de grana — web + mobile

> **Alcance de este documento: lo VISUAL.** Colores, tipografía, espaciados, radios,
> layout y animación se toman de acá.
>
> **La semántica y el comportamiento NO se gobiernan desde este archivo.** Los define
> el spec del change `redesign-dashboard-home-v2`
> (`openspec/changes/redesign-dashboard-home-v2/specs/dashboard/spec.md`, y una vez
> archivado, `openspec/specs/dashboard/spec.md`). Este handoff se escribió sin el
> contexto de las decisiones de producto que se tomaron después, así que en varios
> puntos dice lo contrario de lo vigente. Donde difieran, **manda el spec**.
>
> Divergencias conocidas al momento de incorporarlo:
>
> | Dice el handoff | Rige el spec |
> |---|---|
> | "El saldo disponible es de hoy y no cambia" | El saldo sigue al selector de mes, cortado al cierre del mes seleccionado |
> | `ritmo = gastaste / ingresoMensualEsperado` | El denominador son los ingresos acreditados del mes; no existe un ingreso esperado configurable |
> | "todos los montos en ARS y USD con el mismo tipo de cambio" | ARS y USD son saldos reales independientes; no hay conversión ni tipo de cambio global |
> | La apertura de los tiles se muestra siempre, con filas en cero | Sin actividad compartida no hay apertura: el tile no gira y no muestra la pista |
> | `Por pagar = Gastaste − Ya se pagó` como resta entre lentes | Los tres montos se derivan de una sola lente (gastos propios) y cierran por construcción |
> | "Regla de corte entre 1 y 2 a definir con producto" | Definida: el ritmo desborda por encima de 100× (10.000%) |
>
> Lo que el handoff sí aporta y no está en el spec: el giro 3D de los tiles con su
> altura fija, la escala tipográfica, el formato `US$`, el botón primario en verde y
> el hero sin centavos.


## Overview
Pantalla de inicio de **grana**, app de finanzas personales bimonetaria (ARS + USD). Cuatro bloques:

1. **Saldo disponible total** (hero oscuro) + **Dónde está** (cuentas principales por moneda) + **Resumen del mes** (Tenías / Entró / Se fué).
2. **Cuánto gastaste** — tres tiles (Gastaste / Ya se pagó / Por pagar); los dos últimos **giran** y muestran su detalle en el dorso. Al pie, el ritmo del mes con tres estados posibles.
3. **Compromisos del próximo mes** — total comprometido + dos grupos desplegables (Tarjetas / Gastos fijos).
4. **Compartido** — tira fina con el saldo del grupo (te deben o debés).

## About the Design Files
Los HTML de este bundle son **referencias de diseño**, no código de producción. Muestran el aspecto y el comportamiento buscados. La tarea es **recrear estos diseños en el entorno del codebase** (React, Vue, SwiftUI, native, etc.) con sus componentes y patrones. Si todavía no hay entorno, elegir el framework adecuado e implementarlos ahí. Nada de números hardcodeados: todos los montos, porcentajes y textos derivados se calculan (ver *State management*).

## Fidelity
**Hi-fi.** Colores, tipografía, espaciados, radios, animación y estados son definitivos; el detalle está más abajo.

## Files
- `Dashboard Web.html` — desktop: sidebar 248px + main con contenido `max-width:1080px`. Colapsa a una columna por debajo de 1080px.
- `Dashboard Mobile.html` — mobile, ancho de referencia **390px** (el marco de teléfono es contexto, no parte del componente).
- `Card Cuanto gastaste - estados.html` — la card de “Cuánto gastaste” aislada, con los **tres estados del pie** uno debajo del otro. Es la referencia canónica de esa card.

---

## Screens / Views

### Layout general — Web
- `.shell`: `grid-template-columns: 248px 1fr`, `min-height:100vh`.
- **Sidebar**: fondo blanco, borde derecho `1px solid #E8ECF1`, padding `26px 18px`, `gap:26px`. Logo “grana.” 21px/800/`-0.045em` (punto en `#11B981`). Ítems 13.5px/700 `#6B7683`, padding `10px 11px`, radio 11px, ícono 18px stroke 1.9; hover `#F4F7F9`; activo `background:#142231;color:#fff`. Orden: Inicio (activo), Cuentas, Tarjetas, Movimientos, Compartido; al pie Configuración.
- **Main**: padding `28px 34px 60px`; `.content{max-width:1080px;margin:0 auto;display:flex;flex-direction:column;gap:14px}`.
- **Topbar**: izquierda `h1` “Hola, Julieta.” 26px/800/`-0.035em` + fecha 13px/600 `#8A94A3`. Derecha: selector de mes (card blanca, borde `#E8ECF1`, radio 11px, chevrons 22×22 radio 7 hover `#F1F4F7`, label 13px/800 `white-space:nowrap`), botón ojo 38×38 radio 11 y botón primario **“Nuevo movimiento”**: `background:#11B981`, hover `#0E9E6E`, texto blanco 13px/800, radio 11px, padding `10px 16px`, con ícono “+” 14px (stroke 2.6) y `gap:7px`.
- **Fila 1** (ancho completo): card Saldo + Resumen.
- **Fila 2**: `grid-template-columns:1fr 1.12fr; gap:14px; align-items:stretch` → Cuánto gastaste | Compromisos. Ambas `display:flex;flex-direction:column`; en Cuánto gastaste la tira de ritmo lleva `margin-top:auto` para que las dos cards terminen alineadas.
- **Pie**: tira Compartido a ancho completo.
- Dentro del hero, los bloques internos (`.w2h`, `.w2`, `.mes .grid`) están limitados a `max-width:660px` centrados.

### Layout general — Mobile
- Columna única, `gap:12px` entre cards, ancho de contenido **≈362px** en viewport de 390px.
- **Top bar**: “grana.” 17px/800 + selector de mes compacto (chevrons 20×20, label “Agosto” 11.5px/800, radio 10px), botón ojo 32×32 y avatar “JL” 32×32 circular `#142231`.
- **Saludo**: “Hola, Julieta.” 19px/800/`-0.035em` + fecha 12px/600 `#8A94A3`.
- Orden de cards: Saldo+Resumen → Cuánto gastaste → Compromisos → Compartido.

---

### 1) Card “Saldo disponible total” + “Resumen del mes”
Una card (blanca, borde `1px solid #E8ECF1`, radio 20px) con dos zonas.

**Zona oscura** (`background:#142231`, texto blanco, centrada; mobile padding `20px 18px 17px`, web `24px 22px 20px`):
- Label “SALDO DISPONIBLE TOTAL”: 10.5–11px/800, `letter-spacing:.12em`, uppercase, `rgba(255,255,255,.5)`.
- Monto **sin centavos**: mobile 34px, web `clamp(34px,3.4vw,42px)`, peso 800, `letter-spacing:-0.05em`, `line-height:.95`; el `$` en `rgba(255,255,255,.4)`.
- Fila USD: chip “USD” (11px/800, padding `4px 10px`, radio 999px, `background:rgba(17,185,129,.18)`, color `#4FD6A4`) + valor **“US$ 600,00”** 15–16px/700 `rgba(255,255,255,.92)`.
- Separador `border-top:1px solid rgba(255,255,255,.1)`.
- **Encabezado de “Dónde está”**: dos columnas iguales. Columna 1: “DÓNDE ESTÁ” a la izquierda (10–10.5px/800, `.12em`, uppercase, `rgba(255,255,255,.45)`) y **“ARS”** a la derecha; columna 2: **“USD”** al inicio y link “Ver cuentas ›” a la derecha (12–12.5px/700 `#4FD6A4`, hover `#7FE3BF`). La columna 2 lleva `padding-left:13px` (web 15px).
- **Cuentas**: dos columnas; la segunda con `border-left:1px solid rgba(255,255,255,.1)`. Cada fila: cuadradito 8–9px radio 2px con el color de la cuenta + nombre (11–12px/600 `rgba(255,255,255,.62)`) + porcentaje a la derecha (11.5–12.5px/800 blanco). Mock: ARS → Mercado Pago `#2F7FD1` 81%, Lemon `#A8E10C` 16%; USD → Billetera `#3A6B8A` 100%. **Sin barras de proporción.** Se listan hasta 2 cuentas por moneda (las de mayor saldo).

**Zona clara** (mobile padding `15px 16px 16px`, web `18px 22px 20px`, separada con `border-top:1px solid #E8ECF1`):
- Título “Resumen del mes” (mobile 15px/800, web 18px/800). Sin link.
- Grid de **tres columnas** iguales (mobile `gap:7px`, web `gap:14px`), cada bloque centrado:
  - **Tenías** — punto gris `#AEB6C0` (círculo), monto en `#142231`. Mock `$ 8.840.334` / `US$ 600,00`.
  - **Entró** — punto `#11B981`, monto `#0E9E6E` con signo `+`. Mock `+$ 24.711` / `+US$ 0,00`.
  - **Se fué** — punto `#3A6B8A`, monto `#3A6B8A` con signo `–` (guion medio, no menos ASCII). Mock `–$ 786.801` / `–US$ 0,00`.
  - Tipografías: etiqueta 10.5px (mobile) / 14px (web) 700 `#6B7683`; monto 14.5px / 27px 800 `-0.04em`; USD 9.5px / 13px 600 `#AEB6C0`. Todo con `white-space:nowrap`.

### 2) Card “Cuánto gastaste” (referencia: `Card Cuanto gastaste - estados.html`)
- Header: `h3` “Cuánto gastaste” + link “Ver detalle ›”.
- **Tres tiles** en `grid-template-columns:repeat(3,minmax(0,1fr))`, gap 8px (mobile) / 11px (web). Cada tile es un contenedor de altura fija — **mobile 150px, web 172px** — con `perspective:900px` (mobile) / `1000px` (web).
- **El giro**: dentro del tile, un `.inner` `position:absolute;inset:0;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.4,.1,.2,1)`. Al activarse: `transform:rotateY(180deg)`. Las dos caras (`.fa` frente, `.fb` dorso) son hermanas absolutas con `backface-visibility:hidden`; el dorso además `transform:rotateY(180deg)`.
  - **Importante**: el contenedor 3D **no puede ser un `<button>`** (el navegador aplana el contexto 3D y el dorso se ve espejado). Usar un `div` con `role="button"` y `tabindex="0"`, o el equivalente del framework.
  - Refuerzo del cambio de cara: `.fb{opacity:0}` y `.flip.on .fa{opacity:0}` / `.flip.on .fb{opacity:1}`, ambas con `transition:opacity 0s .25s` (el cambio ocurre a mitad del giro). Sin esto, algunos motores pintan las dos caras.
  - Solo un tile dado vuelta a la vez: al abrir uno, los otros vuelven al frente.
- **Frente de cada tile** (centrado, padding `11px 8px 0` mobile / `14px 12px 0` web): ícono 36px radio 12px con fondo tintado (Gastaste `#E7F8F0` + stroke `#0E9E6E`, bolsa; Ya se pagó `#E9F0F5` + `#3A6B8A`, tarjeta; Por pagar `#FBF0DD` + `#B9791B`, reloj) · etiqueta 10.5/12.5px 800 `#6B7683` · monto 14.5/19px 800 `-0.04em` en el color del bloque (`#0E9E6E` / `#3A6B8A` / `#C2705C`) · USD 9.5/10.5px 600 `#AEB6C0` · pista “Ver detalle ›” 9/10.5px 800 `#AEB6C0` (solo en los dos que giran) · filete de color 4px al pie, a sangre (`margin-top:auto`).
- **Dorso** (alineado a la izquierda, padding `10px 10px 0` / `13px 13px 0`): rótulo uppercase 8.5/10.5px 800 `.08–.1em` `#8A94A3` con cuadradito del color; dos filas donde el label va arriba (9/10.5px 700 `#8A94A3`) y el monto debajo (11.5/13px 800 `#142231`) — en dos líneas para que entre en el ancho angosto; al pie “‹ Volver” 9/10.5px 800 `#AEB6C0` y el mismo filete de color.
- **Contenido de los dorsos**: “Ya se pagó” → *Lo pagaste vos* / *Lo puso otra persona*. “Por pagar” → *En resúmenes de tarjeta* / *Se lo debés a alguien*. (Copys a confirmar con producto; la estructura es de dos filas, extensible.)
- **Semántica de los tres montos**:
  - **Gastaste** = total de gastos del mes (tile fijo, no gira).
  - **Ya se pagó** = de esos gastos, lo que ya salió de las cuentas.
  - **Por pagar** = `Gastaste − Ya se pagó` (los gastos con tarjeta de crédito + lo que le debés a alguien).
- **Pie: ritmo del mes** — bloque `background:#F7F9FB`, borde `1px solid #E8ECF1`, radio 15/16px, padding `11px 13px` / `14px 16px`, `display:flex;align-items:center;gap:13/15px`. **Tres estados**:
  1. **Con ingresos**: anillo 46/52px `conic-gradient(#11B981 0 <pct>, #DFE6EC <pct> 100%)` con agujero (`::after{inset:7/8px;background:#F7F9FB}`) y el `%` al centro (11.5/12.5px 800 `#0E9E6E`); a la derecha “Gastaste el **21%** de tus ingresos” (12.5/13.5px 700 `#6B7683`, número `#0E9E6E`), barra 6/7px (`#DFE6EC` con relleno `#11B981`) y pie “$ 212.494,67 de $ 1.000.000,00” 10.5/11.5px 600 `#AEB6C0`.
  2. **El porcentaje no dice nada** (hay ingresos pero son ínfimos frente al gasto): **sin anillo**; título con el emoji 👀 al inicio (`margin-right:7px`) + texto “Acá el porcentaje ya no ayuda” (13.5px/800 `#142231`) y bajada “Gastaste $483.740,94 y este mes entraron $0,39.” (12.5px/600 `#8A94A3`).
  3. **Todavía no entró nada**: **sin ícono ni anillo**, solo “Todavía no entró plata este mes” (13.5px/800) + “Cuando entre, vas a ver tu ritmo de gasto acá.” (12.5px/600).
  - Regla de corte entre 1 y 2 a definir con producto (p. ej. ingresos del mes por debajo de un mínimo o ritmo por encima de un umbral).

### 3) Card “Compromisos del próximo mes”
- Header: `h3` + sub “Septiembre 2026” (11.5/12.5px 600 `#8A94A3`) + link “Ver todos ›”.
- **Total**: bloque `#F7F9FB`, borde `1px solid #E8ECF1`, radio 16px, padding `13px 14px` / `15px 16px`, con label “YA COMPROMETIDO”, monto 28/31px 800 `-0.045em` (el `$` en `#AEB6C0`), USD 11.5/12px 600, barra apilada 8/9px radio 5px (Tarjetas `#3A6B8A` 63.2% · Gastos fijos `#7C5CD6` 36.8%) y leyenda con cuadraditos + porcentaje.
- **Dos grupos desplegables** (borde 1px, radio 16px, `overflow:hidden`):
  - Cabecera clickeable (padding `12px 13px` / `14px 15px`): ícono 32/36px con fondo `rgba(58,107,138,.14)` o `rgba(124,92,214,.14)`; nombre 12.5/13.5px 800; bajada 10.5/11.5px 600 `#8A94A3`; monto a la derecha 15/16.5px 800 con USD debajo; chevron 15/16px `#AEB6C0` que rota 180° (`transition:transform .18s ease`).
  - Cuerpo oculto por defecto; filas `padding:7–8px 0`, `border-top:1px solid #EEF1F5`, nombre 12/12.5px 600, monto 12/13px 800.
  - **Tarjetas**: se muestran hasta 3; si hay más, el resto aparece al desplegar. Mock: Visa 388.873, Amex 291.427, Naranja 78.000, Cabal 34.000, Mastercard 20.000.
  - **Gastos fijos**: soporta 10 filas; contenedor con `max-height:160px` (web 196px) y `overflow:auto`, y al pie el link “Ver mis gastos fijos ›”.
- Mock del total: `$ 1.284.500` / `USD 95,46` = Tarjetas `$ 812.300` + Gastos fijos `$ 472.200`.

### 4) Tira “Compartido”
- Toda la tira es un link: `display:flex;align-items:center;gap:10/13px`, padding `11px 14px` / `15px 22px`, alto ≈54px.
- Ícono 30/36px radio 10/12px, fondo `#E7F8F0`, stroke `#0E9E6E` (personas).
- “Compartido” 13/14.5px 800 `#142231` + avatares apilados 18/20px circulares `#11B981`, texto blanco 8/8.5px 800, borde `1.5px solid #FFF`, solapados `-6px`.
- Monto a la derecha: “Te deben $ 140.825” 13.5/15px 800 `#0E9E6E`. Si el saldo es contra el usuario: “Debés” en `#C2705C`.
- Chevron 15/16px `#AEB6C0`. **Renderizar solo si hay actividad en Compartido.**

---

## Interactions & Behavior
- **Giro de los tiles**: click/tap en “Ya se pagó” o “Por pagar” gira el tile 500ms; volver a tocarlo (o el “‹ Volver”) lo devuelve. Teclado: Enter/Espacio. Un solo tile dado vuelta a la vez. La card **no cambia de alto**. Respetar `prefers-reduced-motion`: sin rotación, cambio directo de cara.
- **Desplegables de Compromisos**: toggle independiente por grupo; `<button>` con `aria-expanded` y panel asociado por `id`.
- **Selector de mes**: recalcula Resumen del mes, Cuánto gastaste y Compromisos. El saldo disponible es de hoy y no cambia.
- **Botón ojo**: oculta/enmascara todos los montos (persistir la preferencia).
- **Links**: “Ver cuentas ›” → Cuentas; “Ver detalle ›” → detalle del mes; “Ver todos ›” → compromisos; “Ver mis gastos fijos ›” → recurrencias; tira Compartido → Compartido.
- **Hover**: links `#0E9E6E` → `#0B845C`; sobre fondo oscuro `#4FD6A4` → `#7FE3BF`; botón primario `#11B981` → `#0E9E6E`.
- **Scroll interno**: solo la lista de gastos fijos.
- **Responsive web**: ≤1080px se oculta la sidebar, la fila 2 pasa a una columna y el padding del main baja a `24px 20px 60px`. Mobile es la referencia para ≤680px.
- **Estados a cubrir**: los tres del ritmo (arriba), montos en cero, sin tarjetas, sin gastos fijos, sin actividad compartida (no renderizar la tira), carga (skeletons con los mismos radios) y error de fetch. Ritmo > 100%: anillo y barra en `#C2705C` y copy ajustado.

## State Management
- `selectedMonth` (el saldo no depende de él), `amountsHidden` (persistido), `flippedTile` (`null | 'pagado' | 'porPagar'`), `expandedGroups:{tarjetas,gastosFijos}`.
- `currencyView` no hace falta: ARS y USD se muestran siempre juntos.

Datos y derivaciones:
- `saldoTotal` (ARS y USD) y reparto por cuenta y moneda → hasta 2 cuentas por moneda con su % sobre el total de esa moneda.
- `teniasInicioMes`, `entro` (ingresos acreditados del mes), `seFue` (todo lo que salió de las cuentas en el mes).
- `gastaste` (total de gastos del mes), `yaSePago` (parte ya pagada, con su apertura: pagado por el usuario / puesto por otra persona), `porPagar = gastaste - yaSePago` (con su apertura: resúmenes de tarjeta / deudas con personas).
- `ritmo = gastaste / ingresoMensualEsperado`, más la bandera de cuál de los tres estados del pie corresponde.
- Compromisos: `total = tarjetas + gastosFijos`; % derivados; cada tarjeta con su próximo cierre para la bajada.
- Conversión USD: todos los montos en ARS y USD con el mismo tipo de cambio (mock ≈13.455 ARS/USD), dos decimales. Definir la fuente del tipo de cambio.
- Formato: miles con punto, decimales con coma; ARS con `$`, USD con `US$`. Signos `+` / `–` solo en Entró y Se fué.

## Design Tokens
- Fondos: `--bg:#EEF1F4`, `--card:#FFFFFF`, gris de bloques `#F7F9FB`, pistas `#DFE6EC`.
- Texto: `--ink:#142231`, `--muted:#6B7683`, `--soft:#8A94A3`, `--faint:#AEB6C0`.
- Bordes: `--border:#E8ECF1`, `--line:#EEF1F5`, `--hair:#E4E8EE`.
- Acentos: `--emerald:#11B981`, `--emerald-deep:#0E9E6E`, `--emerald-soft:#E7F8F0`, `--mint:#4FD6A4`, `--slate:#3A6B8A`, `--slate-soft:#E9F0F5`, `--amber:#E79A2B`, `--amber-deep:#B9791B`, `--amber-soft:#FBF0DD`, `--violet:#7C5CD6`, `--terracota:#C2705C`.
- Cuentas: Mercado Pago `#2F7FD1`, Lemon `#A8E10C`, Billetera `#3A6B8A`.
- Tipografía: **Plus Jakarta Sans** (400–800), fallback `system-ui, sans-serif`. Números con `font-variant-numeric: tabular-nums`. Escala: 8.5 / 9 / 9.5 / 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 14.5 / 15 / 16.5 / 18 / 19 / 26 / 27–31 / 34–42px. `letter-spacing`: `-0.025em` títulos, `-0.03/-0.04em` montos medianos, `-0.05em` montos grandes, `+0.08/0.12em` labels uppercase.
- Espaciado: escala de 2px (2…34). Gap entre cards 12px mobile / 14px web.
- Radios: 4px (filetes), 5–6px (barras), 10–12px (íconos, botones), 15–16px (bloques y tiles), 20px (cards), 999px (chips y avatares).
- Sombras: ninguna en las cards (se separan por borde 1px). La única sombra del prototipo es el marco del teléfono.
- Movimiento: giro `transform .5s cubic-bezier(.4,.1,.2,1)`, cambio de cara `opacity 0s .25s`, chevron `transform .18s ease`.

## Assets
Sin imágenes ni logos externos. Todos los íconos son SVG inline (viewBox 24×24, `fill:none`, `stroke-width:1.9–2.6`, extremos redondeados): grilla, billetera, tarjeta, líneas, personas, engranaje, ojo, chevrons, bolsa, reloj, documento, “+”. El único recurso externo es Plus Jakarta Sans (Google Fonts) — reemplazar por la fuente equivalente si ya está empaquetada. El emoji 👀 del segundo estado del pie es texto, no imagen.
