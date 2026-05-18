## ADDED Requirements

### Requirement: El usuario puede registrar una transferencia entre dos cuentas propias

El sistema SHALL permitir registrar una transferencia (movimiento de plata entre dos cuentas del usuario, sin cambio de patrimonio total). Una transferencia requiere: cuenta origen, cuenta destino distinta a la origen, una moneda activa en **ambas** cuentas, monto mayor a cero, y fecha. La descripción es opcional. No tiene categoría.

#### Scenario: Transferencia creada correctamente

- **WHEN** el usuario completa el formulario con cuenta origen, cuenta destino distinta, moneda activa en ambas, monto > 0, fecha y confirma
- **THEN** el sistema inserta una fila en `transactions` con `type='transfer'`, `account_id=origen`, `transfer_destination_account_id=destino`, `amount > 0`; el saldo de la cuenta origen disminuye en ese monto y el de la cuenta destino aumenta en el mismo monto, en la moneda indicada

#### Scenario: Cuenta destino igual a cuenta origen es rechazada

- **WHEN** el usuario intenta crear una transferencia con la misma cuenta como origen y destino
- **THEN** el sistema muestra un error de validación y no inserta la transacción

#### Scenario: Moneda no activa en la cuenta destino es rechazada

- **WHEN** el usuario intenta transferir ARS desde una cuenta con ARS activo hacia una cuenta que solo tiene USD activo
- **THEN** el sistema retorna un error de validación y no inserta la transacción

#### Scenario: Transferencia con monedas distintas es rechazada

- **WHEN** el usuario intenta especificar una "moneda destino" distinta a la "moneda origen"
- **THEN** la UI no permite el caso (selector único de moneda) y la action enforza `currency_code` único — no existe conversión automática

---

### Requirement: El usuario puede registrar un ajuste de saldo en una cuenta

El sistema SHALL permitir registrar un ajuste (reconciliación entre saldo registrado y saldo real). El ajuste requiere: cuenta, moneda activa, monto distinto de cero (positivo o negativo), y fecha. La descripción es opcional. No tiene categoría. Un ajuste positivo suma al saldo; un ajuste negativo resta.

#### Scenario: Ajuste positivo aumenta el saldo

- **WHEN** el usuario registra un ajuste de `+$50 ARS` en una cuenta con saldo derivado de `$500 ARS`
- **THEN** la pantalla de detalle de la cuenta muestra saldo ARS = `$550` y la transacción aparece con `type='adjustment'` y `amount=50`

#### Scenario: Ajuste negativo disminuye el saldo

- **WHEN** el usuario registra un ajuste de `-$50 ARS` en una cuenta con saldo derivado de `$500 ARS`
- **THEN** la pantalla de detalle muestra saldo ARS = `$450` y la transacción aparece con `type='adjustment'` y `amount=-50`

#### Scenario: Ajuste con monto cero es rechazado

- **WHEN** el usuario intenta registrar un ajuste con monto igual a cero
- **THEN** el sistema muestra un error de validación

#### Scenario: Ajuste con moneda inactiva es rechazado

- **WHEN** el usuario intenta registrar un ajuste en una moneda que no tiene `account_currencies` activa en la cuenta
- **THEN** el sistema retorna un error y no inserta la transacción

---

### Requirement: La lista de movimientos de una cuenta incluye las transferencias entrantes

El sistema SHALL mostrar en la lista de movimientos del detalle de una cuenta tanto las transacciones donde `account_id = currentAccount` como aquellas donde `transfer_destination_account_id = currentAccount`. Cada transferencia se visualiza desde la perspectiva de la cuenta actual: saliente con signo `−` cuando la cuenta es origen, entrante con signo `+` cuando la cuenta es destino.

#### Scenario: Transferencia saliente aparece con signo negativo

- **WHEN** el usuario abre el detalle de la cuenta A donde existe una transferencia de A → B por `$100 ARS`
- **THEN** la lista de movimientos de A muestra esa transferencia con monto `−$100 ARS` y texto secundario indicando "→ B"

#### Scenario: Transferencia entrante aparece con signo positivo

- **WHEN** el usuario abre el detalle de la cuenta B donde existe una transferencia A → B por `$100 ARS`
- **THEN** la lista de movimientos de B muestra esa transferencia con monto `+$100 ARS` y texto secundario indicando "← A"

#### Scenario: Ajustes se diferencian visualmente

- **WHEN** el usuario abre el detalle de una cuenta con un ajuste positivo y otro negativo
- **THEN** ambos aparecen marcados como "Ajuste" con el signo correspondiente a su `amount`

---

### Requirement: El usuario puede editar una transferencia

El sistema SHALL permitir editar los campos mutables de una transferencia: monto (> 0), fecha y descripción. Los campos `type`, `account_id`, `transfer_destination_account_id` y `currency_code` son inmutables post-creación. Si el usuario quiere cambiar la cuenta o moneda, debe eliminar y crear de nuevo.

#### Scenario: Edición de monto actualiza ambos saldos

- **WHEN** el usuario cambia el monto de una transferencia A → B de `$100` a `$150`
- **THEN** el saldo de A disminuye `$50` adicionales y el de B aumenta `$50` adicionales

#### Scenario: Intento de cambiar cuenta destino es rechazado

- **WHEN** el usuario intenta cambiar `transfer_destination_account_id` mediante el form de edición
- **THEN** el campo está deshabilitado en la UI y la action lo rechaza si se envía vía API directa

---

### Requirement: El usuario puede editar un ajuste

El sistema SHALL permitir editar los campos mutables de un ajuste: monto (distinto de cero, con signo), fecha y descripción. Los campos `type`, `account_id` y `currency_code` son inmutables post-creación.

#### Scenario: Edición de monto actualiza el saldo

- **WHEN** el usuario cambia el monto de un ajuste de `+$50` a `+$80`
- **THEN** el saldo de la cuenta aumenta `$30` adicionales respecto al saldo previo

#### Scenario: Cambio de signo es válido

- **WHEN** el usuario cambia un ajuste de `+$50` a `-$50`
- **THEN** el sistema acepta el cambio; el saldo de la cuenta se ajusta en `-$100` respecto al saldo previo

---

### Requirement: El usuario puede eliminar una transferencia o un ajuste

El sistema SHALL permitir eliminar permanentemente una transferencia o un ajuste. El sistema solicita confirmación antes de ejecutar. Los saldos de las cuentas afectadas se recalculan automáticamente tras la eliminación.

#### Scenario: Eliminar transferencia recalcula ambos saldos

- **WHEN** el usuario confirma la eliminación de una transferencia A → B por `$200`
- **THEN** el sistema borra la fila, el saldo de A aumenta `$200` y el de B disminuye `$200`

#### Scenario: Eliminar ajuste positivo disminuye el saldo

- **WHEN** el usuario confirma la eliminación de un ajuste de `+$50`
- **THEN** el sistema borra la fila y el saldo de la cuenta disminuye `$50`

#### Scenario: Eliminar ajuste negativo aumenta el saldo

- **WHEN** el usuario confirma la eliminación de un ajuste de `-$50`
- **THEN** el sistema borra la fila y el saldo de la cuenta aumenta `$50`

## MODIFIED Requirements

### Requirement: El saldo de la cuenta refleja las transacciones en tiempo real

El sistema SHALL calcular el saldo de cada cuenta como `initial_balance + Σ income − Σ expense − Σ transfer saliente + Σ transfer entrante + Σ adjustment` en la moneda correspondiente. No existe columna de saldo cacheada.

#### Scenario: Saldo después de crear un ingreso

- **WHEN** el usuario crea un ingreso de $100 ARS en una cuenta con `initial_balance_ars = 500`
- **THEN** la pantalla de detalle de esa cuenta muestra saldo ARS = $600

#### Scenario: Saldo después de crear un gasto

- **WHEN** el usuario crea un gasto de $200 ARS en una cuenta con `initial_balance_ars = 500` y sin transacciones previas
- **THEN** la pantalla de detalle muestra saldo ARS = $300

#### Scenario: Saldo después de crear una transferencia saliente

- **WHEN** el usuario crea una transferencia de `$150 ARS` desde la cuenta A (saldo $500) hacia la cuenta B (saldo $0)
- **THEN** la pantalla de detalle de A muestra saldo ARS = `$350` y la de B muestra saldo ARS = `$150`

#### Scenario: Saldo después de crear un ajuste

- **WHEN** el usuario crea un ajuste de `+$30 ARS` en una cuenta con saldo de `$500`
- **THEN** la pantalla de detalle muestra saldo ARS = `$530`

#### Scenario: Saldo puede ser negativo

- **WHEN** los gastos acumulados superan el `initial_balance` de una moneda
- **THEN** el sistema muestra el saldo negativo (no lo clampea a cero)

#### Scenario: ARS y USD se calculan por separado

- **WHEN** la cuenta tiene transacciones en ARS y en USD
- **THEN** el sistema muestra saldos independientes por moneda; nunca los convierte ni combina

---

### Requirement: El usuario puede ver la lista de transacciones de una cuenta

El sistema SHALL mostrar la lista de transacciones de una cuenta ordenada por fecha descendente (más reciente primero), luego por `created_at` descendente. La lista es parte de la pantalla de detalle de la cuenta. La lista incluye las transacciones donde `account_id = currentAccount` así como las transferencias entrantes donde `transfer_destination_account_id = currentAccount`.

#### Scenario: Lista muestra ingresos, gastos, transferencias y ajustes

- **WHEN** el usuario abre el detalle de una cuenta con transacciones de los cuatro tipos
- **THEN** el sistema muestra todas las transacciones con fecha, descripción, monto y tipo diferenciado visualmente (ingreso, gasto, transferencia con flecha, ajuste con ícono propio)

#### Scenario: Estado vacío

- **WHEN** la cuenta no tiene transacciones
- **THEN** el sistema muestra el mensaje vacío con CTA para agregar la primera transacción

#### Scenario: La lista está paginada

- **WHEN** la cuenta tiene más de 20 transacciones
- **THEN** el sistema muestra las 20 más recientes con opción de cargar más

#### Scenario: La lista incluye transferencias entrantes

- **WHEN** la cuenta B es destino de una transferencia desde A
- **THEN** la lista de movimientos de B incluye esa transferencia con signo positivo y la etiqueta "← A"

---

### Requirement: El usuario puede ver el detalle de una transacción

El sistema SHALL mostrar el detalle completo de una transacción: fecha, monto, moneda, tipo, cuenta, descripción, y los campos extra según el tipo — categoría/subcategoría (income/expense), cuenta destino (transfer) o signo (adjustment).

#### Scenario: Acceso al detalle

- **WHEN** el usuario toca una transacción en la lista
- **THEN** el sistema navega a la pantalla de detalle con todos los campos visibles

#### Scenario: Detalle de transferencia muestra la cuenta destino

- **WHEN** el usuario abre el detalle de una transferencia
- **THEN** el sistema muestra la cuenta origen y la cuenta destino con sus nombres respectivos

#### Scenario: Detalle de ajuste muestra el signo

- **WHEN** el usuario abre el detalle de un ajuste con `amount = -30`
- **THEN** el sistema muestra el monto `-$30` con indicación visual de que es una resta

#### Scenario: Transacción de otro usuario no es accesible

- **WHEN** el usuario intenta acceder directamente a la URL de una transacción que no le pertenece
- **THEN** el sistema retorna `notFound()` (la RLS filtra la fila; la página renderiza 404)
