## MODIFIED Requirements

### Requirement: Las cuentas credit no descuentan saldo disponible hasta el pago del resumen

La regla normativa completa del off-ledger de tarjetas es el invariante `I-CRED-1`, y vive en la capability `cards` (requirement "Las tarjetas no descuentan disponible hasta el pago del resumen"). Este requirement NO la redefine: fija su consecuencia sobre el saldo de cuenta y remite a la fuente para el enunciado completo.

El sistema SHALL excluir del cálculo del saldo de cualquier cuenta las transacciones de tipo `expense` con `account.type='credit'`, **en cualquier status**. Estas transacciones SHALL impactar el saldo únicamente de forma indirecta, cuando la operación "pago de resumen" se ejecute y genere un `expense` separado en una cuenta `cash` o `bank`, que sí descuenta.

La exclusión NO está condicionada a `status='pending'`. Un consumo de tarjeta ya pagado (`status='paid'`) sigue excluido: pagar el resumen no lo reincorpora al saldo, sino que agrega el `expense` de pago en la cuenta que paga.

#### Scenario: Consumo en tarjeta no descuenta saldo

- **WHEN** el usuario tiene `$500.000` en su cuenta "Galicia" y registra un consumo de `$50.000` en su tarjeta de crédito
- **THEN** el saldo de "Galicia" sigue siendo `$500.000`
- **AND** el saldo de "Mi plata" o cualquier otra cuenta `cash`/`bank` no cambia

#### Scenario: Pago de resumen sí descuenta saldo

- **WHEN** el usuario paga el resumen de la tarjeta por `$50.000` desde "Galicia"
- **THEN** el saldo de "Galicia" baja a `$450.000`

#### Scenario: Un consumo pagado no vuelve a contarse contra el saldo

- **WHEN** los consumos de un resumen pasan a `status='paid'` porque el resumen se pagó
- **THEN** el saldo de las cuentas `cash`/`bank` refleja únicamente el `expense` de pago
- **AND** los consumos individuales siguen sin descontar saldo, igual que cuando estaban `pending`
