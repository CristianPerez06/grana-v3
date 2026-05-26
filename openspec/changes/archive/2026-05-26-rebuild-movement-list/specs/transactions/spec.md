## ADDED Requirements

### Requirement: El listado de movimientos usa una fila única resuelta por perspectiva

El sistema SHALL renderizar todas las filas de movimiento —tanto en el módulo global `/transactions` como en la lista del detalle de una cuenta— con un **único componente de fila**. La presentación de cada movimiento (signo, monto relevante, moneda mostrada y contraparte) SHALL resolverse mediante una función pura `resolveMovementView(movimiento, perspectiva)` que vive en `@grana/money-logic`, parametrizada por una **perspectiva**:

- Perspectiva `global`: punto de vista neutral; un movimiento con dos cuentas (transferencia, cambio de moneda) muestra ambas puntas y la cuenta participante en el subtítulo.
- Perspectiva de cuenta: punto de vista egocéntrico desde una cuenta; el movimiento se reinterpreta por cómo afecta a esa cuenta (signo entrante/saliente, qué pata del cambio de moneda, contraparte) y se omite la propia cuenta del subtítulo por redundante.

No SHALL existir lógica de presentación de fila duplicada entre las dos vistas: ambas consumen el mismo resolver y el mismo componente.

#### Scenario: La misma fila sirve a la vista global y a la de cuenta

- **WHEN** el sistema renderiza un gasto en `/transactions` y luego el mismo gasto en el detalle de su cuenta
- **THEN** ambas filas se renderizan con el mismo componente y el mismo resolver
- **AND** los marcadores de estado del movimiento (recurrencia, revisión) aparecen en las dos vistas por igual

#### Scenario: La perspectiva global muestra ambas puntas de una transferencia

- **WHEN** el sistema renderiza una transferencia A → B en `/transactions`
- **THEN** la fila muestra origen y destino ("A → B") sin signo de entrada ni de salida atado a una cuenta

#### Scenario: La perspectiva de cuenta reinterpreta la transferencia

- **WHEN** el sistema renderiza la transferencia A → B en el detalle de la cuenta A y luego en el de la cuenta B
- **THEN** en A la fila muestra signo `−` y contraparte "→ B"
- **AND** en B la fila muestra signo `+` y contraparte "← A"

#### Scenario: La perspectiva de cuenta elige la pata del cambio de moneda

- **WHEN** existe un cambio de moneda con pata origen en la cuenta A (ARS) y pata destino en la cuenta B (USD), y el sistema lo renderiza en el detalle de A
- **THEN** la fila muestra el monto y la moneda de la pata que afecta a A (salida en ARS)
- **AND** al renderizarlo en el detalle de B muestra el monto y la moneda de la pata destino (entrada en USD)

---

### Requirement: La fila de movimiento muestra ícono de categoría, jerarquía y color semántico

El sistema SHALL renderizar cada fila de movimiento con la siguiente anatomía visual:

- **Ícono** según dos familias: los movimientos categorizables (ingreso, gasto, compra en cuotas) SHALL mostrar el emoji y color de su categoría; los movimientos de estructura (transferencia, cambio de moneda, ajuste, pago de resumen) SHALL mostrar un ícono neutro propio de su tipo.
- **Jerarquía** de texto invertida: el título primario SHALL ser la descripción que escribió el usuario; el subtítulo secundario SHALL ser la categoría y, en modo experto, la cuenta (`categoría · cuenta`). Si el movimiento no tiene descripción, el título primario SHALL caer a la categoría o al nombre funcional del tipo.
- **Color del monto** semántico: ingreso en verde; gasto (incluidos consumos y cuotas de tarjeta) en rojo; ajuste positivo en verde y negativo en rojo; transferencia y cambio de moneda en color neutro (no son ingreso ni gasto).
- **Etiqueta de moneda** fiel al principio bimoneda: ARS no SHALL llevar etiqueta de moneda (es la primaria); USD SHALL mostrarse etiquetada.

La cuenta en el subtítulo SHALL mostrarse únicamente en modo experto; en modo novato se omite.

#### Scenario: Un gasto muestra el emoji y color de su categoría

- **WHEN** el sistema renderiza un gasto categorizado como "Comida"
- **THEN** la fila muestra el emoji y color de esa categoría como ícono
- **AND** el monto se muestra en rojo

#### Scenario: Una transferencia muestra ícono neutro

- **WHEN** el sistema renderiza una transferencia
- **THEN** la fila muestra un ícono de estructura neutro (no un emoji de categoría)
- **AND** el monto se muestra en color neutro

#### Scenario: La descripción es el título primario

- **WHEN** el usuario registró un gasto "Coto" categorizado como "Comida"
- **THEN** la fila muestra "Coto" como título primario y "Comida" como subtítulo

#### Scenario: Sin descripción el título cae a la categoría

- **WHEN** el sistema renderiza un gasto sin descripción categorizado como "Transporte"
- **THEN** la fila muestra "Transporte" como título primario

#### Scenario: La cuenta en el subtítulo depende del modo

- **WHEN** un usuario en modo experto ve un gasto en el listado global
- **THEN** el subtítulo incluye la cuenta (`categoría · cuenta`)
- **AND** el mismo gasto para un usuario en modo novato muestra solo la categoría

#### Scenario: La etiqueta de moneda respeta bimoneda

- **WHEN** el sistema renderiza un movimiento en ARS y otro en USD
- **THEN** el de ARS no muestra etiqueta de moneda y el de USD se muestra etiquetado como USD

---

### Requirement: La fila de movimiento muestra marcadores de estado

El sistema SHALL mostrar en la fila los marcadores de estado aplicables al movimiento, sin alterar su impacto contable:

- **Recurrencia**: indicador cuando el movimiento fue generado por una regla recurrente.
- **Revisión**: indicador cuando el movimiento tiene flags de revisión (sin categoría, cotización faltante).
- **Cuota**: para una cuota de tarjeta, la posición de la cuota (`3/6`).
- **Pendiente**: para un consumo de tarjeta cuyo período aún no fue pagado.

Los marcadores de recurrencia y revisión SHALL aparecer tanto en el listado global como en el de cuenta. Los grupos de fecha del listado SHALL usar etiquetas relativas ("Hoy", "Ayer") y fecha para días anteriores.

#### Scenario: Movimiento recurrente y a revisar conservan sus marcadores en ambas vistas

- **WHEN** un gasto generado por una recurrencia y sin categoría se muestra en `/transactions` y en el detalle de su cuenta
- **THEN** en ambas vistas la fila muestra el indicador de recurrencia y el de revisión

#### Scenario: Una cuota muestra su posición

- **WHEN** el sistema renderiza la tercera cuota de una compra en 6 cuotas
- **THEN** la fila muestra el marcador "3/6"

#### Scenario: Un consumo de tarjeta no pagado se marca pendiente

- **WHEN** el sistema renderiza un consumo de tarjeta cuyo período no fue pagado
- **THEN** la fila muestra el marcador "pendiente"

#### Scenario: Los grupos de fecha usan etiquetas relativas

- **WHEN** el listado agrupa movimientos del día actual, del día anterior y de días previos
- **THEN** los encabezados muestran "Hoy", "Ayer" y la fecha respectivamente

---

### Requirement: El listado de movimientos no muestra totales agregados

El listado de movimientos NO SHALL mostrar totales por día en los encabezados de fecha. El resumen del período (lo que entró y salió por moneda, y lo comprometido en tarjetas) es responsabilidad del **dashboard**, no del listado, para no duplicar el panorama mensual. La lógica pura de ese resumen (`summarizePeriod`, por moneda, regla del dashboard, comprometido = cuotas devengadas) vive en `@grana/money-logic` lista para que el dashboard la consuma.

#### Scenario: Los encabezados de fecha no muestran totales

- **WHEN** el sistema agrupa los movimientos por fecha
- **THEN** cada encabezado muestra solo la fecha (relativa), sin un total del día

---

### Requirement: El listado de una cuenta muestra el saldo corriente por fila

En la perspectiva de cuenta, el sistema SHALL mostrar junto a cada fila el saldo corriente (running balance) de la cuenta resultante después de ese movimiento, calculado por moneda. El saldo corriente SHALL derivarse del historial de transacciones; NO SHALL persistirse en ninguna columna.

El saldo corriente SHALL mostrarse únicamente cuando se ven todos los movimientos de la cuenta en orden, sin filtros activos; cuando hay un filtro aplicado (búsqueda, tipo, categoría, rango parcial) el saldo corriente SHALL ocultarse, porque un acumulado parcial sería incorrecto. En la perspectiva global el saldo corriente NO SHALL mostrarse (mezclaría cuentas y monedas).

#### Scenario: Cada fila muestra el saldo resultante por moneda

- **WHEN** el usuario abre el detalle de una cuenta sin filtros
- **THEN** cada fila muestra el saldo de la cuenta en la moneda del movimiento, resultante después de ese movimiento

#### Scenario: El saldo corriente se oculta al filtrar

- **WHEN** el usuario aplica un filtro de categoría en el detalle de la cuenta
- **THEN** el saldo corriente por fila se oculta

#### Scenario: El listado global no muestra saldo corriente

- **WHEN** el usuario abre `/transactions`
- **THEN** las filas no muestran saldo corriente
