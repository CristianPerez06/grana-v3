# Handoff: Compartido (Grana v3) — Home · Cuenta corriente · Saldar

## Overview
Módulo **Compartido** de Grana (finanzas personales, es-AR, bimoneda ARS/USD) para una pareja
que comparte gastos. Cubre tres pantallas:

1. **Home de Compartido** — el pulso del hogar: gasto del mes (neto), qué se deben hoy, lo que
   se viene (proyección) y últimos movimientos.
2. **Cuenta corriente** — el libro que corre entre las dos personas; se entra desde la Home.
3. **Saldar** — drawer para pagar la deuda, + el resto del flujo (enviado → confirmación del
   receptor → recibo).

Personas (fijas): usuario logueado = **Juli ("J")**; pareja = **Caro ("C")**. Toda la copy está
escrita desde la perspectiva de Juli. Datos de ejemplo: **junio 2026**.

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML/CSS/JS** — prototipos que
muestran la apariencia y el comportamiento buscados, **no código de producción para copiar tal
cual**. La tarea es **recrear estos diseños en el entorno del repo** (React/Next, con sus
componentes, design system y librerías ya establecidos), respetando sus patrones. El HTML acá es
vanilla (sin framework) sólo para que la referencia sea liviana y autónoma.

## Fidelity
**Alta fidelidad (hi-fi).** Colores, tipografía, espaciados e interacciones son los definitivos.
Recrear la UI pixel-perfect con los componentes del codebase. Las interacciones marcadas como
“funcionan” abajo deben replicarse.

## Cómo mirar la referencia
- **`referencia-web.html`** — las pantallas a ancho de escritorio, etiquetadas.
- **`referencia-mobile.html`** — las mismas a ~402px (en marco de teléfono).
- Las pantallas son **responsive con el mismo HTML** (no hay archivos separados de mobile): el
  breakpoint es `@media (max-width: 560px)` en `mobile.css` (home, cuenta corriente) y dentro de
  `saldar.css` (drawer → bottom sheet).

---

## Screens / Views

### 01 · Home (`home.html`)
**Propósito:** vistazo del estado del hogar. Qué gastaron, qué se deben, qué se viene.

**Layout:** una columna centrada, máx. 1080px, `padding: 30px 34px 40px`, bloques apilados con
`gap: 16–18px`. Orden vertical:
1. **Topbar:** título del hogar **“Nosotros ♡”** (nombre que el usuario le puso al hogar, no es
   un label del sistema) + botón verde “Registrar movimiento” + botón ícono de ajustes.
2. **Navegador de mes** (pastilla): `‹ Junio de 2026 ›`. **Gobierna SOLO el gasto del hero** (no
   la deuda ni la proyección).
3. **Hero “Gasto del hogar · neto”** (card navy `#142231`, radius 22): a la izquierda el **costo
   neto protagonista** `$130.373` (grande); a la derecha, chico, el desglose **Gastaron $145.800
   / Reintegros −$15.427** (un importe abajo del otro). Chip “USD · US$ 84,00 neto” arriba a la
   derecha. Línea secundaria: “Te toca **$65.187** · la mitad (split 50·50) · US$ 42 en dólares”.
   Debajo, separados por una regla, **“En qué gastaron”**: barra apilada segmentada + filas por
   categoría (ícono, nombre, monto, %, chevron). Selector ARS/USD (segmented) sobre el navy.
4. **Tiles (2 columnas, `gap:18px`):**
   - **“Qué se deben hoy”** — avatares **J → (flecha) → C** con el monto `$1.250` grande en
     terracota; “Juli le debe a Caro · en pesos”; chip USD “Caro te debe US$ 12”; botones
     **Saldar** (verde) + **Cuenta corriente** (link a `cuenta-corriente.html`).
   - **“Lo que se viene”** — chip “Próximo impacto: Cuota Heladera +$16.998 · jul”; una **línea
     de proyección** (SVG) que sube de hoy −$1.250 a ago +$37.246; total proyectado.
5. **“Últimos movimientos”** — lista con ícono de categoría, título, quién pagó (punto J/C +
   fecha), monto (tu parte / parte de Caro · total).

**Interacciones que funcionan:** drill inline de cada categoría (abre sus movimientos sin
recargar), toggle ARS/USD (recalcula todo el desglose). Navegador de mes y “Registrar” son
visuales en el prototipo.

### 02 · Cuenta corriente (`cuenta-corriente.html`)
**Propósito:** explicar **de dónde sale el saldo** y listar cada asiento.

**Layout:** columna máx. 1080px. Orden:
1. **Breadcrumb** “Compartido / Cuenta corriente” (Compartido → `home.html`).
2. **Título** “Cuenta corriente” + par de avatares J/C.
3. **Dos cards de saldo** (`grid 1.5fr / 1fr`): la grande con el saldo ARS `$1.250` + flecha
   **J → Caro**; la chica con **USD +US$ 12,00** y el botón **Saldar**. Bimoneda siempre visible.
4. **Panel “Cómo llegamos a este saldo”** (la **ecuación**, colapsable): 4 cajas — parte de Caro
   `+$24.325` / tus partes `−$18.850` / reintegros y liquidaciones `−$6.725` / **= saldo $1.250 →
   Caro**.
5. **Toolbar:** segmented ARS/USD + filtros (Persona, Liquidaciones).
6. **Extracto** (orden **descendente**, lo más reciente arriba): arranca con **“Próximos impactos ·
   lo que se viene”** (futuro/estimado), luego la barra **“Hoy · $1.250 a favor de Caro”**, y de
   ahí para abajo el historial. Columnas: **Fecha · Movimiento · Qué cambia · Importe · Saldo**.
   La columna **“Qué cambia”** está en castellano natural (“Suma tu parte”, “Suma la parte de
   Caro”, “Baja la deuda de Caro”, “Reduce el saldo”, “Restaura el importe”).

**Estados de asiento (chips):** `Completada` (verde), `Pendiente` (ámbar), `Revertida` (tachada,
terracota), `Contraasiento` (violeta — anula una liquidación; **nunca se borra, se contraasienta**).

**Interacción que funciona:** toggle ARS/USD (cambia todo el extracto y la ecuación) y
colapsar/expandir la ecuación.

### 03 · Saldar — drawer (`saldar.html`)
**Propósito:** que Juli (deudor) pague total o parcial. Es un **drawer/overlay** (mismo patrón que
el alta de movimiento del repo), NO pantalla completa ni modal.

**Una sola moneda por flujo.** Sólo se puede saldar la(s) moneda(s) donde Juli es deudor. Hoy
debe en ARS → ARS fijo, sin selector de moneda. (Si debiera en ARS y USD, ahí sí iría selector;
ARS y USD nunca se mezclan en el mismo monto.)

**Layout (drawer 480px, radius 24):**
1. Header: eyebrow “Compartido · Caro”, título **“Saldar”**, botón cerrar.
2. **Monto protagonista** centrado: “Le pagás a Caro · de **$1.250** que le debés en pesos” +
   número grande `$1.250`.
3. **Montos rápidos:** `Total` / `$500` / `$1.000`. Parcial → el resto **queda registrado en la
   cuenta corriente**.
4. **“Pagar desde”** — **dropdown** que abre la lista de cuentas, cada una con su **saldo
   disponible** (Mercado Pago $48.300 / Galicia $12.500 / Brubank $900).
5. **“Qué pasa al pagar”** — antes → después: tu cuenta baja (ej. $48.300 → $47.050) y la deuda
   con Caro queda en **$0** (o el resto si es parcial).
6. **Aviso no bloqueante** de saldo negativo: si la cuenta elegida queda en negativo, aparece un
   aviso ámbar (no impide pagar; regla transversal de Grana para toda salida de plata). Se ve con
   Brubank.
7. Microcopy: “Caro va a confirmar en qué cuenta lo recibió; recién ahí la liquidación queda
   completada.”
8. Footer: botón primario “Pagar $X a Caro” + “Cancelar”.

**Interacciones que funcionan (JS en el propio archivo):** elegir monto rápido y elegir cuenta
recalculan en vivo el impacto, el restante, el aviso de negativo y el label del botón.

### 03b · Saldar — resto del flujo (`saldar-flujo.html`)
Tres **superficies distintas** (no es el mismo drawer). Handshake liviano **sin “rechazar”**:
1. **Enviado** (lo ve Juli en la cuenta corriente): “Enviado · $1.250 · esperando que Caro
   confirme”. La deuda de Juli ya queda en $0 al enviar.
2. **Tarea de Caro** (le llega al receptor): “Juli te pagó $1.250 · ¿en qué cuenta lo recibiste?”
   — Caro **sólo asigna la cuenta** donde entró la plata (no acepta/rechaza). Botón “Confirmar
   recepción”.
3. **Recibo · completada** (lo ven los dos): monto, fecha, y el movimiento `Mercado Pago (J) →
   Galicia (C)`.

---

## Interactions & Behavior
- **Drill inline (Home “En qué gastaron”):** click en una categoría togglea `.eq-cat.open` y
  muestra sus movimientos (display toggle, sin animación de altura para que sea determinista).
- **Toggle ARS/USD:** botón segmented; re-renderiza el desglose (Home) o cambia el panel
  (`.cc-pane`) en Cuenta corriente. **La moneda nunca se oculta ni se mezcla**, ni en cero.
- **Saldar — dropdown de cuenta:** abre `.picker-menu`; al elegir, actualiza trigger, impacto,
  restante, aviso y botón.
- **Saldar — montos rápidos / parcial:** Total precarga la deuda; parcial deja el resto en la
  cuenta corriente y cambia el copy del restante a estado “parcial” (slate).
- **Aviso de saldo negativo:** aparece cuando `saldo_cuenta − monto < 0`. No bloquea.
- **Navegación:** Home → Cuenta corriente (botón/CTA y link USD). Breadcrumb vuelve a Home.
- **Responsive:** breakpoint `560px`. Home: hero a 1 columna, tiles apilados, “Registrar” pasa a
  ícono. Cuenta corriente: cards apiladas, ecuación 2×2, tabla → lista. Saldar: drawer → bottom
  sheet, impacto a 1 columna.

## State Management
Estado necesario al implementar (sugerido):
- **Moneda activa** por pantalla (`'ARS' | 'USD'`).
- **Mes seleccionado** (sólo afecta el gasto/consumo de la Home; la deuda y la proyección son
  “hoy”, no dependen del mes).
- **Categoría abierta** en el drill (id o índice).
- **Saldar:** `monto`, `cuentaOrigenId`; derivados → saldo después, restante de deuda, flag de
  negativo. Lado receptor: `cuentaDestinoId`.
- **Estado de liquidación:** `enviada-pendiente | completada | revertida | contraasiento`.
- Datos reales a traer del backend: saldo bimoneda, asientos de la cuenta corriente con su
  composición, cuentas del usuario con saldo disponible, cuotas/resúmenes futuros (proyección).

## Design Tokens
Definidos en `shared.css` (`:root`). Tipografía: **Plus Jakarta Sans** (400–800).

**Colores**
- Fondo `#EEF1F4` · Card `#FFFFFF` · Tinta/navy `#142231` (hero) · navy profundo `#0B1A2B`
- Texto: muted `#6B7683` · soft `#8A94A3` · faint `#AEB6C0` · bordes `#E8ECF1` / líneas `#EEF1F5`
- Esmeralda `#11B981` (acción/positivo), deep `#0E9E6E`, soft `#E7F8F0`
- Terracota `#C2705C` (deuda/negativo), soft `#F7ECE7`
- Slate `#3A6B8A` (= color de Juli), soft `#EAF1F6`
- Ámbar `#E79A2B` (futuro/aviso), soft `#FBF0DD`
- Violeta `#7C5CD6`, soft `#EEEAFA` · Rosa `#C95C86`, soft `#F8EAF0`
- Identidad de personas: **Juli = slate `#3A6B8A`**, **Caro = terracota `#C2705C`**
- Acentos en el hero (sobre navy): positivo `#4FD6A4`, deuda `#F0A88F`

**Forma / tipografía**
- Radios: cards 20–22px, drawer 24px, chips 999px, inputs 13–14px
- Sombras: cards `0 10px 30px -16px rgba(11,26,43,.25)`; drawer `0 30px 70px -20px rgba(11,26,43,.5)`
- Números: `font-variant-numeric: tabular-nums` (clase `.tnum`) en todo importe
- Montos es-AR: separador de miles `.` (ej. `$130.373`); USD como `US$ 84,00`
- Escala tipográfica: neto hero ~38–50px/800; saldos 30–44px/800; títulos de card 15–17px/800;
  cuerpo 13–14px/600–700; eyebrows 11px/800 uppercase tracking .1em

## Assets
- **Fuente:** Plus Jakarta Sans vía Google Fonts (reemplazar por la carga del repo).
- **Íconos:** todos **SVG inline** (stroke), dibujados a mano simple (carrito, casa, bowl, etc.)
  y categorías en `eq-drill.js` (mapa `ICONS`). Sustituir por el set de íconos del codebase.
- No hay imágenes raster ni logos.

## Files
Dentro de `design_handoff_compartido/`:
- `referencia-web.html` — visor de las 3 pantallas (desktop).
- `referencia-mobile.html` — visor de las 3 pantallas (~402px).
- `home.html` — Home.
- `cuenta-corriente.html` — Cuenta corriente.
- `saldar.html` — drawer Saldar (finalista, con JS interactivo).
- `saldar-flujo.html` — superficies del flujo (enviado / tarea de Caro / recibo).
- `shared.css` — tokens + chrome común (hero, “en qué gastaron”, últimos movimientos…).
- `home2.css`, `home3.css` — estilos específicos de la Home (hero liviano, tiles, proyección).
- `cc.css` — estilos de la cuenta corriente (ecuación, tabla, estados).
- `saldar.css` — drawer + superficies del flujo + responsive del bottom sheet.
- `mobile.css` — breakpoint 560px de Home y Cuenta corriente.
- `eq-drill.js` — render + interacción de “En qué gastaron” (drill + toggle moneda + íconos).

> Nota: `saldar.html` lleva su lógica en un `<script>` propio; las demás interacciones viven en
> `eq-drill.js`. Son referencias: al implementar, mover esa lógica a componentes/estado del repo.
