## ADDED Requirements

### Requirement: El ordenamiento de transacciones en queries distingue uso de cálculo y uso de display

El sistema SHALL usar dos criterios de ordenamiento distintos para transacciones según el propósito de la query:

**Para cálculo de saldos y balances** (running totals, balance history, sumarización):
- `ORDER BY date ASC, created_at ASC, id ASC`
- Razón: los saldos se computan cronológicamente; el orden determinístico garantiza resultados consistentes ante transacciones del mismo día.

**Para display al usuario** (listas de movimientos en pantalla, cualquier UI que muestre transacciones):
- `ORDER BY date DESC, created_at DESC, id DESC`
- Razón: el usuario espera ver primero el movimiento más reciente. Para transacciones del mismo día, el último ingresado debe aparecer primero.

Esta regla aplica en todos los módulos: `transactions`, `cards`, `accounts`, y cualquier módulo futuro que muestre listas de movimientos.

#### Scenario: Lista de movimientos de una cuenta muestra el más reciente primero

- **WHEN** el usuario abre el listado de movimientos de cualquier cuenta o resumen
- **THEN** la transacción con la fecha más reciente aparece en la primera posición
- **AND** si dos transacciones tienen la misma fecha, la ingresada más tarde aparece primero

#### Scenario: Query de cálculo de saldo no se ve afectada por la regla de display

- **WHEN** el sistema calcula el saldo disponible de una cuenta sumando transacciones
- **THEN** la query interna usa `ORDER BY date ASC, created_at ASC, id ASC` para consistencia determinística
- **AND** el resultado no varía si se invierte el orden (la suma es conmutativa, pero el orden explícito evita bugs sutiles en running totals)

### Requirement: La columna `fx_rate_to_ars` se popula solo en consumos de tarjeta no-ARS

El sistema SHALL respetar el invariante `I-CRED-11`: `transactions.fx_rate_to_ars` SHALL ser NOT NULL y mayor a cero si y solo si `account.type='credit'`, `currency_code != 'ARS'`, `type='expense'` y `is_parent=false`. En cualquier otra combinación, SHALL ser `NULL`.

El sistema SHALL enforce esto vía constraint `CHECK` con subquery sobre `accounts.type` (o trigger equivalente) y vía validación en las actions de inserción.

#### Scenario: Consumo ARS con fx_rate_to_ars no nulo es rechazado

- **WHEN** se intenta INSERT con `currency_code='ARS'` y `fx_rate_to_ars=1400`
- **THEN** la DB rechaza por el constraint

#### Scenario: Consumo USD sin fx_rate_to_ars es rechazado

- **WHEN** se intenta INSERT con `currency_code='USD'` en tarjeta y `fx_rate_to_ars=NULL`
- **THEN** la DB rechaza por el constraint

#### Scenario: Income en cuenta cash con fx_rate_to_ars no nulo es rechazado

- **WHEN** se intenta INSERT con `type='income'`, `account.type='cash'`, y `fx_rate_to_ars=1400`
- **THEN** la DB rechaza

## MODIFIED Requirements

### Requirement: Las transacciones de pago de resumen y reversión preservan el orden determinístico

El sistema SHALL preservar el ordering determinístico de los movimientos generados por el pago de resumen y por la reversión, según la regla general del proyecto (ver el requirement "El ordenamiento de transacciones en queries distingue uso de cálculo y uso de display" de esta misma capability): las queries de **cálculo** (saldos, totales corrientes) usan `date ASC, created_at ASC, id ASC` y las queries de **display** (listados mostrados al usuario) usan `date DESC, created_at DESC, id DESC`. Los `expense` de pago SHALL aparecer en la cuenta de pago con la fecha del pago.

#### Scenario: Lista de movimientos de "Galicia" muestra el pago como expense ordinario

- **WHEN** el usuario abre el detalle de "Galicia" después de pagar un resumen
- **THEN** la lista muestra ese `expense` en la posición correspondiente a su `date` (no agrupado aparte)
- **AND** el ordering del listado (display) respeta `date DESC, created_at DESC, id DESC`
