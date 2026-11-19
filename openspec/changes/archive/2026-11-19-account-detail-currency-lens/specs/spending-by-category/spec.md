## MODIFIED Requirements

### Requirement: El módulo Movimientos abre con un desglose de gastos por categoría del mes

El módulo de movimientos SHALL presentar, en **ambas plataformas** (web `/transactions` y la pantalla nativa Movimientos), como carta de presentación arriba del listado, un **desglose de los gastos del mes agrupados por categoría**, que responde "¿en qué se fue?". El listado de movimientos SHALL seguir accesible (el desglose lo antecede, no lo reemplaza).

La navegación por mes de la pantalla SHALL estar unificada en **un único control**, que determina a la vez el mes del desglose y el del listado. La **ubicación** de ese control es idiomática por plataforma y NO SHALL fijarse en este spec:

- **Web** lo lleva **dentro** del desglose: la ruta no tiene otro control de mes, y el bar de filtros del listado no lo duplica.
- **Nativo** lo lleva **arriba de la pantalla** (`MonthNavigator`), porque ese control ya existe y gobierna además el feed, las recurrencias pendientes y los reintegros pendientes. La card nativa **lee** el mes y NO SHALL renderizar un selector propio.

Lo que SHALL sostenerse en las dos es la invariante: **un solo** control de mes visible por pantalla, y el desglose y el listado siempre sobre el mismo mes.

#### Scenario: El overview por categoría encabeza Movimientos

- **WHEN** el usuario abre `/transactions` en web
- **THEN** ve arriba un desglose de los gastos del mes por categoría
- **AND** el listado de movimientos sigue disponible debajo

#### Scenario: El overview por categoría encabeza Movimientos en nativo

- **WHEN** el usuario abre la pantalla Movimientos en la app nativa
- **THEN** ve la card "En qué se fue" entre el selector de mes y los botones de ícono de búsqueda y filtros, los mismos que la web dibuja sobre su lista
- **AND** el feed de movimientos sigue disponible debajo

#### Scenario: Un único selector de mes

- **WHEN** el usuario está en el módulo Movimientos, en cualquiera de las dos plataformas
- **THEN** hay un solo control de mes visible
- **AND** ese control determina el mes del desglose y el del listado

#### Scenario: La card nativa no duplica el selector de mes

- **WHEN** el usuario abre la pantalla Movimientos en nativo
- **THEN** el único control de mes es el `MonthNavigator` de la pantalla
- **AND** la card "En qué se fue" NO muestra flechas de mes propias
- **AND** navegar de mes con ese control recalcula el donut, el ranking y el feed juntos

---

