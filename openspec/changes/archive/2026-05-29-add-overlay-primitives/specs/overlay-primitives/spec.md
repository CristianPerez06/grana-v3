# Delta — Primitivos de overlay

## ADDED Requirements

### Requirement: Drawer lateral con scrim y cierre estándar

El sistema SHALL proveer un primitivo `Drawer` (web y mobile, props compartidos vía `@grana/ui-contracts`) que presente un panel deslizante anclado a un lado de la pantalla (default derecha) sobre un scrim semitransparente. El Drawer SHALL ser controlado (`open` + `onClose`). El Drawer SHALL cerrarse al hacer click en el scrim y al presionar Esc (web). Mientras está abierto, SHALL atrapar el foco y, al cerrarse, SHALL devolver el foco al elemento que lo abrió (web). El contenido del panel SHALL poder scrollear sin mover el scrim.

#### Scenario: Abrir y cerrar por scrim

- **WHEN** el host setea `open = true`
- **THEN** el panel entra deslizándose desde el lado configurado sobre el scrim
- **WHEN** el usuario hace click en el scrim
- **THEN** el Drawer invoca `onClose`

#### Scenario: Cerrar con Esc (web)

- **WHEN** el Drawer está abierto y el usuario presiona Esc
- **THEN** el Drawer invoca `onClose`

#### Scenario: Foco gestionado

- **WHEN** el Drawer se abre
- **THEN** el foco entra al panel y queda atrapado dentro mientras está abierto
- **WHEN** el Drawer se cierra
- **THEN** el foco vuelve al trigger que lo abrió

### Requirement: Popover anclado con cierre por afuera, scroll y Esc

El sistema SHALL proveer un primitivo `Popover` controlado que renderee su contenido anclado a un elemento trigger, posicionado debajo del ancla y reposicionado arriba si no entra en el viewport (clamp a los bordes). El Popover SHALL cerrarse al hacer click fuera de él, al presionar Esc y al scrollear el contenedor que lo aloja. Su contenido SHALL tener `max-height` con scroll interno cuando excede el alto disponible.

#### Scenario: Posicionamiento bajo el ancla con flip

- **WHEN** el Popover se abre y hay espacio debajo del ancla
- **THEN** se posiciona debajo del ancla
- **WHEN** no hay espacio suficiente debajo
- **THEN** se posiciona arriba del ancla, dentro del viewport

#### Scenario: Cierre por click afuera, Esc y scroll

- **WHEN** el Popover está abierto y el usuario hace click fuera de su contenido
- **THEN** invoca `onClose`
- **WHEN** el usuario presiona Esc
- **THEN** invoca `onClose`
- **WHEN** el contenedor que aloja el ancla scrollea
- **THEN** invoca `onClose`

### Requirement: Segmented control de selección única con opciones deshabilitables

El sistema SHALL proveer un primitivo `Segmented` controlado (`value` + `onValueChange`) que muestre N opciones en un grupo, con exactamente una activa. La opción activa SHALL distinguirse visualmente (superficie elevada). Cada opción SHALL poder marcarse `disabled` individualmente, y una opción deshabilitada SHALL NO invocar `onValueChange` al interactuarla.

#### Scenario: Seleccionar una opción

- **WHEN** el usuario interactúa una opción no activa y habilitada
- **THEN** `Segmented` invoca `onValueChange` con el value de esa opción

#### Scenario: Opción deshabilitada no cambia la selección

- **WHEN** una opción está `disabled` y el usuario la interactúa
- **THEN** `Segmented` no invoca `onValueChange` y la selección no cambia

### Requirement: Switch on/off controlado

El sistema SHALL proveer un primitivo `Switch` controlado (`checked` + `onValueChange`) con estilo on/off, donde el estado `on` use el color de acento positivo del design system. El Switch SHALL exponer `role=switch` con `aria-checked` (web) y SHALL respetar `disabled` (no invoca `onValueChange`).

#### Scenario: Alternar el switch

- **WHEN** el usuario interactúa un Switch habilitado en estado off
- **THEN** invoca `onValueChange(true)`

#### Scenario: Switch deshabilitado

- **WHEN** el Switch está `disabled` y el usuario lo interactúa
- **THEN** no invoca `onValueChange`
