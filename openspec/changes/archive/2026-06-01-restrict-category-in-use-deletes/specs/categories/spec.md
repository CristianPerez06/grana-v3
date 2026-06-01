## MODIFIED Requirements

### Requirement: El usuario puede archivar sus categorías propias

Un usuario SHALL poder archivar (soft delete: `is_active = false`) sus propias categorías. Una categoría archivada no aparece en selectores de nuevas transacciones, pero permanece visible en transacciones históricas que la referencian.

Una categoría que está **en uso** puede archivarse. Una categoría en uso NO puede eliminarse (hard delete). Se considera "en uso" cuando es referenciada por al menos una fila en `transactions`, `recurrences` o `recurrence_instances`, ya sea directamente (por `category_id`) o a través de cualquiera de sus subcategorías hijas (por `subcategory_id`). Esta garantía SHALL estar enforced en la DB: los FK de `category_id` y `subcategory_id` en esas tablas son `ON DELETE RESTRICT`, de modo que el bloqueo aplica a todos los clientes (web, mobile, SQL manual) y no depende de que cada frontend lo recuerde. Los clientes SHALL además consultar esas tablas antes de borrar (incluyendo las referencias a las subcategorías hijas al borrar una categoría) para devolver un mensaje accionable ("archivá en lugar de eliminar") en vez de un error de FK crudo.

Una categoría sin ninguna referencia directa ni a través de sus subcategorías puede eliminarse definitivamente.

#### Scenario: Archivar categoría propia sin uso

- **WHEN** un usuario archiva una categoría propia que no está en uso
- **THEN** `is_active` pasa a `false`
- **AND** la categoría ya no aparece en selectores de registro de movimientos
- **AND** la categoría puede eliminarse definitivamente a continuación

#### Scenario: Archivar categoría propia en uso

- **WHEN** un usuario archiva una categoría propia que tiene transacciones o recurrencias asociadas
- **THEN** `is_active` pasa a `false`
- **AND** las transacciones y recurrencias existentes siguen mostrando el nombre de la categoría

#### Scenario: Eliminar categoría en uso bloqueado

- **WHEN** un usuario intenta eliminar definitivamente una categoría referenciada por una transacción, una recurrencia o una instancia de recurrencia
- **THEN** la operación es rechazada (por el guard de aplicación y, como última barrera, por el FK `ON DELETE RESTRICT`)
- **AND** el sistema sugiere archivar en lugar de eliminar
