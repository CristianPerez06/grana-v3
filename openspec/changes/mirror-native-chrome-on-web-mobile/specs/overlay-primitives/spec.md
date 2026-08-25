## MODIFIED Requirements

### Requirement: Drawer lateral con scrim y cierre estándar

El sistema SHALL proveer un primitivo `Drawer` (web y mobile, props compartidos vía `@grana/ui-contracts`) que presente un panel deslizante sobre un scrim semitransparente. El Drawer SHALL ser controlado (`open` + `onClose`). El Drawer SHALL cerrarse al hacer click en el scrim y al presionar Esc (web). Mientras está abierto, SHALL atrapar el foco y, al cerrarse, SHALL devolver el foco al elemento que lo abrió (web). El contenido del panel SHALL poder scrollear sin mover el scrim.

**Presentación por breakpoint (web).** El panel SHALL presentarse de dos formas según el ancho del viewport:

- **En `md` y hacia arriba**: panel lateral anclado al lado indicado por `side` (default derecha), de alto completo y ancho `widthPx`.
- **Bajo `md`**: **bottom sheet** anclado al borde inferior, de ancho completo, con las esquinas superiores redondeadas, un grabber visual en el tope, alto que se ajusta al contenido con un tope de 90dvh, y un padding inferior igual a `max(8px, env(safe-area-inset-bottom))`. Las props `side` y `widthPx` SHALL ignorarse en este ancho.

El cambio de presentación SHALL ser interno al primitivo: `DrawerProps` no cambia y los consumidores no SHALL necesitar editarse ni pasar props nuevas para obtener la presentación correcta en cada ancho.

Un `Drawer` abierto bajo `md` SHALL renderizarse por encima de la tab bar del shell, no por debajo ni desplazándola.

#### Scenario: Abrir y cerrar por scrim

- **WHEN** el host setea `open = true`
- **THEN** el panel entra deslizándose sobre el scrim
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

#### Scenario: Bajo `md` el panel sube desde abajo

- **WHEN** un consumidor renderiza `<Drawer open side="right" widthPx={528}>` en un viewport de 375px
- **THEN** el panel se ancla al borde inferior y ocupa el ancho completo
- **AND** las esquinas superiores están redondeadas y hay un grabber en el tope
- **AND** el alto se ajusta al contenido sin superar 90dvh
- **AND** las props `side` y `widthPx` no tienen efecto

#### Scenario: En `md` y hacia arriba el panel sigue siendo lateral

- **WHEN** el mismo consumidor se renderiza en un viewport de 1280px
- **THEN** el panel se ancla al lado indicado por `side` con ancho `widthPx` y alto completo

#### Scenario: Cambiar la presentación no obliga a tocar consumidores

- **WHEN** un desarrollador compara el código de los consumidores de `Drawer` antes y después del cambio de presentación
- **THEN** ninguno pasa props nuevas ni condiciona por breakpoint
- **AND** `DrawerProps` es el mismo tipo que antes

#### Scenario: El sheet queda por encima de la tab bar

- **WHEN** un `Drawer` se abre en un viewport de 375px en una ruta que muestra tab bar
- **THEN** el panel se renderiza por encima de la tab bar
- **AND** la tab bar no se desplaza ni cambia de tamaño

#### Scenario: Un popover anidado sigue pudiendo scrollear dentro del sheet

- **WHEN** un consumidor que portalea su contenido dentro del panel vía `useDrawerContainer()` se abre en viewport de 375px
- **THEN** el contenido portaleado aterriza dentro del sheet, no en `document.body`
- **AND** el scroll-lock de `react-remove-scroll` permite scrollearlo
