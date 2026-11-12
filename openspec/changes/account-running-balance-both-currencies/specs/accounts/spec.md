## MODIFIED Requirements

### Requirement: El detalle de cuenta en mobile muestra saldos, movimientos y reintegros (mobile)

La pantalla `accounts/[id]/index` SHALL mostrar un hero con la identidad de la cuenta (avatar, nombre, institución/tipo, badge Archivada si aplica) y los saldos ARS/USD totales, obtenidos de `getAccountDetail` de `@grana/accounts`. SHALL mostrar la lista de movimientos de la cuenta usando `getAccountMovementsAscending` de `@grana/transactions`. La presentación SHALL replicar la del web app en viewport de celular: cada fila muestra fecha/descripción + monto con tono y, debajo del monto, el **saldo corriente por fila** con las mismas reglas que la web (spec `transactions`, requirement "El listado de una cuenta muestra el saldo corriente por fila"): un saldo por cada moneda que la cuenta usa, ARS arriba y USD debajo; las dos patas del monto en un cambio de moneda dentro de la misma cuenta; y el saldo oculto mientras haya filtros de contenido activos (tipo, categoría, subcategoría, moneda, rango de monto o búsqueda de texto). El saldo corriente SHALL calcularse con `computeRunningBalances` de `@grana/money-logic` sobre el historial ascendente que la pantalla ya carga, partiendo del saldo inicial por moneda de la cuenta; NO SHALL pedir datos nuevos al servidor. El signo/monto por fila desde la perspectiva de la cuenta SHALL derivarse de `resolveMovementView` de `@grana/money-logic`, sin reimplementar la lógica de patas (transferencias/cambios) en mobile. SHALL mostrar la card de reintegros pendientes ("A confirmar") usando `getPendingReimbursements` de `@grana/transactions` scopeado a la cuenta. SHALL ofrecer un acceso a agregar moneda cuando haya monedas disponibles.

#### Scenario: El detalle muestra saldos y movimientos (mobile)

- **WHEN** el usuario abre el detalle de una cuenta con movimientos
- **THEN** el hero muestra los saldos ARS/USD y la pantalla lista los movimientos de la cuenta
- **AND** la card "A confirmar" lista los reintegros pendientes de esa cuenta si existen

#### Scenario: La presentación de movimientos replica el web app en mobile (mobile)

- **WHEN** la pantalla renderiza la lista de movimientos sin filtros de contenido
- **THEN** cada fila muestra fecha/descripción + monto con tono y, debajo del monto, el saldo corriente con la misma cantidad de saldos que la web en viewport de celular
- **AND** el signo/monto por fila desde la perspectiva de la cuenta se deriva de `resolveMovementView` de `@grana/money-logic`, sin reimplementar la lógica en mobile

#### Scenario: Una cuenta con pesos y dólares muestra ambos saldos (mobile)

- **WHEN** el usuario abre el detalle de una cuenta que usa ARS y USD
- **THEN** cada fila muestra el saldo ARS y, debajo, el saldo USD resultantes después de ese movimiento, iguales a los que muestra la web para esa fila

#### Scenario: Un filtro oculta el saldo corriente (mobile)

- **WHEN** el usuario aplica un filtro o escribe una búsqueda en el detalle de la cuenta
- **THEN** las filas dejan de mostrar el saldo corriente
