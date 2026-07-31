# accounts — delta

## MODIFIED Requirements

### Requirement: El sistema computa el saldo de cada cuenta en cada moneda derivado de las transacciones

El sistema SHALL calcular el saldo de cada `(cuenta, moneda)` como:

```
saldo(account, currency) =
  initial_balance(account, currency)
  + Σ amount WHERE type='income'     AND account_id=account                AND currency_code=currency AND date <= hoy_AR
  − Σ amount WHERE type='expense'    AND account_id=account                AND currency_code=currency AND date <= hoy_AR
  − Σ amount WHERE type='transfer'   AND account_id=account                AND currency_code=currency AND date <= hoy_AR
  + Σ amount WHERE type='transfer'   AND transfer_destination_account_id=account AND currency_code=currency AND date <= hoy_AR
  + Σ amount WHERE type='adjustment' AND account_id=account                AND currency_code=currency AND date <= hoy_AR   (signed)
```

**Corte temporal.** `hoy_AR` es la fecha financiera del proyecto: la fecha calendario en `America/Argentina/Buenos_Aires` al momento del cálculo (el mismo "hoy" que `getTodayAR()`), nunca el reloj del browser ni el timezone del servidor de base de datos. Una transacción con `date > hoy_AR` existe, es visible en listados y detalle, pero NO SHALL aportar al saldo derivado hasta que su fecha llegue; ese día entra al cálculo automáticamente, sin acción adicional del usuario. El corte SHALL aplicarse uniformemente a todas las patas de todos los tipos on-ledger (`income`, `expense`, `transfer` ambas patas, `adjustment`, `exchange` ambas patas, `reimbursement`, `settlement`).

La sumatoria SHALL excluir transacciones donde `is_parent=true` (madres de cuotas son off-ledger). El cálculo SHALL aplicarse uniformemente a `cash` y `bank`. Para `credit`, este cálculo da siempre `0` porque las transacciones de tarjeta no afectan al saldo de la propia tarjeta (ver el invariante `I-CRED-1`: `initial_balance=0` y las `expense` con `account.type='credit'` no se restan del balance "disponible" del usuario sino que viven en su propio dominio de período).

No existe columna de saldo cacheada en `accounts` ni en `account_currencies`. El saldo se calcula al servir cada request.

#### Scenario: Saldo es initial_balance cuando no hay transacciones

- **WHEN** una cuenta tiene `initial_balance_ars = 1000` y ninguna transacción ARS
- **THEN** la pantalla de detalle muestra saldo ARS = 1000

#### Scenario: ARS y USD se calculan por separado

- **WHEN** una cuenta tiene transacciones en ambas monedas
- **THEN** se muestran dos saldos independientes; nunca se convierten ni se combinan

#### Scenario: Saldo puede ser negativo en cash/bank

- **WHEN** los gastos acumulados superan el `initial_balance` de una moneda en una cuenta cash o bank
- **THEN** el sistema muestra el saldo negativo (no lo clampea a cero)

#### Scenario: Cuenta credit reporta saldo cero en todas sus monedas

- **WHEN** un consumo en tarjeta `expense` con `status='pending'` se inserta
- **THEN** el saldo derivado de esa tarjeta sigue siendo 0 (las transacciones de tarjeta no afectan al balance de la cuenta credit)
- **AND** el saldo del resto de cuentas cash/bank no cambia

#### Scenario: Madre de cuotas no impacta saldo

- **WHEN** se inserta una transacción con `is_parent=true` y `amount=100000`
- **THEN** el cálculo de saldo de cualquier cuenta no incluye esa fila

#### Scenario: Un gasto con fecha futura no impacta el saldo de hoy

- **WHEN** hoy es `2026-07-31` y el usuario registra un gasto de `$5.000 ARS` con `date = 2026-08-10` en una cuenta con saldo ARS `$100.000`
- **THEN** el saldo derivado de la cuenta sigue mostrando `$100.000`
- **AND** el gasto es visible en el listado de movimientos de la cuenta

#### Scenario: La transacción futura entra al saldo el día que su fecha llega

- **WHEN** existe un gasto de `$5.000 ARS` con `date = 2026-08-10` y la fecha financiera AR pasa a ser `2026-08-10`
- **THEN** el saldo derivado pasa a descontar los `$5.000` automáticamente, sin acción del usuario

#### Scenario: El corte usa la fecha financiera AR, no el timezone del servidor

- **WHEN** el reloj UTC del servidor ya marca `2026-08-01` pero en `America/Argentina/Buenos_Aires` todavía es `2026-07-31`
- **THEN** una transacción con `date = 2026-08-01` todavía NO aporta al saldo
