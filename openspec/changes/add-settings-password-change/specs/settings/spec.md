## ADDED Requirements

### Requirement: `/settings` agrupa la administración de la cuenta en una sección Seguridad

`/settings` SHALL exponer una sección **Seguridad** como última sección de la pantalla, después de Categorías, en `apps/web` y en `apps/mobile`. La sección SHALL renderearse con el componente compartido `SettingsSection` y su título SHALL leerse de `settings.security.label`.

La sección SHALL contener una fila "Cambiar contraseña" (copy en `settings.security.change_password.cta`) con una descripción que anticipe el efecto sobre las demás sesiones (`settings.security.change_password.description`). La fila SHALL navegar a `/settings/password` (web) o `/(app)/settings/password` (mobile); NO SHALL abrir un formulario en el lugar.

Esa distinción es la regla de la sección: mientras Visualización e Idioma alojan **preferencias de aplicación inmediata** (un toggle o un control segmentado que muta al tocarlo), Seguridad aloja **acciones** que necesitan un formulario, confirmación y un desenlace propio. Las acciones SHALL vivir en rutas hijas, y la fila de la sección SHALL ser sólo el punto de entrada.

El sistema NO SHALL introducir una ruta hub `/settings/security` mientras la sección tenga una sola fila: sería una pantalla cuyo único contenido es un link. Las capacidades futuras de administración de cuenta SHALL sumarse como filas nuevas de esta misma sección; la promoción a ruta propia queda para cuando la raíz de `/settings` quede cargada.

#### Scenario: La sección Seguridad aparece última en web

- **WHEN** un usuario autenticado navega a `/settings` en web
- **THEN** la página muestra las secciones "Visualización", "Idioma", "Categorías" y "Seguridad" en ese orden
- **AND** la sección Seguridad contiene la fila "Cambiar contraseña" con su descripción

#### Scenario: La sección Seguridad aparece última en mobile

- **WHEN** un usuario autenticado navega a `/(app)/settings` en mobile
- **THEN** la pantalla muestra las mismas cuatro secciones, en el mismo orden y con los mismos títulos que web

#### Scenario: La fila navega a la ruta hija

- **WHEN** un usuario presiona "Cambiar contraseña" en `/settings`
- **THEN** la app navega a `/settings/password` (web) o `/(app)/settings/password` (mobile)
- **AND** la raíz de `/settings` no renderea ningún campo de contraseña

### Requirement: La ruta de cambio de contraseña declara su propio chrome

`/settings/password` (web) y `/(app)/settings/password` (mobile) SHALL renderear su propio `PageHeader` con `title` leído de `settings.security.change_password.title` y `backLink` al stack-parent `/settings` con label `settings.title`.

En web, el `SettingsHeader` que monta `settings/layout.tsx` sólo renderiza contenido cuando el pathname es exactamente `/settings`, así que la ruta hija SHALL montar su header en su propio `page.tsx` — sin layout intermedio y sin doble header.

En mobile, la pantalla SHALL montarse sobre `FormScreen`, que compone `PageHeader` + `KeyboardAwareScrollView`. El shell es obligatorio acá y no opcional: son tres campos de password y el teclado tapa el submit sin él.

El chrome SHALL estar visible desde el primer paint. Es estático —no depende de ninguna query— así que NO SHALL taparse con un skeleton de header.

#### Scenario: El back-link vuelve a la raíz de settings

- **WHEN** un usuario abre la ruta de cambio de contraseña en cualquiera de las dos plataformas
- **THEN** el header muestra `← Configuración` arriba del título
- **AND** presionarlo navega a la raíz de `/settings`

#### Scenario: Web no renderea doble header

- **WHEN** un usuario navega a `/settings/password` en web
- **THEN** la página muestra un único título de página, el de la ruta hija
- **AND** el `SettingsHeader` del layout no aporta un segundo header

#### Scenario: El teclado no tapa el formulario en mobile

- **WHEN** un usuario enfoca el campo de confirmación en `/(app)/settings/password` con el teclado abierto
- **THEN** el campo enfocado queda por encima del teclado
- **AND** el botón de guardar es alcanzable scrolleando

## MODIFIED Requirements

### Requirement: El usuario MUST poder acceder a la pantalla de configuración en mobile (mobile)

`apps/mobile` SHALL exponer la ruta `/(app)/settings` con una pantalla que renderee, en este orden: un `PageHeader` con `title="Configuración"`, una sección **Visualización**, una sección **Idioma**, una sección **Categorías** (con enlace a `/(app)/settings/categories`) y una sección **Seguridad** (con enlace a `/(app)/settings/password`). La composición SHALL ser paritaria con `apps/web/app/(app)/settings/page.tsx`: mismo título, mismas secciones, mismo orden.

Cada sección SHALL renderearse con el componente compartido `SettingsSection` (header uppercase + contenedor con borde y fondo `card`), cuyo contrato vive en `@grana/ui-contracts`.

La pantalla NO SHALL renderear un `<h1>` ad-hoc — usa `PageHeader` mobile.

**Todas** las pantallas del stack de settings (roots y anidadas) SHALL usar el `PageHeader` custom — no el native stack header. Las anidadas (`/(app)/settings/categories/new`, `/[id]/edit`, `/[id]/subcategories`, `/[id]/subcategories/new`, `/(app)/settings/password`) SHALL pasar la prop `backLink` (con `href` al stack-parent y `label` legible) para que el back link aparezca arriba del título, siguiendo el mismo patrón visual que `PageHeader` ya implementa en web y en el resto de mobile. El native stack header (`headerShown: true` via `<Stack.Screen>`) NO SHALL aparecer en este stack — el `_layout.tsx` de cada nivel mantiene `screenOptions={{ headerShown: false }}` y el chrome lo provee el componente compartido. Razón: consistencia visual cross-platform y unificación del lenguaje de headers; las pantallas web equivalentes usan el mismo `PageHeader` con `backLink`.

Cada pantalla que **componga el árbol a mano** (`View` > `PageHeader` > scroller, como la raíz de settings y las de categorías) SHALL envolver su contenido en `SafeAreaView edges={['top']}` (de `react-native-safe-area-context`) para respetar el notch / status bar, ya que al no haber native header no hay safe-area automático. Las pantallas montadas sobre un **shell que ya compone `PageHeader`** —`FormScreen` y equivalentes— NO SHALL declarar `SafeAreaView edges={['top']}` propio: el inset superior lo administra el header dentro del shell, y duplicarlo agregaría padding de más. Es lo que `/(app)/settings/categories/new` ya hace desde que existe `FormScreen`.

#### Scenario: La ruta /settings está disponible en mobile

- **WHEN** un usuario autenticado en mobile navega a `/(app)/settings`
- **THEN** la pantalla renderea el `PageHeader` con título "Configuración"
- **AND** muestra las secciones "Visualización", "Idioma", "Categorías" y "Seguridad" en ese orden

#### Scenario: La pantalla settings es accesible desde el AppMenu

- **WHEN** un usuario abre el `AppMenu` y presiona el ítem "Configuración"
- **THEN** el sheet del menú se cierra
- **AND** la app navega a `/(app)/settings`

#### Scenario: Una pantalla sobre FormScreen no duplica el safe-area superior

- **WHEN** se inspecciona una pantalla anidada del stack de settings montada sobre `FormScreen` (`/(app)/settings/categories/new`, `/(app)/settings/password`)
- **THEN** la pantalla no declara `SafeAreaView edges={['top']}` propio
- **AND** el contenido igual respeta el notch, porque el inset lo aplica el `PageHeader` que compone el shell
