# profiles Specification

## Purpose

Define la tabla `public.profiles` como espejo de `auth.users` con la información de perfil que Grana necesita por encima de lo que provee Supabase Auth. Cada alta de usuario crea automáticamente su fila de profile vía trigger, y el row queda protegido por Row Level Security para que cada usuario solo pueda leer y modificar el suyo. Es la base sobre la que otras capabilities suman campos de perfil (zona horaria financiera, marca de onboarding completado, etc.) mediante migraciones y deltas posteriores.

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

El sistema SHALL habilitar RLS en `public.profiles`. Las policies sobre la tabla SHALL restringir el acceso a las filas donde `auth.uid() = id`: una de select y una de update. El sistema SHALL NOT definir policy de insert (las escrituras pasan por el trigger) ni policy de delete (los deletes cascadean desde `auth.users`).

El sistema SHALL NOT definir sobre la tabla ninguna policy adicional que ensanche el select a filas de otros usuarios. La lectura del profile de un conviviente — necesaria para que la UI del módulo Compartido pueda decir "Juan te debe …" — SHALL resolverse mediante un RPC con allowlist de columnas (ver el requirement siguiente), no mediante una policy sobre `profiles`. El motivo es que RLS no tiene granularidad de columna: una policy que habilite leer la fila del conviviente habilita leerla **entera**, incluidas las columnas que `profiles` tenga en el futuro.

#### Scenario: Un usuario autenticado lee solo su propio profile

- **WHEN** un usuario autenticado con id `U1` ejecuta `select * from profiles`
- **THEN** la query devuelve a lo sumo una fila, con `id = U1`

#### Scenario: Un usuario autenticado no puede leer profiles de otros

- **WHEN** un usuario autenticado con id `U1` ejecuta `select * from profiles where id = 'U2'`
- **THEN** la query devuelve cero filas
- **AND** esto vale también cuando `U1` y `U2` comparten hogar

#### Scenario: Un usuario autenticado solo puede actualizar su propio profile

- **WHEN** un usuario autenticado con id `U1` ejecuta `update profiles set full_name = 'X' where id = 'U2'`
- **THEN** el update afecta cero filas

#### Scenario: El rol anónimo no puede leer profiles

- **WHEN** un cliente anónimo (sin sesión) ejecuta `select * from profiles`
- **THEN** la query devuelve cero filas
### Requirement: La tabla profiles persiste la zona horaria financiera y el estado del onboarding

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

El sistema SHALL incluir los campos (`financial_timezone`, `onboarding_completed_at`) en la policy de update existente, de modo que un usuario autenticado SHALL poder UPDATE estos campos solo en su propia fila. La policy de select existente SHALL seguir funcionando sin cambios.

#### Scenario: Usuario actualiza su propio onboarding_completed_at

- **WHEN** un usuario autenticado con id `U1` ejecuta `UPDATE profiles SET onboarding_completed_at=now() WHERE id=U1`
- **THEN** el update afecta una fila

#### Scenario: Usuario intenta actualizar el profile de otro usuario

- **WHEN** un usuario autenticado con id `U1` ejecuta `UPDATE profiles SET onboarding_completed_at=now() WHERE id='U2'`
- **THEN** el update afecta cero filas
### Requirement: La lectura de profiles de convivientes expone solo las columnas del allowlist

El sistema SHALL exponer un RPC `SECURITY DEFINER` que devuelva los profiles de los miembros del hogar del invocante — incluido el propio invocante — restringido a las columnas `(id, full_name)`. El RPC SHALL resolver la pertenencia al hogar con `auth.uid()` internamente — no SHALL aceptar el id del otro usuario como parámetro de confianza — y SHALL tener `REVOKE EXECUTE ... FROM public` + `GRANT EXECUTE ... TO authenticated`.

Que incluya al propio invocante es deliberado: el consumidor principal (`getHousehold`) necesita los nombres de **todos** los miembros, y devolver solo a los otros lo obligaría a unir dos fuentes para reconstruir la lista.

Las columnas `email`, `financial_timezone`, `onboarding_completed_at` y `created_at` NO SHALL ser legibles por un conviviente, por ningún camino: ni vía select directo sobre la tabla, ni vía el RPC. La garantía SHALL vivir en la base y NO SHALL depender de que cada query del cliente recuerde enumerar columnas.

El impacto directo de la exposición previa era acotado — el hogar tiene máximo 2 miembros y se entra por invitación explícita — pero la policy otorgaba las columnas que la tabla tuviera en cada momento, de modo que agregar en el futuro un `phone` o una preferencia con toggle de privacidad la habría filtrado sin que ninguna migración tocara la policy.

#### Scenario: Un conviviente obtiene el nombre del otro

- **WHEN** un usuario autenticado `U1` que comparte hogar con `U2` invoca el RPC de lectura de profiles de convivientes
- **THEN** el resultado incluye una fila con `id = U2` y su `full_name`

#### Scenario: El email de un conviviente no es legible

- **WHEN** `U1` intenta obtener el `email` de `U2`, con quien comparte hogar, por cualquier vía del cliente
- **THEN** ninguna vía lo devuelve
- **AND** el resultado del RPC contiene exclusivamente las columnas `id` y `full_name`

#### Scenario: Un usuario sin hogar no obtiene filas ajenas

- **WHEN** un usuario autenticado que no pertenece a ningún hogar invoca el RPC
- **THEN** el resultado no contiene ninguna fila de otro usuario

#### Scenario: El RPC no es invocable sin sesión

- **WHEN** un cliente sin sesión invoca el RPC con la anon key
- **THEN** la llamada es rechazada por falta de privilegio de ejecución

#### Scenario: Un usuario no puede pedir el profile de alguien con quien no convive

- **WHEN** un usuario autenticado `U1` invoca el RPC y existe un usuario `U3` con quien no comparte hogar
- **THEN** el resultado no incluye ninguna fila con `id = U3`
