## MODIFIED Requirements

### Requirement: El detalle de tarjeta muestra movimientos del período y cuotas en curso en pestañas

El sistema SHALL ofrecer en el detalle de tarjeta (`/cards/[id]`) dos pestañas: **"Movimientos del período"** y **"Cuotas en curso · N"** (donde N es la cantidad de compras en cuotas activas de la tarjeta).

**Selección de período.** El click en un paso del timeline, en la card "a pagar", en la card "en curso" o en la mini fila "próximo" SHALL cambiar el período mostrado en "Movimientos del período" y volver a esa pestaña. El elemento activo recibe un ring con el acento de la tarjeta. La transición NO usa `scrollIntoView` ni animación de entrada del pane.

**Pane "Movimientos del período".** SHALL listar los movimientos imputados al período seleccionado, agrupados por fecha, reutilizando el componente de fila de movimiento del módulo de transacciones. Cada fila muestra ícono de categoría con tint, comercio/descripción, caption "Categoría › Subcategoría", chips ("Cuota X de Y" y/o "Recurrente"), y el monto (ARS gasto en terracota; USD con su símbolo `US$` delante del número, nunca convertido, sin una etiqueta "USD" extra debajo, que repetía lo que el símbolo ya dice). Cuando el período no tiene consumos, SHALL mostrar el estado vacío "Sin movimientos".

**Pane "Cuotas en curso".** SHALL mostrar una card intro con la cantidad de compras en cuotas y el total restante, y luego una card por compra con: ícono, nombre, sub ("Comprado el X · Categoría"), "cuota actual / total", una fila de dots de progreso (pagadas en acento, próxima en acento atenuado, futuras en gris), y un footer (Por cuota / Restante / Próxima cae). Cuando no hay compras en cuotas activas, SHALL mostrar el estado vacío "Sin compras en cuotas". Las cuotas son ARS-only (`I-CRED-9`).

#### Scenario: Cambiar de período actualiza los movimientos mostrados

- **WHEN** el usuario está viendo los movimientos del resumen "a pagar" y hace click en el paso "En curso" del timeline
- **THEN** el pane "Movimientos del período" pasa a mostrar los movimientos del período en curso
- **AND** la pestaña activa vuelve a ser "Movimientos del período"
- **AND** el paso "En curso" recibe el ring de acento

#### Scenario: Movimiento en cuotas muestra el chip "Cuota X de Y"

- **WHEN** el período seleccionado contiene la cuota 2 de 6 de una compra
- **THEN** la fila del movimiento muestra el chip "Cuota 2 de 6"

#### Scenario: Período sin movimientos muestra el estado vacío

- **WHEN** el período seleccionado no tiene consumos imputados
- **THEN** el pane muestra "Sin movimientos"

#### Scenario: La pestaña de cuotas muestra el contador y el total restante

- **WHEN** la tarjeta tiene 2 compras en cuotas activas con un total restante de `$1.160.000`
- **THEN** la pestaña se titula "Cuotas en curso · 2"
- **AND** el pane muestra una card intro con el total restante `$1.160.000`

#### Scenario: Card de cuota muestra los dots de progreso

- **WHEN** una compra va por la cuota 1 de 3
- **THEN** su card muestra 3 dots: el primero en acento (pagada/actual), el segundo en acento atenuado (próxima), el tercero en gris (futura)
- **AND** el footer muestra "Por cuota", "Restante" y "Próxima cae"

#### Scenario: Tarjeta sin cuotas muestra el estado vacío

- **WHEN** la tarjeta no tiene compras en cuotas activas
- **THEN** la pestaña se titula "Cuotas en curso · 0" y el pane muestra "Sin compras en cuotas"
