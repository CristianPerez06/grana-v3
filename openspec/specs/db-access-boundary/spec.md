# db-access-boundary Specification

## Purpose

Define la frontera de acceso a datos a nivel base: qué puede hacer el rol `anon` sobre el schema `public` (nada), qué privilegios de tabla y de función existen por rol, y la invariante de cobertura RLS que impide que una tabla nueva quede expuesta.

Existe porque la garantía era **emergente** y no estructural: se sostenía porque ~58 policies dereferencian `auth.uid()` una por una, sin una sola regla que lo afirmara, y una tabla futura sin `ENABLE ROW LEVEL SECURITY` la habría roto entera. La anon key es pública por diseño —web y mobile la inlinean en el bundle—, así que lo único que separa a un visitante anónimo de los datos es lo que esa key habilita. Acá las migraciones se aplican a mano desde el dashboard, sin CLI ni pipeline, por lo que la aserción ejecutable de cobertura es la única defensa automatizada contra una tabla mal configurada.

## Requirements
### Requirement: El rol `anon` no tiene acceso a ningún dato de `public`

El sistema SHALL garantizar que el rol `anon` no pueda leer ni escribir ninguna fila del schema `public`. La garantía SHALL ser estructural (ausencia de GRANT), no emergente (dependiente de que cada policy dereferencie `auth.uid()`).

El sistema SHALL revocar los privilegios de tabla que Supabase otorga a `anon` por defecto, y SHALL revocar también los default privileges, de modo que una tabla creada en el futuro no reciba GRANT para `anon` automáticamente. El rol `authenticated` NO SHALL verse afectado.

La anon key SHALL seguir siendo pública por diseño: es la que `apps/web` y `apps/mobile` inlinean en el bundle. Lo que este requirement acota no es la difusión de la key, sino lo que la key habilita.

#### Scenario: Lectura anónima de cualquier tabla

- **WHEN** un cliente sin sesión ejecuta `GET /rest/v1/<tabla>?select=*` contra cualquier tabla de `public` con la anon key
- **THEN** la respuesta no contiene ninguna fila de datos de usuario

#### Scenario: Escritura anónima de cualquier tabla

- **WHEN** un cliente sin sesión ejecuta `POST /rest/v1/<tabla>` con la anon key
- **THEN** la operación es rechazada

#### Scenario: Tabla nueva sin policy no queda expuesta

- **WHEN** se crea una tabla en `public` y se omite tanto `ENABLE ROW LEVEL SECURITY` como cualquier policy
- **THEN** el rol `anon` igualmente no puede leerla, porque no tiene GRANT sobre ella
- **AND** la ausencia de RLS deja de ser suficiente para exponer datos públicamente

#### Scenario: El usuario autenticado conserva su acceso

- **WHEN** un usuario con sesión válida ejecuta cualquier lectura o escritura que sus policies permiten
- **THEN** la operación funciona igual que antes de la revocación

---

### Requirement: Las funciones ejecutables declaran su rol explícitamente

Toda función de `public` invocable como RPC SHALL declarar explícitamente quién puede ejecutarla, mediante `REVOKE EXECUTE ... FROM public` seguido de `GRANT EXECUTE ... TO authenticated`. El sistema NO SHALL depender del `EXECUTE TO PUBLIC` que PostgreSQL otorga por defecto.

Esto aplica tanto a las funciones `SECURITY DEFINER` (donde el default sería directamente peligroso si alguna omitiera su guard de autenticación) como a las `SECURITY INVOKER` que devuelven filas completas — en particular `get_movements_page`, que retorna `to_jsonb(t)` de cada movimiento y hoy queda protegida únicamente porque RLS se evalúa con el rol del invocante.

#### Scenario: Invocación anónima de un RPC

- **WHEN** un cliente sin sesión invoca cualquier RPC de `public` con la anon key
- **THEN** la llamada es rechazada por falta de privilegio de ejecución
- **AND** el rechazo ocurre antes de que se evalúe el cuerpo de la función

#### Scenario: Invocación autenticada de un RPC

- **WHEN** un usuario con sesión válida invoca un RPC para el que su rol tiene GRANT
- **THEN** la función se ejecuta y aplica sus propios guards de autorización

#### Scenario: Ninguna función queda con el default de PostgreSQL

- **WHEN** se audita el conjunto de funciones de `public` invocables como RPC
- **THEN** cada una tiene un `REVOKE`/`GRANT` explícito en alguna migración

---

### Requirement: Toda tabla de `public` tiene cobertura RLS verificable

El sistema SHALL mantener una aserción automatizada que falle si alguna tabla de `public` no tiene RLS habilitado, o si tiene RLS habilitado pero cero policies. La aserción SHALL vivir en `supabase/validate_schema.sql`, junto al resto de las validaciones de schema del repo.

La razón es operativa: en este proyecto las migraciones se aplican a mano desde el SQL Editor del dashboard de Supabase, sin CLI ni pipeline de deploy. Sin una aserción ejecutable, la única defensa contra una tabla nueva mal configurada es que alguien se acuerde de revisarla.

#### Scenario: Tabla sin RLS habilitado

- **WHEN** se corre `validate_schema.sql` y existe una tabla de `public` con `relrowsecurity = false`
- **THEN** el script falla e identifica la tabla por nombre

#### Scenario: Tabla con RLS pero sin policies

- **WHEN** se corre `validate_schema.sql` y existe una tabla de `public` con RLS habilitado y cero filas en `pg_policies`
- **THEN** el script falla e identifica la tabla por nombre

#### Scenario: Schema en estado correcto

- **WHEN** se corre `validate_schema.sql` y las 20 tablas de `public` tienen RLS habilitado con al menos una policy
- **THEN** la aserción pasa sin error
