## MODIFIED Requirements

### Requirement: El sistema garantiza que el nombre de tarjeta autogenerado se compone de red y banco

(MODIFICA el mismo requirement: el escenario "tarjeta default novato" se reescribe a un alta genérica sin nombre ni banco. También se ajusta el `Purpose` del master spec, que menciona "el alta de tarjeta en modos novato y experto" → "el alta de tarjeta" con su único flujo de cuatro fechas.)

Cuando el usuario crea una tarjeta sin especificar `name` (campo opcional), el sistema SHALL generar uno usando el formato `"<network.name> <institution.name>"` si ambos están definidos; si solo hay institución, usa `"Tarjeta <institution.name>"`; si solo hay red, usa `"<network.name>"`; si ninguno, usa `"Mi tarjeta"`.

#### Scenario: Alta sin nombre con red y banco completos

- **WHEN** un usuario crea una tarjeta sin completar el campo nombre, con red "Visa" y banco "Galicia"
- **THEN** `accounts.name` se popula con `"Visa Galicia"`

#### Scenario: Alta sin nombre y sin banco

- **WHEN** un usuario crea una tarjeta sin completar nombre, red ni banco
- **THEN** `accounts.name` se popula con `"Mi tarjeta"`
