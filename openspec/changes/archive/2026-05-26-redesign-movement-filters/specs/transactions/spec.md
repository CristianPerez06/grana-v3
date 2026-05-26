## MODIFIED Requirements

### Requirement: El módulo global de movimientos permite búsqueda y filtros

El sistema SHALL permitir filtrar el listado global de movimientos por texto, tipo de movimiento, categoría, cuenta, **moneda** y **rango de monto**, y navegar el período **por mes**. Los filtros SHALL estar representados en la URL para que la pantalla sea compartible, recargable y navegable con back/forward del browser.

La UI de filtros SHALL ser una **barra compacta** (búsqueda + navegación por mes + botón "Filtros" con un contador de filtros activos); los filtros detallados (tipo, categoría, cuenta, moneda, rango de monto) SHALL vivir en un **panel desplegable**, y los filtros activos SHALL mostrarse como **chips removibles** bajo la barra, junto con una acción "Limpiar todo". La búsqueda SHALL ser **instantánea** (sin botón de aplicar, con un breve debounce) y SHALL buscar en **todo el historial** del usuario, no solo en los movimientos ya paginados.

El período SHALL navegarse **por mes** (mes anterior / mes siguiente) como control primario; por defecto SHALL mostrarse el **mes actual** (computado en la zona horaria financiera con `getTodayAR()`), conservando una opción de rango personalizado que tiene prioridad sobre el mes. En **modo novato** el filtro por cuenta NO SHALL mostrarse.

#### Scenario: Buscar por descripción de forma instantánea

- **WHEN** el usuario tipea en la búsqueda
- **THEN** el sistema filtra (con un breve debounce) los movimientos cuya descripción o texto visible coincida, sin requerir un botón de aplicar
- **AND** la coincidencia se busca en todo el historial, no solo en la página actual
- **AND** mantiene el término de búsqueda en la URL

#### Scenario: Navegación por mes como período por defecto

- **WHEN** el usuario abre `/transactions` sin un período en la URL
- **THEN** el sistema muestra los movimientos del mes actual (según `getTodayAR()`)
- **AND** el usuario puede navegar al mes anterior o siguiente con las flechas
- **AND** interpreta las fechas como fecha contable, no como timestamp UTC

#### Scenario: Rango personalizado

- **WHEN** el usuario define un rango de fechas personalizado
- **THEN** el sistema muestra los movimientos de ese rango
- **AND** el rango personalizado tiene prioridad sobre el mes seleccionado

#### Scenario: Filtrar por moneda

- **WHEN** el usuario filtra por ARS o por USD
- **THEN** el sistema muestra solo los movimientos de esa moneda
- **AND** nunca combina ni convierte montos de monedas distintas

#### Scenario: Filtrar por cuenta solo en modo experto

- **WHEN** un usuario experto filtra por una cuenta específica
- **THEN** el sistema muestra movimientos donde esa cuenta participa como origen, destino, cuenta de pago o tarjeta relacionada según el tipo funcional del movimiento
- **AND** en modo novato el filtro por cuenta no se ofrece

#### Scenario: Filtros activos como chips removibles

- **WHEN** hay uno o más filtros aplicados
- **THEN** el sistema los muestra como chips removibles bajo la barra y un contador en el botón "Filtros"
- **AND** quitar un chip elimina ese filtro de la URL y reconsulta

### Requirement: El listado de una cuenta muestra el saldo corriente por fila

En la perspectiva de cuenta, el sistema SHALL mostrar junto a cada fila el saldo corriente (running balance) de la cuenta resultante después de ese movimiento, calculado por moneda. El saldo corriente SHALL derivarse del historial de transacciones; NO SHALL persistirse en ninguna columna.

El saldo corriente SHALL mostrarse cuando se ven los movimientos de la cuenta en orden, **incluida la navegación por mes**: navegar de mes es navegación temporal, no un filtro de contenido, y el saldo se recalcula sobre el historial previo al mes visible. Los **filtros de contenido** (búsqueda de texto, tipo, categoría, rango de monto) SÍ ocultan el saldo corriente, porque saltean filas y un acumulado parcial sería incorrecto. En la perspectiva global el saldo corriente NO SHALL mostrarse (mezclaría cuentas y monedas).

#### Scenario: Cada fila muestra el saldo resultante por moneda

- **WHEN** el usuario abre el detalle de una cuenta sin filtros de contenido
- **THEN** cada fila muestra el saldo de la cuenta en la moneda del movimiento, resultante después de ese movimiento

#### Scenario: Navegar por mes no oculta el saldo corriente

- **WHEN** el usuario navega a otro mes en el detalle de la cuenta (sin filtros de contenido)
- **THEN** el saldo corriente se sigue mostrando, recalculado con el historial previo al mes visible

#### Scenario: Los filtros de contenido ocultan el saldo corriente

- **WHEN** el usuario aplica un filtro de tipo, categoría, búsqueda de texto o rango de monto en el detalle de la cuenta
- **THEN** el saldo corriente por fila se oculta

#### Scenario: El listado global no muestra saldo corriente

- **WHEN** el usuario abre `/transactions`
- **THEN** las filas no muestran saldo corriente
