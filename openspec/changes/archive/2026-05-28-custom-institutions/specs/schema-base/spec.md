## MODIFIED Requirements

### Requirement: Instituciones financieras argentinas pre-cargadas

El sistema SHALL proveer un catálogo de instituciones financieras argentinas (`institutions`) pre-cargado con al menos 23 entidades del mercado local. Cada institución tiene nombre, slug único, color de marca, y tipo de ícono (`bank` o `wallet`). Las instituciones del catálogo SHALL ser inmutables para los usuarios (no se pueden insertar, modificar ni eliminar filas del catálogo). Adicionalmente, el sistema SHALL permitir que cada usuario cree, lea, modifique y elimine sus propias instituciones "custom" (filas con `user_id = auth.uid()`), distinguidas del catálogo (filas con `user_id IS NULL`) por esa misma columna. El producto trata catálogo y custom de forma uniforme aguas arriba: el shape de la fila es el mismo y el avatar resolver no diferencia origen.

#### Scenario: Instituciones disponibles al crear una cuenta bancaria

- **WHEN** un usuario autenticado consulta el catálogo de instituciones
- **THEN** el sistema retorna todas las instituciones con `is_active = true` cuyo `user_id IS NULL` (catálogo) o `user_id = auth.uid()` (custom del propio usuario)

#### Scenario: Catálogo permanece inmutable

- **WHEN** cualquier usuario intenta insertar, actualizar o eliminar una fila de `institutions` con `user_id IS NULL`
- **THEN** la operación es rechazada por RLS

#### Scenario: Usuario crea su propia institución custom

- **WHEN** un usuario autenticado inserta una fila en `institutions` con `user_id = auth.uid()` y los campos válidos (name 1–50 trimmed, brand_color `#RRGGBB`, icon_type `bank` o `wallet`)
- **THEN** la inserción se acepta y la institución queda disponible para ese usuario

#### Scenario: Usuario no puede ver custom de otro usuario

- **WHEN** un usuario A consulta `institutions`
- **THEN** no aparecen filas con `user_id` distinto de NULL y distinto de `A.id`

#### Scenario: Usuario no puede modificar custom de otro usuario

- **WHEN** un usuario A intenta UPDATE/DELETE sobre una fila con `user_id = B.id`
- **THEN** la operación es rechazada por RLS
