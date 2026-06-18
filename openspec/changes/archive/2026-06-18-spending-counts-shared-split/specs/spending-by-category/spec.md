## ADDED Requirements

### Requirement: El desglose cuenta la parte del miembro en los movimientos compartidos

En un hogar (módulo Compartido), el desglose "En qué se fue" responde "¿en qué se fue **MI** plata?" bajo el modelo de **cuenta corriente**: un movimiento compartido pertenece a cada miembro **por su parte**, no por el total. Por lo tanto, el desglose SHALL contar la **parte de la usuaria** en los movimientos compartidos (gastos y reintegros), no su total:

- Un **gasto compartido** (`is_shared = true`) SHALL contar solo la **parte de la usuaria** = `shared_expense_split.amount_assigned` de la fila cuyo `user_id` es la usuaria. NO SHALL contar el monto total.
- Esto SHALL aplicar **sin importar quién cargó el gasto**: como la RLS del hogar expone los movimientos compartidos de ambos miembros, un gasto compartido cargado por el otro miembro SHALL contar también solo la parte de la usuaria (y NO su total).
- Un movimiento **propio no compartido** (`is_shared = false`) SHALL contar su monto **completo**.
- Si la usuaria **no tiene fila de split** en un gasto compartido (parte 0 / no asignada), ese gasto NO SHALL aparecer en su desglose (es 100% del otro miembro).
- La regla SHALL ser **simétrica para los reintegros compartidos**: un reintegro compartido SHALL netear solo la **parte de la usuaria** (`amount_assigned`), no su total, para no doble-contar contra el gasto ya contado por su parte.

Como la RLS de `shared_expense_split` expone las filas de **ambos** miembros del hogar, la resolución de "la parte de la usuaria" SHALL filtrar explícitamente por su `user_id` (no asumir que el único split visible es el suyo).

El desglose de **ingresos** NO SHALL verse afectado: el ingreso no se comparte (`is_shared` solo aplica a gastos).

#### Scenario: Un gasto compartido cuenta solo mi parte

- **WHEN** hay un gasto compartido de $100.000 al 50% (mi parte $50.000) en categoría Transporte
- **THEN** el desglose cuenta $50.000 en Transporte, no $100.000

#### Scenario: El gasto compartido del otro miembro solo cuenta mi parte

- **WHEN** mi compañero/a cargó una nafta compartida de $101.994 al 50% (mi parte $50.997)
- **THEN** el desglose cuenta $50.997 en su categoría (no $101.994, ni $0)
- **AND** no aparece el total del gasto del otro

#### Scenario: Un compartido sin parte propia no aparece

- **WHEN** hay un gasto compartido en el hogar donde la usuaria tiene 0% (sin fila de split propia)
- **THEN** ese gasto NO aparece en el desglose de la usuaria

#### Scenario: El reintegro compartido netea solo mi parte

- **WHEN** un gasto compartido cuenta por mi parte ($50.000) y recibo un reintegro compartido al 50% de $20.000 (mi parte $10.000)
- **THEN** la categoría netea $10.000 (mi parte del reintegro), quedando en $40.000
- **AND** NO se resta el total del reintegro ($20.000)

#### Scenario: Los gastos propios no se ven afectados

- **WHEN** tengo un gasto propio no compartido de $30.000
- **THEN** el desglose lo cuenta completo ($30.000)
