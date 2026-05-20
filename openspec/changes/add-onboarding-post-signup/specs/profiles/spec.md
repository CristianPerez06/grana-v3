## ADDED Requirements

### Requirement: La tabla profiles persiste el modo del usuario, la zona horaria financiera y el estado del onboarding

El sistema SHALL extender la tabla `public.profiles` con tres columnas adicionales:

- `mode` (`text`, `NOT NULL`, default `'novato'`, `CHECK (mode IN ('novato','experto'))`): captura cómo el usuario quiere ver su plata. Es flag de UX, no de enforcement.
- `financial_timezone` (`text`, `NOT NULL`, default `'America/Argentina/Buenos_Aires'`): zona horaria con la que se calculan fechas contables como "hoy" para el usuario.
- `onboarding_completed_at` (`timestamptz`, `NULL`): instante técnico en que el usuario completó el onboarding. NULL significa que aún no lo completó. El sistema usa esta columna para decidir si redirigir al wizard.

#### Scenario: Inserción de nuevo profile rellena los defaults

- **WHEN** se inserta una fila nueva en `public.profiles` vía el trigger `handle_new_user`
- **THEN** la fila tiene `mode='novato'`, `financial_timezone='America/Argentina/Buenos_Aires'`, `onboarding_completed_at=NULL`
- **AND** estos valores provienen de los defaults declarados en el schema, no de literales en la función del trigger

#### Scenario: Usuario existente al aplicar la migración hereda los defaults

- **WHEN** se aplica la migración `ALTER TABLE profiles ADD COLUMN ...` sobre una tabla con filas existentes
- **THEN** todas las filas previas tienen `mode='novato'`, `financial_timezone='America/Argentina/Buenos_Aires'`, `onboarding_completed_at=NULL`
- **AND** los usuarios existentes ven el wizard al próximo ingreso (salvo update manual del owner activo, documentado en el `design.md` de la change)

#### Scenario: Mode con valor inválido es rechazado por la DB

- **WHEN** se intenta INSERT o UPDATE de `profiles` con `mode='admin'` u otro valor distinto de `'novato'` o `'experto'`
- **THEN** la DB rechaza la operación por la constraint `CHECK`

### Requirement: Los nuevos campos de profiles respetan RLS

El sistema SHALL incluir los nuevos campos (`mode`, `financial_timezone`, `onboarding_completed_at`) en la policy de update existente, de modo que un usuario autenticado SHALL poder UPDATE estos campos solo en su propia fila. La policy de select existente SHALL seguir funcionando sin cambios — los nuevos campos no requieren reglas adicionales.

#### Scenario: Usuario actualiza su propio mode

- **WHEN** un usuario autenticado con id `U1` ejecuta `UPDATE profiles SET mode='experto' WHERE id=U1`
- **THEN** el update afecta una fila

#### Scenario: Usuario intenta actualizar mode de otro usuario

- **WHEN** un usuario autenticado con id `U1` ejecuta `UPDATE profiles SET mode='experto' WHERE id='U2'`
- **THEN** el update afecta cero filas

#### Scenario: El usuario lee su onboarding_completed_at

- **WHEN** un usuario autenticado con id `U1` ejecuta `SELECT onboarding_completed_at FROM profiles WHERE id=U1`
- **THEN** la query devuelve el valor (timestamptz o NULL) sin error
