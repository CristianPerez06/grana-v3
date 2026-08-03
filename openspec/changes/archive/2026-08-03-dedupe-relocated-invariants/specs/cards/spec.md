## MODIFIED Requirements

### Requirement: Las tarjetas no descuentan disponible hasta el pago del resumen

El sistema SHALL respetar el invariante `I-CRED-1` en todo el motor contable: las cuentas `accounts.type='credit'` tienen siempre `initial_balance=0` en todas sus monedas, y las transacciones `type='expense'` con `account.type='credit'` SHALL ser excluidas del cálculo del saldo de cualquier cuenta. La exclusión SHALL aplicar **en cualquier status** de la transacción —`pending` y `paid` por igual—: pagar el resumen no reincorpora el consumo al saldo. El único efecto contable de una transacción de tarjeta sobre el saldo disponible del usuario SHALL ser indirecto, vía el `expense` que genera el flujo "pago de resumen" en una cuenta `cash`/`bank`.

Como corolario, el saldo de una cuenta `cash`/`bank` SHALL afectarse únicamente por sus propias transacciones `income`/`expense` no-tarjeta, por transferencias entrantes/salientes, por ajustes, y por el `expense` de pago de resumen.

Este requirement es la **fuente normativa** de la regla off-ledger. Las capabilities `accounts` y `transactions` la referencian desde su propio ángulo (saldo de cuenta y motor de movimientos respectivamente) sin redefinirla.

Este invariante SHALL ser enforced en:

- Constraint `CHECK` (o trigger equivalente, `chk_credit_initial_balance`) que rechaza `initial_balance != 0` para cualquier `account_currencies` cuya cuenta padre tenga `type='credit'`.
- Todas las queries del motor contable (función helper centralizada) que computen saldos.
- Tests unitarios y de integración que validen el invariante.

Invariantes relacionados y dónde viven: `I-CRED-11` (`fx_rate_to_ars` sólo en consumos de tarjeta no-ARS) vive en la capability `transactions`, porque la columna y su enforcement son de `transactions`.

#### Scenario: Inserción de transacción `pending` en tarjeta no cambia saldo

- **WHEN** se inserta una transacción `expense` con `status='pending'` en una cuenta `credit`
- **THEN** el saldo derivado de cualquier cuenta `cash`/`bank` propia no cambia

#### Scenario: Un consumo `paid` tampoco cambia el saldo

- **WHEN** un consumo de tarjeta pasa a `status='paid'` porque se pagó el resumen que lo contiene
- **THEN** ese `expense` sigue excluido del cálculo de saldo de toda cuenta
- **AND** el descuento lo produce únicamente el `expense` de pago en la cuenta `cash`/`bank`

#### Scenario: Consumo en tarjeta no descuenta saldo

- **WHEN** el usuario tiene `$500.000` en su cuenta "Galicia" y registra un consumo de `$50.000` en su tarjeta de crédito
- **THEN** el saldo de "Galicia" sigue siendo `$500.000`
- **AND** el saldo de "Mi plata" o cualquier otra cuenta `cash`/`bank` no cambia

#### Scenario: Pago de resumen sí descuenta saldo

- **WHEN** el usuario paga el resumen de la tarjeta por `$50.000` desde "Galicia"
- **THEN** el saldo de "Galicia" baja a `$450.000`

#### Scenario: initial_balance distinto de cero en cuenta credit es rechazado por DB

- **WHEN** se intenta insertar `account_currencies` con `initial_balance=100` para una cuenta `type='credit'`
- **THEN** la DB rechaza por la constraint `chk_credit_initial_balance`

### Requirement: El sistema mantiene siempre al menos un período abierto por delante de hoy

El sistema SHALL respetar el invariante `I-CRED-12`: para toda cuenta `accounts.type='credit'` con `is_active=true`, SHALL existir al menos un `card_periods` con estado derivado `open` (`today ≤ end_date`). El mantenimiento es **lazy**: cuando una operación necesita un período cubriendo una fecha futura y no existe ningún período cuyo rango lo cubra, el sistema SHALL generar uno nuevo al vuelo siguiendo el algoritmo de sugerencia (ver requirement de algoritmo). El período auto-generado SHALL marcarse con `is_estimated=true`.

#### Scenario: Inserción de consumo con fecha fuera de período existente genera el siguiente

- **WHEN** existen sólo períodos hasta `end_date='2026-06-15'` y se intenta insertar una transacción con `date='2026-06-20'`
- **THEN** el sistema crea un nuevo `card_periods` con fechas estimadas que cubren `2026-06-20`, marcado `is_estimated=true`
- **AND** la transacción se inserta con `card_period_id` apuntando a ese período nuevo

#### Scenario: La operación dispara generación sólo cuando hace falta

- **WHEN** existe un período con `end_date='2026-06-15'` y se intenta insertar una transacción con `date='2026-06-10'`
- **THEN** el sistema NO crea períodos nuevos
- **AND** la transacción se asigna al período existente

#### Scenario: Race condition al generar período concurrentemente

- **WHEN** dos requests intentan generar el mismo período "siguiente" en paralelo y uno gana la UNIQUE `(account_id, start_date)`
- **THEN** el segundo request lee el período recién creado por el primero y continúa la operación sin error visible al usuario

#### Scenario: Tarjeta archivada (inactiva) no requiere períodos open

- **WHEN** una tarjeta tiene `is_active=false`
- **THEN** el invariante no exige períodos open (la tarjeta no acepta consumos nuevos)

## REMOVED Requirements

### Requirement: Toda tarjeta activa tiene siempre al menos un período abierto por delante de hoy

**Reason**: Deduplicación, no deprecación. Este requirement y "El sistema mantiene siempre al menos un período abierto por delante de hoy" gobernaban el mismo invariante `I-CRED-12`, colocalizados a propósito por `split-project-conventions`. Sobrevive el otro porque es la versión **verificable**: exige `is_estimated=true` en el período auto-generado y cubre la race condition de generación concurrente, dos cosas que este texto no decía.

Este texto además contenía la cláusula `«o, alternativamente, SHALL existir un período "actual" […] y la app SHALL haber generado el siguiente bajo demanda»`, que unía dos condiciones distintas con un "alternativamente" y volvía el invariante no verificable — la **deuda 4** anotada por `split-project-conventions`. Eliminar este texto la salda: la versión que queda no tiene esa ambigüedad.

Nada se pierde: el requirement sobreviviente absorbió el nombre `I-CRED-12`, el alcance explícito a `is_active=true`, y el scenario de tarjeta archivada.

**Migration**: Ninguna migración de código ni de datos. El invariante vive ahora completo en el requirement "El sistema mantiene siempre al menos un período abierto por delante de hoy" de esta misma capability (`openspec/specs/cards/spec.md`).
