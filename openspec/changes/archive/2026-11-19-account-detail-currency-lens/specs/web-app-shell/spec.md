## MODIFIED Requirements

### Requirement: La acción de crear de una ruta vive en su header, no en un FAB

El único botón flotante del producto SHALL ser el de **registrar un movimiento** (`QuickAddFab`), y SHALL aparecer únicamente en las tres raíces de tab —`/dashboard`, `/transactions` y `/shared`— y en el **detalle de una cuenta** (`/accounts/[id]`). El detalle de cuenta es la excepción deliberada: lista movimientos, registrar uno es justamente la acción del `QuickAddFab`, y ahí el formulario se abre con esa cuenta preseleccionada; en desktop el mismo alta vive en la fila del título de su lista («+ Agregar»), igual que el dashboard lo tiene en su header. No es la creación de la entidad de una ruta del menú —crear una cuenta, una tarjeta, una categoría o una recurrencia— que sigue la regla de abajo.

La acción de crear la entidad que una ruta lista —una cuenta, una tarjeta, una categoría, una subcategoría, una recurrencia— SHALL renderizarse en el slot `actions` del `PageHeader` de esa ruta, **visible en todos los anchos**. NO SHALL alternarse entre un botón de header en desktop y un FAB en mobile.

El fundamento es el mismo que sostiene el resto de esta capability: la acción primaria de una ruta es parte de su chrome, y el chrome no cambia de forma según el viewport. Espeja además lo que hace `apps/mobile`, donde ninguna sección alcanzada desde el menú tiene FAB, salvo el mismo detalle de cuenta.

Mientras la acción no está disponible (catálogos cargando), el botón SHALL renderizarse `disabled`, no ausente — igual que el resto del chrome del header.

#### Scenario: Crear una cuenta se ofrece desde el header en mobile

- **WHEN** un usuario abre `/accounts` en un viewport de 375px
- **THEN** el header muestra el botón de crear cuenta en su slot `actions`, arriba a la derecha
- **AND** NO se renderiza ningún botón flotante sobre el contenido

#### Scenario: El botón de crear no cambia de forma al ensanchar el viewport

- **WHEN** el mismo usuario ensancha el viewport por encima de `md`
- **THEN** el botón sigue siendo el mismo elemento en el mismo slot
- **AND** no aparece ni desaparece ningún control

#### Scenario: El FAB de movimientos sobrevive donde corresponde

- **WHEN** un usuario abre `/dashboard`, `/transactions`, `/shared` o el detalle de una cuenta en un viewport de 375px
- **THEN** el `QuickAddFab` se renderiza flotante, despejado de la tab bar (en el detalle de cuenta, con la cuenta preseleccionada)
- **AND** es el único botón flotante de toda la app

#### Scenario: Cargando, el botón está pero deshabilitado

- **WHEN** un usuario abre `/cards` y el catálogo de bancos y redes todavía no resolvió
- **THEN** el botón de agregar tarjeta se renderiza en el header en estado `disabled`
- **AND** no aparece de la nada cuando la data llega
