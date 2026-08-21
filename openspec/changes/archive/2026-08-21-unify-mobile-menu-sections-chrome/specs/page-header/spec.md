## ADDED Requirements

### Requirement: Las pantallas raíz de las secciones chromeless usan el back-link canónico (mobile)

El requirement "Las rutas hijas bajo (app) usan el back-link canónico de PageHeader (web)" cubre las rutas **hijas** de web, donde la salida de una section root la dan el sidebar (md+) o el drawer de la top bar (narrow). En `apps/mobile` no hay sidebar: la salida de una sección chromeless —una sección sin tab bar, alcanzable desde el `AppMenu`, ver capability `mobile-app-shell`— es su back-link. Esta regla es su equivalente nativo.

Toda pantalla raíz de una sección chromeless de `apps/mobile/app/(app)/<section>/index.tsx` SHALL renderizar un back-link al dashboard con el estilo canónico de `PageHeader`:

- Prop: `backLink={{ href: '/(app)/dashboard', label: t('nav.dashboard') }}`.
- Texto visible: `← {label}` (`← Inicio` en `es`, `← Home` en `en`), con clases `text-sm text-navy-muted`, tal como `PageHeader` ya lo renderiza.
- El `href` SHALL ser fijo al dashboard. NO SHALL usarse `onBackPress` con `router.back()`: el destino tiene que ser determinístico venga la navegación del `AppMenu`, de un deep link o de las cards del dashboard que linkean a estas secciones.
- Cuando la sección compone su header en un componente propio en lugar de montar `PageHeader` en la pantalla (por ejemplo `CardsHeader`), la prop SHALL pasarse dentro de ese componente, sin renderizar un back-link suelto encima.

El back-link SHALL estar visible **desde el primer paint**, antes de que resuelvan los datos del header (el conteo de tarjetas, el catálogo de instituciones), por la regla de chrome siempre visible de `route-loading-and-errors`. Es chrome estático: no depende de ninguna query.

Las pantallas raíz de los tres tabs reales (`dashboard`, `transactions`, `home`) NO SHALL declarar `backLink`: su navegación es el tab bar. Siguen renderizando el spacer `h-5` del requirement de altura constante.

Agregar el back-link a una pantalla que antes no lo tenía NO SHALL cambiar la altura del bloque superior: la fila del link reemplaza exactamente al spacer `<View className="h-5" />` que `PageHeader` renderiza cuando `backLink` está ausente.

#### Scenario: Las tres secciones del Menú muestran el back-link al dashboard

- **WHEN** un usuario abre Cuentas (`/accounts`), Tarjetas (`/cards`) o Configuración (`/settings`)
- **THEN** el header muestra `← Inicio` arriba del título, con clases `text-sm text-navy-muted`
- **AND** presionarlo navega a `/(app)/dashboard` en las tres

#### Scenario: El back-link se ve antes de que resuelvan los datos del header

- **WHEN** se abre `/cards` y el conteo de tarjetas del subtítulo todavía está cargando
- **THEN** el back-link `← Inicio` ya está visible y es presionable
- **AND** el subtítulo muestra su copy de carga sin ocultar el back-link

#### Scenario: Agregar el back-link no mueve el contenido

- **WHEN** se compara el header de una sección antes y después de declarar `backLink`
- **THEN** la altura total del bloque navy superior es la misma
- **AND** el contenido scrolleable de la pantalla no salta verticalmente

#### Scenario: Las pantallas de los tabs reales no llevan back-link

- **WHEN** un usuario está en `dashboard`, `transactions` o `home`
- **THEN** el header no muestra ningún `← …`
- **AND** el slot vertical sigue reservado por el spacer `h-5`
