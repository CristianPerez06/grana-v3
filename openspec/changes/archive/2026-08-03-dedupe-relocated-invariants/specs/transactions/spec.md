## MODIFIED Requirements

### Requirement: El sistema enforza que `fx_rate_to_ars` se popule solo y solamente en consumos de tarjeta no-ARS

El sistema SHALL respetar el invariante `I-CRED-11`: `transactions.fx_rate_to_ars` SHALL estar populado (NOT NULL, > 0) si y solo si `account.type='credit'` AND `currency_code != 'ARS'` AND `type='expense'` AND `is_parent=false`. En cualquier otro caso, `fx_rate_to_ars` SHALL ser `NULL`.

El sistema SHALL enforzar esto vía constraint `CHECK` con subquery sobre `accounts.type` (o trigger equivalente) y vía validación en las actions de inserción.

#### Scenario: Consumo USD en tarjeta exige fx_rate_to_ars

- **WHEN** se intenta insertar `expense` en tarjeta con `currency_code='USD'` y `fx_rate_to_ars=NULL`
- **THEN** la DB o action rechaza con error

#### Scenario: Consumo ARS en tarjeta no debe tener fx_rate_to_ars

- **WHEN** se intenta insertar `expense` en tarjeta con `currency_code='ARS'` y `fx_rate_to_ars=1400`
- **THEN** la DB o action rechaza con error

#### Scenario: Income en cuenta cash no debe tener fx_rate_to_ars

- **WHEN** se intenta insertar `income` con `fx_rate_to_ars` no nulo
- **THEN** la DB o action rechaza

### Requirement: Las transacciones de tarjeta NO impactan el saldo disponible del usuario

La regla normativa completa del off-ledger de tarjetas es el invariante `I-CRED-1`, y vive en la capability `cards` (requirement "Las tarjetas no descuentan disponible hasta el pago del resumen"). Este requirement NO la redefine: fija su consecuencia sobre el motor de saldos de esta capability y remite a la fuente para el enunciado completo.

El sistema SHALL excluir del cálculo de saldo de cualquier cuenta a las transacciones de `type='expense'` con `account.type='credit'`, **en cualquier status** (`pending` y `paid` por igual). El saldo de las cuentas `cash`/`bank` SHALL afectarse únicamente por:

- Sus propias transacciones `income` y `expense` (no de tarjeta).
- Transferencias entrantes/salientes con esa cuenta.
- Ajustes con esa cuenta.
- El `expense` generado por el flujo de "pago de resumen" (que vive en cash/bank, no en credit).

#### Scenario: 100 consumos en tarjeta no cambian el saldo de "Galicia"

- **WHEN** el usuario tiene `$500.000` en "Galicia" y registra 100 consumos por un total de `$2.000.000` en su tarjeta
- **THEN** "Galicia" sigue mostrando `$500.000`

#### Scenario: Pago de resumen por `$300.000` desde "Galicia" baja el saldo

- **WHEN** el usuario paga el resumen por `$300.000` desde "Galicia"
- **THEN** "Galicia" baja a `$200.000`

#### Scenario: Un consumo de tarjeta ya pagado tampoco vuelve al saldo

- **WHEN** un consumo de tarjeta pasa de `status='pending'` a `status='paid'` al pagarse el resumen
- **THEN** ese `expense` sigue excluido del cálculo de saldo de toda cuenta
- **AND** el único movimiento que afecta el saldo es el `expense` de pago en la cuenta `cash`/`bank`

## REMOVED Requirements

### Requirement: La columna `fx_rate_to_ars` se popula solo en consumos de tarjeta no-ARS

**Reason**: Deduplicación, no deprecación. Este requirement y "El sistema enforza que `fx_rate_to_ars` se popule solo y solamente en consumos de tarjeta no-ARS" enunciaban el mismo predicado con los mismos tres scenarios, colocalizados a propósito por `split-project-conventions` para hacer visible la duplicación. La regla sigue vigente **sin pérdida de alcance**: el requirement sobreviviente absorbió sus dos aportes propios — el nombre del invariante `I-CRED-11` y el detalle de que el enforcement se hace con constraint `CHECK` con subquery sobre `accounts.type` o trigger equivalente.

**Migration**: Ninguna migración de código ni de datos. La regla vive ahora completa en el requirement "El sistema enforza que `fx_rate_to_ars` se popule solo y solamente en consumos de tarjeta no-ARS" de esta misma capability (`openspec/specs/transactions/spec.md`).
