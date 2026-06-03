# Delta — Reseed de categorías (Argentina)

## MODIFIED Requirements

### Requirement: Catálogo de categorías del sistema

El sistema SHALL proveer 18 categorías padre pre-cargadas: 13 de tipo `expense` y 5 de tipo `income`. Cada categoría del sistema tiene subcategorías pre-cargadas (71 en total), con la excepción de `Reintegros/Cashback`, que se provee sin subcategorías. Las categorías del sistema tienen `user_id = NULL` y son visibles para todos los usuarios autenticados.

El catálogo por defecto está enfocado en Argentina: mantiene marcas locales reconocibles (Netflix, PedidosYa, Rappi, Uber/Cabify) y rubros propios del país (Monotributo, Tasas municipales, Expensas, Prepaga, SUBE, VTV, Patente, Aguinaldo, Compra dólar/MEP, entre otros).

El catálogo SHALL enriquecerse de forma aditiva: nuevas categorías/subcategorías de sistema se incorporan mediante migraciones incrementales (`INSERT ... ON CONFLICT DO NOTHING`), sin editar el seed inicial ya aplicado, sin borrar filas existentes y sin modificar ningún `canonical_name` existente. Un cambio en la etiqueta visible de una categoría/subcategoría de sistema se realiza editando su traducción i18n (`categories.*` / `subcategories.*`), nunca su `canonical_name`.

Las categorías del sistema no pueden ser editadas, archivadas ni eliminadas por ningún usuario.

#### Scenario: Categorías del sistema visibles a todos los usuarios

- **WHEN** un usuario autenticado consulta el catálogo de categorías
- **THEN** el sistema retorna las categorías del sistema (`user_id IS NULL`) con `is_active = true`
- **AND** cada categoría incluye sus subcategorías activas

#### Scenario: Modificación de categoría del sistema bloqueada

- **WHEN** cualquier usuario intenta actualizar o eliminar una categoría con `user_id IS NULL`
- **THEN** la operación es rechazada por RLS

#### Scenario: Enriquecimiento aditivo del catálogo de sistema

- **WHEN** una migración incremental agrega nuevas categorías/subcategorías de sistema
- **THEN** las filas se insertan con `ON CONFLICT DO NOTHING` sin duplicar las existentes
- **AND** los `canonical_name` y las filas previas permanecen sin cambios
- **AND** las transacciones, recurrencias e instancias que referencian categorías previas no se ven afectadas
