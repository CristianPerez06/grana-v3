## MODIFIED Requirements

### Requirement: El onboarding en modo novato auto-crea una cuenta cash y una tarjeta default

El sistema SHALL ejecutar, al completar el onboarding con `users.mode='novato'`, una operación atómica que cree:

1. Una cuenta `accounts` con `name='Mi plata'`, `type='cash'`, `is_active=true`.
2. Una cuenta `accounts` con `name='Mi tarjeta'`, `type='credit'`, `is_active=true`, sin `network_id` ni `other_network_name` (queda completable después).
3. Las filas en `account_currencies` para la cuenta cash con `currency_code='ARS'` y la moneda secundaria si el usuario la activó, ambas con `initial_balance=0`.
4. La fila en `account_currencies` para esa tarjeta con `currency_code='ARS'` e `initial_balance=0` (USD adicional si el usuario activó la segunda moneda en el onboarding).

Tras completar la operación atómica con éxito, el sistema SHALL redirigir al usuario a `/dashboard` (la landing universal post-onboarding), NO a `/cards`.

#### Scenario: Onboarding novato exitoso crea las dos entidades default y redirige a dashboard

- **WHEN** un usuario completa el onboarding eligiendo modo novato, con ARS como moneda principal y la fecha de cierre cargada
- **THEN** se crean las dos cuentas ("Mi plata" cash y "Mi tarjeta" credit) con sus `account_currencies` en `ARS` e `initial_balance=0`
- **AND** se crean los dos primeros `card_periods` con `is_estimated=true` para la tarjeta default
- **AND** el sistema redirige a `/dashboard`

#### Scenario: Falla en cualquier paso del onboarding hace rollback

- **WHEN** durante la operación atómica de onboarding novato falla el INSERT de `card_periods` (por error de constraint)
- **THEN** la transacción se revierte completamente y ninguna de las dos cuentas queda creada
- **AND** el usuario permanece en la pantalla de onboarding con un mensaje de error
- **AND** NO se ejecuta el redirect a `/dashboard`

#### Scenario: Onboarding experto no crea entidades default y también redirige a dashboard

- **WHEN** un usuario completa el onboarding con modo experto
- **THEN** NO se auto-crean cuentas "Mi plata" ni "Mi tarjeta"
- **AND** el sistema redirige a `/dashboard`
