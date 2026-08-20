## MODIFIED Requirements

### Requirement: El usuario puede editar una instancia antes de confirmarla

El sistema SHALL permitir editar los campos mutables de una instancia recurrente pendiente antes de confirmarla. Los cambios de fecha, descripcion, categoria, subcategoria y **cuenta** SHALL aplicar a la instancia puntual. Si el usuario modifica el monto, el sistema SHALL actualizar tambien el monto de la regla recurrente.

El cambio de **cuenta** SHALL ser un override de la instancia puntual y NO SHALL propagarse a la regla recurrente: las instancias futuras se siguen generando con la cuenta de la regla. Es la diferencia deliberada con el monto — usar otro medio de pago una vez no redefine el medio por defecto.

La confirmación SHALL registrar la transacción real en la cuenta efectiva de la instancia, y SHALL derivar el tipo de movimiento resultante del tipo de esa cuenta: una cuenta de crédito produce un consumo de tarjeta (con su asignación de período), una cuenta cash/bank produce un movimiento on-ledger. La instancia confirmada SHALL conservar la cuenta con la que se confirmó, no la de la regla.

Una cuenta SHALL ser elegible para una instancia solo si pertenece al usuario, está activa, tiene **activa la moneda de la instancia** y es compatible con el tipo funcional de la regla: los ingresos y el origen de una transferencia NO SHALL admitir cuentas de crédito, y el origen de una transferencia NO SHALL ser su cuenta destino. El sistema SHALL revalidar la elegibilidad al confirmar, no solo al ofrecer las opciones.

Cuando la cuenta de la regla está archivada, el sistema SHALL permitir resolver la instancia eligiendo otra cuenta elegible, sin exigir editar la regla previamente.

#### Scenario: Editar fecha de consumo recurrente de tarjeta

- **WHEN** el usuario cambia la fecha de una instancia pendiente de tarjeta
- **THEN** la confirmacion usa la nueva fecha para asignar el `card_period_id`

#### Scenario: Editar monto y actualizar regla

- **WHEN** el usuario cambia el monto de una instancia pendiente
- **THEN** la instancia se confirma con el nuevo monto
- **AND** las futuras instancias de la regla se generan con ese nuevo monto

#### Scenario: Editar la cuenta no cambia la regla

- **WHEN** el usuario confirma una instancia de una regla de gasto en la cuenta "Santander" eligiendo la cuenta "Efectivo"
- **THEN** el movimiento real se registra en "Efectivo"
- **AND** la regla recurrente sigue teniendo "Santander" como cuenta
- **AND** la próxima instancia generada se propone en "Santander"

#### Scenario: Cambiar de cuenta a tarjeta convierte la confirmación en consumo de tarjeta

- **WHEN** el usuario confirma una instancia de gasto de una regla en cuenta bancaria eligiendo una tarjeta de crédito
- **THEN** el movimiento se registra como consumo de esa tarjeta, con `card_period_id` asignado por la fecha de la instancia
- **AND** el `disponible` de las cuentas no cambia (la tarjeta es off-ledger)

#### Scenario: Solo se ofrecen cuentas con la moneda de la instancia activa

- **WHEN** el usuario abre el selector de cuenta de una instancia en USD
- **THEN** el selector lista únicamente cuentas activas con USD activo
- **AND** confirmar con una cuenta sin esa moneda activa es rechazado con un mensaje explicativo

#### Scenario: Una instancia de ingreso no admite tarjeta de crédito

- **WHEN** el usuario abre el selector de cuenta de una instancia de ingreso
- **THEN** el selector no ofrece cuentas de crédito

#### Scenario: Confirmar una instancia cuya regla apunta a una cuenta archivada

- **WHEN** la cuenta de la regla está archivada y el usuario elige otra cuenta elegible en la instancia pendiente
- **THEN** la confirmación se registra en la cuenta elegida
- **AND** no se le exige editar la regla antes de confirmar

#### Scenario: La instancia confirmada conserva la cuenta usada

- **WHEN** el usuario confirma una instancia eligiendo una cuenta distinta a la de la regla
- **THEN** el historial de instancias de la regla muestra esa instancia con la cuenta con la que se confirmó
