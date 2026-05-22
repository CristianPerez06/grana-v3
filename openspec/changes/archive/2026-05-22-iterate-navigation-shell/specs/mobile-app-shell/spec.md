## ADDED Requirements

### Requirement: El tab bar puede mostrar slots en estado disabled

El tab bar SHALL soportar un estado "disabled" para slots que apuntan a features no implementadas. Un slot disabled SHALL:

- Renderizar el ícono y el label con `opacity-50` (visualmente atenuado).
- NO responder a tap (`onPress` no produce navegación).
- Anunciar el estado a tecnologías asistivas vía `accessibilityState={{ disabled: true }}`.
- Mostrar un badge "Próximamente" (texto pequeño) sobre o debajo del ícono que comunique al usuario que la feature viene pero todavía no está disponible. El string SHALL leerse de `nav.coming_soon`.

#### Scenario: Slot disabled no navega

- **WHEN** un usuario presiona un slot del tab bar marcado como disabled
- **THEN** la app NO navega a ninguna pantalla
- **AND** no ocurre cambio visual de estado activo

#### Scenario: Slot disabled se ve atenuado y muestra "Próximamente"

- **WHEN** un usuario observa un slot disabled en el tab bar
- **THEN** el ícono y label del slot se muestran con opacidad reducida
- **AND** un badge "Próximamente" (texto de `nav.coming_soon`) acompaña al slot

### Requirement: Los labels del tab bar y AppMenu se leen del catálogo i18n

Tanto el `TabBar` como el `AppMenu` mobile SHALL leer todos sus labels desde el catálogo `@grana/i18n-messages` vía el helper `t()` de `apps/mobile/lib/i18n.ts`. Ningún label SHALL estar hardcodeado como string literal en los componentes.

Las keys consumidas pertenecen al namespace `nav.*` (cross-platform con web): `nav.dashboard`, `nav.movements`, `nav.home`, `nav.cards`, `nav.savings`, `nav.settings`, `nav.logout`, `nav.coming_soon`.

Las labels SHALL coincidir 1-a-1 con las del sidebar web. En particular, el item de tarjetas SHALL llamarse "Tarjetas" en ambas plataformas (no "Mis tarjetas").

#### Scenario: El TabBar no contiene strings literales

- **WHEN** un desarrollador inspecciona `apps/mobile/components/layout/TabBar.tsx`
- **THEN** los labels visibles se obtienen vía `t('nav.<key>')`
- **AND** no aparece ningún string en español ni inglés hardcodeado

#### Scenario: El AppMenu no contiene strings literales

- **WHEN** un desarrollador inspecciona `apps/mobile/components/layout/AppMenu.tsx`
- **THEN** los labels visibles se obtienen vía `t('nav.<key>')`
- **AND** los labels de Tarjetas, Ahorros, Configuración y Salir coinciden con `nav.cards`, `nav.savings`, `nav.settings` y `nav.logout` respectivamente

#### Scenario: Cards usa el mismo label que el sidebar web

- **WHEN** un usuario abre el `AppMenu` mobile
- **AND** otro usuario abre el sidebar web
- **THEN** el item de tarjetas se llama "Tarjetas" en ambos
- **AND** ninguna plataforma muestra "Mis tarjetas"

## MODIFIED Requirements

### Requirement: El tab bar diferencia visualmente la acción de menú de las pestañas de navegación

`apps/mobile` SHALL renderizar el cuarto slot del tab bar (la acción de abrir el menú) con un treatment visual distinto a las pestañas de navegación primaria. La composición de slots del tab bar SHALL ser, en orden:

1. **Inicio** (route `dashboard`) — pestaña habilitada.
2. **Movimientos** (route `movimientos`) — pestaña habilitada.
3. **Hogar** (route `home`) — pestaña **disabled** hasta que la capability `shared` se implemente (ver requirement "El tab bar puede mostrar slots en estado disabled").
4. **Botón de menú** — acción que abre el `AppMenu` (bottom sheet modal).

Reglas:

- Las pestañas habilitadas (slots 1 y 2) SHALL renderizarse como hoy: ícono + label vertical, ocupando ancho equitativo dentro del tab bar.
- El slot disabled (slot 3) SHALL respetar el treatment definido en la requirement de slots disabled.
- El slot de menú (slot 4) SHALL renderizarse como un botón circular sin label, claramente identificable como una acción (no como un destino navegable). El botón SHALL usar el color `--positive` (emerald) como fondo y un ícono blanco en su interior.
- El slot de menú SHALL mantenerse en la misma fila del tab bar (no ser un FAB flotante encima ni un botón en un header).
- "Tarjetas" NO SHALL aparecer como slot del tab bar; sigue navegable desde el `AppMenu` y vía deep link.
- El comportamiento funcional del botón de menú NO cambia: presionar abre el `AppMenu`.

#### Scenario: El tab bar contiene los 4 slots en el orden definido

- **WHEN** un usuario abre la app y observa el tab bar inferior
- **THEN** ve, de izquierda a derecha: Inicio, Movimientos, Hogar (disabled), Botón de menú
- **AND** no ve un slot llamado "Tarjetas"

#### Scenario: El cuarto slot se ve como botón, no como pestaña

- **WHEN** un usuario observa el tab bar
- **THEN** los primeros dos slots (Inicio, Movimientos) muestran ícono + label vertical en colores normales
- **AND** el tercer slot (Hogar) muestra ícono + label vertical pero atenuado, con badge "Próximamente"
- **AND** el cuarto slot muestra un botón circular con fondo emerald y un ícono blanco, sin label

#### Scenario: El botón de menú abre el AppMenu

- **WHEN** un usuario presiona el botón circular del cuarto slot
- **THEN** el `AppMenu` bottom sheet aparece desde la parte inferior de la pantalla

### Requirement: El AppMenu sheet aplica la paleta de marca

El componente `AppMenu` (bottom sheet modal abierto por el botón de menú) SHALL leer sus colores desde tokens (no literales hex). Al presionar un item del menú, el item SHALL mostrar un feedback visual breve con un tinte `--positive` translúcido como fondo activo, salvo el item destructivo "Salir" que SHALL mostrar un tinte `--error` translúcido.

El `Modal` que aloja al `AppMenu` SHALL configurarse con `statusBarTranslucent` y `navigationBarTranslucent` para que el overlay dim cubra la pantalla completa en Android (incluyendo status bar y nav bar del sistema).

El `AppMenu` SHALL contener los siguientes items en este orden:

1. **Tarjetas** (route `/tarjetas`) — item habilitado; al press cierra el sheet y navega a la ruta.
2. **Ahorros** — item **comingSoon** (no navegable hasta que la capability `savings` se implemente).
3. **Configuración** — item visible; al press cierra el sheet. La navegación efectiva a una pantalla mobile de settings es follow-up cuando la pantalla exista en mobile (hoy `apps/mobile/app/(app)/settings.tsx` no existe; la presencia del item comunica al usuario que la sección viene).
4. (divisor)
5. **Salir** — item destructivo que dispara `supabase.auth.signOut()`.

"Hogar" NO SHALL aparecer en el `AppMenu` (vive en el tab bar). "Mis tarjetas" NO SHALL aparecer como label (se renombra a "Tarjetas").

#### Scenario: El AppMenu contiene los items en el orden definido

- **WHEN** un usuario abre el `AppMenu`
- **THEN** ve, de arriba a abajo: Tarjetas, Ahorros (próximamente), Configuración, (divisor), Salir
- **AND** no ve un item llamado "Hogar"
- **AND** no ve un item llamado "Mis tarjetas"

#### Scenario: Press de un item muestra feedback emerald

- **WHEN** un usuario presiona el item "Tarjetas" en el `AppMenu`
- **THEN** el item muestra un fondo emerald translúcido durante el press

#### Scenario: Press del item Salir muestra feedback error

- **WHEN** un usuario presiona el item "Salir" en el `AppMenu`
- **THEN** el item muestra un fondo terracotta/error translúcido durante el press

#### Scenario: El overlay del menú cubre la pantalla completa en Android

- **WHEN** un usuario abre el `AppMenu` en un dispositivo Android
- **THEN** el dim del overlay se extiende detrás del status bar y la nav bar del sistema
- **AND** no queda ninguna franja del fondo de la app visible por encima ni por debajo del dim
