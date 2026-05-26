## ADDED Requirements

### Requirement: El sidebar organiza su contenido en header fijo, nav scrolleable y footer sticky

El sidebar island SHALL estructurar su contenido en tres zonas verticales:

- **Header fijo**: el logo `grana` arriba, que NO scrollea (`flex-shrink:0`).
- **Nav central scrolleable**: la navegación primaria ocupa la zona central flexible (`flex:1; min-height:0`) y SHALL scrollear internamente (`overflow-y:auto`) cuando los ítems superan el alto disponible del island.
- **Footer sticky**: Configuración + Cerrar sesión quedan anclados al fondo del island (`flex-shrink:0`), separados de la zona scrolleable por un divisor.

El footer (Configuración, Cerrar sesión) SHALL permanecer alcanzable sin importar cuántos ítems de navegación existan. Este requirement complementa el requirement "El `<main>` es el contenedor scrollable; el body no scrollea": el scroll de la nav es **interno al island** y es independiente del scroll del `<main>`.

#### Scenario: El sidebar muestra header arriba, nav al medio y footer al fondo

- **WHEN** un usuario carga la app en un viewport ≥ 768px
- **THEN** el logo `grana` aparece fijo en la parte superior del island
- **AND** la navegación primaria aparece en la zona central
- **AND** Configuración y Cerrar sesión aparecen al fondo del island, separados por un divisor

#### Scenario: La nav scrollea internamente cuando los ítems superan el alto

- **WHEN** la cantidad de ítems de navegación supera el alto disponible del island
- **THEN** la zona de navegación scrollea internamente
- **AND** el logo (header) y el footer (Configuración, Cerrar sesión) permanecen fijos y visibles

#### Scenario: El footer es siempre alcanzable

- **WHEN** el island tiene muchos ítems de navegación
- **THEN** Configuración y Cerrar sesión siguen visibles al fondo sin necesidad de scrollear el contenido de la página
