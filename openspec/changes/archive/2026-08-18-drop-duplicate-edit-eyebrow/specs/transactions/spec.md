## MODIFIED Requirements

### Requirement: El drawer en modo edición ajusta chrome y CTA

El sistema SHALL precargar el movimiento real al abrir el drawer en modo edición y NO SHALL renderizar el selector de tipo: el tipo es inmutable y se enuncia como fila de contexto read-only. El conjunto de campos editables SHALL derivarse de `getEditableFields` (regla ya especificada para el formulario único). En modo edición el encabezado SHALL mostrar **solo el título** "Editar movimiento", sin eyebrow: un "EDITAR" en versalitas sobre un título que ya empieza con esa palabra la dice dos veces. El CTA SHALL decir "Guardar cambios". El borrado SHALL respetar las reglas existentes (no borrar hijas de cuotas aisladas, no borrar consumos pagados).

#### Scenario: El tipo no se ofrece como control en edición

- **WHEN** el usuario abre un movimiento existente en el drawer de edición
- **THEN** el drawer no muestra selector de tipo, en ningún viewport
- **AND** el tipo aparece como fila de contexto read-only con caption de "no editable"

#### Scenario: CTA en edición

- **WHEN** el drawer está en modo edición
- **THEN** el CTA dice "Guardar cambios"

#### Scenario: Borrado respeta reglas de cuotas

- **WHEN** el usuario intenta eliminar una cuota hija desde la edición
- **THEN** el sistema aplica las reglas de borrado existentes y no permite borrarla aislada

#### Scenario: El encabezado de edición no repite la palabra

- **WHEN** el usuario abre un movimiento en modo edición, en cualquier superficie
- **THEN** el encabezado muestra únicamente "Editar movimiento"
- **AND** NO muestra un eyebrow "EDITAR" encima
