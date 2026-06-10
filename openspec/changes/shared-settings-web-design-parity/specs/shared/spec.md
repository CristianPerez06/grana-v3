## MODIFIED Requirements

### Requirement: El usuario puede ver el dashboard del hogar

El sistema SHALL ofrecer una pantalla de hogar que muestre el balance de deuda por moneda en lenguaje claro ("le debés a X", "X te debe" o "están al día"), un acceso a saldar deuda cuando hay deuda viva, la lista de gastos compartidos recientes con la porción propia de cada uno, y los **integrantes del hogar**: el nombre de cada miembro con su rol — el propio usuario marcado como "Vos" y el otro como "Miembro". El bloque de integrantes SHALL derivarse de los datos que el hogar ya provee (`getHousehold()`), sin introducir query, dato ni comportamiento nuevo; es una reorganización visual de información existente.

#### Scenario: Dashboard con deuda a favor

- **WHEN** B le debe dinero a A y A abre el dashboard del hogar
- **THEN** A ve "X te debe $…" por la moneda correspondiente y la lista de gastos compartidos recientes

#### Scenario: Dashboard al día

- **WHEN** no hay deuda neta en ninguna moneda
- **THEN** el dashboard muestra "están al día" y no ofrece el acceso a saldar deuda

#### Scenario: El dashboard muestra los integrantes del hogar

- **WHEN** un hogar activo de dos miembros y un usuario abre el dashboard
- **THEN** ve el bloque de integrantes con el nombre de cada miembro del hogar
- **AND** su propio registro aparece marcado como "Vos" y el otro como "Miembro"
