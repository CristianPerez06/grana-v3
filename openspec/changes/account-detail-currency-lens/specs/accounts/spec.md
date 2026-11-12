## REMOVED Requirements

### Requirement: El detalle de cuenta en mobile muestra saldos, movimientos y reintegros (mobile)

**Reason**: Pedía los dos saldos por fila y las dos patas del cambio en la misma fila. Se reemplaza por "El detalle de cuenta en mobile muestra saldos, movimientos y reintegros, de a una moneda (mobile)", que sigue la regla de un libro por vez de la web.
**Migration**: Ninguna de datos.

## ADDED Requirements

### Requirement: El detalle de cuenta en mobile muestra saldos, movimientos y reintegros, de a una moneda (mobile)

La pantalla `accounts/[id]/index` SHALL mostrar un hero con la identidad de la cuenta (avatar, nombre, institución/tipo, badge Archivada si aplica) y los saldos ARS/USD totales, obtenidos de `getAccountDetail` de `@grana/accounts`. SHALL mostrar la lista de movimientos de la cuenta usando `getAccountMovementsAscending` de `@grana/transactions`. La presentación SHALL replicar la del web app en viewport de celular, con las mismas reglas (spec `transactions`, requirement "El listado de una cuenta muestra el saldo corriente por fila, de a una moneda"): cada fila muestra fecha/descripción + monto con tono y, debajo del monto, el **saldo corriente** de la moneda que se está viendo; una cuenta que usa las dos monedas muestra el selector **ARS | USD** arriba de la lista, con el mismo aspecto que el selector de moneda de «¿En qué gasté?» nativo, y arranca en ARS; un cambio de moneda dentro de la misma cuenta aparece en las dos monedas; el selector y el filtro de moneda de la hoja de filtros son el mismo estado; y el saldo se oculta mientras haya filtros de contenido (tipo, categoría, subcategoría, rango de monto) o una búsqueda, pero no por la moneda elegida. El saldo corriente SHALL calcularse con `computeRunningBalances` de `@grana/money-logic` sobre el historial ascendente que la pantalla ya carga, partiendo del saldo inicial por moneda de la cuenta; NO SHALL pedir datos nuevos al servidor. El signo/monto por fila desde la perspectiva de la cuenta SHALL derivarse de `resolveMovementView` y `legInCurrency` de `@grana/money-logic`, sin reimplementar la lógica de patas (transferencias/cambios) en mobile. El tono del monto SHALL derivarse de `resolveTone` de `@grana/transactions`, igual que la web y el feed nativo (una transferencia o un cambio entre cuentas propias se ve neutro), y el signo SHALL ir pegado al monto como en la web (`-$ 480`). SHALL mostrar la card de reintegros pendientes ("A confirmar") usando `getPendingReimbursements` de `@grana/transactions` scopeado a la cuenta. SHALL ofrecer un acceso a agregar moneda cuando haya monedas disponibles.

#### Scenario: El detalle muestra saldos y movimientos (mobile)

- **WHEN** el usuario abre el detalle de una cuenta con movimientos
- **THEN** el hero muestra los saldos ARS/USD y la pantalla lista los movimientos de la cuenta
- **AND** la card "A confirmar" lista los reintegros pendientes de esa cuenta si existen

#### Scenario: La presentación de movimientos replica el web app en mobile (mobile)

- **WHEN** la pantalla renderiza la lista de movimientos sin filtros de contenido
- **THEN** cada fila muestra fecha/descripción + monto con tono y, debajo del monto, el saldo corriente de la moneda que se está viendo, igual que la web en viewport de celular
- **AND** el signo/monto por fila desde la perspectiva de la cuenta se deriva de `resolveMovementView` de `@grana/money-logic`, sin reimplementar la lógica en mobile

#### Scenario: Un cambio de moneda se ve con el mismo tono que en la web (mobile)

- **WHEN** el detalle de cuenta muestra un cambio de moneda o una transferencia entre cuentas propias
- **THEN** el monto se ve en tono neutro y con el signo pegado (`-$ 3.859.134`), igual que la web en viewport de celular

#### Scenario: Una cuenta con pesos y dólares se ve de a una moneda (mobile)

- **WHEN** el usuario abre el detalle de una cuenta que usa ARS y USD y elige USD en el selector
- **THEN** la lista muestra solo el libro en dólares, con el saldo USD de cada fila igual al que muestra la web

#### Scenario: Un filtro oculta el saldo corriente, la moneda no (mobile)

- **WHEN** el usuario aplica un filtro de tipo, categoría o monto, o escribe una búsqueda
- **THEN** las filas dejan de mostrar el saldo corriente
- **AND** elegir solo la moneda no lo oculta
