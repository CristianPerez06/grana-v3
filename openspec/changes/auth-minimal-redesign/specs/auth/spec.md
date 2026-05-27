## MODIFIED Requirements

### Requirement: El route group de auth tiene un layout dedicado

Las rutas `/login`, `/signup`, `/signup/verify`, `/forgot-password`, `/forgot-password/verify` y `/reset-password` SHALL compartir un único shell de auth dedicado al grupo `(auth)`, distinto del shell del grupo `(app)`. El shell SHALL renderizar una **tarjeta centrada minimalista** sobre un fondo limpio (`bg-page`): una tarjeta blanca, centrada vertical y horizontalmente, que contiene en este orden el `GranaLogo` (wordmark navy + badge esmeralda), el título, el subtítulo opcional y el contenido de la página (formulario y links). El shell SHALL NOT renderizar el header navy de borde curvo (eliminado en este change) ni el header de logout propio del shell de `(app)`. El layout del dashboard SHALL NOT renderizarse para estas rutas.

En viewports `sm` y mayores la tarjeta SHALL mostrarse con hairline (`border-border`) y sombra suave; bajo `sm` (mobile) la tarjeta SHALL renderizarse sin borde ni sombra y a todo el ancho disponible, fundiéndose con el fondo limpio.

#### Scenario: Login usa el shell de auth

- **WHEN** un usuario navega a `/login`
- **THEN** la página se renderiza dentro del shell de auth (tarjeta centrada con el logo de Grana arriba, sin header de logout)

#### Scenario: Dashboard usa el shell de app

- **WHEN** un usuario autenticado navega a `/dashboard`
- **THEN** la página se renderiza dentro del layout `(app)` (header con logout, sin tarjeta centrada)

#### Scenario: El shell de auth muestra la marca Grana dentro de la tarjeta

- **WHEN** se renderiza cualquier ruta del grupo `(auth)`
- **THEN** el `GranaLogo` aparece centrado dentro de la tarjeta, por encima del título
- **AND** no se renderiza ningún header navy de borde curvo

#### Scenario: La tarjeta es cardless en mobile y tarjeta en desktop

- **WHEN** se renderiza una ruta de `(auth)` en un viewport bajo `sm`
- **THEN** el contenido se muestra a todo el ancho, sin borde ni sombra de tarjeta
- **WHEN** se renderiza en un viewport `sm` o mayor
- **THEN** el contenido se muestra dentro de una tarjeta blanca con hairline y sombra suave
