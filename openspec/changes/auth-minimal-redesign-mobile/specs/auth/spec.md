## MODIFIED Requirements

### Requirement: El route group de auth tiene un layout dedicado

Las rutas/pantallas del grupo `(auth)` (`login`, `signup`, `signup-verify`/`signup/verify`, `forgot-password`, `recovery-verify`/`forgot-password/verify`, `reset-password`/`new-password`) SHALL compartir un shell de auth dedicado, distinto del shell del grupo `(app)`, en ambas plataformas. El shell SHALL renderizar una **tarjeta centrada minimalista**: el `GranaLogo` (wordmark navy + badge esmeralda) centrado arriba, el título, el subtítulo opcional y el contenido de la pantalla (formulario y links) debajo. El shell SHALL NOT renderizar el header navy de borde curvo (eliminado en este rediseño) ni el header de logout propio del shell de `(app)`.

- **Web:** sobre `bg-page`, una tarjeta blanca centrada vertical y horizontalmente; bajo `sm` se muestra sin borde ni sombra y a todo el ancho (se funde con el fondo), y en `sm` o mayor se muestra como tarjeta con hairline (`border-border`) + sombra suave.
- **Mobile (app):** a ancho de teléfono el shell es siempre cardless — contenido centrado directamente sobre `bg-page`, sin borde ni sombra, dentro de un `KeyboardAvoidingView` + `ScrollView` para que el teclado no tape el formulario.

#### Scenario: Las rutas de auth usan el shell de auth dedicado

- **WHEN** un usuario navega a cualquier ruta/pantalla del grupo `(auth)`
- **THEN** se renderiza dentro del shell de auth (contenido centrado con el `GranaLogo` arriba), sin header de logout

#### Scenario: Dashboard usa el shell de app

- **WHEN** un usuario autenticado navega a `/dashboard`
- **THEN** la página se renderiza dentro del layout `(app)` (header con logout, sin el shell de auth)

#### Scenario: El shell de auth muestra la marca Grana

- **WHEN** se renderiza cualquier ruta/pantalla del grupo `(auth)`
- **THEN** el `GranaLogo` aparece dentro del shell, por encima del título
- **AND** no se renderiza ningún header navy de borde curvo

#### Scenario: Responsive de la tarjeta en web (web)

- **WHEN** se renderiza una ruta de `(auth)` en web en un viewport bajo `sm`
- **THEN** el contenido se muestra a todo el ancho, sin borde ni sombra de tarjeta
- **WHEN** se renderiza en un viewport `sm` o mayor
- **THEN** el contenido se muestra dentro de una tarjeta blanca con hairline y sombra suave

#### Scenario: El shell mobile es cardless y centrado (mobile)

- **WHEN** se renderiza una pantalla de `(auth)` en la app mobile
- **THEN** el contenido se muestra centrado sobre `bg-page`, sin borde ni sombra de tarjeta
- **AND** queda envuelto en `KeyboardAvoidingView` + `ScrollView`, de modo que abrir el teclado no tapa el formulario
