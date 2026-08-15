# Diseño — Alta de movimientos (mobile)

Decisiones visuales del rediseño del alta, cerradas con el PO. Acompaña al change `openspec/changes/simplify-movement-form-surface/` (el **qué/por qué** contable-funcional vive ahí; acá el **cómo se ve**). Scope: viewport mobile de `apps/web` (gateado por breakpoint) y `apps/mobile`. El desktop no se toca.

> Los mockups son artifacts privados del PO (referencia visual). Las decisiones de abajo son la fuente durable — el repo es la memoria.

## Mockups de referencia

- **Alta de gasto — final** (pantalla simple + con tarjeta): https://claude.ai/code/artifact/713f15e1-b7ef-4b24-a5f9-092dcdd06072
- **Selector de cuenta — definido** (los 3 escenarios por cantidad de cuentas): https://claude.ai/code/artifact/b5f6e509-bae6-4215-a1d2-693626f180ce

## Principios visuales

- **Íconos de línea (SVG) en el chrome** (cuenta, fecha, nota, avanzadas). Los **emoji quedan solo en categorías** (son la identidad de Grana; en el chrome restaban seriedad).
- **Verde con cuentagotas**: solo lo activo/seleccionado y el CTA. El resto, neutros.
- **Peso visual por rol**: monto = héroe (contenido); categoría = acción principal; lo secundario (cuenta, fecha, nota) liviano.
- **Avatares con color de marca de la institución** (Galicia naranja, Santander rojo, BBVA azul, Naranja naranja, Visa azul…) vía `resolveAccountAvatar` — nunca colores arbitrarios.
- **Reusar `@grana/ui`** (Segmented, Switch, SelectSheet, chips) y los tokens de color/espaciado existentes. Estos mocks son el mapa, no componentes nuevos.

## Layout (orden vertical)

`Tipo (tabs) → Monto → Categoría → Cuenta → Fecha → Descripción → Avanzadas → CTA`

## Componente por componente

### Tabs
Tres: **Gasto · Ingreso · Otros**. Gasto/Ingreso primarios fijos; "Otros" abre una hoja con Transferencia, Ajuste y Cambio (gateados por elegibilidad). Reemplaza el selector de 5 y descarta el "tercer slot dinámico" (más simple y predecible). Header compacto: sin eyebrow "Nuevo" ni título gordo — las tabs + el CTA dan el contexto.

### Monto
**Centrado**, con el **chip de moneda (ARS ▾) y la calculadora a la derecha** (la calculadora es la que ya existe). Tamaño contenido (~32px), autofocus al abrir.

### Categoría
Chips **sin borde** (ícono de categoría + label; el seleccionado se marca con fondo verde suave). "Ver todas" abre el picker completo, **sin drill obligatorio** (tocar la categoría la elige; un chevron expande subcategorías). _Los chips alimentados por historial son Fase 2 (#31)._

### Cuenta — escala con la cantidad (la profundidad sigue a los datos)
El eje es la **familia Débito/Crédito**. Elegir Crédito revela las **cuotas**.

- **1 cuenta** → sin selector (implícita).
- **Billetera + 1 tarjeta** → **toggle Débito/Crédito** ("¿Cómo pagás?"); el toggle *es* la cuenta.
- **Hasta ~3 cuentas + 3 tarjetas** → **toggle de familia + chips** de esa familia.
- **Muchas (3+ cuentas, 4+ tarjetas)** → **drilldown**: dos secciones plegables (Débito / Crédito) que abren su listado. Con memoria (Fase 2), default = "cuenta habitual" (0 taps) + "Cambiar".

### Cuotas
Aparece **pegada a la cuenta** cuando la cuenta es tarjeta (forma de pago, no avanzada). Tratamiento sobrio (borde fino + chips): `1 pago · 3× · 6× · 12× · Otras`. "**Otras**" abre un stepper para cualquier cantidad (como hoy). No aparece en la fila de avanzadas.

### Fecha
Chips **Hoy / Ayer** inline; tocar la fila abre el calendario para otra fecha. 0 taps en el caso normal.

### Descripción
Opcional, como fila liviana "**Agregar nota**", después de Fecha (no al fondo del todo).

### Avanzadas (Capa 1)
**Directas y livianas**, sin colapsar: `↩️ Reintegro · 👥 Compartir · 🔁 Repetir` (símbolo primero, palabra chica, sin recuadro; se encienden en verde al tocar). Set contextual (1–3 según tipo/hogar/cuotas): en cuotas no aparece Repetir; en ingreso solo Repetir; en ajuste/cambio, ninguna. Activar una revela sus parámetros en el lugar.

#### Reintegro — bloque desplegado
Handoff visual detallado (2 rows de 38 px, estados, spec y reglas) en [`reintegro/README.md`](./reintegro/README.md) + canvas [`reintegro/reintegro-bloque-final.html`](./reintegro/reintegro-bloque-final.html). **Solo rediseño**: preserva toda la funcionalidad activa (sugerencia de cuenta de la misma entidad del medio de pago, monto ↔ %, tope, acreditado/pendiente).

## Estados pendientes de mockear
Primer movimiento (sin historial → sin chips), y una avanzada expandida (ej. Compartir con el 50/50). No bloquean la implementación de superficie.
