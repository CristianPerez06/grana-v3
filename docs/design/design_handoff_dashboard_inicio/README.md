# Handoff: Dashboard / Inicio de grana

## Overview
Rediseño de la pantalla **Inicio** (dashboard) de **grana**, una app de finanzas personales bimonetaria (pesos argentinos + dólares). La pantalla responde, de un vistazo y en este orden de importancia:
1. **¿Cuánto tengo para gastar hoy?** (pesos y dólares) y **¿dónde está?** (cuentas).
2. **¿Cómo vengo este mes?** (balance: ingresos vs gastos, en ARS y USD).
3. **¿En qué se me fue?** (gastos del mes por categoría).

Es responsive: una sola pantalla que funciona en **web (desktop)** y **mobile**.

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML/CSS/JS** — un prototipo que muestra el look & feel y el comportamiento buscado, **no** código de producción para copiar tal cual. La tarea es **recrear este diseño dentro del entorno/codebase existente de grana** (React, Vue, etc.), usando sus componentes, design system y convenciones. Si todavía no hay un entorno definido, elegir el framework más apropiado e implementarlo ahí.

- `dashboard-inicio.html` — la pantalla final (versión "A"). Abrir en el navegador para ver desktop; redimensionar la ventana a ≤680px para ver el layout mobile.
- `def3.css` — todos los estilos y tokens (variables CSS en `:root`), más los breakpoints responsive.
- `def3-chrome.js` — inyecta el "chrome" común: sidebar (desktop), barra superior mobile, topbar (saludo + selector de mes + acciones) y bottom-nav (mobile). Se hizo así solo para no repetir markup entre prototipos; en el codebase real esto deberían ser componentes (`<Sidebar>`, `<TopBar>`, `<BottomNav>`).

## Fidelity
**Alta fidelidad (hi-fi).** Colores, tipografía, espaciados y estados están definidos. Recrear pixel-perfect con los componentes del codebase. La fuente es **Plus Jakarta Sans** (Google Fonts); si el codebase usa otra, respetar pesos/escala.

## Datos de ejemplo (mock)
Reemplazar por datos reales del usuario. Los del prototipo:
- **Para gastar (hoy):** ARS `$2.454.499,75` · USD `US$ 1.240,00`. (El total ARS = suma de las cuentas en pesos.)
- **Cuentas:** Billetera `$1.254.499` (terracota), Galicia Sueldo `$1.200.000` (ámbar), Cooperativa ahorros `$0,00` (violeta), En dólares `US$1.240,00` (emerald).
- **Balance del mes (Junio 2026):** `+$504.499,75`. Ingresos `$800.000,00`, Gastos `$295.500,25`. USD: `+US$140,00` (Ingresos US$150 · Gastos US$10).
- **En qué se fue (ARS, total $295.500):** Comida `$112.300` 38% (ámbar), Servicios `$68.400` 23% (slate), Transporte `$43.200` 15% (violeta), Súper `$41.600` 14% (emerald), Salud `$30.000` 10% (rosa).

> **Bimoneda sin repetir:** "Para gastar" muestra el total en pesos como titular y el USD como línea secundaria; las cuentas son el desglose (incluida la tenencia "En dólares"). El balance suma su propio +US$140 del mes (info distinta del stock de US$1.240). No duplicar el dólar como tarjeta/stat aparte.

## Layout general
Shell de 2 zonas en desktop (CSS grid): `grid-template-columns: 252px 1fr` → **sidebar** + **main**.
- `.main` padding: `32px clamp(20px,3.5vw,46px) 70px`.
- `.content` centrado, `max-width: 1080px`.
- Contenido en columna (`.grid-main`, `display:flex; flex-direction:column; gap:16px`), en este orden:
  1. **Fila superior** (`.r-top`, grid `1.15fr 1fr`, gap 15px): **Para gastar** (izq) + **Cuentas** (der), misma altura (`align-items:stretch`).
  2. **Balance del mes** (card full-width).
  3. **En qué se fue** (card full-width).

## Componentes (desktop)

### Sidebar (252px, panel blanco flotante)
- `background:#FFFFFF; border-radius:0 26px 26px 0; box-shadow:1px 0 0 #E8ECF1; padding:26px 18px 22px`.
- Logo: wordmark "grana" (`font-weight:800; font-size:26px; letter-spacing:-0.04em; color:#0B1A2B`) + punto verde de 15px (`#11B981`) con un "$" blanco de 8.5px centrado.
- Nav (gap 3px): ítems con ícono 20px (stroke 2) + label 15px/600. Ítem activo: `background:#E7F8F0; color:#0E9E6E; font-weight:700; border-radius:12px`. Ítems: Inicio (activo), Cuentas, Tarjetas, Movimientos, Compartido.
- Al fondo (después de `flex:1` spacer): "Configuración" con ícono de engranaje.

### Topbar
- Flex space-between, `margin-bottom:22px`.
- Izq (`.hello`): `h1` "Hola, Caro." (`clamp(24px,3.5vw,30px)`, 800, `letter-spacing:-0.035em`, color `#142231`). Debajo (`.date`, 14px/500, `#6B7683`): "Miércoles 3 de junio · vas **+$504.499** este mes." (el monto en `#0E9E6E`/700).
- Der (`.top-actions`, gap 10px): **selector de mes** + botón ojo + botón primario.
  - **Selector de mes** (`.monthsel`): contenedor blanco `border:1px solid #E8ECF1; border-radius:12px; padding:4px`. Dos botones flecha (32×32, ícono 16px) + label "Junio 2026" (14px/800, `min-width:96px`, centrado). Controla los módulos mensuales (balance, en qué se fue). **No** afecta "Para gastar" (es saldo de hoy).
  - **Ojo** (`.eye-btn`): 42×42, `border-radius:12px`, borde, ícono 19px. Acción: ocultar/mostrar saldos.
  - **Primario** (`.btn-primary`): "Nuevo movimiento", `background:#11B981; color:#fff; border-radius:13px; padding:12px 18px; font-weight:700`, ícono "+" 18px (stroke 2.6), `box-shadow:0 8px 18px -6px rgba(17,185,129,.5)`. **Oculto en mobile** (lo reemplaza el FAB).

### Card base
`.card`: `background:#fff; border:1px solid #E8ECF1; border-radius:20px`. `.card-pad`: `padding:22px 24px`. Header `.card-h`: flex space-between; `h2` 16.5px/800, `letter-spacing:-0.02em`, `#142231`, `white-space:nowrap`.

### 1) Para gastar (`.pg`) — card oscura
- `background:#142231; color:#fff; border-radius:20px; padding:24px 26px; display:flex; flex-direction:column`.
- Eyebrow `.pl`: "Para gastar · hoy", 11px/800, `letter-spacing:.1em`, uppercase, `rgba(255,255,255,.55)`.
- Número `.pv`: `clamp(34px,4.6vw,46px)`, 800, `letter-spacing:-0.04em`, tabular-nums. "$" en `rgba(255,255,255,.4)`; decimales (`.dec`) `.48em`, opacidad .5. Texto: `$2.454.499,75`.
- Línea USD `.pg-usd` (margin-top 13px): chip "USD" (`background:rgba(17,185,129,.18); color:#4FD6A4; border-radius:999px; padding:3px 9px; 11px/800`) + valor `US$ 1.240,00` (15.5px/700, `rgba(255,255,255,.9)`, tabular-nums).
- Caption `.pcap` (`margin-top:auto` → al fondo): "Lo que tenés disponible hoy, en pesos y dólares." (12.5px/600, `rgba(255,255,255,.5)`).

### 1) Cuentas (`.acct-card`) — "Dónde está"
- Card normal. Header: "Dónde está" + link "Ver todas" (`#0E9E6E`, 13px/700).
- Filas `.acct-row` (flex, gap 12px, padding 11px 0, separadas por `border-top:1px solid #EEF1F5`): cuadradito de color 10px (`border-radius:3px`) + nombre (14px/700, `#142231`) + monto a la derecha (`.am`, 14.5px/800, tabular-nums, `letter-spacing:-0.02em`). Monto en cero usa `#AEB6C0`.
- Última fila `.acct-row.usd` (la tenencia en dólares): separador arriba, dot/nombre/monto en `#0E9E6E` (emerald), dot `#11B981`.
- Orden por mayor monto. Colores: Billetera terracota `#C2705C`, Galicia ámbar `#E79A2B`, Cooperativa violeta `#7C5CD6`.

### 2) Balance del mes
- Card. Header "Balance del mes".
- `.bal-net`: eyebrow "BALANCE" (12px/800, uppercase, `#8A94A3`, margin-bottom 7px) **arriba**, y debajo el número `.num` (`clamp(30px,3.8vw,38px)`, 800, `letter-spacing:-0.035em`, color `#0E9E6E`, tabular-nums): `+ $504.499,75` (decimales `.5em`, opacidad .55).
- `.flow` (margin-top 20px, gap 14px): dos filas Ingresos / Gastos. Cada una: label con dot 9px + monto a la derecha (14.5px/800), y debajo una barra `.track` (alto 11px, `background:#F1F4F7; border-radius:6px`) con relleno `.f`. Ingresos: dot/relleno `#11B981`, ancho 100%. Gastos: dot/relleno `#C2705C`, ancho 36.9% (= gastos/ingresos).
- `.usd-strip` (margin-top 18px, separador arriba): chip "USD" (emerald-soft `#E7F8F0`/`#0E9E6E`) + `+ US$140,00` (17px/800, `#0E9E6E`) + a la derecha "Ingresos US$150,00 · Gastos US$10,00" (12.5px/600, `#6B7683`).

### 3) En qué se fue
- Card. Header "En qué se fue" + segmented control ARS/USD (`.seg`: contenedor `#EEF1F5` radius 10, botones 12.5px/700; activo `background:#fff; color:#142231; box-shadow:0 1px 3px rgba(11,26,43,.1)`). Default ARS.
- `.spend`: grid `150px 1fr`, gap 28px.
  - **Donut** (`.donut`, 150×150): se dibuja con `conic-gradient` y un círculo blanco interior (`::after`, `inset:26px`) → efecto dona. Tramos (en %): Comida 0–38 (#E79A2B), Servicios 38–61.1 (#3A6B8A), Transporte 61.1–75.7 (#7C5CD6), Súper 75.7–89.8 (#11B981), Salud 89.8–100 (#C95C86). Centro: "GASTOS" (10px/800, uppercase, `#8A94A3`) + `$295.500` (17px/800, tabular-nums).
  - **Leyenda** (`.legc`, gap 12px): por categoría → dot 10px + nombre (14px/700) + monto a la derecha (14px/800, tabular-nums) + `%` (12px/700, `#AEB6C0`, ancho 34px).

## Responsive
Breakpoints en `def3.css`:
- **Tablet (≤980px):** `.r-top` pasa a 1 columna (Para gastar arriba, Cuentas abajo). (En el codebase puede mantenerse 2 columnas más arriba según el grid real.)
- **Mobile (≤680px):**
  - Se oculta la **sidebar**; aparece una **barra superior** (`.mbar`, sticky, blur): wordmark "grana." + ojo + avatar "CA" (círculo 36px, `#3A6B8A`).
  - `.main` padding `6px 16px 100px` (deja lugar para la bottom-nav).
  - **Topbar** en columna: saludo arriba; abajo el **selector de mes** (ocupa el ancho, `flex:1`) + ojo. El botón "Nuevo movimiento" se **oculta** (lo cubre el FAB).
  - Donut (`.spend`) pasa a 1 columna centrada; la leyenda ocupa el ancho.
  - **Bottom-nav** (`.bnav`, fixed bottom, `border-top`, `padding-bottom:calc(8px + env(safe-area-inset-bottom))`): 5 ítems — Inicio (activo), Cuentas, **FAB** central (botón redondeado 50×50 `#11B981`, "+", elevado `margin-top:-14px`, sombra), Movim., Compart. Cada ítem: ícono 22px + label 10.5px/700; activo `#0E9E6E`, inactivo `#AEB6C0`.

Hit targets mínimos 44px en mobile (FAB y botones cumplen).

## Interacciones / comportamiento
- **Selector de mes** (‹ ›): cambia el mes y recarga **Balance del mes** y **En qué se fue** (y el texto de la fecha/eyebrow). No toca "Para gastar".
- **Toggle ARS/USD** en "En qué se fue": alterna el desglose de gastos por moneda (en USD: Entretenimiento US$10 = 100%).
- **Ojo:** oculta/revela todos los montos (reemplazarlos por `••••`).
- **Nuevo movimiento / FAB:** abre el flujo de alta de movimiento (ya existe en la app).
- **Nav / "Ver todas" / categorías:** navegación a sus secciones (Cuentas, Movimientos, etc.).
- Las barras de balance y los tramos de la dona se calculan de los datos (no hardcodear los anchos/%).

## Design tokens (`:root` en def3.css)
- **Fondos/texto:** `--bg:#EEF1F4`, `--card:#FFFFFF`, `--ink:#142231` (texto principal), `--navy:#0B1A2B`, `--muted:#6B7683`, `--soft:#8A94A3`, `--faint:#AEB6C0`, `--border:#E8ECF1`, `--line:#EEF1F5`.
- **Marca / positivo:** `--emerald:#11B981`, `--emerald-deep:#0E9E6E`, `--emerald-soft:#E7F8F0`.
- **Categorías / cuentas:** `--terracota:#C2705C` (+ soft `#F7ECE7`), `--slate:#3A6B8A` (+ `#EAF1F6`), `--amber:#E79A2B` (+ `#FBF0DD`), `--violet:#7C5CD6` (+ `#EEEAFA`), `--rose:#C95C86` (+ `#F8EAF0`).
- **Negativo/gastos:** terracota `#C2705C`.
- **Radios:** cards 20px, sidebar 0 26px 26px 0, botones 12–13px, chips 999px, dots 3px, barras 5–6px.
- **Tipografía:** Plus Jakarta Sans 400–800. Números siempre `font-variant-numeric: tabular-nums`. Formato AR: miles con `.`, decimales con `,`.
- **Sombras:** botón primario `0 8px 18px -6px rgba(17,185,129,.5)`; FAB `0 8px 18px -5px rgba(17,185,129,.55)`.
- **Espaciado:** gap entre secciones 16px; padding de card 22px 24px.

## Assets
- Tipografía: **Plus Jakarta Sans** (Google Fonts).
- Íconos: todos SVG inline (stroke, 24×24 viewBox) — sidebar/nav, ojo, "+", flechas, íconos de cuentas. Reemplazables por el set de íconos del codebase.
- Sin imágenes raster. El isotipo "grana" es wordmark + punto verde (texto + CSS), no un asset.

## Files
- `dashboard-inicio.html` — pantalla final (versión A).
- `def3.css` — estilos + tokens + responsive.
- `def3-chrome.js` — inyección de sidebar/topbar/mobile-bar/bottom-nav (en producción: componentes).
