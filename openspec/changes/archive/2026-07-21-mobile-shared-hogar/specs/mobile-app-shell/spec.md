## MODIFIED Requirements

### Requirement: El tab bar diferencia visualmente la acción de menú de las pestañas de navegación

`apps/mobile` SHALL renderizar el cuarto slot del tab bar (la acción de abrir el menú) con un treatment visual distinto a las pestañas de navegación primaria. La composición de slots del tab bar SHALL ser, en orden:

1. **Inicio** (route `dashboard`) — pestaña habilitada.
2. **Movimientos** (route `transactions`) — pestaña habilitada.
3. **Hogar** (route `home`) — pestaña **habilitada**: navega al módulo Compartido (ver capability `shared`). La pantalla `home` NO SHALL renderizar un placeholder; el badge "Próximamente" NO SHALL mostrarse sobre este slot.
4. **Botón de menú** — acción que abre el `AppMenu` (bottom sheet modal).

Reglas:

- Las pestañas habilitadas (slots 1, 2 y 3) SHALL renderizarse como hoy: ícono + label vertical, ocupando ancho equitativo dentro del tab bar.
- El slot de menú (slot 4) SHALL renderizarse como un botón circular sin label, claramente identificable como una acción (no como un destino navegable). El botón SHALL usar el color `--positive` (emerald) como fondo y un ícono blanco en su interior.
- El slot de menú SHALL mantenerse en la misma fila del tab bar (no ser un FAB flotante encima ni un botón en un header).
- "Tarjetas" NO SHALL aparecer como slot del tab bar; sigue navegable desde el `AppMenu` y vía deep link.
- El comportamiento funcional del botón de menú NO cambia: presionar abre el `AppMenu`.
- Las subpantallas de Compartido (setup, saldar, configuración, cuenta corriente) se pushean chromeless desde el tab Hogar; sus segmentos de ruta SHALL registrarse en la detección de chromeless del tab bar (ver capability `shared`).

Los nombres de archivo bajo `apps/mobile/app/(app)/` SHALL estar en inglés (`transactions.tsx`, `cards.tsx`, etc.), alineados con la regla "código en inglés" definida en `project-conventions`. La etiqueta visible al usuario ("Movimientos", "Tarjetas") se resuelve via `@grana/i18n-messages` y es independiente del nombre del archivo.

#### Scenario: El tab bar contiene los 4 slots en el orden definido

- **WHEN** un usuario abre la app y observa el tab bar inferior
- **THEN** ve, de izquierda a derecha: Inicio, Movimientos, Hogar, Botón de menú
- **AND** no ve un slot llamado "Tarjetas"
- **AND** el slot Hogar se ve habilitado (sin badge "Próximamente")

#### Scenario: El cuarto slot se ve como botón, no como pestaña

- **WHEN** un usuario observa el tab bar
- **THEN** los primeros tres slots (Inicio, Movimientos, Hogar) muestran ícono + label vertical en colores normales
- **AND** el cuarto slot muestra un botón circular con fondo emerald y un ícono blanco, sin label

#### Scenario: El tab Hogar navega al módulo Compartido

- **WHEN** un usuario presiona el slot Hogar
- **THEN** navega a la pantalla `home`, que renderiza el módulo Compartido (uno de sus tres estados)
- **AND** no ve un placeholder de texto ni una pantalla vacía

#### Scenario: El botón de menú abre el AppMenu

- **WHEN** un usuario presiona el botón circular del cuarto slot
- **THEN** el `AppMenu` bottom sheet aparece desde la parte inferior de la pantalla

### Requirement: El AppMenu sheet aplica la paleta de marca

El componente `AppMenu` (bottom sheet modal abierto por el botón de menú) SHALL leer sus colores desde tokens (no literales hex). Al presionar un item del menú, el item SHALL mostrar un feedback visual breve con un tinte `--positive` translúcido como fondo activo, salvo el item destructivo "Salir" que SHALL mostrar un tinte `--error` translúcido.

El `Modal` que aloja al `AppMenu` SHALL configurarse con `statusBarTranslucent` y `navigationBarTranslucent` para que el overlay dim cubra la pantalla completa en Android (incluyendo status bar y nav bar del sistema).

El `AppMenu` SHALL contener los siguientes items en este orden:

1. **Tarjetas** (route `/cards`) — item habilitado; al press cierra el sheet y navega a la ruta.
2. **Configuración** (route `/(app)/settings`) — item habilitado; al press cierra el sheet y navega a `/(app)/settings`. La pantalla destino existe y entrega las tres secciones de paridad con web (Visualización, Idioma, Categorías).
3. (divisor)
4. **Salir** — item destructivo que dispara `supabase.auth.signOut()`.

"Ahorros" NO SHALL aparecer en el `AppMenu`: la capability `savings` no está en el roadmap por ahora, así que el item comingSoon se retira en lugar de anunciar una feature que no llega. "Hogar" NO SHALL aparecer en el `AppMenu` (vive en el tab bar). "Mis tarjetas" NO SHALL aparecer como label (se renombra a "Tarjetas").

#### Scenario: El AppMenu contiene los items en el orden definido

- **WHEN** un usuario abre el `AppMenu`
- **THEN** ve, de arriba a abajo: Tarjetas, Configuración, (divisor), Salir
- **AND** no ve un item llamado "Ahorros"
- **AND** no ve un item llamado "Hogar"
- **AND** no ve un item llamado "Mis tarjetas"

#### Scenario: Press del item Configuración navega a /settings

- **WHEN** un usuario presiona el item "Configuración" en el `AppMenu`
- **THEN** el sheet del menú se cierra
- **AND** la app navega a `/(app)/settings`
- **AND** la pantalla destino renderea el `PageHeader` con título "Configuración" y las tres secciones (Visualización, Idioma, Categorías)

#### Scenario: Press de un item muestra feedback emerald

- **WHEN** un usuario presiona el item "Tarjetas" en el `AppMenu`
- **THEN** el item muestra un fondo emerald translúcido durante el press

#### Scenario: Press del item Salir muestra feedback error

- **WHEN** un usuario presiona el item "Salir" en el `AppMenu`
- **THEN** el item muestra un fondo terracotta/error translúcido durante el press
