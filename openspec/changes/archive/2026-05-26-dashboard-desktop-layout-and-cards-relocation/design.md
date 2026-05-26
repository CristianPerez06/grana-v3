## Context

El dashboard (`dashboard`) y el shell web (`web-app-shell`) se implementaron mobile-first. En desktop, el `<main>` queda en un contenedor `max-w-5xl` con las secciones apiladas en una sola columna, desperdiciando el ancho. El sidebar island ya existe (colapsable, paleta de marca, estado activo por ruta) pero su estructura interna no distingue header / zona scrolleable / footer, así que al crecer en ítems el acceso a Configuración / Cerrar sesión queda comprometido.

Los diseños de las tres vistas (desktop, web-mobile, app nativa) están en Paper y exportados a `design-refs/` (PNG + SVG + JSX representativo). Este documento fija las decisiones para traducirlos a código respetando tokens, contracts y lógica pura compartida.

## Goals / Non-Goals

**Goals:**
- Dashboard desktop multi-columna que use el ancho, sin tocar la experiencia mobile-first por debajo del breakpoint.
- Header del dashboard con saludo + `eye toggle` + CTA "Nuevo movimiento" (desktop), saludo en header navy (nativo).
- Hero desktop con desglose de cuentas, respetando bimoneda.
- Sidebar con estructura header-fijo / nav-scrolleable / footer-sticky.
- Quitar Tarjetas del dashboard en todas las plataformas; `/cards` (web) y `AppMenu → /cards` (nativo) quedan como única superficie.

**Non-Goals:**
- Pantalla Cards mobile, overlays de navegación (drawer web-mobile, `AppMenu` sheet nativo).
- Cambios en la lógica de balances, períodos de tarjeta o recurrencias.
- Export 1:1 del markup de Paper (es referencia, no implementación).
- Rediseño del listado/carrusel de tarjetas en `/cards` (no cambia).

## Decisions

### 1. Breakpoint del reflow desktop: `lg` (1024px)
El sidebar ya aparece en `md` (768px), pero a 768px dos columnas de contenido (`Balance del mes` + rail `Lo que viene`) quedan apretadas. Se reflowea a multi-columna recién en `lg`. Entre `md` y `lg` se ve el sidebar + contenido en columna única. Por debajo de `md`, mobile-first intacto.
- *Alternativa descartada*: reflowear en `md`. Rechazada por ancho insuficiente para el rail + chart legibles.

### 2. Grid desktop: Hero full-width arriba; debajo dos columnas con alturas igualadas
Hero ocupa el ancho. Debajo, `Balance del mes` (izquierda, crece) y rail `Lo que viene` (derecha, ancho fijo ~ `w-98`). Las dos columnas igualan altura (la más alta manda) y el chart de Balance del mes absorbe el alto sobrante. Esto evita el "escalón" que aparecía cuando la columna izquierda era más corta que el rail.
- *Alternativa descartada*: Tarjetas como banda full-width abajo (se exploró en Paper) — ya no aplica porque Tarjetas sale del dashboard.

### 3. Header del dashboard: saludo + eye toggle + CTA conviven
- Saludo `Hola, {name}.` desde `dashboard.welcome`; fecha del día desde `getTodayAR()` (nunca `new Date()`, por el principio de zona horaria financiera).
- Desktop: saludo grande a la izquierda; a la derecha, en una fila, el `eye toggle` (ya existente) + botón primario "Nuevo movimiento" (emerald → `/transactions/new`).
- Nativo: el saludo se pinta dentro del header navy; el `eye toggle` va en ese header. El CTA "Nuevo movimiento" es **desktop-only** (en nativo cargar movimiento se resuelve por el flujo existente, fuera de alcance acá).

### 4. Hero con desglose de cuentas: solo desktop
En desktop el Hero suma, a la derecha del disponible, una lista corta de cuentas cash/débito con saldo + link "Ver todas las cuentas" → `/accounts`. En mobile el Hero se mantiene minimal (disponible total + USD subordinado) por espacio. Se respeta **bimoneda**: ARS primario grande, USD subordinado, sin merge. La lista de cuentas reusa datos ya disponibles (no agrega lógica de balance nueva; los saldos siguen derivándose).

### 5. Sidebar: header fijo / nav scrolleable / footer sticky
Estructura flex column dentro del island: logo `grana` (`flex-shrink:0`), nav primaria (`flex:1; min-height:0; overflow-y:auto`), footer con Configuración + Cerrar sesión (`flex-shrink:0`) separado por un divisor. Convive con los requirements existentes ("island flotante", "`<main>` scrollable; el body no scrollea"): el scroll del nav es **interno al island**, independiente del scroll del `<main>`.

### 6. Quitar Tarjetas del dashboard → ajustar la carga de datos
El dashboard deja de renderizar `CreditCardCarousel` y deja de disparar `getCreditCards` como parte de la carga del dashboard (web y mobile). Pasa de 4 a 3 secciones (Hero → Lo que viene → Balance del mes). En `@grana/dashboard` esto significa no requerir esa query en el path del dashboard; la query sigue existiendo para `/cards`. En nativo, Tarjetas ya se navega desde el `AppMenu` (nunca fue slot del tab bar), así que no hay cambio de navegación, solo se quita la sección de la pantalla.

### 7. Header navy en nativo: formalizar lo ya commiteado
Se deja asentado en el spec que el header del dashboard nativo y la status bar se pintan con `--navy` (`#0B1A2B`) y status bar en estilo light. No es un cambio de código nuevo (ya está), pero pasa a ser requirement para que no se pierda.

## Risks / Trade-offs

- **Quitar Tarjetas del dashboard reduce visibilidad del vencimiento de resúmenes en la landing** → Mitigación: la alerta de vencimiento sigue en `/cards` (mora visible, ámbar/rojo). Si más adelante se quiere un recordatorio en el dashboard, entra como cambio aparte (p. ej. dentro de "Lo que viene").
- **Saludo con nombre depende de tener el nombre del perfil** → Mitigación: fallback `dashboard.welcome_anon` ("Hola.") ya existe en el catálogo.
- **El desglose de cuentas en el Hero puede crecer** → Mitigación: mostrar las top-N cuentas + "Ver todas las cuentas"; no es un listado completo.
- **Markup de Paper con hex literales puede ser copiado tal cual** → Mitigación: `design-refs/README.md` marca el material como no-autoritativo; la implementación usa clases de token.
- **CTA "Nuevo movimiento" puede no tener key i18n** → Verificar `transactions.new` o agregar key bajo `dashboard.*`; no hardcodear.

## Open Questions

- Label exacto e i18n key del botón "Nuevo movimiento" (reusar existente vs. nueva key).
- ¿Cuántas cuentas muestra el desglose del Hero desktop antes de cortar con "Ver todas"? (sugerido: 2–3). Se puede afinar en implementación.
