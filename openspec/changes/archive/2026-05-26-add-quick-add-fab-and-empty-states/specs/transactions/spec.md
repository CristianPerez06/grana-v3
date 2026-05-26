## ADDED Requirements

### Requirement: El usuario tiene un acceso rápido flotante para registrar un movimiento

El sistema SHALL ofrecer un **acceso rápido flotante** (FAB) para registrar un movimiento, visible en el listado global de Movimientos y en el dashboard, de modo que el usuario pueda iniciar un alta sin volver al header mientras navega o scrollea. El acceso SHALL abrir el flujo de alta canónico (`/transactions/new`). El FAB convive con los accesos de header existentes; no los reemplaza.

#### Scenario: FAB visible en Movimientos y dashboard

- **WHEN** el usuario autenticado abre `/transactions` o el dashboard
- **THEN** ve un acceso flotante para registrar un movimiento, visible aunque haya scrolleado la pantalla
- **AND** al activarlo accede a `/transactions/new`

#### Scenario: El FAB no aparece donde no corresponde

- **WHEN** el usuario está en una pantalla que no es Movimientos ni el dashboard
- **THEN** el acceso flotante no se muestra (los accesos de esa pantalla son los suyos propios)

### Requirement: El listado global distingue el motivo de un resultado vacío

Cuando el listado global de Movimientos no tiene resultados, el sistema SHALL mostrar un estado vacío acorde al **motivo**, no un único mensaje genérico. SHALL distinguir tres variantes:

- **Sin movimientos** (no hay búsqueda ni filtros de contenido activos): un mensaje de bienvenida y una acción para **registrar el primer movimiento**.
- **Sin resultados de búsqueda** (hay un término de búsqueda activo): un mensaje que indica que no se encontraron coincidencias y una acción para **limpiar la búsqueda**.
- **Sin resultados de filtro** (hay filtros de contenido activos — tipo, categoría, cuenta, moneda o rango de monto): un mensaje que indica que ningún movimiento cumple los filtros y una acción para **limpiar los filtros**.

La **navegación por mes** NO cuenta como filtro de contenido para esta clasificación (es una ventana temporal, no un filtro): un mes sin movimientos y sin otros filtros SHALL mostrar la variante "sin movimientos". El resto —tipo, categoría, cuenta, moneda y rango de monto— SÍ cuenta como filtro. Cuando coexisten búsqueda y filtros, prevalece la variante de **filtro**. Las acciones de limpiar SHALL operar sobre el estado de filtros en la URL (sin recargar la pantalla completa), coherente con la barra de filtros.

#### Scenario: Sin movimientos ofrece registrar el primero

- **WHEN** el usuario abre `/transactions` sin búsqueda ni filtros de contenido y no hay movimientos para mostrar
- **THEN** el sistema muestra un estado de bienvenida con una acción para registrar un movimiento
- **AND** la acción abre `/transactions/new`

#### Scenario: Búsqueda sin resultados ofrece limpiar la búsqueda

- **WHEN** el usuario tiene un término de búsqueda activo y ninguno de sus movimientos coincide
- **THEN** el sistema indica que no se encontraron resultados para ese término
- **AND** ofrece una acción para limpiar la búsqueda

#### Scenario: Filtros sin resultados ofrecen limpiar los filtros

- **WHEN** el usuario tiene filtros de contenido activos (tipo, categoría, cuenta, moneda o rango de monto) y ningún movimiento los cumple
- **THEN** el sistema indica que ningún movimiento cumple los filtros
- **AND** ofrece una acción para limpiar los filtros

#### Scenario: Un mes vacío no se confunde con un filtro sin resultados

- **WHEN** el usuario navega a un mes sin movimientos y no tiene filtros de contenido activos
- **THEN** el sistema muestra la variante "sin movimientos" (no la de filtros)
