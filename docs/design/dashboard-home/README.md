# Handoff: Dashboard (Inicio) de grana — web + mobile

## Overview
Pantalla de inicio de **grana**, app de finanzas personales bimonetaria (ARS + USD). Reemplaza el dashboard anterior por una composición de cuatro bloques:

1. **Saldo disponible total** (hero oscuro) + **Dónde está** (dos cuentas principales por moneda) + **Resumen del mes** (Entró / Se fué).
2. **Cuánto gastaste** — tres bloques (Gastaste / Pagaste / Te queda por pagar) + ritmo de gasto sobre los ingresos.
3. **Compromisos del próximo mes** — total comprometido + dos grupos desplegables (Tarjetas / Gastos fijos).
4. **Compartido** — tira fina con el saldo del grupo (una sola dirección: te deben o debés).

## About the Design Files
Los dos HTML de este bundle son **referencias de diseño**, no código de producción. Muestran el aspecto y el comportamiento buscados. La tarea es **recrear estos diseños en el entorno del codebase** (React, Vue, SwiftUI, native, etc.) usando sus patrones y librerías existentes. Si todavía no hay entorno, elegir el framework adecuado e implementarlos ahí. Nada de números hardcodeados: todos los montos, porcentajes y textos derivados se calculan (ver *State management*).

## Fidelity
**Hi-fi.** Colores, tipografía, espaciados, radios y estados son definitivos; el detalle de cada valor está más abajo. La UI debe reproducirse fielmente con los componentes del codebase.

## Files
- `Dashboard Mobile.html` — diseño mobile (ancho de referencia **390px**, marco de teléfono incluido solo como contexto: no es parte del componente).
- `Dashboard Web.html` — diseño desktop (sidebar 248px + main, contenido `max-width:1080px`). Colapsa a una columna por debajo de 1080px.

Ambos comparten los mismos componentes y datos; solo cambian la grilla y la escala tipográfica.

---

## Screens / Views

### Layout general — Web (`Dashboard Web.html`)
- `.shell`: `grid-template-columns: 248px 1fr`, `min-height:100vh`.
- **Sidebar** (`.side`): fondo `#FFFFFF`, borde derecho `1px solid #E8ECF1`, padding `26px 18px`, `display:flex;flex-direction:column;gap:26px`. Logo "grana." 21px/800/`-0.045em` (el punto en `#11B981`). Ítems de nav: 13.5px/700, color `#6B7683`, padding `10px 11px`, radio 11px, ícono 18px stroke 1.9; hover `background:#F4F7F9;color:#142231`; activo `background:#142231;color:#fff`. Orden: Inicio (activo), Cuentas, Tarjetas, Movimientos, Compartido; al pie, Configuración.
- **Main** (`.main`): padding `28px 34px 60px`; `.content{max-width:1080px;margin:0 auto;display:flex;flex-direction:column;gap:14px}`.
- **Topbar**: izquierda `h1` "Hola, Julieta." 26px/800/`-0.035em` + fecha 13px/600 `#8A94A3`. Derecha: selector de mes (`.monthsel`, card blanca, borde `#E8ECF1`, radio 11px, chevrons 22×22 radio 7 hover `#F1F4F7`, label 13px/800), botón ojo 38×38 (radio 11, ícono 17px) y botón primario "Nuevo movimiento" (`background:#142231`, texto blanco 13px/800, radio 11px, padding `10px 16px`, hover `#0B1A2B`).
- **Fila 1** (`.r1`, ancho completo): card **Saldo + Resumen** (hero oscuro arriba, Resumen del mes debajo, igual que mobile).
- **Fila 2** (`.r2`): `grid-template-columns:1fr 1.12fr; gap:14px; align-items:stretch` → **Cuánto gastaste** | **Compromisos**. Las dos cards son `display:flex;flex-direction:column`; en Cuánto gastaste la tira de ritmo lleva `margin-top:auto` para que ambas terminen alineadas.
- **Pie**: tira **Compartido** a ancho completo.
- Dentro del hero, los bloques internos (`.w2h`, `.w2`, `.mes .grid`) están limitados a `max-width:660px` centrados, para que en pantallas anchas los datos no se dispersen.

### Layout general — Mobile (`Dashboard Mobile.html`)
- Columna única, `gap:12px` entre cards, ancho de contenido **≈362px** dentro de un viewport de 390px.
- **Top bar**: "grana." 17px/800 + a la derecha selector de mes compacto (`.msel`: chevrons 20×20, label "Agosto" 11.5px/800, card blanca radio 10px), botón ojo 32×32 (radio 10) y avatar "JL" 32×32 circular `#142231`.
- **Saludo**: "Hola, Julieta." 19px/800/`-0.035em` + "Miércoles, 12 de agosto" 12px/600 `#8A94A3`.
- Orden de cards: Saldo+Resumen → Cuánto gastaste → Compromisos → Compartido.

---

### 1) Card "Saldo disponible total" + "Resumen del mes"
Una sola card (`background:#FFF`, borde `1px solid #E8ECF1`, radio 20px) con dos zonas.

**Zona oscura** (`.dark`, `background:#142231`, texto blanco, `text-align:center`; mobile padding `20px 18px 17px`, web `24px 22px 20px`):
- Label "SALDO DISPONIBLE TOTAL": 10.5–11px/800, `letter-spacing:.12em`, uppercase, `rgba(255,255,255,.5)`.
- Monto: mobile 34px, web `clamp(34px,3.4vw,42px)`, peso 800, `letter-spacing:-0.05em`, `line-height:.95`. El signo `$` va en `rgba(255,255,255,.4)`; los centavos (`,16`) en `font-size:.4em`, `rgba(255,255,255,.45)`, `vertical-align:.9em`.
- Fila USD: chip "USD" (11px/800, padding `4px 10px`, radio 999px, `background:rgba(17,185,129,.18)`, color `#4FD6A4`) + valor 15–16px/700 `rgba(255,255,255,.92)`.
- Separador: `border-top:1px solid rgba(255,255,255,.1)`.
- **Fila de encabezado de "Dónde está"** (`.w2h`): grid de dos columnas iguales. Columna 1: "DÓNDE ESTÁ" a la izquierda (10–10.5px/800, `.12em`, uppercase, `rgba(255,255,255,.45)`) y **"ARS"** alineado a la derecha; columna 2: **"USD"** al inicio y link "Ver cuentas ›" a la derecha (12–12.5px/700, `#4FD6A4`, hover `#7FE3BF`). La columna 2 lleva `padding-left:13px` (web 15px) para alinear con el divisor de abajo.
- **Cuentas** (`.w2`): grid de dos columnas; la segunda con `border-left:1px solid rgba(255,255,255,.1)` y `padding-left:13/15px`. **Dos filas por moneda**, cada una: cuadradito 8–9px radio 2px con el color de la cuenta + nombre (11–12px/600 `rgba(255,255,255,.62)`) + porcentaje a la derecha (11.5–12.5px/800 blanco). Datos mock: ARS → Mercado Pago `#2F7FD1` 81%, Lemon `#A8E10C` 15%. USD → Lemon 92%, Mercado Pago 8%. **Sin barras de proporción.**

**Zona clara** (`.mes`, mobile padding `15px 16px 16px`, web `20px 26px`, separada con `border-top:1px solid #E8ECF1` en web):
- Título "Resumen del mes" (mobile 15px/800, web 18px/800, `-0.025em`). **Sin link "Ver detalle".**
- Grid de dos columnas iguales, cada bloque **centrado** (`display:flex;flex-direction:column;align-items:center;text-align:center`):
  - **Entró** — punto `#11B981`; monto `#0E9E6E`; mobile 19px/800, web 27px/800, `-0.04em`; USD debajo (10.5px mobile / 13px web, `#AEB6C0`). Etiqueta 11.5px mobile / 15px web, 700, `#6B7683`.
  - **Se fué** — punto `#3A6B8A`; monto `#3A6B8A`. Mismo tratamiento.
- Mock: Entró `$ 20.000` / `USD 1,49`; Se fué `$ 81.303` / `USD 6,04`.

### 2) Card "Cuánto gastaste"
- Header: `h3` "Cuánto gastaste" + link "Ver detalle ›" (`#0E9E6E`, hover `#0B845C`).
- **Tres tiles** (`.tri`, `grid-template-columns:repeat(3,minmax(0,1fr))`, gap 8px mobile / 11px web). Cada tile (`.tl`): borde `1px solid #E8ECF1`, radio 15/16px, `display:flex;flex-direction:column;overflow:hidden;text-align:center`, padding `11px 9px 0` (web `14px 13px 0`):
  - Ícono 32/36px, radio 11/12px, centrado, con fondo tintado: Gastaste `#E7F8F0` + stroke `#0E9E6E` (bolsa), Pagaste `#E9F0F5` + `#3A6B8A` (tarjeta), Te queda por pagar `#FBF0DD` + `#B9791B` (reloj). SVG stroke 2, 16/18px.
  - Etiqueta 11/12.5px/800 `#6B7683`.
  - Monto 16px mobile / 20px web, 800, `-0.04em`, en el color del bloque (`#0E9E6E` / `#3A6B8A` / `#B9791B`).
  - USD 10/11px/600 `#AEB6C0`.
  - Sub-bloque con `border-top:1px solid #EEF1F5`, `padding-top:9/11px`, `padding-bottom:11/13px`, texto 10/11px/700 `#8A94A3` con la segunda línea en 11/11.5px/800 `#142231`.
  - Filete de color al pie: 4px de alto, `margin:0 -9px` (web `0 -13px`) + `margin-top:auto` para que quede pegado al borde inferior en los tres tiles.
- **Semántica de los tres montos (importante):**
  - **Gastaste** = total de gastos del mes. Mock `$ 441.273` / `USD 32,79`. Copy: "Total de gastos **del mes**".
  - **Pagaste** = de esos gastos, lo que ya se pagó (salió de las cuentas). Mock `$ 52.400` / `USD 3,89`. Copy: "Ya salió de **tus cuentas**".
  - **Te queda por pagar** = `Gastaste − Pagaste` = los gastos del mes hechos con tarjeta de crédito. Mock `$ 388.873` / `USD 28,90`. Copy: "5 compras con **tarjeta de crédito**" (el número es la cantidad de compras pendientes).
- **Tira de ritmo** (`.rit`): `background:#F7F9FB`, borde `1px solid #E8ECF1`, radio 15/16px, padding `11px 13px` (web `14px 16px`), `display:flex;align-items:center;gap:13/16px`.
  - Anillo (`.ring`) 46px mobile / 54px web: `conic-gradient(#11B981 0 <pct>, #DFE6EC <pct> 100%)`, agujero con `::after{inset:7/8px;background:#F7F9FB}`, `%` al centro 11.5/13px/800 `#0E9E6E`.
  - Texto: "Gastaste el **11%** de tus ingresos" (12.5/13.5px/700 `#6B7683`, el número en `#0E9E6E`/800), barra 6/7px radio 4/5px (`#DFE6EC` de fondo, relleno `#11B981` al %), y pie "$ 441.273 de $ 4.000.000" 10.5/11.5px/600 `#AEB6C0`.
  - **Ritmo = Gastaste / ingreso mensual esperado** (mock: 441.273 / 4.000.000 = 11%).

### 3) Card "Compromisos del próximo mes"
- Header: `h3` + sub "Septiembre 2026" (11.5/12.5px/600 `#8A94A3`) + link "Ver todos ›".
- **Total** (`.totbox`): `background:#F7F9FB`, borde `1px solid #E8ECF1`, radio 16px, padding `13px 14px` (web `15px 16px`). Contiene label "YA COMPROMETIDO", monto 28/31px/800 `-0.045em` (con `$` en `#AEB6C0`), USD 11.5/12px/600 `#AEB6C0`, barra apilada 8/9px radio 5px (Tarjetas `#3A6B8A` 63.2% · Gastos fijos `#7C5CD6` 36.8%) y leyenda con cuadraditos + porcentaje (11/12px/700).
- **Dos grupos desplegables** (`.tile`, borde `1px solid #E8ECF1`, radio 16px, `overflow:hidden`):
  - Cabecera clickeable (`button.th`, padding `12px 13px` / web `14px 15px`): ícono 32/36px con fondo `rgba(58,107,138,.14)` (tarjetas) o `rgba(124,92,214,.14)` (gastos fijos); nombre 12.5/13.5px/800; bajada 10.5/11.5px/600 `#8A94A3`; monto a la derecha 15/16.5px/800 con USD debajo 10/11px/600 `#AEB6C0`; chevron 15/16px `#AEB6C0` que rota 180° con `transition:transform .18s ease` cuando el grupo está abierto.
  - Cuerpo (`.tb`, oculto por defecto, `display:block` con la clase `.open` en el tile): filas `padding:7px 0` (web `8px 0`), `border-top:1px solid #EEF1F5`, nombre 12/12.5px/600 `#6B7683`, monto 12/13px/800 `#142231`.
  - **Tarjetas**: se listan hasta 3 en el diseño original; en el mock se despliegan las 5 (Visa 388.873, Amex 291.427, Naranja 78.000, Cabal 34.000, Mastercard 20.000). Si hay más de 3, el resto aparece al abrir desde el título.
  - **Gastos fijos**: soporta hasta 10 filas; el contenedor lleva `max-height:160px` (web 196px) con `overflow:auto`, y al pie el link "Ver mis gastos fijos ›" (12/12.5px/700). Mock: Alquiler 320.000, Expensas 68.500, Internet 24.900, Celular 18.400, Gimnasio 15.000, Netflix 8.900, Seguro del auto 6.000, Spotify 5.500, Luz 3.000, Agua 2.000.
- Mock del total: `$ 1.284.500` / `USD 95,46` = Tarjetas `$ 812.300` (USD 60,37) + Gastos fijos `$ 472.200` (USD 35,09).

### 4) Tira "Compartido"
- Toda la tira es un link (`a.card.shared`): `display:flex;align-items:center;gap:10/13px`, padding `11px 14px` (web `15px 22px`). Alto ≈54px.
- Ícono 30/36px radio 10/12px, fondo `#E7F8F0`, stroke `#0E9E6E` (personas).
- Nombre "Compartido" 13/14.5px/800 `#142231` (no verde) + avatares apilados 18/20px circulares `#11B981`, texto blanco 8/8.5px/800, borde `1.5px solid #FFF`, solapados `-6px`.
- Monto a la derecha: "Te deben $ 140.825" 13.5/15px/800 `#0E9E6E`. Si el saldo es contra el usuario, el copy pasa a "Debés" y el color a `#C2705C`.
- Chevron 15/16px `#AEB6C0`.
- **Renderizar solo si hay actividad en Compartido.** Por ahora hay un único grupo ("Hogar"), así que el saldo es de una sola dirección.

---

## Interactions & Behavior
- **Desplegables de Compromisos**: click en la cabecera → toggle de la clase `.open` en el `.tile` (muestra `.tb` y rota el chevron). Independientes entre sí; en el prototipo el handler es `document.querySelectorAll('[data-tg]')` → `classList.toggle('open')`. Deben ser accesibles: `<button>` con `aria-expanded` y el panel asociado por `id`.
- **Selector de mes**: recalcula Resumen del mes, Cuánto gastaste y Compromisos. El Saldo disponible es de hoy y no cambia.
- **Botón ojo**: oculta/enmascara todos los montos (persistir la preferencia).
- **Links**: "Ver cuentas ›" → Cuentas; "Ver detalle ›" (Cuánto gastaste) → detalle del mes; "Ver todos ›" → compromisos; "Ver mis gastos fijos ›" → recurrencias; la tira Compartido → sección Compartido.
- **Hover**: links `#0E9E6E` → `#0B845C`; links sobre fondo oscuro `#4FD6A4` → `#7FE3BF`; ítems de sidebar y chevrons del selector con fondo `#F4F7F9`/`#F1F4F7`.
- **Scroll interno**: solo la lista de gastos fijos (nunca la card completa).
- **Responsive web**: ≤1080px se oculta la sidebar, `.r2` pasa a una columna y el padding del main baja a `24px 20px 60px`. La versión mobile es el diseño de referencia para ≤680px.
- **Estados a definir en implementación**: montos en cero / sin ingresos del mes (el ritmo no se puede calcular → mostrar mensaje en vez de anillo), sin tarjetas, sin gastos fijos, sin actividad compartida (no renderizar la tira), carga (skeletons con los mismos radios) y error de fetch.
- **Ritmo > 100%**: pasar el anillo y la barra a `#C2705C` y ajustar el copy.

## State Management
Estado mínimo:
- `selectedMonth` (mes visible; el saldo no depende de él).
- `amountsHidden` (botón ojo, persistido).
- `expandedGroups: { tarjetas: bool, gastosFijos: bool }`.
- `currencyView` no es necesario: ARS y USD se muestran siempre juntos.

Datos y derivaciones (nada hardcodeado):
- `saldoTotal` (ARS y USD) y reparto por cuenta y por moneda → se muestran las **dos** cuentas con más saldo de cada moneda con su % sobre el total de esa moneda.
- `entro` = ingresos acreditados del mes. `seFue` = total que salió de las cuentas en el mes (gastos pagados + pagos de resúmenes).
- `gastaste` = total de gastos del mes. `pagaste` = parte de esos gastos ya pagada. `teQuedaPorPagar` = `gastaste - pagaste` (gastos con tarjeta de crédito) y `comprasPendientes` = cantidad de esas compras.
- `ritmo` = `gastaste / ingresoMensualEsperado`.
- Compromisos: `total` = `tarjetas + gastosFijos`; los % de la barra se derivan; cada tarjeta trae su próximo cierre para la bajada "5 · próxima cierra 28/08".
- Conversión USD: todos los montos se muestran en ARS y en USD con el mismo tipo de cambio (en el mock ≈13.455 ARS/USD). Definir de dónde sale el tipo de cambio y redondear a dos decimales.

## Design Tokens
Colores (los mismos en las dos versiones):
- Fondos: `--bg:#EEF1F4`, `--card:#FFFFFF`, gris interno de bloques `#F7F9FB`, gris de pistas `#DFE6EC`.
- Tinta y textos: `--ink:#142231`, `--muted:#6B7683`, `--soft:#8A94A3`, `--faint:#AEB6C0`.
- Bordes: `--border:#E8ECF1`, `--line:#EEF1F5`, `--hair:#E4E8EE`.
- Acentos: `--emerald:#11B981`, `--emerald-deep:#0E9E6E`, `--emerald-soft:#E7F8F0`, `--mint:#4FD6A4`, `--slate:#3A6B8A`, `--slate-soft:#E9F0F5`, `--amber:#E79A2B`, `--amber-deep:#B9791B`, `--amber-soft:#FBF0DD`, `--violet:#7C5CD6`, `--terracota:#C2705C`.
- Cuentas: Mercado Pago `#2F7FD1`, Lemon `#A8E10C`, otras `rgba(255,255,255,.3)` sobre oscuro.

Tipografía: **Plus Jakarta Sans** (400/500/600/700/800), fallback `system-ui, sans-serif`. Todos los números con `font-variant-numeric: tabular-nums` (clase `.tnum`). Escala usada: 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 15 / 16.5 / 18 / 19–20 / 26 / 27–31 / 34–42px. `letter-spacing`: `-0.025em` en títulos, `-0.03/-0.04em` en montos medianos, `-0.05em` en los montos grandes, `+0.12em` en labels uppercase.

Espaciado: escala de 2px — usados 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 26, 34px. Gap entre cards 12px (mobile) / 14px (web).

Radios: 4px (barras finas), 5–6px (barras), 10–12px (íconos, botones), 15–16px (bloques internos y tiles), 20px (cards), 999px (chips y avatares).

Sombras: solo una, en el marco del teléfono del prototipo (`0 12px 32px rgba(11,26,43,.07)`) — **no** es parte del diseño. Las cards no llevan sombra, se separan por borde de 1px.

Transiciones: `transform .18s ease` en el chevron. No hay otras animaciones.

## Assets
No hay imágenes ni logos externos. Todos los íconos son SVG inline (24×24 viewBox, `fill:none`, `stroke:currentColor` o color explícito, `stroke-width:1.9–2`, extremos redondeados): grilla (Inicio), billetera (Cuentas), tarjeta (Tarjetas / Pagaste / Tarjetas), líneas (Movimientos), personas (Compartido), engranaje (Configuración), ojo (ocultar montos), chevrons, bolsa (Gastaste), reloj (Te queda por pagar), documento (Gastos fijos), flecha (Entró). El único tipo de letra externo es Plus Jakarta Sans (Google Fonts) — reemplazar por la fuente equivalente del codebase si ya está empaquetada.
