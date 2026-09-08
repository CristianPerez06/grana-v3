## MODIFIED Requirements

### Requirement: Instituciones financieras argentinas pre-cargadas

El sistema SHALL proveer un catálogo de instituciones financieras (`institutions`) pre-cargado con al menos 29 entidades usadas desde Argentina. El catálogo NO se limita a bancos y billeteras: SHALL incluir también brokers (ALyC) y exchanges donde el usuario tiene saldo, porque esa plata es tan real como la de una caja de ahorro y el producto la muestra en el mismo lugar. Cada institución tiene nombre, slug único, color de marca, y tipo de ícono (`bank` o `wallet`).

El `icon_type` SHALL distinguir por licencia, no por origen ni por tamaño: `bank` (ícono `landmark`) queda reservado para entidades con licencia bancaria; toda otra entidad — billetera, broker, exchange — es `wallet`. El `brand_color` es display-only: alimenta el fondo del avatar y NO participa de ninguna decisión de negocio, de modo que corregirlo es un `UPDATE` y nunca una migración de datos.

Las instituciones del catálogo SHALL ser inmutables para los usuarios (no se pueden insertar, modificar ni eliminar filas del catálogo). Adicionalmente, el sistema SHALL permitir que cada usuario cree, lea, modifique y elimine sus propias instituciones "custom" (filas con `user_id = auth.uid()`), distinguidas del catálogo (filas con `user_id IS NULL`) por esa misma columna. El producto trata catálogo y custom de forma uniforme aguas arriba: el shape de la fila es el mismo y el avatar resolver no diferencia origen.

Como el catálogo es inmutable vía RLS, una fila faltante SHALL restaurarse por migración: no hay camino de vuelta desde la app.

#### Scenario: Instituciones disponibles al crear una cuenta bancaria

- **WHEN** un usuario autenticado consulta el catálogo de instituciones
- **THEN** el sistema retorna todas las instituciones con `is_active = true` cuyo `user_id IS NULL` (catálogo) o `user_id = auth.uid()` (custom del propio usuario)

#### Scenario: Un broker o exchange entra al catálogo como `wallet`

- **WHEN** se agrega al catálogo una entidad sin licencia bancaria (p. ej. un broker ALyC o un exchange)
- **THEN** la fila lleva `icon_type = 'wallet'`
- **AND** el avatar la renderiza con el ícono `wallet`, no con `landmark`

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
