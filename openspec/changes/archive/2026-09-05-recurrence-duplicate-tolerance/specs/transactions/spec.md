## MODIFIED Requirements

### Requirement: El sistema avisa cuando una regla recurrente duplica una existente

Al crear una regla recurrente —desde cero o desde un movimiento— el sistema SHALL detectar si el usuario ya tiene una regla **activa** con la misma `(account_id, currency_code, movement_type)` y un monto **igual o casi igual** (diferencia relativa de hasta el 1 % del mayor de los dos, inclusive), y SHALL avisarlo antes de confirmar, identificando la regla existente por su título visible y su próxima fecha. La tolerancia existe porque el duplicado real no siempre es exacto: una cuota recalculada, un redondeo o un tipeo dejan dos montos distintos por centavos que son la misma obligación (caso real: 48.733,92 y 48.723,04 del mismo préstamo).

El aviso SHALL ser **no bloqueante**: dos reglas con esos mismos campos pueden ser legítimamente distintas (dos suscripciones del mismo precio en la misma tarjeta), y la clave de detección deliberadamente ignora categoría y descripción porque en los duplicados reales esos campos difieren. El usuario SHALL poder confirmar la creación de todos modos.

El hub de recurrencias SHALL además señalar las reglas activas que colisionan con otra bajo esa misma clave, para que el usuario pueda resolverlas. La señalización SHALL ser informativa: el sistema NO SHALL eliminar, pausar ni fusionar reglas automáticamente.

El aviso al crear y la señalización en el hub SHALL existir en web y en la app nativa por igual, con la misma clave y la misma tolerancia (`@grana/recurrences`).

#### Scenario: Aviso al crear una regla que colisiona

- **WHEN** el usuario crea una regla de gasto de `$450.000 ARS` en la cuenta "MP" y ya tiene una regla activa de gasto de `$450.000 ARS` en esa misma cuenta
- **THEN** el sistema avisa que ya existe una regla equivalente, mostrando su título y su próxima fecha
- **AND** permite confirmar la creación de todos modos

#### Scenario: El aviso no bloquea un duplicado legítimo

- **WHEN** el usuario ya tiene una regla "chat gpt" de `USD 20` en la tarjeta "Visa BBVA" y crea otra de `USD 20` en la misma tarjeta para "claude"
- **THEN** el sistema avisa, el usuario confirma y ambas reglas quedan activas

#### Scenario: Monto casi igual dispara el aviso

- **WHEN** el usuario ya tiene una regla activa "Prestamo Anses" de `$48.733,92 ARS` en "CA/CC" y crea otra de gasto de `$48.723,04 ARS` en esa misma cuenta
- **THEN** el sistema avisa que ya existe una regla equivalente, mostrando "Prestamo Anses" y su próxima fecha
- **AND** permite confirmar la creación de todos modos

#### Scenario: Monto o cuenta distintos no disparan el aviso

- **WHEN** el usuario crea una regla de `$450.000 ARS` en una cuenta donde su única regla activa de gasto es de `$460.000 ARS` (más de 1 % de diferencia), o en una cuenta donde no tiene ninguna regla activa
- **THEN** el sistema no muestra ningún aviso de duplicado

#### Scenario: El hub señala las reglas que colisionan

- **WHEN** el usuario tiene dos reglas activas con la misma cuenta, moneda y tipo, y montos iguales o casi iguales
- **THEN** el hub las señala como posibles duplicadas
- **AND** no las elimina, pausa ni fusiona por su cuenta

#### Scenario: Aviso y señalización en la app nativa (mobile)

- **WHEN** el usuario crea desde la app nativa una regla que colisiona con una activa, o abre el hub de recurrencias con dos reglas que colisionan
- **THEN** ve el mismo aviso no bloqueante al crear y la misma marca "Duplicada" en el hub que en web
