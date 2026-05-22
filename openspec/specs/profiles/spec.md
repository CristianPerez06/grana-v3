# profiles Specification

## Purpose

Define la tabla `public.profiles` como espejo de `auth.users` con la información de perfil que Grana necesita por encima de lo que provee Supabase Auth. Cada alta de usuario crea automáticamente su fila de profile vía trigger, y el row queda protegido por Row Level Security para que cada usuario solo pueda leer y modificar el suyo. Es la base sobre la que otras capabilities suman campos de perfil (modo `novato`/`experto`, zona horaria financiera, marca de onboarding completado, etc.) mediante migraciones y deltas posteriores.

## Requirements
### Requirement: La tabla profiles refleja a los usuarios de auth

El sistema SHALL mantener una tabla `public.profiles` con una fila por cada fila de `auth.users`. La tabla SHALL contener `id` (uuid primary key referenciando `auth.users(id)` con `on delete cascade`), `full_name` (text, not null), `email` (text, not null, unique) y `created_at` (timestamptz, not null, default `now()`).

#### Scenario: Un nuevo usuario de auth obtiene su fila en profiles

- **WHEN** se inserta una fila en `auth.users` (vía signup)
- **THEN** se inserta una fila correspondiente en `public.profiles` con el mismo `id`, el `full_name` tomado de `auth.users.raw_user_meta_data->>'full_name'` (string vacío si falta) y el mismo `email`

#### Scenario: Eliminar el usuario de auth cascadea hacia profiles

- **WHEN** se elimina una fila de `auth.users`
- **THEN** la fila correspondiente en `public.profiles` se elimina automáticamente

### Requirement: Creación automática de profile vía trigger

El sistema SHALL implementar `handle_new_user` como una función PL/pgSQL con `security definer` y `search_path=public`, y SHALL registrarla como un trigger `AFTER INSERT ... FOR EACH ROW` sobre `auth.users`.

#### Scenario: El trigger dispara en signup

- **WHEN** Supabase Auth completa un signup que inserta en `auth.users`
- **THEN** el trigger ejecuta `handle_new_user`, que inserta en `public.profiles` sin requerir una llamada separada del lado de la app

#### Scenario: El trigger usa privilegios elevados

- **WHEN** la función del trigger inserta en `public.profiles`
- **THEN** la inserción tiene éxito aunque `public.profiles` no tenga ninguna policy de insert para el rol authenticated (porque la función corre como `security definer`)

### Requirement: Row Level Security sobre profiles

El sistema SHALL habilitar RLS en `public.profiles` y SHALL definir una policy de select y una de update que ambas restrinjan el acceso a las filas donde `auth.uid() = id`. El sistema SHALL NOT definir policy de insert (las escrituras pasan por el trigger) ni policy de delete (los deletes cascadean desde `auth.users`).

#### Scenario: Un usuario autenticado lee solo su propio profile

- **WHEN** un usuario autenticado con id `U1` ejecuta `select * from profiles`
- **THEN** la query devuelve a lo sumo una fila, con `id = U1`

#### Scenario: Un usuario autenticado no puede leer profiles de otros

- **WHEN** un usuario autenticado con id `U1` ejecuta `select * from profiles where id = 'U2'`
- **THEN** la query devuelve cero filas

#### Scenario: Un usuario autenticado solo puede actualizar su propio profile

- **WHEN** un usuario autenticado con id `U1` ejecuta `update profiles set full_name = 'X' where id = 'U2'`
- **THEN** el update afecta cero filas

#### Scenario: El rol anónimo no puede leer profiles

- **WHEN** un cliente anónimo (sin sesión) ejecuta `select * from profiles`
- **THEN** la query devuelve cero filas

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
