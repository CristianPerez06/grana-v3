# profiles Specification

## Purpose
TBD - created by archiving change add-auth-flow. Update Purpose after archive.
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

