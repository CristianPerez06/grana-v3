## ADDED Requirements

### Requirement: El detalle de cuenta inyecta una fila sintética "Saldo inicial" en su listado

El listado de movimientos del detalle de cuenta (`/accounts/[id]`) SHALL inyectar una fila sintética **"Saldo inicial"** por cada moneda activa de la cuenta cuyo `initial_balance != 0`. Esta fila NO es una transacción — no existe como row en `transactions`, no se persiste, no se replica en el módulo global `/transactions`, y NO SHALL aparecer en ninguna otra pantalla.

La fila SHALL renderizarse usando el contrato funcional `Movimiento` reutilizando la variante de `adjustment` (mismo grouping, mismas reglas de filtros y orden cronológico del listado), con `description = "Saldo inicial"` (label leído del catálogo i18n), `amount = |initial_balance|`, `sign = '+'` si `initial_balance > 0` o `'-'` si `initial_balance < 0`, y `currency_code` igual a la moneda de origen.

La fila SHALL ordenarse cronológicamente como cualquier otra fila del listado, usando la fecha de creación de la moneda en la cuenta (`account_currencies.initial_balance_date`). Cuando exista una transacción real con esa misma fecha, la fila "Saldo inicial" SHALL ordenarse antes — el detalle muestra primero el saldo inicial, después los movimientos del mismo día.

La fila SHALL ser **no navegable** (sin `detail_href`): un click NO SHALL abrir un detalle de movimiento.

La fila SHALL quedar **excluida del recurrence-link lookup** del listado: el identificador sintético de la fila NO SHALL formar parte del input al server action que resuelve qué movimientos están vinculados a una recurrencia (esa query rechazaría un id sintético al castearlo a `uuid`).

El running balance del listado scoped a cuenta SHALL incluir la fila "Saldo inicial" como punto de partida: el saldo inmediatamente posterior a la fila SHALL ser el `initial_balance` de esa moneda, y los running balances de los movimientos siguientes SHALL acumularse a partir de ahí.

#### Scenario: La fila "Saldo inicial" aparece en el detalle de cuenta

- **WHEN** el usuario abre `/accounts/[id]` de una cuenta cuya moneda ARS tiene `initial_balance = 100000` y la cuenta tiene al menos una transacción
- **THEN** el listado muestra una fila "Saldo inicial" con monto `$100.000` y signo `+`, fechada en `account_currencies.initial_balance_date` para ARS

#### Scenario: Una cuenta con `initial_balance = 0` no genera la fila para esa moneda

- **WHEN** el usuario abre `/accounts/[id]` de una cuenta cuya moneda USD tiene `initial_balance = 0`
- **THEN** el listado NO muestra fila "Saldo inicial" para USD
- **AND** si la moneda ARS de esa misma cuenta tiene `initial_balance != 0`, la fila ARS SÍ se muestra (la regla opera por `account_currency`, no por cuenta)

#### Scenario: Una cuenta bimoneda con ambos saldos iniciales no nulos genera dos filas

- **WHEN** el usuario abre `/accounts/[id]` de una cuenta cuya ARS tiene `initial_balance = 50000` y USD `initial_balance = 200`
- **THEN** el listado muestra dos filas "Saldo inicial" — una por moneda — cada una con su monto, signo y fecha derivados de su `account_currency` correspondiente

#### Scenario: La fila no aparece en el listado global de Movimientos

- **WHEN** el usuario abre `/transactions`
- **THEN** ninguna fila "Saldo inicial" aparece en el listado
- **AND** los filtros por cuenta, categoría, moneda y rango de monto operan sin tener que excluir la fila (nunca está presente)

#### Scenario: La fila no es navegable

- **WHEN** el usuario hace click sobre la fila "Saldo inicial" del detalle de cuenta
- **THEN** el sistema NO navega a un detalle de movimiento
- **AND** ninguna pantalla de detalle existe para esa fila

#### Scenario: La fila se ordena antes de las transacciones del mismo día

- **WHEN** el detalle de cuenta tiene una transacción con fecha igual a `account_currencies.initial_balance_date` (ej. un gasto cargado el mismo día que se creó la moneda)
- **THEN** la fila "Saldo inicial" aparece arriba de esa transacción en el listado
- **AND** el running balance posterior a la fila "Saldo inicial" coincide con `initial_balance`, y a partir de ahí los running balances de las transacciones del día reflejan el saldo acumulado

#### Scenario: La fila queda fuera del recurrence-link lookup

- **WHEN** el listado de detalle de cuenta resuelve qué movimientos están vinculados a una recurrencia para mostrar el indicador correspondiente
- **THEN** el identificador de la fila "Saldo inicial" NO SHALL formar parte del input enviado al server action
- **AND** la fila nunca se marca como vinculada a una recurrencia

#### Scenario: Una cuenta con saldo inicial negativo muestra signo `-`

- **WHEN** el usuario abre `/accounts/[id]` de una cuenta cuya moneda ARS tiene `initial_balance = -5000` (ej. una tarjeta de crédito que arrancó con deuda — no aplica a credit cards porque son off-ledger, pero la regla soporta el caso genérico)
- **THEN** la fila "Saldo inicial" muestra monto `$5.000` con signo `−`

## REMOVED Requirements

### Requirement: Guardar y cargar otro

**Reason**: El botón "+ Otro" del drawer de alta de movimiento fue eliminado por el commit `c0580e36` ("refactor(transactions): quitar el boton '+ Otro' del alta de movimiento"). El refactor borró el botón del JSX del form (web), el ref + effect de re-focus, el handler local, el método `onSubmitAndAddAnother` del hook compartido `@grana/movement-form`, y las claves `transactions.drawer.add_another` de `es.json` / `en.json`. La requirement quedó huérfana en la spec sin código que la respalde.

**Migration**: Ninguna. El producto no tenía usuarios al momento del refactor, no hay flujos guardados, ni bookmarks, ni telemetría afectada. La funcionalidad simplemente dejó de existir y la spec se actualiza en consecuencia.
