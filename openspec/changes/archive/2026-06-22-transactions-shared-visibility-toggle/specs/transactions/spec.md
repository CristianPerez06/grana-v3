## ADDED Requirements

### Requirement: El listado global permite mostrar u ocultar los movimientos compartidos

El módulo global de movimientos SHALL ofrecer un control en la toolbar (un botón, junto a búsqueda/filtros) que muestra u oculta los movimientos compartidos (`is_shared = true`). Por defecto el control SHALL estar **encendido** (compartidos visibles). Cuando el usuario lo apaga, el listado SHALL consultar únicamente movimientos no compartidos.

A diferencia del resto de los filtros —que viven en React state y se resetean al recargar—, esta preferencia SHALL **persistir por usuario** entre sesiones y recargas: si el usuario la apaga, SHALL permanecer apagada hasta que el usuario la vuelva a encender. El control NO SHALL mostrarse como chip removible ni contar en el contador de "Filtros".

El filtrado SHALL aplicarse en la consulta paginada (RPC), no descartando filas en cliente, para preservar paginación y conteos.

#### Scenario: Por defecto los compartidos se muestran

- **WHEN** un usuario abre `/transactions` por primera vez (sin preferencia guardada)
- **THEN** el control de visibilidad de compartidos está encendido
- **AND** el listado incluye tanto movimientos propios como compartidos

#### Scenario: Ocultar compartidos

- **WHEN** el usuario apaga el control
- **THEN** el listado deja de mostrar los movimientos con `is_shared = true`
- **AND** la sección de movimientos se reconsulta excluyéndolos en la consulta paginada

#### Scenario: La preferencia persiste por usuario

- **WHEN** el usuario apagó el control y luego recarga la página o vuelve más tarde
- **THEN** el control sigue apagado y los compartidos siguen ocultos
- **AND** permanece así hasta que el usuario lo vuelva a encender

#### Scenario: Volver a mostrar compartidos

- **WHEN** el usuario enciende nuevamente el control
- **THEN** el listado vuelve a incluir los movimientos compartidos
- **AND** la preferencia queda guardada como encendida

#### Scenario: El control no es un chip de filtro

- **WHEN** el control de compartidos está apagado
- **THEN** no aparece como chip removible bajo la barra ni incrementa el contador del botón "Filtros"
- **AND** su estado se refleja en el propio botón de la toolbar
