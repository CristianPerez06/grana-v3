# Spec: guidance — first movement tour

## ADDED Requirements

### Requirement: Tour guiado del primer movimiento

El primer movimiento DEBE (MUST) educarse mediante un tour guiado tipo spotlight,
no con hints de texto pasivos.

#### Scenario: Arranque automático para usuario sin movimientos

- **GIVEN** un usuario sin ningún movimiento registrado
- **AND** el tour `first_movement.tour` no fue completado ni omitido
- **WHEN** abre el drawer de nuevo movimiento con el tab en Gasto o Ingreso
- **THEN** el tour arranca automáticamente en el paso 1 (Monto)
- **AND** el resto del formulario se ve atenuado y solo el campo del paso actual queda iluminado

#### Scenario: Recorrido de los pasos

- **GIVEN** el tour está activo
- **WHEN** el usuario toca "Siguiente"
- **THEN** el spotlight avanza al próximo campo en el orden Monto → Cuenta → Categoría → Descripción → Guardar
- **AND** el globo muestra el progreso y el copy de ese paso (qué es y para qué sirve)

#### Scenario: Cierre por finalización

- **GIVEN** el usuario está en el paso de cierre (Guardar)
- **WHEN** toca el botón de finalizar
- **THEN** el tour se cierra
- **AND** se marca `completed_at` para `first_movement.tour`
- **AND** no vuelve a aparecer en próximas aperturas del drawer

#### Scenario: Omitir el tour

- **GIVEN** el tour está activo en cualquier paso
- **WHEN** el usuario toca "Omitir guía"
- **THEN** el tour se cierra
- **AND** se marca `dismissed_at` para `first_movement.tour`
- **AND** no vuelve a aparecer

#### Scenario: Usuario con movimientos no ve el tour

- **GIVEN** un usuario que ya tiene al menos un movimiento
- **WHEN** abre el drawer de nuevo movimiento
- **THEN** el tour no aparece

#### Scenario: El tour no aplica a tabs sin esos campos

- **GIVEN** el tour podría aplicar
- **WHEN** el tab activo es Transferencia, Ajuste o Cambio
- **THEN** el tour no se muestra (esos flujos no comparten los campos guiados)

### Requirement: Primitivo CoachmarkTour reutilizable

DEBE (MUST) existir un componente `CoachmarkTour` genérico, sin dependencias
externas, que reciba una lista de pasos (cada uno con un target, título y
descripción) y un contenedor donde resolver los targets.

#### Scenario: Spotlight sobre el target

- **WHEN** un paso está activo
- **THEN** el componente mide el target y dibuja un overlay oscuro con un recorte iluminado sobre ese elemento
- **AND** posiciona un globo con título, descripción, progreso y acciones cerca del target

#### Scenario: Re-medición ante scroll/resize

- **GIVEN** el target está dentro de un contenedor scrolleable
- **WHEN** el contenido scrollea o la ventana cambia de tamaño
- **THEN** el spotlight y el globo se reubican sobre el target

## REMOVED Requirements

### Requirement: Primer movimiento web con InlineGuides (NO invasivo: solo 3 campos)

**Reason:** El feedback de QA indicó que los hints de texto gris no se ven ni
guían. Se reemplazan por el tour guiado.

**Migration:** Los 3 `InlineGuide` (`first_movement.type`, `.account`,
`.category`) se quitan del formulario. La persistencia pasa a un único id
`first_movement.tour`. El primitivo `InlineGuide` permanece disponible para otros
usos futuros.
