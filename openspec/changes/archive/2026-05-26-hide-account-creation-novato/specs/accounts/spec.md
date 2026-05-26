## ADDED Requirements

### Requirement: En modo novato la creación de cuentas no está disponible en la UI

En modo `novato`, la UI NO SHALL ofrecer la creación de cuentas: el punto de entrada ("Crear cuenta") no se muestra ni en el listado de cuentas ni en el estado vacío, y la ruta de creación redirige al listado. El modo es solo-UI: el server action de creación NO se modifica ni se gatea por modo. Crear cuentas adicionales es una capacidad del modo `experto`. (El nudge para sugerir pasar a experto y la ubicación del cambio de modo en el menú quedan fuera de alcance de este requirement.)

#### Scenario: El novato no ve el botón de crear cuenta

- **WHEN** un usuario en modo `novato` abre el listado de cuentas
- **THEN** no ve la acción "Crear cuenta" (ni en el header del listado ni en el estado vacío)

#### Scenario: El experto sí ve el botón de crear cuenta

- **WHEN** un usuario en modo `experto` abre el listado de cuentas
- **THEN** ve la acción "Crear cuenta"

#### Scenario: El novato que navega a la ruta de creación es redirigido

- **WHEN** un usuario en modo `novato` navega directamente a `/accounts/new`
- **THEN** el sistema lo redirige al listado de cuentas sin permitir el alta

#### Scenario: El gating es solo de UI

- **WHEN** se considera la creación de cuentas a nivel de server action
- **THEN** el comportamiento del server action no cambia según el modo (el modo no se enforcea en el servidor; el gating vive solo en la UI)
