# categories — delta

## MODIFIED Requirements

### Requirement: El usuario puede archivar sus categorías propias

Un usuario SHALL poder archivar (soft delete: `is_active = false`) sus propias categorías. Una categoría archivada no aparece en selectores de nuevas transacciones, pero permanece visible en transacciones históricas que la referencian.

**El ocultamiento alcanza a los dos niveles del selector.** Una subcategoría archivada (`is_active = false`) NO SHALL ofrecerse al elegir clasificación para un movimiento o una recurrencia nuevos, esté su categoría padre activa o no. La regla no es "la categoría archivada desaparece": es que **ningún ítem inactivo se ofrece**, en el nivel de categoría y en el de subcategoría por igual. El filtro SHALL aplicarse en la lectura del catálogo de categorías —incluyendo las subcategorías embebidas en cada categoría— y NO SHALL delegarse a que cada consumer recuerde re-filtrar: un catálogo que entrega ítems inactivos es un read incorrecto, y un consumer que los tapa esconde el defecto en vez de arreglarlo.

**La desaparición es inmediata, no eventual.** Archivar o eliminar una categoría o subcategoría SHALL sacarla de los selectores en la sesión en curso, sin depender de que venza una política de frescura de cache ni de que el usuario recargue la app. Un catálogo cacheado que sigue ofreciendo una categoría ya eliminada de la base es un incumplimiento de este requirement, no una demora aceptable.

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

#### Scenario: Una subcategoría archivada no se ofrece bajo una categoría activa

- **WHEN** el usuario archiva la subcategoría "Delivery" de una categoría "Comida" que sigue activa
- **AND** después abre el selector de categoría de un movimiento nuevo y entra a "Comida"
- **THEN** "Delivery" no figura entre las subcategorías ofrecidas
- **AND** el resto de las subcategorías activas de "Comida" se sigue ofreciendo

#### Scenario: El catálogo no entrega subcategorías inactivas

- **WHEN** un consumer lee el catálogo de categorías con sus subcategorías
- **THEN** ninguna categoría del resultado incluye subcategorías con `is_active = false`
- **AND** el consumer puede listarlas tal cual las recibe sin re-filtrar por `is_active`

#### Scenario: Archivar saca la categoría del selector en la misma sesión

- **WHEN** el usuario archiva una categoría propia desde Configuración y a continuación abre el formulario de alta de movimiento sin recargar la app
- **THEN** la categoría archivada no aparece en el selector

#### Scenario: Una categoría eliminada no sobrevive en el selector

- **WHEN** el usuario elimina definitivamente una categoría propia sin uso y a continuación abre el formulario de alta de movimiento sin recargar la app
- **THEN** la categoría eliminada no aparece en el selector

#### Scenario: Eliminar categoría en uso bloqueado

- **WHEN** un usuario intenta eliminar definitivamente una categoría referenciada por una transacción, una recurrencia o una instancia de recurrencia
- **THEN** la operación es rechazada (por el guard de aplicación y, como última barrera, por el FK `ON DELETE RESTRICT`)
- **AND** el sistema sugiere archivar en lugar de eliminar
