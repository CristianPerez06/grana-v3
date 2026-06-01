# Delta — Editar tarjeta como drawer

## MODIFIED Requirements

### Requirement: El usuario puede editar campos mutables de una tarjeta

El sistema SHALL presentar la edición de una tarjeta en un **drawer lateral derecho** que se desliza sobre el detalle de la tarjeta, con el mismo patrón de presentación que el drawer de movimientos (header fijo con eyebrow + nombre + cerrar, body scrolleable, footer fijo con Cancelar + Guardar cambios). El trigger "Editar" del detalle SHALL abrir el drawer en desktop. La ruta `/cards/[id]/edit` SHALL seguir resolviendo y renderizando el mismo formulario para deep-link y clientes sin JS.

Desde el drawer, el sistema SHALL permitir editar: **nombre**, **institución** (banco), **`credit_limit`**, y las **fechas del ciclo** (cierre/vencimiento del resumen actual y del próximo resumen). La edición de las fechas del ciclo SHALL delegar en la edición de fechas de período (cascada del borde y bloqueos de período pagado ya especificados), persistiendo **primero el período actual** y luego el próximo, y solo las fechas que cambiaron.

Los campos `type`, `network_id` y `other_network_name` SHALL ser inmutables post-creación: la red SHALL mostrarse como **chip read-only con candado** (no como un campo editable). Las monedas activas se rigen por bimoneda por defecto y NO se editan desde este formulario. Para cambiar la red, el usuario debe eliminar y recrear (solo posible si no tiene transacciones).

El drawer SHALL mostrar una **vista previa en vivo** que refleja nombre, inicial del avatar (derivada del nombre), red, banco, límite (con barra contra el monto comprometido) y un mini-diagrama de ciclo cierre→vence; el color de acento lo define el backend y no es un campo. El drawer SHALL ofrecer **archivar** (sujeto al check de deuda) y **eliminar** (habilitado solo si la tarjeta no tiene/tuvo movimientos; deshabilitado con copy explicativo en caso contrario). El botón Guardar SHALL estar deshabilitado mientras no haya cambios, y al cerrar con cambios sin guardar el sistema SHALL pedir confirmación de descarte.

#### Scenario: Editar abre el drawer sobre el detalle

- **WHEN** el usuario activa "Editar" en el detalle de una tarjeta activa
- **THEN** el drawer entra desde la derecha sobre el detalle
- **AND** el formulario aparece precargado con los datos reales de la tarjeta

#### Scenario: La ruta directa sigue funcionando como fallback

- **WHEN** el usuario navega directamente a `/cards/[id]/edit`
- **THEN** el formulario se renderiza en página con la misma lógica que el drawer

#### Scenario: Cambiar nombre de tarjeta

- **WHEN** el usuario cambia el nombre "Mi tarjeta" a "Visa Galicia"
- **THEN** `accounts.name` se actualiza y el resto de la tarjeta queda intacto

#### Scenario: Cambiar límite de crédito

- **WHEN** el usuario actualiza `credit_limit` de `$1.000.000` a `$1.500.000`
- **THEN** el campo se actualiza y los cálculos de "% disponible" se recalculan en la próxima lectura

#### Scenario: La red se muestra read-only y no se puede cambiar

- **WHEN** el usuario abre el drawer de edición
- **THEN** la red aparece como chip seleccionado read-only con candado
- **AND** un intento de cambiar `network_id` vía API es rechazado por el schema y la tarjeta queda intacta

#### Scenario: Editar las fechas del ciclo desde el drawer

- **WHEN** el usuario edita el cierre y/o vencimiento del resumen actual o del próximo y guarda
- **THEN** el sistema persiste primero las fechas del período actual (cascadeando el borde con el próximo si corresponde) y luego las del próximo
- **AND** se aplican las validaciones (vto > cierre, próximo cierre > cierre actual, próximo vto > próximo cierre) y los bloqueos de período pagado

#### Scenario: Eliminar deshabilitado con movimientos, archivar ofrecido

- **WHEN** la tarjeta tiene/tuvo movimientos
- **THEN** el botón Eliminar queda deshabilitado con copy explicativo
- **AND** Archivar queda disponible como acción recomendada
