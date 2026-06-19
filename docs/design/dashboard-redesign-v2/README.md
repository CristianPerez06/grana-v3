# Handoff: Rediseño Dashboard / Inicio de grana

## Overview
Rediseño de la pantalla **Inicio** (dashboard) de **grana**, app de finanzas personales bimonetaria (ARS + USD). La pantalla responde, de un vistazo y en este orden:
1. **¿Cuánto tengo para gastar hoy?** (ARS + USD) y **¿dónde está?** (cuentas).
2. **¿Cómo vengo este mes?** (Balance: ingresos / gastos / ajustes).
3. **¿Qué tengo comprometido del próximo mes?** (resúmenes de tarjeta + gastos recurrentes, y opcionalmente ingresos recurrentes).
4. **Compartido** (opcional): saldo neto con el grupo Hogar.
5. **¿En qué gasté este mes?** (gastos por categoría).

Principio rector del rediseño: **que lo visual comunique el dato sin tener que leer en detalle** (barra de concentración, total dentro de la dona, barras proporcionales, semáforo de "ajustes", etc.). Es responsive: una sola pantalla para **web (desktop)** y **mobile**.

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML/CSS/JS** — prototipos que muestran el look & feel y el comportamiento buscado, **no** código de producción para copiar tal cual. La tarea es **recrear este diseño dentro del codebase/entorno existente de grana** (React, Vue, etc.), usando sus componentes, design system y convenciones. Si todavía no hay entorno definido, elegir el framework más apropiado e implementarlo ahí.

- `Dashboard Final v1.html` — pantalla final con **datos reales de hoy** (Comprometido = solo egresos, sin ingreso recurrente). Abrir en el navegador para desktop; redimensionar a ≤680px para ver mobile.
- `Dashboard Final v1 (Comprometido con ingreso).html` — **mismo diseño**, pero muestra el estado de la card **Comprometido cuando hay un ingreso recurrente** (ej. sueldo). Sirve como spec del caso "con ingreso".

Las dos comparten el 100% del layout; la única diferencia es la card Comprometido.

## Fidelity
**Alta fidelidad (hi-fi).** Colores, tipografía, espaciados y estados están definidos. Recrear pixel-perfect con los componentes del codebase. Fuente: **Plus Jakarta Sans** (Google Fonts), pesos 400–800. Formato de moneda AR: miles con `.`, decimales con `,`. Todos los números usan `font-variant-numeric: tabular-nums`.

## Layout general
Shell de 2 zonas en desktop (CSS grid): `grid-template-columns: 248px 1fr` → **sidebar** + **main**.
- `.main` padding `30px clamp(20px,3.2vw,42px) 64px`; `.content` centrado, `max-width: 1080px`.
- Contenido en columna (`.grid-main`, `display:flex; flex-direction:column; gap:16px`), en este orden:
  1. **Fila superior** (`.r-top`, grid `1.1fr 1fr`, gap 16, `align-items:stretch`): **Para gastar** (hero oscuro) + **Dónde está**.
  2. **Fila** (`.r-two`, grid `1.3fr 1fr`, gap 16, stretch): **Balance del mes** + **Comprometido**.
  3. **Compartido** (card full-width; renderizar solo si hay actividad compartida).
  4. **Gastaste este mes** (card full-width: caja vs tarjeta).
  5. **¿En qué gasté este mes?** (card full-width: dona + leyenda).

## Datos de ejemplo (mock) — reemplazar por datos reales
- **Para gastar (hoy):** ARS `$9.892.017,06` · USD `US$ 600,00`. (El total ARS = suma de las cuentas en pesos.)
- **Dónde está (cuentas):** Cta remunerada `$9.575.790,25` (97%), CA `$146.939,17`, Billetera `$108.200,00`, Personal Pay `$53.082,99`, Cta DNI `$6.004,44`, CU `$2.000,21`. Tenencia en dólares `US$ 600,00`.
- **Balance de junio:** `+$7.022.760,84`. Ingresos `$8.388.800,94`, Gastos `$498.379,65`, **Ajustes** `−$867.660,45` (plata movida sin registrar). USD `US$ 0,00`.
- **Comprometido (sale):** Total `$819.148,63` = Resúmenes tarjeta `$712.182` + Gastos recurrentes `$106.966`. USD `US$ 0,00`.
  - **Con ingreso recurrente (ej.):** además "Ya entra" Sueldo `+$1.450.000` → neto `+$630.851 a favor`.
- **Compartido (ej.):** grupo "Hogar" (vos y Martín) → `Te deben $34.500` (una sola dirección).
- **Gastaste este mes:** `$879.684,24` = De tu caja `$498.379,65` (56,65%) + Financiado en tarjeta `$381.304,59` (43,35%).
- **¿En qué gasté? (total $879.684,24):** Comida `$206.625,35` 23%, Transporte `$165.000,51` 19%, Entretenimiento `$114.940,00` 13%, Hogar `$109.589,12` 12%, Otros gastos `$94.866,66` 11%, Otros `$188.662,60` 21%.

## Screens / Components (desktop)

### Sidebar (248px, panel blanco flotante)
`background:#FFF; border-radius:0 26px 26px 0; box-shadow:1px 0 0 #E8ECF1; padding:26px 18px 22px`. Logo "grana" (800, 26px, `letter-spacing:-0.04em`, `#0B1A2B`) + punto verde 15px (`#11B981`) con "$" blanco. Nav (gap 3px): ícono 20px + label 15px/600; ítem activo `background:#E7F8F0; color:#0E9E6E; font-weight:700; border-radius:12px`. Ítems: Inicio (activo), Cuentas, Tarjetas, Movimientos, Compartido. Al fondo: "Configuración".

### Topbar
Flex space-between, `margin-bottom:22px`. Izq: `h1` "Hola, Julieta." (`clamp(24px,3.2vw,30px)`, 800, `-0.035em`, `#142231`) + fecha "Jueves, 18 de junio · vas **+$7.022.760** este mes" (14px/500, `#6B7683`; monto `#0E9E6E`/700). Der: **selector de mes** (blanco, borde, radius 12, flechas 32×32 + label "Junio 2026" 14px/800), **botón ojo** (42×42, radius 12, borde), **botón primario** "Nuevo movimiento" (`#11B981`, blanco, radius 13, padding 12/18, `box-shadow:0 8px 18px -6px rgba(17,185,129,.5)`). El selector de mes afecta solo a los módulos mensuales (Balance, En qué gasté), no a "Para gastar".

### 1) Para gastar (hero oscuro)
`background:#142231; color:#fff; border-radius:20px; padding:28px 28px 24px; flex column`. Eyebrow "PARA GASTAR · HOY" (11px/800, `.12em`, uppercase, `rgba(255,255,255,.55)`). Número `clamp(40px,4.8vw,56px)`/800/`-0.05em`; "$" en `rgba(255,255,255,.4)`, decimales `.4em`. Línea USD: chip "USD" (`background:rgba(17,185,129,.18); color:#4FD6A4; radius:999px; 11px/800`) + `US$ 600,00` (16px/700). Caption al fondo (`margin-top:auto`): "Lo que tenés disponible hoy, en pesos y dólares." (12.5px/600, `rgba(255,255,255,.5)`).

### 1) Dónde está (visual — NO lista larga)
Card normal. Header "Dónde está" + link "Ver todas". 
- **Callout de concentración**: `97%` gigante (`clamp(38px,4.6vw,52px)`/800, color `#2F7FD1`) + "de tu plata está en / **Cta remunerada · $9.575.790,25**".
- **Barra de concentración** (`.conc-bar`, alto 16, radius 7, `display:flex; gap:2px`): 6 segmentos con ancho = % de cada cuenta sobre el total (96.8 / 1.49 / 1.09 / 0.54 / 0.06 / 0.02). Colores: Cta remunerada `#2F7FD1`, CA `#E79A2B`, Billetera `#3A6B8A`, Personal Pay `#15A8C4`, Cta DNI `#11B981`, CU `#C95C86`.
- **Grilla compacta** (`.acc-grid`, `grid-template-columns:1fr 1fr; gap:9px 18px`): las 5 cuentas restantes + "En dólares" (verde `#0E9E6E`). Cada celda: cuadradito 8px + nombre 13/700 + monto a la derecha 13/800.

### 2) Balance del mes
Card. Header "Balance del mes" + sub "¿Cómo se movió mi plata este mes?". Eyebrow "BALANCE DE JUNIO" + número `clamp(34px,4.4vw,46px)`/800/`-0.05em`, color `#0E9E6E`: `+$7.022.760,84`. Tres filas `.fl` (Ingresos / Gastos / Ajustes), cada una: label con dot 9px + monto a la derecha (16px/800), y barra `.bar` (alto 8, `#F1F4F7`, radius 5) con relleno proporcional al máximo (Ingresos):
- Ingresos: dot/relleno `#11B981`, 100%.
- Gastos: `#C2705C`, 5.9% (= 498.379/8.388.800).
- **Ajustes**: `#E79A2B`, 10.3%; monto negativo en `#B9791B`; chip "SIN REGISTRAR" (`background:#FBF0DD; color:#B9791B; radius:999px; 10px/800; uppercase`); debajo nota: "**Plata que se movió sin registrar.** Registrá esos movimientos y hacelos desaparecer." (12px/600).
- Pie: "En dólares: **US$ 0,00** · Ingresos US$0,00 · Gastos US$0,00".

### 3) Comprometido (SIN gráfico)
Card. Header "Comprometido" + sub "Lo que ya sabemos del próximo mes".
- **Total protagonista** (`.ptot`): eyebrow "YA COMPROMETIDO · SALE" + número `clamp(34px,4.2vw,42px)`/800/`-0.05em`, `#142231`: `$819.148,63`.
- **Dos mini-cards** (`.ctiles`, grid `1fr 1fr`, gap 12): cada tile `border:1px solid #E8ECF1; radius:14; padding:15/16` con ícono 32px (tarjeta `#0B1A2B`, recurrentes `#C2705C`) + label 12/700 + monto 19/800.
  - Tile 1: "Resúmenes tarjeta" `$712.182`. Tile 2: "Gastos recurrentes (próx. mes)" `$106.966`.
- Pie USD: "En dólares: **US$ 0,00** · Resúmenes US$0 · Recurrentes US$0".

**Estado CON ingreso recurrente** (ver archivo `…(Comprometido con ingreso).html`):
- Se agrega un sub-label "YA SALE" (terracota) arriba de las dos mini-cards de egreso.
- Tercera tile a ancho completo (`.ctiles .t.in`, `grid-column:1/3`, `background:#E7F8F0`, borde verde): ícono flecha arriba verde, "Ya entra · Sueldo (recurrente)" + `+$1.450.000` en `#0E9E6E`.
- **Cierre neto** (`.netcap`): banda verde con check + "Con tu sueldo, el próximo mes arrancás con **+$630.851** a favor." (neto = ingresos recurrentes − total comprometido a salir).
- Si NO hay ingreso recurrente, no se muestran ni el sub-label "YA SALE", ni la tile verde, ni el cierre neto.

### 4) Compartido (card condicional)
Renderizar **solo si hay movimientos en Compartido**. Por ahora hay **un solo grupo "Hogar"**, así que el saldo es **una sola dirección** (o te deben, o debés). Tira full-width (`.shared`, flex, padding 15/22): ícono 38px (`background:#E7F8F0; color:#0E9E6E`) + "Compartido" con 2 avatares (círculos 22px, iniciales) + caption "Hogar · vos y Martín". A la derecha: monto neto `Te deben $34.500` (17px/800, `#0E9E6E` si te deben / `#C2705C` si debés) + sub "Saldo a tu favor en el Hogar". Chevron al final.

### 5) Gastaste este mes (caja vs tarjeta)
Card. Header "Gastaste este mes" + total `$879.684,24` (22px/800). Barra horizontal (`.ss-bar`, alto 62, `gap:4`): 2 segmentos con `flex` proporcional (56.65 / 43.35): "De tu caja" (`#3A6B8A`) `$498.379,65` y "Financiado en tarjeta" (`#C2705C`) `$381.304,59`, con label uppercase + monto adentro (blanco). Caption: "**$381.304,59** se financió en tarjeta → se paga en los próximos resúmenes." En mobile la barra pasa a columna (cada segmento fila completa).

### 6) ¿En qué gasté este mes?
Card. Header "¿En qué gasté este mes?" + link "Ver desglose" + segmented ARS/USD (default ARS).
- **Dona** (`.donut`, 190×190, `conic-gradient` + círculo interior `::after inset:31px`; el `.ctr` necesita `z-index:2` para quedar por encima del círculo). **Total en el centro**: "TOTAL GASTADO" (10px/800 uppercase) + `$879.684,24` (23px/800; decimales `.5em` `#AEB6C0`). Tramos del gradient (cumulativos por monto): Comida 0–23.49% (`#E79A2B`), Transporte 23.49–42.25 (`#2F7FD1`), Entretenimiento 42.25–55.32 (`#7C5CD6`), Hogar 55.32–67.78 (`#11B981`), Otros gastos 67.78–78.56 (`#3A6B8A`), Otros 78.56–100 (`#AEB6C0`).
- **Leyenda** (`.legc`, gap 15): por categoría → fila con dot 11px + nombre (14.5px/700) + monto a la derecha (14px/800) con `%` en `#AEB6C0`, y **barra proporcional** debajo (alto 7, `#F1F4F7`, ancho = monto/máximo). Orden y anchos: Comida 100%, Transporte 79.9%, Entretenimiento 55.6%, Hogar 53%, Otros gastos 45.9%, Otros 91.3%.

## Interacciones & comportamiento
- **Selector de mes** (‹ ›): recarga Balance y En qué gasté (y el texto de fecha). No toca "Para gastar" (es saldo de hoy).
- **Toggle ARS/USD** en "En qué gasté": alterna el desglose por moneda.
- **Ojo**: oculta/revela todos los montos (reemplazar por `••••`).
- **Nuevo movimiento / FAB (mobile)**: abre alta de movimiento.
- **Compartido**: navega a la sección Compartido. La card no se renderiza si no hay actividad.
- **Comprometido**: el bloque de ingreso recurrente y el cierre neto solo aparecen si existe al menos un ingreso recurrente.
- Barras, tramos de la dona y anchos de la concentración se calculan de los datos (no hardcodear).

## Responsive
- **≤980px:** `.r-top` y `.r-two` pasan a 1 columna.
- **≤680px (mobile):** se oculta la sidebar; aparece **barra superior** (`.mbar`, sticky, blur): "grana." + ojo + avatar "JL". `.main` padding `6px 16px 100px`. Topbar en columna (selector de mes `flex:1`; "Nuevo movimiento" se oculta → lo reemplaza el FAB). "Gastaste" → barra en columna. Dona → 1 columna centrada; leyenda full-width. Compartido → el neto pasa abajo full-width. **Bottom-nav** (`.bnav`, fixed): Inicio (activo), Cuentas, **FAB** central (+, 50×50, `#11B981`, elevado), Movim., Compart. Hit targets ≥44px.

## State management
- `montosOcultos: bool` (ojo) — enmascara todos los montos.
- `mesSeleccionado: Date` — controla Balance + En qué gasté.
- `monedaGasto: 'ARS' | 'USD'` — toggle de "En qué gasté".
- Datos: `paraGastar{ars,usd}`, `cuentas[]{nombre,color,monto}`, `balance{ingresos,gastos,ajustes,usd}`, `comprometido{egresos[],ingresosRecurrentes[],usd}`, `compartido?{grupo,miembros[],neto,direccion}`, `gastado{caja,tarjeta}`, `categorias[]{nombre,color,monto,pct}`.
- Condicionales: card Compartido visible solo si `compartido` existe; bloque "Ya entra" + neto visible solo si `comprometido.ingresosRecurrentes.length > 0`.

## Design tokens
- **Fondos/texto:** `--bg:#EEF1F4`, `--card:#FFFFFF`, `--ink:#142231`, `--navy:#0B1A2B`, `--muted:#6B7683`, `--soft:#8A94A3`, `--faint:#AEB6C0`, `--border:#E8ECF1`, `--line:#EEF1F5`, `--hair:#E4E8EE`.
- **Marca / positivo:** `--emerald:#11B981`, `--emerald-deep:#0E9E6E`, `--emerald-soft:#E7F8F0`.
- **Categorías / cuentas:** `--terracota:#C2705C`, `--slate:#3A6B8A`, `--amber:#E79A2B` (deep `#B9791B`, soft `#FBF0DD`), `--violet:#7C5CD6`, `--rose:#C95C86`, `--blue:#2F7FD1`, `--cyan:#15A8C4`.
- **Radios:** cards 20, sidebar `0 26px 26px 0`, tiles 14, botones 12–13, chips 999, dots/cuadraditos 2–3, barras 5–7.
- **Tipografía:** Plus Jakarta Sans 400–800; números `tabular-nums`; formato AR (miles `.`, decimales `,`).
- **Sombras:** botón primario `0 8px 18px -6px rgba(17,185,129,.5)`; FAB `0 8px 18px -5px rgba(17,185,129,.55)`.
- **Espaciado:** gap entre secciones 16; padding de card 22/24.

## Assets
- Tipografía: **Plus Jakarta Sans** (Google Fonts).
- Íconos: SVG inline (stroke, viewBox 24×24) — nav, ojo, "+", flechas, tarjeta, recurrencia, compartido, flecha-arriba, check. Reemplazables por el set de íconos del codebase.
- Sin imágenes raster. El isotipo es wordmark + punto verde (texto + CSS). Avatares de Compartido = círculos con iniciales.

## Files
- `Dashboard Final v1.html` — pantalla final, datos de hoy (Comprometido sin ingreso recurrente).
- `Dashboard Final v1 (Comprometido con ingreso).html` — estado de Comprometido con ingreso recurrente (sueldo).
- `screenshots/` — referencias visuales: `01-desktop-arriba.png`, `02-desktop-abajo.png`, `03-comprometido-con-ingreso.png`. (Para mobile, abrir cualquiera de los HTML y redimensionar a ≤680px.)
