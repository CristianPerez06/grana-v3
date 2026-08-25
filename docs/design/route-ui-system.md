# Sistema UI de rutas

## Proposito

Este documento define como diseñar y documentar pantallas de ruta en Grana para web y mobile. No reemplaza OpenSpec: OpenSpec captura comportamiento de producto; este archivo captura patrones visuales, jerarquia, composicion y criterios de handoff para que las rutas nuevas o rediseñadas no dependan de contexto de chat.

La regla base: el diseño solo puede reorganizar o enfatizar informacion que la ruta ya tiene disponible. Si una propuesta necesita datos nuevos, primero se documenta como requerimiento de producto o query nueva; no se presenta como parte del mock principal.

## Alcance

Este sistema cubre dos niveles:

- **Patrones generales**: como se arma una ruta, como se decide la jerarquia, como se divide desktop/mobile, que estados cubrir.
- **Estilos concretos**: superficies, tipografia, radios, espaciado, tratamiento de montos, bimoneda, botones, cards y filas.

No intenta fijar cada pixel. Los valores numericos son guias para mantener consistencia; la implementacion final debe usar tokens y componentes existentes del repo.

## Fuentes de verdad

- Tokens: `packages/ui-tokens/src/theme.css`.
- Primitivos web: `apps/web/components/ui/`.
- Primitivos mobile: `apps/mobile/components/ui/`.
- Contratos compartidos: `packages/ui-contracts/`.
- Comportamiento de producto: `openspec/specs/`.
- Reglas repo-wide: `AGENTS.md`.
- Handoffs visuales: `docs/design/<feature>/`.

## Workflow de diseño

Los diseños de ruta se autoran como **archivos HTML versionados en este repo**, bajo `docs/design/<feature>/`. No se usan herramientas de diseño externas: el repo es la única fuente de handoff visual, para que una sesión fresca pueda abrir los mocks sin contexto de chat. Estructura por feature:

```
docs/design/<feature>/
├── README.md          # contexto, observaciones, propuesta, recomendación, lista de archivos de trabajo
├── shared.css         # tokens/estilos compartidos de los mocks
├── web/<feature>.html # vista desktop
├── mobile/<feature>.html  # vista mobile, común a web-mobile y app nativa
└── components/*.html  # desglose por componente (route-shell, header, filas, estados…)
```

Reglas:

1. **Las dos vistas, antes de specear:** desktop y mobile. Se diseñan las dos y recién después se genera el spec OpenSpec.

   **La vista mobile es una sola para las dos plataformas.** El chrome de `apps/web` en viewport angosto y el de `apps/mobile` son el mismo: `PageHeader` navy que se come el safe-area, tab bar fija de cuatro slots, menú y overlays como bottom sheets. Un mock mobile describe las dos, y lo que cambia es la implementación —HTML contra React Native—, no el diseño.

   Antes eran tres, y web-mobile se definía como "responsive en navegador, topbar + drawer" frente a la nativa "header navy + tab bar". Esa divergencia era deliberada, pero salía cara y no compraba nada: la web es una PWA `display: standalone`, así que instalada en el home screen de un teléfono competía de frente con la app nativa **viéndose como otro producto**. Se cerró en el change `mirror-native-chrome-on-web-mobile` (issue [#60](https://github.com/CristianPerez06/grana-v3/issues/60)), cuyo handoff —`docs/design/web-mobile-chrome/`— tiene el inventario de los dos shells y el mapeo pieza por pieza.

   Dos aclaraciones para que la regla no se aplique de más:

   - **Es el chrome lo que converge, no el contenido.** El layout interno de una ruta sigue siendo una decisión por plataforma y por ancho: qué se apila, qué columnas auxiliares se ocultan, dónde cae la acción más frecuente. Todo eso sigue en la sección **Responsive**.
   - **Sigue habiendo dos implementaciones.** La política Web ↔ Mobile de `AGENTS.md` no se toca: mismos nombres y mismas props vía `@grana/ui-contracts`, JSX distinto de cada lado. Una vista de diseño compartida no habilita componentes compartidos.

   Si una ruta necesita chrome mobile distinto entre plataformas, eso es una excepción y va argumentada en el `README.md` del feature — no un tercer mock por costumbre.
2. **Los mocks son no-autoritativos.** El HTML usa datos de ejemplo y puede usar valores literales para representar el visual; no es la implementación. La implementación final usa tokens (`@grana/ui-tokens`) y componentes por plataforma. Nunca copiar un hex literal del mock al código: traducir a clases de token.
3. El `README.md` de cada feature ancla la paleta a tokens y se referencia desde el `design.md` del change correspondiente.
4. **Los handoffs previos a agosto 2026 siguen la convención de tres vistas.** En esos bundles, el archivo `web/<feature>.html` incluye una vista mobile con el chrome viejo (topbar blanca + drawer lateral) que ya no describe el producto. No se migran: son mocks no-autoritativos de trabajo ya implementado, y reescribirlos costaría más de lo que aclara. Al abrir uno, la vista mobile vigente es la de `mobile/<feature>.html`.

   La excepción es `docs/design/web-mobile-chrome/`, que es el handoff de este cambio: ahí `web/chrome.html` es el chrome espejado en contexto y `mobile/chrome.html` la referencia nativa contra la que se comparó. Su objeto de diseño era justamente la divergencia, así que necesita las dos por separado.

## Antes de diseñar una ruta

1. Leer la implementacion actual de la ruta.
2. Listar componentes reales que la componen.
3. Listar datos reales disponibles en props, queries o server actions.
4. Separar datos siempre presentes de datos condicionales.
5. No agregar metricas derivadas, resumenes o cards nuevas sin requerimiento explicito.
6. Crear mocks con datos de ejemplo solo para representar campos existentes.

Para cada propuesta, dejar escrito el inventario:

```md
Datos disponibles:
- identidad / titulo
- descripcion o subtitulo
- balance / monto principal
- acciones actuales
- bloques condicionales actuales
- filtros actuales
- lista / tabla actual
- estados loading / empty / error
```

## Arquetipos de ruta

### Ruta de detalle

Ejemplos: `/accounts/[id]`, `/cards/[id]`, detalle de movimiento.

Estructura recomendada:

1. Back link o navegacion contextual.
2. Header compuesto con identidad + dato principal + accion primaria del objeto.
3. Bloques condicionales actuales, si existen.
4. Acciones secundarias actuales, si existen.
5. Seccion operacional principal: movimientos, periodos, cuotas, detalle, etc.
6. Estados empty/loading/error integrados, no pantalla aparte si el chrome de ruta ya puede renderizar.

Desktop:
- Usar ancho mayor que una columna estrecha cuando hay lista o ledger.
- El dato principal debe ser visible antes de la lista.
- Si hay running balance o columnas de comparacion, desktop puede mostrarlas como columnas.

Mobile:
- Hero compacto arriba.
- Acciones primarias dentro o inmediatamente debajo del hero.
- Bloques condicionales apilados.
- Filas de lista: el monto queda inline con el titulo (misma altura que en desktop), alineado a la derecha en su columna; el titulo trunca si es largo. No apilar el monto debajo del titulo.
- Lo que se oculta en mobile son las columnas auxiliares (running balance, comparaciones), no el monto principal.

### Ruta de lista / ledger

Ejemplos: `/transactions`, listas por cuenta, recurrencias.

Estructura recomendada:

1. Header de ruta o contexto mensual.
2. Overview solo si ya existe como comportamiento de la ruta.
3. Toolbar de busqueda/filtros cerca de la lista.
4. Chips de filtros activos.
5. Grupos por fecha o categoria cuando ayuden a escanear.
6. Empty states por causa: sin datos, busqueda, filtros.

### Ruta de dashboard

El dashboard puede usar cards de resumen porque su funcion es sintetizar. Esta libertad no se transfiere automaticamente a rutas de detalle. Una ruta de detalle no debe inventar resumenes por copiar el lenguaje del dashboard.

## Jerarquia visual

### Dato principal

El dato principal de una ruta debe tener un contenedor propio y una jerarquia clara.

- Cuenta: disponible ARS como titular, USD subordinado.
- Tarjeta: monto o estado del periodo segun spec de cards.
- Movimiento: monto y tipo del movimiento.

### Bimoneda

- ARS es principal cuando ambas monedas aparecen juntas.
- USD es subordinado: menor tamano, label o linea separada.
- Nunca sumar ARS + USD ni convertir automaticamente.
- Totales por moneda se muestran separados.

### Acciones

- Acciones tipo CTA usan `Button`.
- Acciones icon-only usan icon button con `aria-label`.
- Link textual sigue siendo link textual cuando no es CTA.
- En mobile, la accion mas frecuente debe estar cerca del dato principal.

## Superficies y estilos

Usar tokens existentes, no valores sueltos cuando se implemente:

- Page: `bg-background` / `--page`.
- Card: `bg-card`, borde `border-border` o `border-border-soft`.
- Navy: superficie principal para heroes de detalle cuando el objeto necesita foco.
- Emerald: accion primaria y estados positivos.
- Terracotta: egresos/gastos.
- Warning: estados pendientes o atencion no destructiva.

Radios de referencia:

- Cards: 18-22px.
- Hero/detail surfaces: 18-24px.
- Buttons/inputs: 10-14px.
- Pills/chips: 999px.
- Avatares cuadrados: 12-16px.

Tipografia de referencia:

- Page/detail title: 24-28px, semibold/bold, tracking normal.
- Monto principal: 34-44px, bold, tabular nums.
- Monto secundario: 15-20px, semibold, muted.
- Section title: 14-18px, semibold/bold.
- Captions/metadata: 12-13px, muted.
- Eyebrow: 11px, uppercase, tracking amplio.

Reglas de montos:

- Siempre `font-variant-numeric: tabular-nums`.
- Positivos en emerald cuando representan ingreso/credito real.
- Gastos en terracotta.
- Montos pendientes que no afectan saldo no deben parecer saldo real.

## Componentes de ruta

Cada rediseño debe poder dividirse en piezas trabajables:

- `route-shell`
- `detail-header` o `page-header`
- bloque condicional actual
- accion secundaria condicional actual
- section header
- filters / toolbar
- row
- list
- empty state
- loading state
- error state si aplica

Cuando se hacen mocks HTML, crear:

```txt
docs/design/<feature>/
  README.md
  shared.css
  web/<route>.html        # desktop
  mobile/<route>.html     # mobile, común a web-mobile y app nativa
  components/<component>.html
```

Los mocks son referencia visual, no codigo de produccion. La implementacion real debe usar componentes del codebase.

## Responsive

Desktop:

- Dar ancho a rutas con ledger/lista.
- Mostrar columnas auxiliares solo si aportan lectura clara.
- Evitar cards laterales si solo repiten informacion o inventan resumenes.

Mobile:

- Usar una sola columna.
- Hero primero para rutas de detalle.
- Toolbar compacta o controles iconicos.
- Ocultar columnas auxiliares como running balance si no hay espacio.
- Mantener hit targets cercanos a 44px.
- **El chrome no se diseña por ruta.** Header navy, tab bar, back-link y overlays los provee el shell, iguales en toda la app y en las dos plataformas. Un mock mobile los dibuja para dar contexto, no para proponerlos. Lo que sí decide la ruta es qué va en el slot `actions` de su header — y va ahí, visible en todo ancho, no en un botón flotante: el único FAB del producto es el de registrar movimiento.

## Estados

Cada ruta debe tener mocks o criterio para:

- Loading inicial.
- Loading por seccion si la ruta carga por partes.
- Empty sin datos.
- Empty por busqueda.
- Empty por filtros.
- Error por seccion, si aplica.
- Estado archivado/inactivo, si el objeto lo soporta.

Los estados no deben romper el chrome de la ruta. Si el header puede renderizar, no taparlo con un loader global.

## Checklist de handoff

Antes de cerrar un handoff visual:

- La propuesta no inventa datos.
- Los datos condicionales estan marcados como condicionales.
- ARS/USD respetan bimoneda.
- Las acciones usan el rol visual correcto.
- Desktop y mobile estan cubiertos.
- Componentes individuales existen si la ruta es compleja.
- Loading/empty/error estan considerados.
- El README explica que archivos abrir y que decision se tomo.
- Si la propuesta cambia comportamiento, existe o se abre OpenSpec.

## Cuando actualizar OpenSpec

Actualizar OpenSpec si la decision afecta comportamiento, datos, contratos o invariantes. Ejemplos:

- Nueva query o nuevo resumen.
- Nuevo estado de negocio.
- Cambio de reglas de bimoneda.
- Nueva accion o mutacion.
- Nuevo contrato compartido web/mobile.

No hace falta OpenSpec para un ajuste puramente visual que solo reorganiza datos existentes, salvo que el patron se convierta en regla obligatoria para muchas rutas.
