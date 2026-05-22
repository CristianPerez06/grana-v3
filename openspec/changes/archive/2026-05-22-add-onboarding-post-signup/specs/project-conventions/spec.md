## ADDED Requirements

### Requirement: Bimoneda por defecto — todo usuario arranca con ARS y USD habilitados

El sistema SHALL habilitar ambas monedas (ARS y USD) para todo usuario nuevo en el momento del alta, sin pedirle al usuario que opte por la segunda moneda. La decisión de NO ver USD SHALL ser un opt-out posterior desde el módulo `settings` (próxima change), no un opt-in en el onboarding.

Esto se traduce concretamente a:

- El trigger `on_auth_user_created_default_account` SHALL crear la cuenta `Billetera` con filas en `account_currencies` para ARS y USD, ambas con `initial_balance=0` (comportamiento ya existente, que se preserva).
- Toda cuenta creada en el wizard de onboarding (cuenta bancaria) SHALL incluir filas en `account_currencies` para ARS y USD por defecto.
- La pantalla `/onboarding/saldo-actual` SHALL pedir saldos en ARS y USD para todas las cuentas relevantes, sin preguntar previamente "¿manejás dólares?".
- La UI de la app SHALL mostrar columnas y totales por separado para ARS y USD por defecto, en línea con el principio cross-cutting "Bimoneda" (ARS y USD son ledgers separados, nunca se convierten).
- Cuando la próxima change del módulo `settings` agregue un toggle "ocultar USD" en preferencias del usuario, ese toggle SHALL afectar solo la presentación visual (esconder columnas USD, no mostrar el segundo input en formularios) y NO SHALL alterar las filas de `account_currencies` ni el ledger interno.

Este principio es complementario, no reemplazo, del principio "Bimoneda" listado en la tabla de cross-cutting principles del `CLAUDE.md` (que prohíbe convertir automáticamente entre ARS y USD). "Bimoneda por defecto" agrega: ARS+USD están habilitados por defecto para todos.

#### Scenario: Usuario nuevo tiene cuenta Billetera con ambas monedas tras signup

- **WHEN** un usuario completa el signup
- **THEN** existe en `accounts` una fila `Billetera` (tipo cash, propiedad del usuario)
- **AND** existen exactamente dos filas en `account_currencies` para esa cuenta: una con `currency_code='ARS', initial_balance=0` y otra con `currency_code='USD', initial_balance=0`

#### Scenario: Cuenta bancaria creada en onboarding tiene ambas monedas

- **WHEN** un usuario en `/onboarding/perfil` crea una cuenta bancaria
- **THEN** existen filas en `account_currencies` para ARS y USD asociadas a esa cuenta, ambas con `initial_balance=0`

#### Scenario: Saldo actual del onboarding pregunta ambas monedas sin precondición

- **WHEN** un usuario en `/onboarding/saldo-actual` ve el formulario
- **THEN** hay un input de monto para ARS y otro para USD (por cada cuenta visible en esa pantalla, según el modo)
- **AND** no hay pregunta previa tipo "¿manejás dólares?" que controle la visibilidad de los inputs USD
