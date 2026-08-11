## MODIFIED Requirements

### Requirement: Cuenta Efectivo por defecto en el signup

El sistema SHALL crear automáticamente una cuenta `Billetera` (type `cash`, sin institución) para todo usuario nuevo en el momento del signup. La cuenta default se inicializa con dos `account_currencies` activas — ARS y USD — ambas con `initial_balance = 0`. Este bootstrap se ejecuta vía trigger `SECURITY DEFINER` sobre `auth.users` y bypassa RLS.

El nombre es `Billetera`, no `Efectivo`. La migración `0007_accounts.sql` creó la cuenta como `Efectivo` y la `0012_profiles_onboarding_and_default_account.sql` la renombró: reemplazó la función del trigger para que los usuarios nuevos reciban `Billetera` y corrió un backfill sobre las filas existentes. Como la verdad del schema son las migraciones **ordenadas**, la `0012` es la que rige.

No confundir con la palabra "Efectivo" usada como **tipo de cuenta** o como rótulo de sección en la UI de listados (cuentas `cash` agrupadas bajo "Efectivo"); ese uso es correcto y no tiene relación con el nombre de esta cuenta.

#### Scenario: Usuario nuevo recibe cuenta Efectivo

- **WHEN** un usuario completa el signup
- **THEN** existe en `accounts` una fila con `name='Billetera'`, `type='cash'`, `institution_id=NULL`, `is_active=true` cuyo `user_id` matchea el usuario recién creado

#### Scenario: La cuenta Efectivo default tiene ARS y USD activas

- **WHEN** se crea la cuenta `Billetera` por trigger
- **THEN** existen dos filas en `account_currencies` para esa cuenta, una con `currency_code='ARS'` y otra con `'USD'`, ambas con `initial_balance=0` y `is_active=true`

#### Scenario: Usuarios pre-existentes reciben la cuenta default vía backfill

- **WHEN** se aplica la migración del módulo `accounts` y existen usuarios sin cuenta `cash`
- **THEN** la migración crea retroactivamente la cuenta default (con ARS y USD activos a saldo cero) para cada uno de esos usuarios
- **AND** el backfill de la `0012` renombra a `Billetera` las cuentas default que se habían creado como `Efectivo`
