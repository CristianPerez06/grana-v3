## MODIFIED Requirements

### Requirement: La tabla profiles persiste la zona horaria financiera y el estado del onboarding

(MODIFICA "La tabla profiles persiste el modo del usuario, la zona horaria financiera y el estado del onboarding": se elimina la columna `mode`. También se ajusta el `Purpose` del master spec, que menciona "modo `novato`/`experto`".)

El sistema SHALL extender la tabla `public.profiles` con dos columnas adicionales:

- `financial_timezone` (`text`, `NOT NULL`, default `'America/Argentina/Buenos_Aires'`): zona horaria con la que se calculan fechas contables como "hoy" para el usuario.
- `onboarding_completed_at` (`timestamptz`, `NULL`): instante técnico en que el usuario completó el onboarding. NULL significa que aún no lo completó. El sistema usa esta columna para decidir si redirigir al wizard.

#### Scenario: Inserción de nuevo profile rellena los defaults

- **WHEN** se inserta una fila nueva en `public.profiles` vía el trigger `handle_new_user`
- **THEN** la fila tiene `financial_timezone='America/Argentina/Buenos_Aires'`, `onboarding_completed_at=NULL`
- **AND** estos valores provienen de los defaults declarados en el schema, no de literales en la función del trigger

#### Scenario: Usuario existente al aplicar la migración hereda los defaults

- **WHEN** se aplica la migración `ALTER TABLE profiles ADD COLUMN ...` sobre una tabla con filas existentes
- **THEN** todas las filas previas tienen `financial_timezone='America/Argentina/Buenos_Aires'`, `onboarding_completed_at=NULL`
- **AND** los usuarios existentes ven el wizard al próximo ingreso

### Requirement: Los campos de profiles respetan RLS

(MODIFICA "Los nuevos campos de profiles respetan RLS": se quita `mode` de la lista de campos. La policy de update es a nivel de fila — no enumera columnas — así que dropear `mode` no requiere cambiar SQL de la policy.)

El sistema SHALL incluir los campos (`financial_timezone`, `onboarding_completed_at`) en la policy de update existente, de modo que un usuario autenticado SHALL poder UPDATE estos campos solo en su propia fila. La policy de select existente SHALL seguir funcionando sin cambios.

#### Scenario: Usuario actualiza su propio onboarding_completed_at

- **WHEN** un usuario autenticado con id `U1` ejecuta `UPDATE profiles SET onboarding_completed_at=now() WHERE id=U1`
- **THEN** el update afecta una fila

#### Scenario: Usuario intenta actualizar el profile de otro usuario

- **WHEN** un usuario autenticado con id `U1` ejecuta `UPDATE profiles SET onboarding_completed_at=now() WHERE id='U2'`
- **THEN** el update afecta cero filas
