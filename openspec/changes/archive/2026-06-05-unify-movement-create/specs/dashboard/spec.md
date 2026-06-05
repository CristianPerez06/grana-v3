## MODIFIED Requirements

### Requirement: El header del dashboard ofrece un acceso primario para registrar un movimiento (web)

En web **desktop** (viewport `≥sm`), el header del dashboard SHALL incluir un botón primario "Nuevo movimiento" (estilo `positive`/emerald) que, al activarse, **abre el drawer de creación de movimiento** sobre el dashboard (invoca `useMovementDrawer().openCreate()`), sin navegación a otra ruta. El label del botón SHALL leerse del catálogo i18n (no hardcodeado). En web **mobile** (viewport `<sm`), el botón NO SHALL renderizarse en el header: el acceso primario en ese viewport es el FAB definido en la spec de `transactions` (mobile-only en web). En la app nativa este acceso NO es parte del header del dashboard; en native el acceso primario es el FAB nativo definido en la spec de `transactions`.

Mientras el header esté en su estado de carga (ver requirement del saludo) **o el `MovementDrawerProvider` aún no esté disponible** (queries `accounts/categories/household` cargadas por `MovementDrawerLoader` aún pendientes), el botón "Nuevo movimiento" — cuando se renderice en el viewport activo — SHALL renderizarse en estado **disabled**: SHALL aparecer con su tipografía e ícono completos pero sin handler de click activo (sin envolver un `<Link>` ni equivalente navegable) y SHALL no responder a clicks. Cuando el header sale del estado de carga **y** el provider está listo, el botón SHALL pasar a su rendering normal: un `<Button>` que al click invoca `useMovementDrawer().openCreate()`.

#### Scenario: El botón abre el drawer de creación de movimiento (desktop-web)

- **WHEN** un usuario web en viewport `≥sm` toca "Nuevo movimiento" en el header del dashboard una vez habilitado
- **THEN** se abre el drawer de creación de movimiento sobre el dashboard sin navegación
- **AND** el dashboard permanece visible detrás del scrim

#### Scenario: El label del botón es traducible

- **WHEN** un desarrollador inspecciona el botón "Nuevo movimiento"
- **THEN** su label se obtiene del catálogo i18n, sin string hardcodeado

#### Scenario: El botón se renderiza disabled mientras el header carga (desktop-web)

- **WHEN** el header del dashboard está en su estado de carga en viewport `≥sm` (query del nombre sin resolver)
- **THEN** "Nuevo movimiento" se muestra con su label e ícono pero deshabilitado
- **AND** no responde a clicks
- **AND** NO envuelve a un `<Link>` ni invoca el drawer (no es accionable mientras está disabled)

#### Scenario: El botón se renderiza disabled mientras el drawer no está listo (desktop-web)

- **WHEN** el header del dashboard ya cargó su saludo pero el `MovementDrawerProvider` aún no está disponible en viewport `≥sm`
- **THEN** "Nuevo movimiento" se muestra con su label e ícono pero deshabilitado (estado disabled estándar del componente `Button`)
- **AND** no responde a clicks (no abre el drawer ni navega a ninguna URL)
- **AND** cuando el provider resuelve, el botón pasa a habilitado

#### Scenario: El botón no se renderiza en mobile-web

- **WHEN** un usuario web en viewport `<sm` abre `/dashboard`
- **THEN** el header NO contiene el botón "Nuevo movimiento" en ningún estado (loading o habilitado)
- **AND** el acceso primario para registrar un movimiento en ese viewport es el FAB definido en la spec de `transactions`
