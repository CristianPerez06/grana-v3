## Why

El dashboard y el shell web se construyeron mobile-first y nunca aprovecharon el desktop: incluso en pantallas anchas el dashboard se renderiza como una columna única dentro de un contenedor angosto (`max-w-5xl`). Además, el resumen de tarjetas vive duplicado (en el dashboard y en `/cards`), y el sidebar island no tiene una estructura interna que tolere crecer en cantidad de ítems sin romper el acceso a Configuración / Cerrar sesión. Este change toma los diseños ya validados en Paper —Dashboard en desktop, web-mobile y app nativa— y los convierte en requisitos del repo.

## What Changes

- **Layout desktop del dashboard (web)**: por encima del breakpoint `lg` (1024px) el dashboard reflowea de columna única a un layout multi-columna — Hero ancho arriba (full width), y debajo dos columnas con alturas igualadas: **Balance del mes** (izquierda) y un rail de **Lo que viene** (derecha). Por debajo de `lg` se mantiene la columna única mobile-first actual.
- **Header del dashboard**: incorpora el saludo `Hola, {name}.` (reusa la key existente `dashboard.welcome`) más la fecha del día calculada desde la zona horaria financiera (`getTodayAR()`, nunca `new Date()`). En desktop el saludo es grande y convive con el `eye toggle` (ya existente) y un botón primario nuevo **"Nuevo movimiento"** (emerald → `/transactions/new`). En la app nativa el saludo se pinta dentro del header navy.
- **Hero con desglose de cuentas (desktop)**: además del disponible total bimoneda, en desktop el Hero muestra inline una lista corta de cuentas cash/débito con su saldo y un link "Ver todas las cuentas" → `/accounts`. En mobile el Hero se mantiene minimal (solo disponible total + USD subordinado). Se respeta **bimoneda**: ARS primario en tipografía grande, USD subordinado, sin merge entre monedas.
- **BREAKING (IA): se quita la sección Tarjetas del dashboard en todas las plataformas.** El dashboard pasa de cuatro a tres secciones (Hero · Lo que viene · Balance del mes). El resumen de tarjetas vive únicamente en `/cards` (web) y se navega desde el `AppMenu` → `/cards` (nativo).
- **Sidebar web (island)**: estructura interna explícita — el logo `grana` actúa como header fijo, la nav primaria es la zona central flexible y scrolleable (tolera más ítems que el viewport), y Configuración + Cerrar sesión quedan como footer sticky al fondo, con un divisor que separa el área scrolleable del footer.
- **Header navy en nativo**: se formaliza que el header del dashboard nativo y la status bar se pintan con el navy de marca (`--navy` / `#0B1A2B`) con la status bar en estilo light (cambio ya commiteado, hoy sin requirement).

## Capabilities

### New Capabilities

(ninguna — todas las capabilities involucradas ya existen)

### Modified Capabilities

- `dashboard`: **REMOVED** la sección Tarjetas del dashboard (cuatro → tres secciones, web + mobile); **ADDED** layout desktop multi-columna (web), saludo + fecha en el header, botón "Nuevo movimiento" (web), desglose de cuentas en el Hero (web), header navy en el dashboard nativo; **MODIFIED** el requirement del Hero y el requirement de la pantalla mobile que hoy enumera cuatro secciones.
- `web-app-shell`: **ADDED** la estructura header-fijo / nav-scrolleable / footer-sticky del sidebar island (convive con los requirements existentes de island flotante y de `<main>` scrollable).

> `cards` **no** cambia sus requirements: `/cards` ya expone el carrusel/listado de resúmenes y sigue igual; este change solo deja de duplicar esa superficie en el dashboard. Se documenta en Impact, sin delta artificial.

## Impact

- **Specs**: `openspec/specs/dashboard/spec.md`, `openspec/specs/web-app-shell/spec.md`.
- **Código web**: `apps/web/app/(app)/dashboard/*` (header, Hero, grid desktop, eliminación de la sección Tarjetas), `apps/web/app/(app)/_components/app-shell.tsx` (estructura del sidebar).
- **Código mobile**: pantalla dashboard de `apps/mobile` (remover sección Tarjetas, header navy + status bar light).
- **Datos**: sin cambios de DB ni migraciones. Balances siguen derivándose (no se persisten).
- **Lógica compartida**: `@grana/dashboard` deja de requerir/usar la query del carrusel de tarjetas para el dashboard; el resto de agregaciones no cambian.
- **i18n**: reutiliza `dashboard.welcome` y `nav.*`. El botón "Nuevo movimiento" debe leer su label del catálogo (verificar key existente, p. ej. `transactions.new`, o agregar una bajo `dashboard.*`).
- **Diseño de referencia**: archivo de Paper **"Grana V3 — Desktop"** (artboards: *Dashboard — Desktop 1440*, *Cards — Desktop 1440*, *Dashboard — Web Mobile*, *Dashboard — Mobile App*). No hay export a código todavía; la implementación traduce esos artboards con tokens (`@grana/ui-tokens`), contracts (`@grana/ui-contracts`) y lógica pura (`@grana/money-logic`).
- **Fuera de alcance**: pantalla Cards mobile, overlays de navegación (drawer del web-mobile, `AppMenu` sheet del nativo) y el export 1:1 a código.
