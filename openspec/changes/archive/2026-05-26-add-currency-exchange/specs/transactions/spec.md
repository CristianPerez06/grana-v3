## ADDED Requirements

### Requirement: El usuario puede registrar un cambio de moneda (exchange)

El sistema SHALL permitir registrar un movimiento `type='exchange'` (en la UI: "Cambio") que representa una conversión entre monedas: sale un monto en una moneda de una cuenta y entra otro monto en otra moneda. Un exchange requiere: cuenta origen (`account_id`), monto origen (`amount` > 0) y moneda origen (`currency_code`); cuenta destino (`transfer_destination_account_id`), monto destino (`destination_amount` > 0) y moneda destino (`destination_currency`); y fecha. La descripción es opcional. Las monedas origen y destino MUST ser distintas. La cuenta destino MAY ser la misma que la origen (cambio intra-cuenta) o distinta. Solo cuentas `cash`/`bank` son elegibles (las tarjetas de crédito no aplican). Un exchange no tiene categoría, no es ingreso ni gasto, y no admite recurrencia.

#### Scenario: Comprar dólares entre dos cuentas

- **WHEN** el usuario registra un exchange con origen "Galicia" `$150.000 ARS` y destino "Caja USD" `US$100`
- **THEN** el sistema persiste un movimiento `type='exchange'` con `amount=150000`, `currency_code='ARS'`, `destination_amount=100`, `destination_currency='USD'`

#### Scenario: Comprar dólares dentro de la misma cuenta

- **WHEN** el usuario registra un exchange con origen y destino en la misma cuenta "Billetera" (`$150.000 ARS` → `US$100`)
- **THEN** el sistema lo acepta (la cuenta origen y destino pueden coincidir si las monedas difieren)

#### Scenario: Vender dólares

- **WHEN** el usuario registra un exchange con origen `US$100` y destino `$160.000 ARS`
- **THEN** el sistema persiste el movimiento con las monedas invertidas respecto a una compra

#### Scenario: Monedas iguales es rechazado

- **WHEN** el usuario intenta registrar un exchange con `currency_code = destination_currency`
- **THEN** la operación es rechazada (un cambio requiere monedas distintas)

#### Scenario: La cotización se deriva y no se persiste

- **WHEN** se muestra un exchange de `$150.000 ARS` por `US$100`
- **THEN** la cotización mostrada es `1.500` (`150000 / 100`), calculada al vuelo
- **AND** no existe ninguna columna persistida con la cotización del exchange

#### Scenario: Una cuenta de crédito no es elegible

- **WHEN** el usuario intenta usar una cuenta `type='credit'` como origen o destino de un exchange
- **THEN** el sistema no la ofrece como opción (las tarjetas son off-ledger)

### Requirement: El cambio de moneda impacta los saldos por moneda y no cuenta como ingreso ni gasto

El cálculo de saldos SHALL tratar un `exchange` restando `amount` del ledger de `currency_code` de la cuenta origen y sumando `destination_amount` al ledger de `destination_currency` de la cuenta destino. ARS y USD se calculan por separado y nunca se combinan. Un exchange NO SHALL contar como ingreso ni como gasto en ninguna métrica (no infla gasto/ingreso del mes).

#### Scenario: La pata de origen resta y la de destino suma

- **WHEN** existe un exchange origen "Galicia" `$150.000 ARS` → destino "Caja USD" `US$100`
- **THEN** el `disponible` ARS de "Galicia" baja `$150.000` y el `disponible` USD de "Caja USD" sube `US$100`

#### Scenario: Intra-cuenta mueve entre los dos buckets de la misma cuenta

- **WHEN** existe un exchange dentro de "Billetera" (`$150.000 ARS` → `US$100`)
- **THEN** el `disponible` ARS de "Billetera" baja `$150.000` y su `disponible` USD sube `US$100`
- **AND** ninguna otra cuenta cambia

#### Scenario: No aparece como gasto ni ingreso del mes

- **WHEN** el usuario revisa sus métricas de gasto e ingreso del mes
- **THEN** el exchange no figura en ninguna de las dos (no es plata que se gastó ni que entró)

### Requirement: El cambio de moneda dispara el aviso de saldo negativo en la pata de origen

Cuando un exchange dejaría el `disponible` de la cuenta origen (en la moneda origen) por debajo de 0, el sistema SHALL mostrar el aviso no bloqueante de saldo negativo antes de confirmar, igual que las demás salidas cash/bank. El aviso informa; no impide registrar.

#### Scenario: Comprar más de lo disponible avisa pero no bloquea

- **WHEN** "Galicia" tiene `disponible` ARS = `$100.000` y el usuario registra un exchange que saca `$150.000 ARS`
- **THEN** el sistema muestra el aviso de que "Galicia" queda en negativo
- **AND** permite registrar igual; el `disponible` ARS de "Galicia" queda en `-$50.000`

### Requirement: El usuario puede editar y eliminar un cambio de moneda

El sistema SHALL permitir editar los montos (origen y destino), la fecha y la descripción de un exchange; las cuentas y las monedas son inmutables vía edición (como en transferencias). El sistema SHALL permitir eliminar un exchange. Editar o eliminar recalcula los saldos de ambos ledgers afectados.

#### Scenario: Editar los montos recalcula ambos ledgers

- **WHEN** el usuario edita un exchange y cambia el monto origen y/o destino
- **THEN** los `disponible` de la moneda origen y de la moneda destino se recalculan según los nuevos montos

#### Scenario: Eliminar un cambio recalcula ambos ledgers

- **WHEN** el usuario elimina un exchange
- **THEN** el `disponible` de la moneda origen vuelve a subir `amount` y el de la moneda destino vuelve a bajar `destination_amount`
