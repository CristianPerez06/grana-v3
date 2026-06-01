## MODIFIED Requirements

### Requirement: Solo el dueño de la transacción puede leerla y modificarla

El sistema SHALL aplicar Row Level Security sobre `transactions` de forma que `user_id = auth.uid()` para toda operación INSERT, UPDATE y DELETE. Para SELECT, un usuario SHALL poder leer sus propias transacciones (`user_id = auth.uid()`) y, adicionalmente, las transacciones compartidas (`is_shared = true`) cuyo `household_id` corresponda a un hogar del que el usuario es miembro. La escritura (INSERT/UPDATE/DELETE) sigue restringida al dueño: ningún miembro puede crear, editar ni eliminar una transacción de otro miembro, aunque sea compartida.

#### Scenario: RLS bloquea acceso cross-user a transacciones no compartidas

- **WHEN** un usuario autenticado realiza una query directa contra `transactions` sin filtro de `user_id`
- **THEN** Supabase retorna las filas donde `user_id = auth.uid()` más las filas compartidas (`is_shared = true`) de su hogar, y ninguna otra

#### Scenario: Un miembro lee el gasto compartido del otro

- **WHEN** A registró un gasto con `is_shared = true` y `household_id` del hogar de A y B, y B consulta sus transacciones
- **THEN** B puede leer ese gasto compartido aunque su `user_id` sea el de A

#### Scenario: Un miembro no puede modificar el gasto del otro

- **WHEN** B intenta editar o eliminar un gasto compartido cuyo `user_id` es el de A
- **THEN** Supabase rechaza la operación de escritura

#### Scenario: Un miembro lee el reintegro compartido del otro

- **WHEN** A tiene un `reimbursement` (`type='reimbursement'`, `is_shared = true`, `household_id` del hogar) sobre un gasto compartido, y B consulta sus transacciones
- **THEN** B puede leer ese reintegro para que la deuda se derive correctamente, sin poder modificarlo
